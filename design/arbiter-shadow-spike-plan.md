# Arbiter Shadow Spike — inception plan

> **Status:** 🟡 **INCEPTION DRAFT — pending Planner advisory POV + PO go.** Authored by the Architect (Claude,
> 2026-07-01) at the PO's direction; the §3b backlog gate for this unit is recorded in `design/backlog.md`
> (gate 2026-07-01). **Task-level breakdown is the Planner's** — this doc fixes goal/resources/feasibility and
> the DoD bar, per epic-inception in `design/collaboration-workflow.md` §1.
> **Parent direction:** `design/arbiter-consensus-draft.md` (BL-009) — read §6 (de-risking entry) and §10
> (three-POV synthesis) first. **Program context:** this spike is the entry gate for the tentative 4-epic
> program (draft §8/§10); it opens nothing beyond itself.

## 1. Goal (what question the spike answers)

**Can a semantic arbiter judge consensus-transcript state at least as well as the protocol state machine —
and better where the machine breaks?** Concretely, produce **measured answers** to the three §6 questions plus
the cadence question §10.9 added:

1. **Agreement rate** — on transcripts with known outcomes, how often does the arbiter's advancement judgment
   match the state machine's (where the machine was right)?
2. **Recovery** — on the known crash/failure classes (LB-6/LB-7 illegal transitions, the late-message race,
   non-converging debates), does the arbiter produce a *useful* judgment where the machine threw or hung?
3. **Cost** — tokens + latency per arbitration, and how it scales with transcript length.
4. **Cadence** — cost/quality trade-off of judging every message vs. every-N vs. readiness-triggered
   (an agent's "I think we're done" *triggers* arbitration, never *decides* it — draft §10.9).

**Exit criterion:** a written recommendation — *promote* (open facilitator-extraction Epic 1) or *park* (record
why, close BL-009 thread as learning). Either outcome is a successful spike.

## 2. Scope fence (non-negotiable)

- **ZERO production behavior change.** No edits to `team-coordinator.ts`, the registry, the protocol, the MCP
  tool surface, or the client repo. The spike lives in `scripts/` (and, if needed, a throwaway leaf package) and
  *reads* recordings; it never sits in a live team's path.
- Recording infra may be **used**, not modified — unless a gap is found, which is a **finding to report**, not
  a fix to make (Implementer Rule 2 applies to the spike implementer).
- The deterministic suite stays untouched and green; `tsc` clean.

## 3. Feasibility (architect's ground-truth check, 2026-07-01)

- **Replay infra exists:** `packages/observability/src/recordings/` — `session-recorder.ts` writes JSONL
  (`meta` + `event` lines, channels `api`/`ws_in`/`runtime`); `playback.ts` + `npm run play-recording` replay to
  a `PlaybackState` (agents, conversations, teams, teamTasks). Recording is opt-in via
  `AGENTTALK_DIAGRAM_RECORD` (default OFF — LB-24).
- **⚠️ The corpus is EMPTY today:** no recordings exist on disk anywhere in the repo. **Corpus assembly is
  step 0 and the spike's real cost center** (draft §10.10), not the arbiter prototype itself.
- **Corpus sources (three, complementary):**
  1. **Fresh live recordings** — run the existing live gates/harnesses (`scripts/test-live-gate.mjs`,
     `scripts/test-pf2.mjs`, mixed-provider M12 harness) with recording ON → *successful* transcripts.
  2. **Synthetic failure transcripts** — the deterministic tolerance tests (M08/M11) already *inject* the
     illegal/late/malformed messages; drive those same injections through a recorded in-process run → *failure*
     transcripts on demand, no quota burn, reproducible.
  3. **Ambiguous/non-converging debates** — hardest to source; may need 1–2 deliberately under-specified live
     runs. Accept a small n here.
- **Labeling is human/architect work:** each corpus entry gets a golden label (e.g. `advance-to:<phase>` /
  `hold` / `fail-soft:<agent>` / `converged` / `not-converged`). Budget PO/architect time for this — it is the
  spike's scarce human input.
- **Arbiter prototype:** a script that walks a recorded transcript, prompts an LLM judge at the chosen cadence
  ("given this consensus goal and these messages, should the phase advance / hold / fail-soft, and why"), and
  scores against the golden label. `@agenttalk/llm-client` (`ApiCompleter`/`ChatSession`) is the ready-made,
  registry-free way to call the model — no runtime-core entanglement.
- **Budget note:** arbitration runs are API-path LLM calls — cheap per call, but the corpus × cadence matrix
  multiplies. The cost metric (§1.3) is *itself* a deliverable, so meter as you go (LB-11 discipline).

## 4. Resources

- **Roles:** Planner (Codex) — advisory POV then task breakdown · Implementer (Gemini, live default) ·
  Reviewer (Claude or Codex, ≠ planner) · Architect (Claude, standing) · PO (Fausto) — labels + go/park call.
- **Inputs:** the recording/playback package (read-only), existing live harnesses, deterministic tolerance
  tests as failure-injection templates, `@agenttalk/llm-client`.

## 5. DoD bar (what "spike complete" means — planner refines into tasks)

1. A **labeled golden corpus** committed (or pointered) with ≥ *n* successful, ≥ *n* failure-class, and a
   best-effort set of ambiguous transcripts (planner proposes *n*; architect suggests 5/5/2 as floor).
2. A **shadow-arbiter script** that replays any corpus entry and emits judgment + rationale + token/latency
   cost, at ≥ 2 cadence settings.
3. A **results table** answering §1.1–1.4 with real numbers, in this doc or a sibling `*-implementation.md`.
4. A **promote-or-park recommendation** signed by the architect, decided by the PO.
5. Gate hygiene: zero production diffs, suite green, no worktree/process pollution, telemetry block on close.

## 6. Explicitly out of scope (the program, not the spike)

Facilitator extraction (Epic 1), Mode B rewiring (Epic 2), Mode A synthesis (Epic 3), single-point mitigation
(Epic 4), the BL-002 auto-handoff absorb (PO ratification pending at the 2026-07-01 gate), and any M11-floor
changes. The spike only *informs* these.
