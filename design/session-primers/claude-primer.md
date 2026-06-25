---
audience: claude
key: 20260625-1815-8fefa354
written: 2026-06-25 by Claude (M10 Phase-2 planned + decisions settled; T1 ready to implement)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` — read the **full** output and check its `(updated …)` freshness stamp vs
`date` now; a stale % quoted as current is worse than none (don't `grep` the stamp out). Stamp wall-clock. Don't trust
this primer blindly — verify; surface anything off.

**1. What it is.** AgentTalk = an orchestrator coordinating multiple AI agents (in-process **API**-path providers +
externally-launched **MCP**-attached agents) collaborating over MCP through a multi-agent **consensus protocol**
(planners debate → submit a plan → a worker executes). Monorepo: `packages/{contracts,runtime-core,…}` +
`apps/{orchestrator,web}`. Semantic logic is server-side, in the "brain" (`team-coordinator.ts`).

**2. Roles.** You are **Claude = planner / reviewer / architect — and currently also implementer** (Gemini, the normal
implementer, is **out of weekly budget**). Per **LB-14**: you implement, run `tsc -b` + full suite, self-review the
diff, report actual output — but **merge/closure is HUMAN-GATED** (Fausto). **Re-read AGENT.md → Implementer Rules of
Engagement before any code.** Fausto = human (scope, decisions, relay).

**3. Workflow / source of truth.** `design/collaboration-workflow.md`. Artifacts: `*-plan.md` (spec+DoD),
`*-implementation.md` (the **ledger**), `design/backlog.md`, `design/logbook.md` (LB-N), `design/implementer-pitfalls.md`
(IP-N). `AGENT.md` is canonical (`CLAUDE.md`/`AGENTS.md` are symlinks).

**4. EXACTLY where we are.** `origin/master` = **`4516dff`** (clean, pushed).
- **M09 (vocabulary removal) — ✅ COMPLETE + EPIC CLOSED.** History was squashed to a single root commit; the old
  provider token is gone from `git log`. Done.
- **Harness-division spike (pre-M10) — ✅ COMPLETE + MERGED.** The sibling `agentalk-mcp-client` is now a **pure
  relay** (stub deleted); the wire-contract is **transport-only at v5** (byte-identical both repos). Live gate
  **PASSED on codex + claude**; **gemini deferred** (out of budget) → tracked in memory
  `run-gemini-live-gate-when-budget-returns` + the spike ledger.
- **M10 = robust consensus via a GRADED, STATEFUL PROTOCOL BRAIN** (numbering accepted). Thesis (settled in a long
  design spar with Fausto): robustness comes from a **closed, bounded brain loop** — *valid → ack+advance · invalid →
  correct+retry (bounded) · repeated → peer-safe **eject***. **Not** hard enforcement. Hard `tool_choice`/`strict`/`enum`
  is an **API-path optimization**, not a gate. Single `consensus_respond(action,payload)` tool is the clean end-state.
  Plan + diagram: `design/milestone10-protocol-compliance-plan.md` (+ embedded `design/diagrams/m10-affordance-protocol.png`).
  - **Phase-1 design spike — ✅ DONE (LB-20).** Findings: (DQ1) the affordance data **already exists** in
    `team-coordinator.ts` (phase truth `getPlanningPhase:862`; legal set computed+sent `:462`; validation `:441`; a
    bounded agreement retry `:788`); single-tool collapse point = `translation.ts:11-82`. (DQ2) **No peer-safe eject
    today** — the single sink `interruptPlanningForMissingEvents:1702` **dual-kills both planners** on any violation
    (the LB-7/8 bug); only non-killing path = `pauseTaskForOperator:1529` (worker-only). (DQ3) **both paths are
    prompt-and-parse today** — `api-client.ts` uses **no** tool-calling (`response_format:json_object` only);
    enforcement is greenfield.
  - **Phase-2 plan — ✅ WRITTEN + DECISIONS SETTLED** (`design/milestone10-phase2-plan.md`): **D1 fail-soft eject ·
    D2 retry N=2 · D3 v1 = T1+T2** (T3 single-tool + T4 API-enforcement **deferred**).
- **⏭️ NEXT ACTION: implement T1 — peer-safe `ejectPlanner`** (additive new method in `team-coordinator.ts`, mirrors
  how `pauseTaskForOperator` is separate from `handleAgentFailure`; removes only the offender, keeps the peer alive,
  ends the round fail-soft). Ends with a regression test: **eject A → B survives, round resolves cleanly.** **T1 is
  the safe one to start.** **T2** (generalise the graded loop) **rewrites *tested* dual-kill contracts**
  (`agent-failure-impact.test.ts` + the consensus tests) → you MUST bring the before→after for **explicit approval
  before touching those tests** (CLAUDE.md: tests are behaviour contracts). All implementation is **human-gated** —
  do not start T1 until Fausto says go.

**5. Where state lives.** Resume from the M10 plans + LB-20/LB-21 + the Phase-2 plan, **not chat**. Gate baseline before
M10 code = **183/183, tsc 0** (M10 has been docs-only so far — verify it still holds before/after any T1 code).

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** worker/consensus tests must mock
  `execSync`/`existsSync` or they pollute (`/tmp/agentalk-*`, stray `task-*` branches) — check after runs.
- **Budget:** `node scripts/usage.mjs` — **check the `(updated …)` freshness stamp** (new rule, memory
  `token-budget-checkpoints`; don't grep it out). At handoff: claude **weekly ~47% / session ~30%** (session resets
  ~9pm; weekly Jul 1). **Gemini still out of weekly budget** → you remain implementer (LB-14).
- **🖍️ DiagramTalk:** the **"M10 · Graded Protocol Brain"** diagram is live (id `d0fedd0a`; snapshot in
  `design/diagrams/`). New version added a **recording + state-tags facility** (LB-21 + memory `diagramtalk-channel`):
  Fausto wants to **watch the consensus protocol flow LIVE** — an orchestrator→DiagramTalk bridge that fires
  `tag`/`highlight` as `team-coordinator` advances phases. Sketchy, to-be-designed; pairs with M10 Phase-2.
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. M10 planning/docs went **direct-to-master** (Fausto's
  approved housekeeping exception); real T1+ feature code should branch off `master`. **Don't push without his go.**
- **M10 engine map (for T1/T2):** `team-coordinator.ts` — `interruptPlanningForMissingEvents:1702` (the dual-kill to
  AVOID extending), `handleAgentFailure:1471`, `pauseTaskForOperator:1529` (the separate-non-killing-path template),
  `getPlanningPhase:862`, validation `:441`. `translation.ts` (`translateStructuredResponse:11-82`, `parseWithRetry:88`).
  `api-client.ts` (OpenAI-compatible; no tool-calling yet). `response-schema.ts` (`STRUCTURED_MESSAGE_TYPES`).
