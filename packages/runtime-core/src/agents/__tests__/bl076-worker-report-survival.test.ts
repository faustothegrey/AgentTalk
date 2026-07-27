import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessAgentDriver } from '../in-process-driver.js';
import { Agent } from '../agent.js';
import type { Registry } from '../../registry/registry.js';

/**
 * BL-076 — the worker's REPORT must survive the worker protocol.
 *
 * In both rung-4 runs goose DID the work (edit + test + commit) but its report never reached the
 * orchestrator: the outcome was recoverable only from the artifact (the commit), never from what
 * the worker said. The team still flipped to `completed` on that non-report — the BL-062
 * "completed != done" trap, with nothing in the record to contradict it.
 *
 * The loss is NOT in the non-JSON case: an unparseable response falls into the `!structured`
 * branch, which already submits the raw text. It is in the "parsed, but not a work verdict" case
 * -- e.g. `ack_planning_protocol` with an empty payload, which validates fine. That path reads
 * `payload.text || payload.plan || payload.reason`, finds nothing, and substitutes the literal
 * string 'Task completed.' -- discarding the response text that held the worker's actual report.
 */
describe('BL-076 worker report survives a non-verdict structured response', () => {
  let agent: Agent;
  let registry: Registry;
  let mockFetch: any;

  beforeEach(() => {
    agent = new Agent('worker-1');
    registry = {
      handleMcpToolCall: vi.fn().mockResolvedValue({}),
      pauseTaskForOperator: vi.fn().mockResolvedValue(undefined),
      notifyAgentStatus: (a: Agent, s: Parameters<Agent['setStatus']>[0]) => a.setStatus(s),
    } as unknown as Registry;
    mockFetch = vi.fn();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  const resultSubmitted = () => {
    const call = (registry.handleMcpToolCall as any).mock.calls.find(
      (c: any[]) => c[1] === 'submit_work_result',
    );
    return call?.[2]?.result;
  };

  const runWorker = async (content: string) => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();
    agent.queueTurn({ type: 'team_work_assign', description: 'Do the refactor' });
    await new Promise((r) => setTimeout(r, 60));
    driver.stop();
  };

  // The exact rung-4 shape: goose answered the retry with a bare protocol ack, carrying no
  // payload text, while its real report sat in the very same response.
  const GOOSE_ACK = JSON.stringify({
    message_type: 'ack_planning_protocol',
    message_payload: {},
  });

  it('does not replace the worker report with the placeholder "Task completed."', async () => {
    await runWorker(GOOSE_ACK);

    // The task IS accepted -- that part was never in question.
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('worker-1', 'submit_work_response', {
      accepted: true,
    });

    // The defect: everything the worker said is thrown away and replaced by a placeholder that
    // asserts success while carrying no evidence of it.
    expect(resultSubmitted()).not.toBe('Task completed.');
  });

  it('carries the raw response through when the structured payload has no text', async () => {
    await runWorker(GOOSE_ACK);
    // Whatever the worker actually emitted must still be recoverable from the work result.
    expect(String(resultSubmitted())).toContain('ack_planning_protocol');
  });

  it('a proper work_accept is unaffected (regression guard)', async () => {
    await runWorker('{"message_type":"work_accept","message_payload":{"text":"I did the work."}}');
    expect(resultSubmitted()).toBe('I did the work.');
  });
});
