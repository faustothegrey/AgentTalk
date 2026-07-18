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
