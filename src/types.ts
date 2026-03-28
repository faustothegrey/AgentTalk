export type AgentStatus = 'creating' | 'starting' | 'ready' | 'busy' | 'error' | 'terminated';

export interface AgentSurface {
  workspaceRef: string;        // e.g. workspace:2
  paneRef: string;             // e.g. pane:4
  surfaceRef: string;          // e.g. surface:6
  browserSurfaceRef?: string;  // optional associated browser surface
}

export interface SurfaceReadResult {
  text: string;
  raw: string;
  cursor?: string;
}

export interface CreatePaneResult {
  workspaceRef: string;
  paneRef: string;
  surfaceRef: string;
}

export interface ProtocolPacket {
  id: string;
  type: 'REQ' | 'RES' | 'EVT' | 'READY';
  payload: any;
}

export interface ScenarioTranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
}

export interface ConversationScenario {
  id: string;
  agentAId: string;
  agentBId: string;
  topic: string;
  maxRepliesPerAgent: number;
  replyCounts: Record<string, number>;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  transcript: ScenarioTranscriptEntry[];
}
