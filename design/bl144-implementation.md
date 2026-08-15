# BL-144 — implementation ledger (Wave 2)

**Plan:** `design/bl144-plan.md`. **Item:** [[BL-144]].
**Status:** CLOSED — all three deliveries merged; T3 stopped at the PO's door on purpose ([[BL-145]]).
**Seats (resource-scarcity fallback — one actor, every hat, each gate kept separately):**
Planner · Plan Reviewer · Implementer · Implementation Reviewer · Task-end Reviewer — Claude.
**PO grant in force:** commits, merges and pushes pre-approved (2026-08-15). *The grant removes the
permission step, not the verification step.*

---

## Gate 1 — plan review (Plan Reviewer)

Adversarial pass over `bl144-plan.md`. Every load-bearing claim re-run rather than re-read.

| # | Claim under review | Verdict | Evidence |
|---|---|---|---|
| 1 | `design/backlog/**` is an operator write-fence path, so the backlog must not disperse | **VERIFIED ✅** | `grep -n 'design/backlog/\*\*'` → 6 sites: `AGENT.md:207,251,315`, `design/operator-seat/SKILL.md:25`, `scripts/infra-invariant.mjs:83,918` |
| 2 | Relocating code rewrites a coupled build graph | **VERIFIED ✅ (and strengthened)** | root `tsconfig.json` = 9 project references; 6 per-package `tsconfig.json` carry their own; `tsconfig.base.json` has `compilerOptions.paths`; `package.json` workspaces = `["apps/*","packages/*"]` — `modules/*` would not be a workspace. Plan's original wording was vague; corrected in place with the citation. |
| 3 | "20 of 34 docs declare a `Status:`; 14 declare nothing" | **REFUTED ❌** | Anchored re-run over the first 40 lines: **14 declare, 20 do not** — backwards. The original figure came from a `^\s*status` grep matching mid-document prose in `logbook.md` and `testlog.md`. Plan corrected; T2's cost profile inverts with it. |
| 4 | The module set is derived from an existing, tested taxonomy | **VERIFIED ✅** | `design/backlog/` filenames (Wave 1, `b12c0ee`) — 10/20/30/40/50/60/70/80/85 map 1:1 to the first nine modules |
| 5 | Baseline the plan is measured against | **VERIFIED ✅** | `tsc -b` 0 · suite **838 / 97 files** · backlog **144 items, 0 warnings**, `workable == ["BL-144"]` · `docs:check` **676 / 0 newly broken / 43 carried** |

**Verdict: APPROVED, with row 3 corrected before implementation starts.**

Row 3 is the fourth stated figure in this overhaul to be wrong while its surrounding conclusion held.
It was caught only because Gate 1 re-ran the number instead of re-reading the sentence. Recorded as the
session's standing hazard rather than a one-off.

**Two deviations from BL-144 as filed, both approved at Gate 1**, argued in plan §2: the backlog does
not move (it is a containment fence), and code does not move (it is a build graph, and a gate forces
what a directory only invites). Ownership — the item's actual product — is delivered by declaration
plus a gate. **This narrows BL-144's literal text and is recorded loudly rather than absorbed.**

---

## Deliveries

| Commit | What |
|---|---|
| `6221b0e` | plan + Gate 1 (on master — docs are master-editable) |
| `7df22ae` | **T1** — `modules/` manifests + `npm run modules:check` + 28 bars |
| `e6ba57d` | **T2 pre-step** — the citation gate learns `modules/**.md`, *before* any doc moved |
| `873da23` | **T2** — 34 docs move; `design/` top level 36 → 2 |
| `d814152` | **T3** — the `AGENT.md` split proposal, measured and deliberately not executed |
| *(the closure commit itself)* | BL-144 done, [[BL-145]] filed, the BL-093 pin moved — a commit cannot cite its own hash, and amending to "fix" it only moves the target again. `git log` is the authority. |

## Gate 2 — implementation review

Every row run, never read. Commands and their output are the evidence.

| # | DoD row | Verdict | Evidence |
|---|---|---|---|
| 1 | 13 manifests, names match directories | **VERIFIED ✅** | `modules:check` → `13 modules`; a bar pins `name !== directory` as an error |
| 2 | Dep graph acyclic, deps resolve | **VERIFIED ✅** | `findCycles` bars: 3-cycle detected, diamond correctly *not* a cycle |
| 3 | Coverage — every path owned or registered | **VERIFIED ✅** | `115/116 source files owned`, 1 on the UNOWNED register (`scripts/lib/is-main.mjs`, reason in source) |
| 4 | Uniqueness — nothing owned twice | **VERIFIED ✅** | `modules:check` green; bar pins the "owned twice" error naming both claimants |
| 5 | Backlog slices resolve, claimed once | **VERIFIED ✅** | `9 backlog slices`; bars pin both failure modes |
| 6 | Boundary-anchored matcher, planted bar | **VERIFIED ✅ (proven to bite)** | dropping the trailing slash turned **exactly one** test red — the sibling-directory case — and no others |
| 7 | Gate runs in the suite against the **real** repo | **VERIFIED ✅** | `describe('against the real repository')` asserts `main(['--json']) === 0` |
| 8 | Durable docs relocated, each owned once | **VERIFIED ✅** | `31 docs`; `ls design/*.md` → 2, both this task's own |
| 9 | Citation parity across every doc-move commit | **VERIFIED ✅** | `docs:check` **709 / 0 newly broken / 41 carried** — and the register **shrank** 43 → 41 as two entries genuinely resolved |
| 10 | Backlog untouched by the mechanics | **VERIFIED ✅** | 144 → 145 items only via the deliberate close+file; all **6** operator-fence sites intact (`AGENT.md` 3, `infra-invariant.mjs` 2, `SKILL.md` 1) |
| 11 | Full regression | **VERIFIED ✅** | `tsc -b` 0 · suite **871 / 98 files** (from 838/97; every delta accounted: +28 module bars, +4 citation bars, +1 from the dynamic is-main guard) |
| 12 | T3 a proposal; `AGENT.md` citation-only | **VERIFIED ✅** | `git diff` on `AGENT.md` = **16 lines, every one a rewritten citation path** |

### Defects found during the build — recorded, not quietly fixed

1. **The gate reported all 115 files unowned on its first run.** One typo: `ownersOf` read `m.code`
   where the manifest wrapper is `{name, dir, raw}`. It looked like a catastrophic ownership hole and
   was a single accessor. One hand-check of a path it certainly owned found it in seconds.
   **Volume is not evidence.**
2. **The gate caught its own author, and the finding is against T1.** `scripts/check-modules.mjs` was
   *untracked* when T1's suite ran, so `git ls-files` did not see it and it escaped its own coverage
   check — `7df22ae` shipped a gate that was **red on its own repo**, precisely [[BL-141]]'s failure
   repeated. Now owned by `governance`.
3. **The doc migration edited the archive.** It rewrote citations inside `design/archive/` (28
   files), breaking Wave 0's never-edit-the-archive rule *that the migration script's own header
   states*. Reverted before the commit; a guard added. **The citation gate could not have caught
   this** — `design/archive/**` is `CITER_EXEMPT`, so it is never scanned.
4. **The T3 proposal cited its own proposed destination** as though it existed. The gate refuted it.
   A proposal must not plant a citation that only becomes true if the proposal is accepted.

### The session's defining failure mode

**Four times a figure went into the record ahead of the output that settles it** — Gate 1's "20 of 34
docs declare a `Status:`" (backwards: 14/20), T1's and T2's "689 checked" (752 once the new files
were tracked), and T3's "706" (709). Every conclusion around them survived; none of the numbers did.
Two were caught only because a later step re-ran them. The mechanical cause of the 689s is worth
stating plainly: **`docs:check` walks `git ls-files`, so any run made before staging understates by
exactly the contribution of the unstaged files** — measured here at 63. Recorded in
`design/lessons/claude-lessons.md`.

## Gate 3 — closure sweep

Independent re-run at close, on the merge candidate, after the backlog was closed:

```
tsc -b                 → 0
vitest run             → 871 passed (98 files)
npm run modules:check  → 13 modules own 115/116, 31 docs, 9 slices
npm run docs:check     → 709 checked, 0 newly broken, 41 carried
validate-backlog.mjs   → 145 items, 0 warnings, exit 0
workableBacklogItems   → ["BL-145"]
git worktree list      → 2 (primary + this task's), no strays
git status --short     → clean apart from the known apps/web/node_modules symlink (?? — leave it)
```

**The BL-093 pin fired, as designed, and was shown red before it was moved:**
`expected [ 'BL-145' ] to deeply equal [ 'BL-144' ]`. It is the guard on what an agent could be
handed unattended, and it moved because BL-144 closed and BL-145 was filed. Deliberately **not**
done: adding `autonomy: po-decision` to keep a PO item off the workable list. That field still parses
and no longer gates, by [[BL-134]]'s design — it was a readiness field misread as an authorization
one. **Workable is not launchable**; a launch needs `design/po/<run>.authorized`. Re-adding a field
there would rebuild the shape BL-134 removed.

**Verdict: MERGED ✅** — every DoD row VERIFIED, none deferred.

**Telemetry (task closure):**
- task:        BL-144 (Wave 2)
- wall-clock:  2026-08-15 22:39 → 23:12 (~33 min)
- budget:      weekly 41% → 42% (Δ ~1%), session 39% → ~50% (Δ ~11%) [per `scripts/usage.mjs`]
- gate:        tsc 0, suite 871/871 (98 files), modules 115/116, docs 709/0/41, backlog 145/0 warnings, pollution clean
- diff:        6 commits on `task-bl144` + the plan commit on master; hashes in `git log`
- outcome:     **MERGED ✅** — with T3 stopped at the PO's door on purpose ([[BL-145]])
