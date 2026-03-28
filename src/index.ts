import { CmuxAdapterImpl } from './cmux-adapter.js';
import { Registry } from './registry.js';
import { startServer } from './server.js';
import { ensureCmux } from './utils/shell.js';

async function main() {
  await ensureCmux();

  const adapter = new CmuxAdapterImpl();
  const registry = new Registry(adapter);
  let shuttingDown = false;

  console.log('NodePTY Orchestrator V1 started.');

  const port = Number(process.env.PORT) || 3000;
  startServer(registry, adapter, port);

  console.log('Ready to manage agents via cmux and Web UI.');

  // This is a minimal entry point.
  // In a real scenario, we might start a WebSocket server or a CLI repl here.
  
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down...`);
    try {
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
