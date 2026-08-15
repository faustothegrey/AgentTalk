# `backlog`

The backlog as a parsed artifact: the reader, the validator, and what workable means.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `apps/orchestrator/src/backlog.ts`
- `scripts/validate-backlog.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

_none — this module is a leaf._

## Backlog

Its open work is filed in [`design/backlog/40-backlog.md`](../../design/backlog/40-backlog.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
