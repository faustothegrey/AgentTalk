import express from 'express';
import { createServer } from 'http';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './registry.js';
import type { AgentExecutionMode, TeamMember, TeamRole } from './shared/types.js';
import type { GoogleDriveIntegration } from './integrations/google-drive/types.js';
import type { SessionRecorder } from './recordings/session-recorder.js';
import { buildProcessOptions } from './scenarios/command-builder.js';
import { ScenarioRunner } from './scenarios/scenario-runner.js';
import type { ScenarioDefinition } from './scenarios/types.js';
import { SchedulerService } from './scheduler/scheduler.js';

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

function getIntervalSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.floor(parsed);
  }

  return undefined;
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
  options: { recorder?: SessionRecorder; googleDrive?: GoogleDriveIntegration } = {},
) {
  const app = express();
  app.use(express.json());
  const recorder = options.recorder;
  const googleDrive = options.googleDrive;
  const scheduler = new SchedulerService({
    onRun: async (job) => {
      await registry.sendScheduledMessage(job.agentId, job.prompt);
      recorder?.record('runtime', 'scheduler_job_run', {
        jobId: job.id,
        agentId: job.agentId,
      });
    },
  });

  function getBaseUrl(req: express.Request): string {
    const configured = getNonEmptyString(process.env.GOOGLE_DRIVE_REDIRECT_BASE_URL);
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return `${req.protocol}://${req.get('host')}`;
  }

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

  app.get('/api/scheduler/jobs', (req, res) => {
    res.json(scheduler.listJobs());
  });

  app.post('/api/scheduler/jobs', (req, res) => {
    const name = getNonEmptyString(req.body?.name);
    const agentId = getNonEmptyString(req.body?.agentId);
    const prompt = getNonEmptyString(req.body?.prompt);
    const intervalSeconds = getIntervalSeconds(req.body?.intervalSeconds);
    const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : true;

    if (!name || !agentId || !prompt || intervalSeconds === undefined) {
      res.status(400).json({ error: 'name, agentId, prompt, and intervalSeconds are required' });
      return;
    }

    if (intervalSeconds < 5) {
      res.status(400).json({ error: 'intervalSeconds must be at least 5' });
      return;
    }

    try {
      registry.getAgent(agentId);
      const job = scheduler.createJob({
        name,
        agentId,
        prompt,
        intervalSeconds,
        enabled,
      });
      res.json(job);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/scheduler/jobs/:id', (req, res) => {
    const intervalSeconds = req.body?.intervalSeconds === undefined
      ? undefined
      : getIntervalSeconds(req.body.intervalSeconds);
    const name = req.body?.name === undefined ? undefined : getNonEmptyString(req.body.name);
    const agentId = req.body?.agentId === undefined ? undefined : getNonEmptyString(req.body.agentId);
    const prompt = req.body?.prompt === undefined ? undefined : getNonEmptyString(req.body.prompt);
    const enabled = req.body?.enabled;

    if (req.body?.intervalSeconds !== undefined && intervalSeconds === undefined) {
      res.status(400).json({ error: 'intervalSeconds must be a number' });
      return;
    }

    if (intervalSeconds !== undefined && intervalSeconds < 5) {
      res.status(400).json({ error: 'intervalSeconds must be at least 5' });
      return;
    }

    if (req.body?.enabled !== undefined && typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    if (agentId) {
      try {
        registry.getAgent(agentId);
      } catch (err) {
        res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    try {
      const job = scheduler.updateJob(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(agentId !== undefined ? { agentId } : {}),
        ...(prompt !== undefined ? { prompt } : {}),
        ...(intervalSeconds !== undefined ? { intervalSeconds } : {}),
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
      });
      res.json(job);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/scheduler/jobs/:id/run', async (req, res) => {
    try {
      const job = await scheduler.runNow(req.params.id);
      res.json(job);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/scheduler/jobs/:id', (req, res) => {
    const removed = scheduler.deleteJob(req.params.id);
    if (!removed) {
      res.status(404).json({ error: `Scheduler job ${req.params.id} not found` });
      return;
    }

    res.json({ success: true });
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

  app.get('/api/integrations/google-drive/status', async (req, res) => {
    if (!googleDrive) {
      res.json({ configured: false, authenticated: false, scopes: [], hasRefreshToken: false });
      return;
    }

    try {
      res.json(await googleDrive.getStatus(getBaseUrl(req)));
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/integrations/google-drive/oauth/start', async (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    try {
      const authUrl = await googleDrive.createAuthUrl(getBaseUrl(req));
      res.json({ authUrl });
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/integrations/google-drive/oauth/callback', async (req, res) => {
    if (!googleDrive) {
      res.status(404).send('Google Drive integration is not configured.');
      return;
    }

    const code = getNonEmptyString(req.query.code);
    const state = getNonEmptyString(req.query.state);
    if (!code || !state) {
      res.status(400).send('Missing OAuth code or state.');
      return;
    }

    try {
      if ('assertValidOAuthState' in googleDrive && typeof (googleDrive as { assertValidOAuthState?: unknown }).assertValidOAuthState === 'function') {
        (googleDrive as { assertValidOAuthState(state: string): void }).assertValidOAuthState(state);
      }
      await googleDrive.handleOAuthCallback(code, getBaseUrl(req));
      res.type('html').send('<html><body><h1>Google Drive connected.</h1><p>You can close this tab.</p></body></html>');
    } catch (err) {
      res.status(getErrorStatus(err)).type('html').send(`<html><body><h1>Google Drive OAuth failed.</h1><pre>${err instanceof Error ? err.message : String(err)}</pre></body></html>`);
    }
  });

  app.get('/api/integrations/google-drive/resources', (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    res.json(googleDrive.listResources());
  });

  app.post('/api/integrations/google-drive/resources', (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    const name = getNonEmptyString(req.body?.name);
    const type = req.body?.type === 'file' || req.body?.type === 'folder' ? req.body.type : undefined;
    const driveId = getNonEmptyString(req.body?.driveId);
    if (!name || !type || !driveId) {
      res.status(400).json({ error: 'name, type, and driveId are required' });
      return;
    }

    try {
      res.json(googleDrive.createResource({ name, type, driveId }));
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/integrations/google-drive/resources/:resourceId/grants', (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    const agentId = getNonEmptyString(req.body?.agentId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    try {
      registry.getAgent(agentId);
      res.json(googleDrive.grantAgentAccess(req.params.resourceId, agentId));
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/integrations/google-drive/resources/:resourceId/grants/:agentId', (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    res.json({ success: googleDrive.revokeAgentAccess(req.params.resourceId, req.params.agentId) });
  });

  app.get('/api/integrations/google-drive/agents/:agentId/resources', (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    try {
      registry.getAgent(req.params.agentId);
      res.json(googleDrive.listAgentResources(req.params.agentId));
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/integrations/google-drive/resources/:resourceId/files', async (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    const agentId = getNonEmptyString(req.query.agentId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    try {
      registry.getAgent(agentId);
      res.json(await googleDrive.listFilesForAgent(agentId, req.params.resourceId));
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/integrations/google-drive/resources/:resourceId/read', async (req, res) => {
    if (!googleDrive) {
      res.status(404).json({ error: 'Google Drive integration is not configured' });
      return;
    }

    const agentId = getNonEmptyString(req.query.agentId);
    const fileId = getNonEmptyString(req.query.fileId);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    try {
      registry.getAgent(agentId);
      res.json(await googleDrive.readFileForAgent(agentId, req.params.resourceId, fileId));
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

  // ── Scenario endpoints ──────────────────────────────────────

  app.post('/api/scenarios/launch', async (req, res) => {
    const definition = req.body as ScenarioDefinition;
    console.log(`[Server] POST /api/scenarios/launch: ${definition.name ?? '(unnamed)'}`);
    recorder?.record('api', 'scenario_launch', { name: definition.name });

    try {
      const runner = new ScenarioRunner();
      const result = await runner.run(definition, registry);
      console.log(`[Server] Scenario "${result.scenarioName}" ${result.status}`);
      res.json(result);
    } catch (err) {
      console.error('[Server] Failed to launch scenario:', err);
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

  server.on('close', () => {
    scheduler.destroy();
  });

  return server;
}
