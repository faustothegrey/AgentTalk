import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@agenttalk/contracts/types': path.resolve(__dirname, 'packages/contracts/src/types.ts'),
      '@agenttalk/contracts/protocol-payloads': path.resolve(__dirname, 'packages/contracts/src/protocol-payloads.ts'),
      '@agenttalk/runtime-core': path.resolve(__dirname, 'packages/runtime-core/src'),
      '@agenttalk/runtime-scenarios': path.resolve(__dirname, 'packages/runtime-scenarios/src'),
      '@agenttalk/integration-google-drive': path.resolve(__dirname, 'packages/integration-google-drive/src'),
      '@agenttalk/observability': path.resolve(__dirname, 'packages/observability/src'),
    },
  },
  test: {
    include: ['apps/orchestrator/src/**/*.test.ts'],
    exclude: ['**/dist/**', 'apps/web/**'],
  },
});
