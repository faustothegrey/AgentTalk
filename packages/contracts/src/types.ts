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
export type AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex';

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
