# Milestone 14 — Facilitator Extraction (Arbiter Epic 1)

**Status:** ⬛ **CLOSED — RESCOPED (PO, 2026-07-02): T1 delivered/merged; T2/T3 superseded by M15
(`design/milestone15-arbiter-consensus-plan.md`, direct-path arbiter consensus).** History in the ledger:
`design/milestone14-facilitator-extraction-implementation.md`.
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
  `packages/runtime-core/src/registry/__tests__/` (existing hook tests: **additive assertions only**); the
  standalone identity harness + its baselines under `scripts/` (M14-owned — it must not touch shared
  recording/playback infra); this plan, the M14 ledger, backlog/logbook lines at closure.
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

## The identity bar *(tightened per planner POV, architect-accepted 2026-07-02)*

Beyond `tsc` 0 and the suite unchanged-and-green:

**Normalized observable-identity proof.** The original "replay-diff" wording overclaimed: the existing playback
replays recorded snapshots (it does not re-execute the coordinator), and the recorder does not persist
`team_planning_phase` / `team_protocol_event` at all (verified: `registry.ts:133-134` re-emits them; `server.ts`
never records them). The corrected bar:

- **T1 builds a standalone, M14-owned harness** that drives the engine in-process on deterministic scenarios and
  captures a **normalized identity stream** via harness-level listeners on the registry/coordinator hooks —
  task status, planning-complete state, transcript payloads, final plan, and every `team_planning_phase` /
  `team_protocol_event` — with volatile fields (`taskId`/`teamId`/timestamps/`atMs`) stripped.
- Baselines are captured **before** the refactor lands and committed as the identity reference.
- The claim is **"observable engine output is identical on this corpus"** — not "all internal behaviour is
  proven identical." The residual gap is closed by **focused unit/path tests exercising all 6 transition sites
  and all 3 off-spine events**, which C1/C2 own.
- **Shared recording/playback infrastructure is not modified.** If the harness cannot produce stable normalized
  output without touching it, **stop and rescope** before extraction — do not weaken the bar.

## Task sketch (architect sizing — the Planner owns the real breakdown)

1. **M14-T1 — Identity harness + baseline capture.** Build the standalone harness in `scripts/` (in-process
   listeners, normalized stream — see the identity bar above), capture the pre-refactor baselines, commit them
   as the identity reference. Must land first; more design work than the name suggests (planner POV).
2. **M14-T2 — Facilitator interface + extraction.** Define the interface; move the 6 advancement decision
   points behind it; default implementation = current rules verbatim (a deterministic policy object). Interface
   vocabulary this epic is just today's transitions — the spike's verdict vocabulary (`advance/hold/converged/…`)
   is *informative* for the shape, not binding, and must not be imported yet (planner POV concurs).
3. **M14-T3 — Emission unification (BL-008 residual) — its own gated task, after T2** *(planner condition,
   architect-accepted)*. One internal emission mechanism at the Facilitator boundary; **adapters preserve the
   `onPhaseChange` and `onProtocolEvent` payloads exactly**; `registry.ts`, bridge code, MCP contracts, and
   client surfaces stay untouched. Existing hook tests may gain **additive assertions only**. If implementation
   discovers consumer-visible shapes or ordering must change, that is **not M14 cleanup — it is a show-stopper
   requiring PO scope direction.** T3 gets its own review round; it is the epic's risky task, not T2.

## DoD claims skeleton (Planner finalizes)

| Claim | Bar |
|---|---|
| C1 | All phase-advancement decisions flow through the Facilitator interface; no `setPlanningPhase` decision logic remains outside the seam/default impl. |
| C2 | Default implementation reproduces current rules: tsc 0, full suite green, **no existing test modified or weakened**. |
| C3 | Normalized identity stream identical to the committed T1 baselines (≥1 success + ≥1 failure-class scenario); plus focused tests covering all 6 transition sites and 3 off-spine events. |
| C4 | Emission unified behind one internal mechanism; `onPhaseChange`/`onProtocolEvent` payloads preserved exactly via adapters (identity-stream + hook-test evidence); `registry.ts`/bridge/contracts untouched. |
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

## Architect disposition of the planner POV (Claude, 2026-07-02)

Both load-bearing technical claims were **verified against the code before accepting** (reviewer discipline
applied to the architect seat): (a) `registry.ts:133-134` re-emits `team_planning_phase`/`team_protocol_event`
but `server.ts` has no `recorder.record` call for either — the recorder never persists them; (b) playback
replays recorded snapshots, it does not re-execute the coordinator. Claim (a) refutes the inception draft's
original replay-diff wording — the architect's C3 overclaimed, and the correction is Codex's, on the record.

**Disposition: both conditions ACCEPTED and folded into the plan above** (identity-bar section, T1/T3 sketch,
C3/C4). Status moves to: awaiting **PO go for task breakdown** (the plan's goal/fence/DoD bar is now stable;
tasks are the planner's).

## Planner advisory POV (Codex, 2026-07-02) — SUBMITTED

Non-binding feasibility/risk/effort view per the workflow; PO + Architect weigh this before task breakdown.

**Verdict:** **GO, with two tightening changes before implementation planning.** The epic is feasible and is the
right first arbiter epic: the advancement authority is concentrated enough that a pure extraction can preserve
Mode B byte-identically. The main risk is not the extraction itself; it is overclaiming what the identity proof
proves, and letting BL-008's emission cleanup quietly widen from "one mechanism, same shapes" into a bridge or
wire-contract change.

**Feasibility.** The current surface matches the inception map: `setPlanningPhase` is the forward-spine funnel,
`emitProtocolEvent` is the off-spine observer for `endorsed` / `eject` / `correction`, and both are already
re-emitted by the registry. A default Facilitator can start as a deterministic policy object whose vocabulary is
today's transition decisions only. It should not import the spike's judge verdict vocabulary yet; that belongs to
BL-010 / the next arbiter epic.

**Replay-diff bar.** Replay-diff is necessary, but as written it is not sufficient by itself as a byte-identity
proof. The existing recording/playback path replays recorded runtime snapshots; it does not re-execute the
coordinator against an input log, and the recorder does not currently persist `team_planning_phase` or
`team_protocol_event` directly. T1 should therefore define a normalized identity stream before the refactor:
strip volatile `taskId` / `teamId` / timestamps / `atMs`, compare task status, planning-complete state,
transcript payloads, final plan, and the phase/protocol observer events captured by a harness-level listener. The
claim should be "observable engine output is identical on this corpus", not "all internal behavior is proven
identical." The remaining gap should be closed with focused unit/path tests that exercise all six transition
sites and the three off-spine events.

**BL-008 / emission unification.** Keep it in M14, but keep it as its own gated task after the Facilitator
extraction. It is behavior-adjacent because the existing tests deliberately pin two separate hooks and the
DiagramTalk bridge consumes their re-emitted shapes. The safe version is: one internal emission mechanism at the
Facilitator boundary, adapters preserve `onPhaseChange` and `onProtocolEvent` payloads exactly, and
`registry.ts`, bridge code, MCP contracts, and client surfaces stay untouched. If implementation discovers that
consumer-visible shapes or ordering must change, that is not M14 cleanup; it is a show-stopper requiring PO
scope direction.

**Scope pressure.** The allowed surfaces are mostly right. I would tighten the plan text so "replay-diff harness"
does not imply modifying the shared recording/playback infrastructure unless the specific task names that file.
Prefer a standalone script/harness that attaches listeners to the registry or coordinator in-process and writes
M14-owned baselines. Also explicitly forbid changing existing hook tests except additive assertions; those tests
are behavior contracts for the bridge-facing surface.

**Effort.** Medium refactor, likely three implementation tasks as sketched, with T1 doing more design work than
the name suggests. The risky task is T3, not T2. If T1's harness cannot produce stable normalized output without
touching shared recording infra, stop and rescope before extraction rather than weakening the identity bar.
