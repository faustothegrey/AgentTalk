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
