# BL-093 — Make the backlog machine-selectable: `blocked_by` + `autonomy`

**Author:** Claude (planner) · 2026-07-27
**Status:** DRAFT — awaiting gate 1 (plan reviewer) and the PO's go
**Epic context:** unit 1 of *"close the cycle"* — Hermes reads the backlog and **recommends** the next item;
the PO's `yes` remains the launch trigger. PO decisions of 2026-07-27, recorded in §1.

---

## 1. Why this exists, and what the PO actually decided

The PO's goal: *"Hermes launches AgentTalk sessions deterministically, and reads backlog items to choose what to
work on next (or skip) on the human's behalf — that completes the cycle."*

Two PO decisions were taken in session before this plan was written:

1. **Authority: recommend now, ratchet later.** Hermes reads the backlog and **proposes** a ranked next item with
   reasons; the PO's `yes` launches it. **The OPERATOR charter is untouched** — proposing is "reporting
   observations", which the charter already permits. Unattended *deciding* would require an explicit, dated PO
   charter act, and is deliberately deferred until there is a track record of picks the PO agreed with.
2. **First unit: the structured fields** (this document).

**Why this is the first unit and not the selector itself.** The backlog is not machine-selectable today. The
`@item` header schema (`design/backlog.md:26-33`) is `id · status · date · epic · promoted_to · tags` — there is
**no dependency field and no eligibility field**. Every fact a selector would need to *avoid* a bad pick exists
only as prose:

| Fact a selector must respect | Where it lives today |
|---|---|
| BL-028 cannot start before BL-084 | prose, in a gate table (`backlog.md:59`) |
| BL-086 is a **PO decision**, not agent work | prose (`backlog.md:60`) |
| BL-092's option B is a Rule-2 show-stopper | prose, in `design/bl092-investigation.md` |

A selector hitting `GET /api/backlog` sees 92 items in which `todo` reads as *"eligible"*. It would pick BL-028
(blocked) or BL-086 (the PO's alone) and be structurally correct in doing so. **The fields are the prerequisite
for both the recommend-path and any later decide-path.**

### 1a. A sizing finding the PO should weigh — the near-term pick-list is nearly empty

Only `todo` items are selectable, and there are exactly **four**: BL-028, BL-092, BL-086, BL-084. Applying the
rules below, a correct selector could legitimately pick **one** of them (BL-092): BL-028 is blocked, BL-086 is
PO-reserved, BL-084 T2 carries a behaviour change to fence.

**So today's selector is deterministic by exhaustion, not by judgement.** This does not make the unit wrong — the
fields are what convert three prose facts into machine-checkable ones, and that value is permanent and grows as
the backlog refills. But the PO should not expect the selector to demonstrate much *judgement* on this backlog,
and a demo that "it picked the right one" proves very little when the candidate set has one member. Stated here
so nobody later reads a size-1 success as calibration.

## 2. Scope

**In scope — the schema and the machinery that reads it, nothing else.**

| File | Change |
|---|---|
| `design/backlog.md` | schema doc block (§ header spec) + backfill the 4 `todo` items |
| `apps/orchestrator/src/backlog.ts` | parse + expose the two fields; add `selectableBacklogItems()` |
| `scripts/validate-backlog.mjs` | new structural rules (§5) |
| `apps/orchestrator/src/server.ts` | surface the fields; `?selectable=true` on `GET /api/backlog` |
| `apps/orchestrator/src/__tests__/` | unit tests for parse, validation, and selection |

**Explicitly OUT of scope — do not touch in this unit:**

- **No selector.** Nothing that reads the backlog and *ranks* or *recommends*. That is unit 2.
- **No Hermes changes**, no launcher changes, no launch-config generation, no runbook changes.
- **No re-litigation of the 4 items' substance.** Backfill records the eligibility that *already* holds per the
  2026-07-27 gate; it does not re-decide any item.
- **No change to `status:` semantics** or to the existing drift-detection behaviour.

## 3. The schema change

Two optional fields on the `@item` header:

```
blocked_by: [BL-084]   # optional; ids that must be done/dropped before this may start. Default [].
autonomy: eligible     # optional; eligible | human-only | po-decision. Default human-only.
```

### 3a. `autonomy` defaults to `human-only` — fail closed. This is the load-bearing decision.

An absent `autonomy` field means **not selectable**. The alternative (default `eligible`) would make all 92
existing items autonomously selectable the moment the field ships — including every historical item, every
deferred item someone later flips to `todo`, and every new item filed by anyone who has not read this document.
**That is precisely the failure mode the fields exist to prevent.**

Fail-closed costs one line per item and makes eligibility an *explicit act of judgement*. An un-backfilled item
is simply invisible to the selector — a quiet, safe, self-correcting failure.

### 3b. The three values

- **`eligible`** — an agent may be handed this autonomously. The work is bounded, the DoD is legible from the
  item, and its execution is not itself a governance act.
- **`human-only`** — real work, but not for unattended handing: it carries a behaviour change to fence, it needs
  judgement the item does not encode, or **its execution would mean launching a session** (the recursion guard —
  see §6).
- **`po-decision`** — not agent work at all; the item's resolution *is* a PO call.

Three values, not more. Resist growing this enum: every additional value is a rule a future selector must encode
correctly, and the distinctions that matter beyond these three are exactly the ones that belong in prose for a
human to read.

## 4. Parser changes (`backlog.ts`)

Additive, and shaped to match what is already there:

1. `BacklogItem` gains `blockedBy: string[]` and `autonomy: Autonomy`.
2. `blocked_by` parses with the **existing** `parseTagList()` — the value syntax is identical to `tags`. Reuse
   it; do not write a second list parser.
3. `autonomy` parses via a new `VALID_AUTONOMY` set mirroring `VALID_STATUS`; an unrecognised value produces a
   **warning** and falls back to `human-only` (fail closed even on a typo).
4. New export, beside `activeBacklogItems()`:

```ts
/** Items an autonomous selector may propose: todo · eligible · every blocker resolved. */
export function selectableBacklogItems(items: BacklogItem[]): BacklogItem[]
```

   A blocker is **resolved** when the referenced id exists and its status is `done` or `dropped`. An id that does
   not resolve leaves the item unselectable — again fail-closed, so a typo'd blocker id hides an item rather than
   releasing it.

The parser stays **best-effort and non-fatal** (its existing contract): malformed input yields warnings, never
throws. The gate is what turns warnings into failures.

## 5. Validator changes (`validate-backlog.mjs`)

The gate already fails on *any* parser warning, so parser-emitted problems are covered for free. Add:

1. **Unknown `autonomy` value** → error (via parser warning).
2. **`blocked_by` references an unknown id** → error. A dangling dependency is a silent unblock.
3. **Self-reference** (`blocked_by` contains its own id) → error.
4. **Cycle** in the `blocked_by` graph → error. Direct 2-cycles at minimum; a full DFS is ~15 lines and worth it.
5. **`autonomy: eligible` on a non-`todo` item** → warning, not error. Harmless but usually a mistake.

No change to the existing coverage rule (every active bullet needs a header).

## 6. The recursion guard

The OPERATOR charter states an operator's goal is **never** "launch a session." But this project's current thrust
*is* AgentTalk-within-AgentTalk, so the backlog will keep accumulating items whose execution means launching one.
A selector that picks such an item creates exactly the recursion the charter forbids.

**Enforcement, belt and braces:**

- **At backfill / filing time:** any item whose execution is a launch, an operator run, or a ladder rung is
  marked `human-only`. This is a judgement made by whoever files the item.
- **Re-checked at each §3b backlog gate**, alongside the existing disposition sweep.
- **In the selector's own brief** (unit 2): an explicit exclusion, so the guard does not rest on backfill
  discipline alone.

This is documented as procedure, not enforced in code — see the honest risk in §9.

## 7. Backfill — the 4 `todo` items

Recorded judgement, derived from the 2026-07-27 backlog gate. Each is a restatement of an existing disposition,
not a new decision:

| Item | `autonomy` | `blocked_by` | Why |
|---|---|---|---|
| **BL-092** | `eligible` | `[]` | Bounded, investigated, recommendation waiting (option D: instrument `openSocket()`). Test-local and additive. |
| **BL-028** | `human-only` | `[BL-084]` | Genuinely blocked — the gate re-verified the timeout is dead and cannot land before the typed reason. |
| **BL-086** | `po-decision` | `[]` | Its resolution *is* a PO call: whether a worker in `agentalk-mcp-client` inherits governance. |
| **BL-084** | `human-only` | `[]` | T2 carries a real behaviour change to fence (`design/bl078-decision.md` §5c). Not for unattended handing. |

## 8. Definition of Done

| # | Row | How it is verified |
|---|---|---|
| 1 | Both fields parse; absent → `human-only` / `[]` | unit test on `parseBacklog()` |
| 2 | Unknown `autonomy` warns **and** falls back to `human-only` | unit test |
| 3 | `selectableBacklogItems()` returns **exactly `[BL-092]`** on the real backlog | unit test against `design/backlog.md` |
| 4 | Dangling / self / cyclic `blocked_by` each fail the gate | unit test + a deliberate red run of `backlog:check` |
| 5 | Backfill landed; `npm run backlog:check` green, 0 warnings | recorded command output |
| 6 | `GET /api/backlog?selectable=true` returns the same set as row 3 | live curl against a running orchestrator |
| 7 | `npx tsc -b` clean · full suite green (baseline **481/481**, 75 files) | recorded command output |
| 8 | No behaviour change to existing parse/serve/drift paths | suite green + diff review |

Row 3 is the one that matters: it is the whole unit expressed as a single assertion.

## 9. Risks

Each risk is followed by the mitigation actually configured, or an explicit **unmitigated, accepted**.

- **A new item filed without `autonomy` is invisible to the selector.** *Mitigated by design* — that is the
  fail-closed default working as intended. The cost is a forgotten item sitting unselectable; the alternative is
  a forgotten item being handed to an agent. Cheap direction to fail.
- **The recursion guard rests on filing discipline, not code.** **Unmitigated, accepted.** Encoding "this item's
  execution is a launch" is a semantic judgement no parser can make. Mitigated only in depth: backfill judgement
  + gate re-check + the selector's own exclusion (§6). If a launch-shaped item is ever marked `eligible`, the
  guard fails silently. **This is the sharpest known hole in the unit and should be re-examined in unit 2.**
- **`selectableBacklogItems()` will return a set of size 1 for the foreseeable future.** *Accepted, and named in
  §1a* so a size-1 success is not later mistaken for evidence the selector works.
- **Test files are never typechecked** (`apps/orchestrator/tsconfig.json:9` excludes `src/__tests__/**`), so this
  unit's new tests get no `tsc` coverage. **Unmitigated, accepted** — pre-existing, out of scope, and fixing it
  likely surfaces a pile of unrelated errors. It is the primer's unfiled incidental; file it separately.
- **Budget.** Session was at **88%** when this plan was written (resets ~21:40 Rome). Implementation — parser +
  validator + tests + backfill + live API check — does not fit the remaining window. *Mitigated:* implement after
  the reset rather than starting and being cut off mid-unit.

## 10. Execution notes

- **Worktree is MANDATORY** (code): `node scripts/wt-setup.mjs create bl093 --base master` → `/private/tmp/att-bl093`,
  branch `task-bl093`. It **prepends `att-`** — do not pass `att-bl093`.
- **Stage files explicitly**, and run `git status` *after* committing: a multi-path `git add` where one path does
  not exist stages **nothing**.
- **Gates:** `npx tsc -b` · `npx vitest run` · `npm run backlog:check` after **any** backlog edit (update **both**
  the header `status:` and the prose tag).
- The backfill edits `design/backlog.md`, which is docs — but it is coupled to the parser change and must be
  gated against it, so it lands **in the worktree**, not on master.

## 11. What unit 2 looks like (context only — not authorised by this plan)

The selector: reads `?selectable=true`, ranks the candidates with reasons, names what it skipped **and why**, and
reports. No launching. The PO reads the recommendation and says yes or no. That is the recommend-path in full,
and it is where the charter's fence sits.

The **long operator run** — the primer's flagged next rung — is a precondition for anything *unattended*, since an
unattended selector is by construction the long-running loop whose failure class retired Hermes (LB-49/LB-50).
It is not a precondition for the recommend-path, which is a single short run per invocation.
