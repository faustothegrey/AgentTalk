# `team-orchestration`

Teams, the registry, conversations and the consensus protocol — the engine that turns a set of agents into one team.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `packages/runtime-core/src/registry/**`
- `packages/runtime-core/src/conversations/**`
- `packages/runtime-core/src/protocol/**`
- `packages/runtime-scenarios/**`
- `scripts/test-live-api-team.mjs`
- `scripts/test-live-server-api-team.mjs`
- `scripts/test-live-gate.mjs`
- `scripts/test-pf2.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`contracts`](../contracts/) · [`agent-runtime`](../agent-runtime/) · [`observability`](../observability/)

## Backlog

Its open work is filed in [`design/backlog/10-team-orchestration.md`](../../design/backlog/10-team-orchestration.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
