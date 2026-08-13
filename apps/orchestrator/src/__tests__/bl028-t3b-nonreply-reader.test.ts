import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { startServer } from '../server.js';
import type { SessionRecorder } from '@agenttalk/observability/recordings/session-recorder';
import { NonReplySink } from '@agenttalk/observability/recordings/non-reply-sink';
import type { AgentNonReplyNotice } from '@agenttalk/contracts/types';

/**
 * BL-028 T3b bar C7 — the advisory has a reader.
 *
 * The finding that put this bar in the plan: T3a emitted `agent_non_reply` and **nothing in either
 * repo listened**. A repo-wide search for the event across AgentTalk and `agentalk-mcp-client`
 * returned the type, one emit, and T3a's own test — no recorder, no UI, no coordinator. So the
 * measurement T3c's threshold is meant to be derived from was going to stdout and nowhere else.
 *
 * Both halves are asserted against the real thing rather than a spy on my own call: the recorder
 * is the same mock-recorder shape `m17-gate-recording.test.ts` uses, and the broadcast is checked
 * through an actually-connected WebSocket client. A bar that only proved "I called a function I
 * wrote" would be IP-15's shape again.
 *
 * The notice is emitted directly on the registry here, deliberately. What C7 pins is the SERVER
 * WIRING — that a notice reaching the registry's event surface is recorded and broadcast. Whether
 * the sweep produces the right notice in the first place is C1–C9's job, in the runtime-core
 * suite, and duplicating it here would couple this bar to a 30s timer for no added coverage.
 */
describe('BL-028 T3b — C7 · the non-reply advisory is recorded and broadcast', () => {
  let registry: Registry;
  let server: any;
  let recorded: any[];
  let sockets: WebSocket[];
  // BL-124 S1: the sink added there is ALWAYS ON, so this suite — which emits real notices —
  // would otherwise append test data to the live measurement at ~/.agenttalk/. Redirected to a
  // temp path; the sink is not disabled here, only pointed elsewhere.
  let sinkDir: string;
  let nonReplySink: NonReplySink;

  const notice: AgentNonReplyNotice = {
    agentId: 'silent-1',
    reason: 'awaiting-input',
    silentForMs: 210_000,
    turnId: 'turn-silent-1',
    observedAt: '2026-08-08T00:00:00.000Z',
  };

  beforeEach(async () => {
    registry = new Registry();
    recorded = [];
    sockets = [];
    const recorder = {
      record: (channel: any, event: string, payload: any) => { recorded.push({ channel, event, payload }); },
      close: async () => {},
    } as any as SessionRecorder;

    sinkDir = mkdtempSync(path.join(os.tmpdir(), 'bl028-t3b-sink-'));
    nonReplySink = new NonReplySink(path.join(sinkDir, 'agent-non-reply.jsonl'));

    server = startServer(registry, 0, { recorder, nonReplySink });
    // See server.test.ts: await the MCP bind so its env write cannot land after this test finishes.
    await server.mcpReady;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    }
    await new Promise(resolve => server.close(resolve));
    await registry.destroy();
    nonReplySink.close();
    rmSync(sinkDir, { recursive: true, force: true });
  });

  async function connectedClient(): Promise<WebSocket> {
    const { port } = server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
    return socket;
  }

  function nextMatching(socket: WebSocket, type: string, timeoutMs = 2000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off('message', onMessage);
        reject(new Error(`Timed out waiting for a '${type}' broadcast`));
      }, timeoutMs);
      const onMessage = (raw: any) => {
        const message = JSON.parse(raw.toString());
        if (message.type !== type) return;
        clearTimeout(timer);
        socket.off('message', onMessage);
        resolve(message);
      };
      socket.on('message', onMessage);
    });
  }

  it('records the notice on the runtime channel (mutation: drop the recorder.record call)', async () => {
    registry.emit('agent_non_reply', notice);

    const entries = recorded.filter(e => e.event === 'agent_non_reply');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ channel: 'runtime', event: 'agent_non_reply', payload: notice });
    // The reason and the duration are the whole point — this is T3c's threshold data.
    expect(entries[0].payload.reason).toBe('awaiting-input');
    expect(entries[0].payload.silentForMs).toBe(210_000);
  });

  it('broadcasts it to a connected client, reason and duration intact (mutation: drop the broadcast call)', async () => {
    const socket = await connectedClient();
    const received = nextMatching(socket, 'agent_non_reply');

    registry.emit('agent_non_reply', notice);

    await expect(received).resolves.toMatchObject({
      type: 'agent_non_reply',
      agentId: 'silent-1',
      reason: 'awaiting-input',
      silentForMs: 210_000,
      turnId: 'turn-silent-1',
    });
  });

  it('carries `quiet` through unchanged too — the reader is not specific to one reason', async () => {
    const socket = await connectedClient();
    const received = nextMatching(socket, 'agent_non_reply');

    registry.emit('agent_non_reply', { ...notice, agentId: 'silent-2', reason: 'quiet' });

    await expect(received).resolves.toMatchObject({ agentId: 'silent-2', reason: 'quiet' });
    expect(recorded.filter(e => e.event === 'agent_non_reply')).toHaveLength(1);
  });
});
