# M14 - Facilitator Extraction (Arbiter Epic 1) - Implementation Ledger

> **Status:** 🟢 **OPEN — M14-T1 VERIFIED ✅ (reviewer, round 2, 2026-07-02) on `m14-t1-identity-harness`;
> merge awaits `[Human]` per the Origin Tag Protocol. On merge: M14-T2 opens (facilitator extraction,
> implementer Gemini). Gate 1 APPROVED ✅ 2026-07-02.**
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
| T1-C1 | **NOT FILED** (handoff arrived via SM message only) | **VERIFIED ✅** (reviewer-run) | `scripts/m14-identity-harness.mjs` + baselines, branch `m14-t1-identity-harness` (`a1b0bf7`), file list fence-clean (3 files, all `scripts/`); recording/playback infra untouched. Harness monkey-patches `execSync`/`existsSync` locally — harness-level mocking, not shared-infra change; applies identically pre/post refactor. |
| T1-C2 | NOT FILED | **VERIFIED ✅** (reviewer-run) | Both baselines carry task status, `planningComplete`, transcript kind/from/to/payload/messageType, plan field, and both `team_planning_phase` + `team_protocol_event` streams. Volatile-leak probe clean (no un-normalized `task-`/`team-` ids). Deterministic: 3 consecutive reviewer `--check` runs all pass. |
| T1-C3 | NOT FILED | **REFUTED ❌** (reviewer-run, content signature) | The "success" baseline is **not a success**: full phase spine, then `correction,correction,eject` → final status `awaiting_operator`, `planningComplete:false`, **no plan**. `mockSuccess`'s submit-plan trigger never fires, so planner-a goes phase-illegal at `submittal_pending` and is ejected. Corpus = two failure-class streams, **zero successful consensus**. (The failure baseline itself is valid: correction×2 → eject.) |
| T1-C4 | NOT FILED | **PARTIAL ⚠️** (reviewer-run) | Command exists and behaves: `node scripts/m14-identity-harness.mjs --check` exits 0 on match; reviewer negative test (perturbed copy, restored from backup byte-identical) exits **1**. But "documented" is unmet — the command is written down nowhere (no README/ledger/claim line). |
| T1-C5 | NOT FILED | **VERIFIED ✅** (reviewer-run) | `npx tsc -b` exit 0; `npm test` **269/269** on the branch; `git diff --check` clean; single worktree; no stray harness processes. |

### Reviewer Gate 2 record — M14-T1: **REFUTED ❌, stays on branch** (Claude, reviewer + architect dual-hat declared, 2026-07-02)

**What passed:** the harness itself is sound — right shape (in-process registry, listeners on both hooks,
normalization verified leak-free), deterministic across three reviewer runs, `--check` proven to fail on
mismatch by negative test, suite green, fence-clean. T1-C1/C2/C5 VERIFIED.

**Why refuted:** T1-C3 — the corpus contains **no successful consensus**. The success mock's trigger
(`prompt.includes('One planner must call submit_plan')`) never matches the actual submittal prompt, so the
"success" run ends in ejection/`awaiting_operator` with no plan. This is the artifact-count-vs-content-signature
trap (IP-9 class): two committed baselines exist, but one records the wrong class.

**Required for re-delivery (in-scope, on the same branch):**
1. Fix `mockSuccess` so the scenario completes: final `team_task_update` must show a completed/planning-complete
   state with a non-null plan (that is the content signature the re-review will check first).
2. Regenerate both baselines; keep determinism (re-run `--check` ≥2×).
3. **Consider keeping the current eject-rich stream as a third baseline** (`failure-submittal-eject`?) — it
   exercises `endorsed` + corrections at `submittal_pending`, which the plain failure stream does not. Optional,
   in-scope, implementer's call.
4. Add the one-line command documentation (T1-C4) — the ledger's T1 section is an acceptable home.
5. **File implementer claims in this ledger with command output** — this round's claims column reads NOT FILED;
   the handoff arrived only as an SM chat message. Recorded as **IP-11** in `design/implementer-pitfalls.md`.

**Hygiene note:** the shared repo was left checked out on the task branch; reviewer returned it to `master`.

**Telemetry (gate, not closure):**
- task:        M14-T1 (round 1), reviewer gate
- wall-clock:  2026-07-02 ~13:05 → ~13:25
- budget:      claude weekly ~14%, session ~55% at gate end [per /usage; approximate]
- gate:        tsc 0, suite 269/269, pollution clean, negative test run
- outcome:     REFUTED ❌ — back to implementer on `m14-t1-identity-harness`

### Reviewer Gate 2 record — round 2: **VERIFIED ✅, merge awaits `[Human]`** (Claude, reviewer + architect dual-hat declared, 2026-07-02)

Fix commit `c6ee2c7` re-reviewed, everything reviewer-run on the branch:

- **T1-C3 flips to VERIFIED ✅:** success baseline signature now exact — full spine
  (`protocol_ack_pending>fact_collection>discussion>proposal_pending_endorsement>submittal_pending`),
  protocol events = `endorsed` only, final `completed`, `planningComplete: true`, plan non-null. Failure
  baseline unchanged and valid (`correction,correction,eject` → `awaiting_operator`). The root-cause fix is
  real: corrected submittal trigger (`advanced to "submit_plan"`) + the harness plays operator via
  `confirmPlan` on `awaiting_confirmation` — legitimate harness behaviour, deterministic.
- **T1-C4 flips to VERIFIED ✅:** command documented in the branch ledger's claim row (the home the round-1
  record offered); compare logic untouched by the fix diff, so the round-1 negative test (perturbed
  baseline → exit 1) stands as evidence.
- **Re-verified this round:** determinism 3/3 `--check`; volatile-leak probe clean (ids + ISO dates);
  `npx tsc -b` exit 0; `npm test` **269/269**; `c6ee2c7` file list fence-clean (harness + success baseline +
  branch ledger only).
- **Claims filed this round on the branch ledger** (IP-11 answered). All five DoD rows are now VERIFIED —
  the round-1 verdicts above stand for C1/C2/C5; this record supersedes C3/C4.
- **Nits (recorded, non-blocking):** leftover debug `console.log`s in `mockSuccess` (harmless — console
  output is not captured in baselines); the optional third eject-rich baseline was not kept (was optional);
  the repo was again left checked out on the task branch (reviewer returned it to `master` again).
  **Merge note:** the branch's ledger copy is stale (pre-refutation) — the merge must keep master's gate
  records and fold the branch's claim-row text in.
- **Implementer signals disposed (symmetry):** all six fix-round points accepted; point 4 ("eject-rich
  failure-stream naturally captured") read as referring to the existing valid failure stream — accepted.

**Merge NOT performed** — reserved to `[Human]` per the Origin Tag Protocol. On the PO's go the reviewer
merges `m14-t1-identity-harness` (resolving the ledger in master's favour), and **M14-T2 opens**.

**Telemetry (task closure, pending merge):**
- task:        M14-T1 (rounds 1–2)
- wall-clock:  2026-07-02 ~12:50 → ~16:10 (two review rounds + implementer fix round)
- budget:      claude weekly ~14%→~15%, session ~55%→~65% [per /usage; approximate]
- gate:        tsc 0, suite 269/269, determinism 3/3, negative test exit 1 (round 1), pollution clean
- diff:        branch: 2 commits (`a1b0bf7`, `c6ee2c7`); 3 files at branch HEAD
- outcome:     VERIFIED ✅ — merge awaits `[Human]`

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
