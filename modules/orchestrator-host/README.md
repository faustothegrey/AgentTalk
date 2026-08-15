# `orchestrator-host`

The host process: HTTP/WS server, scenario runner, and the bridges hanging off it.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `apps/orchestrator/src/index.ts`
- `apps/orchestrator/src/server.ts`
- `apps/orchestrator/src/scenario-runner.ts`
- `apps/orchestrator/src/diagramtalk-bridge.ts`
- `apps/orchestrator/src/tools/**`
- `scripts/supervisor.mjs`
- `scripts/restart-supervisor.mjs`
- `scripts/check-orchestrator-ports.mjs`
- `scripts/e2e-test.ts`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`team-orchestration`](../team-orchestration/) · [`backlog`](../backlog/) · [`mcp-transport`](../mcp-transport/) · [`observability`](../observability/)

## Backlog

Nothing is currently filed against this module. That is a statement of fact, not an oversight — `backlog: null` in the manifest says so explicitly.

## Durable docs

- [`architecture.md`](./docs/architecture.md)
- [`implementation.md`](./docs/implementation.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
