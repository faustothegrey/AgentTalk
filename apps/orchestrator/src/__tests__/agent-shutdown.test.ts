import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamCoordinator } from '@agenttalk/runtime-core/registry/team-coordinator';
import { Agent } from '@agenttalk/runtime-core/agents/agent';
import type { Team, TeamMember } from '@agenttalk/contracts/types';

describe('TeamCoordinator - Agent Shutdown', () => {
  let teamCoordinator: TeamCoordinator;
  let deps: any;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = {
      getAgent: vi.fn(),
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    };
    teamCoordinator = new TeamCoordinator(deps, {
      agentShutdownTimeoutMs: 1000, // 1 second for testing
      planningRunsDir: '',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should request planner shutdown after plan submission and forcibly kill if it does not exit', async () => {
    const plannerAgent = new Agent('planner');
    plannerAgent.setStatus('starting');
    plannerAgent.setStatus('ready');
    const workerAgent = new Agent('worker');
    workerAgent.setStatus('starting');
    workerAgent.setStatus('ready');

    deps.getAgent.mockImplementation((id: string) => {
      if (id === 'planner') return plannerAgent;
      if (id === 'worker') return workerAgent;
      throw new Error('Not found');
    });

    const members: TeamMember[] = [
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ];

    const team = teamCoordinator.createTeam(members);
    await teamCoordinator.assignTask(team.id, 'Test task');

    // Submit plan
    teamCoordinator.handlePlanSubmitted('planner', '1. Implement log consolidation in src/logger.ts');

    // Verify conversation_end was sent
    expect(deps.sendProtocol).toHaveBeenCalledWith('planner', 'EVT', expect.objectContaining({
      type: 'conversation_end'
    }));

    // Wait for shutdown timeout
    vi.advanceTimersByTime(1000);

    // Verify removeAgent was called (forced kill)
    expect(deps.removeAgent).toHaveBeenCalledWith('planner');
  });

  it('should clear shutdown timer if agent is removed from team manually', async () => {
    const plannerAgent = new Agent('planner');
    plannerAgent.setStatus('starting');
    plannerAgent.setStatus('ready');
    const workerAgent = new Agent('worker');
    workerAgent.setStatus('starting');
    workerAgent.setStatus('ready');

    deps.getAgent.mockImplementation((id: string) => {
      if (id === 'planner') return plannerAgent;
      if (id === 'worker') return workerAgent;
      throw new Error('Not found');
    });

    const members: TeamMember[] = [
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ];

    const team = teamCoordinator.createTeam(members);
    await teamCoordinator.assignTask(team.id, 'Test task');

    // Submit plan to trigger shutdown timer
    teamCoordinator.handlePlanSubmitted('planner', '1. Implement log consolidation in src/logger.ts');

    // Manually remove agent from team (e.g. registry.removeAgent would call this)
    teamCoordinator.removeAgentFromTeams('planner');

    // Wait for shutdown timeout
    vi.advanceTimersByTime(1000);

    // removeAgent should NOT have been called by the watchdog because it was cleared
    expect(deps.removeAgent).not.toHaveBeenCalled();
  });
});
