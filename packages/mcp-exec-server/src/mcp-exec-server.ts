import { McpServer } from '@agenttalk/mcp-transport';
import type { ExecTransport, ExecTurn } from '@agenttalk/llm-client';
import { EXEC_TOOLS } from './exec-tools.js';
import { ExecTurnQueue } from './exec-turn-queue.js';

export interface McpExecServerOptions {
  /** ws ping interval (forwarded to McpServer). */
  pingIntervalMs?: number;
  /**
   * Optional contract-hash gate. v1 default UNSET — any exec client may attach (the exec subset is a
   * strict subset, so a full agentalk-mcp-client still works). Set to enforce a specific contract.
   */
  expectedContractHash?: string;
}

/**
 * Standalone, consensus-free MCP attach server for plain LLM chat through an external executor.
 *
 * Reuses the generic {@link McpServer} (sockets / JSON-RPC / ping / hijack handling) and injects ONLY
 * the exec subset — `await_turn` + `submit_exec_result` — backed by one {@link ExecTurnQueue} per
 * connected agentId. A consumer drives it through {@link McpExecServer.transport}, which yields an
 * `ExecTransport` an `McpChatCompleter` (from `@agenttalk/llm-client`) completes turns over.
 *
 * No Registry, no teams, no consensus tools — a third-party app gets MCP-executor chat with none of
 * that in its dependency tree.
 */
export class McpExecServer {
  private readonly server: McpServer;
  private readonly queues = new Map<string, ExecTurnQueue>();

  constructor(opts: McpExecServerOptions = {}) {
    const serverOpts: ConstructorParameters<typeof McpServer>[0] = {
      tools: EXEC_TOOLS,
      handler: (agentId, name, args) => this.handle(agentId, name, args),
      onDisconnect: (agentId) => this.queues.get(agentId)?.handleDisconnect(),
    };
    if (opts.pingIntervalMs !== undefined) serverOpts.pingIntervalMs = opts.pingIntervalMs;
    if (opts.expectedContractHash !== undefined) serverOpts.expectedContractHash = opts.expectedContractHash;
    this.server = new McpServer(serverOpts);
  }

  /** Start listening. Returns the bound port (mirrors McpServer.start). */
  start(port: number): Promise<number> {
    return this.server.start(port);
  }

  close(): Promise<void> {
    return this.server.close();
  }

  /** The (lazily-created) queue for an agentId. */
  private queue(agentId: string): ExecTurnQueue {
    let q = this.queues.get(agentId);
    if (!q) {
      q = new ExecTurnQueue();
      this.queues.set(agentId, q);
    }
    return q;
  }

  /** Route the two exec tools to the agent's queue, returning the MCP content envelope. */
  private async handle(agentId: string, name: string, args: any): Promise<unknown> {
    const q = this.queue(agentId);
    if (name === 'await_turn') {
      const turn = await q.awaitTurn();
      return { content: [{ type: 'text', text: JSON.stringify(turn) }] };
    }
    if (name === 'submit_exec_result') {
      q.submitResult({ text: args.text, usage: args.usage });
      return { content: [{ type: 'text', text: 'Exec result submitted successfully' }] };
    }
    throw new Error(`Unknown exec tool: ${name}`);
  }

  /**
   * An {@link ExecTransport} bound to one agentId — hand it to an `McpChatCompleter`. `dispatch`
   * wraps the turn into the `exec_rpc` wire shape the executor expects; `onResult`/`onDisconnect`
   * subscribe to that agent's queue.
   */
  transport(agentId: string): ExecTransport {
    const q = this.queue(agentId);
    return {
      dispatch: (turn: ExecTurn) => {
        const wire = { type: 'exec_rpc' as const, prompt: turn.prompt, ...(turn.cwd !== undefined ? { cwd: turn.cwd } : {}), ...(turn.timeoutMs !== undefined ? { timeoutMs: turn.timeoutMs } : {}) };
        q.dispatch(wire);
      },
      onResult: (cb) => q.onResult(cb),
      onDisconnect: (cb) => q.onDisconnect(cb),
    };
  }
}
