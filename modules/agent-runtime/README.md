# `agent-runtime`

Agents and their executors — how a turn is actually run against a provider CLI or API, per transport.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `packages/runtime-core/src/agents/**`
- `packages/llm-client/**`
- `scripts/test-live-cross-provider.mjs`
- `scripts/probe-t4-api-tools.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`contracts`](../contracts/) · [`observability`](../observability/)

## Backlog

Its open work is filed in [`design/backlog/20-agent-runtime.md`](../../design/backlog/20-agent-runtime.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
