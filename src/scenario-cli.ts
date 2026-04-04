import { readFileSync } from 'fs';
import { ProcessAdapterImpl } from './agents/process-adapter.js';
import { createGoogleDriveServiceFromEnv } from './integrations/google-drive/from-env.js';
import { SessionRecorder } from './recordings/session-recorder.js';
import { Registry } from './registry/registry.js';
import { ScenarioRunner } from './scenarios/scenario-runner.js';
import type { ScenarioDefinition } from './scenarios/types.js';
import { startServer } from './server.js';

async function main() {
  const scenarioPath = process.argv[2];
  if (!scenarioPath) {
    console.error('Usage: npm run scenario -- <path/to/scenario.json>');
    process.exit(1);
  }

  let definition: ScenarioDefinition;
  try {
    definition = JSON.parse(readFileSync(scenarioPath, 'utf-8')) as ScenarioDefinition;
  } catch (err) {
    console.error(`Failed to read scenario file: ${scenarioPath}`, err);
    process.exit(1);
  }

  const adapter = new ProcessAdapterImpl();
  const registry = new Registry(adapter);
  const googleDrive = createGoogleDriveServiceFromEnv();
  const recorder = process.env.AGENTTALK_RECORDING_PATH
    ? new SessionRecorder(process.env.AGENTTALK_RECORDING_PATH)
    : undefined;
  let shuttingDown = false;

  const port = Number(process.env.PORT) || 3000;
  startServer(registry, port, {
    ...(recorder ? { recorder } : {}),
    ...(googleDrive ? { googleDrive } : {}),
  });

  console.log(`[Scenario] Server started on port ${port}`);
  console.log(`[Scenario] Launching scenario: ${definition.name}`);

  const runner = new ScenarioRunner();
  const result = await runner.run(definition, registry);

  console.log(`[Scenario] Scenario "${result.scenarioName}" — ${result.status}`);
  if (result.error) {
    console.error(`[Scenario] Error: ${result.error}`);
  }
  if (result.agentIds.length > 0) {
    console.log(`[Scenario] Agents: ${result.agentIds.join(', ')}`);
  }
  if (result.conversationIds.length > 0) {
    console.log(`[Scenario] Conversations: ${result.conversationIds.join(', ')}`);
  }
  if (result.teamIds.length > 0) {
    console.log(`[Scenario] Teams: ${result.teamIds.join(', ')}`);
  }

  console.log('[Scenario] Agents running. Open the Web UI or press Ctrl+C to stop.');

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down...`);
    try {
      await recorder?.close();
      await registry.destroy();
      adapter.destroyAll();
      process.exit(0);
    } catch (err) {
      console.error('Shutdown failed:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

  await new Promise<void>(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
