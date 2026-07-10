---
role: implementer
key: 20260710-1152-9c9745
written: 2026-07-10 by Claude (architect + SM), after the M19 backlog gate sat by the PO + architect together
---

This is your session primer.

**Read this first: there is no plan yet, no task yet, and the next unit of work is a SPIKE — zero production
code.** You are primed early and deliberately, so the baton lands on a mind that already knows the terrain. Your
correct output today is a report and a **STOP**. Not code, not a branch, not a test run.

## 1. What AgentTalk is

A multi-agent orchestration substrate: an MCP server over which independently-launched coding agents
(claude · codex · gemini) attach, take turns, exchange messages, reach consensus on a plan, and hand work between
roles. The **self-hosting program** is the project's central bet: *AgentTalk should carry the very coordination
that builds AgentTalk, and the loop should get measurably cheaper.* Today that claim is **unproven** — §4.

## 2. Roles

Implementer (**you**) · planner · three reviewer seats (**plan** reviewer = gate 1; **implementation** reviewer =
gate 2, who verifies each delivery; **task-end** reviewer = gate 3, who runs an independent closure sweep and owns
**the merge**) · architect · Scrum Master · **Product Owner = Fausto, the human** — apex authority, owner of
scope/direction/epics/merges.

**No agent names here.** Bindings live in exactly one place: `AGENT.md` → **📌 DEFAULT ROLE ASSIGNMENTS**. Read it.
You **do** create the task branch; you do **not** create the mainline merge.

## 3. The law you work under — read it before you touch anything

`AGENT.md` → **⛔ IMPLEMENTER RULES OF ENGAGEMENT.** Non-negotiable, and the difference between a delivery and a
rejection. The four broken most often here:

- **"Done" is not "tests green."** Done = works as specified, strictly in scope, prior behaviour preserved, honestly
  reported. **A blocker reported clearly is a COMPLETED deliverable.** You are not penalised for an honest red; you
  *are* rejected for a scope-creep green.
- **Any non-trivial behaviour change is a SHOW-STOPPER — report it, don't make it.** Including *fixing a bug you
  find.* Finding it is your job; fixing it is not. Anything touching `team-coordinator.ts`, the registry, consensus,
  or the protocol: **STOP and report.** When in doubt it is a show-stopper.
- **Declare scope BEFORE you code** (Rule 6) — what you may touch, what you may **not**, what "done" looks like, the
  approach you'll try first. Skim `design/implementer-pitfalls.md` as part of that: it is the *case law* to the
  Rules' *law*, and it names the exact traps implementers fall into here.
- **Pre-register a retry budget PER TEST, and when you stop, actually STOP** (Rule 7). Declaring a stop and then
  continuing is itself a violation.

`design/collaboration-workflow.md` is the method. State lives in the unit's `*-implementation.md` **ledger**, never
in chat.

## 4. Where we are: **SP2 first — a spike. Then M19, which is deliberately tiny.**

**M18 closed 2026-07-09 with its central claim unproven.** It proved a real CLI *can* attach and carry a `baton` +
`workflowEvent` (C6 VERIFIED), then recorded **0 substrate events** across the whole epic (C3 **DEFERRED ⛔**,
PO-signed). Nothing is missing from the code. The gap is adoption: the terminal was easier.

**Next unit: SP2 — consensus over real attached CLI sessions.** Does the existing consensus protocol
(`fact_collection → discussion → proposal`) survive across two *real* attached CLIs? It has **only ever** run on
SDK / in-process substrates (LB-66 Finding 2). **A spike is read-only / probe / docs — ZERO production code**
(`collaboration-workflow.md:289`). The deliverable is an **answer**, and a *park* recommendation is a valid
successful outcome. If you are batoned into SP2, "I could not make it work, here is precisely where it broke" is a
**successful delivery**, not a failure. Do not reach for the engine to make the spike succeed.

**After that: M19 — "AgentTalk improving itself."** In the PO's words: **"find one file you agents agree to
refactor, and refactor it. Nothing more."** You are likely the one who refactors it. The target is **constrained to
the AgentTalk repo** (PO, 2026-07-10) because `scope-check` is blind to the client repo (BL-022). SP2's answer
decides how the agreement is reached — consensus protocol or plain batons. **The plan, once gate-1 approved, is your
spec — not this primer.**

**The PO's scope line is hard and aimed squarely at you:** *"Don't want to add any complexity unless it is strictly
necessary at this point."*

## 5. Verify this primer before you trust it

It is a claim about state, written at a past moment, and by definition it predates your plan. Ground every
load-bearing line: the M18 ledger's **EPIC CLOSURE** and C3 row, `git log`, the files it names. If a merged claim is
absent from git, or a file is missing, **say so prominently** rather than repeating me. An earlier version of this
primer named a task ("M19-T0") that the backlog gate then ruled did not exist. Primers are wrong sometimes.

## 6. Op notes — the traps that are live right now

- **A bug is already known and it is NOT yours to fix. The idle timeout is dead code.** `agentIdleTimeoutMs: 180000`
  is configured and swept every 30s, but `lastProgressAt` is **declared, read, and never written**, so
  `hasAgentTimedOut()` always returns false (`registry.ts:663`). Filed as **BL-028** / **LB-70**; the PO knows.
  **Fixing it is a Rule-2 violation** — shared engine code, and it must land together with the typed non-reply
  `reason`. If you feel the urge to fix it, that urge is the pitfall, not the insight. (Upside: a slow conversation
  between real CLIs **cannot** be killed by the sweep.)
- **A passing test in our own suite proves nothing.** `__tests__/team-worker-effect-fence.test.ts:70-71` asserts an
  *exemption* predicate for a timeout that can never fire — it passes identically either way. That is **IP-15**
  ("the proof that passes without your change"), shipped by us, three epics before we minted the case. Before citing
  any bar as evidence your change worked, ask: **"what would this print if I reverted my change?"** If you can't
  answer, it isn't evidence. Gate 2 and gate 3 will ask you exactly this.
- **Do not use `scripts/m17-live-gate-proof.mjs` as evidence** — it asserts against a *committed* NDJSON rather than
  the run's own recorder, so it can print `LIVE SMOKE PASSED` with **no recorder attached** (M17 G2-1, open; BL-025).
- **If you run SP2: record each attached agent's `provider` value.** `team-coordinator.ts:977-986` bumps the
  fact-collection timeout on `if (team.provider === 'gemini')` — a vendor name changes protocol timing inside the
  frozen engine, and `fact_collection` is what the spike measures. **Record it. Do not fix it** (BL-024).
- **Attaching a real CLI is a hand-assembled ritual** (**BL-026**): an `mcpServers` JSON with an absolute
  `bridge.mjs` path, a WS URL, an `agentId`, the contract hash — plus a `creating`-state trap for anyone who forgets
  `POST /api/agents/:id/start`. Write down what you do; the runbook is a spike deliverable.
- **The orchestrator has no write tools.** You edit with **your own harness tools**; those edits never cross
  AgentTalk's wire. **Nothing mechanically stops you from touching an out-of-scope file — today that guardrail is
  your character, not the system's.** The project knows this and has chosen, for now, to trust it rather than build a
  cage. `git diff --stat` before you claim done (Rule 5) is how you honour that trust.
- **`IP-9` is ambiguous in citations written before 2026-07-10** — two entries shared the id; one is now `IP-16`.
  Resolve by context.
- **Lessons:** skim `design/lessons/<your-agent>-lessons.md` at start (yours is named in `AGENT.md` → per-agent
  op-notes), and append 1–3 dated bullets at close. The read-back is the point; write-only rots.
- **Budget:** poll `node scripts/usage.mjs` at start — best-effort, **never blocking**; if it's down, say so in one
  line and carry on. 2026-07-10 ~11:50 CEST: antigravity 38% (5h), claude weekly 9%, codex weekly 1%.

## 7. What to do now

**Gather context, verify it against the repo, report your understanding, and STOP.** No code, no branch, no builds,
no test runs, no commits. Consuming this key in your private key store — outside the repo — is the only write
permitted in this window. Then wait: the SM greenlights, the PO may override, and your task arrives as a **baton**
once a plan clears gate 1.

When it does: the plan is your spec; this primer is only your map.
