# NodePTY + cmux Brainstorm

## Working conclusion

This architecture is viable. The V1 model is:

`Node orchestrator -> cmux CLI -> cmux-hosted pane/surface -> zsh -> agent`

The important split is:

- `cmux` hosts the agent processes and provides the GUI runtime, pane/browser surfaces, and a control CLI.
- The Node layer provides orchestration, routing, policy, and state tracking via the cmux CLI.
- `node-pty` is recognized as the stronger long-term transport but is not used in V1 (see Trade-off Analysis below).

`cmux` should not be treated like `tmux`. It is not a detachable session multiplexer. It is a native macOS terminal application with a CLI and a socket-backed control surface. Persistence comes from the app and its surfaces remaining alive, not from attach/detach semantics.

## Background: why PTY matters (context for future versions)

If you connect an agent to plain pipes instead of a real terminal, many tools change behavior. With ordinary `stdio: pipe`, you can lose TTY detection, terminal control, line editing, curses rendering, and job control. A PTY avoids all of this.

In V1, the agents run inside cmux-hosted panes, which already provide a real terminal. The PTY concern is handled by cmux itself. In a future version where Node owns the agent process directly (Option A), `node-pty` would be needed to provide that same terminal environment.

## What cmux provides

`cmux` is relevant because it provides:

- panes / surfaces with real terminal environments
- browser surfaces
- a CLI and socket API for programmatic control
- environment variables when running inside cmux
- addressable objects returned as refs

## Persistence model

The earlier "session attach/detach" framing was misleading. A better framing is:

- the Node process can create panes, browser surfaces, and workspaces on demand
- the agent stays alive while its cmux-hosted shell session stays alive
- `cmux` stays useful as long as the surrounding app remains open

If the project needs restart/reconnect behavior, that should be implemented in the Node orchestration layer, not described as native `cmux` session reattachment.

## Trade-off Analysis: PTY vs. cmux-hosted

The system can be built in two ways. While PTY-backed is more "pure," the cmux-hosted model is the chosen path for V1.

### Option A: PTY-backed (The "Transport" Model)
*   **How:** Node owns the `node-pty` process and pipes the stream to `cmux`.
*   **Pros:** Real-time (event-driven), zero data loss, low latency.
*   **Cons:** High implementation complexity; syncing Node state with `cmux` UI state is difficult.

### Option B: cmux-hosted (The "Remote Control" Model) - **V1 CHOICE**
*   **How:** `cmux` spawns the shell/agent. Node polls `cmux` for output and sends input via CLI.
*   **Pros:** Simple architecture, native visual fidelity, persistence (agents survive Node crashes).
*   **Cons:** Polling latency, potential for data loss in high-volume streams.

**Decision:** We are proceeding with **Option B (cmux-hosted)** for the Alpha/V1 to prioritize speed of integration and visual correctness.

## Recommended architecture (V1 Refinement)

### Node orchestrator

The Node process should own:

- agent creation and shutdown via cmux CLI
- mapping agent IDs to cmux refs
- transcript capture (polling cmux surfaces)
- message routing between agents
- capability detection
- restart policy

This is the control plane. It does not own the agent's terminal process directly — cmux does.

### cmux as the agent host

Each agent runs inside a cmux-hosted pane. cmux provides:

- a real terminal environment (interactive behavior, TTY detection, isolation)
- addressable panes and surfaces via refs
- browser surfaces for web interaction

The Node orchestrator interacts with agents through the cmux CLI:

- `cmux new-split` to create panes
- `cmux send` to write to agent terminals
- surface reads to observe agent output
- `cmux browser` commands for browser control

The Node layer should capture any returned refs such as `surface:N` or `pane:N` and track them explicitly.

### Capability detection

Detect cmux capability at startup.

The simplest signal is the environment, especially:

- `CMUX_SOCKET_PATH`
- optionally `CMUX_WORKSPACE_ID`
- optionally `CMUX_SURFACE_ID`

If `CMUX_SOCKET_PATH` is absent, the system should degrade gracefully to terminal-only mode.

## Do not over-wrap the cmux CLI

The original draft suggested adding wrapper commands like `open_browser(url)` or `focus_browser()`. That is only partly useful.

If `cmux` already exposes granular commands, a thick wrapper layer adds unnecessary abstraction and tends to drift from the real CLI.

A better rule is:

- keep wrappers thin
- normalize only what the rest of the app genuinely needs
- preserve raw refs and raw command results where practical

In other words, wrap for ergonomics, not to invent a second API.

## Ref tracking is a first-class concern

One thing the earlier draft did not emphasize enough is the addressing model.

`cmux` works best when the orchestrator treats returned refs as durable control handles during a run. The Node layer should track:

- logical agent ID
- cmux workspace ref
- cmux pane ref
- cmux surface ref
- browser surface ref, if one exists
- current status
- polling cursor state

Without this mapping, the system becomes ad hoc quickly.

## Multi-agent support

This is where the architecture becomes interesting.

### What cmux gives you

`cmux` is useful for multi-agent work because it gives:

- isolation: each agent can live in its own cmux pane and surface
- addressability: the orchestrator can target specific panes or surfaces
- observability: you can inspect what each agent is doing
- optional shared browser interaction across multiple surfaces

That is valuable infrastructure.

### What cmux does not give you

`cmux` is not a message bus.

It does not natively model:

- agent-to-agent messages
- queues
- delivery guarantees
- backpressure
- discovery
- conversation threading

Those semantics still need to be built.

## Communication model

The cleanest option is tool-mediated messaging handled by the Node orchestrator.

The shape is:

`Agent A <-> cmux surface <-> Node orchestrator <-> cmux surface <-> Agent B`

The orchestrator is the only component that should need to know:

- which cmux refs belong to which agent
- how messages are queued and delivered

### Why tool-mediated messaging is the best fit

It fits the overall system because:

- the Node process already sits on the control path
- agents can work with explicit tool calls more reliably than by parsing terminal chatter
- metadata can be added centrally
- the routing logic stays out of the agent prompt as much as possible

This is stronger than "parse arbitrary terminal output and guess what is a message".

## Known unaddressed issue: orchestrator crash recovery

If the Node orchestrator crashes, the agents may still be alive inside cmux. Reconnecting to those existing panes is a real problem, but it is deliberately left aside for now in favor of simplicity. For this exploration phase, if the orchestrator dies, the agents are considered lost and must be restarted.

## The actual hard part

The weakest part of the original brainstorm was not naming the real implementation risk clearly enough.

The hard problem is not "can agents message each other?" The hard problem is:

How does the orchestrator reliably detect structured tool requests from normal terminal output when reading cmux surfaces via polling?

That needs an explicit design decision.

## Recommended implementation choice

Use a structured in-band protocol with a strict prefix (the `[NodePTY]:` prefix defined in the implementation doc).

This is the V1 choice because:

- it requires no separate side channel
- it works with cmux's polling-based read model
- it is simple to implement

The risk is that protocol lines could scroll out of the readable surface before polling observes them. V1 accepts this limitation and is scoped to moderate-volume, low-fan-out experiments. If this becomes a real problem, the next step is a true side channel or a move to the PTY-backed model (Option A).

## Concrete control flow

An implementation-ready example should look like this:

1. Node creates a cmux pane via `cmux new-split`, captures refs.
2. Node launches Agent A inside the pane via `cmux send`.
3. Node stores the mapping:
   `agent_a -> { workspaceRef, paneRef, surfaceRef }`
4. Agent A emits a structured request such as:
   `[NodePTY]:REQ:{"id":"...","call":"send_message_to","args":{"target":"agent_b","content":"I found the auth bug"}}`
5. Node detects this line by polling the agent's surface and parsing for the prefix.
6. Node resolves `agent_b` to its cmux refs.
7. Node delivers the message into Agent B's terminal via `cmux send`.
8. Node records the event in transcripts and internal state.
9. If Agent B replies, the same routing path is used in reverse.

That example is more useful than abstract discussion because it identifies where state, routing, and protocol boundaries actually live.

## Failure handling

The Node layer should define behavior for:

- unknown target agent
- target agent offline
- duplicate delivery
- queue growth
- concurrent sends
- timeout and retry policy
- whether interrupted agents receive messages immediately or later

If these policies are not explicit, "multi-agent communication" will be underspecified.

## Build order

1. Single-agent cmux-hosted runtime: create pane, launch agent, poll output, capture transcript
2. Ref tracking and registry
3. Structured protocol: `[NodePTY]:` prefix parsing from polled surface text
4. Multi-agent message routing via the orchestrator
5. Browser-surface coordination

That order reduces ambiguity and keeps the communication layer from being built on top of unstable plumbing.

## Bottom line

The V1 architecture is:

- `cmux` hosts the agents and provides terminal/browser surfaces
- Node is the orchestrator, poller, and message router
- Communication uses an in-band `[NodePTY]:` protocol over polled surface reads

Option A (Node-owned PTY transport) remains available as the stronger long-term model if polling limitations become blocking.

Multi-agent messaging is a first-class orchestration problem owned by the Node layer, not something `cmux` solves on its own.
