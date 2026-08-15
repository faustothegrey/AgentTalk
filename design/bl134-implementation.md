# BL-134 — implementation ledger

**Branch:** `task-bl134` · **Worktree:** `/tmp/att-bl134` · **Plan:** `design/bl134-plan.md` (draft 2, re-gate
APPROVED with H1/H2 applied) · **Implementer:** Claude, 2026-08-15 (Standing Conditional Reassignment ACTIVE)

---

## Rule 6 — scope, "done", approach, before touching anything

### (a) Scope — three commits, in the plan's §11 order

**Commit 1 — the rename.** `selectableBacklogItems` → `workableBacklogItems` · `parseSelectableIds` →
`parseWorkableIds` · `?selectable=true` → `?workable=true`, in: `apps/orchestrator/src/backlog.ts`,
`server.ts`, `scripts/infra-invariant.mjs`, `scripts/validate-backlog.mjs`, both test files,
`design/operator-seat/SKILL.md`, and **`design/backlog.md` LINE 46 ONLY.**

**Commit 2 — predicate + pin.** Drop `autonomy` from the predicate; re-aim the `:147` pin at the workable set
(**same commit**, per q1).

**Commit 3 — backlog + docs migration.** `AGENT.md` §4 wording; BL-139/140 → `deferred`; BL-134 → `human-only`;
BL-028 `blocked_by: [BL-135]`; `backlog-semantics.md`.

**I may NOT touch:** `hmp-commission.mjs` · `operator-run.expect.json` · `team-coordinator.ts` · the registry ·
the exec/turn path · **`design/backlog.md:5790` and `:5803`** (BL-093's closed prose — records) · historical run
logs and closed plans · `autonomy` values on `done`/`deferred` items · the `bl093-` test **filename**.

### ⛔ Correction to my own gate-1 finding, before any code

**H1 added `scripts/test-mcp-gate.mjs` to scope. That was WRONG, and I am not renaming it.** Its single hit is
`:12` — *"Provider is selectable so the gate can run against whichever provider has budget"* — the **ordinary
English word**, about provider choice, with no relation to the backlog concept.

H1's substance stands (the table *was* a filtered sample, and it *did* understate two files and miss two).
But the specific claim that this file needed renaming came from **matching a string, not a concept** — the
same shape as the error it was diagnosing, committed in the diagnosis. **A grep hit is a candidate, not a
finding.**

**Verified-real production sites:** `backlog.ts` (2 — one is a doc comment about the concept), `server.ts` (5),
`validate-backlog.mjs` (2 — incl. the user-facing message), `infra-invariant.mjs` (14).

### (b) "Done"

D1–D11. The ones I expect to be hardest to earn honestly:
- **D7** — *run* the predicate; the plan forbids reading a number out of it, and that row has been wrong twice.
- **D9** — "no `selectable` remains in production or live docs" now means **the concept**, not the string
  (see the correction above). I must classify each hit, not sweep them.
- **D6** — old pin gone and new pin green in ONE commit; no window without a fence.

### (c) Approach

Commit 1 by targeted edit per site, never a blanket `sed` on a mixed file. Then `tsc -b` + full suite as a
no-behaviour-change proof: **a pure rename must leave the suite count identical.**

### Rule 7 — retry budget, pre-registered per check

| Check | Budget |
|---|---|
| `tsc -b` after the rename | **2** |
| full suite after the rename | **2** — a rename that needs a third attempt is not a rename |
| predicate bars (commit 2) | **2 each** |
| the re-aimed pin | **3** — its value must be *derived by running*, never typed to match |
| mutation run rows 3/4/5 | **2 each** |

**Show-stopper fence overrides all of it**, even on attempt 1.

---

## Log

**Commit 1 — the rename.** *(in progress)*
