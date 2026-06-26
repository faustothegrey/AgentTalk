import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@agenttalk/contracts/types': path.resolve(__dirname, 'packages/contracts/src/types.ts'),
      '@agenttalk/contracts/protocol-payloads': path.resolve(__dirname, 'packages/contracts/src/protocol-payloads.ts'),
      '@agenttalk/llm-client': path.resolve(__dirname, 'packages/llm-client/src'),
      '@agenttalk/mcp-transport': path.resolve(__dirname, 'packages/mcp-transport/src'),
      '@agenttalk/mcp-exec-server': path.resolve(__dirname, 'packages/mcp-exec-server/src'),
      '@agenttalk/runtime-core': path.resolve(__dirname, 'packages/runtime-core/src'),
      '@agenttalk/runtime-scenarios': path.resolve(__dirname, 'packages/runtime-scenarios/src'),
      '@agenttalk/integration-google-drive': path.resolve(__dirname, 'packages/integration-google-drive/src'),
      '@agenttalk/observability': path.resolve(__dirname, 'packages/observability/src'),
    },
  },
  test: {
    include: ['apps/orchestrator/src/**/*.test.ts', 'packages/runtime-core/src/**/*.test.ts', 'packages/llm-client/src/**/*.test.ts', 'packages/mcp-transport/src/**/*.test.ts', 'packages/mcp-exec-server/src/**/*.test.ts'],
    exclude: ['**/dist/**', 'apps/web/**'],
  },
});
