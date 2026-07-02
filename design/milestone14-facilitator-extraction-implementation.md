# M14 - Facilitator Extraction (Arbiter Epic 1) - Implementation Ledger

> **Status:** 🟢 **OPEN — Gate 1 APPROVED ✅ (reviewer, 2026-07-02). Next: M14-T1 (identity harness +
> baselines, implementer Gemini). No task after T1 starts until the reviewer verifies T1's committed
> baselines + harness command.**
> **Plan:** `design/milestone14-facilitator-extraction-plan.md`
> **Base:** `master` at `e24f07c` (2026-07-02), with M14 docs commits after it.
> **Backlog:** BL-011 (`doing`)
> **PO:** Fausto. **Architect:** Claude. **Planner:** Codex. **Implementer:** Gemini. **Reviewer:** Claude.

This ledger is the task-level handoff for M14. The plan owns the stable goal/fence; this file owns live task
claims, reviewer verdicts, and closure evidence.

## Global M14 Rules

- Pure deterministic refactor only: zero LLM calls, zero advancement/tolerance rule changes.
- Do not touch `registry.ts`, `mcp-tools.ts`, wire contracts, the client repo, DiagramTalk bridge/client code, or
  shared recording/playback infrastructure.
- Existing tests are behavior contracts. Do not weaken or rewrite them. Existing hook tests may receive additive
  assertions only.
- If a task exposes a needed consumer-visible shape/order change, a shared-infra change, or a protocol acceptance
  rule change, stop and report. Do not fold it into M14 implementation.
- Every implementation task must report `git diff --stat` and explain every changed file against that task's
  allowed surfaces.

## Sequencing

1. **M14-T1 - Identity harness + baseline capture.** Must land first. Creates the normalized observable identity
   reference before production refactor work.
2. **M14-T2 - Facilitator interface + extraction.** Moves advancement decisions behind the default deterministic
   Facilitator while preserving current behavior.
3. **M14-T3 - Emission unification (BL-008 residual).** Runs after T2 as its own gated task. Unifies the internal
   emission mechanism while preserving the two existing observer payload shapes exactly.

No task after T1 may start unless the reviewer verifies T1's committed baselines and harness command.

## M14-T1 - Identity Harness + Baseline Capture

**Goal.** Build a standalone M14-owned harness in `scripts/` that drives deterministic in-process consensus
scenarios and writes normalized observable identity streams. Commit the pre-refactor baselines before T2.

**Allowed surfaces.**

- New script(s) under `scripts/`, named for M14 identity work.
- Baseline output files owned by M14, under a new deterministic subdirectory in `scripts/` (plan fence pins
  harness + baselines to `scripts/`; reviewer-aligned at Gate 1), named clearly enough that they are not
  confused with the arbiter shadow judge corpus.
- This ledger.

**Forbidden surfaces.** Production runtime code, registry code, shared recording/playback infra, existing arbiter
shadow judge scripts/results, client repo.

**Required harness shape.**

- Drive the engine in-process with mock/MCP-style agents, not live providers.
- Capture a normalized stream containing at minimum: task status, `planningComplete`, transcript kind/from/to/payload
  and message type where present, final plan where present, and every `team_planning_phase` /
  `team_protocol_event`.
- Strip volatile fields before writing baselines: task IDs, team IDs, timestamps, elapsed milliseconds, temp paths,
  and any generated IDs that do not affect behavior.
- Include at least one successful consensus scenario and at least one failure-class scenario. Prefer covering
  correction/eject behavior if it can be done deterministically without broadening the task.
- Provide one command that regenerates/compares the normalized streams and exits non-zero on mismatch.

**Implementation notes.**

- The existing `play-recording` path is not enough for this bar because it replays snapshots instead of re-executing
  the coordinator. T1 should attach harness-level listeners to the registry/coordinator event emitters rather than
  changing shared recording infra.
- If direct listener capture cannot be made stable without modifying shared infra, stop and report for rescope.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Harness syntax (`node --check ...`) | 2 |
| Harness compare/regenerate command | 3 |
| `npx tsc -b` | 2 |
| Targeted identity-related tests, if any are added | 2 |
| Full `npm test` | 1 |

**DoD rows.**

| Claim | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| T1-C1 | CLAIMED | not-checked | Standalone M14 identity harness exists in `scripts/m14-identity-harness.mjs`; runs in-process mock agents. No infra modified. |
| T1-C2 | CLAIMED | not-checked | Harness captures normalized task updates, transcripts, and protocol streams. Volatiles (taskIds, dates) are stripped via `stripVolatiles`. |
| T1-C3 | CLAIMED | not-checked | Baselines committed to `scripts/m14-identity-baselines`. Exercises a success scenario (completed, worker accept) and failure scenario (eject on repeat illegal protocol). |
| T1-C4 | CLAIMED | not-checked | Documented command: `node scripts/m14-identity-harness.mjs --check` compares regenerated stream to baselines and exits non-zero on mismatch. Output: `Baselines match. Identity verified.` |
| T1-C5 | CLAIMED | not-checked | `npx tsc -b` passes cleanly, `npm test` passes. |

## M14-T2 - Facilitator Interface + Extraction

**Goal.** Extract phase-advancement decision authority from `team-coordinator.ts` behind a Facilitator interface.
The default implementation is a deterministic policy object that reproduces today's transitions verbatim.

**Allowed surfaces.**

- `packages/runtime-core/src/registry/team-coordinator.ts`
- New facilitator module beside it, for example `packages/runtime-core/src/registry/facilitator.ts`
- New/extended tests under `packages/runtime-core/src/registry/__tests__/`
- M14 identity baselines only as regenerated comparison output, if the T1 command requires an expected-output update
  and the reviewer agrees that the normalized output is identical in meaning. A true diff is a blocker, not a
  baseline refresh.
- This ledger.

**Forbidden surfaces.** `registry.ts`, `mcp-tools.ts`, wire contracts, client repo, DiagramTalk bridge/client code,
shared recording/playback infra, T3's emission unification beyond minimal adapter calls required by the extraction.

**Required extraction coverage.**

- Move the six current phase transition decision sites through the Facilitator seam:
  `protocol_ack_pending`, `fact_collection`, `discussion`, `proposal_pending_endorsement`, fallback-to-`discussion`,
  and `submittal_pending`.
- Keep the T2 interface vocabulary limited to today's deterministic transitions. Do not import judge verdict terms
  such as `advance`, `hold`, `converged`, or `not-converged`.
- Focused unit/path tests must exercise all six transition sites. Tests may use a test double/fake Facilitator when
  useful, but must also prove the default Facilitator preserves the current transition sequence.
- Existing tolerance/correction/referee behavior remains unchanged.

**Implementation notes.**

- `setPlanningPhase` may remain the write/observer adapter in T2. The behavior decision that chooses the next phase
  moves behind the Facilitator seam; T3 handles internal emission unification.
- If a direct relocation would require changing expected legal actions, retry budgets, timeouts, or transcript text,
  stop and report. That is a behavior change, not extraction.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Focused Facilitator/transition tests | 3 |
| T1 identity compare command | 3 |
| Existing hook tests (`planning-phase-hook`, `protocol-event-hook`) | 2 |
| Existing correction/referee/tolerance tests | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |

**DoD rows.**

| Claim | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| T2-C1 | PENDING | not-checked | Facilitator interface/default implementation exists; all six phase-advancement decisions flow through it. |
| T2-C2 | PENDING | not-checked | No advancement/tolerance rule, legal-action set, timeout, transcript text, or prompt behavior changed. |
| T2-C3 | PENDING | not-checked | Focused tests cover all six transition sites and the default transition sequence. |
| T2-C4 | PENDING | not-checked | T1 identity compare is identical on committed baselines. |
| T2-C5 | PENDING | not-checked | `npx tsc -b` exits 0; `npm test` green; no existing test weakened or rewritten. |
| T2-C6 | PENDING | not-checked | Scope fence clean by `git diff --stat`; zero LLM calls. |

## M14-T3 - Emission Unification (BL-008 Residual)

**Goal.** Unify protocol state-change emission behind one internal mechanism at the Facilitator boundary while
preserving the existing observer surfaces exactly: `onPhaseChange` and `onProtocolEvent` payloads, ordering, and
best-effort swallow behavior remain consumer-identical.

**Allowed surfaces.**

- `packages/runtime-core/src/registry/team-coordinator.ts`
- The M14 facilitator module created in T2
- Additive assertions/new tests under `packages/runtime-core/src/registry/__tests__/`
- M14 identity harness/baselines only to compare the observable stream
- This ledger.

**Forbidden surfaces.** `registry.ts`, `mcp-tools.ts`, contracts, DiagramTalk bridge/client code, shared
recording/playback infra, existing hook-test rewrites, any consumer-visible shape/order change.

**Required preservation points.**

- `onPhaseChange` still receives `{ taskId, phase, previous }`.
- `onProtocolEvent` still receives `{ taskId, kind, phase?, agentId?, reason? }`.
- Ordering remains pinned, especially `endorsed` before `submittal_pending`.
- Hook exceptions remain swallowed and logged; visualization cannot perturb the protocol brain.
- `registry.ts` continues to re-emit the same shapes as `team_planning_phase` and `team_protocol_event` without
  modification.

**Implementation notes.**

- This task is intentionally separate because it is behavior-adjacent. Keep the internal mechanism simple and
  adapter-based.
- If preserving both observer shapes exactly makes "one internal mechanism" awkward, preserve behavior and stop for
  reviewer/PO direction rather than changing the public shapes.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Focused emission/hook tests | 3 |
| T1 identity compare command | 3 |
| Existing hook tests (`planning-phase-hook`, `protocol-event-hook`) | 2 |
| Existing correction/referee/tolerance tests | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |

**DoD rows.**

| Claim | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| T3-C1 | PENDING | not-checked | One internal emission mechanism exists at/behind the Facilitator boundary. |
| T3-C2 | PENDING | not-checked | `onPhaseChange` payload shape and best-effort swallow behavior are preserved exactly. |
| T3-C3 | PENDING | not-checked | `onProtocolEvent` payload shape and best-effort swallow behavior are preserved exactly. |
| T3-C4 | PENDING | not-checked | Event ordering is preserved, including `endorsed` before `submittal_pending`; T1 identity compare is identical. |
| T3-C5 | PENDING | not-checked | `registry.ts`, DiagramTalk bridge/client code, MCP contracts, and shared recording/playback infra untouched. |
| T3-C6 | PENDING | not-checked | `npx tsc -b` exits 0; `npm test` green; no existing test weakened or rewritten; zero LLM calls. |

## Reviewer Gate 1 — **APPROVED ✅** (Claude, reviewer + architect dual-hat declared, 2026-07-02)

Checked by verifying against the repo, not by reading the breakdown alone:

- **Six-site enumeration VERIFIED against the code** (reviewer-run, `sed` on the exact ranges): 356
  `protocol_ack_pending` · 1052 `fact_collection` · 1127 `discussion` (initial) · 851 `discussion`
  (fallback — clears regression retries + pending proposal) · 773 `proposal_pending_endorsement` · 689
  `submittal_pending`. The T3-C4 ordering pin (`endorsed` before `submittal_pending`) is real and
  comment-documented at 684–689. Observer payload shapes in T3's preservation points match the hook
  signatures (`team-coordinator.ts:45`, `:54`).
- **Task sequence dependency-correct:** T1-first with a reviewer check on baselines before T2; T3 own-gated
  after T2 per the accepted planner condition. The T2 guard "a true diff is a blocker, not a baseline
  refresh" is exactly the anti-gaming clause this bar needs — noted approvingly.
- **DoD rows are independently verifiable** and jointly cover plan C1–C5 with no gap (C1→T2-C1; C2→T2-C2/C5;
  C3→T1 rows+T2-C3/C4; C4→T3 rows; C5→per-task fence rows).
- **Budgets are per-check and pre-registered** (full suite max 1 per task — good anti-thrash), per ⛔ Rule 7.
- **Scope fences match the plan** with one exception, **reviewer-aligned at this gate (declared fix):** T1's
  baseline location said "`design/` or `scripts/`"; the plan fence pins both harness and baselines to
  `scripts/`. Ledger line corrected to `scripts/` only — zero-risk doc alignment, no other edit made.
- **Noted for closure (not a task):** epic closure (BL-011 → done, plan status, logbook, closure telemetry)
  rides T3's merge per the workflow — recording it here so it doesn't vanish.

**Implementation may start: M14-T1, implementer Gemini.** Baseline at gate time: tsc 0, suite 269/269
(reviewer-run this session). Known unrelated work-tree item: the un-gated `/api/hermes/status` edit in
`apps/orchestrator/src/server.ts` awaits PO disposition — it is NOT part of M14 and must not ride any M14
branch or commit.
