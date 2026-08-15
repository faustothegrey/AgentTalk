# Proposal — splitting `AGENT.md`, and why the plan for it was backwards

**Status:** PROPOSAL — awaiting a PO decision. Nothing here is in force.
**Author:** Claude (planner), 2026-08-15, under the resource-scarcity fallback.
**Parent:** [[BL-144]] Wave 2, T3 (`design/bl144-plan.md` §4). **Deliberately not executed.**

---

## Why this is a proposal and not a commit

The PO's standing grant for this overhaul pre-approves commits, merges and pushes. It does not reach
this file, for a reason specific to it: **`AGENT.md` is what every agent auto-loads at turn 1**,
through three names on a case-insensitive filesystem (`AGENT.md`, `AGENTS.md`, `CLAUDE.md` — one file,
three names). Splitting it changes what every actor in this project reads *before it does anything*.
That is the highest-blast-radius edit available here, and it is a governance change, which the grant
explicitly does not cover — *"it does not make you the PO."*

So T3 was measured and mapped, and stops here.

## The finding: BL-144's prescription was backwards

BL-144 says, and the planner primer repeats:

> `AGENT.md` splits LAST, and it is 999 lines with 24 correction markers. Those markers exist because
> it asserts things about files it does not sit beside. **~150 lines of genuinely cross-cutting law
> stay in `governance/`; the rest goes to the module whose code it constrains.**

**Measured, the ratio is close to the inverse.** The file is **1,033 lines in 15 sections**. Counting
correction markers per section (`⬛`, `CORRECTION`, `RETRACTED`, `Corrected 20xx`):

| Section | Lines | Corrections | Verdict |
|---|---:|---:|---|
| OPERATOR seat charter | 226 | **5** | describes code → **move** |
| Milestone 06/05/03 Key Features | 73 | **4** | describes code → **move** |
| DEFAULT ROLE ASSIGNMENTS | 118 | **1** | mixed → **split** |
| FIRST ENTRY POINT (primer handshake) | 79 | 0 | law → stays |
| Session Primer | 100 | 0 | law → stays |
| Workflow Rules | 84 | 0 | law → stays |
| Reviewer Rules of Engagement | 74 | 0 | law → stays |
| Origin Tag Protocol | 74 | 0 | law → stays |
| Implementer Rules of Engagement | 64 | 0 | law → stays |
| Resource Expenditure Monitoring | 60 | 0 | law, but see below |
| Re-priming · baton · honesty · vocabulary · preamble | 81 | 0 | law → stays |

**All ten correction markers fall in three of the fifteen sections.** The other twelve — **556 lines
between them** — have never needed a correction at all.

That is not a coincidence, and it sharpens BL-144's own diagnosis rather than contradicting it. The
item was right that *"those markers exist because it asserts things about files it does not sit
beside"* — and the measurement says **only about 300 lines actually do that.** The remaining ~730
lines assert things about **how we work**, which sits beside nothing because it is not about code.
Law does not rot. **Claims about code rot.**

**So the split should be small, targeted at the three corrected sections, and the rest should stay
exactly where it is.** Moving stable law into module directories would scatter the one document every
agent must read, to fix a problem those sections do not have.

## The proposed split

**Move out — ~300 lines, the parts that describe code:**

1. **The OPERATOR seat charter** (226 lines) → the `containment` module's `docs/`, as an
   `operator-seat-charter` document. *(Named without a full path deliberately: the doc-citation gate
   resolves every `modules/**.md` reference, and the first draft of this line cited the destination
   as if it already existed — which it does not. The gate caught it. A proposal must not plant a
   citation that only becomes true if the proposal is accepted.)*
   It is a containment document: worktree prefixes, port 3600, `cap.wallClockMs`, the write
   allowlist, the invariant harness. Five of its corrections are about the mechanisms it names. It
   sits beside `scripts/infra-invariant.mjs` and `scripts/hmp-commission.mjs`, which are exactly what
   `containment` owns. **`AGENT.md` keeps a five-line stub**: the seat exists, holds no authority,
   and here is the charter.

2. **Milestone 06 / 05 / 03 Key Features** (73 lines) → **`design/archive/`**, not to a module.
   These are dated claims about what shipped, already carrying four corrections including one whose
   cited evidence pointed at files that never existed at the cited paths ([[BL-142]]). They are
   history, they read as current status, and Wave 0's rule already covers them. **What is still
   load-bearing in them is not the milestone text but three live behavioural facts** — that failure
   propagation is transport-asymmetric, that nothing detects a hung agent, and that the wall clock is
   the only anti-hang rail. **Those must be PROMOTED before the sections move**, into
   `modules/team-orchestration/docs/`, as their own claims with their own citations. This is the
   un-automatable step BL-144 names, and it is the reason this section cannot ride along in a
   mechanical commit.

3. **`Resource Expenditure Monitoring`'s mechanism** (the meter endpoints, `scripts/usage.mjs`, the
   telemetry block shape — roughly 35 of its 60 lines) → `modules/observability/docs/`. The
   *obligation* to watch your spend is law and stays; the *instrument* is code and moves.

**Stays in `AGENT.md` — ~730 lines.** Everything else. The primer handshake, both Rules of
Engagement, the workflow rules, the Session Primer and baton contracts, the Origin Tag Protocol,
Honesty over Results, re-priming, the vocabulary note. **None of it has ever needed a correction**,
which is the strongest available evidence that it is not the problem.

**`DEFAULT ROLE ASSIGNMENTS` is the one genuinely mixed section** and needs the PO's call. The
role→agent table is live governance and must stay. The **per-agent op-notes** underneath it (key-store
paths, lessons files, meter block names, and the long agy fitness history with its retraction) are
claims about tooling, and carry the section's one correction. Splitting them out is defensible;
keeping them is also defensible, because an agent reads the table and the op-note together.

## What I would ask the PO to decide

1. **Do the three moves happen at all**, given the measured ratio? A defensible answer is *no* — the
   corrected sections could simply be fixed in place, and the file left whole. This proposal does not
   assume the split is worth its cost.
2. **The milestone sections: archive, or keep as a dated appendix?** Archiving is cleaner and matches
   Wave 0. Either way the three live facts get promoted first.
3. **The op-notes: split from the role table, or stay?**

## What is NOT proposed

Splitting `AGENT.md` across many modules; moving any Rules of Engagement; moving the primer
handshake; touching the three-name symlink arrangement; or changing any rule's content. **This is a
relocation proposal only** — no sentence of law changes meaning, and every moved section keeps a stub
where it was, so no reader following a habit lands on nothing.
