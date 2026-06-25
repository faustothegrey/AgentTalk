import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'fs';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { ScenarioRunner } from '@agenttalk/runtime-scenarios/scenarios/scenario-runner';
import type { ScenarioDefinition } from '@agenttalk/runtime-scenarios/scenarios/types';

vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

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
    try {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    await registry.destroy();
    vi.restoreAllMocks();
    try {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    } catch {}
  });

  const minimalScenario: ScenarioDefinition = {
    name: 'Test Scenario',
    agents: [{ id: 'agent-a', provider: 'gemini', model: 'gemini-2.5-pro' }],
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

  it('should create and start agents instantly (driver providers)', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    const result = await runPromise;
    expect(result.status).toBe('completed');
    expect(result.agentIds).toEqual(['agent-a']);
    
    const agent = registry.getAgent('agent-a');
    expect(agent.status).toBe('ready');
  });

  it('should not wait for driver agents to be ready before starting conversations', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 500 });
    const runPromise = runner.run(twoAgentScenario, registry);

    const result = await runPromise;
    expect(result.status).toBe('completed');
    expect(result.conversationIds).toHaveLength(1);
    expect(registry.getConversations()).toHaveLength(1);
  });

  const attachScenario: ScenarioDefinition = {
    name: 'Attach Scenario',
    agents: [{ id: 'agent-ext', provider: 'unknown-attach', model: 'test' }],
  };

  it('should fail with timeout when an attach agent never becomes ready', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(attachScenario, registry);

    await vi.advanceTimersByTimeAsync(200);
    const result = await runPromise;
    expect(result.status).toBe('error');
    expect(result.error).toContain('No agents became ready');
  });

  it('should wait for attach agents to be ready', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 500 });
    const runPromise = runner.run(attachScenario, registry);

    await vi.advanceTimersByTimeAsync(10);
    registry.handleMcpConnect('agent-ext');

    const result = await runPromise;
    expect(result.status).toBe('completed');
    expect(result.agentIds).toEqual(['agent-ext']);
  });



  it('should return scenario name in result', async () => {
    const runner = new ScenarioRunner({ readinessTimeoutMs: 100 });
    const runPromise = runner.run(minimalScenario, registry);

    const result = await runPromise;
    expect(result.scenarioName).toBe('Test Scenario');
  });
});
