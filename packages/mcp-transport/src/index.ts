/**
 * @agenttalk/mcp-transport — the generic WebSocket / JSON-RPC MCP attach server.
 *
 * A consensus-agnostic transport: it owns sockets, JSON-RPC framing, ping/liveness, the optional
 * contract-hash gate, and stale-session takeover. ALL domain behaviour is injected via `tools` +
 * `handler`. The orchestrator injects the full consensus tool-set; @agenttalk/mcp-exec-server injects
 * a lean exec-only tool-set. Neither the server nor this package knows anything about consensus.
 */
export { McpServer } from './mcp-server.js';
export type { McpToolDefinition, McpToolHandler } from './mcp-server.js';
