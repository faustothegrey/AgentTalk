// BL-071 — a small, stable snapshot of the host a process runs on. Gathered by a
// process ABOUT ITSELF via node's `os`/`process` (ground truth, not a claim), so no
// trust model is needed (that is BL-072's concern). Deliberately minimal: future
// behaviours may branch on it, so it is a lightweight contract — add fields explicitly
// when a need arises rather than dumping `process.env`/PATH/cwd (leaky/unstable/sensitive).
// NOTE: a pure type add here does NOT change the wire-contract hash, which covers only
// { mcpTools, packetTypes, protocolPrefix } (see packages/contracts/scripts/verify-contract.js).
export interface HostEnvironment {
  platform: NodeJS.Platform; // os.platform() — e.g. 'darwin' | 'linux' | 'win32'
  arch: string;              // os.arch()     — e.g. 'arm64' | 'x64'
  osRelease: string;         // os.release()
  nodeVersion: string;       // process.version — e.g. 'v22.3.0'
  hostname: string;          // os.hostname()
  cpuCount: number;          // os.cpus().length
  totalMemBytes: number;     // os.totalmem()
  capturedAt: string;        // ISO 8601 — when THIS process observed the above
}

export type AgentStatus = 'creating' | 'starting' | 'ready' | 'busy' | 'error' | 'reconnecting' | 'terminated';

// BL-084 T1 — the typed reason carried by a transition into `error`.
//
// `error` used to be one undifferentiated bucket, so M03 propagation (the team-wide
// Shared-Fate kill) fired on ANY entry into it. That is why BL-078 could not route
// driver errors through `setAgentStatus` and why BL-028's idle sweep cannot be switched
// on: a conversation ending normally, a rail firing correctly, or a refused privilege
// escalation is indistinguishable from a crash.
//
// The vocabulary is split by ONE question — "is this the agent's fault?" — because that
// is the only question propagation asks. It is deliberately NOT LB-67 Finding 1's
// non-reply vocabulary, which answers a different question ("why did a peer not reply?")
// for a different consumer (the sender). See design/bl084-plan.md §0.
//
// The classification lives in `isFaultClass` (registry.ts); these are just the names.

/** Reasons that are the agent's fault — M03 propagation fires, exactly as it does today. */
export type AgentFaultErrorReason =
  // The conversation runtime refused to start (in-process driver path).
  | 'conversation-start-failed'
  // Attached transport: MCP socket closed with 1011 (internal error).
  | 'mcp-internal-error'
  // Attached transport: the reconnect grace period expired with a turn still in flight.
  | 'reconnect-timeout-inflight-turn'
  // BL-129 — a non-worker (planner) exec turn hit its guard: the provider CLI went quiet and
  // never came back.
  //
  // ⚠️ FAULT BY EXPLICIT PO DECISION, 2026-08-14, taken with the blast radius stated in advance.
  // This one PROPAGATES: `handleAgentFailure` interrupts the task and requests shutdown of every
  // OTHER team member. That is the largest blast radius available here, and it is deliberate.
  //
  // The reasoning, recorded because it runs opposite to every other call on this page: the
  // alternative is what shipped for months — the timeout swallowed into `return null`, the turn
  // ending with no output, and the team wedged in `planning` FOREVER with every member `ready`
  // and nobody owing a reply. Nothing detects that (BL-129's predicate gap). So the failure mode
  // being replaced is not "an agent limps": it is "the team is dead and no instrument can say so".
  // A loud, reversible kill beats a silent permanent hang — being wrong here costs one re-run and
  // the operator LEARNS; being wrong the old way cost an invisible wedge.
  //
  // ↩ RELAXATION CONDITION (logbook LB-96): flip to non-fault — or divert to the M08-T3 worker
  // fence (`pauseTaskForOperator`, which terminates nobody) — as soon as EITHER a progress-
  // predicate detector exists so the hang is observable without a kill, OR real runs show
  // provider timeouts are frequent enough that team-wide shutdown costs more than it reveals.
  // Do NOT relax it merely because a kill was startling: that is the mechanism working.
  | 'exec-timeout'
  // The idle sweep declared the agent hung.
  //
  // NOTE (BL-084 T1): this is fault-class ONLY to preserve today's behaviour byte-for-byte.
  // No agent has ever reached this reason, so T1 reproduces a propagation nothing has observed.
  // BL-028 (T3) is the item that revisits this row: a correctly-paused agent must not be killed,
  // which needs the sender-side non-reply reason as well. Do NOT flip it here.
  //
  // CORRECTED (BL-130, 2026-08-14) — this note previously read *"the sweep is currently dead code
  // — `lastProgressAt` is never written, so `hasAgentTimedOut()` always returns false"*. BOTH
  // halves are false, and have been since BL-028 T3a. `lastProgressAt` IS written, at
  // `registry.ts:489`, `registry.ts:513` and `in-process-driver.ts:116`; and `hasAgentTimedOut()`
  // no longer exists at all — it was renamed to `quietForMs` and then to `classifySilence`
  // (`registry.ts:890` records both renames and why each was made).
  //
  // The sweep is NOT dead code. It runs, and it still emits nothing — for two entirely different
  // reasons, neither of which has anything to do with `lastProgressAt`: an `exec_rpc` turn carries
  // no obligation id, so `classifySilence`'s `currentTurnId` gate (`registry.ts:929`) returns
  // `undefined` forever ([[BL-127]]); and where an id DOES exist, `DEFAULT_EXEC_TIMEOUT_MS`
  // (`completer.ts:10`, 120s) tears the turn down before a 180s threshold can mature ([[BL-128]]).
  // Believing the stale version leads a reader to the right conclusion for the wrong reason, and
  // then to the wrong fix.
  | 'idle-timeout';

/** Reasons that are NOT the agent's fault — the status changes and the UI sees it, but no propagation. */
export type AgentNonFaultErrorReason =
  // A protocol violation by the agent: it called a tool that does not exist.
  //
  // NON-FAULT by PO ratification 2026-07-27 (plan §9 q1), reversing T1's proposed `fault`.
  // Rationale, and the asymmetry that decided it: a hallucinated or mistyped tool name harms
  // nobody else — the orchestrator and every peer are fine — and it is the same transient class
  // as the malformed JSON that `parseWithRetry` already retries. Propagating it would let one
  // typo kill a whole team, and would hand anything able to induce a bad tool name a team-wide
  // DoS lever (the same argument that makes `workflow-gate-refusal` non-fault). Wrong in this
  // direction, a confused agent limps and is still bounded by the wall-clock cap, the reply cap
  // and BL-083's relay budget; wrong the other way, a team dies for a typo.
  | 'unknown-mcp-tool'
  // The conversation hit its reply cap. This is how a conversation *ends*.
  | 'conversation-reply-cap'
  // BL-083's relay budget was exhausted — a rail firing correctly.
  | 'relay-budget-exhausted'
  // The target agent was not `ready`/`busy`. Normal in attach mode.
  | 'target-agent-unavailable'
  // A workflow-gate refusal (`[PO]`/`[SM]` tag, wrong role). Propagating a *rejected*
  // privilege escalation would hand anyone who can trip a gate a team-wide DoS lever.
  | 'workflow-gate-refusal'
  // Planning messages routed at a team whose planning task is not active — a routing guard.
  | 'planning-task-inactive'
  // An invalid or stale healthcheck token — usually just a late ack.
  | 'healthcheck-token-invalid'
  // BL-084 T2 — an error reached the in-process driver's catch-all carrying no reason of its own.
  //
  // This exists because that call site (`in-process-driver.ts`) catches EVERYTHING thrown by the
  // turn loop, so it cannot know the cause. The safe default is the whole point: before T2 the
  // in-process path propagated NOTHING, so defaulting an unlabelled throw to `fault` would have
  // turned every unanticipated error into a team-wide kill — the largest blast radius available,
  // and the same DoS-lever shape that makes `workflow-gate-refusal` and `unknown-mcp-tool`
  // non-fault. Wrong in this direction a broken agent behaves exactly as it does today, which is
  // a known and shipped state; wrong the other way a team dies for a surprise.
  //
  // It is NOT a hole in T1's type guarantee: the catch site passes this reason EXPLICITLY, so
  // nothing is unclassified by omission — it is unclassified BY NAME, which is greppable, and
  // counting it is how we learn which causes still deserve a reason of their own.
  | 'driver-error-unclassified'
  // BL-129 — the agent went `error`/`terminated` DURING an exec turn, and the completer's
  // `onStatus` handler rejected the in-flight promise to unblock it.
  //
  // NON-fault, and the asymmetry with its sibling `exec-timeout` above is the whole point: by the
  // time this exists the agent has ALREADY transitioned through its own path, carrying its own
  // reason, and that transition already decided propagation on its own merits. Classifying the
  // exec wrapper's view as fault too would let a rejection *derived from* the status change
  // override the classification of the status change itself — deciding the same question twice,
  // with the less-informed answer winning.
  //
  // In practice it is also unreachable at the driver's catch: the guard there skips reporting when
  // the agent is already `error`/`terminated` (`in-process-driver.ts`), which is precisely this
  // case. It is classified anyway rather than left to a default, because a reason that exists
  // must say what it means — BL-084 T1's whole argument.
  | 'exec-disconnect';

export type AgentErrorReason = AgentFaultErrorReason | AgentNonFaultErrorReason;

/**
 * BL-084 T2 — an Error that carries its own `AgentErrorReason`.
 *
 * The in-process driver's error site is a catch-all, so the reason cannot be determined there; it
 * has to travel with the throw. The alternative — matching on `err.message` — was rejected in the
 * plan (§2): propagation must never depend on prose.
 */
export class AgentReasonedError extends Error {
  readonly reason: AgentErrorReason;
  constructor(reason: AgentErrorReason, message: string) {
    super(message);
    this.name = 'AgentReasonedError';
    this.reason = reason;
  }
}

/** The reason an error carries, or the explicit "we could not tell" default. */
export function reasonOf(err: unknown): AgentErrorReason {
  return err instanceof AgentReasonedError ? err.reason : 'driver-error-unclassified';
}

// BL-028 T3a — why a peer did not reply.
//
// A SIBLING of `AgentErrorReason`, deliberately NOT merged into it. That union answers "is this
// the agent's fault?", which is the only question M03 propagation asks. This one answers "why did
// a peer not reply?", whose consumer is the sender. They overlap (`errored`, `exited`) and diverge
// (`receiver-cancelled` is not an error cause; a workflow-gate refusal is not a non-reply), and
// `design/bl084-plan.md` §0 rejected conflating them once already. Vocabulary: LB-67 Finding 1.
//
// ⚠️ T3a EMITS EXACTLY ONE OF THESE — `quiet` — AND IT IS ADVISORY. Nothing branches on it and
// nothing dies of it. The other six are NAMED here and UNWIRED, in the same way T1 named
// `conversation-start-failed` with nothing setting it until T2. **A name in this union is not a
// claim that the condition is detected.** T3b is what wires the rest; T3c is the only unit that
// may ever escalate one into an `AgentErrorReason`, and it is separately gated.
//
// `quiet` is advisory BY DEFINITION, not by our timidity: it means "we have heard nothing", which
// is exactly what a working agent mid-turn also looks like. LB-67 records that our own prior art
// demoted this signal for that reason and replaced it with transport presence. Treating silence as
// authority is the mistake this vocabulary exists to make un-writable.
export type AgentNonReplyReason =
  // The receiver's turn ended without a reply — the primary, accurate signal.
  | 'turn-ended'
  // The receiver's process died. Definitive for this run.
  | 'exited'
  // Long silence, and nothing more. ADVISORY — the receiver may still be mid-turn.
  | 'quiet'
  // A human stopped the turn. The thread stays open.
  | 'user-stopped'
  // The receiver hit a rate limit or API error.
  | 'errored'
  // The receiver is blocked on a human. NOT A FAILURE — killing a team for this is the
  // specific accident BL-028 exists to avoid.
  | 'awaiting-input'
  // The message was dropped undelivered and the thread closed. Re-sending it is a bug.
  | 'receiver-cancelled';

/**
 * BL-028 T3a — the advisory the idle sweep emits.
 *
 * Carried on the Registry's EventEmitter surface (`agent_non_reply`), NOT as a protocol packet:
 * `verify-contract.js` hashes `{mcpTools, packetTypes, protocolPrefix}` and `mcp-server.ts`
 * rejects a mismatch on binary hash equality (LB-66), so a new EVT would break every attached
 * client until both repos shipped in lockstep. A type-only add here does not move that hash.
 */
export interface AgentNonReplyNotice {
  agentId: string;
  reason: AgentNonReplyReason;
  /** How long the agent had been silent when observed. The measurement T3c's threshold needs. */
  silentForMs: number;
  /** The outstanding obligation — the turn somebody is waiting on. */
  turnId: string;
  observedAt: string;
}

// 'persistent' is the canonical name for a long-lived agent process that handles
// many turns over one session. 'interactive' is a deprecated alias kept for
// backward compatibility with saved recordings and older clients.
export type AgentExecutionMode = 'persistent' | 'one_shot' | 'auto' | 'interactive';
export type ResolvedExecutionMode = Exclude<AgentExecutionMode, 'auto'>;
export type AgentSessionStatus = 'starting' | 'ready' | 'busy' | 'restarting' | 'error';

// The agent's client kind: how the orchestrator drives it. Distinct from the
// API-vendor axis (ApiProvider: openrouter/nous/google) and from providerName.
// 'mcp' is the externally-launched / exec-RPC / MCP-attach path. Typed as a
// union so a missed rename/typo is a compile error.
//
// ⚠️ DEPRECATED as a BEHAVIOURAL axis (BL-024) — this union conflated transport (api/mcp) and
// vendor (gemini/claude/codex/goose). After T2 the engine reads NO vendor name; the union now
// survives only as a SERIALIZATION LABEL (recordings / usage-capture / DTOs read `agent.provider`).
// The legacy `provider` INPUT is removed in T3b-2. `goose` was added (T3b) as a real vendor.
export type AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex' | 'goose';

// BL-024 — the two axes `AgentProvider` conflated:
//   transport = HOW the orchestrator drives the agent (the ONLY axis the engine needs).
//   vendor    = WHOSE CLI it is (an edge/launcher concern; absent for an opaque attach).
// 'in-process' was the old 'api'; 'attached' was the old 'mcp'/'gemini'/'claude'/'codex'/'goose'
// (the registry always treated those alike — see registry driver selection). `goose` is a harness
// over an arbitrary OpenRouter model, so a goose agent's identity is vendor × MODEL (see launcher).
export type AgentTransport = 'in-process' | 'attached';
export type AgentVendor = 'gemini' | 'claude' | 'codex' | 'goose';

// Per-agent capability metadata — where vendor-specific knobs live so they never
// leak into the engine as vendor-name branches (BL-024 leak #2). T1 seeds the one
// current consumer: gemini's longer fact-collection timeout.
export interface AgentCapabilities {
  factCollectionTimeoutMs?: number;
}

// The gemini fact-collection timeout, expressed as capability metadata rather than a
// vendor branch. Mirrors DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS in team-coordinator.ts;
// T2 makes the engine read this instead of sniffing the vendor name.
export const GEMINI_FACT_COLLECTION_TIMEOUT_MS = 720_000;

// The normalized agent kind: both new axes AND the legacy union, kept consistent so the
// (still-frozen) engine keeps reading `legacyProvider`/`providerName` unchanged in T1/T2.
export interface NormalizedAgentKind {
  transport?: AgentTransport | undefined;
  vendor?: AgentVendor | undefined;
  capabilities?: AgentCapabilities | undefined;
  legacyProvider?: AgentProvider | undefined;
  providerName?: string | undefined;
}

// Pure, dependency-free single source of truth for the transport↔vendor↔legacy mapping.
// Accepts either a legacy `provider` (+ providerName) or the new `{transport, vendor}`,
// and returns all fields consistently populated. The empty input (no provider, no
// transport) passes through untouched — preserving today's "provider-less agents throw
// at start()" behaviour. See design/bl024-provider-split-design.md §5.
export function normalizeAgentKind(input: {
  provider?: AgentProvider | undefined;
  providerName?: string | undefined;
  transport?: AgentTransport | undefined;
  vendor?: AgentVendor | undefined;
}): NormalizedAgentKind {
  const { provider, providerName, transport, vendor } = input;
  const geminiCaps = (): AgentCapabilities => ({ factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS });

  const base = (): NormalizedAgentKind => {
    // New-shape caller wins when a transport is given.
    if (transport) {
      // 'attached' with a known vendor maps back to that vendor name; opaque attach → 'mcp'.
      const legacyProvider: AgentProvider = transport === 'in-process' ? 'api' : (vendor ?? 'mcp');
      return {
        transport,
        vendor,
        capabilities: vendor === 'gemini' ? geminiCaps() : undefined,
        legacyProvider,
        providerName,
      };
    }

    // Legacy-shape caller.
    switch (provider) {
      case 'api':
        return { transport: 'in-process', legacyProvider: 'api', providerName };
      case 'mcp':
        return { transport: 'attached', legacyProvider: 'mcp', providerName };
      case 'gemini':
        return { transport: 'attached', vendor: 'gemini', capabilities: geminiCaps(), legacyProvider: 'gemini', providerName };
      case 'claude':
        return { transport: 'attached', vendor: 'claude', legacyProvider: 'claude', providerName };
      case 'codex':
        return { transport: 'attached', vendor: 'codex', legacyProvider: 'codex', providerName };
      case 'goose':
        return { transport: 'attached', vendor: 'goose', legacyProvider: 'goose', providerName };
      default:
        // Neither provider nor transport — provider-less; unchanged behaviour downstream.
        return { providerName };
    }
  };

  const result = base();

  // BL-024 T2: the fact-collection timeout capability is present iff the agent would have
  // triggered the engine's old 720s vendor bump — i.e. vendor gemini OR `providerName === 'gemini'`
  // (the `provider:'mcp'` + `providerName:'gemini'` case the vendor mapping alone misses). Setting it
  // here — and NOT re-adding a vendor branch in the frozen coordinator — is what keeps the engine
  // vendor-blind while preserving byte-identical timeouts. `vendor`/`legacyProvider` are unchanged.
  if (providerName === 'gemini' && !result.capabilities) {
    result.capabilities = geminiCaps();
  }

  return result;
}

export type TeamRole = 'planner' | 'worker';

export interface TeamMember {
  agentId: string;
  role: TeamRole;
}

export type TeamStatus = 'idle' | 'planning' | 'awaiting_confirmation' | 'working' | 'completed' | 'interrupted' | 'error';

export type TeamComposition = 'worker-only' | 'planner-worker' | 'planner-planner-worker';

export interface Team {
  id: string;
  composition: TeamComposition;
  provider?: AgentProvider | undefined;
  // BL-024 T2: team-level capability metadata, mirroring AgentCapabilities. Populated at team
  // creation from the (legacy) `provider` so the frozen coordinator reads a vendor-blind capability
  // instead of sniffing `team.provider === 'gemini'`. Preserves the team-level 720s bump exactly.
  capabilities?: AgentCapabilities | undefined;
  consensusMode?: 'protocol' | 'arbiter';
  members: TeamMember[];
  status: TeamStatus;
  currentTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamTaskStatus =
  | 'planning'
  | 'awaiting_confirmation'
  | 'delegated'
  | 'in_progress'
  | 'refused'
  | 'completed'
  | 'interrupted'
  | 'awaiting_operator';

export interface TeamTask {
  id: string;
  teamId: string;
  description: string;
  plan?: string;
  plannerAgentId?: string;
  planningComplete?: boolean;
  planSubmittedAt?: string;
  planConfirmed?: boolean;
  workerAccepted?: boolean;
  workerRefusalReason?: string;
  maxRepliesPerAgent?: number;
  replyCounts?: Record<string, number>;
  arbiterJudgeUsage?: { prompt_tokens: number; completion_tokens: number };
  arbiterSynthesisUsage?: { prompt_tokens: number; completion_tokens: number };
  status: TeamTaskStatus;
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowBatonMetadata {
  kind: 'workflow_baton';
  originTag: '[PO]' | '[SM]';
  fromRole: string;
  toRole: string;
  batonId: string;
}

export interface TranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
  messageType?: string;
  model?: string;
  provider?: AgentProvider;
  baton?: WorkflowBatonMetadata;
}

export interface Conversation {
  id: string;
  agentIds: string[];
  topic: string;
  maxRepliesPerAgent: number;
  replyCounts: Record<string, number>;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  transcript: TranscriptEntry[];
}

export type WorkflowOrigin = '[Human]' | '[PO]' | '[SM]';

export type WorkflowRole =
  | 'planner'
  | 'plan-reviewer'
  | 'implementation-reviewer'
  | 'task-end-reviewer'
  | 'implementer'
  | 'architect'
  | 'scrum-master'
  | 'product-owner';

export type WorkflowGateEvent = {
  kind: 'workflow_gate_event';
  gate: 'gate-1' | 'gate-2' | 'gate-3' | 'backlog-gate';
  action: 'verdict' | 'go' | 'no-go' | 'baton' | 'po-act';
  originTag?: WorkflowOrigin;
  fromAgentId?: string;
  fromRole: WorkflowRole;
  toAgentId?: string;
  toRole?: WorkflowRole;
  taskId?: string;
  eventId: string;
};

export type RelayApprovalMode = 'off' | 'approve_each';

export type PendingRelayStatus =
  | 'pending'
  | 'approved_delivered'
  | 'denied'
  | 'delivery_failed';

export interface PendingRelay {
  id: string;
  status: PendingRelayStatus;
  fromAgentId: string;
  toAgentId: string;
  payload: unknown;
  replyToMessageId?: string;
  baton?: WorkflowBatonMetadata;
  workflowEvent?: WorkflowGateEvent;
  createdAt: string;
  decidedAt?: string;
  deliveredAt?: string;
  deliveryError?: string;
}
