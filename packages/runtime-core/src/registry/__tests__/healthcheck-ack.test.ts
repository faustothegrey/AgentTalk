import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { createConversationRuntime } from '../../conversations/runtime.js';

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

describe('M16-T2a Healthcheck ACK handling', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  describe('Registry handler', () => {
    it('resolves a pending healthcheck via healthcheck_ack tool call', async () => {
      const agent = await registry.createAgent('agent-1', { provider: 'mcp' });
      await registry.activateAgent(agent.id);

      // Create a pending healthcheck manually using the manager
      const { token, result } = (registry as any).healthchecks.create('agent-1', 5000);

      // Issue the healthcheck_ack MCP tool call
      const response = await registry.handleMcpToolCall('agent-1', 'healthcheck_ack', {
        token,
        message: 'All good',
      });

      expect(response.content[0].text).toBe('Healthcheck acknowledged successfully');

      // Prove the promise resolved
      const resolvedValue = await result;
      expect(resolvedValue.agentId).toBe('agent-1');
      expect(resolvedValue.message).toBe('All good');
    });

    it('throws error on wrong-agent ACK and does not resolve', async () => {
      const agent1 = await registry.createAgent('agent-1', { provider: 'mcp' });
      const agent2 = await registry.createAgent('agent-2', { provider: 'mcp' });
      await registry.activateAgent(agent1.id);
      await registry.activateAgent(agent2.id);

      // Create a pending healthcheck for agent-1
      const { token, result } = (registry as any).healthchecks.create('agent-1', 5000);
      result.catch(() => {}); // prevent unhandled rejection when registry destroys

      // Issue the healthcheck_ack MCP tool call from agent-2 (wrong agent)
      await expect(
        registry.handleMcpToolCall('agent-2', 'healthcheck_ack', {
          token,
          message: 'All good',
        })
      ).rejects.toThrow('Invalid or stale healthcheck token for agent agent-2');

      // The promise should still be pending. We can check if the token is still in the pending map.
      expect((registry as any).healthchecks.pending.has(token)).toBe(true);
    });

    it('throws error on wrong-token ACK and does not resolve', async () => {
      const agent = await registry.createAgent('agent-1', { provider: 'mcp' });
      await registry.activateAgent(agent.id);

      // Create a pending healthcheck for agent-1
      const { token, result } = (registry as any).healthchecks.create('agent-1', 5000);
      result.catch(() => {}); // prevent unhandled rejection when registry destroys

      // Issue the healthcheck_ack MCP tool call with wrong token
      await expect(
        registry.handleMcpToolCall('agent-1', 'healthcheck_ack', {
          token: 'wrong-token',
          message: 'All good',
        })
      ).rejects.toThrow('Invalid or stale healthcheck token for agent agent-1');

      // The promise should still be pending
      expect((registry as any).healthchecks.pending.has(token)).toBe(true);
    });

    it('throws error if token is missing', async () => {
      const agent = await registry.createAgent('agent-1', { provider: 'mcp' });
      await registry.activateAgent(agent.id);

      await expect(
        registry.handleMcpToolCall('agent-1', 'healthcheck_ack', {
          message: 'Missing token',
        })
      ).rejects.toThrow('Missing or invalid token in healthcheck_ack');
    });
  });

  describe('Runtime in-process driver', () => {
    it('emits healthcheck_ack tool name for healthcheck events', () => {
      const runtime = createConversationRuntime();
      
      const req = runtime.buildProtocolRequest(
        { type: 'healthcheck', token: 'token-123' },
        'reply message'
      );

      expect(req.call).toBe('healthcheck_ack');
      expect(req.args).toEqual({
        token: 'token-123',
        message: 'reply message',
      });
    });
  });
});
