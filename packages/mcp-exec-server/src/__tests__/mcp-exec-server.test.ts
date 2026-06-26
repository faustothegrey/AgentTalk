import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { McpExecServer } from '../mcp-exec-server.js';
import { McpChatCompleter } from '@agenttalk/llm-client';

/**
 * End-to-end loop over a REAL WebSocket: an echoing executor (standing in for agentalk-mcp-client)
 * connects, long-polls `await_turn`, and returns `submit_exec_result`. An McpChatCompleter drives it
 * through McpExecServer.transport(). Proves McpServer + McpExecServer + ExecTurnQueue + transport +
 * McpChatCompleter wire together — no CLI, no consensus, no Registry.
 */
describe('McpExecServer (end-to-end over WebSocket)', () => {
  let server: McpExecServer | null = null;
  let client: WebSocket | null = null;

  afterEach(async () => {
    if (client) { try { client.close(); } catch { /* noop */ } client = null; }
    if (server) { await server.close(); server = null; }
  });

  /** Minimal JSON-RPC-over-WS client that mimics an executor: echoes each turn's prompt back. */
  function connectEchoExecutor(port: number, agentId: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:${port}/?agentId=${agentId}`);
    let nextId = 1;
    const pending = new Map<number, (result: any) => void>();

    const call = (method: string, params: any): Promise<any> => {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      });
    };
    // Tools go via the MCP `tools/call` envelope (name + arguments), as a real MCP client does.
    const callTool = (name: string, args: any): Promise<any> => call('tools/call', { name, arguments: args });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)!(msg.result);
        pending.delete(msg.id);
      }
    });

    return new Promise((resolve) => {
      ws.on('open', async () => {
        await call('initialize', { protocolVersion: '2024-11-05', clientInfo: { name: 'echo' } });
        // Executor loop: pull a turn, echo its prompt, submit the result. One turn is enough here.
        void (async () => {
          const res = await callTool('await_turn', {});
          const turn = JSON.parse(res.content[0].text);
          await callTool('submit_exec_result', {
            text: `echo: ${turn.prompt}`,
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          });
        })();
        resolve(ws);
      });
    });
  }

  it('completes a chat turn through a connected executor', async () => {
    server = new McpExecServer({ pingIntervalMs: 60_000 });
    const port = await server.start(0);

    client = await connectEchoExecutor(port, 'agent-1');

    const completer = new McpChatCompleter(server.transport('agent-1'), { defaultTimeoutMs: 5_000 });
    const result = await completer.complete('hello world');

    expect(result.text).toBe('echo: hello world');
    expect(result.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1 });
  });

  it('rejects with a typed timeout when no executor answers', async () => {
    server = new McpExecServer({ pingIntervalMs: 60_000 });
    await server.start(0);
    // No client connects -> the dispatched turn is never pulled -> timeout.
    const completer = new McpChatCompleter(server.transport('lonely'), { defaultTimeoutMs: 150 });
    await expect(completer.complete('anyone there?')).rejects.toMatchObject({
      name: 'McpExecError',
      reason: 'timeout',
    });
  });
});
