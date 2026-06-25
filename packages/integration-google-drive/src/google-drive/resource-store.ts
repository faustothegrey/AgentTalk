import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { GoogleDriveGrant, GoogleDriveResource } from './types.js';

interface PersistedDriveStore {
  resources: GoogleDriveResource[];
  grants: GoogleDriveGrant[];
}

export class GoogleDriveResourceStore {
  private resources = new Map<string, GoogleDriveResource>();
  private grants = new Map<string, GoogleDriveGrant>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  listResources(): GoogleDriveResource[] {
    return Array.from(this.resources.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  createResource(input: { name: string; type: 'file' | 'folder'; driveId: string }): GoogleDriveResource {
    const duplicate = Array.from(this.resources.values()).find((resource) => resource.driveId === input.driveId);
    if (duplicate) {
      return duplicate;
    }

    const now = new Date().toISOString();
    const resource: GoogleDriveResource = {
      id: randomUUID(),
      name: input.name,
      type: input.type,
      driveId: input.driveId,
      createdAt: now,
      updatedAt: now,
    };

    this.resources.set(resource.id, resource);
    this.persist();
    return resource;
  }

  getResource(resourceId: string): GoogleDriveResource {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Drive resource ${resourceId} not found`);
    }
    return resource;
  }

  grantAgentAccess(resourceId: string, agentId: string): GoogleDriveGrant {
    this.getResource(resourceId);

    const key = this.grantKey(resourceId, agentId);
    const existing = this.grants.get(key);
    if (existing) {
      return existing;
    }

    const grant: GoogleDriveGrant = {
      resourceId,
      agentId,
      createdAt: new Date().toISOString(),
    };

    this.grants.set(key, grant);
    this.persist();
    return grant;
  }

  revokeAgentAccess(resourceId: string, agentId: string): boolean {
    const deleted = this.grants.delete(this.grantKey(resourceId, agentId));
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  listAgentResources(agentId: string): GoogleDriveResource[] {
    const ids = new Set(
      Array.from(this.grants.values())
        .filter((grant) => grant.agentId === agentId)
        .map((grant) => grant.resourceId),
    );

    return this.listResources().filter((resource) => ids.has(resource.id));
  }

  assertAgentAccess(resourceId: string, agentId: string): GoogleDriveResource {
    const resource = this.getResource(resourceId);
    if (!this.grants.has(this.grantKey(resourceId, agentId))) {
      throw new Error(`Agent ${agentId} does not have access to drive resource ${resourceId}`);
    }
    return resource;
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedDriveStore;
      for (const resource of parsed.resources ?? []) {
        if (resource && typeof resource.id === 'string') {
          this.resources.set(resource.id, resource);
        }
      }

      for (const grant of parsed.grants ?? []) {
        if (grant && typeof grant.resourceId === 'string' && typeof grant.agentId === 'string') {
          this.grants.set(this.grantKey(grant.resourceId, grant.agentId), grant);
        }
      }
    } catch (err) {
      console.error('[GoogleDriveResourceStore] Failed to load persisted state:', err);
    }
  }

  private persist(): void {
    const directory = path.dirname(this.filePath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    const payload: PersistedDriveStore = {
      resources: Array.from(this.resources.values()),
      grants: Array.from(this.grants.values()),
    };

    writeFileSync(this.filePath, JSON.stringify(payload, null, 2));
  }

  private grantKey(resourceId: string, agentId: string): string {
    return `${resourceId}:${agentId}`;
  }
}
