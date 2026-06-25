import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { GoogleDriveResourceStore } from '@agenttalk/integration-google-drive/google-drive/resource-store';

const STORE_PATH = './test-google-drive/store.json';

describe('GoogleDriveResourceStore', () => {
  afterEach(() => {
    if (existsSync('./test-google-drive')) {
      rmSync('./test-google-drive', { recursive: true, force: true });
    }
  });

  it('should persist resources and grants across reloads', () => {
    const store = new GoogleDriveResourceStore(STORE_PATH);
    const resource = store.createResource({
      name: 'Specs',
      type: 'folder',
      driveId: 'folder-123',
    });
    store.grantAgentAccess(resource.id, 'agent-1');

    const reloaded = new GoogleDriveResourceStore(STORE_PATH);
    expect(reloaded.listResources()).toEqual([
      expect.objectContaining({
        id: resource.id,
        name: 'Specs',
        driveId: 'folder-123',
      }),
    ]);
    expect(reloaded.listAgentResources('agent-1')).toEqual([
      expect.objectContaining({ id: resource.id }),
    ]);
  });
});
