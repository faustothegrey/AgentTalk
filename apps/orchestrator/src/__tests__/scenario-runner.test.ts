import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { ScenarioRunner } from '@agenttalk/runtime-scenarios/scenarios/scenario-runner';
import type { ScenarioDefinition } from '@agenttalk/runtime-scenarios/scenarios/types';

describe('ScenarioRunner', () => {
  let originalAttachMode: string | undefined;
  beforeEach(() => {
    originalAttachMode = process.env.AGENTTALK_ATTACH_MODE;
    process.env.AGENTTALK_ATTACH_MODE = 'true';
  });
  afterEach(() => {
    if (originalAttachMode === undefined) {
      delete process.env.AGENTTALK_ATTACH_MODE;
    } else {
      process.env.AGENTTALK_ATTACH_MODE = originalAttachMode;
    }
  });
  let registry: Registry;
  const TRANSCRIPT_DIR = './test-transcripts-scenario';
  const conversationStorePath = `${TRANSCRIPT_DIR}/conversations.json`;

  beforeEach(() => {
    registry = new Registry({
      readinessTimeoutMs: 2000,
      conversationStorePath,
    });
    vi.useFakeTimers();
    vi.spyOn(registry as any, 'requestHealthCheck').mockResolvedValue({ agentId: 'mock', message: 'ok' });
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

  const minimalScenario: ScenarioDefinition = {
    name: 'Test Scenario',
    agents: [{ id: 'agent-a', provider: 'custom', model: 'gemini-2.5-pro' }],
  };

  const twoAgentScenario: ScenarioDefinition = {
    name: 'Two Agent Chat',
    agents: [
      { id: 'agent-a', provider: 'custom', model: 'gemini-2.5-pro' },
      { id: 'agent-b', provider: 'custom', model: 'sonnet' },
    ],
    conversations: [
      {
        agentIds: ['agent-a', 'agent-b'],
        topic: 'Discuss testing.',
        maxRepliesPerAgent: 2,
      },
    ],
  };

  it('should create and start agents', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    registry.handleMcpConnect('agent-a');
    const agent = registry.getAgent('agent-a');

    const result = await runPromise;
    expect(result.status).toBe('completed');
    expect(result.agentIds).toEqual(['agent-a']);
    expect(agent.status).toBe('ready');
  });

  it('should wait for all agents to be ready before starting conversations', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 500 });
    const runPromise = runner.run(twoAgentScenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    registry.handleMcpConnect('agent-a');

    expect(registry.getConversations()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(10);
    registry.handleMcpConnect('agent-b');

    const result = await runPromise;
    expect(result.status).toBe('completed');
    expect(result.conversationIds).toHaveLength(1);
    expect(registry.getConversations()).toHaveLength(1);
  });

  it('should fail with timeout when an agent never becomes ready', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    await vi.advanceTimersByTimeAsync(200);
    const result = await runPromise;
    expect(result.status).toBe('error');
    expect(result.error).toContain('No agents became ready');
  });

  it('should return scenario name in result', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    registry.handleMcpConnect('agent-a');

    const result = await runPromise;
    expect(result.scenarioName).toBe('Test Scenario');
  });
});
