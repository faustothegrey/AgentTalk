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

- [`bl028-plan.md`](./docs/bl028-plan.md)
- [`bl028-t3b-plan.md`](./docs/bl028-t3b-plan.md)
- [`live-test-models.md`](./docs/live-test-models.md)
- [`llm-client-architecture.md`](./docs/llm-client-architecture.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
