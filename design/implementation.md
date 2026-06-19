# AgentTalk Implementation Design

This document specifies the technical implementation details for the Node orchestrator and its interaction with agent processes.

## 1. System Model

`Node orchestrator -> child_process -> agent`

The orchestrator manages agent processes directly using the Node.js `child_process.spawn` module. The core of the system is the `ProcessAdapter`, which provides a unified interface for process control.

### 1.1 Process Adapter Contract

The orchestrator interacts with agent processes via the `ProcessAdapter` interface:

```typescript
export interface ProcessAdapter {
  spawn(id: string, command: string, options?: ProcessSpawnOptions): void;
  sendText(id: string, text: string): void;
  onData(id: string, callback: (chunk: string) => void): void;
  kill(id: string): void;
  onExit(callback: (id: string, code: number | null) => void): void;
}
```

The implementation (`ProcessAdapterImpl`) uses `child_process.spawn` with `shell: true` and streams `stdout`/`stderr` output via push-based `onData` callbacks. Each process can be spawned with an optional working directory (`cwd`) and custom environment variables.

## 2. Protocol Specification

Communication between the orchestrator and agents is line-oriented and uses the `[AgentTalk]:` prefix on the agent's standard I/O.

### 2.1 Message Format

Each message must be a single line:
`[AgentTalk]:TYPE:JSON`

Where `TYPE` is:
- **READY**: Signal from agent that initialization is complete.
- **REQ**: Request from agent to orchestrator.
- **RES**: Response (either direction).
- **EVT**: Asynchronous event.

### 2.2 Request Types

Agents can make the following requests to the orchestrator:
- `list_agents`: Enumerate all registered agents and their statuses.
- `send_to_agent`: Send a message to another agent (or `"user"` to route to the Web UI).
- `ack_healthcheck`: Acknowledge a healthcheck probe.
- `submit_plan`: Submit a plan during team planning phase.
- `submit_work_response`: Accept or refuse delegated work.
- `submit_work_result`: Report results of completed work.

### 2.3 Event Types

The orchestrator sends the following events to agents:
- `message_received`: A message from another agent.
- `conversation_start`: Notification that a conversation has begun.
- `healthcheck`: A liveness probe requiring acknowledgement.
- `busy_state`: Agent self-reports busy/idle transitions.
- `assign_task` / `delegate_work` / `revise_plan`: Team workflow events.

### 2.4 Orchestrator to Agent (via stdin)

The orchestrator writes directly to the agent's `stdin`. Protocol messages are always followed by a newline.

### 2.5 Agent to Orchestrator (via stdout/stderr)

Agents write protocol messages to `stdout`. The `ProcessOutputParser` processes incoming data chunks and extracts lines matching the `[AgentTalk]:` prefix.

## 3. Output Processing

### 3.1 ProcessOutputParser

Each agent has a dedicated `ProcessOutputParser` instance that receives raw data chunks from the process adapter and splits them into:
- **Protocol lines**: Lines containing `[AgentTalk]:` are routed to the Registry for handling.
- **Plain text**: Everything else is forwarded to the Web UI for terminal rendering.

The parser maintains a line buffer for incomplete lines and supports echo suppression for protocol messages written to the agent's stdin.

### 3.2 Echo Suppression

When the orchestrator sends a protocol line to an agent via stdin, the line may be echoed back in the process output. The parser's `expectEcho()` method registers expected echoes, which are then filtered from the output stream.

## 4. Agent Lifecycle and Status

The orchestrator tracks agent state:

- **creating**: Agent registered in the registry, process not yet spawned.
- **starting**: Process spawned, waiting for `READY` packet within a configurable timeout.
- **ready**: Agent is idle and responsive.
- **busy**: Agent is performing a task (signaled via `busy_state` event).
- **error**: Process failed to start, timed out on readiness, or exceeded the idle timeout while busy.
- **terminated**: Process has been killed or exited normally.

### 4.1 Idle Timeout

The Registry periodically checks busy agents for inactivity. If an agent has produced no output for longer than `agentIdleTimeoutMs`, it is moved to the `error` state.

### 4.2 Healthchecks

The `HealthcheckManager` sends healthcheck events to agents and tracks pending responses. Each healthcheck has a unique token and a configurable timeout. Agents respond via the `ack_healthcheck` request.

## 5. Multi-Agent Workflows

### 5.1 Conversations

The `ConversationCoordinator` manages multi-agent conversations:
- Conversations involve two or more agents discussing a topic.
- Each agent has a configurable maximum reply count.
- Messages are routed via `send_to_agent` requests and recorded in the transcript.
- Conversations are persisted to `transcripts/conversations.json`.

### 5.2 Teams

The `TeamCoordinator` manages planner/worker team workflows:
- Teams can be composed of a worker only, or a planner and worker.
- Tasks follow a lifecycle: `planning` -> `awaiting_confirmation` -> `delegated` -> `in_progress` -> `completed` (or `refused`).
- The user can confirm or reject plans with feedback, triggering re-planning.

## 6. Persistence and Reporting

### 6.1 Conversation Transcripts

Conversations between agents are tracked. Each conversation includes a transcript of system events and inter-agent messages. These are persisted to `transcripts/conversations.json`.

### 6.2 Web UI Integration

The orchestrator broadcasts events via WebSockets to the Web UI:
- `output`: Raw terminal output for rendering in xterm.js.
- `status`: Agent state transitions.
- `usage`: LLM token/cost tracking updates.
- `provider` / `model`: Agent provider and model metadata.
- `conversation`: Updates to active conversation states.
- `team` / `team_task` / `team_planning_complete`: Team workflow updates.
- `user_message`: Messages from agents addressed to the user.

### 6.3 Web UI Structure

The Web UI sidebar is organized into two top-level tabs:
- **Agents**: Lists active agents (with status, provider, model, and working directory), plus agent creation controls (working directory picker, provider/model selection).
- **Workflow**: Contains sub-tabs for multi-agent Chat (conversations) and Team management.

The main area displays either a terminal view for the selected agent or a conversation transcript view.
