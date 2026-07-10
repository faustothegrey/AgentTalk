---
role: planner
key: 20260710-0854-bb3811
written: 2026-07-10 by Claude (architect + SM, after M19 inception with the PO)
---

This is your session primer.

## 1. What AgentTalk is

A multi-agent orchestration substrate: an MCP server over which independently-launched coding agents
(claude · codex · gemini) attach, take turns, exchange messages, reach consensus on a plan, and hand work
between roles. The **self-hosting program** is the project's central bet: *AgentTalk should carry the very
coordination that builds AgentTalk, and the loop should get measurably cheaper.* That claim is **not yet
earned** — read §4 before you believe anything else.

## 2. Roles

Planner (**you**) · three reviewer seats (**plan** reviewer = gate 1, approves your plan; **implementation**
reviewer = gate 2, the per-delivery verify/refute loop; **task-end** reviewer = gate 3, independent closure
sweep + the merge) · implementer · architect · Scrum Master · **Product Owner = Fausto, the human**, apex
authority, owner of scope/direction/epics/merges. Independence defaults: no self-review; task-end reviewer ≠
implementation reviewer (fresh eyes at close).

**Do not look for agent names here.** Current bindings live in exactly one place: `AGENT.md` → **📌 DEFAULT
ROLE ASSIGNMENTS**. Read it. (As of 2026-07-10 the PO confirmed the defaults stand.)

Your seat is **planner**. You author the plan; you do **not** implement it and you do **not** approve it.
Check the table for any second hat you hold, and declare every one you hold.

## 3. Workflow and sources of truth

`design/collaboration-workflow.md` is the method. The artifacts:
- `design/milestone19-*-plan.md` — **you write this**: spec + DoD rows.
- `design/milestone19-*-implementation.md` — the **ledger**; state lives here, never in chat.
- `design/backlog.md` — the ordered task list (28 items; validator `npm run backlog:check`).
- `design/logbook.md` — cross-cutting technical facts (`LB-N`).
- `design/implementer-pitfalls.md` — reviewer-authored case law (`IP-1 … IP-16`).
- `design/self-hosting-program-draft.md` — the program this epic serves.
- `AGENT.md` — the law: ⛔ Implementer and ⛔ Reviewer Rules of Engagement, primer handshake, origin tags.

## 4. Where we are: M19 is open. Inception is done. **Your job is to plan it.**

**M18 closed 2026-07-09 with its central claim unproven.** C3 was **DEFERRED ⛔ (not met)**, with PO sign-off:
19 relays, **0 substrate events** across the whole epic. M18 proved the *capability* (C6 VERIFIED: a real CLI
attaches and carries `baton` + `workflowEvent`; merges `e1a4346` / client `9af84c7`; independent A/B at gate 3)
and produced **zero uses of it**. Nothing is missing from the code. The gap is adoption: the terminal was easier.

**C3's reopen condition — written into the M18 ledger, PO-signed, and now due:**

> *the next epic must carry **at least one real role→role gate or baton over the substrate** (a recorded
> `workflow_gate_event` from an attached real CLI session doing actual coordination, **not a proof**), and report
> the **ratio** — substrate-carried hand-offs ÷ total hand-offs — beside the raw relay count (BL-027).*

**M19's goal, set by the PO with the architect (2026-07-10):** *AgentTalk improving itself.* Concretely, in the
PO's words: **"find one file you agents agree to refactor, and refactor it. Nothing more."**

The shape the architect proposed and the PO approved:

- **T0 — spike, timeboxed.** Two real CLIs attach; run the **existing** consensus protocol
  (`fact_collection → discussion → proposal`) on a trivial question. Does it survive a real substrate? **No code
  changes; the answer is the deliverable.** If it holds, T1 uses it. If it does not, T1 reaches agreement over
  plain batons and "consensus on real attached CLIs" becomes a backlog item, not an M19 problem.
- **T1 — the real thing.** Two agents agree on **one file**; one refactors it. The **coordination** crosses
  AgentTalk; the **edit does not** (the orchestrator has no write tools — see §6). Record the
  `workflow_gate_event` and the ratio. That discharges C3.

**Nothing else.** This is a hard scope line from the PO, quoted: *"All the rest should be deferred after M19… Don't
want to add any complexity unless it is strictly necessary at this point."* If something is **essential to the M19
goal**, bring it in — a spike is explicitly allowed to bring things in. Otherwise defer it. Explicitly **parked,
not dropped, and out of M19**: typed non-reply `reason` · thread-correlated `send_to_agent` · queue-and-replay on
attach · truncation-recovery read path · structural-fingerprint contract negotiation · role→capability enforcement ·
the four evidence-determinism mechanisms (awarded greens, machine-generated telemetry, mandatory A/B, scope diff).

## 5. Verify this primer before you trust it

It is a claim about state, written at a past moment. Ground every load-bearing line: read the M18 ledger's
**EPIC CLOSURE** and its C3 row (`design/milestone18-self-hosting-implementation.md`), the program draft, and
`git log`. If a "done/merged" claim isn't reflected in git, or the C3 wording differs from §4, **say so
prominently** rather than repeating me. A primer that disagrees with ground truth is itself a finding.

## 6. Op notes — what will actually bite you

- **The idle timeout is dead code, and that is *why* T1 is possible.** `agentIdleTimeoutMs: 180000` is configured
  and swept every 30s, but `lastProgressAt` is **declared, read, and never written**, so `hasAgentTimedOut()`
  always returns false (`registry.ts:663`). A slow real-CLI conversation therefore **cannot** be killed by the
  sweep. See **LB-70** / **BL-028**. Do **not** fix it in M19 — it is filed, and landing it requires the typed
  non-reply `reason` alongside it (an agent paused on a human would otherwise read as dead).
- **The consensus protocol has never run across real attached CLI sessions** — only SDK / in-process substrates
  (LB-66 Finding 2). Our most defensible capability is our least proven one. That is exactly what T0 tests.
- **Attaching a real CLI is a hand-assembled ritual** — **BL-026**, with a fix sketch (a committed `.mcp.json`
  template + an `attach-real-session` runbook). Judge whether T0 needs it: it is the one deferred item with a
  plausible claim to being *strictly necessary*. Make that argument explicitly if you make it.
- **The orchestrator has no write path.** `grep` the engine for `write_file|edit_file|writeFile` → nothing. Under
  attach mode the implementer edits with its **own harness tools**; those edits never cross AgentTalk's wire. Fine
  for M19 — the substrate carries coordination, not edits. Do not plan around enforcing scope on writes.
- **Standing invariant: the PO's channel must never be mediated by AgentTalk** (LB-68 Finding 3). Self-hosting
  consumes **agent→agent** batons. The manual terminal baton looks like an interim workaround; it is the
  **reference clock**. A defect in the enforcer must not corrupt the machinery that would surface it (LB-66 was the
  live preview: a handshake check rejected exactly the agents that would have exercised it).
- **`workflowEvent` is optional on `send_to_agent`** (required = `['to','payload']`). An agent cannot *lie* about
  its role — the registry refuses a mismatched `fromRole` and emits `workflow_gate_attempt {result:'refused'}` —
  but it can simply not say. The gate **notarizes claims; it does not govern acts** (LB-68). Plan the DoD
  accordingly: *"a `workflow_gate_event` was recorded"* is checkable; *"all coordination went over the substrate"*
  is not, unless you also count the terminal side — which is the BL-027 ratio.
- **`IP-9` is ambiguous in any citation written before 2026-07-10** — two entries carried that id; one is now
  `IP-16`. Resolve by context; do not chase the stale references (PO ruling, 2026-07-10).
- **Budget:** poll `node scripts/usage.mjs` at start (best-effort, never blocking; the `claude` block is often
  `ok:false` — LB-11). At 2026-07-10 ~08:00 CEST: claude weekly 9%, codex weekly 1%, antigravity 38% (5h window).

## 7. What to do now

Per the cold-start contract: **gather context, verify it against the repo, report your understanding, and STOP.**
Do not write the plan, create a branch, or run anything until the SM greenlights you (the PO may override at any
time). Consuming this key in your private key store — outside the repo — is the only write permitted in the
no-action window.

Then, once greenlit: author `design/milestone19-*-plan.md` with spec + DoD rows and hand it to the **plan
reviewer** (gate 1). The DoD must make C3's reopen condition *checkable*. And hold the PO's line — **nothing more.**
