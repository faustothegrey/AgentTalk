import express from 'express';
import { createServer } from 'http';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './registry.js';
import type { AgentExecutionMode, TeamMember, TeamRole } from './shared/types.js';
import type { ProcessSpawnOptions } from './agents/process-adapter.js';
import type { SessionRecorder } from './recordings/session-recorder.js';

type TerminalHistoryEvent =
  | { type: 'output'; text: string }
  | { type: 'agent_message'; payload: string };

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

function isTeamRole(value: unknown): value is TeamRole {
  return value === 'planner' || value === 'worker';
}

function isExecutionMode(value: unknown): value is AgentExecutionMode {
  return value === 'interactive' || value === 'one_shot' || value === 'auto';
}

function getNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function resolveWorkingDirectory(value: unknown): string | undefined {
  const candidate = getNonEmptyString(value);
  if (!candidate) {
    return undefined;
  }

  const resolved = path.resolve(candidate);
  if (!existsSync(resolved)) {
    throw new Error(`Working directory not found: ${resolved}`);
  }

  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Working directory is not a directory: ${resolved}`);
  }

  return resolved;
}

function resolveDirectoryBrowserPath(value: unknown): string {
  const candidate = getNonEmptyString(value);
  return path.resolve(candidate ?? process.cwd());
}

function listDirectories(targetPath: string): { path: string; parentPath: string | null; directories: Array<{ name: string; path: string }> } {
  if (!existsSync(targetPath)) {
    throw new Error(`Directory not found: ${targetPath}`);
  }

  if (!statSync(targetPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${targetPath}`);
  }

  const directories = readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parentPath = path.dirname(targetPath);
  return {
    path: targetPath,
    parentPath: parentPath === targetPath ? null : parentPath,
    directories,
  };
}

function isBundledLlmAgentCommand(command: string): boolean {
  return command.trim().startsWith('node scripts/llm-agent.mjs');
}

function buildProcessOptions(
  command: string,
  workingDirectory?: string,
  requestedExecutionMode?: AgentExecutionMode,
): ProcessSpawnOptions | undefined {
  if (isBundledLlmAgentCommand(command)) {
    return {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(workingDirectory ? { AGENTTALK_WORKDIR: workingDirectory } : {}),
        ...(requestedExecutionMode ? { AGENTTALK_EXECUTION_MODE: requestedExecutionMode } : {}),
      },
    };
  }

  if (!workingDirectory) {
    return undefined;
  }

  return { cwd: workingDirectory };
}

function normalizeCreateTeamMembers(body: unknown): TeamMember[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const payload = body as Record<string, unknown>;
  const members = Array.isArray(payload.members)
    ? payload.members.flatMap((member): TeamMember[] => {
        if (!member || typeof member !== 'object') {
          return [];
        }

        const candidate = member as Record<string, unknown>;
        const agentId = getNonEmptyString(candidate.agentId);
        const role = candidate.role;
        if (!agentId || !isTeamRole(role)) {
          return [];
        }

        return [{ agentId, role }];
      })
    : [];

  if (members.length > 0) {
    return members;
  }

  const composition = getNonEmptyString(payload.teamComposition);
  const plannerAgentId = getNonEmptyString(
    payload.teamPlannerAgent ?? payload.plannerAgentId ?? payload.plannerId,
  );
  const workerAgentId = getNonEmptyString(
    payload.teamWorkerAgent ?? payload.workerAgentId ?? payload.workerId,
  );

  if (!workerAgentId) {
    return [];
  }

  if (composition === 'worker-only' || !plannerAgentId) {
    return [{ agentId: workerAgentId, role: 'worker' }];
  }

  return [
    { agentId: plannerAgentId, role: 'planner' },
    { agentId: workerAgentId, role: 'worker' },
  ];
}

export function startServer(
  registry: Registry,
  port: number = 3000,
  options: { recorder?: SessionRecorder } = {},
) {
  const app = express();
  app.use(express.json());
  const recorder = options.recorder;

  // REST API
  app.get('/api/agents', (req, res) => {
    console.log('[Server] GET /api/agents');
    const agents = registry.getAgents().map(a => ({
      id: a.id,
      status: a.status,
      usage: a.usage,
      usageStats: a.usageStats,
      provider: a.provider,
      model: a.model,
      workingDirectory: a.workingDirectory,
      requestedExecutionMode: a.requestedExecutionMode,
      resolvedExecutionMode: a.resolvedExecutionMode,
      sessionStatus: a.sessionStatus,
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

  app.get('/api/fs/directories', (req, res) => {
    try {
      const targetPath = resolveDirectoryBrowserPath(req.query.path);
      const result = listDirectories(targetPath);
      res.json(result);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/agents', async (req, res) => {
    console.log('[Server] POST /api/agents', req.body);
    const { id, provider } = req.body;
    const requestedExecutionMode = isExecutionMode(req.body?.executionMode) ? req.body.executionMode : 'auto';
    recorder?.record('api', 'create_agent_request', { id, provider, requestedExecutionMode });

    try {
      const agentId = id || (provider ? `agent-${provider}-${Date.now()}` : `agent-${Date.now()}`);
      const agent = await registry.createAgent(agentId, { requestedExecutionMode });
      console.log(`[Server] Agent created: ${agent.id} (status: ${agent.status})`);
      recorder?.record('runtime', 'agent_created', {
        id: agent.id,
        status: agent.status,
        requestedExecutionMode: agent.requestedExecutionMode,
      });
      res.json({
        id: agent.id,
        status: agent.status,
        requestedExecutionMode: agent.requestedExecutionMode,
        resolvedExecutionMode: agent.resolvedExecutionMode,
      });
    } catch (err) {
      console.error('[Server] Failed to create agent:', err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/agents/:id/start', async (req, res) => {
    const { id } = req.params;
    const { command } = req.body;
    console.log(`[Server] POST /api/agents/${id}/start`, {
      command,
      workingDirectory: req.body?.workingDirectory,
      executionMode: req.body?.executionMode,
    });
    recorder?.record('api', 'start_agent_request', {
      id,
      command,
      workingDirectory: req.body?.workingDirectory,
      executionMode: req.body?.executionMode,
    });
    if (typeof command !== 'string' || command.trim() === '') {
      console.log('[Server] Missing or empty command');
      res.status(400).json({ error: 'command is required' });
      return;
    }

    try {
      const workingDirectory = resolveWorkingDirectory(req.body?.workingDirectory);
      const agent = registry.getAgent(id);
      const requestedExecutionMode = isExecutionMode(req.body?.executionMode)
        ? req.body.executionMode
        : agent.requestedExecutionMode;
      const launchCommand = command.trim();
      const processOptions = buildProcessOptions(launchCommand, workingDirectory, requestedExecutionMode);
      console.log(`[Server] Starting agent ${id} (current status: ${agent.status})...`);
      await registry.startAgent(id, launchCommand, workingDirectory, processOptions, requestedExecutionMode);
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

  app.post('/api/agents/:id/usage-stats', async (req, res) => {
    const { id } = req.params;
    console.log(`[Server] POST /api/agents/${id}/usage-stats`);
    try {
      await registry.requestUsageStats(id);
      res.json({ success: true });
    } catch (err) {
      console.error(`[Server] Failed to request usage stats for agent ${id}:`, err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Team endpoints ──────────────────────────────────────────

  app.get('/api/teams', (req, res) => {
    res.json(registry.getTeams());
  });

  app.post('/api/teams', (req, res) => {
    try {
      const members = normalizeCreateTeamMembers(req.body);
      if (members.length === 0) {
        res.status(400).json({ error: 'A worker agent ID is required' });
        return;
      }
      const team = registry.createTeam(members);
      res.json(team);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/teams/:id/task', async (req, res) => {
    const { description } = req.body;
    try {
      const task = await registry.assignTeamTask(req.params.id, description);
      res.json(task);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/teams/:id/tasks/:taskId/confirm', async (req, res) => {
    try {
      await registry.confirmTeamPlan(req.params.taskId);
      res.json({ success: true });
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/teams/:id/tasks/:taskId/reject', async (req, res) => {
    const { feedback } = req.body;
    try {
      await registry.rejectTeamPlan(req.params.taskId, feedback || 'No feedback provided');
      res.json({ success: true });
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Agent endpoints (continued) ────────────────────────────

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
  const terminalHistory = new Map<string, TerminalHistoryEvent[]>();

  function recordTerminalHistory(agentId: string, event: TerminalHistoryEvent): void {
    const history = terminalHistory.get(agentId) ?? [];
    history.push(event);
    terminalHistory.set(agentId, history);
  }

  wss.on('connection', (ws) => {
    console.log('[Server] New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[Server] WS message received:', message.type, message.type === 'input' ? `(${message.text?.length} chars)` : JSON.stringify(message));
        recorder?.record('ws_in', message.type ?? 'unknown', message);

        switch (message.type) {
          case 'attach': {
            clientAttachments.set(ws, message.agentId);
            ws.send(JSON.stringify({
              type: 'terminal_history',
              agentId: message.agentId,
              events: terminalHistory.get(message.agentId) ?? [],
            }));
            break;
          }

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

          case 'team_message': {
            const { taskId, role, text } = message;
            try {
              await registry.sendTeamMessage(taskId, role, text);
            } catch (err) {
              console.error(`[Server] Failed to send team message:`, err);
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
    recorder?.record('runtime', 'output', { id, text });
    recordTerminalHistory(id, { type: 'output', text });
    const sent = broadcast({ type: 'output', id, text }, id);
    console.log(`[Server] Output from ${id} (${text.length} chars) → ${sent} client(s)`);
  });

  registry.on('user_message', ({ from, payload }) => {
    recorder?.record('runtime', 'agent_message', { from, payload: String(payload) });
    recordTerminalHistory(from, { type: 'agent_message', payload: String(payload) });
    const sent = broadcast({ type: 'agent_message', from, payload }, from);
    console.log(`[Server] Agent message from ${from}: "${payload}" → ${sent} client(s)`);
  });

  registry.on('status', ({ id, status }) => {
    recorder?.record('runtime', 'status', { id, status });
    const sent = broadcast({ type: 'status', id, status });
    console.log(`[Server] Status ${id}: ${status} → ${sent} client(s)`);
  });

  registry.on('usage', ({ id, usage }) => {
    recorder?.record('runtime', 'usage', { id, usage });
    const sent = broadcast({ type: 'usage', id, usage });
    console.log(`[Server] Usage ${id}: ${JSON.stringify(usage)} → ${sent} client(s)`);
  });

  registry.on('usage_stats', ({ id, usageStats }) => {
    recorder?.record('runtime', 'usage_stats', { id, usageStats });
    const sent = broadcast({ type: 'usage_stats', id, usageStats });
    console.log(`[Server] Usage Stats ${id} → ${sent} client(s)`);
  });

  registry.on('provider', ({ id, provider }) => {
    recorder?.record('runtime', 'provider', { id, provider });
    const sent = broadcast({ type: 'provider', id, provider });
    console.log(`[Server] Provider ${id}: ${provider} → ${sent} client(s)`);
  });

  registry.on('model', ({ id, model }) => {
    recorder?.record('runtime', 'model', { id, model });
    const sent = broadcast({ type: 'model', id, model });
    console.log(`[Server] Model ${id}: ${model} → ${sent} client(s)`);
  });

  registry.on('execution_mode', ({ id, requestedExecutionMode, resolvedExecutionMode }) => {
    recorder?.record('runtime', 'execution_mode', { id, requestedExecutionMode, resolvedExecutionMode });
    const sent = broadcast({ type: 'execution_mode', id, requestedExecutionMode, resolvedExecutionMode });
    console.log(`[Server] Execution Mode ${id}: ${requestedExecutionMode} -> ${resolvedExecutionMode ?? 'pending'} → ${sent} client(s)`);
  });

  registry.on('session_status', ({ id, sessionStatus }) => {
    recorder?.record('runtime', 'session_status', { id, sessionStatus });
    const sent = broadcast({ type: 'session_status', id, sessionStatus });
    console.log(`[Server] Session Status ${id}: ${sessionStatus} → ${sent} client(s)`);
  });

  registry.on('conversation', (conversation) => {
    recorder?.record('runtime', 'conversation', { conversation });
    const sent = broadcast({ type: 'conversation', conversation });
    console.log(`[Server] Conversation ${conversation.id}: ${conversation.status} → ${sent} client(s)`);
  });

  registry.on('team', (team) => {
    recorder?.record('runtime', 'team_updated', { team });
    broadcast({ type: 'team_updated', team });
  });

  registry.on('team_task', (task) => {
    recorder?.record('runtime', 'team_task_updated', { task });
    broadcast({ type: 'team_task_updated', task });
  });

  registry.on('team_planning_complete', ({ team, task, plannerAgentId }) => {
    recorder?.record('runtime', 'team_planning_complete', {
      teamId: team.id,
      taskId: task.id,
      plannerAgentId,
      planSubmittedAt: task.planSubmittedAt,
    });
    const sent = broadcast({
      type: 'team_planning_complete',
      teamId: team.id,
      taskId: task.id,
      plannerAgentId,
      planSubmittedAt: task.planSubmittedAt,
    });
    console.log(
      `[Server] Team planning complete ${team.id}/${task.id} by ${plannerAgentId}` +
      `${task.planSubmittedAt ? ` at ${task.planSubmittedAt}` : ''} → ${sent} client(s)`
    );
  });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[Server] AgentTalk Web UI Backend listening on http://localhost:${actualPort}`);
    recorder?.record('runtime', 'server_started', { port: actualPort });
  });

  return server;
}
