# `consensus-lab`

The arbiter shadow corpus and its scoring — measuring consensus quality offline.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `scripts/arbiter-*.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

_none — this module is a leaf._

## Backlog

Its open work is filed in [`design/backlog/70-consensus-lab.md`](../../design/backlog/70-consensus-lab.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
