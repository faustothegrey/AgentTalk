# [STALE] Transient Handoff

> **STATUS:** This handoff is now stale. The project has moved into implementation and context has been recovered. Refer to `design/` for current documentation.

This file is a temporary session handoff. It is only intended to help the next agent start work on the next session and should not be treated as long-term project documentation.

If this file is still present after the next session has started and context has been recovered, it should be marked as potentially stale.

## Current Status

This project has moved beyond the design-only phase. There is now a TypeScript implementation in `src/`, but this handoff remains stale and should not be treated as authoritative.

The authoritative design docs are:

- [architecture.md](/Users/fausto/Software/NodePTY/design/architecture.md)
- [implementation.md](/Users/fausto/Software/NodePTY/design/implementation.md)

## Confirmed V1 Decisions

- V1 uses the cmux-hosted model, not Node-owned PTYs.
- Runtime hierarchy is:
  `cmux -> zsh -> agent-cli --nodepty-v1`
- Node acts as orchestrator/controller through the cmux CLI.
- Terminal observation is polling-based via `cmux read-screen`.
- Protocol is in-band with the `[NodePTY]:` prefix.
- V1 does **not** use protocol dual-write yet.

## Important Constraint

The main V1 mitigation for `read-screen` fragility is the agent launch mode:

- `agent-cli --nodepty-v1` must behave as a line-oriented terminal program
- no spinners
- no progress bars
- no carriage-return redraws
- no curses/TUI behavior
- protocol packets must be newline-terminated full lines

This is critical. The polling design depends on the terminal behaving as close to an append-only log as possible.

## Main Remaining Risk

The biggest implementation risk is still the read model:

- `cmux read-screen` gives terminal state/screen content
- the orchestrator must derive unseen protocol lines by polling and deduplicating text
- this will only be reliable if the agent truly honors the line-oriented mode

## First Implementation Step For Next Session

The `CmuxAdapter` mentioned below now exists in `src/`. If this handoff is kept at all, it should be read only as historical context rather than as the next-step plan.

The original first implementation step was the `CmuxAdapter` described in [implementation.md](/Users/fausto/Software/NodePTY/design/implementation.md):

- `createPane(...)` via `cmux new-split`
- `sendText(...)` via `cmux send --surface`
- `readSurface(...)` via `cmux read-screen --surface ... --scrollback --lines 400`
- `notify(...)` via `cmux notify`

Do not start with multi-agent routing first. Start with:

1. create pane
2. launch `agent-cli --nodepty-v1`
3. poll `read-screen`
4. detect `[NodePTY]:READY:`
5. only then build upward

## Git State

Recent documentation commits already exist locally. Check `git log --oneline` at session start for the latest context.
