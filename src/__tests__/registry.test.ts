import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { ProcessAdapter } from '../process-adapter.js';
import { existsSync, rmSync } from 'fs';

describe('Registry', () => {
  let adapter: ProcessAdapter;
  let registry: Registry;
  let outputBuffers: Map<string, string>;
  let exitCallbacks: ((id: string, code: number | null) => void)[];
  const TRANSCRIPT_DIR = './test-transcripts';

  beforeEach(() => {
    outputBuffers = new Map();
    exitCallbacks = [];

    adapter = {
      spawn: vi.fn().mockImplementation((id: string) => {
        outputBuffers.set(id, '');
      }),
      sendText: vi.fn().mockImplementation((id: string, text: string) => {
        // Simulate echo: text sent to stdin appears in stdout buffer
        const current = outputBuffers.get(id) ?? '';
        outputBuffers.set(id, current + text);
      }),
      readOutput: vi.fn().mockImplementation((id: string) => {
        return outputBuffers.get(id) ?? '';
      }),
      kill: vi.fn(),
      onExit: vi.fn().mockImplementation((cb) => {
        exitCallbacks.push(cb);
      }),
    };

    registry = new Registry(adapter, {
      pollIntervalMs: 100,
      readinessTimeoutMs: 500,
      maxConsecutiveFailures: 2,
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

  /** Helper: set the output buffer for an agent (simulates process stdout) */
  function setOutput(id: string, text: string) {
    outputBuffers.set(id, text);
  }

  /** Helper: append to the output buffer (simulates new stdout data) */
  function appendOutput(id: string, text: string) {
    const current = outputBuffers.get(id) ?? '';
    outputBuffers.set(id, current + text);
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

    // Simulate agent outputting READY
    appendOutput('agent-1', 'Starting...\n[NodePTY]:READY:{"session":"123"}\n');

    await vi.advanceTimersByTimeAsync(100);

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

    appendOutput('agent-1', '[NodePTY]:EVT:{"type":"usage_updated","total":500,"limit":200000}\n');

    await vi.advanceTimersByTimeAsync(100);

    expect(agent.usage).toEqual({ total: 500, limit: 200000 });
    expect(usageSpy).toHaveBeenCalledWith({ id: 'agent-1', usage: { total: 500, limit: 200000 } });
  });

  it('should transition to ready when READY is the last line without trailing newline', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'echo "E2E Test Started"');

    appendOutput('agent-1', 'echo "E2E Test Started"\n[NodePTY]:READY:{"session":"123"}');

    await vi.advanceTimersByTimeAsync(100);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should handle REQ as last line without trailing newline', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    // Get to ready first
    appendOutput('agent-1', '[NodePTY]:READY:{"session":"s1"}\n');
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('ready');
    vi.mocked(adapter.sendText).mockClear();

    // REQ without trailing newline
    appendOutput('agent-1', '[NodePTY]:REQ:{"id":"q1","call":"list_agents","args":{}}\n');
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'agent-1',
      expect.stringContaining('[NodePTY]:RES:{"id":"q1","status":"success"'),
    );
  });

  it('should ignore duplicate READY packets for an already ready agent', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    appendOutput('agent-1', '[NodePTY]:READY:{"session":"s1"}\n');
    await vi.advanceTimersByTimeAsync(100);

    const warn = vi.spyOn(console, 'warn');
    appendOutput('agent-1', '[NodePTY]:READY:{"session":"s1"}\n');
    await vi.advanceTimersByTimeAsync(100);

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

  it('should handle poll failures and transition to error after max failures', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readOutput).mockImplementation(() => { throw new Error('Poll failed'); });

    // First failure
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');

    // Second failure (maxConsecutiveFailures: 2)
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('error');
  });

  it('should correctly deduplicate output', async () => {
    await registry.createAgent('agent-1');
    const agent = registry.getAgent('agent-1');

    // First poll — everything is new
    setOutput('agent-1', 'Line 1\n');
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\n');

    // Second poll — only "Line 2\n" is new
    setOutput('agent-1', 'Line 1\nLine 2\n');
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\nLine 2\n');
  });

  it('should skip processing on output divergence', async () => {
    await registry.createAgent('agent-1');
    const agent = registry.getAgent('agent-1');

    // First poll seeds the cursor
    setOutput('agent-1', 'Line 1\nLine 2\n');
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\nLine 2\n');

    // Output diverged (e.g. process restarted into same slot — unlikely but handled)
    setOutput('agent-1', 'New content\n');
    await (registry as any).pollAgent('agent-1');

    // Cursor resets but no text processed (skipped this poll)
    expect(agent.lastSeenText).toBe('New content\n');
  });

  it('should recover protocol lines from a divergent snapshot', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    appendOutput('agent-1', '[NodePTY]:READY:{"session":"s1"}\n');
    await vi.advanceTimersByTimeAsync(100);

    vi.mocked(adapter.sendText).mockClear();

    // Force a divergence by replacing buffer entirely
    setOutput('agent-1',
      'output redraw...\n' +
      '[NodePTY]:READY:{"session":"s1"}\n' +
      '[NodePTY]:REQ:{"id":"q-diverge","call":"list_agents","args":{}}\n',
    );
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'agent-1',
      expect.stringContaining('[NodePTY]:RES:{"id":"q-diverge","status":"success"'),
    );
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
    expect(agent.lastSeenText).toBe('');
    expect(agent.lineBuffer).toBe('');
  });

  it('should reset consecutive failures on a successful poll', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    // One failure
    vi.mocked(adapter.readOutput).mockImplementationOnce(() => { throw new Error('fail'); });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');

    // Success resets counter (restore normal mock)
    vi.mocked(adapter.readOutput).mockImplementation((id: string) => outputBuffers.get(id) ?? '');
    appendOutput('agent-1', 'ok\n');
    await vi.advanceTimersByTimeAsync(100);

    // Another failure — counter should be back at 1, not 2
    vi.mocked(adapter.readOutput).mockImplementationOnce(() => { throw new Error('fail'); });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');
  });

  it('should handle malformed JSON in protocol lines', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');

    const warn = vi.spyOn(console, 'warn');

    appendOutput('agent-1', '[NodePTY]:READY:{bad json}\n');
    await vi.advanceTimersByTimeAsync(100);

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

  it('should update lastPollAt and lastProgressAt timestamps', async () => {
    await registry.createAgent('agent-1');
    await registry.startAgent('agent-1', 'agent-cli');
    const agent = registry.getAgent('agent-1');

    expect(agent.lastPollAt).toBeUndefined();
    expect(agent.lastProgressAt).toBeUndefined();

    // Poll with new content
    appendOutput('agent-1', 'hello\n');
    await vi.advanceTimersByTimeAsync(100);

    expect(agent.lastPollAt).toBeTypeOf('number');
    expect(agent.lastProgressAt).toBeTypeOf('number');
  });
});
