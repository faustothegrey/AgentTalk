# NodePTY Implementation Design

This document specifies the technical implementation details for the Node orchestrator and its interaction with agent processes.

## 1. System Model

`Node orchestrator -> child_process -> agent`

The orchestrator manages agent processes directly using the Node.js `child_process.spawn` module. The core of the system is the `ProcessAdapter`, which provides a unified interface for process control.

### 1.1 Process Adapter Contract

The orchestrator interacts with agent processes via the `ProcessAdapter` interface:

```typescript
export interface ProcessAdapter {
  spawn(id: string, command: string): void;
  sendText(id: string, text: string): void;
  readOutput(id: string): string;
  kill(id: string): void;
  onExit(callback: (id: string, code: number | null) => void): void;
}
```

The current implementation (`ProcessAdapterImpl`) uses `child_process.spawn` with `shell: true` and buffers `stdout` and `stderr` into a single string per agent.

## 2. Protocol Specification

Communication between the orchestrator and agents is line-oriented and uses the `[NodePTY]:` prefix on the agent's standard I/O.

### 2.1 Message Format

Each message must be a single line:
`[NodePTY]:TYPE:JSON`

Where `TYPE` is:
- **READY**: Signal from agent that initialization is complete.
- **REQ**: Request from agent to orchestrator.
- **RES**: Response (either direction).
- **EVT**: Asynchronous event.

### 2.2 Orchestrator to Agent (via stdin)

The orchestrator writes directly to the agent's `stdin`. To avoid mixing with potential terminal output, protocol messages are always followed by a newline.

### 2.3 Agent to Orchestrator (via stdout/stderr)

Agents write protocol messages to `stdout`. The orchestrator polls for new output and parses lines matching the `[NodePTY]:` prefix.

## 3. Observation and Polling

The `Registry` implements a polling loop to observe agent output.

### 3.1 Deduplication

Since the `ProcessAdapter` buffers all output into a growing string, the `Registry` must deduplicate the output on each poll:

1.  Store `lastSeenClean` (stripped of ANSI codes).
2.  On next poll, get full `currentOutput`.
3.  Strip ANSI from `currentOutput` to get `currentClean`.
4.  If `currentClean` starts with `lastSeenClean`, the new text is `currentClean.slice(lastSeenClean.length)`.
5.  If it doesn't match (e.g., due to buffer wrapping or unexpected reset), the `Registry` triggers a "snapshot recovery" to parse all protocol lines from the new output.

### 3.2 Protocol Parsing

Newly observed text is appended to a per-agent `lineBuffer`. The orchestrator scans for complete lines and parses those starting with `[NodePTY]:`.

## 4. Agent Lifecycle and Status

The orchestrator tracks agent state:

- **starting**: Process spawned, waiting for `READY` packet.
- **ready**: Agent is idle and responsive.
- **busy**: Agent is performing a task (e.g., waiting for LLM).
- **error**: Process failed to start, timed out, or crashed.
- **terminated**: Process has been killed or exited normally.

## 5. Persistence and Reporting

### 5.1 Conversation Transcripts

Conversations between agents are tracked. Each conversation includes a transcript of system events and inter-agent messages. These are persisted to `transcripts/conversations.json`.

### 5.2 Web UI Integration

The orchestrator broadcasts events via WebSockets to the Web UI:
- `output`: Raw terminal output for rendering in xterm.js.
- `status`: Agent state transitions.
- `usage`: LLM token/cost tracking updates.
- `conversation`: Updates to active conversation states.
