# NodePTY + cmux Implementation Design

This document specifies the technical implementation details for the Node orchestrator and its interaction with `node-pty` and `cmux`.

## 1. Orchestration State (The Registry)

The orchestrator maintains a singleton `Registry` to manage agent lifecycles.

```typescript
interface AgentSurface {
  paneId: string;        // cmux pane identifier
  workspaceId: string;   // cmux workspace identifier
  browserId?: string;    // optional associated browser surface
}

class Agent {
  readonly id: string;
  readonly pty: IPty;
  readonly surface: AgentSurface;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';
  
  private lineBuffer: string = '';
  private transcriptStream: WriteStream;

  constructor(id: string, pty: IPty, surface: AgentSurface) {
    this.id = id;
    this.pty = pty;
    this.surface = surface;
    this.transcriptStream = createWriteStream(`./transcripts/${id}.log`);
  }

  // Methods for I/O, status updates, and cleanup...
}

const registry = new Map<string, Agent>();
```

## 2. Structured Tool-Call Protocol (V2)

To ensure reliability, the protocol uses a **Request/Response/Event** model with unique IDs.

### 2.1 Request Format (Agent -> Orchestrator)
The agent emits a single line to `stdout`:
`[NodePTY]:REQ:{"id":"uuid-123","call":"tool_name","args":{...}}`

### 2.2 Response Format (Orchestrator -> Agent)
The orchestrator writes back to the agent's `stdin`:
`[NodePTY]:RES:{"id":"uuid-123","status":"success"|"error","data":{...},"error":"..."}`

### 2.3 Event/Message Format (Orchestrator -> Agent)
For asynchronous updates (like messages from other agents):
`[NodePTY]:EVT:{"type":"message_received","from":"agent-b","payload":"..."}`

## 3. The Parsing Engine (The "Hard Part")

The orchestrator must handle the fact that `pty.onData` provides "chunks," not necessarily full lines, and may contain ANSI escape codes.

### Algorithm:
1.  **Strip ANSI:** Use a library like `strip-ansi` or a regex to clean the incoming chunk.
2.  **Buffer:** Append the cleaned chunk to `agent.lineBuffer`.
3.  **Scan for Newlines:** If `\n` is found:
    - Extract the line.
    - Check for `[NodePTY]:` prefix.
    - If found, attempt JSON parse.
    - If parsing fails, log a "protocol error" and notify the agent via `stdin`.
4.  **Transcript:** Write the *un-stripped* raw output to the transcript file to preserve terminal formatting for playback.

## 4. cmux Integration Patterns

The orchestrator interacts with `cmux` primarily via its CLI.

### 4.1 Provisioning Panes
The actual cmux CLI uses `cmux new-split` and returns refs:
```bash
# Split the current pane — returns e.g. "OK surface:6 workspace:2"
cmux new-split right
cmux new-split down
```

The orchestrator should parse these responses to capture the returned refs.

### 4.2 PTY and cmux are separate layers
`node-pty` spawns the agent process directly — it does not run inside a cmux pane. cmux is used alongside for UI and browser control, not as the agent's process host.

```typescript
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  env: {
    ...process.env,
    AGENT_ID: id
  }
});
```

The orchestrator tracks the mapping between each agent's PTY and any associated cmux refs (pane, surface, browser) separately in the registry.

## 5. Multi-Agent Routing Logic

### 5.1 Discovery
Agents can query the registry via a tool call:
`[NodePTY]:REQ:{"id":"q1","call":"list_agents","args":{}}`

### 5.2 Delivery
Best-effort for now: the orchestrator writes the `EVT` packet to the target agent's `stdin`. No acknowledgment or retry logic in this phase.

## 6. Failure & Recovery

-   **Agent Crash:** Orchestrator detects `pty.onExit`. It marks the agent `terminated`, notifies the user in the `cmux` pane, and attempts a restart if the `RestartPolicy` allows.
-   **cmux Disconnect:** If `CMUX_SOCKET_PATH` becomes unreachable, the orchestrator should keep the PTYs alive but log that UI sync is suspended.

## 7. Refined Development Path

1.  **Alpha:** `node-pty` + `strip-ansi` + `line-buffer`. Verify tool calls from a simple bash script.
2.  **Beta:** `cmux` CLI integration. Automate workspace/pane creation.
3.  **V1:** Multi-agent `EVT` routing and `Agent` class implementation.
