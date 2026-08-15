# `integrations`

Outward connectors. Currently Google Drive.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `packages/integration-google-drive/**`
- `scripts/e2e-google-drive-noninteractive.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

[`contracts`](../contracts/)

## Backlog

Nothing is currently filed against this module. That is a statement of fact, not an oversight — `backlog: null` in the manifest says so explicitly.

## Durable docs

_None assigned yet — the doc relocation is Wave 2 T2 (`design/bl144-plan.md`)._
