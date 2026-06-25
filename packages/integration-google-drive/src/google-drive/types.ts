export interface GoogleDriveAuthStatus {
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

export interface GoogleDriveGrant {
  agentId: string;
  resourceId: string;
  createdAt: string;
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

export interface GoogleDriveIntegration {
  getStatus(baseUrl?: string): Promise<GoogleDriveAuthStatus> | GoogleDriveAuthStatus;
  createAuthUrl(baseUrl: string): Promise<string> | string;
  handleOAuthCallback(code: string, baseUrl: string): Promise<void>;
  listResources(): GoogleDriveResource[];
  createResource(input: { name: string; type: 'file' | 'folder'; driveId: string }): GoogleDriveResource;
  grantAgentAccess(resourceId: string, agentId: string): GoogleDriveGrant;
  revokeAgentAccess(resourceId: string, agentId: string): boolean;
  listAgentResources(agentId: string): GoogleDriveResource[];
  listFilesForAgent(agentId: string, resourceId: string): Promise<GoogleDriveFileEntry[]>;
  readFileForAgent(agentId: string, resourceId: string, fileId?: string): Promise<GoogleDriveReadResult>;
}
