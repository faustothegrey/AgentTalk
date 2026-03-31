import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { WebSocket } from 'ws';
import { Registry } from '../registry.js';
import { startServer } from '../server.js';
import type { ProcessAdapter } from '../agents/process-adapter.js';

describe('startServer', () => {
  let adapter: ProcessAdapter;
  let registry: Registry;
  let server: Server;
  let baseUrl: string;
  const conversationStorePath = './test-transcripts-server/conversations.json';

  beforeEach(async () => {
    adapter = {
      spawn: vi.fn(),
      sendText: vi.fn(),
      onData: vi.fn(),
      kill: vi.fn(),
      onExit: vi.fn(),
    };

    registry = new Registry(adapter, {
      readinessTimeoutMs: 500,
      conversationStorePath,
    });

    server = startServer(registry, 0);
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

  it('should reject start requests without a command', async () => {
    await registry.createAgent('agent-1');

    const response = await fetch(`${baseUrl}/api/agents/agent-1/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'command is required' });
    expect(adapter.spawn).not.toHaveBeenCalled();
  });

  it('should return 404 when starting an unknown agent', async () => {
    const response = await fetch(`${baseUrl}/api/agents/missing/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'agent-cli' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Agent missing not found' });
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

  it('should accept websocket connections on /ws and ignore input for unattached clients', async () => {
    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    socket.send(JSON.stringify({ type: 'input', text: 'hello' }));
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(adapter.sendText).not.toHaveBeenCalled();

    socket.close();
    await new Promise<void>((resolve) => socket.once('close', () => resolve()));
  });

  it('should replay terminal history when attaching to an agent', async () => {
    await registry.createAgent('agent-1');

    registry.emit('output', { id: 'agent-1', text: 'startup\r\n' });
    registry.emit('user_message', { from: 'agent-1', payload: 'hello\nworld' });

    const socket = new WebSocket(baseUrl.replace('http', 'ws') + '/ws');
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const historyMessage = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for terminal_history')), 1000);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'terminal_history') {
          clearTimeout(timeout);
          resolve(message);
        }
      });
      socket.once('error', reject);
    });

    socket.send(JSON.stringify({ type: 'attach', agentId: 'agent-1' }));

    await expect(historyMessage).resolves.toEqual({
      type: 'terminal_history',
      agentId: 'agent-1',
      events: [
        { type: 'output', text: 'startup\r\n' },
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
});
