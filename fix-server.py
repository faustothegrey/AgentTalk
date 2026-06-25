import re

with open('apps/orchestrator/src/server.ts', 'r') as f:
    content = f.read()

content = content.replace('  captureUsageStatsViaPtyScript,\n', '')

old_endpoint_1 = """  app.post('/api/agents/:id/usage-stats', async (req, res) => {
    const { id } = req.params;
    console.log(`[Server] POST /api/agents/${id}/usage-stats`);
    try {
      const agent = registry.getAgent(id);
      const requestedProvider = isUsageCaptureProvider(req.body?.provider) ? req.body.provider : undefined;
      const provider = requestedProvider ?? (isUsageCaptureProvider(agent.provider) ? agent.provider : undefined);
      const model = getNonEmptyString(req.body?.model) ?? agent.model;

      if (!provider) {
        throw new Error(
          `Agent ${id} provider is not set. Pass { provider } in request body or create the agent with a provider.`,
        );
      }

      const stats = await captureUsageStatsViaPtyScript(provider, model);
      const timestamp = new Date().toISOString();
      const usageStats = {
        stats,
        timestamp,
      };
      usageHistoryStore.add(buildUsageHistoryEntry(provider, stats, timestamp));
      agent.provider = provider;
      if (model) {
        agent.model = model;
      }
      agent.usageStats = usageStats;
      registry.emit('usage_stats', { id: agent.id, usageStats });

      res.json({ success: true, usageStats });
    } catch (err) {
      console.error(`[Server] Failed to request usage stats for agent ${id}:`, err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });"""

new_endpoint_1 = """  app.post('/api/agents/:id/usage-stats', async (req, res) => {
    const { id } = req.params;
    console.log(`[Server] POST /api/agents/${id}/usage-stats (DEPRECATED)`);
    try {
      // In attach mode, usage stats are no longer captured via PTY by the orchestrator.
      // This endpoint is preserved temporarily to avoid breaking the UI, but it returns a dummy response.
      const stats = "Usage stats capture is managed by the attached worker in Phase 5+.";
      const timestamp = new Date().toISOString();
      const usageStats = { stats, timestamp };
      res.json({ success: true, usageStats });
    } catch (err) {
      console.error(`[Server] Failed to request usage stats for agent ${id}:`, err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });"""

content = content.replace(old_endpoint_1, new_endpoint_1)


old_endpoint_2 = """  app.post('/api/usage-stats/capture', async (req, res) => {
    console.log('[Server] POST /api/usage-stats/capture');
    try {
      const provider = isUsageCaptureProvider(req.body?.provider) ? req.body.provider : undefined;
      const model = getNonEmptyString(req.body?.model);
      if (!provider) {
        throw new Error('provider is required (gemini, claude, or codex)');
      }

      const stats = await captureUsageStatsViaPtyScript(provider, model);
      const timestamp = new Date().toISOString();
      const usageStats = {
        stats,
        timestamp,
      };
      const historyEntry = usageHistoryStore.add(buildUsageHistoryEntry(provider, stats, timestamp));

      res.json({ success: true, provider, model: model ?? null, usageStats, historyEntry });
    } catch (err) {
      console.error('[Server] Failed to capture usage stats:', err);
      res.status(getErrorStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });"""

new_endpoint_2 = """  app.post('/api/usage-stats/capture', async (req, res) => {
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
  });"""

content = content.replace(old_endpoint_2, new_endpoint_2)

with open('apps/orchestrator/src/server.ts', 'w') as f:
    f.write(content)

