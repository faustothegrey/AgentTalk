# `governance`

The working method itself: roles, gates, primers, and the doc-citation gate that keeps its claims honest.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `scripts/check-doc-citations.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

_none — this module is a leaf._

## Backlog

Its open work is filed in [`design/backlog/85-governance.md`](../../design/backlog/85-governance.md).

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
