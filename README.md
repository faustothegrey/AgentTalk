# NodePTY

NodePTY is a Node.js-based orchestrator designed to manage and communicate with agents running in terminal panes hosted by `cmux` on macOS.

## Architecture

NodePTY operates as a central controller that interacts with agents through the `cmux` CLI. It uses a polling-based model to observe terminal output and an in-band protocol to send and receive structured data.

- **Orchestrator**: Manages agent lifecycles, polling loops, and multi-agent routing.
- **CmuxAdapter**: Wraps `cmux` CLI commands (`new-split`, `send`, `read-screen`, `notify`).
- **Registry**: Tracks active agents and their states (`creating`, `starting`, `ready`, `busy`, `error`, `terminated`).
- **Protocol**: An in-band, line-oriented JSON protocol prefixed with `[NodePTY]:`.

## Features

- **Cmux Integration**: Leverages native macOS terminal panes via `cmux`.
- **Polling Loop**: Robust terminal observation (250ms interval) with suffix-based deduplication.
- **ANSI Stripping**: Cleans terminal formatting for reliable protocol parsing.
- **Multi-Agent Routing**: Allows agents to discover each other (`list_agents`) and exchange messages (`send_to_agent`).
- **Transcripts**: Automatically logs all terminal output (raw) to individual agent log files.
- **State Machine**: Strict enforcement of agent lifecycle transitions.

## Prerequisites

- **Node.js**: v20 or higher recommended.
- **cmux**: Must be installed and available in your `PATH`.

## Installation

```bash
npm install
```

## Running Tests

The project uses [Vitest](https://vitest.dev/) for unit testing.

```bash
npm test
```

## Protocol Definition

All protocol lines must be newline-terminated and start with `[NodePTY]:`.

- **READY**: `[NodePTY]:READY:{"session":"uuid"}` (Sent by agent on startup)
- **REQ**: `[NodePTY]:REQ:{"id":"uuid","call":"tool_name","args":{}}` (Sent by agent)
- **RES**: `[NodePTY]:RES:{"id":"uuid","status":"success|error","data":{},"error":""}` (Sent by orchestrator)
- **EVT**: `[NodePTY]:EVT:{"type":"event_type",...}` (Sent by orchestrator)

## Multi-Agent Routing Calls

Agents can use these standard requests:

1.  **`list_agents`**: Returns a list of all known agents and their statuses.
2.  **`send_to_agent`**: Sends a `message_received` event to a target agent.
    - Args: `{ "to": "agent-id", "payload": "message content" }`

## Project Structure

- `src/index.ts`: CLI entry point.
- `src/registry.ts`: Core orchestration and routing logic.
- `src/agent.ts`: Per-agent state and transcript management.
- `src/cmux-adapter.ts`: implementation of the `cmux` CLI contract.
- `src/types.ts`: TypeScript interfaces and types.
- `src/__tests__/`: Unit test battery.
- `transcripts/`: Default directory for agent logs (gitignored).

## License

ISC
