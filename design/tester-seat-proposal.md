# Proposal — a **Tester** seat (validation of the running product)

> **Status: LIVE — PO-ratified and promoted to canonical files 2026-07-12.** All four design questions (§8) decided
> by the PO; default holder **Codex**; charter folded into `design/collaboration-workflow.md §1`, the seat row added
> to `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (+ history line), `tester-primer.md` created and added to the FIRST
> ENTRY POINT role→primer map. **First assignment (PO):** Codex instruments a human-driven BL-031 validation / M20
> adoption run. This doc is now the seat's **charter/rationale of record**; the binding definition lives in the
> canonical files. Authored 2026-07-12 by Claude (architect hat), out of the first-organic-UI-relay session (LB-77 /
> BL-031).

## 1. Why — validation, not verification (the gap the gates can't see)

The three reviewer seats all do **verification**: "was this built to its DoD?", anchored to a specific delivery,
gating a merge. The 2026-07-12 session did something different in kind: **exercised the *running* product in real
operation, un-anchored to any task's DoD**, and surfaced what the gates structurally cannot — M20 passed every gate
with green DoD rows and *still* had (a) an un-caught UX confusion in the approval panel (→ BL-031) and (b) **zero**
real-world exercise until a human actually drove it. That gap is **validation** ("does it work, and is it good, in
real use?") versus **verification** ("built to spec?"). It deserves an owner.

This is not hypothetical process for a hypothetical actor (the usual proportionality trap): the seat has a **standing
mandate**. The program's entire next phase is *adoption* — driving real coordination through the UI, retiring terminal
batons one hand-off at a time, and moving the **organic-coordination metric off 0** (LB-75/LB-77). That work needs a
home, and its first outputs already exist (LB-77, BL-031 came from exactly this activity).

## 2. The seat — charter

**The Tester** is an **agent** that acts as the **testing helper / instrumentation** for a human **test driver**. It
does **not** operate the UI itself — the human clicks and experiences the product; the Tester instruments,
choreographs, and verifies. Concretely it (exactly the 2026-07-12 session's division of labour):
- **reads the logs, checks backend / process status, and dictates step-by-step instructions** to the human driver;
- **confirms each step's actual outcome against ground truth** (logs, process state) — verify-don't-assert, not "it
  should have worked";
- runs the M20 adoption path *with the human driving* — and **owns the organic-coordination measurement** the program
  is waiting on;
- produces **findings**: backlog items (UX/behaviour), logbook entries (cross-cutting facts), reproduction notes.

The **human is the test driver** — hands on the product, observing as a user, bringing the UX "this feels off"
judgment the BL-031 catch came from. The Tester never substitutes for that human judgment; it **amplifies** it.

**What it is NOT (scope fence — the critical one):** the Tester is **not a fourth merge gate.** It produces
**findings, not verdicts**; it never blocks or authorises a merge (that stays with the Task-end Reviewer + PO). It
does not verify a delivery against its DoD — that's gate 2/3. Keeping this fence is what stops the seat from becoming
a second review bureaucracy.

### Distinction from the closest existing seat (Task-end Reviewer)

|                | Task-end Reviewer (gate 3)     | **Tester (proposed)**                          |
|----------------|--------------------------------|------------------------------------------------|
| Anchored to    | a task's DoD                   | the running product, exploratory               |
| Timing         | at closure; gates the merge    | any time, esp. **post-merge / adoption**       |
| Output         | a **merge verdict**            | **findings** → backlog / logbook / lessons     |
| Core question  | "built to spec?"               | "does it work, and is it good, in real use?"   |

## 3. Independence default

Mirror the reviewer independence defaults: **Tester ≠ that task's Implementer** (fresh eyes on the running product).
One actor MAY hold Tester alongside another seat under the usual declared-dual-role rules, provided that default holds.

## 4. Where it slots

Orthogonal to the 3-gate build sequence (plan-reviewer → implementer → implementation-reviewer → task-end-reviewer).
The Tester operates **on the merged/running product**, typically *after* a build closes or *during adoption* — it is a
standing validation function, not a step in the build pipeline.

## 5. Who holds it

**Agent-held** — default **Codex** (PO-assigned 2026-07-12, chosen to avoid overloading Claude, which already holds
plan-reviewer + task-end + architect + SM). Eligible: any agent. The **human is the test driver**, *not* the
seat-holder — the human operates the product hands-on; the agent Tester instruments and guides. Independence:
**Tester ≠ that task's Implementer.**

## 6. Artifacts — "its own context and lessons" (with one convention note)

The PO asked for the seat to have its own lessons + context. Mapping onto existing conventions:
- **Context → a role-keyed primer.** Add `design/session-primers/tester-primer.md` (primers *are* role-keyed) so a
  cold-start Tester boots with zero prior context, same handshake as every other seat.
- **Lessons → stay AGENT-keyed, tagged with the `as tester` hat.** The project convention is one lessons file **per
  agent**, tagged with the hat worn (`AGENT.md` → "Lessons stay keyed by AGENT, not by role"). So a tester-hat lesson
  goes into the *holding agent's* file (e.g. `claude-lessons.md`) tagged "*today as tester I learned…*" — **not** a new
  role-keyed `tester-lessons.md` (that would break the convention). This still fully delivers the intent: the seat's
  *self-reflection on how to test* accrues and compounds; its *product findings* go to logbook/backlog as usual.
  *(If the PO prefers a genuinely role-keyed test log instead, that's a separate decision — flag it.)*

## 7. If ratified — the exact edits (listed, NOT applied here)

Left for the PO to make/authorise, so this proposal changes nothing binding:
1. `design/collaboration-workflow.md §1` — add the **Tester** participant (charter from §2 above, the scope fence, the
   independence default).
2. `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — add a **Tester** row (default holder + eligible + constraint
   "≠ that task's Implementer"), dated; add its op-note if an agent holds it.
3. `AGENT.md` FIRST ENTRY POINT role→primer map — add `tester-primer.md` to the list of role-primers.
4. Create `design/session-primers/tester-primer.md` (`role: tester`, `key: none` until a real hand-off is due).

## 8. Decisions (PO-ratified 2026-07-12)

| # | Question | **Decision** |
|---|----------|--------------|
| 1 | Holder & model | **Agent-held helper; the human is the test driver** (clarified by PO 2026-07-12). The *role* is an agent seat that instruments/guides (logs, backend status, step-by-step, verification) — it does **not** operate the UI. The human clicks and brings UX judgment. **Default holder = Codex** (anti-concentration; Claude already holds four seats). Eligible: any agent. |
| 2 | Lessons keying | **Agent-keyed, tagged `as tester`** — follows the existing convention (one lessons file per agent, tag the hat). No role-keyed `tester-lessons.md`. Product findings still go to logbook/backlog. |
| 3 | Name | **Tester** — plainest; the validation-vs-verification distinction lives in the charter, not the name. |
| 4 | Adoption metric | **Owns it explicitly** — the seat that drives real batons through the UI owns the organic-coordination count; gives the program's central metric a clear home. |

**Default holder set:** **Codex** (PO, 2026-07-12). **Remaining (optional):** a **first assignment** (e.g. Codex
instruments a human-driven BL-031 validation / M20 adoption run) — can be given at promotion time or later.
