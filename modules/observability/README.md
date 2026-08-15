# `observability`

Meters, logs and the usage readings the resource rule depends on.

## What it owns

The manifest is [`module.json`](./module.json) and it is the authority — this page is prose about
it, and `npm run modules:check` enforces the manifest, not this file.

- `packages/observability/**`
- `scripts/usage.mjs`

Ownership is **declared, not physical**: the code stays where the build expects it, and the module
claims it by glob. The gate proves the claim is total (nothing unowned) and disjoint (nothing owned
twice), which is what forces a reader touching the code to touch the claim.

## Depends on

_none — this module is a leaf._

## Backlog

Nothing is currently filed against this module. That is a statement of fact, not an oversight — `backlog: null` in the manifest says so explicitly.

## Durable docs

_None. This module’s behaviour is described by its code and its tests; nothing durable was written
about it separately. That is a fact worth stating rather than an omission to fill._
