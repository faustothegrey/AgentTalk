# Milestone 15 — Arbiter Consensus, Direct Path

**Status:** 🟢 **OPEN — PO direct-path decision (2026-07-02, in session); Planner advisory POV accepted by
PO; breakdown recorded and Reviewer Gate 1 approved; M15-T1 verified by PO override; M15-T2 verified by
implementation reviewer; Claude found one T3 follow-up routing defect, now fixed and freeze-verified by Codex
under direct PO request; awaiting PO closure/merge decision.**
Inception ceremony compressed by the PO: the PO↔Architect direct discussion in session replaces the formal
inception round; this plan is its record.
**PO:** Fausto · **Architect:** Claude · **Planner:** Codex · **Implementer:** Gemini (stood down from
M14-T2, idle, awaiting M15 baton) · **Implementation Reviewer for this session:** Codex (PO appointment,
2026-07-02, due Claude 5h-window pressure; Claude already completed Gate 1 breakdown review).
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

## Task breakdown (Planner final, 2026-07-02)

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

## DoD claims

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

## Planner advisory POV (Codex, key `20260702-1654-2bd94e`) — RECORDED 2026-07-02

**Recommendation:** proceed with M15, with the plan's direct-path framing kept explicit: this is an
arbiter-mode sibling path, not a protocol refactor. The bypass architecture is sound because it converts the
M14 preservation problem into an additive route: the frozen protocol coordinator remains the baseline, while
`ArbiterCoordinator` proves whether free-form debate plus judge/synthesis can carry a real task. Given the
AS-T3b evidence (readiness-triggered 5/6 success, 3/5 recovery, zero false `converged`, cents-scale cost), the
direct path is justified. The earlier planner preference for "shadow first, Mode B first" has been overtaken by
the PO's direct-path decision and the verified spike numbers; I do not object to the trade as long as the human
confirmation gate is treated as the first-line ratifier.

**Main caution:** M15 is using Mode A to author an implementation plan. That cuts against the earlier draft's
conservative rule that binding executable plans should prefer Mode B. I accept it for this epic only because the
arbiter-authored product is **not binding until `awaiting_confirmation` is accepted by the human**, and the worker
path still has its existing accept/refuse behavior. The implementation and tests should preserve that framing:
the arbiter authors a candidate plan, the existing human gate ratifies it, and the worker remains unchanged.

**`consensusMode` routing looks minimal but must stay narrow.** Today the public team shape has no
`consensusMode`, and `Registry.assignTeamTask()` delegates straight into `TeamCoordinator.assignTask()`. The
safe route is an additive config field on the team/task creation surface, defaulting to `'protocol'`, with a
single registry-level branch that chooses `TeamCoordinator` or `ArbiterCoordinator` for multi-planner planning.
Do not thread arbiter conditionals through `team-coordinator.ts`; C5 should make any diff there an automatic
refutation. The planner breakdown should require a small default-behavior test: creating/assigning a team without
`consensusMode` exercises the same protocol path and keeps the M14 identity harness green.

**C1-C5 are independently verifiable with minor tightening:**
- **C1:** split deterministic proof from live proof. The mock-judge test should drive NL debate through
  `converged` → arbiter-authored plan → `awaiting_confirmation`, then explicitly confirm and verify the normal
  worker path can complete. The live run is recorded evidence, not a flaky gate.
- **C2:** good as written, but the not-converged path needs a task terminal state and emitted event that operators
  can see; "no hang" alone is not enough.
- **C3:** this is the critical freeze claim: full suite plus `node scripts/m14-identity-harness.mjs --check`, and
  no default `consensusMode` opt-in by accident.
- **C4:** include the AS-T3b lessons in the bar: full verdict-vocabulary gloss (`hold`, `fail-soft:*`,
  `not-converged`, `converged`, `advance-to:*`) and the consensus-process-only judge frame. Readiness-triggered
  may trigger judging but must never decide by itself. Costs should be reported for judge and synthesis separately
  where available.
- **C5:** make scope hygiene per task, not just at epic close: `git diff --stat`, explicit touched-file list, and
  zero `team-coordinator.ts` diff before every baton advances.

**Breakdown guidance for the next gate:** keep T1 purely structural and deterministic: types/config/routing,
`ArbiterCoordinator` skeleton, free-form planner turns, hard turn budget, mock judge, and protocol identity proof.
Put real judge/synthesis and prompt semantics in T2. Keep live proof in T3 after the deterministic path is already
reviewed. I would not reopen BL-010's gemini transport fix inside M15; the PO-selected judge is `gpt-4o-mini`, and
shared `llm-client` behavior changes would widen the blast radius.

**Planner verdict:** ready for PO weighing. If the PO accepts this POV, the next planner action is the M15 task
breakdown and ledger creation; implementation should still wait for Claude's Gate 1 review.
