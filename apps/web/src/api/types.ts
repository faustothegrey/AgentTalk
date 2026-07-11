import type {
  AgentExecutionMode,
  Conversation,
  PendingRelay,
  RelayApprovalMode,
  Team,
  TeamComposition,
  TeamMember,
  TeamTask,
  TranscriptEntry,
} from '@agenttalk/contracts/types';

export type { Conversation, PendingRelay, RelayApprovalMode, Team, TeamComposition, TeamMember, TeamTask, TranscriptEntry };

export const theme = {
  bg:          '#1e1e1e',
  bgRaised:    '#252526',
  bgSurface:   '#2d2d2d',
  bgActive:    '#3a3d49',
  border:      '#333',
  borderLight: '#444',
  borderInput: '#3b3b3b',
  textPrimary: '#ddd',
  textSecondary: '#ccc',
  textMuted:   '#888',
  textDim:     '#666',
  textBright:  '#fff',
  textSubtle:  '#aaa',
  success:     '#4caf50',
  error:       '#ef4444',
} as const;

export type Provider = 'claude' | 'gemini' | 'codex';
export type ExecutionMode = AgentExecutionMode;
export type TopLevelTab = 'chat' | 'team' | 'agents' | 'usage' | 'drive' | 'scheduler' | 'planning';

export interface Agent {
  id: string;
  status: string;
  usage?: { total: number; limit: number };
  usageStats?: { stats: string; timestamp: string };
  provider?: string;
  model?: string;
  requestedExecutionMode?: ExecutionMode;
  resolvedExecutionMode?: Exclude<ExecutionMode, 'auto'>;
  sessionStatus?: 'starting' | 'ready' | 'busy' | 'reconnecting' | 'error';
}

export interface StandaloneUsageCapture {
  provider: Provider;
  model: string;
  usageStats: { stats: string; timestamp: string };
}

export interface SidebarEventEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  label: string;
  detail: string;
}

export interface GoogleDriveStatus {
  configured: boolean;
  authenticated: boolean;
  redirectUri?: string;
  scopes: string[];
  hasRefreshToken: boolean;
}

export interface GoogleDriveResource {
  id: string;
  name: string;
  type: 'file' | 'folder';
  driveId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleDriveFileEntry {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export interface GoogleDriveReadResult {
  file: GoogleDriveFileEntry;
  text: string;
}

export interface SchedulerJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  intervalSeconds: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
