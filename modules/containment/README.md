# `containment`

The fences: worktrees, the invariant harness, the operator commission, scope checks.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `scripts/infra-invariant.mjs`
- `scripts/hmp-commission.mjs`
- `scripts/wt-setup.mjs`
- `scripts/scope-check.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`backlog`](../backlog/)

## Backlog

Its open work is filed in [`design/backlog/50-containment.md`](../../design/backlog/50-containment.md).

## Durable docs

- [`brief-authoring-rung-plan.md`](./docs/brief-authoring-rung-plan.md)
- [`hmp-commission-plan.md`](./docs/hmp-commission-plan.md)
- [`http-launcher-proposal.md`](./docs/http-launcher-proposal.md)
- [`launch-and-monitor-runbook.md`](./docs/launch-and-monitor-runbook.md)
- [`meter-cap-cluster-plan.md`](./docs/meter-cap-cluster-plan.md)
- [`worktree-discipline.md`](./docs/worktree-discipline.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
