import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import * as apiClient from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

/**
 * BL-077 — driver-owned status transitions must reach connected clients.
 *
 * The rung-4 run (BL-046) had the web UI frozen at `starting` for an entire autonomous
 * run while the backend log showed `creating → starting → ready → busy`. Root cause:
 * `InProcessAgentDriver` called `agent.setStatus()` directly, which mutates and logs but
 * emits nothing — so `server.ts`'s `registry.on('status', …)` broadcast never fired for
 * any transition the driver owned. Only `starting` (emitted by `Registry.activateAgent`)
 * ever reached the UI.
 *
 * These tests use a REAL Registry and a REAL in-process driver — only the network call is
 * mocked — so what is asserted is the actual emit path the server subscribes to.
 */
describe('BL-077 driver status transitions are broadcast', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
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

  it('D1/D2: emits a status event for the driver-owned busy and ready transitions', async () => {
    vi.mocked(apiClient.callApi).mockResolvedValue({
      text: 'hello',
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const agent = await createActiveAgent('bl077-a');

    // Subscribe AFTER activation, exactly as an already-connected UI client would be:
    // the `starting` broadcast has already happened; everything from here was previously silent.
    const seen: string[] = [];
    registry.on('status', ({ id, status }) => {
      if (id === 'bl077-a') seen.push(status);
    });

    agent.queueTurn({ type: 'message_received', from: 'user', payload: 'Hi' });
    await vi.waitFor(() => expect(seen).toContain('ready'), { timeout: 2000 });

    // D1 — the turn made the agent busy, and that was announced.
    expect(seen).toContain('busy');
    // D2 — the turn finished, and the return to ready was announced.
    expect(seen).toContain('ready');
    // Ordering: busy precedes the ready that follows it.
    expect(seen.indexOf('busy')).toBeLessThan(seen.lastIndexOf('ready'));
  });

  it('D3: a driver-path error is announced, and since T2 a fault-class cause also propagates', async () => {
    vi.mocked(apiClient.callApi).mockResolvedValue({
      text: 'unused',
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const agent = await createActiveAgent('bl077-b');

    // ⬛ AMENDED BY BL-084 T2 (PO Gate-1 approved). BL-077 deliberately did NOT make this
    // behaviour change — it only made driver transitions visible to the UI. T2 makes it, but
    // ONLY for a cause positively identified as a fault; the classification is what BL-077
    // lacked and could not safely invent.
    const handleAgentFailure = vi.spyOn(
      (registry as unknown as { teamCoordinator: { handleAgentFailure: (id: string) => Promise<void> } })
        .teamCoordinator,
      'handleAgentFailure',
    );

    const seen: string[] = [];
    registry.on('status', ({ id, status }) => {
      if (id === 'bl077-b') seen.push(status);
    });

    // A `conversation_start` with no peers/topic makes the runtime return ok:false, which
    // `handleTurn` throws on — the genuine loop-level error path (in-process-driver.ts).
    agent.queueTurn({ type: 'conversation_start' });
    await vi.waitFor(() => expect(seen).toContain('error'), { timeout: 2000 });

    // The UI is told about the error (BL-077's contribution, unchanged)...
    expect(agent.status).toBe('error');
    // ...and since T2 a FAULT-class cause also reaches the engine. This one is
    // `conversation-start-failed`; a non-fault cause still would not.
    expect(handleAgentFailure).toHaveBeenCalled();
  });
});
