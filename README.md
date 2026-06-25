# AgentTalk

AgentTalk is a Node.js-based orchestrator designed to manage and communicate with LLM-based agents.

## Project Overview

AgentTalk provides a central control plane for launching agents, routing messages between them, and observing their terminal output through a Web UI. It uses a direct process management model with a line-based protocol for structured communication.

## Core Architecture

- **Registry**: The central management layer for agent processes, statuses, conversations, and teams.
- **ProcessAdapter**: A clean abstraction for launching processes, streaming output, and sending input.
- **ProcessOutputParser**: A push-based parser that splits incoming process output into protocol lines and plain text, with echo suppression.
- **Protocol**: A line-prefixed JSON protocol (`[AgentTalk]:`) that allows agents to request actions from the orchestrator and receive events.
- **Web UI**: A React-based dashboard that provides real-time terminal observation and agent control.

## Key Features

- **Direct Process Management**: Agents are launched and managed directly by the Node.js orchestrator with per-agent working directories.
- **Push-based Output Streaming**: Real-time output processing via data callbacks with protocol line extraction and echo suppression.
- **Multi-Agent Conversations**: Structured conversations between multiple agents with per-agent reply caps and persisted transcripts.
- **Team Workflows**: Planner/worker team compositions with task planning, user confirmation, and delegated execution.
- **Healthchecks**: Liveness probes to verify agent responsiveness.
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
