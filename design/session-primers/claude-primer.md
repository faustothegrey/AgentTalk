---
audience: claude
key: 20260625-2118-322ae643
written: 2026-06-25 by Claude (M10 Phase-2 v1 = T1+T2 MERGED to master; T3/T4 are the next candidates)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` — read the **full** output, check its `(updated …)` stamp vs `date` now (a
stale % quoted as current is worse than none; don't `grep` the stamp out), stamp wall-clock. Don't trust this primer
blindly — verify; surface anything off.

**1. What it is.** AgentTalk = an orchestrator coordinating multiple AI agents (in-process **API**-path providers +
externally-launched **MCP**-attached agents) collaborating over MCP through a multi-agent **consensus protocol**
(planners debate → submit a plan → a worker executes). Monorepo: `packages/{contracts,runtime-core,…}` +
`apps/{orchestrator,web}`. Semantic logic is server-side, in the "brain" (`packages/runtime-core/src/registry/team-coordinator.ts`).

**2. Roles.** You are **Claude = planner / reviewer / architect — and currently also implementer** (Gemini, the normal
implementer, is **out of weekly budget**). Per **LB-14**: you implement, run `tsc -b` + full suite, self-review the
diff, report actual output — but **merge/closure is HUMAN-GATED** (Fausto). **Re-read AGENT.md → Implementer Rules of
Engagement before any code.** Fausto = human (scope, decisions, relay).

**3. Workflow / source of truth.** `design/collaboration-workflow.md`. Artifacts: `*-plan.md` (spec+DoD),
`*-implementation.md` (the **ledger**), `design/backlog.md`, `design/logbook.md` (LB-N), `design/implementer-pitfalls.md`
(IP-N). `AGENT.md` is canonical (`CLAUDE.md`/`AGENTS.md` are symlinks).

**4. EXACTLY where we are.** `origin/master` = **`3708c66`** (clean, pushed; all M10 branches merged + deleted).
- **M10 = robust consensus via a GRADED, STATEFUL PROTOCOL BRAIN.** Thesis (settled with Fausto): robustness from a
  **closed, bounded brain loop** — *valid → ack+advance · invalid → correct+retry (bounded) · repeated → peer-safe
  **eject***. **Not** hard enforcement. Plans: `design/milestone10-protocol-compliance-plan.md` (thesis + diagram) +
  `design/milestone10-phase2-plan.md` (T1–T4, decisions). Ledger: `design/milestone10-implementation.md`.
  - **Phase-1 design spike — ✅ DONE (LB-20).**
  - **Phase-2 v1 = T1 + T2 — ✅ DONE + MERGED to master (2026-06-25).** Decisions: **D1** eject = fail-soft · **D2**
    retry N=2 · **D3** v1 = T1+T2 (T3/T4 deferred) · **D-T2a** minimal scope · **D-T2b** unify retry.
    - **T1 (`76e5b34`):** peer-safe `ejectPlanner(agentId, reason)` — additive non-killing path (mirrors
      `pauseTaskForOperator`): removes only the offender, keeps the peer alive, freezes the task in
      `awaiting_operator`. Test: eject A → `removeAgent('p1')` fires, `removeAgent('p2')` does NOT.
    - **T2 (`5fea20c`):** generalised `validateProtocolStep` — ANY illegal move (regression via
      `askRegressionConfirmation`; forward/lateral via new `askProtocolCorrection`) → bounded correct (N=2,
      `MAX_REGRESSION_RETRIES`) → `ejectPlanner`, **not** the M03 dual-kill. Removed dead
      `interruptPlanningForRegression`. Rewrote 3 tested contracts (C1 `submit_plan`-before-agreement, C2 confirmed
      regression, C3 repeated `agreement_acceptance`) + added a recovery test. The LB-7/8 dual-kill-on-any-violation
      bug is closed **for the illegal-move path**.
- **⏭️ NEXT CANDIDATES (deferred per D3, no date attached — Fausto picks if/when):**
  - **T3 — single tool `consensus_respond(action, payload)`:** collapse `translateStructuredResponse`
    (`agents/translation.ts:11-82`) + `STRUCTURED_MESSAGE_TYPES` into one tool. **Wire-contract change** → bump
    **v5→v6**, recompute hash, **lockstep with the client** (`agentalk-mcp-client`) + the handshake gate (reuse the
    harness-division spike's byte-identical + verify-contract + live procedure). Higher risk than T1/T2.
  - **T4 — API-path enforcement (optional):** add `tools`+`tool_choice`+strict `enum` to `agents/api-client.ts` so the
    API path's first answer is always legal (skip the retry). Pure optimization; the graded loop stays the floor.
    Per-provider verify (OpenAI yes; deepseek/gemini unverified). May split to its own milestone.
- **Still open from before M10:** the **gemini live gate** (`node scripts/test-mcp-gate.mjs gemini`) — deferred while
  gemini is out of weekly budget (memory `run-gemini-live-gate-when-budget-returns`); provider-parity for the v5
  contract (codex+claude passed).

**5. Where state lives.** Resume from `design/milestone10-implementation.md` (the ledger — both T1+T2 telemetry blocks
are there) + the M10 plans + LB-20/LB-21, **not chat**. Gate baseline on master = **185/185, tsc 0**. Verify it still
holds before/after any new code.

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** `planning_runs/` is gitignored and the
  failure/consensus tests write into it — that's pre-existing, NOT pollution; check `git status` (in-scope files only)
  + no `/tmp/agentalk-*` + no stray `task-*` branches after runs.
- **Engine map (M10):** `team-coordinator.ts` — `ejectPlanner` (T1, the peer-safe path), `validateProtocolStep`
  (T2 graded loop), `askRegressionConfirmation` + `askProtocolCorrection` (the two correction prompts),
  `interruptPlanningForMissingEvents` (the M03 dual-kill — still used for genuine **agent-failure + watchdog/timeout**
  paths; do NOT extend it for illegal moves), `pauseTaskForOperator` (M08-T3 fence template), `getPlanningPhase`.
  Untouched by M10: agreement-fallback (`:806`), phase-guard throws (`:514/:590`), the wire contract.
- **Budget:** `node scripts/usage.mjs` — **check the `(updated …)` stamp** (memory `token-budget-checkpoints`). At
  handoff: claude **weekly ~51%** (resets Jul 1 ~9am Rome; session resets ~9pm). **Gemini still out of weekly budget**
  → you remain implementer (LB-14).
- **🖍️ DiagramTalk:** the **"M10 · Graded Protocol Brain"** diagram is live (snapshot in `design/diagrams/`). LB-21 +
  memory `diagramtalk-channel`: Fausto wants to **watch the consensus protocol flow LIVE** — an
  orchestrator→DiagramTalk bridge firing `tag`/`highlight` as `team-coordinator` advances phases. Sketchy,
  to-be-designed; a natural pairing now that the graded loop exists.
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. M10 feature code branched off `master` and merged
  ff (T1 then T2), branches deleted. **Don't push without his go.** Docs/housekeeping have gone direct-to-master by
  his approved exception.
