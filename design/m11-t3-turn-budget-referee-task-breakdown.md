# M11-T3 Task Breakdown - turn-budget referee

> **Status:** drafted for reviewer gate 1; not approved for implementation yet.
> **Milestone source:** `design/milestone11-consensus-robustness-plan.md` section M11-T3.
> **Branch:** `m11-t3-turn-budget-referee`.
> **Grounded on:** `master` `6038b12` (2026-07-01). Implementer must re-check line numbers on the task branch before editing.

## 1. Scope Lock

M11-T3 bounds legal-but-non-converging discussion loops. The only approved behavior change is:

```text
MAX_DISCUSSION_TURNS legal discussion actions without agreement/submittal
  -> clean planning interruption/referee outcome
```

Referee policy v1 is fail/interruption only. Do not force a proposal, auto-submit a plan, pick a winner, continue with
one planner, or change consensus semantics.

Out of scope:

- Wire-contract surfaces from M11-T1 and any MCP/client contract files.
- `ejectPlanner` semantics and peer-safe ejection behavior.
- Post-planning late-message no-op behavior.
- Force-advance semantics.
- Changes to legal happy-path agreement/proposal/submittal ordering.

## 2. Edit Surfaces

### Constants and state

- `packages/runtime-core/src/registry/team-coordinator.ts:72-86`
  - Add `MAX_DISCUSSION_TURNS = 6` near existing coordinator policy constants.
  - Keep `MAX_REGRESSION_RETRIES = 2`, `MAX_URGENCY_IGNORES`, and agreement/fact-collection constants unchanged.
- `packages/runtime-core/src/registry/team-coordinator.ts:141-152`
  - Add per-task discussion budget state, preferably one small map keyed by task id.
  - The state must be task-local, cleared on terminal/cleanup paths, and not persisted beyond the task.

DoD:
- The limit is a named constant, not an inline number in tests or production logic.
- New state has no cross-task leakage.

### Budget initialization and reset

- `packages/runtime-core/src/registry/team-coordinator.ts:315-360`
  - Do not start counting during protocol ack or fact collection.
  - Optionally clear stale discussion budget state when a new multi-planner task is created.
- `packages/runtime-core/src/registry/team-coordinator.ts:1055-1138`
  - Initialize/reset the discussion budget when all planners complete fact collection and discussion opens at
    `:1105-1107`.
  - The first `conversation_start` event at `:1112-1133` must still be delivered; the budget starts before legal
    discussion actions are accepted, not before discussion exists.
- `packages/runtime-core/src/registry/team-coordinator.ts:824-880`
  - Reset/re-arm the discussion budget when agreement fallback returns to discussion at `:846-849`.
  - This reset is required because fallback begins a new discussion cycle; do not count the prior proposal/endorsement
    cycle against the reopened discussion.

DoD:
- Discussion budget exists only while the task is in a discussion phase.
- Returning from endorsement fallback to discussion gives that new discussion cycle a full budget.
- No state is initialized for worker-only, single-planner, ack, fact-collection, endorsement, or submittal phases.

### Counting and referee interruption

Read-only context only:
- `packages/runtime-core/src/registry/team-coordinator.ts:419-523`
  - `opinion` already calls `validateProtocolStep(...)` at `:458` before peer routing at `:475-499`.
  - Do not edit this range unless reviewer/PO explicitly expands scope.
- `packages/runtime-core/src/registry/team-coordinator.ts:525-600`
  - `agreement_proposal` already calls `validateProtocolStep(...)` at `:567` before proposal state changes and
    `requestAgreementReached(...)` at `:600`.
  - Do not edit this range unless reviewer/PO explicitly expands scope.

Approved edit surfaces:
- `packages/runtime-core/src/registry/team-coordinator.ts:615-880`
  - Do not count `agreement_acceptance` as a discussion action.
  - Keep existing agreement non-compliance and fallback timers/limits unchanged except for discussion-budget reset on
    fallback to discussion.
- `packages/runtime-core/src/registry/team-coordinator.ts:1910-1963`
  - Required location for shared legal-action gating.
  - Count only legal discussion actions: `opinion` and `agreement_proposal` while `getPlanningPhase(taskId) === 'discussion'`.
  - Do not count illegal actions, correction prompts, regression confirmations, `agreement_acceptance`, `submit_plan`,
    `fact_collection_end`, or `ack_planning_protocol`.
  - Budget exhaustion must cause `validateProtocolStep(...)` to return `false`. That existing return value already
    short-circuits `handlePlanningMessage` before peer routing at `:475-499` and `handleAgreementProposal` before
    proposal state/endorsement at `:571-600`, without editing those read-only ranges.

Referee interruption:
- Reuse the existing planning interruption path rather than adding a new terminal state.
- The transcript and planner notification must name the exhausted budget, e.g. `discussion turn budget exhausted
  (6/6)`.
- The implementation may add a small wrapper/helper around `interruptPlanningForMissingEvents` if needed for the
  budget-specific wording, but it must preserve the same terminal shape: task/team interrupted, planning watchdogs
  cleared, current task detached, planning run persisted, planners notified/shutdown requested.

DoD:
- The sixth legal discussion action triggers the interruption.
- The sixth action itself is not routed to a peer if it is the action that exhausts the budget.
- A seventh discussion action is impossible to route because the task/team is no longer in active planning.
- Existing correction/eject behavior remains unchanged.

### Cleanup surfaces

- `packages/runtime-core/src/registry/team-coordinator.ts:1208-1216`
  - Clear new discussion budget state when a plan is submitted and planning completes.
- `packages/runtime-core/src/registry/team-coordinator.ts:1320-1324`
  - Clear/reset new discussion budget state when a submitted plan is rejected and planning returns to revision.
  - If this path re-enters active planning without fact collection, either reinitialize the budget deliberately or stop
    and report if that behavior is ambiguous. Do not silently leave stale counts.
- `packages/runtime-core/src/registry/team-coordinator.ts:1694-1718`
  - Clear new discussion budget state when an agent is removed from a team with an active task.
- `packages/runtime-core/src/registry/team-coordinator.ts:1847-1860`
  - Clear new discussion budget state on all planning interruption paths, including the new referee interruption.

DoD:
- No new budget map entry remains after interruption, plan submission, plan rejection, or active-task agent removal.
- Cleanup does not weaken existing watchdog/agreement/fact-collection cleanup.

## 3. Tests and Harnesses

### Focused deterministic referee test

Prefer a new adjacent file:

- `packages/runtime-core/src/registry/__tests__/team-discussion-budget.test.ts` (new)
  - Reuse hermetic `child_process` and `fs.existsSync` mocks from
    `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:4-19` if using MCP agents.
  - Drive a planner-planner-worker task deterministically to discussion:
    - `assignTeamTask(...)`;
    - both planners acknowledge protocol;
    - both planners complete fact collection.
  - Send legal non-converging `opinion` actions alternately until the budget boundary.
  - Assert:
    - actions 1 through 5 are routed to the peer;
    - action 6 records a budget-exhausted referee transcript and interrupts planning;
    - no sixth action is delivered to the peer as a normal `message_received`;
    - a later attempted discussion action is not routed because planning is no longer active.

Additional focused cleanup checks in the same file:
- Plan-submission cleanup: drive a happy path to `submit_plan`, then assert no lingering budget state through public
  behavior. If private state is not observable, use a same-task post-completion late-message attempt and assert existing
  late no-op behavior still wins.
- Interruption cleanup: after referee interruption, assert repeated/late discussion does not re-trigger budget logic or
  peer delivery.
- Agent-removal cleanup: remove an agent during an active discussion task and assert no follow-on budget action fires.

Do not add production test-only accessors unless reviewer/PO explicitly approves. Prefer public behavior, transcript,
status, and delivered protocol events.

### Happy-path consensus regression

- `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:33-140`
  - Keep the existing happy path green.
  - Edit only if the mocked planners need to submit before the new discussion budget; the current path should remain
    under six discussion actions.

### Live referee observation

Add a task-specific live harness or a flag/sibling of the existing live gate:

- Preferred new script: `scripts/test-live-referee-gate.mjs`
  - It may reuse setup/cleanup structure from `scripts/test-live-gate.mjs:12-131`.
  - It must run after `tsc -b` because live scripts import built `dist` files.
  - Required command:

```bash
MCP_GATE_PROVIDER=<available-provider> node scripts/test-live-referee-gate.mjs
```

Live observation goal:
- Start a real multi-planner round that strongly instructs planners to keep responding with legal `opinion` actions and
  not propose agreement.
- Observe either:
  - referee interruption with transcript/status evidence, or
  - provider/quota/model non-compliance, recorded honestly as an observation that does not replace deterministic tests.

DoD:
- The script kills external harness processes and cleans any new worktrees/branches, following the existing live gate
  cleanup pattern.
- Exactly one available fit provider is used.
- If no provider/quota is available, stop and request reviewer/PO deferral rather than changing the implementation bar.

## 4. DoD Claim Rows

| Row | Claim | Implementation evidence | Reviewer evidence |
|-----|-------|-------------------------|-------------------|
| D1 | At exactly `MAX_DISCUSSION_TURNS` non-converging legal discussion actions, planning transitions to an interrupted/referee outcome with a transcript entry naming the exhausted budget. | Focused deterministic test drives six legal `opinion` actions and asserts status/transcript. | Reviewer reruns focused test and reads coordinator budget helper/interruption path. |
| D2 | No `MAX_DISCUSSION_TURNS + 1` discussion action is routed to a peer after interruption. | Focused test counts delivered peer messages and asserts the boundary action/later action are not delivered. | Reviewer reruns focused test and checks sendProtocol observations. |
| D3 | Happy-path consensus still reaches `submit_plan` before the budget. | Existing mocked MCP consensus test remains green. | Reviewer reruns `team-mcp-consensus.test.ts`. |
| D4 | New budget state is cleared on every existing terminal/cleanup path. | Focused cleanup tests or public-behavior assertions cover interruption, plan submission, rejection/revision, and agent removal. | Reviewer reruns focused cleanup coverage and reads cleanup lines. |
| D5 | Required live observation is recorded in the ledger. | Live referee gate run or explicit reviewer/PO deferral note with provider/budget reason. | Reviewer checks command/output and ledger entry. |
| D6 | Typecheck, full suite, and pollution gates pass. | `tsc -b`, `npm test`, `git diff --stat`, `git status --short --branch`, `git worktree list --porcelain`. | Reviewer reruns gates before merge. |

## 5. Sequencing

### Step A - Preflight

Commands:

```bash
git switch -c m11-t3-turn-budget-referee
git status --short --branch
rg -n "MAX_DISCUSSION|discussion|interruptPlanningForMissingEvents|handlePlanningMessage|handleAgreementProposal|handleAgreementReachedFallbackToDiscussion|taskExpectedResponses|planningPhases" packages/runtime-core/src/registry/team-coordinator.ts packages/runtime-core/src/registry/__tests__ scripts -S
```

DoD:
- Branch exists and starts clean.
- Implementer confirms current line numbers and no existing turn-budget helper already exists.
- Any required surface outside section 2 is reported before editing.

### Step B - State and helper

Tasks:
- Add `MAX_DISCUSSION_TURNS = 6`.
- Add task-local budget state and pure helpers for initialization/reset/count/clear.
- Add budget-specific interruption helper only if existing `interruptPlanningForMissingEvents` cannot produce required
  transcript wording without muddying other missing-event messages.

Smoke:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-discussion-budget.test.ts
```

DoD:
- Boundary test can observe the budget interruption.
- Existing interruption shape is preserved.

### Step C - Counting integration

Tasks:
- Initialize budget when discussion starts after fact collection.
- Reset budget when fallback returns to discussion.
- Count legal `opinion` and `agreement_proposal` actions in the approved validation path.
- Stop routing by making budget exhaustion return `false` from `validateProtocolStep(...)`.

Commands:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-discussion-budget.test.ts
npx vitest run packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts
```

DoD:
- D1/D2 pass.
- M11-T2 correction/eject behavior remains green.

### Step D - Cleanup and regressions

Tasks:
- Clear budget state in all listed cleanup paths.
- Add focused cleanup coverage.
- Keep mocked MCP happy path under budget.

Commands:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-discussion-budget.test.ts
npx vitest run packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts
```

DoD:
- D3/D4 pass.
- No unrelated harness rewrite.

### Step E - Build, suite, live observation, ledger

Commands:

```bash
tsc -b
npm test
MCP_GATE_PROVIDER=<available-provider> node scripts/test-live-referee-gate.mjs
git diff --stat
git status --short --branch
git worktree list --porcelain
node scripts/usage.mjs
```

DoD:
- Typecheck and full suite are green or exact failures are reported.
- Live observation or explicit deferral is recorded in `design/milestone11-consensus-robustness-implementation.md`.
- Diff is limited to scoped coordinator/test/script/docs files.

## 6. Retry Budgets

| Check | Command | Max attempts | Stop condition |
|-------|---------|--------------|----------------|
| Focused referee boundary test | `npx vitest run packages/runtime-core/src/registry/__tests__/team-discussion-budget.test.ts` | 3 | Stop after attempt 3 and report failing assertion/output. |
| Cleanup coverage in focused file | Same focused file | 3 | Stop after attempt 3; do not add test-only production accessors without approval. |
| M11-T2 correction regression | `npx vitest run packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts` | 2 | Stop after attempt 2; do not change retry/eject semantics. |
| Happy-path MCP consensus regression | `npx vitest run packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 2 | Stop after attempt 2; do not broaden consensus semantics. |
| TypeScript build | `tsc -b` | 2 | Stop after attempt 2 and report diagnostics. |
| Full suite | `npm test` | 2 | Stop after attempt 2 and report failing tests. |
| Required live referee observation | `MCP_GATE_PROVIDER=<available-provider> node scripts/test-live-referee-gate.mjs` | 1 | Record the result; provider/quota/model miss is a deferral/observation, not a reason to reshape deterministic behavior. |

One attempt means one run of the named check plus one in-scope fix. The show-stopper fence beats the retry budget:
stop before changing wire contracts, `ejectPlanner`, late-message no-op behavior, force-advance semantics, or legal
happy-path consensus ordering.

## 7. Reviewer Gate 1 Checklist

- Production scope is limited to `team-coordinator.ts` ranges named in section 2.
- Tests are focused, deterministic, and use public behavior/transcript/status where possible.
- Live observation is required after deterministic gates, with one provider attempt or explicit reviewer/PO deferral.
- DoD rows cover boundary interruption, no extra routed action, happy path, cleanup, live observation, and gates.
- Retry budgets are per check and include stop conditions.
