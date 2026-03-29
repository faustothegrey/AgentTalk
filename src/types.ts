export type AgentStatus = 'creating' | 'starting' | 'ready' | 'busy' | 'error' | 'terminated';

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
