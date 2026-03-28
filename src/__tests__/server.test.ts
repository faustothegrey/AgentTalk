import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { WebSocket } from 'ws';
import { Registry } from '../registry.js';
import { startServer } from '../server.js';
import type { CmuxAdapter } from '../cmux-adapter.js';

describe('startServer', () => {
  let adapter: CmuxAdapter;
  let registry: Registry;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    let nextRef = 1;
    adapter = {
      createPane: vi.fn().mockImplementation(async () => {
        const ref = nextRef++;
        return {
          workspaceRef: `workspace:${ref}`,
          paneRef: `pane:${ref}`,
          surfaceRef: `surface:${ref}`,
        };
      }),
      sendText: vi.fn().mockResolvedValue(undefined),
      readSurface: vi.fn().mockResolvedValue({ text: '', raw: '' }),
      notify: vi.fn().mockResolvedValue(undefined),
    };

    registry = new Registry(adapter, {
      pollIntervalMs: 100,
      readinessTimeoutMs: 500,
      maxConsecutiveFailures: 2,
    });

    server = startServer(registry, adapter, 0);
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
  });

  it('should reject invalid splitDirection values', async () => {
    const response = await fetch(`${baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitDirection: 'left' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'splitDirection must be "right" or "down"',
    });
  });

  it('should reject start requests without a command', async () => {
    await registry.createAgent('agent-1', 'right');

    const response = await fetch(`${baseUrl}/api/agents/agent-1/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'command is required' });
    expect(adapter.sendText).not.toHaveBeenCalled();
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
    await registry.createAgent('agent-1', 'right');

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
});
