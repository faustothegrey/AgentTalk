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

**Commit 1 — the rename.** ✅ `28f62eb`. **805/805 across 95 files, identical to baseline** — which is the
proof a pure rename should produce. `test-mcp-gate.mjs` deliberately not renamed (see the correction above);
`design/backlog.md` renamed at **line 46 only**, records at `:1556/:4682/:5780-5803` untouched; `:40` deferred
to commit 3 because its *content* becomes false in commit 2.

**Commit 2 — predicate + pin.** ✅ **806/806 across 95 files**, `tsc -b` 0. `autonomy` is out of both
predicates (real parser and harness mirror, which agree); the `:147` pin is **re-aimed at the workable set in
the same commit** (q1), and seven declared contracts updated.

**The pin's value was DERIVED, not typed** — and getting it took two attempts, both instructive:

1. The first derivation returned **`[]`** against a **stale `dist/`**: my `npx tsc -b >/dev/null 2>&1` sat
   behind a `||` and never ran. I nearly recorded an empty set as the finding. **"Is the fix deployed?" — the
   artifact was two edits behind the source.**
2. Rebuilt, both the real parser and the harness mirror independently return
   **`["BL-028","BL-134","BL-139","BL-140"]`**.

### Mutation run — three load-bearing rows, and one mutation that lied

| # | Mutation | Killed |
|---|---|---|
| P3 | drop the `status === 'todo'` clause | **8** |
| P4 | `.every` → partial resolution releases | **1** |
| P5 | dangling blocker treated as resolved — **first attempt** | **0** ⚠️ |
| P5 | same, **corrected** | **2** |

**P5's first run killed nothing, and that was MY defect, not a weak bar.** `isResolved` short-circuits on
`if (!b) return false;` *before* the line I patched, so the mutation was unreachable — it changed no
behaviour, and a no-op mutation kills nothing by construction.

**The lesson, which generalises past this task:** a mutation that kills nothing means **either** an uncovered
check **or** a mutation that never took effect. Those are opposite conclusions and they look identical in the
output. **Verify the mutation actually changed behaviour before reading it as a coverage finding** — this is
the same shape as the stale `dist/` an hour earlier and as [[BL-138]]'s guard-vs-branch misread.

### ⏸️ STOPPED AFTER COMMIT 2 — the plan's own pre-registered decision

Plan §11: *"If budget runs short, stop after commit 2 with the branch green."* Session budget is **~76%**, and
commit 3 is not a small remainder: it edits `AGENT.md`'s charter paragraph, migrates four backlog items, and
**moves the workable-set pin twice more** (BL-139/140 → `deferred` and BL-028 → `blocked_by: [BL-135]` each
change the set). Starting it here risks stopping mid-migration with the pin disagreeing with the backlog — the
one state worse than not starting.

**The branch is green and coherent as it stands:** the rename and the predicate are a complete, reviewable
unit. The migration resumes cold from plan §11 commit 3.

### ⚠️ A plan inconsistency found while deriving, for whoever picks up commit 3

**Plan §6 and D5 contradict each other.** §6 says the workable set contracts to **`{BL-028, BL-134}`**; **D5**
requires BL-028 to carry `blocked_by: [BL-135]` and be **consequently NOT workable**. [[BL-135]] is
`deferred` — not `done`/`dropped` — so `isResolved` is false and BL-028 is held back. **Both cannot hold.**

Derived expectation after commit 3: **`{BL-134}`** alone. **Do not type either number** — run the predicate
after the migration and let it say. That row has now been wrong three times.
