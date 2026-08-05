# Backlog gate — 2026-08-05

**Convened by:** Claude, wearing **SM + planner** (resource-scarcity fallback; Codex and agy PO-declared
unavailable). **Occasion:** the agent-selectable queue is empty and no item is `doing`, so the gate is due
before anything new opens — workflow §3b, *"disposition every `todo` item in the same pass, so nothing rots by
being forgotten."*

**What this document is and is not.** It is a **recording**, not a decision. Every disposition below is a
**recommendation to the PO**. Nothing in this pass changed a `status`, a `blocked_by`, or an `autonomy` field —
those are PO acts, and `autonomy: eligible` is authority in file form. The `bl093` guard was re-run after the
edits this gate made and the selectable set is still `[]`.

---

## 0. Verified baseline — run, not remembered

| Check | Result |
|---|---|
| `npx tsc -b` | **exit 0** |
| `npx vitest run` | **692 passed (82 files)** |
| `bl093-backlog-selectable` | **15/15**, selectable set `[]` |
| AgentTalk repo | clean, `790b6d7`, in sync with origin, `master` only |
| `agentalk-mcp-client` | clean, `236b30a`, in sync with origin, `master` only |
| Worktrees | the two primaries only; **0 prunable** |
| Stray `task-*` branches | none, in either repo |
| `/tmp` | no `att-*`, no `agentalk-task-*` |
| Ports 3500 / 3600 | free |
| Backlog | **117 items** (118 raw `id:` lines − 1 template), 11 real todos, 24 deferred, **0 `doing`** |
| Meter | claude weekly **0%** (window reset; next Aug 12) · codex 83% · antigravity `ok:false` |

**Platform: macOS (`Darwin`).** This is load-bearing for two items below — the machine moved back from the
Linux box on 2026-07-30, and two items' ground truth moved with it.

---

## 1. Dispositions — all 11 open todos

Recommendation column: **KEEP** = stays `todo` as written · **PARK** = recommend `deferred` + reopen condition
· **MERGE** = recommend folding with another item · **PO** = only the PO can advance it.

| Item | Subject | Verified this pass | Recommendation |
|---|---|---|---|
| **BL-028** | idle timeout is dead code | blocker still live (BL-084 T3 unlanded) | **KEEP** — see §2.1 |
| **BL-084** | typed non-reply reason (T2, T3 open) | T1 merged `05f78e3`; §4 fully ratified | **KEEP — chain head**, needs a PO re-gate |
| **BL-096** | wall-clock cap never tested | ⬛ **the gate got this wrong — see §5** | **KEEP, re-scoped** |
| **BL-098** | Linux `launchctl` gap | **dormant on macOS** — `bwrap` absent, `launchctl` present | **PARK** — see §2.2 |
| **BL-100** | client lockfile drift (half 1) | **still real, verified by reading both files** | **KEEP** — rationale stale, see §2.4 |
| **BL-103** | teardown leaks a branch per run | no leaked branches *right now* | **KEEP** — clean bar, good rung |
| **BL-109** | no place to record a `critical` disposition | **has now bitten twice** (hmp1, hmp5) | **KEEP — raise priority**, §2.5 |
| **BL-110** | `[PO-RELAY]` authority | **its "still open" list is stale**, §2.6 | **PO** — scope shrank |
| **BL-112** | HMP silently excises a literal | mechanism inside PO's Hermes install | **PARK** — see §2.7 |
| **BL-114** | cap fails **open** (coerces to `0`) | **still real**, `launcher.mjs:229` | **MERGE with BL-117**, §2.3 |
| **BL-117** | cap fires on an unattributable sum | filed 3 days ago from the hmp5 kill | **MERGE with BL-114**, §2.3 |

---

## 2. The findings — what this pass actually turned up

### 2.1 BL-028 asked for a ruling *at the next backlog gate*. This is that gate.

Its own text: *"Status left `todo` rather than `deferred` — a PO call, worth making at the next backlog gate."*
**Recommendation: keep it `todo`.** It is not parked work waiting on a trigger; it is **phase T3 of an existing
plan** (`design/bl084-plan.md`), behind a blocker that is itself active. Parking it would misfile scheduled work
as abandoned work. `blocked_by: [BL-084]` already does the sequencing honestly.

### 2.2 BL-098 is dormant, because the machine moved — and BL-054's *design* moved with it

BL-098 is a Linux-only defect: `managedPids()` reads `launchctl`, which has no systemd branch, so nothing can be
classified `LEGITIMATE` on Linux. **On this box `launchctl` is present**, so the defect cannot fire, cannot be
verified, and — by the item's own words — *"cannot be closed from macOS, and should not be closed on reasoning
alone."* An item that can neither progress nor be tested on the current machine is the definition of parked.
**Recommend `deferred`, reopen condition: work resumes on a Linux box.**

**And a consequence nobody has recorded yet — this one is worth more than the disposition.** Deferred item
**BL-054** (blessed-root enforcement for `workdir`) carries a feasibility section headed *"TESTED on this
machine, not assumed"*: `bwrap` installed, unprivileged user namespaces enabled, Landlock compiled in, with
four measured BLOCKED results. **All of that was measured on the Linux box. `bwrap` does not exist on macOS**
(verified: `command -v bwrap` → not present), and neither do user namespaces or Landlock. So BL-054's
**enforcement half is currently a design with no implementation path on this machine**, while its *policy* half
(the launcher refusing a `workdir` outside an allowlist) is platform-independent and unaffected.

This matters because BL-054's reopen condition is *"before any unattended/unwitnessed autonomous run"* — i.e. it
is the fence the ladder is expected to need next. **Its evidence needs re-taking before it is relied on.** Not
edited here; deferred items are the PO's park.

### 2.3 BL-114 and BL-117 are two failure modes of one function, and neither can be fixed alone

This is the strongest structural finding of the pass, and it is the same shape as BL-028/BL-084.

- **BL-114:** `readMeterPercent` ends `return typeof pct === 'number' ? pct : 0` (verified still present,
  `agentalk-mcp-client/scripts/launcher.mjs:229`). An unreadable meter becomes a clean `0`, the delta goes
  negative, and **the rail can never fire while looking healthy.**
- **BL-117:** when the meter *is* readable, it reports **machine-wide per-provider** percentages, so it fires on
  the **sum** of the worker and the supervising session and attributes it to the worker. On hmp5 it killed a run
  14 seconds after the work was complete.

Fix one and the other still makes the rail wrong. **Recommend they be *scheduled* as a single unit of work** on
`readMeterPercent` + the delta logic — reject rather than coerce, record reachability in the run artifact, and
resolve attribution (or stop calling it containment).

**BL-117 pushes back on this, in writing, and it is right — so the recommendation is narrower than "merge
them."** Its text says *"This is NOT a duplicate of [[BL-114]] … Close neither on the other's evidence,"* and
that holds: `hmp5` is evidence about BL-117 **only**, because the provider block was `ok: true` throughout and
BL-114's coerce-to-zero path never engaged. **Two defects, two bars, neither closed on the other's run — but one
visit to the function.** The distinction is sequencing versus identity, and BL-028/BL-084 is the precedent: one
shared primitive, consumers that close separately.

**A correction that falls out of this, and it belongs to BL-114:** its closing paragraph reads *"Do not cite any
past run as evidence the rail works... **no run to date has recorded a meter delta against a verified-live
provider block**."* **hmp5 did exactly that** — `meter +24% ≥ 20%`, against a live `claude` block. The
prohibition still stands for the *fail-open* half; the factual claim behind it is superseded by BL-117.

**Sequencing note for BL-096:** ⬛ **superseded — see §5.** The stalling-worker harness this pointed at already
exists and passes; the meter fixes need their own bars, not that one.

### 2.4 BL-100's remaining half is still real — but its stated reason for being PO-only is stale

**Verified by reading both files, not inferred:** `agentalk-mcp-client/package.json` declares bins
`llm-agent` + `agent-launcher`; the committed `package-lock.json` records `attach-harness` + `llm-agent`. The
drift is exactly as filed, and it is **not cosmetic** — it cost a real worker: hmp5's implementer declined to run
`npm install` because doing so would resync the lockfile and dirty tracked files. That refusal was graded as
Implementer Rule 2 held without supervision, which is true, but the obstacle it worked around is this item.

**The stale part.** BL-100 justifies leaving it to the PO with *"client repo, so it inherits no governance
([[BL-086]]) and is the PO's to land."* **BL-086 closed 2026-07-30.** The client now carries its own `AGENT.md`
with `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` symlinks, and hmp5 proved live that a governed worker delivers there.
The premise is gone; whether the conclusion survives it is the PO's call, not mine. Corrected at source.

### 2.5 BL-109 has now recurred, which is the argument it was missing

Filed as a predicted gap; it bit for real on hmp1 (`head-moved-undetermined`, PO disposed of it in prose in a
grading doc, where no check can see it), **and again on hmp5** — whose closure commit (`9cb0218`) is literally
titled *"grading, PO disposition of the critical, and BL-117"*. Two operator runs in a row have produced a
`critical` that only a human reading prose can know was cleared, while the charter says an uncleared `critical`
**gates the next operator run**. **Recommend raising its priority above the other operator items:** it is the one
that makes the gate mechanical instead of conversational, and every further rung pays its cost.

### 2.6 BL-110's "still open" list is stale — the authority decision was taken

The item's last two blocks say *"Open and unchanged: the `[PO-RELAY]` authority decision"* and flag that
`AGENT.md` still reads *"push … the PO's, absolutely and without exception"*, deliberately unamended because
governance wording is the PO's.

**Both were settled and encoded, in `AGENT.md`, dated 2026-07-31:** the Origin Tag Protocol now carries a
`[PO-RELAY]` row in the tag table and a full **Rule 5** defining it as token-bound, non-apex, answer-only and
unable to initiate; and the OPERATOR charter now states *"Push remains the PO's, absolutely and without
exception"* **followed by** the paragraph reconciling it with relayed authorization. What remains open on
BL-110 is narrower than its own text claims: **BL-107** (parked, accepted-open) and **write-class verbs over
HMP**. Corrected at source.

### 2.7 BL-112 — recommend parking, because its own preferred fix is already the practice

The excision is deterministic, characterised by four probes, and **inside the PO's Hermes install**
(`~/.hermes/**`, read-only to us) — so it is unchaseable from here. Its own fix direction says to prefer *"make
the acknowledgement carry no data that is not independently derivable"* **regardless of whether the rule is ever
found**, and that is now how commissions work: the artifact path is derived from the committed config.
**Recommend `deferred`, reopen: a datum we need starts depending on surviving the courier.**

### 2.8 One factual defect in `AGENT.md`, corrected

`AGENT.md:325` read: *"the client has no `GEMINI.md` while this repo does (verified 2026-08-02), so a gemini
worker there inherits nothing by that convention."* **The client has had `GEMINI.md -> AGENT.md` since
2026-08-02 00:12**, committed in the client as `d43be0f docs(BL-086): add the GEMINI.md symlink the closure left
out`. `AGENT.md` was last written at 00:10 — **two minutes before the symlink existed.** The claim was true when
written and was falsified almost immediately; nobody went back.

Corrected to state the ground truth. The *surrounding* caution is untouched and still stands: **the file
existing and a worker being governed are different claims**, and inheritance is verified for claude only
([[BL-080]]).

---

## 3. Cross-cutting picture — what the backlog is actually about now

**Six of the eleven open todos are the autonomous ladder's own safety rails**, and not one of them is proven:

| Rail | State |
|---|---|
| wall-clock cap (BL-096) | ⬛ **proven in test** (real process, real timeout, PID confirmed dead); never fired in a real *run* — §5 |
| meter cap, unreadable (BL-114) | **fails open**, silently |
| meter cap, readable (BL-117) | fires on a sum it **cannot attribute** |
| `critical` disposition (BL-109) | **has no representation**; bitten twice |
| run teardown (BL-103) | **leaks a branch per run** |
| workdir enforcement (BL-054, deferred) | design's evidence **invalidated by the machine move** |

The remaining five split into one engine chain (**BL-084 → BL-028**, with deferred **BL-078** behind it), one
PO-only governance item (**BL-110**), one unchaseable courier bug (**BL-112**), one dormant platform item
(**BL-098**), and one small real defect in the client (**BL-100**).

**The observation worth the PO's attention:** the ladder has now run six rungs and its instruments are the least
verified part of the system. Every rung to date has been *witnessed*, so a rail that fails open has never
mattered. BL-054's reopen condition — *before any unattended run* — is the moment all six of these stop being
bookkeeping. If the next rung is meant to be less supervised than the last, this table is the precondition list.

---

## 4. What needs a PO decision

1. **BL-098 → `deferred`?** (dormant on macOS, cannot be closed here)
2. **BL-112 → `deferred`?** (unchaseable; preferred fix already the practice)
3. **BL-114 + BL-117 → one item, or explicitly sequenced?** Neither fixes the rail alone.
4. **BL-084 T2** — the re-gate its own plan asks for, plus a go-ahead on the only real behaviour change.
5. **BL-109 priority** — raise it above the other operator items?
6. **The queue is empty.** Refilling it is yours alone. If you want the next rung, the readiest candidates by
   *bar clarity* are **BL-103** (explicit bar + a specified mutation check) and **BL-100 half 1** (one line, in a
   repo now governed, with hmp5 as precedent) — but neither is a rail fix, and §3 is the argument for doing a
   rail first.

**Not done, and deliberately:** no `status` flipped, no `blocked_by` re-cut, nothing marked `autonomy: eligible`,
no deferred item edited, and the todo queue was **not** reordered — sequencing recommendations are in §4 for you
to ratify rather than applied to the file.

---

## 5. Addendum, same day — the gate itself made the error it was written to catch

The PO picked **BL-096** off §4 and authorised the stalling-worker harness. **It already exists.**

`agentalk-mcp-client/__tests__/bite0-launcher.e2e.test.mjs:146` launches a **real** `llm-agent` process, never
answers `await_turn` so the worker stalls, sets `wallClockMs: 1500`, and asserts `cap-wallclock` **and that the
PID is dead**. Unit sibling at `bite0-launcher.test.mjs:94`; meter breach at `:107`. **Ran them: 2 passed,
2.46s.** Both shipped in `a86733d` on **2026-07-16** — the cap landed with its test, **eleven days before BL-096
was filed**.

**The error is mine and it is worth naming precisely.** BL-096 says *"no run has ever been interrupted"* — true,
and about **operator runs**. I read it as "the cap is untested," recommended it as *"the permission slip to walk
away,"* and carried that recommendation through the gate, §3's table and two messages to the PO **without
running the suite it was talking about.** §0 of this document opens by insisting the baseline be *run, not
remembered*; I then took an item's characterisation of the code on trust.

**What saved it was sequence, not diligence:** the scope was declared and checked **before** the build
(Implementer Rule 6), so the cost was one investigation instead of a duplicate harness and a green that proved
nothing — the [[BL-108]] failure this backlog already names.

**BL-096 is corrected in place, not closed.** Its original words — *"whether commits survive one, whether the
working tree is left coherent, or whether cleanup behaves"* — are still unanswered, because the e2e worker
**hangs before doing any work**. `hmp5` is the one real data point and it split: **commit survived, report
destroyed.** Under the PO's chosen decoupling (unattended execution, human grading) that is the whole question —
*when a cap fires, what is left to grade?*

**Correction to §3's framing:** the rails table said "not one is proven." That was too strong. The wall-clock
rail **is** proven to terminate, in test. What is unproven is what termination *does to work in flight* — a
narrower and more useful gap. The rest of the table stands.
