# Milestone 14 — Facilitator Extraction (Arbiter Epic 1)

**Status:** 🟡 **INCEPTION — PO + Architect complete (2026-07-02); awaiting Planner advisory POV (Codex);
task breakdown after the PO weighs it.** No branch, no code yet.
**PO:** Fausto · **Architect:** Claude · **Planner:** Codex · **Implementer:** Gemini (live default) ·
**Reviewer:** Claude (reviewer + architect dual-hat, declared per gate; planner ≠ reviewer holds).
**Program:** the arbiter direction — `design/arbiter-consensus-draft.md` (§7/§8/§10 decomposition); evidence
base: `design/arbiter-shadow-spike-implementation.md` (spike PROMOTED by the PO, merged `a905b2e`).
**Base:** `master` at `e24f07c` (2026-07-02). **Backlog:** BL-011 (`doing`); gate record 2026-07-02 in
`design/backlog.md`.

## Goal

Extract the **phase-advancement decision authority** out of `team-coordinator.ts`'s state machine behind a
**Facilitator interface**. The default — and, this epic, only — implementation reproduces today's deterministic
rules **byte-identically**: zero behaviour change, zero LLM calls. The deliverable is the *seam* (the
audit-pointed boundary "facilitator judged ready" from the draft's §10 working assumption 6) that Epic 2
(Mode B-on-facilitator) and the parked judge work (BL-010) later plug into.

**Also in scope (PO, inception):** the **BL-008 residual** — the brain emits protocol state changes through two
shapes (`onPhaseChange` forward-spine funnel vs. `onProtocolEvent` off-spine hook). The extraction refactors
exactly that surface, so the two emissions are unified behind one mechanism at the seam, with the observable
shapes for existing consumers (DiagramTalk bridge) unchanged.

## Non-goals (parked, explicitly — see BL-010)

All judge-touching work is out, per the PO's leaner-scope decision (2026-07-02): judge prompt hardening +
failure-ladder re-measure, the `llm-client` transport fix, shadow wiring, second-model spot-check. Also out:
Mode A, any advancement/tolerance *rule* change, any change to what the protocol accepts or rejects.

## Scope fence

- **Allowed surfaces:** `packages/runtime-core/src/registry/team-coordinator.ts`; a new facilitator module
  beside it (e.g. `packages/runtime-core/src/registry/facilitator.ts`); new/extended tests under
  `packages/runtime-core/src/registry/__tests__/`; a replay-diff harness under `scripts/`; this plan, the M14
  ledger, backlog/logbook lines at closure.
- **Forbidden:** any advancement/tolerance **rule** change (relocation only — a "while I'm here" improvement is
  a show-stopper per the ⛔ rules); `registry.ts` / `mcp-tools.ts` / wire contracts; the client repo; recording
  infrastructure (use, don't modify); weakening or rewriting any existing test (they are the behaviour
  contracts — `planning-phase-hook.test.ts`, `protocol-event-hook.test.ts`, and the M08/M11 tolerance
  regressions in particular).
- **Zero LLM calls** anywhere in this epic.

## Feasibility map (architect-run against master, 2026-07-02)

The extraction surface is small and centralized:

- Coordinator: 2,208 lines, one file. Forward spine: **5 phases** (`protocol_ack_pending → fact_collection →
  discussion → proposal_pending_endorsement → submittal_pending`).
- **6 advancement call sites** — `setPlanningPhase` at lines 356, 689, 773, 851, 1052, 1127. These are the
  decision points that move behind the interface.
- **3 off-spine protocol-event emissions** — `endorsed` (688), `eject` (1678), `correction` (2022) — plus the
  two observability hooks (`onPhaseChange` at 909–915, `onProtocolEvent` at 925–935): the BL-008 surface.
- Decision inputs already centralized (`ADVANCEMENT_RANK`, the `handle*` methods).
- Baseline: tsc 0, suite **269/269** (verified in the inception session).

## The byte-identical bar

Beyond `tsc` 0 and the suite unchanged-and-green:

**Replay-diff identity proof.** Replay recorded consensus transcripts through the engine before and after the
refactor and **diff the emitted event streams** — they must be identical. Uses the existing
`AGENTTALK_DIAGRAM_RECORD` / `play-recording` infra (read-only); no LLM. The baseline capture must land
**before** the refactor does (task-ordering constraint below). Suggested corpus: ≥1 recorded success + ≥1
failure-class transcript (the arbiter-shadow corpus recordings are candidates).

## Task sketch (architect sizing — the Planner owns the real breakdown)

1. **M14-T1 — Replay-diff identity harness + baseline capture.** Build the harness in `scripts/`, capture the
   pre-refactor event-stream baselines, commit them as the identity reference. Must land first.
2. **M14-T2 — Facilitator interface + extraction.** Define the interface; move the 6 advancement decision
   points behind it; default implementation = current rules verbatim. Interface vocabulary this epic is just
   today's transitions — the spike's verdict vocabulary (`advance/hold/converged/…`) is *informative* for the
   shape, not binding.
3. **M14-T3 — Emission unification (BL-008 residual).** One mechanism for protocol state-change emission at
   the seam; existing consumer-visible shapes unchanged (replay-diff covers this).

## DoD claims skeleton (Planner finalizes)

| Claim | Bar |
|---|---|
| C1 | All phase-advancement decisions flow through the Facilitator interface; no `setPlanningPhase` decision logic remains outside the seam/default impl. |
| C2 | Default implementation reproduces current rules: tsc 0, full suite green, **no existing test modified or weakened**. |
| C3 | Replay-diff identical on the committed baselines (≥1 success + ≥1 failure-class transcript). |
| C4 | Protocol state-change emission unified; observable event shapes for existing consumers unchanged (replay-diff evidence). |
| C5 | Zero LLM calls; scope fence clean (`git diff --stat` disposition per task). |

## Risks

1. **The seam invites rule edits.** Fence: decision *relocation* only. Any behaviour-touching "improvement"
   is a show-stopper — report, don't make it.
2. **Interface bakes in judge assumptions** while the judge is parked. Mitigation: vocabulary = today's
   transitions; spike vocabulary informative only.
3. **Emission unification is behaviour-adjacent** (shapes feed the DiagramTalk bridge). Mitigation: its own
   DoD row (C4) + the replay-diff bar.

## Resources

Zero API spend. Token-wise a mid-size refactor epic: estimated 2–3 implementer sessions + review gates
(M08-class). Claude runway comfortable at inception (weekly ~13% used).

## Inception record (PO decisions, 2026-07-02, in session)

1. **Leaner scope** — extraction only; all judge-touching work parked → **BL-010**.
2. **Naming: M14** (milestone series continues).
3. **BL-008 residual absorbed** into this epic.
4. **BL-003 superseded** (dropped at the gate).
5. **BL-002 drop committed** with the gate record.

## Planner advisory POV (Codex) — PENDING

*(Non-binding feasibility/risk/effort view per the workflow; PO + Architect weigh it, then the Planner does
the task breakdown.)*
