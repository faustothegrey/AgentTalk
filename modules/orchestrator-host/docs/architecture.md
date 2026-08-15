# AgentTalk Architecture

AgentTalk is an orchestrator for LLM-based agents. It manages the lifecycle, communication, and observation of agent processes.

## System Model

`Node orchestrator -> child_process -> agent`

- **Node orchestrator**: Provides orchestration, routing, policy, and state tracking.
- **child_process**: Node's built-in module for launching and managing sub-processes.
- **Agent**: The LLM-driven MCP process (e.g., `agent-mcp`) that performs tasks and communicates via the AgentTalk protocol.

## Process Management

The Node orchestrator owns agent processes directly. It uses Node's `child_process` module to launch agents and manages their standard I/O streams (`stdin`, `stdout`, `stderr`). Each agent can be assigned a per-agent working directory at launch time.

### Process Adapter

The `ProcessAdapter` abstracts the low-level process management:
- **Launching**: Launches the agent command in a shell, with optional working directory and environment overrides.
- **Input**: Writes directly to the process's `stdin`.
- **Output**: Streams output from `stdout` and `stderr` via push-based `onData` callbacks.
- **Lifecycle**: Monitors process exit and allows killing processes.

## Output Processing

### Push-based Streaming

The orchestrator uses a push-based streaming model (not polling) to observe agent output:
1. The `ProcessAdapter` emits data chunks via `onData` callbacks as they arrive from the process.
2. A `ProcessOutputParser` per agent splits incoming data into protocol lines and plain text.
3. Protocol lines (prefixed with `[AgentTalk]:`) are routed to the Registry for handling.
4. Plain text output is forwarded to the Web UI via WebSockets for real-time terminal rendering.

### Echo Suppression

When the orchestrator writes a protocol message to an agent's `stdin`, it may be echoed back in the output. The `ProcessOutputParser` tracks expected echoes and suppresses them to avoid double-processing.

### Protocol

Communication between the orchestrator and agents happens over the standard I/O streams using a line-based protocol:

`[AgentTalk]:TYPE:JSON_PAYLOAD`

- **READY**: Signal from agent that initialization is complete.
- **REQ**: Request from agent to orchestrator (e.g., `list_agents`, `send_to_agent`, `ack_healthcheck`, `submit_plan`, `submit_work_response`, `submit_work_result`).
- **RES**: Response from orchestrator to agent (or vice versa).
- **EVT**: Asynchronous events (e.g., `message_received`, `conversation_start`, `healthcheck`, `busy_state`).

## State and Persistence

- **Agents**: Tracked in-memory by the `Registry`. Status transitions (`creating`, `starting`, `ready`, `busy`, `error`, `terminated`) are managed based on process events and protocol signals.
- **Conversations**: Multi-agent conversations are tracked and persisted to `transcripts/conversations.json`.
- **Teams**: Planner/worker team structures and task state are tracked in-memory by the `TeamCoordinator`.
- **Transcripts**: Full terminal output and protocol exchanges can be captured for debugging and audit.

## Multi-Agent Workflows

### Conversations

Two or more agents can participate in a structured conversation with a topic and per-agent reply caps. The `ConversationCoordinator` manages message routing and transcript recording.

### Teams

Agents can be organized into teams with planner and worker roles. The `TeamCoordinator` manages a task lifecycle:
1. A task is assigned to the team.
2. The planner agent creates a strategy and submits a plan.
3. The user confirms or rejects the plan (with optional feedback).
4. On confirmation, the plan is delegated to the worker agent.
5. The worker accepts or refuses, then executes and reports results.

### Healthchecks

The `HealthcheckManager` allows the orchestrator to verify agent responsiveness by sending a healthcheck event and waiting for an acknowledgement within a configurable timeout.
