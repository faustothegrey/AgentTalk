# BL-137 — implementation ledger

**Branch:** `task-bl137` · **Worktree:** `/tmp/att-bl137` · **Base:** `ad893a9`
**Plan:** `design/bl137-plan.md` (draft 2, re-gate APPROVED with G1/G2 corrections applied)
**Implementer:** Claude, 2026-08-15 (resource-scarcity fallback; Standing Conditional Reassignment ACTIVE)

---

## Rule 6 — scope, "done", and approach, in my own words, before touching anything

### (a) Scope

**I may touch:**

| File | What, exactly |
|---|---|
| `scripts/hmp-commission.mjs` | **two** named edits only: C1 `authorizationPathFor` → `design/po/` + `export` on `RUN_ID`; C5 retire the false comment at `:38` |
| `scripts/relay-approve.mjs` | C2 `ACTIONS` + `'launch'`; C3 `propose` gains `--run`; C4 `approve` writes+commits+verifies then burns |
| `scripts/__tests__/hmp-commission.test.mjs` | contract row `:208`; fixture paths; new bars |
| `scripts/__tests__/relay-approve.test.mjs` | contract row `:84`; new `launch` bars |
| `AGENT.md` | C6 — `.authorized` into the never-write table, `design/po/**`, "behavioural not enforced" |
| `design/operator-seat/SKILL.md` | C7 — 4 sites, new path + token wording |
| `scripts/infra-invariant.mjs` | C8 — **the comment at `:83` only** |

**I may NOT touch:** `LAUNCH_PATTERNS` / the recursion fence (BL-136, byte-identical) · `isAncestorOf` ·
`CHARTER.authorizedRef` (the plan killed the `origin/master` idea in §1 — I do not revive it) ·
`allowWritePaths` (still `[]`; populating it is a separate item) · any `REFUSAL` enum **value** · any other
refusal's position or text · `bite0-launcher.mjs` · anything under `src/` · the nine historical
`design/operator/hmp[1-9].authorized` files.

### (b) What "done" looks like

D1–D10 in the plan. The ones I expect to be hardest to earn honestly:

- **D5** — a failed commit must report a refusal, not `ok: true`, and must not burn the token. `git()` swallows
  failures by design, so this needs an explicit verification step, not a hopeful one.
- **D9** — the words "fence"/"prevents" must not describe option (a) anywhere in my diff. This is the plan's
  premise; committing that error while fixing it is the failure shape recorded three times in this repo.
- **D8** — the retired claims must actually be retired, not softened.

### (c) Approach I will try first

1. C1 + C5 (`hmp-commission.mjs`), then flip contract row `:208` and the fixtures → expect B1/B2/B3 movement.
2. C2/C3/C4 (`relay-approve.mjs`), guard-order constraint from plan §5 (G2): the `branch` default lands
   **after** `ACTIONS.includes`.
3. Bars B1–B10, then the mutation run.
4. Docs C6/C7/C8 last, so D9 is checked against a finished diff.

### Rule 7 — retry budget, pre-registered PER bar, before seeing any result

| Bar | Budget | Note |
|---|---|---|
| B1, B2, B3 (path move) | **2 each** | mechanical |
| B4 (propose `--run`) | **2** | |
| B5 (writes + one-file commit) | **3** | commits in a test repo; fixture setup is the likely friction |
| B6, B7 (ordering) | **2 each** | |
| B8 (merge/push unaffected) | **1** | if this needs a fix, I broke something — that is a report, not a retry |
| B9 (failed commit) | **3** | needs failure injection; the hardest to get honestly |
| B10 (`RUN_ID` agreement) | **2** | |
| full suite / `tsc -b` | **2** | |

**Show-stopper fence (Rule 2) overrides all of the above, even on attempt 1.** If I find a behaviour change
outside this scope — anything touching the recursion fence, the refusal enum, or existing commission
behaviour — I STOP and report rather than fix.

---

## Log

**C1 + C5 (`hmp-commission.mjs`)** — path → `design/po/`, `RUN_ID` exported, the false comment at `:38`
corrected (the LAN-forger half is TRUE and was kept; only the "PO's merge is the authorization act" clause was
retired). Fixtures and contract row `:208` moved. **`hmp-commission.test.mjs` → 54/54 green, attempt 1 of 2.**

**C2/C3/C4 (`relay-approve.mjs`)** — `launch` added, `propose --run` validated against the imported `RUN_ID`,
`approve` writes + commits + verifies + then burns. **All seven new launch bars pass (B4, B4b, B5, B6, B7, B8,
B9, B10). 36 passed, 1 failed.**

---

## ⛔ SHOW-STOPPER — STOPPED AND REPORTING. Implementer Rule 2.

**`relay-approve.test.mjs:230` — *"the git helper is never invoked with a write verb — a fence against a future
'just merge it here'"*.**

It scans this module's own source and asserts `git()` is **never** called with `merge`, `push`, `commit`,
`reset`, `checkout`, `cherry-pick` or `rebase`. It deliberately targets the *call shape* rather than the word,
"because `ACTIONS = ['merge','push']` is the allowlist this file is built around, so a bare word-search would
fail on the very thing it is protecting." Someone thought carefully about this and wrote it to survive exactly
the kind of edit I just made.

**C4 breaks it, by design and unavoidably.** The plan's whole premise is that `approve` commits.

**Why this is a STOP and not a fix:**

1. **It is a DO-NOT-TOUCH guardrail asserting established behaviour** — [BLOCK]-class under Reviewer Rule 7,
   and the human's call, not the implementer's.
2. **The PO authorized the behaviour without being told this fence existed.** "Yes, approve commits" was
   answered against plan §4.4, which never mentions this bar. Neither did gate 1 or the re-gate. **The PO
   approved the intent, not the demolition of a tested invariant in the same file.** Those are different
   consents.
3. **I am the "future" the bar was written to stop, and I can feel myself producing its predicted
   rationalization.** Mine would be: *the commit is bounded to one file after a single-use sha-bound token,
   and a shell-holder could commit directly anyway, so the fence buys little.* That argument is probably
   correct — and it is verbatim the "just merge it here" reasoning the bar anticipates. A fence that only
   holds until someone has a good reason is not a fence, which is this very item's thesis.

**What I did NOT do:** weaken the bar, add an exemption, narrow its verb list, or move the commit into a helper
file to evade the source scan. That last one deserves naming because it would have passed the bar while
defeating its purpose entirely — a green obtained that way is worth less than this red.

**The decision the PO owns:** does `relay-approve.mjs` become a module that mutates the repo?

| Option | Cost | Note |
|---|---|---|
| **(A)** Amend the bar to permit exactly `commit` of exactly `design/po/*.authorized`, with the rationale recorded | small | keeps the fence meaningful for every other verb; the bar becomes narrower but still real |
| **(B)** Move the commit OUT of `relay-approve.mjs` into a separate authorizer invoked by `approve` | medium | preserves the letter of the fence — **and I flag that this may be evasion wearing a design hat**, since the capability is identical |
| **(C)** `approve` writes the file but does NOT commit; the PO commits | none in code | reinstates the ceremony this whole item exists to remove — it is the honest "we chose the fence over the lightness" answer |

**My recommendation is (A)**, narrowly scoped and with the reasoning written into the bar, because (B) is
mostly self-deception and (C) undoes the PO's actual ask. **But it is a fence-lowering, and it is the PO's to
lower.** I have not touched it.

**Suite state at stop:** `hmp-commission.test.mjs` 54/54 ✅ · `relay-approve.test.mjs` 36 passed, **1 failed**
(this bar, and only this bar). Nothing else is red. Not run yet: `tsc -b`, the full suite, the mutation run,
C6/C7/C8 (docs).

### ✅ RESOLVED — PO chose option (A), 2026-08-15

`commit` was **narrowed, not deleted** from the fence: it leaves the forbidden-verb loop and becomes a
shape-asserted **single call site** — pathspec-limited (`'--', rel`) and committing an `authorizationPathFor`
path. Every other write verb (`merge`, `push`, `reset`, `checkout`, `cherry-pick`, `rebase`) stays absolutely
forbidden, and a second bar pins that the only committable path comes from the commission's own helper.

**The bar now records its own history** — that it went red, that the implementer stopped rather than trimming
the verb list, and that the PO lowered it knowingly — so the next person who hits it repeats the conversation
instead of the shortcut.

---

## Mutation run — seven mutations, and it found two things I would otherwise have shipped

| # | Mutation | Bars killed | Read |
|---|---|---|---|
| M1 | revert the path to `design/operator/` (C1) | **27** | the path is load-bearing across both suites |
| M2 | drop `'launch'` from `ACTIONS` (C2) | **8** | contract row `:84` + every launch bar |
| M3 | drop the `RUN_ID` validation (C3) | **2** | B4, B10 — exactly their own |
| M4 | ignore a failed commit and burn anyway (C4 ordering) | **1** | B9, exactly and only |
| M5 | drop the "commit touched exactly one path" check | **0** ⚠️ | **unfalsifiable** |
| M6 | drop the blob read-back after commit | **0** ⚠️ | **unfalsifiable** |
| M7 | remove the pathspec `'--', rel` from the commit | **3** | B5b, added *because* of M5 |

**M5 and M6 killed nothing, and I am reporting that rather than quietly deleting them.** Both are
defence-in-depth against a *future* edit: while the commit is pathspec-limited it cannot touch a second path,
and if `git commit` returns success the blob is there. No test can reach either branch without first breaking
something else. They are kept deliberately — but **they are not covered, and nobody should read the green
suite as evidence that they work.**

**What M5 did produce is B5b**, which attacks the property that *is* falsifiable: stage an unrelated file,
approve, and assert the authorize commit still touches exactly one path **and** the interloper is still sitting
uncommitted in the index. M7 confirms it — remove the pathspec and B5b dies. That bar exists only because the
mutation run embarrassed the check above it.

## Gate results

| Gate | Result |
|---|---|
| `hmp-commission.test.mjs` | **54 / 54** ✅ |
| `relay-approve.test.mjs` | **40 / 40** ✅ (baseline 29 + 11 new) |
| **Full suite** | **796 passed, 94 files** ✅ (primer baseline: 787 / 94) |
| `tsc -b` | **0** ✅ |
| **D9 — honesty** | ✅ every `fence`/`prevent`/`containment` in the diff is either a *different* mechanism (the write-verb guardrail, `sha-moved`) or an explicit denial ("detection, not prevention"). **No added line describes the path move as a fence.** |

**Retry budgets: nothing exceeded.** Every bar passed on attempt 1 of its pre-registered budget. The single
stop was the show-stopper fence, which is not a retry.

**Deviation to disclose regardless of the above** *(Rule 7 signal, for the implementation reviewer)*: I added
**two new keys** to `relay-approve.mjs`'s `REFUSAL` — `COMMIT_FAILED` (required by approved bar B9; without a
reason of its own a failed commit returns `ok: true`) and `BAD_RUN_ID` (required by B10). Scope forbade changing
`REFUSAL` **values**; these are additions, no existing value altered. Flagging rather than assuming.
