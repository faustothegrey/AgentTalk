# BL-100 (remaining half) — `wt-setup.mjs`'s `DEFAULT_ROOT` is macOS-only

**Status:** PLANNED, **Gate 1 APPROVED WITH AMENDMENTS** (§5) — ready to implement.
**Planner + Gate 1:** Claude, 2026-07-30 (resource-scarcity fallback; seats kept separate).
**Split from BL-102 by PO decision, 2026-07-30** — different repo, different file, no shared surface.

---

## 1. The defect

`scripts/wt-setup.mjs:22` hardcodes `const DEFAULT_ROOT = '/private/tmp'` — the macOS temp path. On Linux every
invocation of **both verbs** must pass `--root /tmp`, and omitting it on `remove` dies with an unhandled
`execFileSync` stack trace. This is the second of the two items left open when BL-100's `PORTING.md` half was
fixed directly; it is a **code** change, so it needs a worktree, a gate and a decision.

## 2. Change

`DEFAULT_ROOT = os.tmpdir()`, plus the `node:os` import. **One line and an import.**

**Effect:** deletes the mandatory `--root` flag from the Linux workflow entirely, rather than documenting it
twice — which is what BL-100 itself proposed.

## 3. ⚠️ This is NOT a pure no-op — Rule 2 disclosure

On macOS `os.tmpdir()` returns `/var/folders/…`, **not** `/private/tmp`. So the default worktree location
**changes on macOS**. It must not be described as a refactor.

**Why it is nonetheless defensible:** the default is a *scratch* location chosen per invocation, holding no
persistent state, with an explicit `--root` override retained; and the project's only active machine is the
Linux box. **Flagged, not assumed:** if any macOS runbook, script or doc hardcodes `/private/tmp/att-*`, this
becomes a different change (keep an explicit platform switch instead). §5/G2 records what was checked.

## 4. DoD

| # | Row | Verified by |
|---|---|---|
| D1 | `create` with no `--root` lands the worktree under `os.tmpdir()` | run on a scratch id; `git worktree list` |
| D2 | `remove` with no `--root` succeeds — no stack trace | run it; exit 0 |
| D3 | `--root` still overrides | re-run with an explicit root |
| D4 | `scripts/__tests__/wt-setup.test.mjs` green | `npx vitest run` |
| D5 | Full suite unchanged — **re-derive the baseline at implementation time; do not trust a number written here** | `npx vitest run` |
| D6 | `PORTING.md` §7's "pass `--root`, every time" no longer contradicts the code | read it |

**D6 is not tidy-up.** BL-100's entire lesson is that `PORTING.md` decayed unobserved; shipping a code fix that
silently falsifies the doc it was filed against repeats the defect inside the item that recorded it.

**Mutation check.** Set `DEFAULT_ROOT` to a deliberately wrong path and confirm D1 goes red. A default-value
change is cheap to fake green — every row still passes if the flag is being supplied out of habit.

## 5. Gate 1 — plan-reviewer verdict

**APPROVED WITH AMENDMENTS** — Claude, plan-reviewer seat, 2026-07-30.

| # | Finding | Disposition |
|---|---|---|
| G1 | **Recursion hazard: this edits the tool that creates the worktree the work happens in.** A mistake can leave `remove` unable to find its own worktree. | **Amended into §6.** Do the work in a worktree created with an **explicit `--root`**, and exercise the new default against a **scratch id**, so the code under edit is never the code relied on for cleanup. |
| G2 | **The plan asserted the harness was at risk without checking.** | **Checked and CLEAR:** `infra-invariant.mjs:76`'s `allowNewWorktrees: ['att-op-*', 'att-*/agentalk-task-*']` matches **path segments**, not an absolute root, so moving the root does not break the allowlist. Recorded so it is not re-litigated. |
| G3 | **A real residual risk the plan missed:** `os.tmpdir()` honours `$TMPDIR`, so the worktree root becomes **environment-dependent**. Runbooks and hygiene sweeps that look literally at `/tmp/att-*` would silently stop finding worktrees — a fail-open in a *pollution check*, which is [[BL-101]]'s shape. | **Accepted as low-risk, disclosed, not mitigated in code.** `$TMPDIR` is unset on this box (Linux default `/tmp`). **The implementer must state the observed `os.tmpdir()` value in the delivery**, and the runbook sweep stays `/tmp/att-*` only if that value is `/tmp`. |
| G4 | **Baseline pinned from a primer, not re-derived** — third occurrence of the hardcoded-reference-value trap in three days. | **Amended** — D5 now says re-derive. |

## 6. Containment

Code change ⇒ worktree + branch per the MANDATE. **Create that worktree with an explicit `--root`** (G1).
Merge and push remain the PO's.
