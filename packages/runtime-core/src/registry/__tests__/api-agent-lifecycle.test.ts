import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import * as apiClient from '../../agents/api-client.js';

vi.mock('../../agents/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../agents/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

describe('Registry API-backed agent lifecycle', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('creates an API-backed agent and completes a turn via in-process driver', async () => {
    const callApiMock = vi.mocked(apiClient.callApi);
    callApiMock.mockResolvedValue({
      text: 'hello from mocked google',
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });

    const agent = await registry.createAgent('api-agent-1', {
      provider: 'api',
      providerName: 'google',
      model: 'gemini-2.5-flash'
    });

    expect(agent.provider).toBe('api');
    expect(agent.providerName).toBe('google');

    await registry.activateAgent(agent.id);

    // It should skip the readiness timeout and set status to ready
    expect(agent.status).toBe('ready');

    // Simulate sending a message to this agent (which should be queued and processed by the driver)
    await registry.sendProtocol('api-agent-1', 'EVT', {
      type: 'message_received',
      from: 'user',
      payload: 'Say hello'
    });

    // Wait for the async loop to pick it up and call API
    await new Promise(r => setTimeout(r, 50));

    // callApi should have been invoked
    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(callApiMock.mock.calls[0]?.[0]).toMatchObject({
      provider: 'google',
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: expect.stringContaining('Say hello') }]
    });

    // We can also verify it emitted a user message since graceful degrade uses send_to_agent{to:"user"}
    // Wait, graceful degrade sends to user?
    // Let's spy on registry handleMcpToolCall
  });
});
