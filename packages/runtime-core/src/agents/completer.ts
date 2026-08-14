import { randomUUID } from 'crypto';
import { Agent } from './agent.js';
import type { Registry } from '../registry/registry.js';
import type { Completer, CompleterResult, CompleterOptions } from '@agenttalk/llm-client';
import type { AgentErrorReason } from '@agenttalk/contracts/types';

// The chat plug (`Completer`) + the direct-HTTP `ApiCompleter` now live in `@agenttalk/llm-client`
// (extraction spike, 2026-06-26). This module keeps only the Registry-coupled MCP orchestration
// adapter, which depends on the engine and is NOT part of the standalone chat package.

/** Default wall-clock guard for an mcp exec turn when the caller passes no timeout (D1, M08-T1). */
export const DEFAULT_EXEC_TIMEOUT_MS = 120_000;

/**
 * Backstop grace added to an *explicit* `timeoutMs` (IMP-M08-1, D1 amendment approved by Fausto
 * 2026-06-22). When the caller passes a `timeoutMs` it is forwarded to the harness (see `complete`),
 * which owns the *primary* deadline; the completer's own timer is then a pure backstop and must fire
 * *strictly after* the harness deadline so it never pre-empts a legitimate late result. The
 * unforwarded {@link DEFAULT_EXEC_TIMEOUT_MS} has no competing timer, so it gets no grace.
 */
export const EXEC_TIMEOUT_BACKSTOP_GRACE_MS = 5_000;

/**
 * Typed rejection from {@link McpCompleter.complete} (M08-T1). `reason` distinguishes a
 * wall-clock `timeout` from a mid-exec `disconnect` (the agent going `error`/`terminated`).
 */
export class McpError extends Error {
  constructor(
    public readonly reason: 'timeout' | 'disconnect',
    message: string,
    public readonly agentId: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

/**
 * BL-129 — map an exec rejection onto the engine's `AgentErrorReason` vocabulary.
 *
 * Why a mapping function rather than `McpError extends AgentReasonedError`: `McpError.reason` is
 * `'timeout' | 'disconnect'` and TWO existing tests pin those exact literals
 * (`completer.test.ts`). `AgentReasonedError` declares `readonly reason: AgentErrorReason`, so
 * subclassing would have to widen — or silently rename — a field that is already a behaviour
 * contract. Mapping at the boundary keeps both vocabularies intact and honest.
 *
 * This still satisfies BL-084's rule that a reason must TRAVEL WITH THE THROW rather than be
 * recovered by inspection: it switches on a typed discriminator the thrower set deliberately,
 * never on `err.message` prose — which BL-084's plan §2 rejected outright.
 *
 * The asymmetry between the two arms is deliberate and is the PO's 2026-08-14 decision:
 * `exec-timeout` is FAULT (it propagates, killing the team), `exec-disconnect` is NON-fault (the
 * agent already transitioned on its own path with its own reason). Both rationales are written
 * out at their definitions in `contracts/types.ts`.
 */
export function execErrorReason(err: McpError): AgentErrorReason {
  return err.reason === 'timeout' ? 'exec-timeout' : 'exec-disconnect';
}

export class McpCompleter implements Completer {
  maintainsSession = true;
  constructor(private agent: Agent, private registry: Registry) {}

  async complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult> {
    // M08-T1: race the `exec_result` resolve against (a) a wall-clock timeout and (b) the agent
    // entering a terminal state mid-exec. Without these the Promise would hang forever if the
    // harness never returns (e.g. a mid-exec disconnect). The first signal wins; all listeners +
    // the timer are torn down on settle (no leak). The *lifecycle consequence* of a rejection
    // (re-deliver / fence) is deliberately NOT decided here — that is M08-T2 / M08-T3.
    // IMP-M08-1: an explicit timeout is forwarded to the harness (the primary deadline), so the
    // completer's own timer backstops it at `timeoutMs + grace` — strictly after, never racing it.
    // The unforwarded default fires at exactly DEFAULT_EXEC_TIMEOUT_MS (no competing timer).
    const backstopGraceMs = opts?.timeoutMs !== undefined
      ? ((opts as CompleterOptions & { timeoutBackstopGraceMs?: number }).timeoutBackstopGraceMs ?? EXEC_TIMEOUT_BACKSTOP_GRACE_MS)
      : 0;
    const guardMs = opts?.timeoutMs !== undefined
      ? opts.timeoutMs + backstopGraceMs
      : DEFAULT_EXEC_TIMEOUT_MS;

    // BL-127: the exec turn's OBLIGATION ID. Until this existed, an `exec_rpc` turn carried no
    // `turnId` and no `messageId`, so `await_turn`'s stamp (`registry.ts:502-508`) matched neither
    // branch, `currentTurnId` was never set, and `classifySilence`'s first gate returned `undefined`
    // forever — leaving the non-reply sweep structurally blind to the ONE turn class it exists to
    // watch (the long provider-CLI turns). Minted here rather than at the queue site because this is
    // the scope that also OWNS the turn's end: see `cleanup` below.
    //
    // `randomUUID` rather than a counter or a timestamp: ids share `processedTurnIds` and the dedup
    // key `<turnId>::<reason>` with peer-message-derived ids (`registry.ts:734`), and a collision
    // there would silently suppress a real notice.
    const turnId = `exec-${this.agent.id}-${randomUUID()}`;

    return new Promise<CompleterResult>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      const onResult = (result: { agentId: string; text: string; usage?: any }) => {
        if (settled || result.agentId !== this.agent.id) return;
        settled = true;
        cleanup();
        resolve({ text: result.text, usage: result.usage });
      };

      const onStatus = (evt: { id: string; status: string }) => {
        if (settled || evt.id !== this.agent.id) return;
        // Only terminal states reject. `reconnecting` is the 30s grace window — left for M08-T2.
        if (evt.status === 'error' || evt.status === 'terminated') {
          settled = true;
          cleanup();
          reject(new McpError('disconnect', `Agent ${this.agent.id} entered '${evt.status}' state during exec`, this.agent.id));
        }
      };

      const cleanup = () => {
        this.registry.off('exec_result', onResult);
        this.registry.off('status', onStatus);
        clearTimeout(timer);

        // BL-127 — THE OBLIGATION CHOKEPOINT. This is the load-bearing half of the fix, and the
        // reason minting an id is not a one-line change.
        //
        // Every way an exec turn can end runs through here exactly once: a normal result
        // (`submit_exec_result` → `exec_result` → `onResult`), the guard firing (`timer`), and the
        // agent going terminal mid-exec (`onStatus`). `submit_exec_result` clears `activeExecTurn`
        // but NOT `currentTurnId`, and none of the three sites that do clear it
        // (`markTerminalActionComplete`, the driver's `conversation_end`, the reconnect path) is on
        // an exec turn's normal path. So without this line, minting an id would leave every attached
        // agent holding a stale obligation and the sweep would report every HEALTHY IDLE agent as
        // silent, forever — strictly worse than the mute detector it replaced, because false notices
        // are what [[BL-028]] T3c would then derive its threshold from.
        //
        // Guarded by identity, not cleared unconditionally: on a reconnect the interrupted exec turn
        // is requeued at head (`registry.ts:1384-1388`) and re-stamped with this SAME id when the
        // harness pulls it again, but a LATER turn's id must never be erased by an earlier turn's
        // teardown.
        //
        // NOT touched here, deliberately: the abnormal-close path retains `currentTurnId` on
        // purpose — `registry.ts:1395` reads it (`agent.currentTurnId ? 'error' : 'terminated'`) to
        // decide whether an agent died holding an obligation. That retention is load-bearing state,
        // not a leak.
        if (this.agent.currentTurnId === turnId) {
          this.agent.currentTurnId = undefined;
        }
      };

      this.registry.on('exec_result', onResult);
      this.registry.on('status', onStatus);

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new McpError('timeout', `Exec for agent ${this.agent.id} timed out after ${guardMs}ms`, this.agent.id));
      }, guardMs);

      const turn: Record<string, unknown> = {
        type: 'exec_rpc',
        prompt,
        // BL-127: read by `await_turn`'s existing stamp — no new stamping site was needed.
        // Contract-safe: `wire-contract.json` hashes only `{mcpTools, packetTypes, protocolPrefix}`
        // (v8, verified at the artifact), so an added turn field cannot move the hash and no
        // attached client has to ship in lockstep. Same reasoning as BL-124 S1's registry event.
        turnId,
      };
      if (opts?.cwd) turn.cwd = opts.cwd;
      if (opts?.timeoutMs) turn.timeoutMs = opts.timeoutMs;

      this.agent.queueExecTurn(turn);
    });
  }
}
