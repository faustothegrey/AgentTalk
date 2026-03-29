# NodePTY Handoff Document

This document tracks the current state of the NodePTY project and identifies key implementation details for developers.

## Current Architecture (V1)

The system has moved away from the `cmux` CLI integration. It now uses direct process management via `child_process.spawn`.

### Core Components

- **Node Orchestrator**: Manages agents and communication.
- **ProcessAdapter**: Interface for spawning and interacting with agent processes.
- **Registry**: Manages agent lifecycle, polling, and the NodePTY protocol.
- **Web UI**: React-based dashboard for monitoring and managing agents.

### Key Implementation Details

1.  **Process Ownership**: The orchestrator spawns agents directly. No external multiplexer is used.
2.  **Communication**: Uses standard I/O (`stdin`/`stdout`).
3.  **Protocol**: Line-based protocol prefixed with `[NodePTY]:`.
4.  **Polling**: The orchestrator polls the `ProcessAdapter` for output every 250ms.
5.  **Deduplication**: Handles buffering of terminal output to extract new text and protocol lines.
6.  **Conversations**: Supports multi-agent conversations with persisted transcripts.

### Deprecated Model (cmux-hosted)

The project previously explored using `cmux` to host agent panes. This approach has been removed:
- No dependency on `CMUX_SOCKET_PATH`.
- No polling via `cmux read-screen`.
- No input via `cmux send`.

### Next Steps & Recommendations

- **PTY Support**: While currently using standard `child_process`, integrating `node-pty` would provide better terminal emulation (e.g., proper handling of TTY features).
- **Streaming Output**: Moving from polling to a streaming model (using process `data` events) would improve responsiveness.
- **Robust Persistence**: Enhance the transcript and state persistence for agent recovery.
- **Web UI Improvements**: Enhance the terminal view and agent management controls.
