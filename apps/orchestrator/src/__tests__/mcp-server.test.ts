import { describe, expect, it, vi, afterEach } from 'vitest';
import { McpServer } from '../mcp-server.js';
import WebSocket from 'ws';

describe('McpServer', () => {
  let mcpServer: McpServer | null = null;

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.close();
      mcpServer = null;
    }
  });

  const dummyTools = [
    {
      name: 'hello_tool',
      description: 'says hello',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  it('should list tools and route tool calls to the handler', async () => {
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'hello result' }] });
    mcpServer = new McpServer({
      tools: dummyTools,
      handler,
    });

    const port = await mcpServer.start(0);
    const ws = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-1`);

    await new Promise<void>((resolve) => ws.once('open', resolve));

    // Send initialize request
    const initResponse = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }));
    });

    expect(initResponse.id).toBe(1);
    expect(initResponse.result.serverInfo.name).toBe('agenttalk-mcp-server');

    // Send tools/list request
    const listResponse = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }));
    });

    expect(listResponse.id).toBe(2);
    expect(listResponse.result.tools).toEqual(dummyTools);

    // Send tools/call request
    const callResponse = await new Promise<any>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'hello_tool', arguments: { arg1: 'val1' } },
      }));
    });

    expect(callResponse.id).toBe(3);
    expect(callResponse.result).toEqual({ content: [{ type: 'text', text: 'hello result' }] });
    expect(handler).toHaveBeenCalledWith('agent-1', 'hello_tool', { arg1: 'val1' });

    ws.close();
  });

  it('should reject a new connection when the existing session is live (R3)', async () => {
    // Two live clients on one agentId must NOT take over each other (that ping-pongs into
    // a reconnect war). The live session is protected; the newcomer is rejected with 4001.
    mcpServer = new McpServer({
      tools: dummyTools,
      handler: vi.fn(),
    });

    const port = await mcpServer.start(0);
    const ws1 = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-2`);
    await new Promise<void>((resolve) => ws1.once('open', resolve));

    // ws1 is live and auto-replies to pings, so the liveness probe sees it as alive.
    const ws2 = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-2`);
    const ws2CloseCode = await new Promise<number>((resolve) => ws2.once('close', resolve));

    expect(ws2CloseCode).toBe(4001); // newcomer rejected
    expect(ws1.readyState).toBe(WebSocket.OPEN); // live session preserved

    ws1.close();
  });

  it('should take over a stale (unresponsive) connection so a reconnect recovers', async () => {
    mcpServer = new McpServer({
      tools: dummyTools,
      handler: vi.fn(),
    });

    const port = await mcpServer.start(0);
    const ws1 = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-2b`);
    await new Promise<void>((resolve) => ws1.once('open', resolve));

    // Simulate a zombie: pause ws1's socket so it stops auto-replying to pings while its
    // readyState still reads OPEN (mirrors a hard-killed client whose socket lingers).
    ws1.pause();

    const ws2 = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-2b`);
    await new Promise<void>((resolve) => ws2.once('open', resolve));

    // Send initialize immediately — during the server's liveness probe of ws1. It must be
    // buffered (ws2 paused server-side) and drained after takeover + resume, proving both
    // the takeover and the pause/resume message-drain race are handled.
    const initResponse = await new Promise<any>((resolve) => {
      ws2.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws2.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }));
    });

    expect(initResponse.id).toBe(1);
    expect(initResponse.result.serverInfo.name).toBe('agenttalk-mcp-server'); // takeover succeeded

    ws1.resume();
    ws1.close();
    ws2.close();
  });

  it('should call onDisconnect when the active WebSocket connection is closed', async () => {
    const onDisconnect = vi.fn();
    mcpServer = new McpServer({
      tools: dummyTools,
      handler: vi.fn(),
      onDisconnect,
    });

    const port = await mcpServer.start(0);
    const ws = new WebSocket(`ws://localhost:${port}/mcp?agentId=agent-3`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.close();
    await new Promise<void>((resolve) => ws.once('close', () => resolve()));

    // Wait a brief tick for the onDisconnect callback to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onDisconnect).toHaveBeenCalledWith('agent-3', 1005, '');
  });
});
