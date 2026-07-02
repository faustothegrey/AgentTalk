# Milestone 15 — Arbiter Consensus, Direct Path

**Status:** 🟡 **OPEN — PO direct-path decision (2026-07-02, in session); awaiting Planner advisory POV
(Codex), then breakdown.** Inception ceremony compressed by the PO: the PO↔Architect direct discussion in
session replaces the formal inception round; this plan is its record.
**PO:** Fausto · **Architect:** Claude · **Planner:** Codex · **Implementer:** Gemini (stood down from
M14-T2, idle, awaiting M15 baton) · **Reviewer:** Claude (dual-hat, declared per gate).
**Program:** `design/arbiter-consensus-draft.md`; spike evidence `design/arbiter-shadow-spike-implementation.md`;
supersedes M14-T2/T3 (`design/milestone14-facilitator-extraction-plan.md`, CLOSED-RESCOPED).
**Backlog:** BL-012 (`doing`); second 2026-07-02 gate record in `design/backlog.md`.

## Why (PO decision, recorded)

Preserving the protocol machine byte-identically while extracting a seam (M14) is too costly — "doing one
while preserving the other" was tried and abandoned. The fastest path: **bypass, don't dissect.** Build a
parallel arbiter-driven coordinator; **freeze** the protocol path (intact, tested, dormant); reattempt
protocol consensus later against a working machine. Target use beyond consensus itself: AgentTalk becomes
the **scrum-team coordination substrate** (agents attach over MCP; every utterance flows through the brain,
recorded and observable) — replacing the structurally lossy tmux-scraping layer (LB-49).

## Goal

A team/task can run consensus in **arbiter mode**: planners speak in free-form natural language (no
`message_type` protocol, no phases, no validation); a hard turn budget bounds the debate; an **LLM arbiter**
judges the transcript at **readiness-triggered cadence** (spike-verified dominant) with the spike's verdict
vocabulary; on `converged` the **arbiter authors the plan** (Mode A — *"il prodotto lo fa l'arbitro"*); the
plan enters the **existing `awaiting_confirmation` human gate** (the ratifier, for free) and the **unchanged
worker path** executes it.

## Non-goals

Removing or refactoring `team-coordinator.ts` (frozen); Mode B signing; arbiter panel/quorum/confidence
mitigation (draft Epic-4 material); UI beyond minimal events; `llm-client` changes (judge = `gpt-4o-mini`
via OpenRouter — PO decision; the gemini-transport fix stays deferred in BL-010).

## Scope fence

- **Allowed:** new `packages/runtime-core/src/registry/arbiter-coordinator.ts` (+ siblings it needs, e.g. an
  arbiter judge module reusing `@agenttalk/llm-client`); a `consensusMode: 'protocol' | 'arbiter'` config
  field (contracts + registry routing branch — **minimal touch, default `'protocol'`**); arbiter-mode turn
  prompt construction (new code — protocol-mode prompts byte-untouched); new tests; a live-smoke script under
  `scripts/`; this plan + M15 ledger + backlog/logbook at closure.
- **Forbidden:** any change to `team-coordinator.ts` or to protocol-path behaviour (the 269-test suite and
  the M14-T1 identity harness pin it — `node scripts/m14-identity-harness.mjs --check` must stay green);
  weakening existing tests; client-repo changes; recording-infra changes.
- **LLM calls:** judge + synthesis calls only, `gpt-4o-mini` via OpenRouter, temp 0; deterministic tests use
  an **injected mock judge** (no network in the suite — M11's deterministic-gate principle).

## Task sketch (architect sizing — Planner owns the breakdown)

1. **M15-T1 — ArbiterCoordinator skeleton.** `consensusMode` config threaded (default `'protocol'`,
   nothing changes unless opted in); free-form turn loop over the existing attach/await_turn plumbing; hard
   turn budget → `not-converged` → fail-soft; transcript recorded as today. Deterministic tests with an
   injected judge double. DoD: protocol suite + identity `--check` untouched-green.
2. **M15-T2 — Judge wiring.** Readiness-triggered arbitration (an agent's "I think we're done" triggers,
   never decides — draft §10.9) + end-of-budget checkpoint; spike verdict vocabulary + **BL-010 gloss and
   judge-frame line** (probe-proven); `converged` → synthesis call → plan → `awaiting_confirmation`.
   Judge/synthesis behind one interface so tests inject verdicts/products deterministically.
3. **M15-T3 — Live proof.** One real multi-planner run end-to-end (recorded via
   `AGENTTALK_DIAGRAM_RECORD`) — a recorded observation, not a flaky gate; the recording seeds the Mode-A
   golden set the draft calls for. Report cost per the token-monitoring culture.

## DoD claims skeleton (Planner finalizes)

| Claim | Bar |
|---|---|
| C1 | Arbiter-mode team completes: NL debate → judged `converged` → arbiter-authored plan → `awaiting_confirmation` → worker done (mock-judge deterministic test + one live recorded run). |
| C2 | Turn budget enforced: non-converging debate ends `not-converged`/fail-soft deterministically, no hang, no crash. |
| C3 | Protocol path frozen-intact: full suite green **and** `m14-identity-harness --check` identical, with `consensusMode` defaulting to `'protocol'`. |
| C4 | Judge integration honest: verdict vocabulary = spike schema + gloss; readiness-trigger never auto-decides; judge/synthesis costs reported per run. |
| C5 | Scope fence clean per task (`git diff --stat` disposition); no `team-coordinator.ts` diff anywhere in the epic. |

## Risks (stated, accepted at this altitude)

1. **Single-point arbiter, weak severity discrimination** (spike: 1/3 ladder) — acceptable for v1: the loop
   needs advance/hold/converged, and the spike showed **zero false `converged` in 33 runs** (over-holding =
   one more debate turn). Ladder re-measure remains available via BL-010 leftovers if it bites.
2. **Prompt-shape novelty:** free-form planner prompts are new surface; mitigation = T3's recorded live run
   before any scrum-machine reliance.
3. **Mode-A product quality** rides on the synthesis call; mitigation = the human confirmation gate is v1's
   ratifier by design.

## Resources

Judge/synthesis in cents per run (spike-calibrated: ~5k prompt tokens per arbitration at readiness cadence).
Estimated 3 implementer sessions + review gates. Claude runway at open: weekly ~24%.

## Planner advisory POV (Codex, key `20260702-1646-5d1db9`) — PENDING
