/**
 * @agenttalk/mcp-exec-server — a standalone, consensus-free MCP attach server for plain LLM chat
 * through an external executor (an agentalk-mcp-client driving a CLI). Reuses the generic
 * @agenttalk/mcp-transport McpServer and injects only the exec subset (await_turn +
 * submit_exec_result). Pair `McpExecServer.transport(agentId)` with `McpChatCompleter` from
 * @agenttalk/llm-client.
 */
export { McpExecServer } from './mcp-exec-server.js';
export type { McpExecServerOptions } from './mcp-exec-server.js';
export { ExecTurnQueue } from './exec-turn-queue.js';
export type { WireExecTurn } from './exec-turn-queue.js';
export { EXEC_TOOLS } from './exec-tools.js';
