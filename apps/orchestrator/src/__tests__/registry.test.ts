import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { existsSync, rmSync } from 'fs';
import { deriveConversationStatus } from '@agenttalk/runtime-core/conversations/conversation-status';

describe('Registry', () => {
  let registry: Registry;
  const TRANSCRIPT_DIR = './test-transcripts';
  const conversationStorePath = `${TRANSCRIPT_DIR}/conversations.json`;

  beforeEach(() => {
    registry = new Registry({
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

  it('should create an agent', async () => {
    const agent = await registry.createAgent('agent-1');
    expect(agent.id).toBe('agent-1');
    expect(agent.status).toBe('creating');
    expect(agent.requestedExecutionMode).toBe('auto');
  });

  it('should persist the requested execution mode on agent creation', async () => {
    const agent = await registry.createAgent('agent-1', { requestedExecutionMode: 'interactive' });
    expect(agent.requestedExecutionMode).toBe('interactive');
  });

  it('should activate an agent and transition to starting', async () => {
    await registry.createAgent('agent-1');
    await registry.activateAgent('agent-1', 'claude', 'sonnet', 'auto');

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('starting');
    expect(agent.provider).toBe('claude');
    expect(agent.model).toBe('sonnet');
    expect(agent.requestedExecutionMode).toBe('auto');
  });

  it('should reject duplicate agent IDs', async () => {
    await registry.createAgent('agent-1');
    await expect(registry.createAgent('agent-1')).rejects.toThrow('Agent agent-1 already exists');
  });

  it('should throw when getting a nonexistent agent', () => {
    expect(() => registry.getAgent('nope')).toThrow('Agent nope not found');
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
    (registry as any).conversations.add({
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

  it('should transition agent to error on handleMcpDisconnect if not terminated', async () => {
    const agent = await registry.createAgent('agent-1');
    agent.setStatus('starting');
    agent.setStatus('ready');

    expect(agent.status).toBe('ready');

    registry.handleMcpDisconnect('agent-1');
    expect(agent.status).toBe('reconnecting');
  });

  it('should not transition agent to error on handleMcpDisconnect if already terminated', async () => {
    const agent = await registry.createAgent('agent-1');
    agent.setStatus('terminated');

    expect(agent.status).toBe('terminated');

    registry.handleMcpDisconnect('agent-1');
    expect(agent.status).toBe('terminated');
  });

  describe('handleMcpDisconnect in Attach Mode', () => {
    let originalAttachMode: string | undefined;

    beforeEach(() => {
      originalAttachMode = process.env.AGENTTALK_ATTACH_MODE;
      process.env.AGENTTALK_ATTACH_MODE = 'true';
    });

    afterEach(() => {
      delete process.env.AGENTTALK_ATTACH_MODE;
    });

    it('should set agent to terminated on clean exit (code 1000)', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1000);
      expect(agent.status).toBe('terminated');
    });

    it('should set agent to error on internal error (code 1011)', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1011);
      expect(agent.status).toBe('error');
    });

    it('should set a reconnect timeout for abnormal closures', async () => {
      vi.useFakeTimers();
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1006);
      
      // Status should transition to reconnecting
      expect(agent.status).toBe('reconnecting');
      
      // Fast forward 30 seconds
      vi.advanceTimersByTime(30000);
      expect(agent.status).toBe('terminated');
      vi.useRealTimers();
    });

    it('should set status to error on reconnect timeout if a turn was in flight', async () => {
      vi.useFakeTimers();
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      agent.currentTurnId = 'turn-123';
      
      registry.handleMcpDisconnect('agent-1', 1006);
      expect(agent.status).toBe('reconnecting');
      
      vi.advanceTimersByTime(30000);
      expect(agent.status).toBe('error');
      vi.useRealTimers();
    });
  });
});
