import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { ProcessAdapter } from '../process-adapter.js';
import { existsSync, rmSync } from 'fs';
import { deriveConversationStatus } from '../conversation-status.js';

describe('Registry', () => {
  let adapter: ProcessAdapter;
  let registry: Registry;
  let dataCallbacks: Map<string, (chunk: string) => void>;
  let exitCallbacks: ((id: string, code: number | null) => void)[];
  const TRANSCRIPT_DIR = './test-transcripts';
  const conversationStorePath = `${TRANSCRIPT_DIR}/conversations.json`;

  beforeEach(() => {
    dataCallbacks = new Map();
    exitCallbacks = [];

    adapter = {
      spawn: vi.fn(),
      sendText: vi.fn().mockImplementation((id: string, text: string) => {
        // Simulate echo: text sent to stdin appears back in stdout
        const cb = dataCallbacks.get(id);
        if (cb) cb(text);
      }),
      readOutput: vi.fn().mockReturnValue(''),
      onData: vi.fn().mockImplementation((id: string, cb: (chunk: string) => void) => {
        dataCallbacks.set(id, cb);
      }),
      kill: vi.fn(),
      onExit: vi.fn().mockImplementation((cb) => {
        exitCallbacks.push(cb);
      }),
    };

    registry = new Registry(adapter, {
      readinessTimeoutMs: 500,
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

  /** Helper: push output to an agent's data callback (simulates process stdout) */
  function pushOutput(id: string, text: string) {
    const cb = dataCallbacks.get(id);
    if (cb) cb(text);
  }

  it('should create an agent', async () => {
    const agent = await registry.createAgent('agent-1');
    expect(agent.id).toBe('agent-1');
    expect(agent.status).toBe('creating');
  });

  it('should start an agent and transition to starting', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'echo hello');

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('starting');
    expect(adapter.spawn).toHaveBeenCalledWith('agent-1', 'echo hello');
  });

  it('should extract provider from launch command', async () => {
    const providerSpy = vi.fn();
    registry.on('provider', providerSpy);

    const agent = await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'node scripts/llm-agent.mjs gemini');

    expect(agent.provider).toBe('gemini');
    expect(providerSpy).toHaveBeenCalledWith({ id: 'agent-1', provider: 'gemini' });
  });

  it('should transition to ready when READY protocol line is received', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    pushOutput('agent-1', 'Starting...\n[AgentTalk]:READY:{"session":"123"}\n');

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should remove an agent and kill its process', async () => {
    const agent = await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    expect(agent.status).toBe('starting');

    await registry.removeAgent('agent-1');

    expect(agent.status).toBe('terminated');
    expect(() => registry.getAgent('agent-1')).toThrow('Agent agent-1 not found');
    expect(adapter.kill).toHaveBeenCalledWith('agent-1');
  });

  it('should handle usage_updated events', async () => {
    const usageSpy = vi.fn();
    registry.on('usage', usageSpy);

    const agent = await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    pushOutput('agent-1', '[AgentTalk]:EVT:{"type":"usage_updated","total":500,"limit":200000}\n');

    expect(agent.usage).toEqual({ total: 500, limit: 200000 });
    expect(usageSpy).toHaveBeenCalledWith({ id: 'agent-1', usage: { total: 500, limit: 200000 } });
  });

  it('should transition to ready when READY arrives across multiple chunks', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'echo "E2E Test Started"');

    pushOutput('agent-1', 'echo "E2E Test Started"\n[AgentTalk]:READY:{"sess');
    pushOutput('agent-1', 'ion":"123"}\n');

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should handle REQ and send RES', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    // Get to ready first
    pushOutput('agent-1', '[AgentTalk]:READY:{"session":"s1"}\n');
    expect(registry.getAgent('agent-1').status).toBe('ready');
    vi.mocked(adapter.sendText).mockClear();

    // REQ
    pushOutput('agent-1', '[AgentTalk]:REQ:{"id":"q1","call":"list_agents","args":{}}\n');

    expect(adapter.sendText).toHaveBeenCalledWith(
      'agent-1',
      expect.stringContaining('[AgentTalk]:RES:{"id":"q1","status":"success"'),
    );
  });

  it('should ignore duplicate READY packets for an already ready agent', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    pushOutput('agent-1', '[AgentTalk]:READY:{"session":"s1"}\n');

    const warn = vi.spyOn(console, 'warn');
    pushOutput('agent-1', '[AgentTalk]:READY:{"session":"s1"}\n');

    expect(registry.getAgent('agent-1').status).toBe('ready');
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Malformed protocol payload'),
      expect.anything(),
    );
  });

  it('should transition to error on readiness timeout', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    await vi.advanceTimersByTimeAsync(600);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('error');
  });

  it('should reject duplicate agent IDs', async () => {
    await registry.createAgent('agent-1');
    await expect(registry.createAgent('agent-1')).rejects.toThrow('Agent agent-1 already exists');
  });

  it('should throw when getting a nonexistent agent', () => {
    expect(() => registry.getAgent('nope')).toThrow('Agent nope not found');
  });

  it('should restart an agent from error state', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    // Force into error via readiness timeout
    await vi.advanceTimersByTimeAsync(600);
    expect(registry.getAgent('agent-1').status).toBe('error');

    // Restart — error -> starting is a valid transition
    await registry.startAgent('agent-1', 'agent-cli --retry');
    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('starting');
    expect(agent.launchCommand).toBe('agent-cli --retry');
  });

  it('should handle malformed JSON in protocol lines', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    const warn = vi.spyOn(console, 'warn');

    pushOutput('agent-1', '[AgentTalk]:READY:{bad json}\n');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed protocol payload'),
      expect.anything(),
    );
    // Agent stays in starting — malformed READY doesn't transition
    expect(registry.getAgent('agent-1').status).toBe('starting');
  });

  it('should record launchCommand on start', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'node scripts/llm-agent.mjs claude');
    expect(registry.getAgent('agent-1').launchCommand).toBe('node scripts/llm-agent.mjs claude');
  });

  it('should update lastProgressAt on new output', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');
    const agent = registry.getAgent('agent-1');

    expect(agent.lastProgressAt).toBeUndefined();

    pushOutput('agent-1', 'hello\n');

    expect(agent.lastProgressAt).toBeTypeOf('number');
  });

  it('should derive completed status when all agents reached the reply cap', () => {
    expect(deriveConversationStatus({
      id: 'conversation-1',
      agentIds: ['agent-1', 'agent-2'],
      topic: 'test',
      maxRepliesPerAgent: 2,
      replyCounts: {
        'agent-1': 2,
        'agent-2': 2,
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      transcript: [],
    })).toBe('completed');
  });

  it('should expose derived conversation status in getConversations', () => {
    (registry as any).conversations.set('conversation-1', {
      id: 'conversation-1',
      agentIds: ['agent-1', 'agent-2'],
      topic: 'test',
      maxRepliesPerAgent: 1,
      replyCounts: {
        'agent-1': 1,
        'agent-2': 1,
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      transcript: [],
    });

    expect(registry.getConversations()).toEqual([
      expect.objectContaining({
        id: 'conversation-1',
        status: 'completed',
      }),
    ]);
  });

  it('should ignore derived-completed conversations when finding active conversations by agents', () => {
    (registry as any).conversations.set('conversation-1', {
      id: 'conversation-1',
      agentIds: ['agent-1', 'agent-2'],
      topic: 'test',
      maxRepliesPerAgent: 1,
      replyCounts: {
        'agent-1': 1,
        'agent-2': 1,
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      transcript: [],
    });

    expect((registry as any).findActiveConversationByAgents(['agent-1', 'agent-2'])).toBeUndefined();
  });
});
