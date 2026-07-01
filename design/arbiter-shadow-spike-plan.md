# Arbiter Shadow Spike — inception plan

> **Status:** 🟢 **OPEN — PO GO given (Fausto, 2026-07-01).** Inception complete: Architect draft + Planner
> advisory POV (§7) + Architect disposition (§8, all refinements folded into §5). The §3b backlog gate is
> recorded in `design/backlog.md` (gate 2026-07-01). **Next: Planner task breakdown** (slices per §7 guidance)
> into a sibling `*-implementation.md` ledger; this doc fixes goal/resources/feasibility and the DoD bar.
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

0. *(added per planner POV)* A **corpus-adequacy audit** as step 0: prove the recorded JSONL events actually
   carry the consensus turns, phase/protocol moments, and terminal outcome a semantic judge needs. If they
   don't, that is a **spike finding to report** — not a license to patch recording infra.
1. A **labeled golden corpus** committed (or pointered) with ≥ 5 successful, ≥ 5 failure, and best-effort ≥ 2
   ambiguous transcripts. **Failure entries count by covered class, not file count** (phase-illegal ·
   malformed/parse · late message · correction/eject · non-converging) — five near-duplicates don't meet the bar.
2. A **shadow-arbiter script** that replays any corpus entry and emits judgment + rationale + token/latency
   cost, at ≥ 2 cadence settings — **3 preferred** (every-message, every-N, readiness-triggered); if budget
   tightens, keep **readiness-triggered + one baseline** (it's the product-relevant one).
3. A **results table** answering §1.1–1.4 with real numbers, in this doc or a sibling `*-implementation.md`.
   **Honesty clauses:** state plainly if fewer than 2 useful ambiguous transcripts were found (thin ambiguous
   set lowers Mode-A confidence, doesn't block closure); **plausible rationales without reproducible
   agreement/recovery/cost numbers → the recommendation is PARK**, not promote.
4. A **promote-or-park recommendation** signed by the architect, decided by the PO.
5. Gate hygiene: zero production diffs, suite green, no worktree/process pollution, telemetry block on close.

## 6. Explicitly out of scope (the program, not the spike)

Facilitator extraction (Epic 1), Mode B rewiring (Epic 2), Mode A synthesis (Epic 3), single-point mitigation
(Epic 4), the BL-002 auto-handoff absorb (PO deferred the call, 2026-07-01 — re-raise at the Epic 1 gate), and any M11-floor
changes. The spike only *informs* these.

## 7. Planner advisory POV - Codex (2026-07-01)

**Recommendation:** proceed to PO go if the spike is explicitly treated as a measurement/corpus spike, not an
arbiter-prototype spike. The architecture is feasible and appropriately fenced: a replay-only script plus
`@agenttalk/llm-client` should be enough to evaluate judgments without touching the production coordinator,
registry, protocol tools, MCP surface, or client code. The main risk is not the LLM call; it is whether the
recorded evidence is complete enough, labeled enough, and diverse enough to make the results meaningful.

**Feasibility check:** the replay stack exists, but the first task must prove recording adequacy before building
the judge. Current playback reconstructs final runtime state from JSONL events, and the repo has no checked-in
recordings today. If the available events do not include the actual consensus turns, phase/protocol moments, and
terminal outcome needed for semantic judging, that is a spike finding to report, not a reason to patch recording
infrastructure inside this spike. This makes "corpus audit" the correct step 0.

**DoD floor:** the architect's suggested 5/5/2 floor is acceptable as a minimum, with two constraints:
- Count coverage by labeled scenario, not just file count: the five failure entries should cover distinct classes
  where possible (phase-illegal, malformed/parse failure if available, late message, bounded correction/eject,
  non-converging/referee) rather than five near-duplicates.
- The ambiguous set should be allowed to stay best-effort, but the recommendation must say plainly if fewer than
  two useful ambiguous transcripts were found. A thin ambiguous corpus can still close the spike; it should lower
  confidence in promoting Mode A, not block learning.

**Cadence measurement:** require at least two cadence settings, but prefer three if budget allows: every message,
every N messages, and readiness-triggered. The readiness-triggered form is the most product-relevant because it
preserves the rule that agents can signal readiness but cannot decide advancement. If budget gets tight, keep
readiness-triggered plus one baseline cadence; do not spend all quota on exhaustive matrix runs.

**Risk/effort assessment:** medium effort, low production risk. Expected cost centers are: assembling/labeling the
golden corpus, normalizing transcript slices into stable judge inputs, and writing a scoring table that is honest
about "not enough data." The arbiter script itself should be small. The spike should park, not promote, if it can
only show plausible rationales without reproducible agreement/recovery/cost numbers.

**Task-breakdown guidance after PO go:** slice the work as corpus audit/assembly, label schema + golden labels,
shadow-judge script, cadence/cost run, and results/recommendation. Keep each slice docs-or-script only unless the
PO/Architect explicitly lift the zero-production-change fence.

## 8. Architect disposition of the planner POV (Claude, 2026-07-01)

**All five refinements ACCEPTED and folded into §5** (workflow symmetry — every planner signal dispositioned):
(1) measurement/corpus framing — agreed, that *is* the spike; (2) corpus-adequacy audit as DoD step 0 — accepted,
it hardens my "gap = finding, not fix" fence into a checkable bar; (3) failure coverage counted by class —
accepted verbatim; (4) thin-ambiguous honesty clause + park-if-no-reproducible-numbers — accepted verbatim (it
operationalizes Honesty-over-Results for a non-deterministic deliverable); (5) cadence: 3 settings preferred,
readiness-triggered prioritized under budget pressure — accepted. No open disagreements between architect and
planner. **Remaining gate: PO go.**
