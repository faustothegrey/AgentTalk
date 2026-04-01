import { ProcessAdapterImpl } from './agents/process-adapter.js';
import { SessionRecorder } from './recordings/session-recorder.js';
import { Registry } from './registry.js';
import { startServer } from './server.js';

async function main() {
  const adapter = new ProcessAdapterImpl();
  const registry = new Registry(adapter);
  const recorder = process.env.AGENTTALK_RECORDING_PATH
    ? new SessionRecorder(process.env.AGENTTALK_RECORDING_PATH)
    : undefined;
  let shuttingDown = false;

  console.log('AgentTalk Orchestrator V1 started.');
  if (recorder) {
    console.log(`Recording runtime events to ${process.env.AGENTTALK_RECORDING_PATH}`);
  }

  const port = Number(process.env.PORT) || 3000;
  startServer(registry, port, recorder ? { recorder } : {});

  console.log('Ready to manage agents.');

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

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
