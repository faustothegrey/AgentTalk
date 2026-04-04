import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { Registry } from '../registry/registry.js';
import type { ProcessAdapter } from '../agents/process-adapter.js';
import { ScenarioRunner } from '../scenarios/scenario-runner.js';
import type { ScenarioDefinition } from '../scenarios/types.js';

describe('ScenarioRunner', () => {
  let adapter: ProcessAdapter;
  let registry: Registry;
  let dataCallbacks: Map<string, (chunk: string) => void>;
  let exitCallbacks: ((id: string, code: number | null) => void)[];
  const TRANSCRIPT_DIR = './test-transcripts-scenario';
  const conversationStorePath = `${TRANSCRIPT_DIR}/conversations.json`;

  beforeEach(() => {
    dataCallbacks = new Map();
    exitCallbacks = [];

    let ackCounter = 0;

    adapter = {
      spawn: vi.fn(),
      sendText: vi.fn().mockImplementation((id: string, text: string) => {
        const cb = dataCallbacks.get(id);
        if (cb) {
          cb(text);
          // Auto-respond to healthcheck EVTs so conversations can start
          const healthMatch = text.match(/"type":"healthcheck","token":"([^"]+)"/);
          if (healthMatch?.[1]) {
            ackCounter++;
            const ackLine = `[AgentTalk]:REQ:${JSON.stringify({
              id: `ack-${ackCounter}`,
              call: 'ack_healthcheck',
              args: { token: healthMatch[1], message: 'ok' },
            })}\n`;
            cb(ackLine);
          }
        }
      }),
      onData: vi.fn().mockImplementation((id: string, cb: (chunk: string) => void) => {
        dataCallbacks.set(id, cb);
      }),
      kill: vi.fn(),
      onExit: vi.fn().mockImplementation((cb) => {
        exitCallbacks.push(cb);
      }),
    };

    registry = new Registry(adapter, {
      readinessTimeoutMs: 2000,
      conversationStorePath,
    });

    vi.useFakeTimers();

    if (existsSync(TRANSCRIPT_DIR)) {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    await registry.destroy();
    vi.restoreAllMocks();

    if (existsSync(TRANSCRIPT_DIR)) {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    }
  });

  function pushOutput(id: string, text: string) {
    const cb = dataCallbacks.get(id);
    if (cb) cb(text);
  }

  function makeReadyLine(session = 's1'): string {
    return `[AgentTalk]:READY:${JSON.stringify({ session, sessionStatus: 'ready' })}\n`;
  }

  const minimalScenario: ScenarioDefinition = {
    name: 'Test Scenario',
    agents: [
      { id: 'agent-a', provider: 'gemini', model: 'gemini-2.5-pro' },
    ],
  };

  const twoAgentScenario: ScenarioDefinition = {
    name: 'Two Agent Chat',
    agents: [
      { id: 'agent-a', provider: 'gemini', model: 'gemini-2.5-pro' },
      { id: 'agent-b', provider: 'claude', model: 'sonnet' },
    ],
    conversations: [
      {
        agentIds: ['agent-a', 'agent-b'],
        topic: 'Discuss testing.',
        maxRepliesPerAgent: 2,
      },
    ],
  };

  // ── Validation ───────────────────────────────────────────────

  it('should reject a scenario with no name', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const result = await runner.run({ name: '', agents: [{ id: 'a', provider: 'p', model: 'm' }] }, registry);
    expect(result.status).toBe('error');
    expect(result.error).toContain('requires a name');
  });

  it('should reject a scenario with no agents', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const result = await runner.run({ name: 'Empty', agents: [] }, registry);
    expect(result.status).toBe('error');
    expect(result.error).toContain('at least one agent');
  });

  it('should reject duplicate agent ids', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const result = await runner.run({
      name: 'Dupe',
      agents: [
        { id: 'same', provider: 'gemini', model: 'm' },
        { id: 'same', provider: 'claude', model: 'm' },
      ],
    }, registry);
    expect(result.status).toBe('error');
    expect(result.error).toContain('Duplicate agent id');
  });

  it('should reject conversations referencing unknown agents', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const result = await runner.run({
      name: 'Bad Ref',
      agents: [{ id: 'a', provider: 'p', model: 'm' }],
      conversations: [{ agentIds: ['a', 'unknown'], topic: 'x', maxRepliesPerAgent: 1 }],
    }, registry);
    expect(result.status).toBe('error');
    expect(result.error).toContain('unknown agent');
  });

  it('should reject agents without provider or model', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const noProvider = await runner.run({
      name: 'Bad',
      agents: [{ id: 'a', provider: '', model: 'm' }],
    }, registry);
    expect(noProvider.status).toBe('error');
    expect(noProvider.error).toContain('requires a provider');
  });

  // ── Agent creation and startup ──────────────────────────────

  it('should create and start agents', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });

    const runPromise = runner.run(minimalScenario, registry);

    // Simulate the agent becoming ready
    await vi.advanceTimersByTimeAsync(10);
    pushOutput('agent-a', makeReadyLine());

    const result = await runPromise;

    expect(result.status).toBe('completed');
    expect(result.agentIds).toEqual(['agent-a']);
    expect(adapter.spawn).toHaveBeenCalledOnce();

    const agent = registry.getAgent('agent-a');
    expect(agent.status).toBe('ready');
  });

  it('should build correct launch commands from provider and model', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });

    const runPromise = runner.run(minimalScenario, registry);
    await vi.advanceTimersByTimeAsync(10);
    pushOutput('agent-a', makeReadyLine());
    await runPromise;

    expect(adapter.spawn).toHaveBeenCalledWith(
      'agent-a',
      'node scripts/llm-agent.mjs gemini --model gemini-2.5-pro',
      expect.objectContaining({ cwd: process.cwd() }),
    );
  });

  // ── Readiness waiting ───────────────────────────────────────

  it('should wait for all agents to be ready before starting conversations', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 500 });

    const runPromise = runner.run(twoAgentScenario, registry);

    // Only make agent-a ready first
    await vi.advanceTimersByTimeAsync(10);
    pushOutput('agent-a', makeReadyLine('sa'));

    // Conversation should not have started yet
    expect(registry.getConversations()).toHaveLength(0);

    // Now make agent-b ready
    await vi.advanceTimersByTimeAsync(10);
    pushOutput('agent-b', makeReadyLine('sb'));

    const result = await runPromise;

    expect(result.status).toBe('completed');
    expect(result.conversationIds).toHaveLength(1);
    expect(registry.getConversations()).toHaveLength(1);
  });

  it('should fail with timeout when an agent never becomes ready', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });

    const runPromise = runner.run(minimalScenario, registry);

    // Advance past the readiness timeout without sending READY
    await vi.advanceTimersByTimeAsync(200);

    const result = await runPromise;

    expect(result.status).toBe('error');
    expect(result.error).toContain('No agents became ready for the scenario');
  });

  it('should fail when an agent enters error state', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 500 });

    const runPromise = runner.run(minimalScenario, registry);

    // Simulate agent process exiting (triggers error state)
    await vi.advanceTimersByTimeAsync(10);
    for (const cb of exitCallbacks) {
      cb('agent-a', 1);
    }

    const result = await runPromise;

    expect(result.status).toBe('error');
    expect(result.error).toContain('No agents became ready for the scenario');
  });

  // ── Conversations ───────────────────────────────────────────

  it('should start multiple conversations', async () => {
    const scenario: ScenarioDefinition = {
      name: 'Multi-conv',
      agents: [
        { id: 'a1', provider: 'gemini', model: 'm' },
        { id: 'a2', provider: 'claude', model: 'm' },
        { id: 'a3', provider: 'gemini', model: 'm' },
      ],
      conversations: [
        { agentIds: ['a1', 'a2'], topic: 'Topic 1', maxRepliesPerAgent: 2 },
        { agentIds: ['a2', 'a3'], topic: 'Topic 2', maxRepliesPerAgent: 3 },
      ],
    };

    const runner = new ScenarioRunner({ readinessTimeoutMs: 200 });
    const runPromise = runner.run(scenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    pushOutput('a1', makeReadyLine());
    pushOutput('a2', makeReadyLine());
    pushOutput('a3', makeReadyLine());

    const result = await runPromise;

    expect(result.status).toBe('completed');
    expect(result.conversationIds).toHaveLength(2);
  });

  // ── Teams ───────────────────────────────────────────────────

  it('should create teams and assign tasks', async () => {
    const scenario: ScenarioDefinition = {
      name: 'Team Scenario',
      agents: [
        { id: 'planner', provider: 'claude', model: 'sonnet' },
        { id: 'worker', provider: 'gemini', model: 'gemini-2.5-pro' },
      ],
      teams: [
        {
          members: [
            { agentId: 'planner', role: 'planner' },
            { agentId: 'worker', role: 'worker' },
          ],
          tasks: [{ description: 'Refactor the auth module' }],
        },
      ],
    };

    const runner = new ScenarioRunner({ readinessTimeoutMs: 200 });
    const runPromise = runner.run(scenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    pushOutput('planner', makeReadyLine());
    pushOutput('worker', makeReadyLine());

    const result = await runPromise;

    expect(result.status).toBe('completed');
    expect(result.teamIds).toHaveLength(1);
    expect(registry.getTeams()).toHaveLength(1);
  });

  it('should run a planner-planner-worker team scenario', async () => {
    const scenario: ScenarioDefinition = {
      name: 'Planner Planner Worker Scenario',
      agents: [
        { id: 'planner-a', provider: 'claude', model: 'sonnet' },
        { id: 'planner-b', provider: 'gemini', model: 'gemini-2.5-pro' },
        { id: 'worker', provider: 'codex', model: 'gpt-5-codex' },
      ],
      teams: [
        {
          members: [
            { agentId: 'planner-a', role: 'planner' },
            { agentId: 'planner-b', role: 'planner' },
            { agentId: 'worker', role: 'worker' },
          ],
          tasks: [{ description: 'Draft and execute a concrete implementation plan for team workflows.' }],
        },
      ],
    };

    const runner = new ScenarioRunner({ readinessTimeoutMs: 200 });
    const runPromise = runner.run(scenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    pushOutput('planner-a', makeReadyLine());
    pushOutput('planner-b', makeReadyLine());
    pushOutput('worker', makeReadyLine());

    const result = await runPromise;

    expect(result.status).toBe('completed');
    expect(result.teamIds).toHaveLength(1);

    const [team] = registry.getTeams();
    expect(team?.composition).toBe('planner-planner-worker');
    expect(team?.members).toEqual([
      { agentId: 'planner-a', role: 'planner' },
      { agentId: 'planner-b', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);

    expect(team?.currentTaskId).toMatch(/^task-/);
    expect(team?.status).toBe('planning');

    const sendTextCalls = vi.mocked(adapter.sendText).mock.calls;
    expect(sendTextCalls).toEqual(
      expect.arrayContaining([
        [
          'planner-a',
          expect.stringContaining('"type":"custom_event_request","event":"ack_planning_protocol"'),
        ],
        [
          'planner-b',
          expect.stringContaining('"type":"custom_event_request","event":"ack_planning_protocol"'),
        ],
      ]),
    );
    expect(sendTextCalls).not.toEqual(
      expect.arrayContaining([
        [
          'planner-a',
          expect.stringContaining('"type":"conversation_start"'),
        ],
        [
          'planner-b',
          expect.stringContaining('"type":"conversation_start"'),
        ],
      ]),
    );
  });

  // ── Result structure ────────────────────────────────────────

  it('should return scenario name in result', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    pushOutput('agent-a', makeReadyLine());

    const result = await runPromise;
    expect(result.scenarioName).toBe('Test Scenario');
  });
});
