import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessAgentDriver } from '../in-process-driver.js';
import { Agent } from '../agent.js';
import type { Registry } from '../../registry/registry.js';

describe('InProcessAgentDriver', () => {
  let agent: Agent;
  let registry: Registry;
  let mockFetch: any;

  beforeEach(() => {
    agent = new Agent('agent-1');
    registry = {
      handleMcpToolCall: vi.fn().mockResolvedValue({})
    } as unknown as Registry;
    mockFetch = vi.fn();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('runs awaitTurn -> callApi -> handleMcpToolCall', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello world' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    expect(agent.status).toBe('ready');

    // Feed a non-planning turn (no structured JSON required)
    agent.queueTurn({
      type: 'message_received',
      from: 'user',
      payload: 'Hi'
    });

    // Wait for the event loop
    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'send_to_agent', expect.objectContaining({ payload: 'hello world' }));

    driver.stop();
  });

  it('handles structured response on planning turn', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"message_type":"opinion","message_payload":{"text":"my opinion","proposal":null,"expected_response_types":["opinion"]}}' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    // Start a planning conversation
    agent.queueTurn({
      type: 'conversation_start',
      mode: 'planning',
      peerIds: ['agent-2'],
      topic: 'test',
      initiator: true
    });

    await new Promise(r => setTimeout(r, 50));

    // Should have queued a message_received event internally because initiator=true
    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'send_to_agent', expect.objectContaining({
      payload: 'my opinion',
      to: 'agent-2'
    }));

    driver.stop();
  });
});
