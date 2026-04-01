import type { Conversation, Team, TeamTask } from '../shared/types.js';

export interface SessionRecordingMeta {
  kind: 'meta';
  version: 1;
  createdAt: string;
  cwd: string;
}

export type RecordingChannel = 'api' | 'ws_in' | 'runtime';

export interface SessionRecordingEvent {
  kind: 'event';
  atMs: number;
  channel: RecordingChannel;
  event: string;
  payload: unknown;
}

export type SessionRecordingLine = SessionRecordingMeta | SessionRecordingEvent;

export interface SessionRecording {
  meta: SessionRecordingMeta;
  events: SessionRecordingEvent[];
}

export interface PlaybackAgentState {
  id: string;
  status?: string;
  sessionStatus?: string;
  provider?: string;
  model?: string;
  requestedExecutionMode?: string;
  resolvedExecutionMode?: string;
  outputs: string[];
  agentMessages: string[];
}

export interface PlaybackState {
  agents: PlaybackAgentState[];
  conversations: Conversation[];
  teams: Team[];
  teamTasks: TeamTask[];
  processedEvents: number;
}
