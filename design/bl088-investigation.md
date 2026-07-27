# BL-088 — the teardown question: investigation and recommendation

**Item:** [[BL-088]] (`todo`, filed 2026-07-27 by *using* the harness on the O-1 run, not by review).
**Status of this document:** an **investigation with a recommendation**, for the PO/architect to weigh. It
decides nothing. BL-088 recorded its three options as *"deliberately NOT pre-decided"*, and that stands.
**Scope:** read-only. **No code was changed**, and none is proposed as part of this document.
**Written:** 2026-07-27, by the worker of a launched read-only investigation run (operator ladder rung **O-2**
in shape: a read-only investigation committed to a branch).

**Recommendation in one line: take option (a) — leave the harness alone, keep the documented ordering — and if
the PO ever wants the teardown question machine-answered, answer it with an *absolute* check, not by adding a
demotion path to the differential one. Option (c) is verifiably worse than the problem it solves and should be
struck.**

---

## 1. The finding, restated precisely

Run `infra-invariant check` **after** the runbook's cleanup and it reports `worktree-removed` and
`branch-removed` as **`critical`** — every time, on a perfectly clean run. Cleanup legitimately removes the
worktree and branch the run added, and [[BL-087]]'s central asymmetry says removals are *never* expected:

> **ADDITIONS CAN BE EXPECTED. REMOVALS AND MOVES NEVER ARE.**
> (`scripts/infra-invariant.mjs:33`; `applyAllowlist` is simply never called for removals — `:112-113`.)

That asymmetry is **correct**, and the item says so. It is the right rule for *"did this run break anything?"*
and the wrong rule for *"did we get back to baseline?"* **One harness, two questions, and only the first is
implemented.**

### The two questions, named

| | **The damage question** | **The teardown question** |
|---|---|---|
| Asks | did this run break the infrastructure? | did we return to the pre-run state? |
| Shape | **differential** (needs a baseline) | **absolute** (needs a rule about what may exist) |
| Gates | the next operator run (PO, `bl087-plan.md` §9.1) | nothing today |
| Answered today | **yes**, correctly | **no** |
| Cost of a wrong answer | an operator burns infrastructure and it is not caught | residue accumulates unnoticed |

The shape row is the load-bearing one, and §6 returns to it. This project already knows the distinction: the
harness's own header draws exactly this line against [[BL-023]] — *"BL-023 is ABSOLUTE … this is DIFFERENTIAL"*
(`infra-invariant.mjs:51-53`).

### It is already worked around, at zero cost

`design/launch-and-monitor-runbook.md` §10a now says **check BEFORE cleanup**. That answers the damage
question correctly, and the damage question is the one that gates. So **nothing is urgent here.** The only live
question is whether the second question is worth supporting at all.

---

## 2. What I verified, rather than argued

Everything in §3–§5 rests on these runs, not on reading. All are pure reads against the exported functions.

**(i) The teardown criticals reproduce, under a wide-open allowlist.** Synthetic before/after in which the
operator's worktree and branch are removed, `allowNewWorktrees: ['*']`, `allowNewBranches: ['*']`:

```
critical worktree-removed — agenttalk: worktree disappeared — /private/tmp/att-op-2
critical branch-removed   — agenttalk: branch deleted — task-op-2
exit 1
```

No allowlist reaches them — as designed, and as pinned by two bars in
`scripts/__tests__/infra-invariant.test.mjs:147-184` (*"DoD row 3 — REMOVALS are critical, and no allowlist
reaches them"*). **This is a pinned behaviour contract, not an accident of implementation.** Any option that
changes it changes a contract, with everything the M06 rules say that entails.

**(ii) Option (c), literal reading — baseline the operator worktree before it exists.** It cannot be
snapshotted:

```
snapshotRepo('/private/tmp/att-op-99')
  → {"path":"…","unavailable":"path does not exist"}
```

and `diffRepo` **returns early** on an unavailable side (`infra-invariant.mjs:325-328`), so the *entire* repo
comparison is skipped and the whole run reduces to one line:

```
warn repo-unavailable — agenttalk: path does not exist
exit 1
```

**No HEAD check, no tracked-file check, no worktree or branch check — at the exact coordinate the operator
works in.** This is the worst possible failure of a safety harness: it does not fire loudly, it goes quiet.

**(iii) Option (c), charitable reading — baseline the main checkout instead.** Both snapshots land under the
key `agenttalk`, and `diffRepo` compares **by key, never by path** (`:322-395` contains no path comparison), so
two different directories are silently diffed against each other. Real snapshots,
`/Users/fausto/Software/AgentTalk` vs `/private/tmp/att-op-2`:

```
critical head-moved        — agenttalk: HEAD moved 2adb3d97 → c63e4b72
critical branch-changed    — agenttalk: current branch changed master → task-op-2
critical upstream-diverged — agenttalk: divergence vs upstream changed +2/-0 → none
exit 1 | criticals 3
```

**Three false `critical`s, on every run, on the path that gates the next operator run.**

---

## 3. The three options

### (a) Leave it — document the ordering, never ask the teardown question

**Cost:** zero code, zero new severity semantics, one ordering rule already written into the runbook.
**What it buys:** the damage gate keeps working, unchanged and believable.

**Evidence that it works, end to end:** the O-1 re-run cleared with the corrected ordering — harness **exit 0**,
two `info` rows for the nested `agentalk-task-*` pair, **zero `warn`, zero `critical`**
(`o0-operator-launch-plan.md` §6d, row 6). And that row moved *because the ordering was fixed, not because the
bar was* — the severity model was never touched. **The workaround is not a patch over a broken tool; it is the
tool being used correctly.**

**Its real cost, stated plainly** (this is the strongest argument against my own recommendation): residue left
by run *N* is present in run *N+1*'s **baseline**, and a differential harness cannot see what is already in its
baseline. So under (a), leftover worktrees and branches **silently normalise** — exactly the class of residue
BL-087 was filed over, when rung 6 left a nested pair that hand-verification missed. (a) does not close that
hole. It never claimed to; the item's own framing is that this is about the *second* question. But the hole is
real and should not be waved away — §6 says what would close it.

### (b) A `--after-teardown` mode

Demote a removal to `info` **only if** the removed worktree/branch matches the additions allowlist **and** was
absent from an earlier pre-worktree baseline.

**In its favour, steelmanned:** it is the only one of the three that actually answers the recorded question, and
it answers it *soundly* — the two-part condition is well chosen. It also respects the fence: the demotion lives
in a separate mode, so the ordinary damage check keeps `worktree-removed`/`branch-removed` at `critical` and the
DoD-row-3 bars stay green. **If the PO decides the teardown question must be machine-answered, (b) is the right
shape and (c) is not.**

**One thing to correct in the item's framing, in (b)'s favour:** (b) does **not** inherit (c)'s ordering hazard.
The third snapshot `S0` is consulted *only* as a demotion reference; the damage baseline stays `S1`, still taken
last. (c)'s defect does not transfer.

**What it costs:**

1. **A third snapshot and a second ordering rule**, in a procedure that has demonstrably been executed wrong.
   O-1 got **both** of its two orderings wrong in a single run — the baseline taken before the operator's own
   commit (three `critical`s, failed the bar) *and* the check placed after cleanup (this item). Adding a third
   timed artefact to a two-step procedure with a 2-for-2 error record is the cost that should dominate here.
2. **A new severity path.** The harness's own design note is explicit that `info` is *"the pressure valve that
   keeps `warn`/`critical` believable"* (`:40-42`). Every demotion path is a place a genuine removal can be
   quietly reclassified. The item's own words: *"every added severity path is a place the signal can quietly
   rot."*
3. **It is a behaviour change** to a tool whose defining property is that it is trusted unattended, and whose
   `critical` gates a PO decision. That is not fatal — it is a gate to pass, not a wall — but it is the correct
   weight to put on it.

### (c) Take the baseline before creating the operator worktree

**Verdict: this option does not work, and §2 (ii)/(iii) are the evidence.** Both readings fail:

- *literal* (baseline the future worktree path) — the repo comparison is **skipped entirely** and degrades to a
  single `warn`;
- *charitable* (baseline the main checkout) — **three false `critical`s every run**, because the diff keys on
  repo name and never on path.

The item's own reservation was that (c) *"makes the operator's own worktree a finding during the run, which is
noise on exactly the path that must stay believable."* **That reservation was right, and understated.** With
today's allowlist the added worktree and branch would only be `info` — so the *noise* concern is milder than
feared — but the real damage is elsewhere and worse: (c) either **disables** the damage check at the operator's
coordinate or **falsifies** it. It trades a false `critical` at teardown, which costs nothing because it is
expected and documented, for a false `critical` **during the run**, which gates the next operator run and which
a tired operator will learn to wave through. **That is precisely how a harness gets ignored.**

**Recommendation: strike (c) from the option set** with the §2 evidence recorded, so it is not re-proposed.

---

## 4. Recommendation

**Take (a).** Reasons, in the order I weight them:

1. **The gate the harness exists to serve is already served, correctly.** A `critical` blocks the next operator
   run (PO decision, `bl087-plan.md` §9.1). That question is answered right today, and O-1's re-run proved it
   on a real operator run: exit 0, nothing above `info`. **Changing a working gate to answer a question that
   gates nothing is the wrong direction of risk.**
2. **The cost of the current wrong answer is zero.** The post-cleanup criticals are **expected, explained, and
   documented** in the runbook and the ledger. A false alarm you have written down and understood is not a false
   alarm; it is a known ordering rule. Compare to (c)'s failure mode, which is false alarms *nobody expected* on
   the live gate.
3. **BL-087's top named risk was cried wolf, and it was mitigated by not guessing.** The Gate-1 amendment
   reused BL-023's classifier *specifically* because inventing a second answer to a question already answered
   was how [[IP-15]] happened. **Adding a demotion path to buy quiet is the same move in a different costume.**
4. **(b) is not wrong — it is not yet worth it.** The teardown question has, so far, cost exactly one confusing
   evening and one backlog item. Its answer gates nothing. When the operator ladder reaches O-3 and runs become
   routine rather than ceremonial, the accumulation risk in §3(a) becomes real and this should be revisited —
   **and §6 argues that the answer then is cheaper than (b) anyway.**

**Confidence: high on striking (c)** (measured, twice, both readings). **Moderate on (a) over (b)** — this is a
judgment about operational burden versus a real-but-unquantified accumulation risk, and it is the PO's to
overrule. If the PO's read is that residue accumulation is the live risk, **that is a reasonable disagreement
and the answer is §6, not (b).**

---

## 5. The fence — unchanged, and it is the part to defend

> **Removals must not become allowlistable in the ordinary damage check.**

That asymmetry is the whole reason the harness can tell an operator *doing its job* (adds) from one *burning the
infrastructure* (removes). Two bars pin it under a wide-open allowlist
(`infra-invariant.test.mjs:147-184`) — they are behaviour contracts, and any future option that touches them
needs the PO, not a reviewer. **Whatever is decided, this survives.** (a) preserves it by construction; (b)
preserves it by scoping the demotion to a separate mode; (c) does not threaten it either, but fails for other
reasons.

---

## 6. If the teardown question is ever wanted, it is cheaper than (b) — an observation, not a fourth option

**Offered as input for the PO/architect, deliberately not decided here, and not filed.**

The teardown question is **absolute in shape, and it is being forced into a differential tool.** "Did we get
back to baseline?" for an operator run does not actually need a baseline — the post-conditions are known
statically and are already written in the runbook:

- no worktree matching `att-op-*` or `att-*/agentalk-task-*` remains;
- no branch matching `task-op-*` or `task-task-*` remains;
- nothing is listening on 3600.

That is a rule about what may exist, not a diff. Answering it needs **no third snapshot, no ordering rule, and
no new severity path in the differential harness** — which is why it dodges every one of (b)'s three costs. It
is also the same split this project already made deliberately once: BL-023 absolute, BL-087 differential, *"the
two tools ask different questions and both answers are correct"* (`infra-invariant.mjs:51-53`).

It would additionally close the hole (a) leaves open in §3 — residue normalising into the next baseline — which
a teardown *mode* on the differential harness would **not** close, since by then the residue is in the baseline
either way. **That is the substantive reason to prefer this direction over (b), not merely the cheaper one.**

Two honest caveats: it needs a home (extending BL-023's absolute checker is the obvious candidate, but that is a
design question, not a given), and a static post-condition list is a second place the `att-op-*` conventions are
written down, which can drift from `DEFAULT_EXPECT`. Neither is free. **If the PO wants this pursued, it should
be filed as its own backlog item with its own plan and Gate 1** — not folded into BL-088's disposition.

---

## 7. Incidental finding — reported, not fixed

Found while probing §2(iii); **unrelated to BL-088**, and **deliberately left alone** (Implementer Rule 2:
finding a bug is the job, fixing it is not).

**`snapshotRepo` corrupts the path of the first `git status --porcelain` entry when that entry's status code
begins with a space** (i.e. an unstaged-only change: ` M`, ` D`, …). `git()` calls `.trim()` on the whole
output (`infra-invariant.mjs:129`), which strips that leading space from the **first line only**; the parser
then reads `slice(0,2)`/`slice(3)` against a line that is one character short.

Reproduced against the main checkout, whose porcelain output is exactly ` M com.fausto.agenttalk-orchestrator.plist`:

```
snapshotRepo('/Users/fausto/Software/AgentTalk').porcelain
  → [ { "code": "M ", "path": "om.fausto.agenttalk-orchestrator.plist" } ]
                        ↑ leading "c" lost;  code " M" read as "M "
```

**Blast radius, honestly bounded:** first line only (`trim()` touches only the ends of the whole string), and
both sides of a diff corrupt it identically, so it does **not** generally manufacture findings. What it does do
is (1) report a **wrong filename** in a `tracked-file-modified` `critical` — on a tool whose output is evidence
in a PO decision — and (2) make a **staged** `M ` and an **unstaged** ` M` indistinguishable on that first line,
so a staged/unstaged transition there is invisible. Low severity, real, and cheap to fix at the parse site
rather than by touching `git()`.

**Suggested disposition: file it as its own backlog item.** It is not BL-088 and should not ride along with
BL-088's decision.

---

## 8. What would change this recommendation

Recorded so a future reader can tell whether the reasoning has expired:

- **The PO decides the teardown question must be machine-answered.** Then the answer is §6 if it is willing to
  file a new item; **(b)** if it wants it inside this harness. **Never (c).**
- **Residue is observed accumulating across operator runs.** That is (a)'s named cost coming due, and it moves
  §6 from "cheaper" to "needed."
- **Operator runs become frequent enough that the pre-cleanup ordering is skipped in practice.** The argument
  in §4.2 — that a documented false alarm is not a false alarm — depends on someone reading the documentation.
  If the ordering is being got wrong in the field, the burden calculus in §3(b) inverts.
