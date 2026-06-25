# Milestone 10 — Phase 2 (implementation) — Plan

> Builds directly on **Phase-1 / LB-20** (injection map + the confirmed dual-kill). Implements the graded,
> stateful protocol brain. Implementer = Claude under LB-14 (Gemini out of budget); **every task is a
> deliberate behaviour change to the engine and is HUMAN-GATED** — merge/closure is Fausto's call, per task.

## 1. Goal

Replace the current *"any illegal move → dual-kill both planners"* behaviour with a **graded, bounded,
closed loop**: validate → correct + retry (bounded) → **peer-safe eject**. The robustness core is **T1 +
T2**, on the *existing* multi-tool surface. The single-tool collapse (T3) and API-path enforcement (T4)
are deliberate follow-ons, not preconditions for robustness.

## 2. ⚠️ This is an approved behaviour change — and it rewrites tested contracts

M10's entire point is to change failure-propagation behaviour, so the M06 "behaviour change needs
confirmation" rule is satisfied *for the milestone* — but **per the Rules of Engagement each task still
needs explicit per-task sign-off, and several existing tests encode the CURRENT dual-kill as a contract**
(`agent-failure-impact.test.ts`, `team-api-consensus.test.ts`, `team-mcp-consensus.test.ts`,
`team-coordinator.test.ts`). Updating those tests = changing behaviour contracts → **requires Fausto's
explicit approval, not the implementer's discretion** (CLAUDE.md: "treat tests as behaviour contracts
unless you explicitly approve changing those contracts"). Each task below names the contracts it touches.

## 3. Decisions — ✅ SETTLED (Fausto, 2026-06-25)

- **D1 — eject behaviour: ✅ FAIL-SOFT.** On eject (<2 planners) end the round cleanly and surface to the
  operator; do **not** build a "continue solo" mode in v1. Degrade-to-solo stays a future option. (Rationale:
  solo-submit defeats multi-planner consensus; lower-risk; mirrors M08-T3 "stop is bounded, clean-up is
  unbounded.")
- **D2 — retry budget: ✅ N = 2**, a named constant (mirror `MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS`);
  tunable later.
- **D3 — scope: ✅ T1 + T2 only for v1.** Defer T3 (single-tool) and T4 (API enforcement) as separate
  follow-ons — the graded loop delivers robustness on the current multi-tool surface.

## 4. Task breakdown (sequenced safest-/foundation-first)

- **T1 — Peer-safe `ejectPlanner(agentId, reason)` (the 🔴 foundation).**
  - *Scope:* a NEW method in `team-coordinator.ts`, **separate** from `interruptPlanningForMissingEvents`
    (mirroring how `pauseTaskForOperator` is separate from `handleAgentFailure`). Removes/quiesces **only**
    the offender; keeps the surviving planner alive; ends the round per **D1 (fail-soft)** — task →
    a clean terminal state, peer notified, not shut down.
  - *Must NOT:* touch `interruptPlanningForMissingEvents`' existing callers/behaviour yet (T2 rewires them).
  - *DoD:* a regression test proving **eject A → B stays alive and the round resolves cleanly** (the
    inverse of today's dual-kill). Contracts touched: none yet (additive path).
- **T2 — Generalise the graded loop.**
  - *Scope:* at the validation site (`team-coordinator.ts:441` + phase guards `:514/:592`), replace
    *"out-of-set `message_type` → `interruptPlanningForMissingEvents`"* with *"→ correct + retry (restate
    the current legal set from `taskExpectedResponses`), bounded by **D2 (N=2)**, then → `ejectPlanner`
    (T1)."* Extend `parseWithRetry` (`translation.ts:88`) from *malformed-JSON-only* to *illegal-move*.
  - *Behaviour change + contracts:* this is the core flip. **Rewrites** `agent-failure-impact.test.ts` and
    the consensus tests that currently assert dual-kill on illegal moves → **needs D1/D2 settled + explicit
    approval of the new contract** before I touch those tests.
  - *DoD:* a weak/non-compliant planner that sends an illegal move gets corrected and recovers within N;
    a persistently-bad one is ejected (not dual-killed); peer + round survive per D1.
- **T3 — Single tool `consensus_respond(action, payload)` (follow-on, deferred per D3).**
  - *Scope:* collapse `translateStructuredResponse` (`translation.ts:11-82`) + `STRUCTURED_MESSAGE_TYPES`
    into one tool; brain reads `action`, validates vs the legal set. **Wire-contract change** → bump v5→v6,
    recompute hash, **lockstep with the client** (`agentalk-mcp-client`) + the handshake gate (same
    discipline as the harness-division spike).
  - *DoD:* live gate green on ≥1 provider with the v6 contract; both contract copies byte-identical.
- **T4 — (Optional, separate) API-path enforcement optimization.**
  - *Scope:* add `tools` + `tool_choice` + strict `enum` to the `api-client.ts` request so the API path's
    first answer is always legal (skip the retry). Per-provider verified (OpenAI yes; deepseek/gemini
    **verify**). Pure optimization; the graded loop remains the floor. May split to its own milestone.

## 5. Risks & mitigations

- **Engine blast radius (highest).** `team-coordinator.ts` is shared, load-bearing logic. *Mitigation:*
  T1 is additive (new path, touches nothing); T2 rewires one validation site behind settled decisions +
  approved contracts; full suite + the consensus/failure tests gate every step.
- **Tested-contract drift.** The dual-kill is *tested*. *Mitigation:* surface each contract change for
  explicit approval **before** editing the test; never silently weaken.
- **T3 wire-contract lockstep.** A hash mismatch rejects all clients. *Mitigation:* reuse the spike's
  proven byte-identical + verify-contract + live-handshake procedure.

## 6. Definition of Done (Phase-2 v1 = T1 + T2)

1. `ejectPlanner` exists, peer-safe; eject-A-keeps-B test green.
2. Graded loop live: illegal move → bounded correct/retry → eject (not dual-kill); recovery + eject both
   tested; peer + round survive.
3. Gate: `tsc -b` 0 + full suite green; the rewritten failure/consensus contracts reflect the **approved**
   new behaviour (no silent weakening); no pollution (LB-9).
4. Telemetry block per closing task; ledger written.
   T3/T4 tracked as follow-ons (own DoD when scheduled).

## 7. Open items
- **✅ D1/D2/D3 settled** (§3). **v1 = T1 + T2; T3/T4 deferred.**
- Per-task, before editing any *tested* contract (T2): surface the exact before→after and get explicit
  approval, then change the test + code together. (Standing Rules-of-Engagement gate, not a new decision.)
