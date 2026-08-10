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
    // `include` is an ALLOWLIST, and it is the operative gate — read this before changing either line.
    // Vitest collects `include` minus `exclude`, so a path no include glob matches cannot be un-excluded.
    //
    // `apps/web` IS NOT COLLECTED, and it is the include list that decides that, not the exclusion below.
    // Deleting 'apps/web/**' from `exclude` collects exactly ZERO new files — proven by execution
    // (BL-122, run hmp8): with a real test file placed under apps/web/src, collection was 0 files under
    // apps/web with the exclusion present and 0 with it deleted, 89 total either way. The exclusion is
    // REDUNDANT with this include list. It is kept only as a visible marker of the decision recorded below.
    //
    // THAT `apps/web` IS UNTESTED IS A DELIBERATE, RECORDED POSITION (PO, 2026-08-10), not an oversight:
    // the UI is thin enough to stay verified by eye. What is knowingly NOT verified — that the
    // `agent_non_reply` arm in App.tsx actually RENDERS its notice — and the condition under which this
    // reopens are written up in BL-122's closing block in design/backlog.md. Read that before reversing this.
    //
    // To bring apps/web in, you must ADD an include glob — and scope it to `apps/web/src/**`, NOT
    // `apps/web/**`: supplying this `exclude` array REPLACES vitest's defaultExclude, which is where
    // `**/node_modules/**` lives, and apps/web/node_modules exists on disk.
    include: ['apps/orchestrator/src/**/*.test.ts', 'packages/runtime-core/src/**/*.test.ts', 'packages/llm-client/src/**/*.test.ts', 'packages/mcp-transport/src/**/*.test.ts', 'packages/mcp-exec-server/src/**/*.test.ts', 'scripts/__tests__/**/*.test.mjs'],
    exclude: ['**/dist/**', 'apps/web/**'],
  },
});
