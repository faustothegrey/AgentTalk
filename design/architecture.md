# AgentTalk Architecture

AgentTalk is an orchestrator for LLM-based agents. It manages the lifecycle, communication, and observation of agent processes.

## System Model

`Node orchestrator -> child_process -> agent`

- **Node orchestrator**: Provides orchestration, routing, policy, and state tracking.
- **child_process**: Node's built-in module for spawning and managing sub-processes.
- **Agent**: The LLM-driven CLI process (e.g., `agent-cli`) that performs tasks and communicates via the AgentTalk protocol.

## Process Management

In the current version, the Node orchestrator owns the agent processes directly. It uses `child_process.spawn` to launch agents and manages their standard I/O streams (`stdin`, `stdout`, `stderr`).

### Process Adapter

The `ProcessAdapter` abstracts the low-level process management:
- **Spawning**: Launches the agent command in a shell.
- **Input**: Writes directly to the process's `stdin`.
- **Output**: Buffers output from `stdout` and `stderr`.
- **Lifecycle**: Monitors process exit and allows killing processes.

## Observation and Routing

### Polling Model

The orchestrator uses a polling-based model to observe agent output:
1. The `Registry` polls the `ProcessAdapter` at a regular interval (e.g., 250ms).
2. New output is deduplicated against previously seen text.
3. The orchestrator scans the output for protocol lines (prefixed with `[AgentTalk]:`).
4. Raw terminal output is forwarded to the Web UI via WebSockets for real-time observation.

### Protocol

Communication between the orchestrator and agents happens over the standard I/O streams using a line-based protocol:

`[AgentTalk]:TYPE:JSON_PAYLOAD`

- **REQ**: Request from agent to orchestrator (e.g., `list_agents`, `send_to_agent`).
- **RES**: Response from orchestrator to agent (or vice versa).
- **EVT**: Asynchronous events (e.g., `message_received`, `conversation_start`).
- **READY**: Signal from agent that it has finished initialization.

## State and Persistence

- **Agents**: Tracked in-memory by the `Registry`. Status transitions (`starting`, `ready`, `busy`, `error`, `terminated`) are managed based on process events and protocol signals.
- **Conversations**: Multi-agent conversations are tracked and persisted to `transcripts/conversations.json`.
- **Transcripts**: Full terminal output and protocol exchanges can be captured for debugging and audit.

## Comparison with previous models

Historically, the project considered using `cmux` (a macOS terminal multiplexer) as the host for agent processes. That approach was deprecated in favor of direct process management:

| Feature | cmux-hosted (Deprecated) | AgentTalk (Current) |
| :--- | :--- | :--- |
| **Ownership** | `cmux` owned the PTY | Node owns the `child_process` |
| **Control** | via `cmux` CLI commands | via direct `stdin`/`stdout` |
| **Complexity** | High (syncing UI and Node state) | Low (direct process control) |
| **Reliability** | Dependent on `cmux` app/socket | Native Node.js stability |
| **GUI** | Native macOS `cmux` windows | Custom Web UI (React/Xterm.js) |
