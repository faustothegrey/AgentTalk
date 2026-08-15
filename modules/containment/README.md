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

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
