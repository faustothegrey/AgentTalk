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

  it('should require git worktree usage when assigning a worker-only team task', async () => {
    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const sendProtocol = vi.fn().mockResolvedValue(undefined);
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Ship the feature');

    expect(sendProtocol).toHaveBeenCalledWith('worker', 'EVT', expect.objectContaining({
      type: 'team_work_assign',
      plan: expect.stringContaining('use strictly `git worktree`'),
    }));
    expect(sendProtocol).toHaveBeenCalledWith('worker', 'EVT', expect.objectContaining({
      plan: expect.stringContaining('abort the task'),
    }));
  });

  it('should keep the git worktree requirement when delegating a confirmed plan to the worker', async () => {
    const planner = new Agent('planner');
    planner.setStatus('starting');
    planner.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const sendProtocol = vi.fn().mockResolvedValue(undefined);
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner') return planner;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    const task = await coordinator.assignTask(team.id, 'Ship the feature');
    coordinator.handlePlanSubmitted('planner', [
      '1. Update `scripts/llm-agent.mjs` to tighten the worker instructions.',
      '2. Ensure the worker is told to use `git worktree` and abort otherwise.',
      '3. Verify the resulting worker assignment payload.',
    ].join('\n'));

    await coordinator.confirmPlan(task.id);

    expect(sendProtocol).toHaveBeenLastCalledWith('worker', 'EVT', expect.objectContaining({
      type: 'team_work_assign',
      plan: expect.stringContaining('use strictly `git worktree`'),
    }));
    expect(sendProtocol).toHaveBeenLastCalledWith('worker', 'EVT', expect.objectContaining({
      plan: expect.stringContaining('abort the task'),
    }));
  });

  it('should interrupt planning when submit_plan is missing before timeout', async () => {
    vi.useFakeTimers();
    try {
      const planner = new Agent('planner');
      planner.setStatus('starting');
      planner.setStatus('ready');

      const worker = new Agent('worker');
      worker.setStatus('starting');
      worker.setStatus('ready');

      const emitTeam = vi.fn();
      const emitTeamTask = vi.fn();
      const sendProtocol = vi.fn().mockResolvedValue(undefined);

      const coordinator = new TeamCoordinator(
        {
          getAgent: (id) => {
            if (id === 'planner') return planner;
            if (id === 'worker') return worker;
            throw new Error(`Unknown agent: ${id}`);
          },
          sendProtocol,
          emitTeam,
          emitTeamTask,
          emitPlanningComplete: vi.fn(),
          logError: vi.fn(),
        },
        { planningEventTimeoutMs: 50 },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);

      const task = await coordinator.assignTask(team.id, 'Ship the feature');
      await vi.advanceTimersByTimeAsync(60);

      const latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;

      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.id).toBe(task.id);
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.at(-1)?.payload).toContain('missing required event(s): submit_plan');
      expect(sendProtocol).toHaveBeenCalledWith('planner', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('should force reminder and quickly interrupt after planners signal agreement without submit_plan', async () => {
    vi.useFakeTimers();
    try {
      const plannerA = new Agent('planner-a');
      plannerA.setStatus('starting');
      plannerA.setStatus('ready');

      const plannerB = new Agent('planner-b');
      plannerB.setStatus('starting');
      plannerB.setStatus('ready');

      const worker = new Agent('worker');
      worker.setStatus('starting');
      worker.setStatus('ready');

      const emitTeam = vi.fn();
      const emitTeamTask = vi.fn();
      const sendProtocol = vi.fn().mockResolvedValue(undefined);

      const coordinator = new TeamCoordinator(
        {
          getAgent: (id) => {
            if (id === 'planner-a') return plannerA;
            if (id === 'planner-b') return plannerB;
            if (id === 'worker') return worker;
            throw new Error(`Unknown agent: ${id}`);
          },
          sendProtocol,
          emitTeam,
          emitTeamTask,
          emitPlanningComplete: vi.fn(),
          logError: vi.fn(),
        },
        {
          planningEventTimeoutMs: 5000,
          submitPlanAfterAgreementTimeoutMs: 40,
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      await coordinator.assignTask(team.id, 'Tiny cleanup');

      await coordinator.handlePlanningMessage('planner-a', 'We agree and the plan is ready. Please submit the plan.');

      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('Agreement detected'),
      }));
      expect(sendProtocol).toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('Agreement detected'),
      }));

      await vi.advanceTimersByTimeAsync(50);

      const latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.at(-1)?.payload).toContain('missing required event(s): submit_plan');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should include strict no-code-touch instruction when assigning planner task', async () => {
    const planner = new Agent('planner');
    planner.setStatus('starting');
    planner.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const sendProtocol = vi.fn().mockResolvedValue(undefined);
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner') return planner;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');

    expect(sendProtocol).toHaveBeenCalledWith('planner', 'EVT', expect.objectContaining({
      type: 'team_task_assign',
      role: 'planner',
      description: expect.stringContaining('DO NOT touch code for any reason'),
    }));
  });

  it('should include strict no-code-touch instruction in multi-planner planning topic', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const sendProtocol = vi.fn().mockResolvedValue(undefined);
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');

    const topicCalls = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(topicCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of topicCalls) {
      const payload = call[2] as Record<string, unknown>;
      expect(String(payload.topic ?? '')).toContain('DO NOT touch code for any reason');
    }
  });
});
