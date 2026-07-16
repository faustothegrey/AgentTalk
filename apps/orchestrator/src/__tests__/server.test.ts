import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { WebSocket } from 'ws';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { startServer } from '../server.js';
import type { GoogleDriveIntegration, GoogleDriveResource } from '@agenttalk/integration-google-drive/google-drive/types';
import type { SessionRecorder } from '@agenttalk/observability/recordings/session-recorder';

describe('startServer', () => {
  let registry: Registry;
  let server: Server;
  let baseUrl: string;
  let googleDrive: GoogleDriveIntegration;
  let recorder: { record: ReturnType<typeof vi.fn> };
  let sockets: WebSocket[];
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

    recorder = { record: vi.fn() };
    sockets = [];
    server = startServer(registry, 0, { googleDrive, recorder: recorder as unknown as SessionRecorder });
    await new Promise<void>((resolve) => server.once('listening', resolve));

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    await registry.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    vi.restoreAllMocks();

    if (existsSync('./test-transcripts-server')) {
      rmSync('./test-transcripts-server', { recursive: true, force: true });
    }
  });

  async function openSocket(): Promise<WebSocket> {
    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return socket;
  }

  function waitForMessage(socket: WebSocket, predicate: (message: any) => boolean, timeoutMs = 1000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('message', onMessage);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, timeoutMs);

      const onMessage = (raw: Buffer) => {
        const message = JSON.parse(raw.toString());
        if (!predicate(message)) return;
        clearTimeout(timeout);
        socket.off('message', onMessage);
        resolve(message);
      };

      socket.on('message', onMessage);
      socket.once('error', reject);
    });
  }

  async function openSocketWithMessage(predicate: (message: any) => boolean): Promise<{ socket: WebSocket; message: any }> {
    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    sockets.push(socket);
    const messagePromise = waitForMessage(socket, predicate);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const message = await messagePromise;
    return { socket, message };
  }

  async function createReadyAgent(id: string) {
    const agent = await registry.createAgent(id, { provider: 'api' });
    agent.setStatus('starting');
    agent.setStatus('ready');
    return agent;
  }

  async function createPendingRelay(payload: string) {
    await createReadyAgent('agent-1');
    await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');
    await registry.handleMcpToolCall('agent-1', 'send_to_agent', {
      to: 'agent-2',
      payload,
      baton: {
        kind: 'workflow_baton',
        originTag: '[PO]',
        fromRole: 'planner',
        toRole: 'implementer',
        batonId: 'baton-server-test',
      },
    });
    return registry.listPendingRelays()[0]!;
  }


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

  it('should ping /ws clients so a dead socket is detectable (BL-048 keepalive)', async () => {
    // Own server: the heartbeat cadence is read at startServer time, and 30s is unwaitable in a test.
    vi.stubEnv('AGENTTALK_WS_HEARTBEAT_MS', '50');
    const ownRegistry = new Registry({ readinessTimeoutMs: 500, conversationStorePath });
    const ownServer = startServer(ownRegistry, 0, { googleDrive });
    await new Promise<void>((resolve) => ownServer.once('listening', resolve));
    const { port } = ownServer.address() as AddressInfo;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });

      // Without a server-initiated ping a half-open socket is never detected: no FIN arrives, the
      // browser keeps believing it is connected, and the UI's indicator goes on claiming the backend
      // is alive. Browsers cannot ping on their own, so this is the whole detection mechanism.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('server never pinged the client')), 2000);
        socket.once('ping', () => { clearTimeout(timer); resolve(); });
      });
    } finally {
      // Close the client BEFORE the server: server.close() waits for open connections to end rather
      // than cutting them, so leaving this socket up hangs the teardown.
      socket.close();
      await new Promise<void>((resolve) => socket.once('close', () => resolve()));
      await ownRegistry.destroy();
      await new Promise<void>((resolve, reject) => ownServer.close((err) => (err ? reject(err) : resolve())));
      vi.unstubAllEnvs();
    }
  });

  it('should broadcast agent_added when an agent is created through the API (BL-048)', async () => {
    const socket = await openSocket();
    const added = waitForMessage(socket, message => message.type === 'agent_added');

    const res = await fetch(`${baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'external-agent-1', provider: 'claude', model: 'sonnet' }),
    });
    expect(res.status).toBe(200);

    const message = await added;
    expect(message.agent.id).toBe('external-agent-1');
    expect(message.agent.status).toBe('creating');
    // Guards the reason this broadcast lives in the route and not in registry.createAgent():
    // provider/model are assigned to the agent after createAgent() returns, so emitting from
    // inside the registry would ship them as undefined and the UI row would render blank.
    expect(message.agent.provider).toBe('claude');
    expect(message.agent.model).toBe('sonnet');
  });

  it('should accept websocket connections on /ws and ignore input for unattached clients', async () => {
    const socket = await openSocket();

    socket.send(JSON.stringify({ type: 'input', text: 'hello' }));
    await new Promise((resolve) => setTimeout(resolve, 25));


    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should replay message history when attaching to an agent', async () => {
    await registry.createAgent('agent-1');

    registry.emit('user_message', { from: 'agent-1', payload: 'hello\nworld' });

    const socket = await openSocket();

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

  it('should send relay approval mode and pending relay snapshot on websocket connect', async () => {
    const relay = await createPendingRelay('Held before UI connects');
    const { socket, message } = await openSocketWithMessage((item) => item.type === 'relay_approval_state');

    expect(message).toMatchObject({
      type: 'relay_approval_state',
      mode: 'approve_each',
      pendingRelays: [
        expect.objectContaining({
          id: relay.id,
          status: 'pending',
          fromAgentId: 'agent-1',
          toAgentId: 'agent-2',
          payload: 'Held before UI connects',
        }),
      ],
    });

    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should update relay approval mode through websocket command and recorder event', async () => {
    const { socket } = await openSocketWithMessage((message) => message.type === 'relay_approval_state');

    socket.send(JSON.stringify({ type: 'set_relay_approval_mode', mode: 'approve_each' }));

    await expect(waitForMessage(socket, (message) => message.type === 'relay_approval_mode')).resolves.toEqual({
      type: 'relay_approval_mode',
      mode: 'approve_each',
    });
    expect(registry.getRelayApprovalMode()).toBe('approve_each');
    expect(recorder.record).toHaveBeenCalledWith('runtime', 'relay_approval_mode', { mode: 'approve_each' });

    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should approve a pending relay through websocket command and broadcast lifecycle update', async () => {
    const { socket } = await openSocketWithMessage((message) => message.type === 'relay_approval_state');
    const pendingUpdate = waitForMessage(socket, (message) => message.type === 'pending_relay_updated' && message.relay.status === 'pending');
    const relay = await createPendingRelay('Approve from UI');

    await expect(pendingUpdate).resolves.toMatchObject({
      type: 'pending_relay_updated',
      relay: {
        id: relay.id,
        status: 'pending',
      },
    });

    socket.send(JSON.stringify({ type: 'approve_pending_relay', relayId: relay.id }));

    await expect(waitForMessage(socket, (message) => message.type === 'pending_relay_updated' && message.relay.id === relay.id && message.relay.status === 'approved_delivered')).resolves.toMatchObject({
      type: 'pending_relay_updated',
      relay: {
        id: relay.id,
        status: 'approved_delivered',
      },
    });
    await expect(registry.getAgent('agent-2').awaitTurn()).resolves.toMatchObject({
      type: 'message_received',
      from: 'agent-1',
      payload: 'Approve from UI',
    });
    expect(recorder.record).toHaveBeenCalledWith('runtime', 'pending_relay_updated', {
      relay: expect.objectContaining({ id: relay.id, status: 'approved_delivered' }),
    });

    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should deny a pending relay through websocket command without target delivery', async () => {
    const { socket } = await openSocketWithMessage((message) => message.type === 'relay_approval_state');
    const pendingUpdate = waitForMessage(socket, (message) => message.type === 'pending_relay_updated' && message.relay.status === 'pending');
    const relay = await createPendingRelay('Deny from UI');
    await pendingUpdate;

    socket.send(JSON.stringify({ type: 'deny_pending_relay', relayId: relay.id }));

    await expect(waitForMessage(socket, (message) => message.type === 'pending_relay_updated' && message.relay.id === relay.id && message.relay.status === 'denied')).resolves.toMatchObject({
      type: 'pending_relay_updated',
      relay: {
        id: relay.id,
        status: 'denied',
      },
    });
    const outcome = await Promise.race([
      registry.getAgent('agent-2').awaitTurn().then(() => 'delivered'),
      new Promise((resolve) => setTimeout(() => resolve('not-delivered'), 25)),
    ]);
    expect(outcome).toBe('not-delivered');

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

  it('should forward consensusMode:arbiter through the team form (BL-037 wall 1)', async () => {
    for (const id of ['planner-a', 'planner-b', 'worker-1']) {
      const a = await registry.createAgent(id);
      a.setStatus('starting');
      a.setStatus('ready');
    }
    const arbiterRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        members: [
          { agentId: 'planner-a', role: 'planner' },
          { agentId: 'planner-b', role: 'planner' },
          { agentId: 'worker-1', role: 'worker' },
        ],
        consensusMode: 'arbiter',
      }),
    });
    expect(arbiterRes.status).toBe(200);
    await expect(arbiterRes.json()).resolves.toMatchObject({ consensusMode: 'arbiter' });
  });

  it('should default consensusMode to protocol when not specified', async () => {
    const worker = await registry.createAgent('worker-1');
    worker.setStatus('starting');
    worker.setStatus('ready');
    const res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamComposition: 'worker-only', teamWorkerAgent: 'worker-1' }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ consensusMode: 'protocol' });
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
