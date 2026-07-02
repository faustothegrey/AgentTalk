import express from 'express';
import { createServer } from 'http';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { WebSocketServer, WebSocket } from 'ws';

const require = createRequire(import.meta.url);
const wireContract = require('@agenttalk/contracts/wire-contract.json');

import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { McpServer } from '@agenttalk/mcp-transport';
import { activeBacklogItems, readBacklog } from './backlog.js';
import { AGENTTALK_MCP_TOOLS } from '@agenttalk/runtime-core/registry/mcp-tools';
import type { AgentProvider } from '@agenttalk/contracts/types';
import type { ScenarioDefinition } from '@agenttalk/runtime-scenarios/scenarios/types';
import type { GoogleDriveIntegration } from '@agenttalk/integration-google-drive/google-drive/types';
import type { SessionRecorder } from '@agenttalk/observability/recordings/session-recorder';
import { ScenarioRunner } from '@agenttalk/runtime-scenarios/scenarios/scenario-runner';
import { SchedulerService } from '@agenttalk/runtime-scenarios/scheduler/scheduler';
import { ScenarioScheduler } from '@agenttalk/runtime-scenarios/scheduler/scenario-scheduler';
import { UsageHistoryStore } from '@agenttalk/observability/usage-history/store';
import {
  getIntervalSeconds,
  getNonEmptyString,
  isExecutionMode,
  normalizeCreateTeamMembers,
} from '@agenttalk/runtime-core/shared/validation';
import {
  isUsageCaptureProvider,
} from '@agenttalk/observability/usage-history/capture';

type MessageHistoryEvent =
  | { type: 'agent_message'; payload: string };

const usageHistoryStorePath = path.resolve(process.cwd(), 'persistence', 'usage-stats-history.json');
const schedulerStorePath = path.resolve(process.cwd(), 'persistence', 'scheduler-jobs.json');

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

export function startServer(

  registry: Registry,
  port: number = 3000,
  options: { recorder?: SessionRecorder; googleDrive?: GoogleDriveIntegration } = {},
) {
  const app = express();
  app.use(express.json());
  const recorder = options.recorder;
  const googleDrive = options.googleDrive;
  const usageHistoryStore = new UsageHistoryStore(usageHistoryStorePath);
  const scheduler = new SchedulerService({
    onRun: async (job) => {
      await registry.sendScheduledMessage(job.agentId, job.prompt);
      recorder?.record('runtime', 'scheduler_job_run', {
        jobId: job.id,
        agentId: job.agentId,
      });
    },
  }, schedulerStorePath);

  // Autorun scenario scheduler (skip during tests)
  let scenarioScheduler: ScenarioScheduler | null = null;
  const autorunConfigPath = path.resolve(process.cwd(), 'scenarios', 'autorun.json');
  if (process.env.NODE_ENV !== 'test' && existsSync(autorunConfigPath)) {
    try {
      const autorunConfig = JSON.parse(readFileSync(autorunConfigPath, 'utf-8'));
      const scenarioPath = path.resolve(process.cwd(), autorunConfig.scenarioFile);
      const scenarioDefinition = JSON.parse(readFileSync(scenarioPath, 'utf-8'));
      scenarioScheduler = new ScenarioScheduler(
        {
          scenarioDefinition,
          defaultTaskOverride: autorunConfig.taskOverride,
        },
        {
          registry,
          onComplete: (result) => {
            console.log(`[Server] Autorun scenario "${result.scenarioName}" finished: ${result.status}`);
            recorder?.record('runtime', 'autorun_scenario_complete', {
              status: result.status,
              error: result.error,
            });
          },
        },
      );
      
      const intervalSeconds = typeof autorunConfig.intervalSeconds === 'number' ? autorunConfig.intervalSeconds : 0;
      if (intervalSeconds > 0) {
        console.log(`[Server] Autorun scenario scheduler initialized (repeating every ${intervalSeconds}s)`);
        
        // Periodic runs
        setInterval(() => {
          scenarioScheduler?.runNow().catch(err => {
            console.error('[Server] Periodic autorun scenario run failed:', err);
          });
        }, intervalSeconds * 1000);
      } else {
        console.log('[Server] Autorun scenario scheduler initialized (waiting for trigger)');
      }
    } catch (err) {
      console.error('[Server] Failed to initialize autorun scenario scheduler:', err);
    }
  }

  function getBaseUrl(req: express.Request): string {
    const configured = getNonEmptyString(process.env.GOOGLE_DRIVE_REDIRECT_BASE_URL);
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return `${req.protocol}://${req.get('host')}`;
  }

  // REST API
  app.get('/api/planning-runs', (_req, res) => {
    const planningRunsDir = path.resolve(process.cwd(), 'planning_runs');
    if (!existsSync(planningRunsDir)) {
      res.json([]);
      return;
    }

    try {
      const files = readdirSync(planningRunsDir).filter(f => f.endsWith('.json'));
      const runs = files.map(file => {
        try {
          const content = readFileSync(path.join(planningRunsDir, file), 'utf-8');
          const run = JSON.parse(content);
          // Return a summary for the list
          return {
            id: run.taskId || run.id,
            description: run.description,
            status: run.status,
            composition: run.composition,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
          };
        } catch (err) {
          console.error(`[Server] Failed to read planning run file ${file}:`, err);
          return null;
        }
      }).filter(Boolean);

      // Sort by createdAt descending
      runs.sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list planning runs' });
    }
  });

  app.get('/api/planning-runs/:id', (req, res) => {
    const planningRunsDir = path.resolve(process.cwd(), 'planning_runs');
    const id = req.params.id;
    const filePath = path.join(planningRunsDir, `${id}.json`);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Planning run not found' });
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      res.json(JSON.parse(content));
    } catch (err) {
      res.status(500).json({ error: 'Failed to read planning run' });
    }
  });

  app.get('/api/agents', (_req, res) => {

    const agents = registry.getAgents().map(a => ({
      id: a.id,
      status: a.status,
      usage: a.usage,
      usageStats: a.usageStats,
      provider: a.provider,
      model: a.model,
      requestedExecutionMode: a.requestedExecutionMode,
      resolvedExecutionMode: a.resolvedExecutionMode,
      sessionStatus: a.sessionStatus,
    }));
    console.log(`[Server] Returning ${agents.length} agents`);
    res.json(agents);
  });

  app.get('/api/conversations', (_req, res) => {
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

  app.get('/api/topics', (_req, res) => {
    console.log('[Server] GET /api/topics');
    const conversations = registry.getConversations();
    const topics = Array.from(new Set(conversations.map(s => s.topic))).filter(Boolean);
    console.log(`[Server] Returning ${topics.length} topics`);
    res.json(topics);
  });

  app.get('/api/backlog', (req, res) => {
    console.log('[Server] GET /api/backlog');
    const { items, warnings } = readBacklog();
    // Default view = the live queue (doing + todo); pass ?all=true for done/dropped/deferred too
    // (the future UI toggles ride this param).
    const all = req.query.all === 'true';
    const visible = all ? items : activeBacklogItems(items);
    console.log(
      `[Server] Returning ${visible.length}/${items.length} backlog items (${warnings.length} warnings)`,
    );
    res.json({ items: visible, total: items.length, warnings, generatedAt: new Date().toISOString() });
  });

  app.get('/api/backlog/:id', (req, res) => {
    const { id } = req.params;
    console.log(`[Server] GET /api/backlog/${id}`);
    const { items } = readBacklog();
    const item = items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: 'Backlog item not found' });
      return;
    }
    res.json(item);
  });

  app.get('/api/scheduler/status', (_req, res) => {
    res.json({ globalEnabled: scheduler.isGlobalEnabled() });
  });

  app.post('/api/scheduler/toggle', (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    scheduler.setGlobalEnabled(enabled);
    res.json({ globalEnabled: scheduler.isGlobalEnabled() });
  });

  app.get('/api/scheduler/jobs', (_req, res) => {
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

  app.get('/api/integrations/google-drive/resources', (_req, res) => {
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
    const model = getNonEmptyString(req.body?.model);
    const requestedExecutionMode = isExecutionMode(req.body?.executionMode) ? req.body.executionMode : 'auto';
    recorder?.record('api', 'create_agent_request', { id, provider, model, requestedExecutionMode });

    try {
      const agentId = id || (provider ? `agent-${provider}-${Date.now()}` : `agent-${Date.now()}`);
      const agent = await registry.createAgent(agentId, { requestedExecutionMode });
      if (isUsageCaptureProvider(provider)) {
        agent.provider = provider;
      }
      if (model) {
        agent.model = model;
      }
      console.log(`[Server] Agent created: ${agent.id} (status: ${agent.status})`);
      recorder?.record('runtime', 'agent_created', {
        id: agent.id,
        status: agent.status,
        provider: agent.provider,
        model: agent.model,
        requestedExecutionMode: agent.requestedExecutionMode,
      });
      res.json({
        id: agent.id,
        status: agent.status,
        provider: agent.provider,
        model: agent.model,
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
    // Starting an agent just activates it and waits for an external MCP client to connect
    // over WebSocket; the orchestrator launches nothing.
    console.log(`[Server] POST /api/agents/${id}/start`, {
      provider: req.body?.provider,
      model: req.body?.model,
      executionMode: req.body?.executionMode,
    });
    recorder?.record('api', 'start_agent_request', {
      id,
      provider: req.body?.provider,
      model: req.body?.model,
      executionMode: req.body?.executionMode,
    });

    try {
      const agent = registry.getAgent(id);
      const requestedExecutionMode = isExecutionMode(req.body?.executionMode)
        ? req.body.executionMode
        : agent.requestedExecutionMode;
      console.log(`[Server] Activating agent ${id} (current status: ${agent.status})...`);
      await registry.activateAgent(id, req.body?.provider, req.body?.model, requestedExecutionMode);
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
    console.log(`[Server] POST /api/agents/${id}/usage-stats (DEPRECATED)`);
    try {
      // The orchestrator does not run the worker, so it doesn't capture usage stats.
      // This endpoint is preserved to avoid breaking the UI, but returns a placeholder.
      const stats = "Usage stats capture is managed by the attached worker.";
      const timestamp = new Date().toISOString();
      const usageStats = { stats, timestamp };
      res.json({ success: true, usageStats });
    } catch (err) {
      console.error(`[Server] Failed to request usage stats for agent ${id}:`, err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/usage-stats/capture', async (req, res) => {
    console.log('[Server] POST /api/usage-stats/capture (DEPRECATED)');
    try {
      const provider = isUsageCaptureProvider(req.body?.provider) ? req.body.provider : undefined;
      const model = getNonEmptyString(req.body?.model);
      if (!provider) {
        throw new Error('provider is required (gemini, claude, or codex)');
      }

      const stats = "Usage stats capture is managed by the attached worker in Phase 5+.";
      const timestamp = new Date().toISOString();
      const usageStats = { stats, timestamp };
      
      res.json({ success: true, provider, model: model ?? null, usageStats });
    } catch (err) {
      console.error('[Server] Failed to capture usage stats:', err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/usage-stats/history', (req, res) => {
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.floor(rawLimit as number)) : 24;
    res.json({
      success: true,
      history: usageHistoryStore.list(limit),
    });
  });

  // ── Team endpoints ──────────────────────────────────────────

  app.get('/api/teams', (_req, res) => {
    res.json(registry.getTeams());
  });

  app.post('/api/teams', (req, res) => {
    try {
      const members = normalizeCreateTeamMembers(req.body);
      // Untyped HTTP boundary: provider arrives as a free string. Cast to the
      // AgentProvider union without runtime validation to keep behaviour
      // identical (the value is forwarded unchecked, exactly as before).
      const provider = getNonEmptyString(req.body?.provider) as AgentProvider | undefined;
      if (members.length === 0) {
        res.status(400).json({ error: 'A worker agent ID is required' });
        return;
      }
      const team = registry.createTeam(members, provider);
      res.json(team);
    } catch (err) {
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/teams/:id/task', async (req, res) => {
    const { description, maxRepliesPerAgent } = req.body;
    try {
      const maxReplies = typeof maxRepliesPerAgent === 'number' ? maxRepliesPerAgent : undefined;
      const task = await registry.assignTeamTask(req.params.id, description, maxReplies);
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
      const suffix = result.error ? `: ${result.error}` : '';
      console.log(`[Server] Scenario "${result.scenarioName}" ${result.status}${suffix}`);
      res.json(result);
    } catch (err) {
      console.error('[Server] Failed to launch scenario:', err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Autorun scenario endpoints ─────────────────────────────

  app.get('/api/autorun/status', (_req, res) => {
    if (!scenarioScheduler) {
      res.json({ enabled: false });
      return;
    }
    res.json(scenarioScheduler.getStatus());
  });

  app.post('/api/autorun/trigger', async (req, res) => {
    if (!scenarioScheduler) {
      res.status(404).json({ error: 'Autorun scenario scheduler is not configured' });
      return;
    }
    const taskOverride = getNonEmptyString(req.body?.taskOverride);

    // Trigger the run immediately
    void scenarioScheduler.runNow(taskOverride);
    res.json({ triggered: true, status: scenarioScheduler.getStatus() });
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

  // The orchestrator is attach-only: always start the multi-tenant WebSocket MCP server so
  // external MCP clients (codex/claude/gemini workers) can connect and pull turns.
  let mcpServer: McpServer | null = null;
  {
    mcpServer = new McpServer({
      tools: AGENTTALK_MCP_TOOLS,
      expectedContractHash: wireContract.hash,
      handler: async (agentId, name, args) => {
        return registry.handleMcpToolCall(agentId, name, args);
      },
      onDisconnect: (agentId, code, reason) => {
        registry.handleMcpDisconnect(agentId, code, reason);
      },
      onConnect: (agentId) => {
        registry.handleMcpConnect(agentId);
      },
    });

    // Run the MCP server on its OWN dedicated port. Sharing the app's HTTP server with a
    // second WebSocketServer is unreliable in `ws` — the app's `/ws` server destroys
    // non-matching upgrades (including `/mcp`), so the MCP endpoint never receives
    // connections and agents silently fall back to the legacy protocol. A dedicated port
    // avoids the collision entirely. (Fix: WS-collision bug found in live test 2026-06-18.)
    mcpServer.start(0).then((mcpPort) => {
      process.env.AGENTTALK_PERSISTENT_MCP_URL = `ws://localhost:${mcpPort}/`;
      console.log(`[Server] AgentTalk WebSocket MCP server listening on ws://localhost:${mcpPort}/`);
      console.log(`[Server] AgentTalk MCP server URL set to: ${process.env.AGENTTALK_PERSISTENT_MCP_URL}`);
    });

    const originalDestroy = registry.destroy.bind(registry);
    registry.destroy = async () => {
      if (mcpServer) {
        await mcpServer.close();
      }
      await originalDestroy();
    };
  }

  // Map to track which client is attached to which agent
  const clientAttachments = new Map<WebSocket, string>();
  const messageHistory = new Map<string, MessageHistoryEvent[]>();

  function recordMessageHistory(agentId: string, event: MessageHistoryEvent): void {
    const history = messageHistory.get(agentId) ?? [];
    history.push(event);
    messageHistory.set(agentId, history);
  }

  wss.on('connection', (ws) => {
    console.log('[Server] New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[Server] WS message received:', message.type, JSON.stringify(message));
        recorder?.record('ws_in', message.type ?? 'unknown', message);

        switch (message.type) {
          case 'attach': {
            clientAttachments.set(ws, message.agentId);
            ws.send(JSON.stringify({
              type: 'message_history',
              agentId: message.agentId,
              events: messageHistory.get(message.agentId) ?? [],
            }));
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
  registry.on('user_message', ({ from, payload }) => {
    recorder?.record('runtime', 'agent_message', { from, payload: String(payload) });
    recordMessageHistory(from, { type: 'agent_message', payload: String(payload) });
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
    // AGENTTALK_PERSISTENT_MCP_URL is set when the dedicated MCP server binds (see above),
    // not here — the MCP server no longer shares this HTTP server/port.
    recorder?.record('runtime', 'server_started', { port: actualPort });
  });

  server.on('close', () => {
    scheduler.destroy();
    scenarioScheduler?.destroy();
  });

  return server;
}
