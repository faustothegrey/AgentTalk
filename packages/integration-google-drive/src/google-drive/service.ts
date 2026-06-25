import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { GoogleDriveResourceStore } from './resource-store.js';
import type {
  GoogleDriveAuthStatus,
  GoogleDriveFileEntry,
  GoogleDriveGrant,
  GoogleDriveIntegration,
  GoogleDriveReadResult,
  GoogleDriveResource,
} from './types.js';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

interface GoogleDriveCredentials {
  clientId: string;
  clientSecret: string;
}

interface GoogleDriveServiceOptions {
  credentialsPath?: string;
  tokenPath?: string;
  resourceStorePath?: string;
}

function ensureNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseCredentials(raw: string): GoogleDriveCredentials {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const block = (parsed.web ?? parsed.installed) as Record<string, unknown> | undefined;

  const clientId = ensureNonEmptyString(block?.client_id);
  const clientSecret = ensureNonEmptyString(block?.client_secret);
  if (!clientId || !clientSecret) {
    throw new Error('Google Drive credentials file must contain client_id and client_secret in the web or installed block');
  }

  return { clientId, clientSecret };
}

export class GoogleDriveService implements GoogleDriveIntegration {
  private readonly credentialsPath: string | undefined;
  private readonly tokenPath: string;
  private readonly resourceStore: GoogleDriveResourceStore;
  private readonly scopes = [DRIVE_READONLY_SCOPE];
  private readonly oauthStates = new Map<string, number>();

  constructor(options: GoogleDriveServiceOptions = {}) {
    this.credentialsPath = options.credentialsPath ?? process.env.GOOGLE_DRIVE_CREDENTIALS_PATH ?? './credentials.json';
    this.tokenPath = options.tokenPath ?? process.env.GOOGLE_DRIVE_TOKEN_PATH ?? './transcripts/google-drive-token.json';
    this.resourceStore = new GoogleDriveResourceStore(
      options.resourceStorePath ?? process.env.GOOGLE_DRIVE_RESOURCE_STORE_PATH ?? './transcripts/google-drive-resources.json',
    );
  }

  async getStatus(baseUrl?: string): Promise<GoogleDriveAuthStatus> {
    const configured = Boolean(this.credentialsPath && existsSync(this.credentialsPath));
    const token = this.loadToken();

    const status: GoogleDriveAuthStatus = {
      configured,
      authenticated: configured && Boolean(token),
      scopes: this.scopes,
      hasRefreshToken: Boolean(token?.refresh_token),
    };

    if (configured && baseUrl) {
      status.redirectUri = this.buildRedirectUri(baseUrl);
    }

    return status;
  }

  async createAuthUrl(baseUrl: string): Promise<string> {
    const oauth = this.createOAuthClient(baseUrl);
    const state = randomUUID();
    this.oauthStates.set(state, Date.now());
    this.pruneExpiredStates();

    return oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: this.scopes,
      state,
    });
  }

  async handleOAuthCallback(code: string, baseUrl: string): Promise<void> {
    const oauth = this.createOAuthClient(baseUrl);
    const { tokens } = await oauth.getToken(code);
    const existing = this.loadToken();
    const nextTokens = {
      ...existing,
      ...tokens,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token,
    };
    this.persistToken(nextTokens);
  }

  listResources(): GoogleDriveResource[] {
    return this.resourceStore.listResources();
  }

  createResource(input: { name: string; type: 'file' | 'folder'; driveId: string }): GoogleDriveResource {
    return this.resourceStore.createResource(input);
  }

  grantAgentAccess(resourceId: string, agentId: string): GoogleDriveGrant {
    return this.resourceStore.grantAgentAccess(resourceId, agentId);
  }

  revokeAgentAccess(resourceId: string, agentId: string): boolean {
    return this.resourceStore.revokeAgentAccess(resourceId, agentId);
  }

  listAgentResources(agentId: string): GoogleDriveResource[] {
    return this.resourceStore.listAgentResources(agentId);
  }

  async listFilesForAgent(agentId: string, resourceId: string): Promise<GoogleDriveFileEntry[]> {
    const resource = this.resourceStore.assertAgentAccess(resourceId, agentId);
    if (resource.type === 'file') {
      const metadata = await this.getFileMetadata(resource.driveId);
      return [metadata];
    }

    const drive = await this.createDriveClient();
    const response = await drive.files.list({
      q: `'${resource.driveId}' in parents and trashed = false`,
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size)',
      orderBy: 'modifiedTime desc,name',
    });

    return (response.data.files ?? [])
      .map((file) => this.toFileEntry({
        id: file.id ?? '',
        name: file.name ?? 'Untitled',
        mimeType: file.mimeType ?? undefined,
        webViewLink: file.webViewLink ?? undefined,
        modifiedTime: file.modifiedTime ?? undefined,
        size: file.size ?? undefined,
      }))
      .filter((file) => file.id);
  }

  async readFileForAgent(agentId: string, resourceId: string, fileId?: string): Promise<GoogleDriveReadResult> {
    const resource = this.resourceStore.assertAgentAccess(resourceId, agentId);
    const targetFileId = await this.resolveReadableFileId(resource, fileId);
    const file = await this.getFileMetadata(targetFileId);
    const drive = await this.createDriveClient();

    let text: string;
    if (file.mimeType === GOOGLE_DOC_MIME) {
      const response = await drive.files.export(
        {
          fileId: targetFileId,
          mimeType: 'text/plain',
        },
        { responseType: 'arraybuffer' },
      );
      text = Buffer.from(response.data as ArrayBuffer).toString('utf8');
    } else if (file.mimeType?.startsWith('text/') || file.mimeType === 'application/json') {
      const response = await drive.files.get(
        {
          fileId: targetFileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'arraybuffer' },
      );
      text = Buffer.from(response.data as ArrayBuffer).toString('utf8');
    } else {
      throw new Error(`Unsupported Drive file type for text read: ${file.mimeType ?? 'unknown'}`);
    }

    return { file, text };
  }

  assertValidOAuthState(state: string): void {
    const createdAt = this.oauthStates.get(state);
    if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
      throw new Error('Invalid or expired OAuth state');
    }
    this.oauthStates.delete(state);
  }

  private async resolveReadableFileId(resource: GoogleDriveResource, fileId?: string): Promise<string> {
    if (resource.type === 'file') {
      return resource.driveId;
    }

    if (!fileId) {
      throw new Error('fileId is required when reading from a folder resource');
    }

    const drive = await this.createDriveClient();
    const response = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'parents',
    } as any);
    const parents = (response.data.parents ?? []) as string[];
    if (!parents.includes(resource.driveId)) {
      throw new Error(`Drive file ${fileId} is not inside allowed folder ${resource.driveId}`);
    }

    return fileId;
  }

  private async getFileMetadata(fileId: string): Promise<GoogleDriveFileEntry> {
    const drive = await this.createDriveClient();
    const response = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id,name,mimeType,webViewLink,modifiedTime,size',
    } as any);

    return this.toFileEntry({
      id: response.data.id ?? fileId,
      name: response.data.name ?? 'Untitled',
      mimeType: response.data.mimeType ?? undefined,
      webViewLink: response.data.webViewLink ?? undefined,
      modifiedTime: response.data.modifiedTime ?? undefined,
      size: response.data.size ?? undefined,
    });
  }

  private async createDriveClient() {
    const oauth = this.createOAuthClient(process.env.GOOGLE_DRIVE_REDIRECT_BASE_URL ?? 'http://127.0.0.1');
    const token = this.loadToken();
    if (!token) {
      throw new Error('Google Drive is not authenticated yet');
    }

    oauth.setCredentials(token);
    return google.drive({ version: 'v3', auth: oauth });
  }

  private createOAuthClient(baseUrl: string) {
    if (!this.credentialsPath || !existsSync(this.credentialsPath)) {
      throw new Error(`Google Drive credentials are not configured. Expected OAuth client JSON at ${this.credentialsPath}.`);
    }

    const credentials = parseCredentials(readFileSync(this.credentialsPath, 'utf8'));
    return new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      this.buildRedirectUri(baseUrl),
    );
  }

  private buildRedirectUri(baseUrl: string): string {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    return `${normalizedBase}/api/integrations/google-drive/oauth/callback`;
  }

  private loadToken(): Record<string, unknown> | undefined {
    if (!existsSync(this.tokenPath)) {
      return undefined;
    }

    try {
      const raw = readFileSync(this.tokenPath, 'utf8');
      if (!raw.trim()) {
        return undefined;
      }
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      console.error('[GoogleDriveService] Failed to load OAuth token:', err);
      return undefined;
    }
  }

  private persistToken(token: Record<string, unknown>): void {
    const directory = path.dirname(this.tokenPath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    writeFileSync(this.tokenPath, JSON.stringify(token, null, 2));
  }

  private pruneExpiredStates(): void {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [state, createdAt] of this.oauthStates) {
      if (createdAt < cutoff) {
        this.oauthStates.delete(state);
      }
    }
  }

  private toFileEntry(input: {
    id: string;
    name: string;
    mimeType: string | undefined;
    webViewLink: string | undefined;
    modifiedTime: string | undefined;
    size: string | undefined;
  }): GoogleDriveFileEntry {
    const entry: GoogleDriveFileEntry = {
      id: input.id,
      name: input.name,
    };

    if (input.mimeType) {
      entry.mimeType = input.mimeType;
    }
    if (input.webViewLink) {
      entry.webViewLink = input.webViewLink;
    }
    if (input.modifiedTime) {
      entry.modifiedTime = input.modifiedTime;
    }
    if (input.size) {
      entry.size = input.size;
    }

    return entry;
  }
}
