# NodePTY + cmux Implementation Design

This document specifies the technical implementation details for the Node orchestrator and its interaction with `node-pty` and `cmux`.

## Chosen Direction

For the first implementation, the simplest coherent model is:

`Node orchestrator -> cmux pane/surface -> zsh -> agent-cli`

This is the explicit choice for now.

- Each agent instance lives inside a real cmux context.
- The shell hierarchy is `cmux -> zsh -> agent-cli`.
- The orchestrator uses the cmux CLI as the primary control surface.
- `node-pty` is not the primary host for the agent process in V1.

This choice is simpler than trying to split responsibility between a Node-owned PTY and a separate cmux UI layer. It matches the actual runtime model we want, and it avoids designing around a false distinction between "the real agent terminal" and "the cmux representation of that terminal".

The tradeoff is that the first version should not promise PTY reattachment or low-level terminal ownership from Node. The orchestrator is a controller and router around cmux-hosted agents, not the terminal host itself.

## 1. Orchestration State (The Registry)

The orchestrator maintains a singleton `Registry` to manage agent lifecycles.

```typescript
interface AgentSurface {
  workspaceRef: string;        // e.g. workspace:2
  paneRef: string;             // e.g. pane:4
  surfaceRef: string;          // e.g. surface:6
  browserSurfaceRef?: string;  // optional associated browser surface
}

class Agent {
  readonly id: string;
  readonly surface: AgentSurface;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';
  
  private lineBuffer: string = '';
  private transcriptStream: WriteStream;

  constructor(id: string, surface: AgentSurface) {
    this.id = id;
    this.surface = surface;
    this.transcriptStream = createWriteStream(`./transcripts/${id}.log`);
  }

  // Methods for I/O, status updates, and cleanup...
}

const registry = new Map<string, Agent>();
```

## 2. Simplest Protocol Choice

For V1, the simplest implementation choice is an **in-band structured control protocol** carried through the agent terminal stream.

This is not the ideal long-term architecture, but it is the easiest path to a working system.

- Agent emits machine-readable control lines with a strict prefix.
- The orchestrator watches terminal output, extracts only those prefixed lines, and ignores normal terminal chatter.
- The orchestrator delivers responses and events back into the agent terminal as similarly prefixed lines.

This keeps the system buildable without inventing a separate side channel in the first iteration.

The important constraint is that the prefix format must be treated as reserved protocol output, not normal prose.

The protocol uses a **Request/Response/Event** model with unique IDs.

### 2.1 Request Format (Agent -> Orchestrator)
The agent emits a single line to `stdout`:
`[NodePTY]:REQ:{"id":"uuid-123","call":"tool_name","args":{...}}`

### 2.2 Response Format (Orchestrator -> Agent)
The orchestrator writes back to the agent's `stdin`:
`[NodePTY]:RES:{"id":"uuid-123","status":"success"|"error","data":{...},"error":"..."}`

### 2.3 Event/Message Format (Orchestrator -> Agent)
For asynchronous updates (like messages from other agents):
`[NodePTY]:EVT:{"type":"message_received","from":"agent-b","payload":"..."}`

## 3. The Parsing Engine

The orchestrator does not receive a live PTY stream in V1. It receives polled terminal text via `readSurface(surfaceRef)`.

That means the parser input is:

- the newly observed suffix derived from the latest surface read
- not raw `pty.onData` chunks

### Algorithm:
1.  **Read surface:** Call `readSurface(surfaceRef)` for the agent.
2.  **Derive unseen text:** Compare the latest surface text to `lastSeenText` or `lastSeenCursor` and compute the newly observed suffix.
3.  **Strip ANSI:** Clean the unseen text with `strip-ansi` or an equivalent parser if the surface read includes terminal formatting sequences.
4.  **Buffer:** Append the cleaned unseen text to `agent.lineBuffer`.
5.  **Scan for Newlines:** If `\n` is found:
    - Extract the line.
    - Check for `[NodePTY]:` prefix.
    - If found, attempt JSON parse.
    - If parsing fails, log a "protocol error" and notify the agent via `cmux send`.
6.  **Transcript:** Write the newly observed raw text to the transcript file.

The parser should never process the full surface snapshot directly more than once. All parsing should operate on the deduplicated suffix only.

## 4. cmux Integration Patterns

The orchestrator interacts with `cmux` primarily via its CLI.

### 4.1 Provisioning panes and launching agents
The orchestrator should create a pane, capture the returned refs, and then start the agent inside that pane's shell context.

```bash
# Split the current pane — returns e.g. "OK pane:4 surface:6 workspace:2"
cmux new-split right

# Start the agent in the target pane through zsh
cmux send --target pane:4 'zsh -lc "agent-cli"'$'\n'
```

The orchestrator should parse these responses to capture the returned refs.

### 4.2 Read/write model
For the first version, the orchestrator should treat cmux as the terminal host.

- writes happen through `cmux send`
- reads happen through a single explicit surface-read adapter in the orchestrator
- the registry maps logical agent IDs to cmux refs

This is intentionally simpler than trying to keep a separate Node-owned PTY attached to the same live agent session.

The important implementation choice is to avoid multiple read paths. V1 should define one `readSurface(surfaceRef)` operation in the orchestrator and route all terminal observation through it.

That adapter should:

- call the chosen cmux capture primitive for the agent terminal surface
- return plain text for parser consumption
- preserve the raw response separately for transcript or debugging when useful
- hide cmux-specific command details from the rest of the routing code

The first version should assume **polling**, not streaming.

- writes are immediate via `cmux send`
- reads are periodic via `readSurface(surfaceRef)`
- the parser compares newly observed text against the prior cursor or offset for that agent

This is the simplest coherent control loop because it does not depend on cmux exposing a live event stream for terminal output.

### 4.2.1 Cursoring and duplicate suppression
Polling only works if the orchestrator has a stable way to avoid reprocessing old output.

For each agent, the registry should track:

- `lastSeenText`, if the capture API only gives whole-surface snapshots
- or `lastSeenCursor`, if the capture API exposes a stable offset, sequence, or timestamp

Preferred rule:

- if cmux exposes incremental reads, use them
- otherwise, read the full visible terminal text and compute the unseen suffix

V1 should favor correctness over efficiency. Full-surface polling is acceptable if that is the only reliable read primitive.

### 4.2.2 Polling loop
The orchestrator loop for each active agent should be:

1. read current terminal text from `surfaceRef`
2. compute newly appended text since the last successful read
3. append new text to the transcript
4. feed only the new text into the line buffer/parser
5. update the agent cursor state

If a poll fails, the orchestrator should:

- mark the read as failed
- keep the previous cursor state
- retry on the next interval

It should not advance cursor state on failed or partial reads.

### 4.2.3 Known limitation
This design assumes the agent protocol lines remain visible to the chosen surface-read primitive long enough to be observed.

That means V1 is best suited to:

- moderate terminal output volume
- explicit machine-readable control lines
- low fan-out multi-agent experiments

If high-volume terminal traffic causes protocol lines to scroll out of the readable surface before polling sees them, the next step is not "more parser logic"; the next step is introducing a real side channel or a direct PTY-owned runtime.

### 4.3 Browser coordination
Browser actions stay in the cmux layer.

- open browser surface
- navigate browser surface
- inspect elements
- perform clicks/fills/eval

The orchestrator should keep browser refs separate from the agent terminal surface ref.

## 5. Multi-Agent Routing Logic

### 5.1 Discovery
Agents can query the registry via a tool call:
`[NodePTY]:REQ:{"id":"q1","call":"list_agents","args":{}}`

### 5.2 Delivery
Best-effort for now: the orchestrator writes the `EVT` packet into the target agent's cmux-hosted terminal session. No acknowledgment or retry logic in this phase.

## 6. Failure & Recovery

-   **Agent Crash:** Orchestrator detects that the target shell or `agent-cli` process is no longer responsive. It marks the agent `terminated`, notifies the user in the `cmux` pane, and may relaunch it by sending a fresh command through the pane shell.
-   **cmux Disconnect:** If `CMUX_SOCKET_PATH` becomes unreachable, the orchestrator loses control of the running agents. In V1, this is treated as a control-plane failure and requires manual recovery or orchestrator restart.
-   **Orchestrator Crash:** Agents may still be alive inside cmux, but V1 does not attempt to reconstruct full state from existing panes. Process survival is possible; orchestrator recovery is not implemented.

## 8. Deferred Considerations (V2+)

These technical details are recognized but deferred to avoid V1 scope creep.

### 8.1 Advanced Deduplication
If `cmux` output is large and terminal buffers wrap, simple "new text" logic may fail. 
*   **Strategy:** Track a unique hash of the last 10 lines of seen text or use a stable `cmux` cursor sequence if available.

### 8.2 Protocol Security
Since the protocol is **in-band** (printed to the terminal), an agent could potentially "spoof" a response from the orchestrator.
*   **Strategy:** For V1, the orchestrator is the only entity parsing `REQ` from the agent. In V2, we may use a non-printable character sequence or a hidden side-channel.

### 8.3 Persistence Reattachment
If the Node process restarts, it does not currently attempt to "claim" existing `cmux` panes.
*   **Strategy:** Implement a `cmux` surface discovery loop to re-associate running panes with Agent IDs.
