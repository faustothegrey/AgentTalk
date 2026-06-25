import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamCoordinator } from '@agenttalk/runtime-core/registry/team-coordinator';
import { Agent } from '@agenttalk/runtime-core/agents/agent';

describe('TeamCoordinator Agent Failure Handling', () => {
  let coordinator: TeamCoordinator;
  let deps: any;

  beforeEach(() => {
    deps = {
      getAgent: vi.fn(),
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    };
    coordinator = new TeamCoordinator(deps);
  });

  it('should interrupt planning when a planner agent fails', async () => {
    const planner1 = new Agent('p1');
    const planner2 = new Agent('p2');
    const worker = new Agent('w1');

    planner1.setStatus('starting');
    planner1.setStatus('ready');
    planner2.setStatus('starting');
    planner2.setStatus('ready');
    worker.setStatus('starting');
    worker.setStatus('ready');

    deps.getAgent.mockImplementation((id: string) => {
      if (id === 'p1') return planner1;
      if (id === 'p2') return planner2;
      if (id === 'w1') return worker;
      throw new Error('Agent not found');
    });

    const team = coordinator.createTeam([
      { agentId: 'p1', role: 'planner' },
      { agentId: 'p2', role: 'planner' },
      { agentId: 'w1', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test Task');

    const task = coordinator.getTask(team.currentTaskId!);
    expect(task.status).toBe('planning');

    // Simulate agent p1 failure
    planner1.setStatus('busy');
    planner1.setStatus('error');
    
    await coordinator.handleAgentFailure('p1');

    expect(task.status).toBe('interrupted');
    expect(team.status).toBe('interrupted');
    expect(task.transcript.some(e => e.payload.includes('Agent p1 error'))).toBe(true);
    
    // Should notify the OTHER planner (p2)
    expect(deps.sendProtocol).toHaveBeenCalledWith('p2', 'EVT', expect.objectContaining({
      type: 'message_received',
      payload: expect.stringContaining('Planning interrupted')
    }));
  });

  it('M10-T1: ejectPlanner removes ONLY the offender, keeps the peer alive, and freezes the round fail-soft', async () => {
    // Dedicated coordinator: tiny shutdown timeout so the offender's scheduled
    // removal fires quickly; large planning/urgency timeouts so no watchdog
    // interferes during the test.
    const ejectDeps: any = {
      getAgent: vi.fn(),
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    };
    const ejectCoordinator = new TeamCoordinator(ejectDeps, {
      agentShutdownTimeoutMs: 1,
      planningEventTimeoutMs: 100000,
      submitPlanUrgencyTimeoutMs: 100000,
    });

    const planner1 = new Agent('p1');
    const planner2 = new Agent('p2');
    const worker = new Agent('w1');
    for (const a of [planner1, planner2, worker]) {
      a.setStatus('starting');
      a.setStatus('ready');
    }

    ejectDeps.getAgent.mockImplementation((id: string) => {
      if (id === 'p1') return planner1;
      if (id === 'p2') return planner2;
      if (id === 'w1') return worker;
      throw new Error('Agent not found');
    });

    const team = ejectCoordinator.createTeam([
      { agentId: 'p1', role: 'planner' },
      { agentId: 'p2', role: 'planner' },
      { agentId: 'w1', role: 'worker' },
    ]);

    await ejectCoordinator.assignTask(team.id, 'Test Task');
    const task = ejectCoordinator.getTask(team.currentTaskId!);
    expect(task.status).toBe('planning');
    const teamStatusBefore = team.status;
    const currentTaskIdBefore = team.currentTaskId;

    // Eject the offending planner p1.
    await ejectCoordinator.ejectPlanner('p1', 'persistent illegal move');

    // Fail-soft: task frozen for the operator, team NOT killed, task still attached.
    expect(task.status).toBe('awaiting_operator');
    expect(team.status).toBe(teamStatusBefore); // not 'interrupted'/'error'
    expect(team.currentTaskId).toBe(currentTaskIdBefore);
    expect(task.transcript.some(e => e.payload.includes('Planner p1 ejected'))).toBe(true);

    // The surviving planner p2 is notified — and kept alive.
    expect(ejectDeps.sendProtocol).toHaveBeenCalledWith('p2', 'EVT', expect.objectContaining({
      type: 'message_received',
      payload: expect.stringContaining('You remain active'),
    }));

    // Let the offender's scheduled shutdown fire.
    await new Promise((r) => setTimeout(r, 20));

    // The inverse of dual-kill: ONLY the offender is removed; the peer survives.
    expect(ejectDeps.removeAgent).toHaveBeenCalledWith('p1');
    expect(ejectDeps.removeAgent).not.toHaveBeenCalledWith('p2');
  });

  it('should interrupt in-progress task when worker fails', async () => {
    const worker = new Agent('w1');
    worker.setStatus('starting');
    worker.setStatus('ready');

    deps.getAgent.mockImplementation((id: string) => {
      if (id === 'w1') return worker;
      throw new Error('Agent not found');
    });

    const team = coordinator.createTeam([
      { agentId: 'w1', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test Task');
    const task = coordinator.getTask(team.currentTaskId!);
    
    // Worker accepts
    coordinator.handleWorkResponse('w1', true);
    expect(task.status).toBe('in_progress');

    // Simulate worker failure
    worker.setStatus('busy');
    worker.setStatus('error');
    
    await coordinator.handleAgentFailure('w1');

    expect(task.status).toBe('interrupted');
    expect(team.status).toBe('error');
    expect(task.transcript.some(e => e.payload.includes('Agent w1 entered error state'))).toBe(true);
  });
});
