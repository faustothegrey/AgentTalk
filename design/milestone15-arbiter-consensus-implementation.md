# M15 - Arbiter Consensus, Direct Path - Implementation Ledger

> **Status:** 🟢 **OPEN - GATE 1 APPROVED (Claude, reviewer, 2026-07-02); Gate 1 notes dispositioned by
> Codex; M15-T1 ready for implementer baton.**
> **Plan:** `design/milestone15-arbiter-consensus-plan.md`
> **Base:** `master` at `881a9cc` (2026-07-02), plus planner/SM docs edits in this working tree.
> **Backlog:** BL-012 (`doing`)
> **PO:** Fausto. **Architect:** Claude. **Planner + SM:** Codex. **Implementer:** Gemini.
> **Implementation Reviewer for this session:** Codex (PO appointment `[Human]`, 2026-07-02, due Claude
> 5h-window pressure; Claude performed Gate 1 — breakdown review — before the switch). Codex thus wears three
> declared hats for this session (planner + SM + implementation reviewer); each seat's gate and discipline held
> separately per AGENT.md. Note: this accepts Codex reviewing implementation against a breakdown it authored —
> mitigated by Claude's independent Gate 1 on that breakdown and the PO merge gate. Future implementation review
> gates remain a PO call unless this appointment is extended.

This ledger is the task-level handoff for M15. The plan owns the epic goal and fence; this file owns task
sequencing, implementer claims, reviewer verdicts, gate evidence, and closure telemetry.

## Global M15 Rules

- **Parallel path, not protocol refactor.** Build arbiter mode as an additive sibling. Do not edit
  `packages/runtime-core/src/registry/team-coordinator.ts`; any diff there refutes the task unless the PO
  explicitly rescopes M15.
- **Default behavior is protocol.** Any team/task without explicit arbiter opt-in must follow the current protocol
  path. The M14 identity harness and full suite are the freeze bar.
- **No shared `llm-client` behavior changes.** Judge and synthesis reuse the existing public client shape; the
  gemini-via-OpenRouter transport issue stays deferred in BL-010.
- **No network in deterministic tests.** Unit/integration tests use injected mock judges/synthesizers. Real
  OpenRouter calls belong only to the live proof task.
- **Mode-A ratifier frame.** The arbiter authors a candidate plan; it is not binding until the existing
  `awaiting_confirmation` human gate is accepted. The worker path remains unchanged.
- **Scope report every task.** Implementer reports `git diff --stat`, every touched file, and confirms zero
  `team-coordinator.ts` diff before filing claims.

## Sequencing

1. **M15-T1 - ArbiterCoordinator skeleton + routing.** Add `consensusMode`, default protocol routing, free-form
   arbiter debate loop, hard turn-budget fail-soft, and deterministic mock tests. No real judge/synthesis.
2. **M15-T2 - Judge + synthesis wiring.** Add readiness-triggered arbitration, verdict/prompt semantics, synthesis
   call on `converged`, and `awaiting_confirmation` handoff. Still mock-driven in tests.
3. **M15-T3 - Live recorded proof + closure.** Run one real arbiter-mode multi-planner task with recording on,
   report cost and artifacts, then close or record the blocker honestly.

No implementation task starts until Claude approves this breakdown at Gate 1. T2 does not start until T1 is
reviewer-verified. T3 does not start until T2 is reviewer-verified.

## Claim / Verdict Ledger

The implementer records **Claim** entries with exact command output. The reviewer records **Verdict** only after
running or independently checking the evidence.

| Task | Owner | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|---|
| M15-T1 | Gemini | NOT FILED | not-checked | Gate 1 approved; implementer primer minted after note disposition. |
| M15-T2 | Gemini | NOT FILED | not-checked | Blocked on T1 verified. |
| M15-T3 | Gemini | NOT FILED | not-checked | Blocked on T2 verified. |

## M15-T1 - ArbiterCoordinator Skeleton + Routing

**Goal.** Introduce arbiter mode as an opt-in multi-planner route while proving that the default protocol route
is unchanged.

**Allowed surfaces.**

- `packages/contracts/src/types.ts` and any directly related contract tests/types needed for an optional
  `consensusMode: 'protocol' | 'arbiter'` field.
- `packages/runtime-core/src/registry/config.ts` and `packages/runtime-core/src/registry/registry.ts` for the
  smallest compatible default/routing extension.
- New `packages/runtime-core/src/registry/arbiter-coordinator.ts` and small local sibling types/helpers.
- New/extended tests under `packages/runtime-core/src/registry/__tests__/`.
- This ledger and the M15 plan.

**Forbidden surfaces.** `team-coordinator.ts`, protocol payload/tool definitions, `mcp-tools.ts`,
`packages/runtime-core/src/agents/in-process-driver.ts`, `@agenttalk/llm-client`, client repos,
recording/playback infrastructure, and existing protocol tests except for additive assertions that preserve their
behavior.

**Required behavior.**

- `consensusMode` defaults to `'protocol'`; existing calls such as `createTeam(members, provider)` and
  `assignTeamTask(teamId, description, maxRepliesPerAgent)` continue to exercise the protocol coordinator.
- Arbiter opt-in routes multi-planner planning to `ArbiterCoordinator`; worker-only and single-planner flows keep
  their existing behavior.
- Arbiter prompts are free-form natural language, not `consensus_respond` protocol instructions.
- The arbiter loop records transcript entries for planner utterances, enforces the hard turn budget, and reaches a
  visible fail-soft terminal state on non-convergence without hanging or crashing. Visibility means both a task
  state/update and an emitted runtime event; a log line alone is insufficient.
- In arbiter mode, `advance-to:*` verdicts are progress hints only. Because arbiter debate has no protocol phases,
  `ArbiterCoordinator` treats `advance-to:*` as `hold`/continue and records the verdict; it must not map the target
  onto protocol phases or mutate protocol state.
- T1 may use an injected deterministic mock judge only to drive skeleton outcomes; it must not introduce live LLM
  calls or final synthesis semantics.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| New targeted arbiter routing/skeleton vitest | 3 |
| Default-protocol regression vitest/assertion | 2 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `git diff --check` | 2 |
| `git worktree list` pollution check | 1 |

**DoD rows.**

| Claim | Required evidence |
|---|---|
| T1-C1 | `consensusMode` is typed and defaults to `'protocol'`; an existing-style team assignment still uses the protocol route. |
| T1-C2 | Arbiter opt-in reaches the new coordinator without touching `team-coordinator.ts`. |
| T1-C3 | Arbiter-mode planners receive free-form prompts and transcript entries are recorded without protocol `message_type` dependence. |
| T1-C4 | Hard turn budget produces visible `not-converged`/fail-soft completion with a task update and runtime event; no hang/crash. |
| T1-C5 | Freeze bar green: targeted tests, `npx tsc -b`, `npm test`, and `node scripts/m14-identity-harness.mjs --check`; scope list confirms zero `team-coordinator.ts` diff. |

## M15-T2 - Judge + Synthesis Wiring

**Goal.** Replace the T1 mock-only decision path with an injectable arbiter judge/synthesizer interface, preserving
deterministic tests and the human confirmation gate.

**Allowed surfaces.**

- `packages/runtime-core/src/registry/arbiter-coordinator.ts` and sibling judge/synthesis modules.
- New/extended arbiter tests under `packages/runtime-core/src/registry/__tests__/`.
- Optional local prompt fixture/helper files if they stay under runtime-core registry ownership.
- This ledger and plan.

**Forbidden surfaces.** `team-coordinator.ts`, shared `llm-client` behavior changes, protocol tool definitions,
recording/playback infrastructure, client repos, and live-network calls from tests.

**Required behavior.**

- Judge interface supports the spike verdict vocabulary: `advance-to:*`, `hold`, `fail-soft:<agent>`,
  `converged`, and `not-converged`.
- Prompt text includes the full vocabulary gloss and the consensus-process-only frame from AS-T3b so downstream
  worker refusal does not pollute convergence judgment.
- Readiness-triggered cadence is the default: an agent readiness signal may trigger arbitration, but never decides
  convergence by itself. End-of-budget arbitration still runs.
- On `converged`, synthesis authors the candidate plan and the task enters existing `awaiting_confirmation`;
  no worker assignment happens before confirmation.
- Judge and synthesis costs are captured separately when usage is available and reported as unavailable otherwise.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Judge prompt/vocabulary targeted tests | 3 |
| Readiness-trigger cadence tests | 3 |
| Synthesis-to-`awaiting_confirmation` test | 3 |
| Worker-not-before-confirmation regression test | 2 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `git diff --check` | 2 |
| `git worktree list` pollution check | 1 |

**DoD rows.**

| Claim | Required evidence |
|---|---|
| T2-C1 | Mock judge can return each verdict class and arbiter mode handles each deterministically. |
| T2-C2 | Readiness-triggered arbitration triggers evaluation but does not itself decide convergence. |
| T2-C3 | `converged` runs synthesis, records an arbiter-authored candidate plan, and enters `awaiting_confirmation`. |
| T2-C4 | Worker path is unchanged and cannot start before human confirmation. |
| T2-C5 | Cost/usage fields are honest; unavailable token data is marked unavailable, not guessed. |
| T2-C6 | Freeze bar green: targeted tests, `npx tsc -b`, `npm test`, and M14 identity `--check`; zero `team-coordinator.ts` diff. |

## M15-T3 - Live Recorded Proof + Closure

**Goal.** Produce one real, recorded arbiter-mode multi-planner run using `gpt-4o-mini` via OpenRouter for judge
and synthesis, then record cost, artifacts, and closure disposition.

**Allowed surfaces.**

- A live-smoke script under `scripts/`, named for M15 arbiter live proof.
- Result artifacts or pointers under a clearly named `design/m15-*` location if useful.
- This ledger, the M15 plan status, backlog/logbook closure entries, and Codex lessons at session close.

**Forbidden surfaces.** Production runtime changes except for fixes explicitly authorized after a T3 blocker,
existing deterministic tests, protocol coordinator code, `team-coordinator.ts`, client repos, and recording
infrastructure.

**Required behavior.**

- Run a real arbiter-mode team end-to-end with `AGENTTALK_DIAGRAM_RECORD` enabled.
- Use OpenRouter `gpt-4o-mini` for judge/synthesis as the PO-selected model; do not switch model silently.
- Treat the live run as recorded evidence, not a flaky pass/fail gate. If it fails, report the failure and decide
  whether it is in-scope before changing code.
- Record judge/synthesis token and cost data where available, plus wall-clock latency and recording path.
- Re-run deterministic freeze checks after the live proof.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Live arbiter smoke script syntax/check | 2 |
| One real recorded live run | 1 |
| Recording/artifact sanity check | 2 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check` | 2 |
| `git worktree list` pollution check | 1 |

**DoD rows.**

| Claim | Required evidence |
|---|---|
| T3-C1 | One real arbiter-mode multi-planner run is recorded, with path/pointer and model declared. |
| T3-C2 | Run reaches `awaiting_confirmation` with arbiter-authored candidate plan, then worker path completes after confirmation, or failure is recorded as an honest blocker. |
| T3-C3 | Judge and synthesis cost/latency are reported separately where available. |
| T3-C4 | Deterministic freeze bar remains green after the live proof. |
| T3-C5 | Closure artifacts updated: M15 plan status, backlog/logbook entries, telemetry block, and no scope pollution. |

## Gate 1 Questions For Reviewer

- Is the `consensusMode` surface narrow enough, or should the config live somewhere more specific than the
  team/task creation surface?
- Are T1/T2 split correctly, with all real judge/synthesis work held out of the skeleton task?
- Are the freeze bars sufficient to protect the dormant protocol path?
- Is the live proof's one-run budget acceptable, given it is recorded evidence rather than a deterministic gate?

## Gate 1 Review (Claude, reviewer, 2026-07-02) — **APPROVED with 3 notes (none blocking; 2 need a one-line planner disposition before the implementer baton)**

**Verified by running, at breakdown base `881a9cc` + this uncommitted tree:**
- Freeze bar green NOW: `npm test` → **269/269 (46 files)**; `node scripts/m14-identity-harness.mjs --check` →
  "Baselines match. Identity verified." Known harness worktree+branch leak reproduced and **cleaned**
  (`git worktree list` → main checkout only).
- POV/breakdown ground-truth claims hold: `consensusMode` absent from `packages/` today (grep empty);
  `Registry.assignTeamTask()` at `registry.ts:647`; `awaiting_confirmation` in `contracts/src/types.ts:22,39`;
  `AGENTTALK_DIAGRAM_RECORD` real (`apps/orchestrator/src/diagramtalk-bridge.ts`); T2 verdict vocabulary is an
  exact match to `design/arbiter-shadow-corpus/labels.schema.json` enum.
- Plan-coverage map: C1→T2-C3/C4+T3-C2 · C2→T1-C4 · C3→T1-C5/T2-C6/T3-C4 · C4→T2-C1/C2/C5 · C5→global scope
  rule + per-task scope report. **All five claims covered; deterministic/live split per the accepted POV.**
- Per-check pre-registered budgets present for all three tasks (incl. full-suite max 1, live run max 1). ✅

**Answers to the Gate 1 questions:** (1) `consensusMode` surface is narrow enough — optional field at
team/task creation + single registry-level branch is the right altitude; do not move it deeper. (2) T1/T2
split is correct; note the judge *interface* will be shaped by T1's mock and extended in T2 — acceptable.
(3) Freeze bars sufficient (suite + identity harness + default-protocol regression + zero
`team-coordinator.ts` diff, per task). (4) One-run live budget accepted — it is recorded evidence, and T3's
rules already route a failure to an honest blocker + scope decision.

**Notes (planner to disposition 1–2 with one line each; 3 is a recommendation):**
1. **Path defect (zero-risk doc fix):** T1 forbidden surfaces list `in-process-driver.ts` in a registry-file
   context; it actually lives at `packages/runtime-core/src/agents/in-process-driver.ts`. Fix the path so the
   implementer's fence greps the right file.
2. **`advance-to:*` semantics under-specified for a phase-less debate:** the spike enum's `advance-to:*`
   targets are protocol *phases* (fact_collection/discussion/proposal), which arbiter mode doesn't have. State
   what `ArbiterCoordinator` does on an `advance-to:*` verdict (recommend: treat as `hold`/continue, log it) so
   the implementer doesn't invent a mapping.
3. **T1-C4 "visible" should be explicit:** the accepted POV's C2 tightening demanded a terminal task state
   **and an emitted runtime event** operators can see; recommend writing "emits a runtime event" into T1-C4's
   bar so it can't be satisfied by a log line.

Implementer baton may go out once notes 1–2 are dispositioned. T2/T3 gating unchanged.

### Planner disposition of Gate 1 notes (Codex, planner + SM, 2026-07-02)

1. **Accepted.** Corrected the T1 forbidden-surface path to
   `packages/runtime-core/src/agents/in-process-driver.ts`.
2. **Accepted.** Added arbiter-mode `advance-to:*` semantics: treat as `hold`/continue, record the verdict, and
   do not map it onto protocol phases.
3. **Accepted.** Tightened T1-C4 / required behavior so visible fail-soft requires a task update plus runtime
   event, not just a log line.

**Telemetry (task closure):**
- task:        M15-T1
- wait_time:   unavailable
- tokens:      unavailable
- cost:        unavailable
- outcome:     done
- notes:       Implemented ArbiterCoordinator skeleton and routing, tests passing, freeze bar green.
