# `relay`

The out-of-band PO channel — proposals, tokens, and the approve path.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `scripts/relay-approve.mjs`
- `scripts/relay-inbox.mjs`
- `scripts/relay-status.mjs`
- `scripts/m19-relay-ratio.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

_none — this module is a leaf._

## Backlog

Its open work is filed in [`design/backlog/60-relay.md`](../../design/backlog/60-relay.md).

## Durable docs

- [`hmp-bidirectional-relay.md`](./docs/hmp-bidirectional-relay.md)
- [`hmp-session-submission.md`](./docs/hmp-session-submission.md)
- [`outbound-pointer-relay-plan.md`](./docs/outbound-pointer-relay-plan.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
