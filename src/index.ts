import { ProcessAdapterImpl } from './process-adapter.js';
import { Registry } from './registry.js';
import { startServer } from './server.js';

async function main() {
  const adapter = new ProcessAdapterImpl();
  const registry = new Registry(adapter);
  let shuttingDown = false;

  console.log('NodePTY Orchestrator V1 started.');

  const port = Number(process.env.PORT) || 3000;
  startServer(registry, port);

  console.log('Ready to manage agents.');

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down...`);
    try {
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
