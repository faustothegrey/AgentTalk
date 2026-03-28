import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './registry.js';
import type { CmuxAdapter } from './cmux-adapter.js';

function isSplitDirection(value: unknown): value is 'right' | 'down' {
  return value === 'right' || value === 'down';
}

function getErrorStatus(err: unknown): number {
  if (!(err instanceof Error)) {
    return 500;
  }

  if (err.message.includes('not found')) {
    return 404;
  }

  if (err.message.includes('already exists')) {
    return 409;
  }

  return 500;
}

export function startServer(registry: Registry, adapter: CmuxAdapter, port: number = 3000) {
  const app = express();
  app.use(express.json());

  // REST API
  app.get('/api/agents', (req, res) => {
    console.log('[Server] GET /api/agents');
    const agents = registry.getAgents().map(a => ({
      id: a.id,
      status: a.status,
      surface: a.surface,
    }));
    console.log(`[Server] Returning ${agents.length} agents`);
    res.json(agents);
  });

  app.post('/api/agents', async (req, res) => {
    console.log('[Server] POST /api/agents', req.body);
    const { id, splitDirection } = req.body;
    if (splitDirection !== undefined && !isSplitDirection(splitDirection)) {
      console.log('[Server] Invalid splitDirection:', splitDirection);
      res.status(400).json({ error: 'splitDirection must be "right" or "down"' });
      return;
    }

    try {
      const agent = await registry.createAgent(id || `agent-${Date.now()}`, splitDirection || 'right');
      console.log(`[Server] Agent created: ${agent.id} (status: ${agent.status})`);
      res.json({ id: agent.id, status: agent.status, surface: agent.surface });
    } catch (err) {
      console.error('[Server] Failed to create agent:', err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/agents/:id/start', async (req, res) => {
    const { id } = req.params;
    const { command } = req.body;
    console.log(`[Server] POST /api/agents/${id}/start`, { command });
    if (typeof command !== 'string' || command.trim() === '') {
      console.log('[Server] Missing or empty command');
      res.status(400).json({ error: 'command is required' });
      return;
    }

    try {
      const agent = registry.getAgent(id);
      console.log(`[Server] Starting agent ${id} (current status: ${agent.status})...`);
      await registry.startAgent(id, command);
      console.log(`[Server] Agent ${id} successfully started`);
      res.json({ success: true });
    } catch (err) {
      console.error(`[Server] Failed to start agent ${id}:`, err);
      if (err instanceof Error && err.stack) {
        console.error(`[Server] Stack trace for ${id} startup failure:\n${err.stack}`);
      }
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Map to track which client is attached to which agent
  const clientAttachments = new Map<WebSocket, string>();

  wss.on('connection', (ws) => {
    console.log('[Server] New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[Server] WS message received:', message.type, message.type === 'input' ? `(${message.text?.length} chars)` : JSON.stringify(message));

        switch (message.type) {
          case 'attach':
            clientAttachments.set(ws, message.agentId);
            break;

          case 'input': {
            const agentId = clientAttachments.get(ws);
            if (!agentId) {
              console.warn('[Server] WS input received but client not attached to any agent');
              break;
            }
            try {
              const agent = registry.getAgent(agentId);
              await adapter.sendText(agent.surface.surfaceRef, message.text);
            } catch (err) {
              console.error(`[Server] Failed to forward input to agent ${agentId}:`, err);
            }
            break;
          }

          case 'message': {
            const agentId = clientAttachments.get(ws);
            if (!agentId) {
              console.warn('[Server] WS message received but client not attached to any agent');
              break;
            }
            try {
              console.log(`[Server] Sending message to agent ${agentId}: ${message.text}`);
              await registry.sendProtocol(agentId, 'EVT', {
                type: 'message_received',
                from: 'user',
                payload: message.text,
              });
            } catch (err) {
              console.error(`[Server] Failed to send message to agent ${agentId}:`, err);
            }
            break;
          }

          case 'start_pair_chat': {
            const { agentAId, agentBId } = message;
            if (typeof agentAId !== 'string' || typeof agentBId !== 'string' || agentAId === agentBId) {
              console.warn('[Server] Invalid start_pair_chat payload:', message);
              break;
            }

            try {
              const agentA = registry.getAgent(agentAId);
              const agentB = registry.getAgent(agentBId);

              if ((agentA.status !== 'ready' && agentA.status !== 'busy') || (agentB.status !== 'ready' && agentB.status !== 'busy')) {
                throw new Error('Both agents must be ready before starting a conversation');
              }

              const topic = 'Discuss the current NodePTY project: architecture quality, risks, and the most important next improvements.';
              const maxReplies = 5;

              await registry.sendProtocol(agentAId, 'EVT', {
                type: 'scenario_start',
                peerId: agentBId,
                topic,
                maxReplies,
                initiator: true,
              });

              await registry.sendProtocol(agentBId, 'EVT', {
                type: 'scenario_start',
                peerId: agentAId,
                topic,
                maxReplies,
                initiator: false,
              });

              ws.send(JSON.stringify({
                type: 'scenario_started',
                agentAId,
                agentBId,
                topic,
                maxReplies,
              }));
            } catch (err) {
              const error = err instanceof Error ? err.message : String(err);
              console.error('[Server] Failed to start pair chat:', err);
              ws.send(JSON.stringify({
                type: 'scenario_error',
                error,
              }));
            }
            break;
          }

          default:
            console.warn('[Server] Unknown WS message type:', message.type);
        }
      } catch (err) {
        console.error('[Server] WebSocket message parse/handle error:', err);
      }
    });

    ws.on('close', () => {
      const agentId = clientAttachments.get(ws);
      console.log(`[Server] WebSocket disconnected (was attached to: ${agentId ?? 'none'})`);
      clientAttachments.delete(ws);
    });
  });

  // Listen to Registry events and broadcast to attached clients
  registry.on('output', ({ id, text }) => {
    let sent = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && clientAttachments.get(client) === id) {
        client.send(JSON.stringify({ type: 'output', id, text }));
        sent++;
      }
    });
    console.log(`[Server] Output from ${id} (${text.length} chars) → ${sent} client(s)`);
  });

  // Route agent→user messages back to attached WebSocket clients
  registry.on('user_message', ({ from, payload }) => {
    let sent = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && clientAttachments.get(client) === from) {
        client.send(JSON.stringify({ type: 'agent_message', from, payload }));
        sent++;
      }
    });
    console.log(`[Server] Agent message from ${from}: "${payload}" → ${sent} client(s)`);
  });

  registry.on('status', ({ id, status }) => {
    let sent = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'status', id, status }));
        sent++;
      }
    });
    console.log(`[Server] Status ${id}: ${status} → ${sent} client(s)`);
  });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[Server] NodePTY Web UI Backend listening on http://localhost:${actualPort}`);
  });

  return server;
}
