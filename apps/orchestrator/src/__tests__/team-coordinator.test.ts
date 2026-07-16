import { describe, expect, it, vi } from 'vitest';
import { TeamCoordinator } from '@agenttalk/runtime-core/registry/team-coordinator';
import { Agent } from '@agenttalk/runtime-core/agents/agent';
import type { TeamTask } from '@agenttalk/contracts/types';

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
    }, { planningRunsDir: '' });

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
    }, { planningRunsDir: '' });

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

  it('should not invent a plan when assigning a worker-only team task', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Ship the feature');

    // BL-053 (PO-approved): the worker is TOLD it is already in a task worktree; it is no longer
    // asked to arrange one, nor offered a refuse-and-abort branch. The worker provisions the
    // worktree before the turn, so this is a fact of the setup — asking the agent to verify it is
    // what made agy refuse a perfectly good worktree.
    //
    // BL-062 (PO-approved, 2026-07-16) MOVED where that is asserted, and this comment is the
    // record of why. BL-053 delivered the guarantee by stuffing the worktree text into a
    // stand-in `plan` synthesized from the description (buildWorkerPlan). That stand-in was
    // itself the defect: it made the driver address a worker-only team as a plan REVIEWER
    // ("the planner has created a plan for you to review") for work it was there to DO, and it
    // delivered the task twice. So a worker-only assignment now carries NO plan, and BL-053's
    // guarantee is asserted where it now lives — the prompt — in
    // runtime-core/src/agents/__tests__/in-process-driver.test.ts:
    //   · WORKTREE_CONTEXT reaches the worker-only prompt exactly once   (the positive)
    //   · no refuse-and-abort branch                                      (the negative)
    // Nothing was weakened: in-process-driver.ts is the only consumer of this field, so moving
    // the text out of it loses no information on any path.
    const workAssign = sendProtocol.mock.calls.find(
      (c: any[]) => c[0] === 'worker' && c[2]?.type === 'team_work_assign',
    );
    expect(workAssign).toBeDefined();

    // No planner ran, so there is no plan — and none is invented.
    expect(workAssign![2].plan).toBe('');

    // The task reaches the worker once, as the description, and is not echoed back as a plan.
    expect(workAssign![2].description).toBe('Ship the feature');
  });

  it('should keep telling the worker about its task worktree when delegating a confirmed plan', async () => {
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
    }, { planningRunsDir: '' });

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

    // BL-053: the worktree context survives the planner round-trip and reaches the worker on a
    // confirmed plan too — this is the path that regressed silently when the string lived in
    // three separate copies.
    expect(sendProtocol).toHaveBeenLastCalledWith('worker', 'EVT', expect.objectContaining({
      type: 'team_work_assign',
      plan: expect.stringContaining('IS a git worktree, created for this task'),
    }));
    expect(sendProtocol).not.toHaveBeenLastCalledWith('worker', 'EVT', expect.objectContaining({
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
        { planningEventTimeoutMs: 50, planningRunsDir: '' },
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

  it('should request agreement_proposal 1 message before max, then agreement_acceptance, then arm submit_plan urgency', async () => {
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
          planningRunsDir: '',
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      // maxRepliesPerAgent = 3; agreement_proposal requested at count 2 (1 away from max)
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);
      await coordinator.handlePlanningProtocolAck('planner-a');
      await coordinator.handlePlanningProtocolAck('planner-b');
      await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
      await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      // planner-a now at count 2 (maxReplies - 1) → system asks for agreement_proposal
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');

      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'custom_event_request',
        event: 'agreement_proposal',
      }));

      // planner-a complies with agreement_proposal
      await coordinator.handleAgreementProposal('planner-a', undefined, 'Adopt the tiny-cleanup plan.');

      // System should now ask planner-b for agreement confirmation
      expect(sendProtocol).toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
        type: 'custom_event_request',
        event: expect.stringMatching(/^agreement_(reached|acceptance)$/),
      }));

      // planner-b complies with agreement_acceptance
      await coordinator.handleAgreementReached('planner-b', undefined, 'Adopt the tiny-cleanup plan.');

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
          planningRunsDir: '',
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);
      await coordinator.handlePlanningProtocolAck('planner-a');
      await coordinator.handlePlanningProtocolAck('planner-b');
      await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
      await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

      // planner-a reaches maxReplies - 1 → asked for agreement_proposal
      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');

      // planner-a ignores: sends regular message instead (reaches max) → re-asked (ask 2/2)
      await coordinator.handlePlanningMessage('planner-a', 'Still talking');

      expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
        type: 'custom_event_request',
        event: 'agreement_proposal',
        prompt: expect.stringContaining('Reminder (2/2)'),
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

  it('should allow two fallback returns to discussion when agreement_acceptance is missing, then interrupt on the third miss', async () => {
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
          planningRunsDir: '',
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);
      await coordinator.assignTask(team.id, 'Tiny cleanup', 3);
      await coordinator.handlePlanningProtocolAck('planner-a');
      await coordinator.handlePlanningProtocolAck('planner-b');
      await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
      await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

      // planner-a reaches maxReplies - 1, gets asked, complies
      await coordinator.handlePlanningMessage('planner-a', 'Idea A');
      await coordinator.handlePlanningMessage('planner-a', 'Refined A');
      await coordinator.handleAgreementProposal('planner-a', undefined, 'Adopt the tiny-cleanup plan.');

      // planner-b skips agreement_acceptance and sends discussion: fallback #1 allowed
      await coordinator.handlePlanningMessage('planner-b', 'I have more to say');
      let latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      let latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('planning');
      expect(latestTask.status).toBe('planning');
      expect(latestTask.transcript.at(-1)?.payload).toContain('returning to discussion phase (1/2');

      // Re-propose agreement, then skip agreement_acceptance again: fallback #2 allowed
      await coordinator.handleAgreementProposal('planner-a', undefined, 'Adopt the tiny-cleanup plan.');
      await coordinator.handlePlanningMessage('planner-b', 'Even more to say');
      latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('planning');
      expect(latestTask.status).toBe('planning');
      expect(latestTask.transcript.at(-1)?.payload).toContain('returning to discussion phase (2/2');

      // Re-propose agreement, then skip agreement_acceptance a third time: fail
      await coordinator.handleAgreementProposal('planner-a', undefined, 'Adopt the tiny-cleanup plan.');
      await coordinator.handlePlanningMessage('planner-b', 'Still discussing');

      latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.at(-1)?.payload).toMatch(/missing required event\(s\): agreement_(reached|acceptance)/);
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');

    expect(sendProtocol).toHaveBeenCalledWith('planner', 'EVT', expect.objectContaining({
      type: 'team_task_assign',
      role: 'planner',
      description: expect.stringContaining('DO NOT modify code for any reason'),
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');

    expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
      type: 'custom_event_request',
      event: 'ack_planning_protocol',
      prompt: expect.stringContaining('At every planning reply, explicitly motivate why your selected message_type matches the current protocol step.'),
    }));
    expect(sendProtocol).toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
      type: 'custom_event_request',
      event: 'ack_planning_protocol',
      prompt: expect.stringContaining('Be very coherent: do not decide on one message_type and then send another.'),
    }));

    const topicCallsBeforeAck = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(topicCallsBeforeAck).toHaveLength(0);

    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');

    // After acks, fact_collection_begin should be sent (not conversation_start yet)
    const factCollectionCalls = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'fact_collection_begin',
    );
    expect(factCollectionCalls.length).toBe(2);

    const convStartBeforeFacts = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(convStartBeforeFacts).toHaveLength(0);

    // Complete fact collection
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed patterns');

    const topicCalls = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(topicCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of topicCalls) {
      const payload = call[2] as Record<string, unknown>;
      expect(String(payload.topic ?? '')).toContain('DO NOT modify code for any reason');
      expect(String(payload.topic ?? '')).toContain('At every planning reply, explicitly motivate why your selected message_type matches the current protocol step.');
      expect(payload.maxReplies).toBe(10);
    }
  });

  it('should not send orchestrator reminder messages during planning exchange', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed patterns');
    sendProtocol.mockClear();

    await coordinator.handlePlanningMessage('planner-a', 'Draft step 1');

    expect(sendProtocol).not.toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
      type: 'message_received',
      from: 'system',
      payload: expect.stringContaining('Orchestrator reminder:'),
    }));
  });

  it('should block planning discussion messages until both planners acknowledge protocol', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    sendProtocol.mockClear();

    const handled = await coordinator.handlePlanningMessage('planner-a', 'Draft plan point');
    expect(handled).toBe(true);
    expect(sendProtocol).toHaveBeenCalledWith('planner-a', 'EVT', expect.objectContaining({
      type: 'custom_event_request',
      event: 'ack_planning_protocol',
    }));
    expect(sendProtocol).not.toHaveBeenCalledWith('planner-b', 'EVT', expect.objectContaining({
      type: 'message_received',
      from: 'planner-a',
      payload: 'Draft plan point',
    }));
  });

  it('should reject agreement_proposal before discussion phase opens', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');

    await expect(coordinator.handleAgreementProposal('planner-a')).rejects.toThrow(
      'Unexpected agreement_proposal: planning phase is protocol_ack_pending',
    );
  });

  it('should error on agreement_acceptance in discussion without a pending proposal', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed patterns');

    await expect(coordinator.handleAgreementReached('planner-b', undefined, 'Adopt the tiny-cleanup plan.')).rejects.toThrow(
      'Unexpected agreement_acceptance: no pending agreement proposal to confirm',
    );
  });

  it('M10-T2: corrects submit_plan-before-agreement (bounded), then ejects the offender on repeated illegal moves', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitTeamTask = vi.fn();
    const emitPlanningComplete = vi.fn();
    const sendProtocol = vi.fn().mockResolvedValue(undefined);
    const onProtocolEvent = vi.fn(); // bridge v3: observe the real correction/eject sites
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask,
      emitPlanningComplete,
      onProtocolEvent,
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    const submitOnce = () => coordinator.handlePlanSubmitted('planner-a', [
      '1. Update `src/registry/team-coordinator.ts` to tighten validation.',
      '2. Add tests for protocol progression.',
      '3. Run test suite and confirm no regressions.',
    ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');

    // M10-T2: submit_plan before agreement is an illegal forward move. The graded
    // loop now CORRECTS it (bounded) before ejecting — it no longer dual-kills.
    // Attempt 1: correction sent, planning still alive.
    submitOnce();
    const correction1 = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('correction attempt 1/2'),
    );
    expect(correction1).toBeDefined();
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    expect(emitPlanningComplete).not.toHaveBeenCalled();

    // Attempt 2: still a correction, planning still alive.
    submitOnce();
    const correction2 = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('correction attempt 2/2'),
    );
    expect(correction2).toBeDefined();
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();

    // Attempt 3: budget exhausted → eject the offender (fail-soft, NOT dual-kill).
    submitOnce();
    await new Promise((r) => setTimeout(r, 0));

    const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(latestTask.status).toBe('awaiting_operator'); // frozen for operator, not 'interrupted'
    expect(latestTask.transcript.some(e => e.payload.includes('Planner planner-a ejected'))).toBe(true);
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined(); // task stays attached for the operator
    expect(emitPlanningComplete).not.toHaveBeenCalled();

    // The surviving planner-b is kept alive and notified.
    const peerNotice = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-b' && typeof payload === 'object' && (payload as any).payload?.includes?.('You remain active'),
    );
    expect(peerNotice).toBeDefined();

    // bridge v3: the real graded-loop sites emit observability events — a correction
    // for each bounded retry, then an eject when the budget is exhausted.
    expect(onProtocolEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'correction', agentId: 'planner-a' }),
    );
    expect(onProtocolEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'eject', agentId: 'planner-a' }),
    );
  });

  it('M10-T2: an illegal move is corrected and the planner RECOVERS within budget (no eject)', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitTeamTask = vi.fn();
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
      emitTeamTask,
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // One illegal forward move (submit_plan in discussion) → correction, planning alive.
    coordinator.handlePlanSubmitted('planner-a', [
      '1. Update `src/registry/team-coordinator.ts` to tighten validation.',
      '2. Run test suite and confirm no regressions.',
    ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');
    const correction = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('correction attempt 1/2'),
    );
    expect(correction).toBeDefined();
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();

    // The planner now sends a LEGAL move — it recovers, no eject.
    await coordinator.handleAgreementProposal('planner-a', ['agreement_acceptance', 'opinion'], 'Adopt the tiny-cleanup plan.');

    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    const ejected = emitTeamTask.mock.calls.some(
      ([t]) => (t as TeamTask)?.status === 'awaiting_operator',
    );
    expect(ejected).toBe(false); // never ejected
    const ejectNotice = sendProtocol.mock.calls.some(
      ([, , payload]) => typeof payload === 'object' && (payload as any).payload?.includes?.('ejected'),
    );
    expect(ejectNotice).toBe(false);
  });

  it('M10-T2: asks for regression confirmation twice then EJECTS the offender on confirmed regression', async () => {
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
    const emitTeamTask = vi.fn();
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask,
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a refactoring');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // Advance to agreement_acceptance (rank 2)
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // First regression attempt: should get confirmation ask
    sendProtocol.mockClear();
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');

    const confirmCall1 = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('confirmation attempt 1/2'),
    );
    expect(confirmCall1).toBeDefined();
    // Planning should still be active
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();

    // Second attempt: still confirmation
    sendProtocol.mockClear();
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');

    const confirmCall2 = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('confirmation attempt 2/2'),
    );
    expect(confirmCall2).toBeDefined();
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();

    // Third attempt: budget exhausted — M10-T2 EJECTS the offender (fail-soft),
    // it no longer dual-kills both planners.
    sendProtocol.mockClear();
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await new Promise((r) => setTimeout(r, 0));

    // Task stays attached for the operator (peer + round survive), frozen.
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(latestTask.status).toBe('awaiting_operator');
    expect(latestTask.transcript.some(e => e.payload.includes('Planner planner-a ejected'))).toBe(true);

    // The surviving planner-b is kept alive and notified (not shut down).
    const peerNotice = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-b' && typeof payload === 'object' && (payload as any).payload?.includes?.('You remain active'),
    );
    expect(peerNotice).toBeDefined();
  });

  it('should ask for regression confirmation on discussion after agreement_acceptance', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a refactoring');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // Advance to agreement_acceptance (rank 2)
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // Discussion (rank 0) after agreement_acceptance — regression, should get confirmation
    sendProtocol.mockClear();
    await coordinator.handlePlanningMessage('planner-a', 'One more thought...', undefined, ['opinion']);

    const confirmCall = sendProtocol.mock.calls.find(
      ([id, , payload]) => id === 'planner-a' && typeof payload === 'object' && (payload as any).payload?.includes?.('confirmation attempt 1/2'),
    );
    expect(confirmCall).toBeDefined();
    // Planning should still be active
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
  });

  it('should clear regression retry count when advancing past the contested rank', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // Advance to agreement_acceptance (rank 2)
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // Use 1 retry (regression)
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');

    // Now advance further — submit_plan (rank 3) clears retries
    coordinator.handlePlanSubmitted('planner-a', [
      '1. Update `src/registry/team-coordinator.ts` to tighten validation.',
      '2. Run test suite and confirm no regressions.',
      '3. Commit changes.',
    ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');

    const currentTaskId = coordinator.getTeam(team.id).currentTaskId as string;
    const task = coordinator.getTask(currentTaskId);
    expect(task.planningComplete).toBe(true);
  });

  it('should reject submit_plan from the agent that issued agreement_acceptance', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a refactoring');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // planner-a proposes, planner-b confirms agreement
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // planner-b (who confirmed) tries to submit the plan — should be rejected
    expect(() => {
      coordinator.handlePlanSubmitted('planner-b', [
        '1. Refactor `src/registry/team-coordinator.ts` to extract validation.',
        '2. Add tests for the new module.',
        '3. Run test suite.',
      ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');
    }).toThrow(/The agent that confirmed agreement_(reached|acceptance) cannot submit the plan/);
  });

  it('should accept submit_plan from the agent that did NOT issue agreement_acceptance', async () => {
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
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a refactoring');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    // planner-a proposes, planner-b confirms agreement
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // planner-a (proposer, not the confirmer) submits the plan — should succeed
    expect(() => {
      coordinator.handlePlanSubmitted('planner-a', [
        '1. Refactor `src/registry/team-coordinator.ts` to extract validation.',
        '2. Add tests for the new module.',
        '3. Run test suite.',
      ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');
    }).not.toThrow();

    const taskId = coordinator.getTeam(team.id).currentTaskId;
    // Task should be undefined (cleared) or in awaiting_confirmation
    const task = coordinator.getTask(taskId!);
    expect(task.status).toBe('awaiting_confirmation');
  });

  it('M10-T2: corrects then ejects the offender on repeated agreement_acceptance when submit_plan is expected', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitTeamTask = vi.fn();
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask,
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a tiny cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Found relevant code in src/');
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed test patterns');

    await coordinator.handlePlanningMessage(
      'planner-a',
      'Proposed direction',
      undefined,
      ['opinion', 'agreement_proposal'],
    );
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the tiny-cleanup plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    // M10-T2: re-sending agreement_acceptance when submit_plan is expected is an
    // illegal (lateral) move. The graded loop corrects it (bounded N=2) before
    // ejecting the offender — it no longer dual-kills both planners.
    const resend = () => coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the tiny-cleanup plan.');

    await resend(); // correction 1
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    await resend(); // correction 2
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    await resend(); // budget exhausted → eject offender (fail-soft)
    await new Promise((r) => setTimeout(r, 0));

    // Fail-soft: task frozen for the operator, peer + round survive (NOT dual-kill).
    expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
    const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(latestTask.status).toBe('awaiting_operator');
    expect(latestTask.transcript.some(e => e.payload.includes('Planner planner-b ejected'))).toBe(true);
  });

  it('should advance max rank even when agreement_acceptance is sent without expectedResponseTypes', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const emitTeamTask = vi.fn();
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
      emitTeamTask,
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test max rank advancement', 10);
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'Facts A');
    await coordinator.handleFactCollectionEnd('planner-b', 'Facts B');

    await coordinator.handlePlanningMessage('planner-a', 'Idea');

    // Proposal sent without expectedResponseTypes (simulates custom_event_request compliance)
    await coordinator.handleAgreementProposal('planner-a', undefined, 'Adopt the tiny-cleanup plan.');

    // agreement_acceptance sent without expectedResponseTypes (same compliance path)
    await coordinator.handleAgreementReached('planner-b', undefined, 'Adopt the tiny-cleanup plan.');

    // Task should still be in planning (not interrupted), awaiting submit_plan
    const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(latestTask.status).toBe('planning');
    expect(latestTask.transcript.some((t) => t.payload.includes('Agreement reached for proposal: Adopt the tiny-cleanup plan.'))).toBe(true);

    // Now submit_plan should succeed (not be treated as a violation)
    coordinator.handlePlanSubmitted('planner-a', [
      '1. Extract shared PTY helpers into scripts/lib/pty-helpers.mjs.',
      '2. Update gemini-pty.mjs, claude-pty.mjs, codex-pty.mjs to import from shared module.',
      '3. Add regression tests to verify wrapper behavior parity.',
    ].join('\n'), 'Adopt the tiny-cleanup plan.', 'Submitting final plan.');

    const finalTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(finalTask.status).toBe('awaiting_confirmation');
    expect(finalTask.planningComplete).toBe(true);
  });

  it('should send fact_collection_begin after all planners ack and conversation_start after all fact_collection_end', async () => {
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
    const emitTeamTask = vi.fn();
    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol,
      emitTeam: vi.fn(),
      emitTeamTask,
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test fact collection');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');

    // fact_collection_begin should be sent to both planners
    const factBeginCalls = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'fact_collection_begin',
    );
    expect(factBeginCalls).toHaveLength(2);

    // conversation_start should NOT be sent yet
    const convStartBefore = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(convStartBefore).toHaveLength(0);

    // First planner completes — still waiting
    await coordinator.handleFactCollectionEnd('planner-a', 'Found code in src/registry');
    const convStartAfterOne = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(convStartAfterOne).toHaveLength(0);

    // Second planner completes — conversation_start fires
    await coordinator.handleFactCollectionEnd('planner-b', 'Reviewed tests');
    const convStartAfterBoth = sendProtocol.mock.calls.filter((call) =>
      call[1] === 'EVT' &&
      call[2] &&
      typeof call[2] === 'object' &&
      (call[2] as Record<string, unknown>).type === 'conversation_start',
    );
    expect(convStartAfterBoth).toHaveLength(2);

    // Transcript should record fact collection events
    const lastTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
    expect(lastTask.transcript.some((t) => t.payload.includes('Fact collection phase started'))).toBe(true);
    expect(lastTask.transcript.some((t) => t.payload.includes('Found code in src/registry'))).toBe(true);
    expect(lastTask.transcript.some((t) => t.payload.includes('All planners completed fact collection'))).toBe(true);
  });

  it('should reject duplicate fact_collection_end from the same planner', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test duplicate fact end');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');

    await coordinator.handleFactCollectionEnd('planner-a', 'My findings');
    await expect(coordinator.handleFactCollectionEnd('planner-a', 'Duplicate')).rejects.toThrow(
      'fact collection already completed by this agent',
    );
  });

  it('should block planning messages during fact collection phase', async () => {
    const plannerA = new Agent('planner-a');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');

    const plannerB = new Agent('planner-b');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');

    const worker = new Agent('worker');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Test message blocking');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');

    // Planning messages should be silently blocked during fact collection
    const handled = await coordinator.handlePlanningMessage('planner-a', 'Premature discussion');
    expect(handled).toBe(true); // true = handled (blocked), not forwarded
  });

  it('should interrupt planning when fact collection times out', async () => {
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

      const coordinator = new TeamCoordinator(
        {
          getAgent: (id) => {
            if (id === 'planner-a') return plannerA;
            if (id === 'planner-b') return plannerB;
            if (id === 'worker') return worker;
            throw new Error(`Unknown agent: ${id}`);
          },
          sendProtocol: vi.fn().mockResolvedValue(undefined),
          emitTeam,
          emitTeamTask,
          emitPlanningComplete: vi.fn(),
          logError: vi.fn(),
        },
        {
          planningRunsDir: '',
          factCollectionTimeoutMs: 100,
        },
      );

      const team = coordinator.createTeam([
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ]);

      await coordinator.assignTask(team.id, 'Test timeout');
      await coordinator.handlePlanningProtocolAck('planner-a');
      await coordinator.handlePlanningProtocolAck('planner-b');

      // Only one planner completes fact collection
      await coordinator.handleFactCollectionEnd('planner-a', 'My findings');

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(150);

      const latestTeam = emitTeam.mock.calls.at(-1)?.[0];
      const latestTask = emitTeamTask.mock.calls.at(-1)?.[0] as TeamTask;
      expect(latestTeam.status).toBe('interrupted');
      expect(latestTask.status).toBe('interrupted');
      expect(latestTask.transcript.some((t) => t.payload.includes('Fact collection timed out'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  // M08 — consensus late-message race tolerance.
  // Repro: after planning completes (task → awaiting_confirmation), a straggler message from
  // the other planner used to THROW the "task is not in planning status" guard → the agent
  // was marked `error` → M03 propagation killed the whole (already-successful) team task.
  // The late message must now be a benign no-op, leaving the consensus result intact.
  it('M08: a late planning message after planning completes is ignored, not fatal to the team', async () => {
    const plannerA = new Agent('planner-a'); plannerA.setStatus('starting'); plannerA.setStatus('ready');
    const plannerB = new Agent('planner-b'); plannerB.setStatus('starting'); plannerB.setStatus('ready');
    const worker = new Agent('worker'); worker.setStatus('starting'); worker.setStatus('ready');

    const coordinator = new TeamCoordinator({
      getAgent: (id) => {
        if (id === 'planner-a') return plannerA;
        if (id === 'planner-b') return plannerB;
        if (id === 'worker') return worker;
        throw new Error(`Unknown agent: ${id}`);
      },
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    }, { planningRunsDir: '' });

    const team = coordinator.createTeam([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    await coordinator.assignTask(team.id, 'Do a cleanup');
    await coordinator.handlePlanningProtocolAck('planner-a');
    await coordinator.handlePlanningProtocolAck('planner-b');
    await coordinator.handleFactCollectionEnd('planner-a', 'facts a');
    await coordinator.handleFactCollectionEnd('planner-b', 'facts b');
    await coordinator.handleAgreementProposal('planner-a', ['agreement_proposal'], 'Adopt the plan.');
    await coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the plan.');

    // planner-a submits the final plan → task advances out of `planning`.
    const validPlan = '1. Update `src/registry/team-coordinator.ts` to tighten validation.\n2. Run the test suite and confirm no regressions.';
    coordinator.handlePlanSubmitted('planner-a', validPlan, 'Adopt the plan.', 'Submitting.');
    const taskId = coordinator.getTeam(team.id).currentTaskId as string;
    expect(coordinator.getTask(taskId).status).toBe('awaiting_confirmation');

    // RACE: planner-b's stragglers arrive AFTER planning completed — must be ignored, not thrown.
    expect(() => coordinator.handlePlanSubmitted('planner-b', validPlan, 'Adopt the plan.', 'late')).not.toThrow();
    await expect(coordinator.handleAgreementProposal('planner-b', ['agreement_proposal'], 'Adopt the plan.')).resolves.toBeUndefined();
    await expect(coordinator.handleAgreementReached('planner-b', ['agreement_acceptance'], 'Adopt the plan.')).resolves.toBeUndefined();

    // The completed consensus is unharmed.
    expect(coordinator.getTask(taskId).status).toBe('awaiting_confirmation');
  });
});
