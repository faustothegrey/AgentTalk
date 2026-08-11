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

## `autonomy` — who may pick up the item (BL-093)

Three values, **fail-closed default** (`human-only`):

- **`eligible`** — an agent may be handed this autonomously. Work bounded, DoD legible, execution is not itself a governance act.
- **`human-only`** (DEFAULT) — real work, but not for unattended handing: behaviour change to fence, judgement the item doesn't encode, or execution would mean launching a session (recursion guard).
- **`po-decision`** — not agent work; the resolution IS a PO call.

Absent/unknown value → warning + fallback to `human-only`. An item that does not say it is eligible is not eligible — shipping the field cannot retroactively make the existing backlog selectable.

## Selectability predicate (BL-093 guard)

```ts
status === 'todo' && autonomy === 'eligible' && blockedBy.every(isResolved)
```

Only `selectableBacklogItems()` may be proposed to an agent. Human-only items need the PO to hand them to a session; po-decision items need the PO to decide first.

## Reading ladder

`po-decision` → PO decides WHAT · `human-only` → PO decides WHETHER to launch · `eligible` → a selector may launch unattended.
