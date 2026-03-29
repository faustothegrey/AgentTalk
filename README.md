# NodePTY

NodePTY is a Node.js-based orchestrator designed to manage and communicate with LLM-based agents.

## Project Overview

NodePTY provides a central control plane for spawning agents, routing messages between them, and observing their terminal output through a Web UI. It uses a direct process management model with a line-based protocol for structured communication.

## Core Architecture

- **Registry**: The central management layer for agent processes, statuses, and multi-agent "conversations".
- **ProcessAdapter**: A clean abstraction for spawning processes, reading output, and sending input.
- **Protocol**: A line-prefixed JSON protocol (`[NodePTY]:`) that allows agents to request actions from the orchestrator and receive events.
- **Web UI**: A React-based dashboard that provides real-time terminal observation and agent control.

## Key Features

- **Direct Process Management**: Agents are spawned and managed directly by the Node.js orchestrator.
- **Polling-based Observation**: A robust polling and deduplication mechanism to capture agent terminal output and protocol messages.
- **Multi-Agent Conversations**: Support for orchestrating complex conversations between multiple agents with persisted transcripts.
- **Real-time Monitoring**: WebSocket-based updates to a modern Web UI with xterm.js terminal views.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or later.
- **npm**: Standard Node.js package manager.

### Installation

```bash
npm install
```

### Running the Orchestrator

To start both the backend orchestrator and the frontend Web UI:

```bash
npm run dev
```

The Web UI will be available at `http://localhost:5173`.

## Documentation

Detailed design information can be found in the `design/` directory:
- [Architecture](./design/architecture.md)
- [Implementation](./design/implementation.md)
- [Handoff Document](./design/transient/handoff.md)
