/**
 * @agenttalk/llm-client — standalone chat-with-LLM core, extracted from runtime-core so a third-party
 * app can talk to an LLM without importing the consensus/orchestration stack.
 *
 * - `callApi` — zero-dep OpenAI-compatible provider HTTP call.
 * - `Completer` — the uniform plug (complete(prompt|messages) -> { text }); `ApiCompleter` is the
 *   direct-HTTP backing. An MCP-backed `Completer` (delegating to an external agent) is the Phase-2 piece.
 * - `ChatSession` — a thin multi-turn wrapper over any `Completer`.
 */
export { callApi } from './api-client.js';
export type { ApiProvider, ToolChoice, ApiCallArgs, ApiCallResult } from './api-client.js';
export { ApiCompleter } from './completer.js';
export type {
  Completer,
  CompleterResult,
  CompleterOptions,
  ChatMessage,
  StructuredToolBuilder,
} from './completer.js';
export { ChatSession } from './chat-session.js';
export type { ChatSessionOptions } from './chat-session.js';
export { McpChatCompleter, McpExecError, DEFAULT_EXEC_TIMEOUT_MS } from './mcp-chat-completer.js';
export type {
  ExecTransport,
  ExecTurn,
  ExecResult,
  McpChatCompleterOptions,
} from './mcp-chat-completer.js';
