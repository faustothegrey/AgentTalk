# AgentTalk backlog semantics (live API, verified 2026-08-11)

Verified against `apps/orchestrator/src/backlog.ts` and the live orchestrator on port 3741.

## API views (`GET /api/backlog` on the LIVE orchestrator — port 3741, launchd)

- **No params** → open queue: status NOT in `{done, dropped, deferred}` (i.e. `todo` + `doing` + unknown). The normal answer to "list the backlog".
- **`?all=true`** → EVERYTHING — done and dropped included (122 of 122 on 2026-08-11, vs 1 in the default view). Not "parked items".
- **`?selectable=true`** → the currently selectable set, a SEPARATE eligibility signal.

`activeBacklogItems()` filters done/dropped/deferred. Unknown statuses stay visible on purpose (a typo'd state should surface, not vanish).

## Statuses — exactly five

`todo · doing · deferred · done · dropped`. There is **no `wontfix`, no `parked`** ("parked" is informal for deferred). `VALID_STATUS` in backlog.ts.

## `blockedBy` is a RAW header field — resolve it before reporting

The API echoes the item's stored `blocked_by` list verbatim. Effective blocking is computed:

```ts
function isResolved(blockerId, byId) {
  const b = byId.get(blockerId);
  if (!b) return false;              // unknown id → unresolved (typo hides, never releases)
  return b.status === 'done' || b.status === 'dropped';
}
```

So an item can show `blockedBy: ['BL-084']` while BL-084 is `done` → the item is **UNBLOCKED**. Live example: BL-028 lists BL-084 as blocker; BL-084 closed 2026-08-07; BL-028's block released automatically, no edit needed. **Report "blocked by X" only after checking X's status.** Closing a blocker releases dependents by itself.

## `autonomy` — advisory readiness metadata (BL-093, **demoted by BL-134** 2026-08-15)

**⚠️ It does NOT gate anything, and it never really did the job it appeared to do.** It was a *readiness*
field wearing an *authorization* field's clothes: all three values describe how ready an item is, none
describes who may touch it. Because it read as fail-closed governance, marking an item `eligible` felt like
granting a privilege — which was the complexity this seat kept reporting.

- **`eligible`** — work bounded, DoD legible. *The item is specified.*
- **`human-only`** — judgement the item does not encode. *The item is under-specified.*
- ~~**`po-decision`**~~ — **RETIRED as a value.** A question is not a task, so an item whose resolution *is* a
  PO call now carries `status: deferred`. Existing `done`/`deferred` items keep the value: it is history.

**Express a real fence as `blocked_by`, not as a field.** It names its reason as a filed, readable item; it
**releases itself** when that blocker closes; and it cannot dangle (a bad id fails `backlog:check`).
`human-only` named nothing and expired never. [[BL-028]] is the worked example: it was held by
`autonomy: human-only` for months, and is now held by `blocked_by: [BL-084, BL-135]` — where BL-135 is the
actual undecided question.

## Workable predicate (BL-134)

```ts
status === 'todo' && blockedBy.every(isResolved)
```

`workableBacklogItems()` · wire: `GET /api/backlog?workable=true`.

## ⚠️ Workable is NOT launchable — the distinction that matters

**Workable is a readiness fact computed from the backlog. It authorizes nothing.** What actually stops an
agent being handed work is the **launch gate**: a PO-authorized `design/po/<run>.authorized` at the
commissioned sha, single-use via the launch ledger, written by `relay-approve.mjs approve <token>` alone
([[BL-137]]). An item appearing in the workable set means *"this is ready"*, never *"you may start it."*
