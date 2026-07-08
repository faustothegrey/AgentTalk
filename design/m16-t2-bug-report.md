# M16-T2 Bug Report: Healthcheck Handling Blocks Live Attach

## Context
During the implementation of M16-T2 (Live orchestrator attach proof), the objective was to prove baton transport through the real orchestrator attach server using external client sessions. The test successfully launches the orchestrator, connects external MCP clients, and routes the `start_pair_chat` WebSocket command.

However, the conversation fails to start because both agents time out during the mandatory `healthcheck` phase, resulting in the error:
`Error: Agent sender did not respond to healthcheck within 30000ms`

## Root Cause Analysis

Tracing the healthcheck lifecycle revealed two critical bugs in the core runtime:

### 1. Missing `healthcheck_ack` handler in Registry
When the orchestrator starts a conversation, it sends an `EVT` of type `healthcheck` to the agent. The agent is expected to respond with the `healthcheck_ack` MCP tool.
- `packages/runtime-core/src/registry/registry.ts` correctly lists `'healthcheck_ack'` in its `supportedMcpTools` array (line 51).
- However, the `handleMcpToolCall` method completely lacks a `case 'healthcheck_ack':` block.
- Because it falls through to the `default` block, the registry throws `Unknown MCP tool call: healthcheck_ack`.
- The `this.healthchecks.resolve(token, agentId, message)` method (from `HealthcheckManager`) is never called anywhere in `registry.ts`, meaning the healthcheck promise never resolves and always times out.

### 2. Typo in `InProcessAgentDriver` Translation Layer
While the M16-T2 test script uses a pure MCP client, the `InProcessAgentDriver` (used by `gemini` and `claude` providers) has a separate translation layer that translates the LLM's structured JSON response back into an MCP tool call.
- In `packages/runtime-core/src/conversations/runtime.ts` (line 235), the `buildProtocolRequest` method hardcodes the call name for healthchecks as `ack_healthcheck` instead of `healthcheck_ack`:
  ```typescript
  if (evt.type === 'healthcheck') {
    return {
      id: reqId,
      call: 'ack_healthcheck', // <-- Typo here
      args: { token: evt.token, message: reply },
    };
  }
  ```
- As a result, the built-in driver also fails with `Unknown MCP tool call: ack_healthcheck` when trying to respond to a healthcheck.

## Required Fixes (Scope Widening)
To unblock M16-T2 and ensure healthchecks work for both external MCP clients and built-in drivers:
1. **`registry.ts`**: Add a `case 'healthcheck_ack':` block in `handleMcpToolCall` that extracts the token and calls `this.healthchecks.resolve(args.token, agent.id, args.message)`.
2. **`runtime.ts`**: Fix the typo in `buildProtocolRequest` to emit `call: 'healthcheck_ack'` instead of `ack_healthcheck`.

These changes modify the core orchestrator runtime and are outside the bounds of the test-script implementation assigned in M16-T2.
