# `mcp-transport`

The MCP surface: the WebSocket attach transport and the exec server agents call back through.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `packages/mcp-transport/**`
- `packages/mcp-exec-server/**`
- `scripts/smoke-mcp-exec-server.mjs`
- `scripts/test-mcp-gate.mjs`
- `scripts/test-mcp-provider.mjs`
- `scripts/spike-ws-server.mjs`
- `scripts/m19-bridge-recorder.mjs`
- `scripts/m19-real-cli-attach.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`contracts`](../contracts/)

## Backlog

Its open work is filed in [`design/backlog/30-mcp-transport.md`](../../design/backlog/30-mcp-transport.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
