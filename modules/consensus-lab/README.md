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

- [`arbiter-consensus-draft.md`](./docs/arbiter-consensus-draft.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
