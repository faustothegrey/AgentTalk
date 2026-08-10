# Grading — run `hmp8` ([[BL-122]]): **PASS**

| | |
|---|---|
| Item | [[BL-122]] — `apps/web` has zero tests and is excluded from the suite |
| What the rung tested | **the first BRIEF-AUTHORING rung** — the deliverable is a document that will govern a later run, not code |
| Brief / bar | `design/operator/hmp8-brief.md` · `design/operator/hmp8-bar.md` (sha256 `200b425a…`, unedited) |
| Authorization | `design/operator/hmp8.authorized` @ `fdf5f37` (PO-instructed) |
| Courier | Hermes, over HMP |
| Worker | `claude` / opus, persistent, workdir `/tmp/att-op-hmp8` (AgentTalk worktree) |
| Termination | **completion** — no rail fired; pid 69105 exited, port 3600 released, no orphans |
| Commit | `43fa42e` on `task-op-hmp8`, 1 file, **+273** |
| Verdict | **PASS.** R1, R1a, R2, R3, R4, R5, R6, R7 met. R8 n/a. R9 not yet computable. |

---

## R2 — the deciding row, and it passed on the merits

R2 asked for both forks presented, argued at their strongest, with the decision **named as the PO's and not
taken**. The brief does this in §4 and reinforces it in three independent places: a header warning that it must
not be read as having leaned, `"The call is the PO's"` in §4, and — going further than the row required —
**§7.1 makes "no recorded PO decision on the fork" a show-stopper for the next worker.** It also labels its
proposed bar rows by end (§8) so no delivery can inherit both.

Both cases are genuinely argued rather than strawmanned. (A): the UI is the human's only window onto a running
team, its characteristic failure is *silence*, and silence is what eyeball verification is worst at. (B): the
cheapest honest (A) is a 649-line component mounted with a stubbed socket and stubbed `fetch` — infrastructure
whose first and only customer is a six-line arm, and infrastructure with one customer usually has to be rebuilt
for the second.

## The finding the item did not contain — verified by EXECUTION at grading

§3.1 claims **the exclusion is not the gate**: `include` (`vitest.config.ts:19`) is an allowlist of six globs,
none under `apps/web`, so deleting `'apps/web/**'` from `exclude` collects **nothing**. If true, the item's own
stated fix direction, taken literally, is a no-op — and "delete the exclusion, suite still green, call it done"
is the delivery it would have produced.

**The brief was honest that it could not prove this**: with zero test files under `apps/web`, both
configurations collect the same nothing. It said how to settle it — drop a throwaway test under `apps/web/src`
and re-run collection — and wrote *"if that file is collected without an include glob, this brief is wrong on
its most load-bearing point and I want to be told."*

**Graded by doing exactly that**, in the disposable worktree:

```
throwaway test at apps/web/src/__throwaway.test.tsx
  exclusion PRESENT → files under apps/web collected: 0   (total 89)
  exclusion DELETED → files under apps/web collected: 0   (total 89)
```

**Confirmed.** The claim holds, and it is now executed rather than reasoned. This is the single most valuable
thing the run produced: it converts the item's literal fix direction into a documented wrong answer (the brief's
own **6a**, with row **A2** written to catch it).

## R4 — premises verified by symbol

All eight §2 premises re-derived independently at grading. P1 (`vitest.config.ts:20`), P2 (six include globs,
none under `apps/web`), P5 (switch `App.tsx:202`, arm `:251`, **no `default:` in the file**), P7 (vitest
**2.1.8**) — all hold. §3.3's citations also hold: `App.tsx` is **exactly 649 lines**, `pushSidebarEvent`
defined `:197`, `useState(true)` at `:167`, `new WebSocket` at `useWebSocket.ts:31`, `apps/web/node_modules`
present on disk.

**One apparent miss was the GRADER's error, recorded because it is the lesson of the session.** `SidebarEvents.tsx:41`
and `:50` first appeared not to resolve — because the grader searched `apps/web/src/components/SidebarEvents.tsx`,
a path it *assumed*. The file is `apps/web/src/SidebarEvents.tsx`, and lines 41 and 50 are exactly the two
`!sidebarEventsCollapsed` gates claimed. **The brief was right; the check was wrong.** Third time this session a
coordinate was asserted rather than derived, and the first time the victim was the reviewer.

## The remaining rows

| Row | Result | Evidence |
|---|---|---|
| **R1** | outcome **(a)**, the artifact | not a refusal; R1a applies, R8 n/a |
| **R1a** | **PASS** | `git show --stat`: 1 file, +273, sole addition; 273 ≥ 60 |
| **R3a** | **PASS** | `findsLaunchInstruction` over the produced brief → `PASSES` |
| **R3b** | **PASS**, and beyond the row | §8's preamble performs its **own** pairwise check, identifies **B3 × A2 as a direct contradiction**, and writes **A3 as a delta rather than a pinned total** — citing the hmp7 R4 defect as the reason. It rediscovered the lesson and applied it unprompted. |
| **R5** | **PASS** | `git diff --name-only` → `design/operator/bl122-brief.md` only. No `apps/web/**`, no `vitest.config.ts`, no `scripts/`, no test file |
| **R6** | **PASS** | `tsc -b` exit 0 · suite **743/743, 89 files** — unchanged, as a document-only deliverable requires |
| **R7** | **PASS** | worktree `att-op-hmp8`; port 3600 released; pid 69105 gone; no orphaned provider process; branch **not merged, not pushed**; primary checkout at `fdf5f37`, unmoved. Its one modified file is `design/operator/.hmp-launched.json` — **the launch ledger, written to the primary checkout BY DESIGN** (replay protection that evaporates with a worktree cleanup is not protection), not a containment breach |
| **R8** | **n/a** | the artifact was delivered |
| **R9** | **not yet computable** | discard rate needs the PO's edit commit on top of `43fa42e`. Early signal is strong — the grader would change little — but *the number is the measurement and it has not been taken* |
| **R10** | recorded | `CLAUDE.md -> AGENT.md` present in the workdir; provider `claude`, the one transport where inheritance is verified ([[BL-080]]) |

## What this rung demonstrated, beyond the verdict

**A delegated brief found a decision nobody had noticed was needed.** That was the capability under test, and
§3.1 is a stronger instance than the fork itself: the item's literal fix direction is a no-op, which neither the
item, the plan, nor the meta-brief had spotted. The brief also **volunteered its own weakest point** and named
the experiment that would refute it — which is what made grading it cheap.

It also **exceeded the template's shape**: 273 lines against exemplars of 152/158, with a §3 ("three things the
item's own text does not say") that no property in the meta-brief asked for. Worth watching rather than
celebrating — length is not quality, and a future instantiation that runs long without a §3-grade finding is
padding.

## ⚠️ Independence — read this before relying on the verdict

**One actor wrote the plan, the meta-brief, the brief, the bar, the config and the authorization file, and then
graded the result.** Under the sole-agent fallback there was no alternative, but the limit is real: **this
grading is self-review of its own instrument.** The mechanical rows (R1a, R3, R5, R6, R7) are objective and
would survive any grader. **R2 is judgement, and it was judged by the person who wrote the row.** The mitigation
applied was to ground the one claim that could be executed — §3.1 — rather than to reason harder about the rest.

If hmp8's result is ever load-bearing, re-grade **R2** with fresh eyes.
