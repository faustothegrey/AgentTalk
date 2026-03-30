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
    coordinator.handlePlanSubmitted('planner', [
      '1. Update `scripts/llm-agent.mjs` to extract the planner progress-update request into a helper function.',
      '2. Keep the final `submit_plan` request in the team planner path and reuse the helper from that flow.',
      '3. Add or update tests that cover the planner progress-update and final-plan submission sequence.',
    ].join('\n'));

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
        plan: [
          '1. Update `scripts/llm-agent.mjs` to extract the planner progress-update request into a helper function.',
          '2. Keep the final `submit_plan` request in the team planner path and reuse the helper from that flow.',
          '3. Add or update tests that cover the planner progress-update and final-plan submission sequence.',
        ].join('\n'),
        planSubmittedAt: expect.any(String),
      }),
      plannerAgentId: 'planner',
    });
  });

  it('should reject exploratory plans that do not commit to a concrete implementation', async () => {
    const planner = new Agent('planner');
    planner.setStatus('starting');
    planner.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitPlanningComplete = vi.fn();
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner') return planner;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete,
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'find a punctual and small scoped refactoring point');

    expect(() => coordinator.handlePlanSubmitted('planner', [
      'I will find and implement a small refactoring in the project.',
      '',
      '1. Analyze `scripts/llm-agent.mjs` for refactoring opportunities.',
      '2. Identify the target.',
      '3. Implement the refactoring.',
      '4. Verify the changes.',
    ].join('\n'))).toThrow('exploratory');

    expect(emitPlanningComplete).not.toHaveBeenCalled();
  });
});
