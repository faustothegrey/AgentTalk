import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { Agent } from '../../agents/agent.js';
import { InProcessAgentDriver } from '../../agents/in-process-driver.js';
import type { Completer } from '@agenttalk/llm-client';
import * as apiClient from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

/**
 * BL-047 (Tester finding TL-007) — API agents must survive `conversation_end`.
 *
 * `InProcessAgentDriver.handleTurn` called `this.stop()` on `conversation_end`. For an
 * ATTACHED agent that is right: the external client shuts down with the conversation, so
 * the loop has nothing left to pull for. For an IN-PROCESS (API) agent there is no client —
 * the driver's loop IS the agent. Stopping it left the agent advertising `ready` with a dead
 * loop behind it, so the next conversation's startup healthcheck was queued and never pulled,
 * and `startConversation` rejected at the healthcheck timeout. TL-007 saw exactly that: the
 * first conversation completed cleanly, a second one with the same agents failed with
 * `did not respond to healthcheck within 30000ms`, and fresh agents worked.
 *
 * The first test drives the REAL Registry through the REAL conversation path (only the
 * provider HTTP call is mocked), so what it pins is the reported failure, not a proxy for it.
 * The second test pins the attached path as unchanged.
 */
describe('BL-047 API agents are reusable across conversations', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry({ healthcheckTimeoutMs: 500 });
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(async () => {
    await registry.destroy();
  });

  async function createActiveAgent(id: string) {
    const agent = await registry.createAgent(id, {
      provider: 'api',
      providerName: 'google',
      model: 'gemini-2.5-flash',
    });
    await registry.activateAgent(agent.id);
    return agent;
  }

  it('answers a SECOND conversation\'s startup healthcheck after the first ended', async () => {
    // Every turn in this test is a healthcheck; answer it in the shape the driver expects.
    vi.mocked(apiClient.callApi).mockResolvedValue({
      text: '{"message_type":"healthcheck_ack","message_payload":{"text":"alive"}}',
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const a = await createActiveAgent('bl047-a');
    const b = await createActiveAgent('bl047-b');

    // Conversation 1 — this always worked, pre-fix and post-fix.
    const first = await registry.startConversation([a.id, b.id], 'first topic', 2);
    expect(first.status).toBe('active');

    // End it through the production path: this is what delivers `conversation_end` to
    // both drivers, and pre-fix it is what killed them.
    (registry as any).conversationCoordinator.markConversationCompleted(first, 'done');
    await new Promise((r) => setTimeout(r, 50));

    // The agents look reusable...
    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');

    // ...and now must actually BE reusable. Pre-fix this rejects with
    // "Agent bl047-a did not respond to healthcheck within 500ms".
    const second = await registry.startConversation([a.id, b.id], 'second topic', 2);
    expect(second.status).toBe('active');
    expect(second.id).not.toBe(first.id);
  });

  it('does not revive a stopped driver for a trailing message_received', async () => {
    // The brake that `stop()` was accidentally providing: once a conversation is over there
    // is no active conversation for `assertRelayDeliverable` to apply a reply cap to, so two
    // revived idle agents would relay to each other without bound. A trailing relay must
    // therefore leave the stopped loop stopped. (The uncapped-relay path itself is
    // pre-existing and deliberately untouched — see the BL-047 note.)
    vi.mocked(apiClient.callApi).mockResolvedValue({
      text: '{"message_type":"healthcheck_ack","message_payload":{"text":"alive"}}',
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const a = await createActiveAgent('bl047-c');
    const b = await createActiveAgent('bl047-d');

    const conv = await registry.startConversation([a.id, b.id], 'first topic', 2);
    (registry as any).conversationCoordinator.markConversationCompleted(conv, 'done');
    await new Promise((r) => setTimeout(r, 50));

    const callsAfterEnd = vi.mocked(apiClient.callApi).mock.calls.length;

    await (registry as any).sendProtocol(a.id, 'EVT', {
      type: 'message_received',
      from: b.id,
      payload: 'a straggler from the conversation that just ended',
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(apiClient.callApi).mock.calls.length).toBe(callsAfterEnd);
  });

  it('keeps stopping the driver at conversation_end for an ATTACHED agent', async () => {
    // The attached client shuts down with the conversation, so the loop must not keep
    // pulling turns for it. This pins that half of the behaviour as untouched.
    const agent = new Agent('bl047-attached');
    agent.transport = 'attached';

    const complete = vi.fn().mockResolvedValue({
      text: '{"message_type":"healthcheck_ack","message_payload":{"text":"alive"}}',
    });
    const handleMcpToolCall = vi.fn().mockResolvedValue({});
    const registryDouble = {
      handleMcpToolCall,
      pauseTaskForOperator: vi.fn().mockResolvedValue(undefined),
      notifyAgentStatus: (ag: Agent, s: Parameters<Agent['setStatus']>[0]) => ag.setStatus(s),
    } as unknown as Registry;

    const driver = new InProcessAgentDriver(agent, registryDouble, {
      completer: { maintainsSession: true, complete } as unknown as Completer,
    });
    driver.start();

    agent.queueTurn({ type: 'conversation_end', conversationId: 'c1', reason: 'done' });
    await new Promise((r) => setTimeout(r, 20));

    // A turn queued after conversation_end must NOT be picked up: the loop is stopped.
    agent.queueTurn({ type: 'healthcheck', token: 'tok-1', prompt: 'ping', timeoutMs: 500 });
    await new Promise((r) => setTimeout(r, 50));

    expect(complete).not.toHaveBeenCalled();
    expect(handleMcpToolCall).not.toHaveBeenCalled();
  });
});
