import { describe, expect, it, vi } from 'vitest';
import { TeamCoordinator } from '../registry/team-coordinator.js';
import { Agent } from '../agents/agent.js';
import type { TeamTask } from '../shared/types.js';

describe('TeamCoordinator', () => {
  it('should emit an explicit planning-complete notification when the planner submits a plan', async () => {
    const planner = new Agent('planner');
    planner.setStatus('starting');
    planner.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitTeam = vi.fn();
    const emitTeamTask = vi.fn();
    const emitPlanningComplete = vi.fn();
    const sendProtocol = vi.fn().mockResolvedValue(undefined);

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner') return planner;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam,
      emitTeamTask,
      emitPlanningComplete,
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    const task = await coordinator.assignTask(team.id, 'Ship the feature');
    coordinator.handlePlanSubmitted('planner', '1. Update the code\n2. Add tests');

    const updatedTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(updatedTask.status).toBe('awaiting_confirmation');
    expect(updatedTask.planningComplete).toBe(true);
    expect(updatedTask.plannerAgentId).toBe('planner');
    expect(updatedTask.planSubmittedAt).toBeTypeOf('string');
    expect(emitPlanningComplete).toHaveBeenCalledWith({
      team: expect.objectContaining({ id: team.id, status: 'awaiting_confirmation' }),
      task: expect.objectContaining({
        id: task.id,
        status: 'awaiting_confirmation',
        planningComplete: true,
        plannerAgentId: 'planner',
        plan: '1. Update the code\n2. Add tests',
        planSubmittedAt: expect.any(String),
      }),
      plannerAgentId: 'planner',
    });
  });
});
