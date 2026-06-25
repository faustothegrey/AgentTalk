import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { WebSocket } from 'ws';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { startServer } from '../server.js';
import type { GoogleDriveIntegration, GoogleDriveResource } from '@agenttalk/integration-google-drive/google-drive/types';

describe('startServer', () => {
  let registry: Registry;
  let server: Server;
  let baseUrl: string;
  let googleDrive: GoogleDriveIntegration;
  const conversationStorePath = './test-transcripts-server/conversations.json';
  const grantedResource: GoogleDriveResource = {
    id: 'resource-1',
    name: 'Specs',
    type: 'folder',
    driveId: 'folder-123',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    registry = new Registry({
      readinessTimeoutMs: 500,
      conversationStorePath,
    });

    googleDrive = {
      getStatus: vi.fn().mockResolvedValue({
        configured: true,
        authenticated: false,
        redirectUri: 'http://127.0.0.1/oauth/callback',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        hasRefreshToken: false,
      }),
      createAuthUrl: vi.fn().mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?state=test'),
      handleOAuthCallback: vi.fn().mockResolvedValue(undefined),
      listResources: vi.fn().mockReturnValue([grantedResource]),
      createResource: vi.fn().mockImplementation(({ name, type, driveId }) => ({
        ...grantedResource,
        name,
        type,
        driveId,
      })),
      grantAgentAccess: vi.fn().mockReturnValue({
        resourceId: grantedResource.id,
        agentId: 'agent-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      revokeAgentAccess: vi.fn().mockReturnValue(true),
      listAgentResources: vi.fn().mockReturnValue([grantedResource]),
      listFilesForAgent: vi.fn().mockResolvedValue([
        { id: 'file-1', name: 'Spec Doc', mimeType: 'application/vnd.google-apps.document' },
      ]),
      readFileForAgent: vi.fn().mockResolvedValue({
        file: { id: 'file-1', name: 'Spec Doc', mimeType: 'application/vnd.google-apps.document' },
        text: 'Hello Drive',
      }),
    };

    server = startServer(registry, 0, { googleDrive });
    await new Promise<void>((resolve) => server.once('listening', resolve));

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await registry.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    vi.restoreAllMocks();

    if (existsSync('./test-transcripts-server')) {
      rmSync('./test-transcripts-server', { recursive: true, force: true });
    }
  });


  it('should return 404 when starting an unknown agent', async () => {
    const response = await fetch(`${baseUrl}/api/agents/missing/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'agent-mcp' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Agent missing not found' });
  });




  it('should activate an agent with provider/model metadata', async () => {
    await registry.createAgent('agent-1');

    const response = await fetch(`${baseUrl}/api/agents/agent-1/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'claude',
        model: 'sonnet',
        executionMode: 'persistent',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

  });

  it('should return 409 when creating a duplicate agent', async () => {
    await registry.createAgent('agent-1');

    const response = await fetch(`${baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'agent-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Agent agent-1 already exists' });
  });

  it('should include execution mode metadata when creating and listing agents', async () => {
    const createResponse = await fetch(`${baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'agent-mode', executionMode: 'interactive' }),
    });

    expect(createResponse.status).toBe(200);
    await expect(createResponse.json()).resolves.toMatchObject({
      id: 'agent-mode',
      status: 'creating',
      requestedExecutionMode: 'interactive',
    });

    const listResponse = await fetch(`${baseUrl}/api/agents`);
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'agent-mode',
        requestedExecutionMode: 'interactive',
      }),
    ]);
  });

  it('should create, update, list, and delete scheduler jobs', async () => {
    await registry.createAgent('agent-1');

    const createResponse = await fetch(`${baseUrl}/api/scheduler/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Heartbeat',
        agentId: 'agent-1',
        prompt: 'Send a short status update.',
        intervalSeconds: 5,
      }),
    });

    expect(createResponse.status).toBe(200);
    const created = await createResponse.json() as { id: string; enabled: boolean };
    expect(created.enabled).toBe(true);
    expect(created.id).toMatch(/^job-/);

    const listResponse = await fetch(`${baseUrl}/api/scheduler/jobs`);
    expect(listResponse.status).toBe(200);
    const jobs = await listResponse.json() as Array<{ id: string; enabled: boolean }>;
    expect(jobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));

    const updateResponse = await fetch(`${baseUrl}/api/scheduler/jobs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual(expect.objectContaining({ id: created.id, enabled: false }));

    const deleteResponse = await fetch(`${baseUrl}/api/scheduler/jobs/${created.id}`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ success: true });
  });

  it('should accept websocket connections on /ws and ignore input for unattached clients', async () => {
    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    socket.send(JSON.stringify({ type: 'input', text: 'hello' }));
    await new Promise((resolve) => setTimeout(resolve, 25));


    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should replay message history when attaching to an agent', async () => {
    await registry.createAgent('agent-1');

    registry.emit('user_message', { from: 'agent-1', payload: 'hello\nworld' });

    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const historyMessage = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for message_history')), 1000);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'message_history') {
          clearTimeout(timeout);
          resolve(message);
        }
      });
      socket.once('error', reject);
    });

    socket.send(JSON.stringify({ type: 'attach', agentId: 'agent-1' }));

    await expect(historyMessage).resolves.toEqual({
      type: 'message_history',
      agentId: 'agent-1',
      events: [
        { type: 'agent_message', payload: 'hello\nworld' },
      ],
    });

    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should expose persisted conversations via the api', async () => {
    const agent1 = await registry.createAgent('agent-1');
    const agent2 = await registry.createAgent('agent-2');
    agent1.setStatus('starting');
    agent1.setStatus('ready');
    agent2.setStatus('starting');
    agent2.setStatus('ready');

    vi.spyOn(registry as any, 'requestHealthCheck').mockResolvedValue({
      agentId: 'agent-1',
      message: 'hello',
    });

    await registry.startConversation(
      ['agent-1', 'agent-2'],
      'Discuss the current AgentTalk project.',
      5,
    );

    const response = await fetch(`${baseUrl}/api/conversations`);
    expect(response.status).toBe(200);

    const conversations = await response.json();
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      agentIds: ['agent-1', 'agent-2'],
      status: 'active',
      maxRepliesPerAgent: 5,
    });
  });

  it('should remove an agent via the DELETE /api/agents/:id endpoint', async () => {
    await registry.createAgent('agent-1');
    const removeSpy = vi.spyOn(registry, 'removeAgent');

    const response = await fetch(`${baseUrl}/api/agents/agent-1`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(removeSpy).toHaveBeenCalledWith('agent-1');
  });

  it('should create a worker-only team from the raw team form payload', async () => {
    const worker = await registry.createAgent('worker-1');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const response = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamComposition: 'worker-only',
        teamPlannerAgent: '',
        teamWorkerAgent: 'worker-1',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'idle',
      members: [
        { agentId: 'worker-1', role: 'worker' },
      ],
    });
  });

  it('should create a 2-planners + 1-worker team from raw team form fields', async () => {
    const plannerA = await registry.createAgent('planner-a');
    const plannerB = await registry.createAgent('planner-b');
    const worker = await registry.createAgent('worker-1');
    plannerA.setStatus('starting');
    plannerA.setStatus('ready');
    plannerB.setStatus('starting');
    plannerB.setStatus('ready');
    worker.setStatus('starting');
    worker.setStatus('ready');

    const response = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamComposition: 'planner-planner-worker',
        teamPlannerAgent: 'planner-a',
        teamPlannerAgentB: 'planner-b',
        teamWorkerAgent: 'worker-1',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      composition: 'planner-planner-worker',
      status: 'idle',
      members: [
        { agentId: 'planner-a', role: 'planner' },
        { agentId: 'planner-b', role: 'planner' },
        { agentId: 'worker-1', role: 'worker' },
      ],
    });
  });

  it('should expose google drive oauth status', async () => {
    const response = await fetch(`${baseUrl}/api/integrations/google-drive/status`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      configured: true,
      authenticated: false,
    });
  });

  it('should create drive resources, grant an existing agent, and read allowed content', async () => {
    await registry.createAgent('agent-1');

    const createResourceResponse = await fetch(`${baseUrl}/api/integrations/google-drive/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Specs',
        type: 'folder',
        driveId: 'folder-123',
      }),
    });
    expect(createResourceResponse.status).toBe(200);
    await expect(createResourceResponse.json()).resolves.toMatchObject({
      id: grantedResource.id,
      name: 'Specs',
    });

    const grantResponse = await fetch(`${baseUrl}/api/integrations/google-drive/resources/${grantedResource.id}/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent-1' }),
    });
    expect(grantResponse.status).toBe(200);
    await expect(grantResponse.json()).resolves.toMatchObject({
      agentId: 'agent-1',
      resourceId: grantedResource.id,
    });

    const listFilesResponse = await fetch(`${baseUrl}/api/integrations/google-drive/resources/${grantedResource.id}/files?agentId=agent-1`);
    expect(listFilesResponse.status).toBe(200);
    await expect(listFilesResponse.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'file-1',
        name: 'Spec Doc',
      }),
    ]);

    const readResponse = await fetch(`${baseUrl}/api/integrations/google-drive/resources/${grantedResource.id}/read?agentId=agent-1&fileId=file-1`);
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      text: 'Hello Drive',
      file: {
        id: 'file-1',
        name: 'Spec Doc',
      },
    });
  });
});
