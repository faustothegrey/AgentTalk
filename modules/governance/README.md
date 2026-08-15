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

- [`agent-rating-signal-note.md`](./docs/agent-rating-signal-note.md)
- [`collaboration-workflow.md`](./docs/collaboration-workflow.md)
- [`implementer-pitfalls.md`](./docs/implementer-pitfalls.md)
- [`logbook.md`](./docs/logbook.md)
- [`reprime-mechanism.md`](./docs/reprime-mechanism.md)
- [`research-agenda.md`](./docs/research-agenda.md)
- [`scope-fences-design-note.md`](./docs/scope-fences-design-note.md)
- [`self-hosting-program-draft.md`](./docs/self-hosting-program-draft.md)
- [`tester-seat-proposal.md`](./docs/tester-seat-proposal.md)
- [`testlog.md`](./docs/testlog.md)

These live here because this module owns them: the durable and still-undecided documents
that describe this code. Episodic records — resolved plans, closed ledgers, dated gate minutes —
are in [`design/archive/`](../../design/archive/) instead, and are never edited again.
