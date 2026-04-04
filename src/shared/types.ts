export type AgentStatus = 'creating' | 'starting' | 'ready' | 'busy' | 'error' | 'terminated';
export type AgentExecutionMode = 'interactive' | 'one_shot' | 'auto';
export type ResolvedExecutionMode = Exclude<AgentExecutionMode, 'auto'>;
export type AgentSessionStatus = 'starting' | 'ready' | 'busy' | 'restarting' | 'error';

export type TeamRole = 'planner' | 'worker' | 'brainstormer';

export interface TeamMember {
  agentId: string;
  role: TeamRole;
}

export type TeamStatus = 'idle' | 'planning' | 'awaiting_confirmation' | 'working' | 'brainstorming' | 'completed' | 'interrupted' | 'error';

export type TeamComposition = 'worker-only' | 'planner-worker' | 'brainstorm';

export interface Team {
  id: string;
  composition: TeamComposition;
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
  | 'brainstorming'
  | 'refused'
  | 'completed'
  | 'interrupted';

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
  status: TeamTaskStatus;
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
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
