import { readFile } from 'fs/promises';
import path from 'path';
import { createGoogleDriveServiceFromEnv } from '@agenttalk/integration-google-drive/google-drive/from-env';
import { SessionRecorder } from '@agenttalk/observability/recordings/session-recorder';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { startServer } from './server.js';
import { attachDiagramTalkBridge } from './diagramtalk-bridge.js';
import { ScenarioRunner } from '@agenttalk/runtime-scenarios/scenarios/scenario-runner';
import type { ScenarioDefinition } from '@agenttalk/runtime-scenarios/scenarios/types';

async function main() {
  const registry = new Registry({
    readinessTimeoutMs: 30000,
  });
  // LB-21: optional live protocol-flow visualization. Off unless AGENTTALK_DIAGRAM_BRIDGE
  // is set; best-effort, never perturbs a run.
  if (attachDiagramTalkBridge(registry)) {
    console.log('DiagramTalk live-flow bridge attached.');
  }
  const googleDrive = createGoogleDriveServiceFromEnv();
  const recorder = process.env.AGENTTALK_RECORDING_PATH
    ? new SessionRecorder(process.env.AGENTTALK_RECORDING_PATH)
    : undefined;
  let shuttingDown = false;
  console.log('AgentTalk Orchestrator V1 started.');
  if (recorder) {
    console.log(`Recording runtime events to ${process.env.AGENTTALK_RECORDING_PATH}`);
  }
  if (googleDrive) {
    console.log('Google Drive integration configured.');
  }

  // Default deliberately off 3000 (BL-060): 3000 is the most contended port in
  // JS dev and is DiagramTalk's on the PO's machine. `apps/web/vite.config.ts`
  // reads the same `PORT` knob and the same default, so the two halves agree.
  const port = Number(process.env.PORT) || 3100;
  startServer(registry, port, {
    ...(recorder ? { recorder } : {}),
    ...(googleDrive ? { googleDrive } : {}),
  });

  console.log('Ready to manage agents.');

  const autostartScenario = process.env.AGENTTALK_AUTOSTART_SCENARIO;
  if (autostartScenario) {
    console.log(`Autostarting scenario: ${autostartScenario}`);
    const scenarioPath = path.resolve(process.cwd(), 'scenarios', `${autostartScenario}-conversation.json`);
    try {
      const content = await readFile(scenarioPath, 'utf8');
      const definition = JSON.parse(content) as ScenarioDefinition;
      const runner = new ScenarioRunner();
      
      // Run scenario in background so we don't block the main loop if it takes time
      void runner.run(definition, registry).then(result => {
        if (result.status === 'completed') {
          console.log(`[Autostart] Scenario "${result.scenarioName}" completed successfully.`);
        } else {
          console.error(`[Autostart] Scenario "${result.scenarioName}" failed with status ${result.status}: ${result.error}`);
        }
      });
    } catch (err) {
      console.error(`[Autostart] Failed to load/run scenario from ${scenarioPath}:`, err);
    }
  }

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down...`);
    try {
      await recorder?.close();
      await registry.destroy();
      process.exit(0);
    } catch (err) {
      console.error('Shutdown failed:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  // Keep the orchestrator process alive until it is explicitly terminated.
  await new Promise<void>(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
