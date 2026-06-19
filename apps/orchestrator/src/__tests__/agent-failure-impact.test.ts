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
