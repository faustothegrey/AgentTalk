# Review of Phase 2 Implementation & Caveat Resolutions

**Status:** Completed / Sign-Off (2026-06-18)  
**Author:** Antigravity (with Fausto & Claude)  
**Related:** `design/mcp-implementation-plan.md`, `design/mcp-implementation-caveats.md`, `design/mcp-turn-loop-resolution.md`

This document reviews how the Phase 2 implementation matches the caveats and observations raised during the design phase, specifically looking at session isolation, crash propagation, configuration hygiene, and the resolution of Claude's config loading bug.

---

## 1. Stdio-Bridge-for-All Architecture (Caveat 1.1 / 1.2)

- **Requirement:** Replace the stdout line protocol with stdio child-process bridges to prevent direct WebSocket client configuration issues (e.g. Codex SSE failures or Claude direct client limits).
- **Resolution:** Implemented `scripts/mcp-bridge.mjs` to map stdin/stdout JSON-RPC streams directly over WebSockets. The orchestrator configures every persistent executor to use this bridge as the MCP server path.
- **Verification:** Both fast checks (5s) and full concurrency checks (180s) executed over this bridge succeed with Codex, Claude, and Gemini without socket dropped-connections.

---

## 2. Session Isolation & Hijack Prevention (Caveat 3.1 / R3)

- **Requirement:** Prevent session hijack by mapping connections to `agentId` query parameters, isolating session context, and rejecting duplicate connection requests.
- **Resolution:** Added session isolation inside `packages/runtime-core/src/shared/mcp-server.ts`. The server parses the `agentId` query parameter during the WS connection handshake and maps active connection sockets:
  ```typescript
  const existing = this.connections.get(agentId);
  if (existing && existing.readyState === WebSocket.OPEN) {
    console.warn(`[McpServer] Rejecting hijack attempt for agentId=${agentId}`);
    ws.close(4001, 'Session already active');
    return;
  }
  ```
- **Verification:** Reconnection is safe as dead sockets are closed/pruned, and active sessions cannot be hijacked by other concurrent agent processes. Direct unit tests covering hijack attempt rejections (code 4001) were added to `apps/orchestrator/src/__tests__/mcp-server.test.ts`.

---

## 3. Bridge Crash & Exit Propagation (Caveat 3.3 / §10C.3)

- **Requirement:** Register exit/crash handlers on the bridge to propagate failure immediately to the executor state-machine, triggering Milestone 03 failure propagation.
- **Resolution:**
  - Configured `scripts/mcp-bridge.mjs` to map WebSocket errors or abnormal socket closures (`ev.code !== 1000`, etc.) to non-zero exit codes.
  - Implemented the `onDisconnect` hook on `McpServer` and wired it to `Registry.handleMcpDisconnect()`. If a WebSocket connection drops while the agent is not in the `terminated` state, the Registry immediately transitions the agent to the `error` state.
- **Verification:**
  - Direct unit tests inside `mcp-server.test.ts` verify that closing the WebSocket connection triggers the `onDisconnect` callback with the correct `agentId`.
  - Registry tests in `registry.test.ts` verify that calling `handleMcpDisconnect()` transitions non-terminated agents to the `error` state, triggering immediate task interruption.

---

## 4. Configuration Path Generation & Cleanup (Caveat 4.1 / §10C.2)

- **Requirement:** Prevent configuration conflicts across concurrent agent processes by launching them with unique configuration directories, cleaning up files recursively upon exit.
- **Resolution:**
  - `ClaudePersistentExecutor` writes settings to a custom `mkdtempSync` path. To circumvent Claude MCP ignoring the config path inside `CLAUDE_CONFIG_DIR`, we pass the configuration path explicitly via `--mcp-config` and `--strict-mcp-config` MCP arguments.
  - `GeminiPersistentExecutor` writes settings inside a custom home path and sets `GEMINI_CLI_HOME`.
  - All temp folders are recursively deleted via `rmSync` inside the executor's `close()` hooks.
- **Verification:**
  - Unit tests in `apps/orchestrator/src/__tests__/executor-runtime.test.ts` assert that `mcp.json` is created, `--mcp-config` and `--strict-mcp-config` are appended to Claude Code's launch arguments, and temp folders are cleaned up on close.
  - Independent verification spikes prove Gemini and Claude MCP connections function correctly with this setup.

---

## 5. Gemini Workspace Trust (Caveat 4.3)

- **Requirement:** Prevent Gemini from disabling project-scoped MCP servers in untrusted working directories.
- **Resolution:** Gemini launchs include the environment setting `GEMINI_CLI_TRUST_WORKSPACE: 'true'`.
- **Verification:** The 7/7 capability spike confirms that Gemini successfully executes tool calls inside arbitrary temporary working directories when the trust variable is present.

---

## Conclusion

The Phase 2 implementation satisfies all core operational requirements and resolves all open items mapped to this phase. All verified bugs (including BUG-1) are resolved, and the unit test suite has been expanded to cover the agnostic server WebSocket protocol and disconnect routing.
