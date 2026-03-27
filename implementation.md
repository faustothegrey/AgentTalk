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

## V1 Scope Contract

This document is the implementation contract for V1.

V1 includes:

- cmux-hosted agent sessions
- one Node orchestrator process
- polling-based terminal observation
- in-band `[NodePTY]:` control packets
- best-effort multi-agent routing
- transcript capture

V1 does not include:

- orchestrator crash reattachment
- guaranteed delivery
- streaming terminal reads
- hidden or out-of-band protocol channels
- terminal-only fallback without cmux

If a behavior is not described here, it should be treated as out of scope for V1 rather than inferred ad hoc during implementation.

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
  status: 'creating' | 'starting' | 'ready' | 'busy' | 'error' | 'terminated';
  
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

The registry entry for each agent should also track:

- `lastSeenText?: string`
- `lastSeenCursor?: string`
- `lastPollAt?: number`
- `lastProgressAt?: number`
- `launchCommand: string`
- `pendingRequests: Map<string, PendingRequest>`

V1 rule:

- use `lastSeenCursor` if the cmux adapter can provide a stable incremental cursor
- otherwise use `lastSeenText`

## 1.1 cmux Adapter Contract

The rest of the orchestrator should not call raw cmux commands directly. It should call a single adapter with the following contract:

```typescript
interface SurfaceReadResult {
  text: string;
  raw: string;
  cursor?: string;
}

interface CreatePaneResult {
  workspaceRef: string;
  paneRef: string;
  surfaceRef: string;
}

interface CmuxAdapter {
  createPane(splitDirection: 'right' | 'down', anchorSurfaceRef?: string): Promise<CreatePaneResult>;
  sendText(surfaceRef: string, text: string): Promise<void>;
  readSurface(surfaceRef: string): Promise<SurfaceReadResult>;
  notify(title: string, body?: string, surfaceRef?: string): Promise<void>;
}
```

This is the required internal interface even if the underlying cmux CLI changes.

The implementation may shell out to concrete cmux commands, but no code outside the adapter should know those command details.

### Concrete V1 command mapping

The V1 adapter should use these exact cmux commands:

- `createPane(...)`
  Uses `cmux new-split <left|right|up|down> [--workspace ...] [--surface ...]`
- `sendText(surfaceRef, text)`
  Uses `cmux send --surface <surfaceRef> <text>`
- `readSurface(surfaceRef)`
  Uses `cmux read-screen --surface <surfaceRef> --scrollback --lines <n>`
- `notify(title, body, surfaceRef?)`
  Uses `cmux notify --title <title> [--body <body>] [--surface <surfaceRef>]`

Compatibility note:

- `capture-pane` exists as a tmux-compatibility alias, but V1 should standardize on `read-screen`
- `send-panel` and `send-key-panel` exist, but V1 should standardize on `send --surface`

V1 should prefer explicit `--surface` / `--workspace` arguments over implicit environment defaults so the orchestrator remains deterministic.

### 1.1.1 Adapter shell implementation

The adapter should shell out with `execFile`, not `exec`, so argument quoting stays predictable.

Recommended helper:

```typescript
async function runCmux(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("cmux", args, {
    env: process.env,
    maxBuffer: 1024 * 1024,
  });

  return stdout.trimEnd();
}
```

V1 rule:

- all adapter methods call `runCmux`
- non-zero exit status becomes an adapter error
- adapter errors are surfaced to the orchestrator as operational failures, not silently retried inside the adapter

### 1.1.2 `createPane` implementation

Implementation shape:

```typescript
async function createPane(
  splitDirection: "right" | "down",
  anchorSurfaceRef?: string,
): Promise<CreatePaneResult> {
  const args = ["new-split", splitDirection];

  if (anchorSurfaceRef) {
    args.push("--surface", anchorSurfaceRef);
  }

  const output = await runCmux(args);
  return parseCreatePaneResult(output);
}
```

`parseCreatePaneResult(output)` must extract:

- `workspace:<n>`
- `pane:<n>`
- `surface:<n>`

from the command output.

If any of the three refs is missing, `createPane` must fail.

### 1.1.3 `sendText` implementation

Implementation shape:

```typescript
async function sendText(surfaceRef: string, text: string): Promise<void> {
  await runCmux(["send", "--surface", surfaceRef, text]);
}
```

Rules:

- `text` may contain embedded newlines
- protocol packets must always be sent with a trailing `\n`
- the caller, not the adapter, is responsible for appending the trailing newline required by the agent protocol

V1 standard:

- target terminal writes by `surfaceRef`
- do not target by pane when writing ordinary protocol traffic

### 1.1.4 `readSurface` implementation

Implementation shape:

```typescript
async function readSurface(surfaceRef: string): Promise<SurfaceReadResult> {
  const lines = "400";
  const raw = await runCmux([
    "read-screen",
    "--surface",
    surfaceRef,
    "--scrollback",
    "--lines",
    lines,
  ]);

  return {
    text: raw,
    raw,
  };
}
```

V1 read policy:

- use `read-screen`, not `capture-pane`
- always include `--scrollback`
- default to `--lines 400`
- return `cursor: undefined` because the current CLI help does not advertise a terminal cursor/offset for `read-screen`

That means V1 deduplication is text-based, not cursor-based.

### 1.1.5 `notify` implementation

Implementation shape:

```typescript
async function notify(
  title: string,
  body?: string,
  surfaceRef?: string,
): Promise<void> {
  const args = ["notify", "--title", title];

  if (body) {
    args.push("--body", body);
  }

  if (surfaceRef) {
    args.push("--surface", surfaceRef);
  }

  await runCmux(args);
}
```

Use `notify` for:

- readiness timeout
- consecutive read failures
- protocol parse errors
- agent termination events

## 1.2 Agent Lifecycle State Machine

Each agent must follow this state machine:

1. `creating`
   The orchestrator is creating the pane and capturing refs.
2. `starting`
   The pane exists and the launch command has been sent, but readiness has not been observed yet.
3. `ready`
   The agent has emitted a valid readiness packet.
4. `busy`
   The agent has at least one in-flight request owned by the orchestrator.
5. `error`
   The agent session exists, but the orchestrator has encountered a protocol or liveness failure.
6. `terminated`
   The agent is no longer considered controllable.

Allowed transitions:

- `creating -> starting`
- `starting -> ready`
- `starting -> error`
- `ready -> busy`
- `busy -> ready`
- `ready -> error`
- `busy -> error`
- `error -> starting`
- `creating | starting | ready | busy | error -> terminated`

V1 must not invent extra states during implementation.

## 2. Simplest Protocol Choice

For V1, the simplest implementation choice is an **in-band structured control protocol** carried through the agent terminal stream.

This is not the ideal long-term architecture, but it is the easiest path to a working system.

- Agent emits machine-readable control lines with a strict prefix.
- The orchestrator watches terminal output, extracts only those prefixed lines, and ignores normal terminal chatter.
- The orchestrator delivers responses and events back into the agent terminal as similarly prefixed lines.

This keeps the system buildable without inventing a separate side channel in the first iteration.

The important constraint is that the prefix format must be treated as reserved protocol output, not normal prose.

The protocol uses a **Request/Response/Event** model with unique IDs.

V1 reserves the prefix `[NodePTY]:`. Any line that begins with this prefix is protocol traffic, not user-visible terminal content.

### 2.1 Request Format (Agent -> Orchestrator)
The agent emits a single line to `stdout`:
`[NodePTY]:REQ:{"id":"uuid-123","call":"tool_name","args":{...}}`

### 2.2 Response Format (Orchestrator -> Agent)
The orchestrator writes back to the agent's `stdin`:
`[NodePTY]:RES:{"id":"uuid-123","status":"success"|"error","data":{...},"error":"..."}`

### 2.3 Event/Message Format (Orchestrator -> Agent)
For asynchronous updates (like messages from other agents):
`[NodePTY]:EVT:{"type":"message_received","from":"agent-b","payload":"..."}`

### 2.4 Ready Format (Agent -> Orchestrator)
An agent becomes `ready` only after emitting:
`[NodePTY]:READY:{"agentId":"agent-a","session":"uuid-123"}`

This is the only readiness signal V1 recognizes.

### 2.5 Delivery Convention
Responses and events are injected into the target pane as full protocol lines followed by a newline.

Example:
`cmux send --target pane:4 '[NodePTY]:EVT:{"type":"message_received","from":"agent-b","payload":"..."}'$'\n'`

The agent runtime is responsible for consuming these lines as control input instead of treating them as ordinary shell text.

V1 assumption:

- the launched `agent-cli` is protocol-aware
- the shell exists only to start the agent process
- once the agent is running, protocol traffic is intended for the agent, not for interactive human shell use

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

### Parsing rules

- ignore all lines that do not begin with `[NodePTY]:`
- treat malformed JSON as a protocol error on that agent
- process protocol lines in the order they appear in the unseen suffix
- never parse the same suffix twice
- never update cursor state before transcript write and parser completion both succeed

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

### 4.1.1 Launch contract

The orchestrator launch command must start the agent in non-interactive, protocol-aware mode.

Required launch shape:

```bash
cmux send --target pane:4 'zsh -lc "agent-cli --nodepty-v1"'$'\n'
```

The exact flag may differ in real code, but V1 requires one explicit launch mode that guarantees:

- the agent emits `[NodePTY]:READY:` when initialized
- the agent can receive injected `[NodePTY]:RES:` and `[NodePTY]:EVT:` lines
- startup banners do not suppress or delay readiness indefinitely

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

### 4.2.0 Polling defaults

V1 polling defaults are:

- poll interval: `250ms`
- startup readiness timeout: `15s`
- idle liveness timeout: `60s` without any newly observed text
- busy liveness timeout: `120s` without any newly observed text

These values should be configuration defaults, not hard-coded literals in business logic.

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

If three consecutive polls fail for the same agent, transition the agent to `error`.

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

### 5.3 Routing rules

V1 routing behavior is:

- reject sends to unknown agents immediately
- reject sends to agents in `error` or `terminated`
- allow sends to `ready` and `busy` agents
- serialize outbound writes per target agent
- preserve message order per target agent

Cross-agent global ordering is not required in V1.

## 6. Failure & Recovery

-   **Agent Crash:** Orchestrator detects that the target shell or `agent-cli` process is no longer responsive. It marks the agent `terminated`, notifies the user in the `cmux` pane, and may relaunch it by sending a fresh command through the pane shell.
-   **cmux Disconnect:** If `CMUX_SOCKET_PATH` becomes unreachable, the orchestrator loses control of the running agents. In V1, this is treated as a control-plane failure and requires manual recovery or orchestrator restart.
-   **Orchestrator Crash:** Agents may still be alive inside cmux, but V1 does not attempt to reconstruct full state from existing panes. Process survival is possible; orchestrator recovery is not implemented.

## 7. Startup and Readiness Flow

The startup sequence for one agent is:

1. create pane via the cmux adapter
2. register agent in `creating`
3. send launch command
4. transition to `starting`
5. begin polling `surfaceRef`
6. wait for `[NodePTY]:READY:` packet
7. transition to `ready`

If the readiness timeout expires before a valid `READY` packet is observed:

- transition the agent to `error`
- emit an orchestrator notification
- do not silently retry unless an explicit restart policy says to do so

## 8. Implementation Checklist

V1 is only considered complete when all of the following exist:

- a `CmuxAdapter` implementation
- a registry with explicit state transitions
- per-agent poll loops
- suffix-based deduplication
- transcript writing
- `READY`, `REQ`, `RES`, and `EVT` packet handling
- ordered per-agent outbound routing
- readiness and liveness timeouts
- explicit error transitions and notifications

## 9. Deferred Considerations (V2+)

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
