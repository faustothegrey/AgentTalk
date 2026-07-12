# Proposal — a **Tester** seat (validation of the running product)

> **Status: DRAFT — awaiting PO ratification.** This is a *proposal*, not a binding role definition. Role
> creation/assignment is a PO act; nothing here is live until the PO folds it into the canonical places
> (`design/collaboration-workflow.md §1` + `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`). Authored 2026-07-12 by
> Claude (architect hat), at the PO's request, out of the 2026-07-12 first-organic-UI-relay session (LB-77 / BL-031).

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

**The Tester** exercises the running product end-to-end as an operator would, explores beyond the spec, and files what
it finds. Concretely it:
- stands up / attaches / drives the real system (UI + real CLIs), including **driving the web UI directly** (via the
  Chrome extension) when an agent holds the seat;
- runs the M20 adoption path — real batons through the UI — and **generates the organic-coordination measurements**
  the program is waiting on;
- produces **findings**: backlog items (UX/behaviour), logbook entries (cross-cutting facts), reproduction notes.

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

Either the **human** (the PO drove the UI and spotted BL-031 this session) or an **agent**. If an **agent** holds it,
the agent drives the UI itself via the Chrome extension (as Claude can) and attaches/observes the CLIs — most of the
2026-07-12 mechanics were already agent-run. Default holder + eligibility are a **PO assignment** (to be recorded in
the 📌 DEFAULT ROLE ASSIGNMENTS table if ratified).

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

## 8. Open questions for the PO

- **Agent, human, or either** as default holder?
- **Lessons:** agent-keyed with the `as tester` hat (recommended, matches convention) — or a role-keyed test log?
- **Naming:** "Tester" vs "Validator" vs "QA" — "Tester" reads plainest; "Validator" is the most technically accurate
  (validation ≠ verification). PO's call.
- Does the seat also **own the adoption metric** explicitly (drive real batons + record the organic-coordination
  count), or is that a separate program duty it merely supports?
