import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { CmuxAdapter } from '../cmux-adapter.js';
import { existsSync, rmSync } from 'fs';

describe('Registry', () => {
  let adapter: CmuxAdapter;
  let registry: Registry;
  const TRANSCRIPT_DIR = './test-transcripts';

  beforeEach(() => {
    let nextRef = 1;
    adapter = {
      createPane: vi.fn().mockImplementation(async () => {
        const ref = nextRef++;
        return {
          workspaceRef: `workspace:${ref}`,
          paneRef: `pane:${ref}`,
          surfaceRef: `surface:${ref}`,
        };
      }),
      sendText: vi.fn().mockResolvedValue(undefined),
      readSurface: vi.fn().mockResolvedValue({ text: '', raw: '' }),
      notify: vi.fn().mockResolvedValue(undefined),
      closeSurface: vi.fn().mockResolvedValue(undefined),
    };

    registry = new Registry(adapter, {
      pollIntervalMs: 100,
      readinessTimeoutMs: 500,
      maxConsecutiveFailures: 2,
    });

    vi.useFakeTimers();
    
    // Clean up test transcripts
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

  it('should create an agent', async () => {
    const agent = await registry.createAgent('agent-1', 'right');
    expect(agent.id).toBe('agent-1');
    expect(agent.status).toBe('creating');
    expect(adapter.createPane).toHaveBeenCalledWith('right');
  });

  it('should start an agent and transition to starting', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'ls');
    
    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('starting');
    expect(adapter.sendText).toHaveBeenCalledWith('surface:1', 'ls\n');
  });

  it('should transition to ready when READY protocol line is received', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // Simulate polling and receiving the READY line
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: 'Starting...\n[NodePTY]:READY:{"session":"123"}\n',
      raw: 'Starting...\n[NodePTY]:READY:{"session":"123"}\n'
    });

    await vi.advanceTimersByTimeAsync(100);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should remove an agent and close its surface', async () => {
    adapter.closeSurface = vi.fn().mockResolvedValue(undefined);
    const agent = await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');
    
    // Status should be starting and poll should be in flight
    expect(agent.status).toBe('starting');

    await registry.removeAgent('agent-1');

    expect(agent.status).toBe('terminated');
    expect(() => registry.getAgent('agent-1')).toThrow('Agent agent-1 not found');
    expect(adapter.closeSurface).toHaveBeenCalledWith('surface:1');
  });

  it('should handle usage_updated events', async () => {
    const usageSpy = vi.fn();
    registry.on('usage', usageSpy);

    const agent = await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:EVT:{"type":"usage_updated","total":500,"limit":200000}\n',
      raw: '[NodePTY]:EVT:{"type":"usage_updated","total":500,"limit":200000}\n',
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(agent.usage).toEqual({ total: 500, limit: 200000 });
    expect(usageSpy).toHaveBeenCalledWith({ id: 'agent-1', usage: { total: 500, limit: 200000 } });
  });

  it('should transition to ready when READY is the last line without trailing newline', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'echo "E2E Test Started"');

    // Surface returns READY as the last line with no trailing \n — this is
    // what actually happens when reading a cmux surface.
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: 'echo "E2E Test Started"\n[NodePTY]:READY:{"session":"123"}',
      raw: 'echo "E2E Test Started"\n[NodePTY]:READY:{"session":"123"}',
    });

    await vi.advanceTimersByTimeAsync(100);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should handle REQ as last line without trailing newline', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // Get to ready first
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('ready');
    vi.mocked(adapter.sendText).mockClear();

    // REQ without trailing newline
    const text = '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"q1","call":"list_agents","args":{}}';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('[NodePTY]:RES:{"id":"q1","status":"success"'),
    );
  });

  it('should ignore duplicate READY packets for an already ready agent', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    const warn = vi.spyOn(console, 'warn');
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(registry.getAgent('agent-1').status).toBe('ready');
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Malformed protocol payload'),
      expect.anything(),
    );
  });

  it('should transition to error on readiness timeout', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    await vi.advanceTimersByTimeAsync(600);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('error');
    expect(adapter.notify).toHaveBeenCalledWith(
      'Readiness Timeout',
      expect.stringContaining('failed to signal READY'),
      'surface:1'
    );
  });

  it('should handle poll failures and transition to error after max failures', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockRejectedValue(new Error('Poll failed'));

    // First failure
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');

    // Second failure (maxConsecutiveFailures: 2)
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('error');
  });

  it('should correctly deduplicate terminal output', async () => {
    await registry.createAgent('agent-1', 'right');
    const agent = registry.getAgent('agent-1');
    
    // First poll — everything is new
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'Line 1\n', raw: 'Line 1\n' });
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\n');

    // Second poll — only "Line 2\n" is new
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'Line 1\nLine 2\n', raw: 'Line 1\nLine 2\n' });
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\nLine 2\n');
  });

  it('should skip processing on terminal wrap/clear', async () => {
    await registry.createAgent('agent-1', 'right');
    const agent = registry.getAgent('agent-1');

    // First poll seeds the cursor
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'Line 1\nLine 2\n', raw: 'Line 1\nLine 2\n' });
    await (registry as any).pollAgent('agent-1');
    expect(agent.lastSeenText).toBe('Line 1\nLine 2\n');

    // Terminal cleared — text no longer starts with old text
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'New content\n', raw: 'New content\n' });
    await (registry as any).pollAgent('agent-1');

    // Cursor resets but no text processed (skipped this poll)
    expect(agent.lastSeenText).toBe('New content\n');
  });

  it('should recover protocol lines from a divergent snapshot', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    vi.mocked(adapter.sendText).mockClear();

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text:
        'terminal redraw...\n' +
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:REQ:{"id":"q-diverge","call":"list_agents","args":{}}\n',
      raw:
        'terminal redraw...\n' +
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:REQ:{"id":"q-diverge","call":"list_agents","args":{}}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('[NodePTY]:RES:{"id":"q-diverge","status":"success"'),
    );
  });

  it('should reject duplicate agent IDs', async () => {
    await registry.createAgent('agent-1', 'right');
    await expect(registry.createAgent('agent-1', 'down')).rejects.toThrow('Agent agent-1 already exists');
  });

  it('should throw when getting a nonexistent agent', () => {
    expect(() => registry.getAgent('nope')).toThrow('Agent nope not found');
  });

  it('should restart an agent from error state', async () => {
    await registry.createAgent('agent-1', 'right');
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
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // One failure
    vi.mocked(adapter.readSurface).mockRejectedValueOnce(new Error('fail'));
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');

    // Success resets counter
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'ok\n', raw: 'ok\n' });
    await vi.advanceTimersByTimeAsync(100);

    // Another failure — counter should be back at 1, not 2
    vi.mocked(adapter.readSurface).mockRejectedValueOnce(new Error('fail'));
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('starting');
  });

  it('should handle malformed JSON in protocol lines', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    const warn = vi.spyOn(console, 'warn');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{bad json}\n',
      raw: '[NodePTY]:READY:{bad json}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Malformed protocol payload'),
      expect.anything(),
    );
    // Agent stays in starting — malformed READY doesn't transition
    expect(registry.getAgent('agent-1').status).toBe('starting');
  });

  it('should record launchCommand on start', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'zsh -lc "agent-cli --nodepty-v1"');
    expect(registry.getAgent('agent-1').launchCommand).toBe('zsh -lc "agent-cli --nodepty-v1"');
  });

  it('should update lastPollAt and lastProgressAt timestamps', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');
    const agent = registry.getAgent('agent-1');

    expect(agent.lastPollAt).toBeUndefined();
    expect(agent.lastProgressAt).toBeUndefined();

    // Poll with new content
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'hello\n', raw: 'hello\n' });
    await vi.advanceTimersByTimeAsync(100);

    expect(agent.lastPollAt).toBeTypeOf('number');
    expect(agent.lastProgressAt).toBeTypeOf('number');

    const prevProgress = agent.lastProgressAt;

    // Poll with no new content
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'hello\n', raw: 'hello\n' });
    await vi.advanceTimersByTimeAsync(100);

    // lastPollAt updated, lastProgressAt unchanged
    expect(agent.lastProgressAt).toBe(prevProgress);
  });

  it('should stop polling on error', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockRejectedValue(new Error('fail'));

    // Exhaust max failures
    await vi.advanceTimersByTimeAsync(200);
    expect(registry.getAgent('agent-1').status).toBe('error');

    // Reset mock to track further calls
    vi.mocked(adapter.readSurface).mockClear();
    await vi.advanceTimersByTimeAsync(500);

    // No more polls after error
    expect(adapter.readSurface).not.toHaveBeenCalled();
  });

  it('should clear readiness timeout when READY is received', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // READY before timeout
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('ready');

    // Advance past the readiness timeout — should NOT transition to error
    await vi.advanceTimersByTimeAsync(600);
    expect(registry.getAgent('agent-1').status).toBe('ready');
    expect(adapter.notify).not.toHaveBeenCalled();
  });

  it('should not overlap polls when a read is still in flight', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    let resolveRead!: (value: { text: string; raw: string }) => void;
    const pendingRead = new Promise<{ text: string; raw: string }>((resolve) => {
      resolveRead = resolve;
    });

    vi.mocked(adapter.readSurface).mockReturnValueOnce(pendingRead);

    await vi.advanceTimersByTimeAsync(300);
    expect(adapter.readSurface).toHaveBeenCalledTimes(1);

    resolveRead({ text: 'done\n', raw: 'done\n' });
    await Promise.resolve();

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: 'done\nnext\n', raw: 'done\nnext\n' });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.readSurface).toHaveBeenCalledTimes(2);
  });

  it('should strip ANSI codes from terminal output before parsing', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // Simulate terminal with ANSI colors
    const ansiReady = '\x1b[32m[NodePTY]:READY:{"session":"ansi"}\x1b[0m\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: ansiReady,
      raw: ansiReady
    });

    await vi.advanceTimersByTimeAsync(100);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
  });

  it('should format and send protocol packets correctly via sendProtocol', async () => {
    await registry.createAgent('agent-1', 'right');
    
    const payload = { result: 'ok' };
    await registry.sendProtocol('agent-1', 'RES', payload);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      '[NodePTY]:RES:{"result":"ok"}\n'
    );
  });

  it('should handle list_agents and send_to_agent requests', async () => {
    // Setup two agents
    const a1 = await registry.createAgent('agent-1', 'right');
    const a2 = await registry.createAgent('agent-2', 'down');
    
    await registry.startAgent('agent-1', 'cmd1');
    await registry.startAgent('agent-2', 'cmd2');
    
    // Simulate READY for both
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: '[NodePTY]:READY:{"s":"1"}\n', raw: '' });
    await (registry as any).pollAgent('agent-1');
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: '[NodePTY]:READY:{"s":"2"}\n', raw: '' });
    await (registry as any).pollAgent('agent-2');

    expect(a1.status).toBe('ready');
    expect(a2.status).toBe('ready');
    
    // Clear startAgent command calls
    vi.mocked(adapter.sendText).mockClear();

    // 1. Test list_agents from agent-1
    const listReq = '[NodePTY]:REQ:{"id":"q1","call":"list_agents"}\n';
    // Current text must be READY + listReq to show listReq as the new suffix
    const currentText = '[NodePTY]:READY:{"s":"1"}\n' + listReq;
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: currentText, raw: currentText });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      expect.stringContaining('[NodePTY]:RES:{"id":"q1","status":"success","data":{"agents":[')
    );
    
    vi.mocked(adapter.sendText).mockClear();

    // 2. Test send_to_agent from agent-1 to agent-2
    const sendReq = '[NodePTY]:REQ:{"id":"q2","call":"send_to_agent","args":{"to":"agent-2","payload":"hi"}}\n';
    const finalText = currentText + sendReq;
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text: finalText, raw: finalText });
    await (registry as any).pollAgent('agent-1');

    // Verify EVT sent to target agent-2
    expect(adapter.sendText).toHaveBeenCalledWith(
      a2.surface.surfaceRef,
      '[NodePTY]:EVT:{"type":"message_received","from":"agent-1","payload":"hi"}\n'
    );

    // Verify RES sent back to requester agent-1
    expect(adapter.sendText).toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"q2","status":"success"}\n'
    );
  });

  it('should send EVT packets via sendProtocol', async () => {
    await registry.createAgent('agent-1', 'right');

    await registry.sendProtocol('agent-1', 'EVT', {
      type: 'message_received',
      from: 'agent-2',
      payload: 'hello',
    });

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      '[NodePTY]:EVT:{"type":"message_received","from":"agent-2","payload":"hello"}\n'
    );
  });

  it('should suppress echoed outbound protocol lines from agent output processing', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    vi.mocked(adapter.sendText).mockClear();
    await registry.sendProtocol('agent-1', 'EVT', {
      type: 'message_received',
      from: 'user',
      payload: 'hello',
    });

    const outputListener = vi.fn();
    registry.on('output', outputListener);

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"message_received","from":"user","payload":"hello"}\n' +
        '[llm-agent] Message from user: hello\n',
      raw:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"message_received","from":"user","payload":"hello"}\n' +
        '[llm-agent] Message from user: hello\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(outputListener).toHaveBeenCalledWith({
      id: 'agent-1',
      text: '[llm-agent] Message from user: hello\r\n',
    });
  });

  it('should transition busy state from agent EVT packets', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('ready');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":true}\n',
      raw:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":true}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('busy');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":true}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":false}\n',
      raw:
        '[NodePTY]:READY:{"session":"s1"}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":true}\n' +
        '[NodePTY]:EVT:{"type":"busy_state","busy":false}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(registry.getAgent('agent-1').status).toBe('ready');
  });

  it('should throw when sending protocol to nonexistent agent', async () => {
    await expect(registry.sendProtocol('nope', 'RES', {})).rejects.toThrow('Agent nope not found');
  });

  it('should write raw text to transcript and strip ANSI only for parsing', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');
    const agent = registry.getAgent('agent-1');

    const ansiText = '\x1b[1mhello\x1b[0m\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: ansiText,
      raw: ansiText,
    });

    await vi.advanceTimersByTimeAsync(100);

    // Transcript gets raw ANSI
    expect(agent.lastSeenText).toBe(ansiText);
  });

  it('should process multiple protocol lines in a single poll', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    const log = vi.spyOn(console, 'log');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"r1","call":"list_agents","args":{}}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"r1","call":"list_agents","args":{}}\n',
    });

    await vi.advanceTimersByTimeAsync(100);

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');

    // Both protocol lines were processed
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('READY'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('REQ from agent-1:'),
      expect.objectContaining({ id: 'r1', call: 'list_agents' }),
    );
  });

  it('should resume polling after an in-flight failure', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // First poll fails (still in-flight while rejecting)
    vi.mocked(adapter.readSurface).mockRejectedValueOnce(new Error('timeout'));
    await vi.advanceTimersByTimeAsync(100);

    // pollsInFlight should be cleared — next poll should proceed
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(registry.getAgent('agent-1').status).toBe('ready');
  });

  it('should ignore non-protocol lines in terminal output', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    const log = vi.spyOn(console, 'log');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: 'some regular output\nmore output\n[NodePTY]:READY:{"session":"s1"}\neven more output\n',
      raw: 'some regular output\nmore output\n[NodePTY]:READY:{"session":"s1"}\neven more output\n',
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(registry.getAgent('agent-1').status).toBe('ready');
    // Only the protocol line should trigger handleProtocolLine
    const protocolCalls = log.mock.calls.filter(c =>
      typeof c[0] === 'string' && c[0].includes('Protocol line')
    );
    expect(protocolCalls).toHaveLength(1);
  });

  it('should return error RES for unknown tool calls', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    // Get to ready
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    vi.mocked(adapter.sendText).mockClear();

    // Send unknown tool call
    const text = '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"u1","call":"nonexistent_tool","args":{}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('"error":"Unknown tool call: nonexistent_tool"'),
    );
  });

  it('should reject send_to_agent with missing args', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    vi.mocked(adapter.sendText).mockClear();

    // send_to_agent without "to"
    const text = '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"b1","call":"send_to_agent","args":{"payload":"hi"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('Missing'),
    );
  });

  it('should allow send_to_agent with an empty string payload', async () => {
    const agent1 = await registry.createAgent('agent-1', 'right');
    const agent2 = await registry.createAgent('agent-2', 'down');
    agent1.setStatus('starting');
    agent1.setStatus('ready');
    agent2.setStatus('starting');
    agent2.setStatus('ready');

    vi.mocked(adapter.sendText).mockClear();

    const text =
      '[NodePTY]:READY:{"session":"s1"}\n' +
      '[NodePTY]:REQ:{"id":"e1","call":"send_to_agent","args":{"to":"agent-2","payload":""}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      agent1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"e1","status":"success"}\n',
    );
    expect(adapter.sendText).toHaveBeenCalledWith(
      agent2.surface.surfaceRef,
      '[NodePTY]:EVT:{"type":"message_received","from":"agent-1","payload":""}\n',
    );
  });

  it('should allow send_to_agent with a numeric zero payload', async () => {
    const agent1 = await registry.createAgent('agent-1', 'right');
    const agent2 = await registry.createAgent('agent-2', 'down');
    agent1.setStatus('starting');
    agent1.setStatus('ready');
    agent2.setStatus('starting');
    agent2.setStatus('ready');

    vi.mocked(adapter.sendText).mockClear();

    const text =
      '[NodePTY]:READY:{"session":"s1"}\n' +
      '[NodePTY]:REQ:{"id":"e2","call":"send_to_agent","args":{"to":"agent-2","payload":0}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      agent1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"e2","status":"success"}\n',
    );
    expect(adapter.sendText).toHaveBeenCalledWith(
      agent2.surface.surfaceRef,
      '[NodePTY]:EVT:{"type":"message_received","from":"agent-1","payload":0}\n',
    );
  });

  it('should reject send_to_agent targeting a non-ready agent', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.createAgent('agent-2', 'down');

    // Only start and ready agent-1
    await registry.startAgent('agent-1', 'cmd1');
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    vi.mocked(adapter.sendText).mockClear();

    // agent-2 is still in 'creating' state — send should be rejected
    const text = '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"x1","call":"send_to_agent","args":{"to":"agent-2","payload":"hi"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('is in creating state'),
    );
  });

  it('should reject send_to_agent targeting an unknown agent', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'cmd1');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await vi.advanceTimersByTimeAsync(100);
    vi.mocked(adapter.sendText).mockClear();

    const text = '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"id":"x2","call":"send_to_agent","args":{"to":"ghost","payload":"hi"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await vi.advanceTimersByTimeAsync(100);

    expect(adapter.sendText).toHaveBeenCalledWith(
      'surface:1',
      expect.stringContaining('not found'),
    );
  });

  it('should reject REQ with missing id or call fields', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.startAgent('agent-1', 'agent-cli');

    const warn = vi.spyOn(console, 'warn');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"args":{}}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n[NodePTY]:REQ:{"args":{}}\n',
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid REQ'),
    );
  });

  it('should transition to error if sendText fails during startAgent', async () => {
    await registry.createAgent('agent-1', 'right');

    vi.mocked(adapter.sendText).mockRejectedValueOnce(new Error('send failed'));

    await expect(registry.startAgent('agent-1', 'cmd')).rejects.toThrow('send failed');
    expect(registry.getAgent('agent-1').status).toBe('error');
  });

  it('should warn on READY received in unexpected state', async () => {
    await registry.createAgent('agent-1', 'right');
    const agent = registry.getAgent('agent-1');
    // Agent stays in 'creating' — not started

    const warn = vi.spyOn(console, 'warn');

    vi.mocked(adapter.readSurface).mockResolvedValueOnce({
      text: '[NodePTY]:READY:{"session":"s1"}\n',
      raw: '[NodePTY]:READY:{"session":"s1"}\n',
    });
    await (registry as any).pollAgent('agent-1');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected READY'),
    );
    expect(agent.status).toBe('creating');
  });

  it('should allow send_to_agent to a busy target', async () => {
    const a1 = await registry.createAgent('agent-1', 'right');
    const a2 = await registry.createAgent('agent-2', 'down');
    a1.setStatus('starting');
    a1.setStatus('ready');
    a2.setStatus('starting');
    a2.setStatus('ready');
    a2.setStatus('busy');

    vi.mocked(adapter.sendText).mockClear();

    const text =
      '[NodePTY]:READY:{"session":"s1"}\n' +
      '[NodePTY]:REQ:{"id":"b1","call":"send_to_agent","args":{"to":"agent-2","payload":"urgent"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      a2.surface.surfaceRef,
      '[NodePTY]:EVT:{"type":"message_received","from":"agent-1","payload":"urgent"}\n',
    );
    expect(adapter.sendText).toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"b1","status":"success"}\n',
    );
  });

  it('should return an error response if delivery to the target agent fails', async () => {
    const a1 = await registry.createAgent('agent-1', 'right');
    const a2 = await registry.createAgent('agent-2', 'down');
    a1.setStatus('starting');
    a1.setStatus('ready');
    a2.setStatus('starting');
    a2.setStatus('ready');

    vi.mocked(adapter.sendText).mockImplementation(async (surfaceRef) => {
      if (surfaceRef === a2.surface.surfaceRef) {
        throw new Error('target delivery failed');
      }
    });

    const text =
      '[NodePTY]:REQ:{"id":"d1","call":"send_to_agent","args":{"to":"agent-2","payload":"hi"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"d1","status":"error","error":"target delivery failed"}\n',
    );
    expect(adapter.sendText).not.toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      '[NodePTY]:RES:{"id":"d1","status":"success"}\n',
    );
  });

  it('should list agents with correct surface refs from multi-agent setup', async () => {
    await registry.createAgent('agent-1', 'right');
    await registry.createAgent('agent-2', 'down');
    const a1 = registry.getAgent('agent-1');
    a1.setStatus('starting');
    a1.setStatus('ready');

    vi.mocked(adapter.sendText).mockClear();

    const text = '[NodePTY]:REQ:{"id":"ls1","call":"list_agents"}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    // Verify the response includes both agents with distinct refs
    const sendCall = vi.mocked(adapter.sendText).mock.calls.find(
      c => typeof c[1] === 'string' && c[1].includes('"id":"ls1"')
    );
    expect(sendCall).toBeDefined();
    const resLine = sendCall![1] as string;
    const resPayload = JSON.parse(resLine.slice('[NodePTY]:RES:'.length).trimEnd());

    expect(resPayload.data.agents).toHaveLength(2);
    expect(resPayload.data.agents[0]!.surface.surfaceRef).not.toBe(
      resPayload.data.agents[1]!.surface.surfaceRef,
    );
  });

  it('should reject send_to_agent when target is in starting state', async () => {
    const a1 = await registry.createAgent('agent-1', 'right');
    await registry.createAgent('agent-2', 'down');
    a1.setStatus('starting');
    a1.setStatus('ready');

    // agent-2 started but not yet ready
    const a2 = registry.getAgent('agent-2');
    a2.setStatus('starting');

    vi.mocked(adapter.sendText).mockClear();

    const text =
      '[NodePTY]:READY:{"session":"s1"}\n' +
      '[NodePTY]:REQ:{"id":"s1","call":"send_to_agent","args":{"to":"agent-2","payload":"hi"}}\n';
    vi.mocked(adapter.readSurface).mockResolvedValueOnce({ text, raw: text });
    await (registry as any).pollAgent('agent-1');

    expect(adapter.sendText).toHaveBeenCalledWith(
      a1.surface.surfaceRef,
      expect.stringContaining('is in starting state'),
    );
  });
});
