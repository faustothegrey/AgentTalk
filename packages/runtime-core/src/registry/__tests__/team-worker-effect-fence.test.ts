import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamCoordinator } from '../team-coordinator.js';
import type { Team, TeamTask, TeamMember, TeamTaskStatus } from '@agenttalk/contracts/types';

// M08-T3 worker effect-fence — coordinator end-state contract.
// Proves pauseTaskForOperator pauses the task WITHOUT killing anyone (D3 "kill nobody"),
// that the M03 kill path (handleAgentFailure) is byte-for-byte for the existing statuses,
// and that it harmlessly no-ops on the new awaiting_operator status (LB-16 Finding 3.2).
// No execSync/existsSync touched (no worker provisioning here) → no repo pollution (LB-9).
describe('M08-T3 worker effect-fence (coordinator)', () => {
  let coordinator: TeamCoordinator;
  let deps: any;

  const members: TeamMember[] = [
    { agentId: 'planner-a', role: 'planner' },
    { agentId: 'worker-1', role: 'worker' },
  ];

  beforeEach(() => {
    deps = {
      getAgent: vi.fn((id: string) => ({ id, status: 'ready' })),
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    };
    coordinator = new TeamCoordinator(deps);
  });

  /** Seed a task in the coordinator's internal map and attach it to the team as current. */
  function seedTask(team: Team, status: TeamTaskStatus): TeamTask {
    const now = new Date().toISOString();
    const task: TeamTask = {
      id: `task-${Math.random().toString(36).slice(2)}`,
      teamId: team.id,
      description: 'do the work',
      status,
      transcript: [],
      createdAt: now,
      updatedAt: now,
    };
    (coordinator as any).tasks.set(task.id, task);
    team.currentTaskId = task.id;
    return task;
  }

  it('pauseTaskForOperator: task → awaiting_operator, team left alive, nobody shut down', async () => {
    const team = coordinator.createTeam(members);
    const task = seedTask(team, 'in_progress');
    const shutdownSpy = vi.spyOn(coordinator as any, 'requestAgentShutdown');

    await coordinator.pauseTaskForOperator('worker-1', 'simulated worker exec timeout');

    // Task is paused, recoverable...
    expect(task.status).toBe('awaiting_operator');
    // ...the task stays attached to the team (NOT deleted, unlike the kill path)...
    expect(team.currentTaskId).toBe(task.id);
    // ...the team is NOT errored / torn down...
    expect(team.status).not.toBe('error');
    // ...nobody is shut down or notified to die...
    expect(shutdownSpy).not.toHaveBeenCalled();
    expect(deps.sendProtocol).not.toHaveBeenCalled();
    // ...it is surfaced (emitted + transcript recorded with the reason)...
    expect(deps.emitTeamTask).toHaveBeenCalledWith(task);
    expect(task.transcript).toHaveLength(1);
    expect(task.transcript[0]!.payload).toContain('simulated worker exec timeout');
    expect(task.transcript[0]!.payload.toLowerCase()).toContain('awaiting operator');
    // ...and the idle-timeout exemption sees the paused state.
    expect(coordinator.isTaskAwaitingOperator('worker-1')).toBe(true);
  });

  it('handleAgentFailure no-ops on an awaiting_operator task (M03 tolerates the new status)', async () => {
    const team = coordinator.createTeam(members);
    const task = seedTask(team, 'in_progress');
    await coordinator.pauseTaskForOperator('worker-1', 'boom');
    const shutdownSpy = vi.spyOn(coordinator as any, 'requestAgentShutdown');

    // Even if the paused worker were later flagged errored, the kill path must do nothing.
    await coordinator.handleAgentFailure('worker-1');

    expect(task.status).toBe('awaiting_operator');
    expect(team.currentTaskId).toBe(task.id);
    expect(team.status).not.toBe('error');
    expect(shutdownSpy).not.toHaveBeenCalled();
  });

  it('handleAgentFailure still kills on an in_progress task (M03 Shared-Fate unchanged)', async () => {
    const team = coordinator.createTeam(members);
    const task = seedTask(team, 'in_progress');
    // Keep the regression test hermetic: stub the planning-run persistence (file IO) and the
    // shutdown timer; we assert the state transitions, not those side effects.
    vi.spyOn(coordinator as any, 'persistPlanningRun').mockImplementation(() => {});
    const shutdownSpy = vi.spyOn(coordinator as any, 'requestAgentShutdown').mockImplementation(() => {});

    await coordinator.handleAgentFailure('worker-1');

    expect(task.status).toBe('interrupted');
    expect(team.status).toBe('error');
    expect(team.currentTaskId).toBeUndefined();
    // The surviving member is told to shut down (Shared-Fate).
    expect(shutdownSpy).toHaveBeenCalledWith('planner-a');
  });
});
