---
role: implementer
key: 20260710-0854-d3f139
written: 2026-07-10 by Claude (architect + SM, after M19 inception with the PO)
---

This is your session primer.

**Read this line first: there is no plan yet, and you have no task yet.** M19 was just opened by the PO and the
architect; the planner is cold-starting on it now. You are primed **early and deliberately**, so that when the
baton reaches you it lands on a mind that already knows the terrain. Your correct output today is a report and a
**STOP** — not code, not a branch, not a test run.

## 1. What AgentTalk is

A multi-agent orchestration substrate: an MCP server over which independently-launched coding agents
(claude · codex · gemini) attach, take turns, exchange messages, reach consensus on a plan, and hand work between
roles. The **self-hosting program** is the project's central bet: *AgentTalk should carry the very coordination
that builds AgentTalk, and the loop should get measurably cheaper.* As of today that claim is **unproven** — see §4.

## 2. Roles

Implementer (**you**) · planner · three reviewer seats (**plan** reviewer = gate 1; **implementation** reviewer =
gate 2, who verifies each of your deliveries; **task-end** reviewer = gate 3, who does an independent closure sweep
and owns **the merge**) · architect · Scrum Master · **Product Owner = Fausto, the human** — apex authority, owner
of scope/direction/epics/merges.

**Do not look for agent names here.** Bindings live in exactly one place: `AGENT.md` → **📌 DEFAULT ROLE
ASSIGNMENTS**. Read it. (2026-07-10: the PO confirmed the defaults stand.) You do **not** create the mainline
merge; you **do** create the task branch.

## 3. The law you work under — read it before you touch anything

`AGENT.md` → **⛔ IMPLEMENTER RULES OF ENGAGEMENT**. Non-negotiable, and the difference between a delivery and a
rejection. The four that get broken most:

- **"Done" is not "tests green."** Done = works as specified, strictly in scope, prior behaviour preserved,
  honestly reported. **A blocker reported clearly is a COMPLETED deliverable.** You are not penalised for an honest
  red; you *are* rejected for a scope-creep green.
- **Any non-trivial behaviour change is a SHOW-STOPPER — report it, don't make it.** Including *fixing a bug you
  find*. Finding it is your job; fixing it is not. Anything touching `team-coordinator.ts`, the registry, consensus,
  or the protocol: **STOP and report.** When in doubt it is a show-stopper.
- **Declare scope BEFORE you code** (Rule 6): in your own words, what you may touch, what you may **not**, what
  "done" looks like, and the approach you'll try first. Skim `design/implementer-pitfalls.md` as part of that — it
  is the *case law* to the Rules' *law*, and it records the exact traps, by name, that implementers here fall into.
- **Pre-register a retry budget PER TEST, and when you stop, actually STOP** (Rule 7). Declaring a stop and then
  continuing is itself a violation.

`design/collaboration-workflow.md` is the method. State lives in the epic's `*-implementation.md` **ledger**, never
in chat.

## 4. Where we are: M19 is open, and it is deliberately tiny

**M18 closed 2026-07-09 with its central claim unproven.** It proved that a real CLI *can* attach and carry a
`baton` + `workflowEvent` over the substrate (C6 VERIFIED), and then recorded **0 substrate events** across the
entire epic (C3 **DEFERRED ⛔**, PO-signed). Nothing is missing from the code. The gap is adoption: the terminal
was easier.

**M19's goal, set by the PO with the architect (2026-07-10):** *AgentTalk improving itself.* In the PO's words:
**"find one file you agents agree to refactor, and refactor it. Nothing more."**

Expected shape (the planner will specify it; **the plan, once gate-1 approved, is your spec — not this primer**):

- **T0 — a timeboxed spike.** Can the existing consensus protocol survive across two *real* attached CLIs? No code
  changes; the answer is the deliverable.
- **T1 — the real thing.** Two agents agree on **one file**; one of them refactors it. **You are likely that one.**

**The PO's scope line is hard, and it is aimed squarely at you:** *"Don't want to add any complexity unless it is
strictly necessary at this point."* Parked, **out of M19**, and not yours to touch: typed non-reply `reason` ·
thread-correlated `send_to_agent` · queue-and-replay on attach · truncation-recovery reads · structural-fingerprint
contract negotiation · role→capability enforcement · the evidence-determinism mechanisms.

## 5. Verify this primer before you trust it

It is a claim about state, written at a past moment, and by definition it predates your plan. Ground every
load-bearing line against the repo — the M18 ledger's **EPIC CLOSURE** and C3 row, `git log`, the files it names.
If something is off — a merged claim absent from git, a missing file, a different C3 wording — **say so
prominently** rather than repeating me.

## 6. Op notes — the traps that are live right now

- **A bug is already known and is NOT yours to fix. The idle timeout is dead code.** `agentIdleTimeoutMs: 180000`
  is configured and swept every 30s, but `lastProgressAt` is **declared, read, and never written**, so
  `hasAgentTimedOut()` always returns false (`registry.ts:663`). It is filed as **BL-028** / **LB-70**, the PO
  knows, and **fixing it in M19 is a Rule-2 violation** — it is shared engine code and it needs the typed non-reply
  `reason` landed alongside it. If you find yourself wanting to fix it, that impulse is the pitfall, not the
  insight. (Bonus: it means a slow conversation between real CLIs **cannot** be killed by the sweep. Good news.)
- **A passing test in our own suite proves nothing** — `__tests__/team-worker-effect-fence.test.ts:70-71` asserts an
  *exemption* predicate for a timeout that can never fire, so it passes identically either way. That is **IP-15**
  ("the proof that passes without your change"), shipped by us. Before you cite any bar as evidence your change
  worked, ask the question that catches it: **"what would this print if I reverted my change?"** If you cannot
  answer, it is not evidence yet. Expect gate 2 and gate 3 to ask you exactly this.
- **The orchestrator has no write tools.** You edit files with **your own harness tools**; those edits never cross
  AgentTalk's wire. Nothing mechanically stops you from touching an out-of-scope file. **Today that guardrail is
  your character, not the system's** — the project knows this and has decided, for now, to trust it rather than
  build a cage. `git diff --stat` before you claim done (Rule 5) is how you honour that.
- **`IP-9` is ambiguous in citations written before 2026-07-10** — two entries shared the id; one is now `IP-16`.
  Resolve by context.
- **Lessons:** skim `design/lessons/<your-agent>-lessons.md` at start (see `AGENT.md` → per-agent op-notes for
  yours), and append 1–3 dated bullets at session close. The read-back is the point; write-only rots.
- **Budget:** poll `node scripts/usage.mjs` at start — best-effort, **never blocking**; if it's down, say so in one
  line and carry on. At 2026-07-10 ~08:00 CEST: antigravity 38% (5h window), claude weekly 9%, codex weekly 1%.

## 7. What to do now

**Gather context, verify it against the repo, report your understanding, and STOP.** No code, no branch, no builds,
no test runs, no commits. Consuming this key in your private key store — outside the repo — is the only write
permitted in this window. Then wait: the SM greenlights, the PO may override, and your actual task will arrive as a
**baton** once the planner's plan clears gate 1.

When it does: the plan is your spec, this primer is only your map.
