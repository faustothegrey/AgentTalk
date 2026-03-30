import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './registry.js';

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

export function startServer(registry: Registry, port: number = 3000) {
  const app = express();
  app.use(express.json());

  // REST API
  app.get('/api/agents', (req, res) => {
    console.log('[Server] GET /api/agents');
    const agents = registry.getAgents().map(a => ({
      id: a.id,
      status: a.status,
      usage: a.usage,
      provider: a.provider,
      model: a.model,
      externalUsage: a.externalUsage,
    }));
    console.log(`[Server] Returning ${agents.length} agents`);
    res.json(agents);
  });

  app.get('/api/conversations', (req, res) => {
    console.log('[Server] GET /api/conversations');
    const conversations = registry.getConversations();
    console.log(`[Server] Returning ${conversations.length} conversations`);
    res.json(conversations);
  });

  app.delete('/api/conversations/:id', (req, res) => {
    const { id } = req.params;
    console.log(`[Server] DELETE /api/conversations/${id}`);
    const deleted = registry.removeConversation(id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Conversation not found' });
    }
  });

  app.get('/api/topics', (req, res) => {
    console.log('[Server] GET /api/topics');
    const conversations = registry.getConversations();
    const topics = Array.from(new Set(conversations.map(s => s.topic))).filter(Boolean);
    console.log(`[Server] Returning ${topics.length} topics`);
    res.json(topics);
  });

  app.post('/api/agents', async (req, res) => {
    console.log('[Server] POST /api/agents', req.body);
    const { id } = req.body;

    try {
      const agent = await registry.createAgent(id || `agent-${Date.now()}`);
      console.log(`[Server] Agent created: ${agent.id} (status: ${agent.status})`);
      res.json({ id: agent.id, status: agent.status });
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

  app.delete('/api/agents/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[Server] DELETE /api/agents/${id}`);
    try {
      await registry.removeAgent(id);
      res.json({ success: true });
    } catch (err) {
      console.error(`[Server] Failed to remove agent ${id}:`, err);
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
              registry.getAgent(agentId); // validate agent exists
              registry.sendProtocol(agentId, 'EVT', {
                type: 'user_input',
                text: message.text,
              });
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
            const { agentIds: clientAgentIds, agentAId, agentBId, topic: clientTopic, maxReplies: clientMaxReplies } = message;
            
            let agentIds: string[] = [];
            if (Array.isArray(clientAgentIds)) {
              agentIds = clientAgentIds;
            } else if (typeof agentAId === 'string' && typeof agentBId === 'string') {
              agentIds = [agentAId, agentBId];
            }

            if (agentIds.length < 2) {
              console.warn('[Server] Invalid start_pair_chat payload: need at least 2 agents', message);
              ws.send(JSON.stringify({
                type: 'conversation_error',
                error: 'Select at least two agents for the conversation.',
              }));
              break;
            }

            try {
              const defaultTopic = 'Discuss the current AgentTalk project and propose concrete next-step implementation ideas or simplifications: architecture quality, risks, and the most useful changes to make next.';
              const topic = typeof clientTopic === 'string' && clientTopic.trim() !== '' ? clientTopic : defaultTopic;
              const maxReplies = typeof clientMaxReplies === 'number' ? clientMaxReplies : 5;
              const conversation = await registry.startConversation(agentIds, topic, maxReplies);

              ws.send(JSON.stringify({
                type: 'conversation_started',
                conversation,
              }));
            } catch (err) {
              const error = err instanceof Error ? err.message : String(err);
              console.error('[Server] Failed to start conversation:', err);
              ws.send(JSON.stringify({
                type: 'conversation_error',
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

  // Broadcast helper: sends a message to all open WebSocket clients,
  // optionally filtered to only the client attached to a specific agent.
  function broadcast(msg: Record<string, unknown>, onlyAttachedTo?: string): number {
    let sent = 0;
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (onlyAttachedTo && clientAttachments.get(client) !== onlyAttachedTo) return;
      client.send(JSON.stringify(msg));
      sent++;
    });
    return sent;
  }

  // Listen to Registry events and broadcast to clients
  registry.on('output', ({ id, text }) => {
    const sent = broadcast({ type: 'output', id, text }, id);
    console.log(`[Server] Output from ${id} (${text.length} chars) → ${sent} client(s)`);
  });

  registry.on('user_message', ({ from, payload }) => {
    const sent = broadcast({ type: 'agent_message', from, payload }, from);
    console.log(`[Server] Agent message from ${from}: "${payload}" → ${sent} client(s)`);
  });

  registry.on('status', ({ id, status }) => {
    const sent = broadcast({ type: 'status', id, status });
    console.log(`[Server] Status ${id}: ${status} → ${sent} client(s)`);
  });

  registry.on('usage', ({ id, usage }) => {
    const sent = broadcast({ type: 'usage', id, usage });
    console.log(`[Server] Usage ${id}: ${JSON.stringify(usage)} → ${sent} client(s)`);
  });

  registry.on('provider', ({ id, provider }) => {
    const sent = broadcast({ type: 'provider', id, provider });
    console.log(`[Server] Provider ${id}: ${provider} → ${sent} client(s)`);
  });

  registry.on('model', ({ id, model }) => {
    const sent = broadcast({ type: 'model', id, model });
    console.log(`[Server] Model ${id}: ${model} → ${sent} client(s)`);
  });

  registry.on('external_usage', ({ id, externalUsage }) => {
    const sent = broadcast({ type: 'external_usage', id, externalUsage });
    console.log(`[Server] External Usage ${id}: (${externalUsage.length} chars) → ${sent} client(s)`);
  });

  registry.on('conversation', (conversation) => {
    const sent = broadcast({ type: 'conversation', conversation });
    console.log(`[Server] Conversation ${conversation.id}: ${conversation.status} → ${sent} client(s)`);
  });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[Server] AgentTalk Web UI Backend listening on http://localhost:${actualPort}`);
  });

  return server;
}
