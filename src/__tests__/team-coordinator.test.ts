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

  it('should request agreement_proposal 1 message before max, then agreement_reached, then arm submit_plan urgency', async () => {
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
          planningEventTimeoutMs: 50_000,
          submitPlanUrgencyTimeoutMs: 40,
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      // maxRepliesPerAgent = 3; agreement_proposal requested at count 2 (1 away from max)
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);

      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      // planner-a now at count 2 (maxReplies - 1) → system asks for agreement_proposal
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');

      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('agreement_proposal'),
      }));

      // planner-a complies with agreement_proposal
      await coordinator.handleAgreementProposal('planner-a');

      // System should now ask planner-b for agreement_reached
      expect(sendProtocol).toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('agreement_reached'),
      }));

      // planner-b complies with agreement_reached
      await coordinator.handleAgreementReached('planner-b');

      // submit_plan urgency should now be armed
      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('Reply limit reached'),
      }));

      // Urgency timeout → re-issue
      await vi.advanceTimersByTimeAsync(50);
      const midTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(midTask.status).toBe('planning');

      // Second urgency timeout → interrupt
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

  it('should interrupt planning after 2 ignored agreement_proposal requests', async () => {
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
          planningEventTimeoutMs: 500_000,
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);

      // planner-a reaches maxReplies - 1 → asked for agreement_proposal
      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');

      // planner-a ignores: sends regular message instead (reaches max) → re-asked (ask 2/2)
      await coordinator.handlePlanningMessage('planner-a', 'Still talking');

      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('Reminder (2/2)'),
      }));

      // Compliance timer fires after 2nd ask → planning interrupted
      await vi.advanceTimersByTimeAsync(65_000);

      const latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.at(-1)?.payload).toContain('missing required event(s): agreement_proposal');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should interrupt planning after 2 ignored agreement_reached requests', async () => {
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
          planningEventTimeoutMs: 500_000,
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);

      // planner-a reaches maxReplies - 1, gets asked, complies
      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');
      await coordinator.handleAgreementProposal('planner-a');

      // planner-b ignores agreement_reached: sends regular message → re-asked
      await coordinator.handlePlanningMessage('planner-b', 'I have more to say');

      expect(sendProtocol).toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
        type: 'message_received',
        from: 'system',
        payload: expect.stringContaining('Reminder (2/2)'),
      }));

      // planner-b ignores again: sends another regular message → fail
      await coordinator.handlePlanningMessage('planner-b', 'Even more to say');

      const latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.at(-1)?.payload).toContain('missing required event(s): agreement_reached');
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
      expect(payload.maxReplies).toBe(10);
    }
  });
});
