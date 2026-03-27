# NodePTY + cmux Brainstorm

## Working conclusion

This architecture is viable, but the clean model is:

`Node orchestrator -> PTY-backed agent process -> cmux runtime`

The important split is:

- `node-pty` provides real terminal I/O.
- `cmux` provides the GUI runtime, pane/browser surfaces, and a control CLI.
- The Node layer provides orchestration, routing, policy, and state tracking.

`cmux` should not be treated like `tmux`. It is not a detachable session multiplexer. It is a native macOS terminal application with a CLI and a socket-backed control surface. Persistence comes from the app and its surfaces remaining alive, not from attach/detach semantics.

## What is actually true

### 1. PTY is the correct transport

If the goal is "persistent and interactive agent terminal sessions", a PTY is the right primitive.

Plain pipes are weaker because many terminal-native tools change behavior when they are not connected to a TTY. With ordinary `stdio: pipe`, you can lose:

- TTY detection
- terminal control behavior
- line editing
- curses-style rendering
- job control semantics

That part of the original brainstorm was correct.

### 2. cmux is a runtime, not the transport

`cmux` is relevant because it provides:

- panes / surfaces
- browser surfaces
- a CLI
- environment variables when running inside cmux
- addressable objects returned as refs

But `cmux` is not the thing that replaces PTY transport. The PTY still matters for agent stdin/stdout.

### 3. Persistence should be described carefully

The earlier "session attach/detach" framing was misleading. A better framing is:

- the Node process can create panes, browser surfaces, and workspaces on demand
- the agent stays alive while its PTY-backed process stays alive
- `cmux` stays useful as long as the surrounding app/runtime remains available

If the project needs restart/reconnect behavior, that should be implemented in the Node orchestration layer, not described as native `cmux` session reattachment.

## Recommended architecture

### Node orchestrator

The Node process should own:

- agent creation and shutdown
- PTY lifecycle
- mapping agent IDs to cmux refs
- transcript capture
- message routing
- capability detection
- restart policy

This is the control plane.

### PTY layer

Each agent should run in its own PTY via `node-pty`.

This gives:

- interactive terminal behavior
- isolation between agents
- predictable stdin/stdout handling

### cmux integration

Use the `cmux` CLI for pane and browser control.

Examples of the kind of responsibility that belongs here:

- create workspace or split
- open browser surface
- navigate a browser surface
- snapshot browser elements
- click or fill specific elements
- send text to a target surface

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
- PTY handle
- process PID
- cmux pane ref
- cmux surface ref
- browser surface ref, if one exists
- current status

Without this mapping, the system becomes ad hoc quickly.

## Multi-agent support

This is where the architecture becomes interesting.

### What cmux gives you

`cmux` is useful for multi-agent work because it gives:

- isolation: each agent can live in its own PTY and surface
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

`Agent A <-> PTY <-> Node orchestrator <-> PTY <-> Agent B`

The orchestrator is the only component that should need to know:

- which PTY belongs to which agent
- which cmux refs belong to which runtime surface
- how messages are queued and delivered

### Why tool-mediated messaging is the best fit

It fits the overall system because:

- the Node process already sits on the control path
- agents can work with explicit tool calls more reliably than by parsing terminal chatter
- metadata can be added centrally
- the routing logic stays out of the agent prompt as much as possible

This is stronger than "parse arbitrary terminal output and guess what is a message".

## Known unaddressed issue: orchestrator crash recovery

If the Node orchestrator crashes, the agents may still be alive in their PTYs inside cmux. Reconnecting to those existing PTY processes is a real problem, but it is deliberately left aside for now in favor of simplicity. For this exploration phase, if the orchestrator dies, the agents are considered lost and must be restarted.

## The actual hard part

The weakest part of the original brainstorm was not naming the real implementation risk clearly enough.

The hard problem is not "can agents message each other?" The hard problem is:

How does the orchestrator reliably detect structured tool requests without building a fragile parser on top of normal PTY output?

That needs an explicit design decision.

## Recommended implementation choice

Use a structured out-of-band protocol for orchestration events whenever possible.

Examples:

- reserve a machine-readable channel in the agent runtime
- emit newline-delimited JSON with a strict prefix
- or expose tools through a wrapper process instead of scraping raw terminal text

The bad option is:

- rely on ad hoc regex parsing over arbitrary terminal output

If the project falls back to PTY scraping, it should treat that as a compatibility path, not the core protocol.

## Concrete control flow

An implementation-ready example should look like this:

1. Node starts Agent A under `node-pty`.
2. Node creates or identifies the relevant cmux pane/surface.
3. Node stores the mapping:
   `agent_a -> { pty, pid, paneRef, surfaceRef }`
4. Agent A emits a structured request such as:
   `send_message_to(agent_b, "I found the auth bug in auth.js")`
5. Node intercepts that request through the structured control channel.
6. Node resolves `agent_b` to its PTY and cmux refs.
7. Node delivers the message into Agent B's runtime.
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

## What I would build

If this project moves forward, I would build the system in this order:

1. Single-agent PTY runtime with transcript capture
2. Thin cmux integration with ref tracking
3. Capability detection and terminal-only fallback
4. Structured orchestration channel
5. Multi-agent message routing
6. Browser-surface coordination

That order reduces ambiguity and keeps the communication layer from being built on top of unstable plumbing.

## Bottom line

The architecture is sound if it is described this way:

- `node-pty` is the terminal transport
- `cmux` is the runtime and control surface
- Node is the orchestrator and message router

The original draft was strongest on the PTY choice and the need to separate concerns. It was weakest where it described `cmux` like `tmux`, and where it left the tool-call detection problem too implicit.

The revised design should treat multi-agent messaging as a first-class orchestration problem, not as something `cmux` solves on its own.
