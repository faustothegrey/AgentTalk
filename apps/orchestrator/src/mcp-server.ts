import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export type McpToolHandler = (agentId: string, name: string, args: any) => Promise<any>;

export class McpServer {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WebSocket>();
  private tools: McpToolDefinition[] = [];
  private handler: McpToolHandler;
  private pingIntervalMs = 20000;
  private expectedContractHash?: string;

  private onDisconnect?: ((agentId: string, code: number, reason: string) => void) | undefined;
  private onConnect?: ((agentId: string) => void) | undefined;

  constructor(options: {
    tools: McpToolDefinition[];
    handler: McpToolHandler;
    pingIntervalMs?: number;
    expectedContractHash?: string;
    onDisconnect?: (agentId: string, code: number, reason: string) => void;
    onConnect?: (agentId: string) => void;
  }) {
    this.tools = options.tools;
    this.handler = options.handler;
    if ('expectedContractHash' in options) {
      this.expectedContractHash = options.expectedContractHash;
    }
    if ('onDisconnect' in options) {
      this.onDisconnect = options.onDisconnect;
    }
    if ('onConnect' in options) {
      this.onConnect = options.onConnect;
    }
    if (options.pingIntervalMs !== undefined) {
      this.pingIntervalMs = options.pingIntervalMs;
    }
  }

  start(serverOrPort: Server | number): Promise<number> {
    return new Promise((resolve) => {
      const wssOptions: any = {};
      if (typeof serverOrPort === 'number') {
        wssOptions.port = serverOrPort;
      } else {
        wssOptions.server = serverOrPort;
        wssOptions.path = '/mcp';
      }

      this.wss = new WebSocketServer(wssOptions);

      this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url || '', 'http://localhost');
        const agentId = url.searchParams.get('agentId') || 'unknown';

        // Session isolation & hijack check (R3), liveness-gated takeover.
        // A genuinely-live existing session is protected (reject 4001 — two clients on
        // one agentId must NOT take over each other, or they ping-pong into a reconnect
        // war). A stale/zombie socket (e.g. a hard-killed client whose socket lingers
        // OPEN until the ping-timeout) is taken over so a legitimate reconnect recovers.
        const existing = this.connections.get(agentId);
        let resumeAfterSetup = false;
        if (existing) {
          // Pause the newcomer so its `initialize` isn't lost during the async probe;
          // buffered frames drain once handlers are attached + ws.resume() (end of setup).
          ws.pause();
          resumeAfterSetup = true;
          const existingAlive =
            existing.readyState === WebSocket.OPEN ? await this.probeLiveness(existing) : false;
          if (existingAlive) {
            console.warn(`[McpServer] Rejecting connection for agentId=${agentId}: existing session is live`);
            ws.resume(); // un-pause so the close handshake is actually delivered
            ws.close(4001, 'Session already active');
            return;
          }
          console.warn(`[McpServer] Taking over stale connection for agentId=${agentId}`);
          this.connections.delete(agentId);
          // Force an immediate disconnect event so the registry can requeue any active turn
          // BEFORE the new connection is accepted. The old socket's later 'close' is a no-op
          // (this.connections no longer maps to it).
          this.onDisconnect?.(agentId, 1006, 'Connection superseded');
          try {
            existing.terminate();
          } catch {
            // noop
          }
        }

        try {
          if (this.onConnect) {
            this.onConnect(agentId);
          }
        } catch (err) {
          console.warn(`[McpServer] Rejecting connection for agentId=${agentId}:`, err);
          ws.close(4003, err instanceof Error ? err.message : String(err));
          return;
        }

        this.connections.set(agentId, ws);
        console.log(`[McpServer] Connection established for agentId=${agentId}`);

        // Keep-alive setup
        let isAlive = true;
        ws.on('pong', () => {
          isAlive = true;
        });

        const pinger = setInterval(() => {
          if (!isAlive) {
            console.warn(`[McpServer] Connection lost for agentId=${agentId} (ping timeout)`);
            ws.terminate();
            clearInterval(pinger);
            return;
          }
          isAlive = false;
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        }, this.pingIntervalMs);

        ws.on('message', async (data) => {
          let request: any;
          try {
            request = JSON.parse(data.toString());
          } catch (err) {
            console.error(`[McpServer] Failed to parse message for agentId=${agentId}:`, err);
            return;
          }

          const { jsonrpc, id, method, params } = request;
          if (jsonrpc !== '2.0') {
            return;
          }

          if (method === 'initialize') {
            if (this.expectedContractHash) {
              const clientHash = params?.clientInfo?.contractHash;
              if (!clientHash || clientHash !== this.expectedContractHash) {
                console.error(`[McpServer] Rejecting agentId=${agentId}: contract hash mismatch. Expected ${this.expectedContractHash}, got ${clientHash}`);
                this.sendError(ws, id, -32000, `Contract hash mismatch. Expected ${this.expectedContractHash}, got ${clientHash}`);
                ws.close(1008, 'Contract hash mismatch');
                return;
              }
            }

            this.sendResponse(ws, id, {
              protocolVersion: params?.protocolVersion || '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'agenttalk-mcp-server', version: '1.0.0' },
            });
            return;
          }

          if (method === 'notifications/initialized' || method === 'initialized') {
            return;
          }

          if (method === 'tools/list') {
            this.sendResponse(ws, id, { tools: this.tools });
            return;
          }

          if (method === 'tools/call') {
            const name = params?.name;
            const args = params?.arguments || {};

            const toolExists = this.tools.some((t) => t.name === name);
            if (!toolExists) {
              this.sendError(ws, id, -32601, `Method not found: ${name}`);
              return;
            }

            try {
              const result = await this.handler(agentId, name, args);
              this.sendResponse(ws, id, result);
            } catch (err: any) {
              console.error(`[McpServer] Error calling tool ${name} for agentId=${agentId}:`, err);
              this.sendError(ws, id, -32603, err?.message || String(err));
            }
            return;
          }

          // Unknown method
          if (id !== undefined) {
            this.sendError(ws, id, -32601, `Method not found: ${method}`);
          }
        });

        ws.on('close', (code, reason) => {
          clearInterval(pinger);
          const wasActive = this.connections.get(agentId) === ws;
          if (wasActive) {
            this.connections.delete(agentId);
          }
          console.log(`[McpServer] Connection closed for agentId=${agentId} (code: ${code})`);
          if (wasActive) {
            this.onDisconnect?.(agentId, code, reason ? reason.toString() : '');
          }
        });

        ws.on('error', (err) => {
          console.error(`[McpServer] Socket error for agentId=${agentId}:`, err);
        });

        // Handlers are now attached; drain any frames buffered during the takeover probe.
        if (resumeAfterSetup) {
          ws.resume();
        }
      });

      if (typeof serverOrPort === 'number') {
        this.wss.on('listening', () => {
          const address = this.wss?.address();
          const port = typeof address === 'object' && address ? address.port : serverOrPort;
          resolve(port);
        });
      } else {
        resolve(0); // bound to http server
      }
    });
  }

  async close(): Promise<void> {
    if (this.wss) {
      for (const ws of this.wss.clients) {
        ws.close();
      }
      const wss = this.wss;
      this.wss = null;
      return new Promise<void>((resolve, reject) => {
        wss.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  // Actively probe whether a socket is alive: ping it and wait briefly for a pong.
  // Used to distinguish a genuinely-live session (protect it) from a zombie whose
  // readyState still reads OPEN because the abrupt drop hasn't been detected yet.
  private probeLiveness(ws: WebSocket, timeoutMs = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      if (ws.readyState !== WebSocket.OPEN) {
        resolve(false);
        return;
      }
      let settled = false;
      const finish = (alive: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.off('pong', onPong);
        resolve(alive);
      };
      const onPong = () => finish(true);
      const timer = setTimeout(() => finish(false), timeoutMs);
      ws.on('pong', onPong);
      try {
        ws.ping();
      } catch {
        finish(false);
      }
    });
  }

  private sendResponse(ws: WebSocket, id: any, result: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }
  }

  private sendError(ws: WebSocket, id: any, code: number, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
    }
  }
}
