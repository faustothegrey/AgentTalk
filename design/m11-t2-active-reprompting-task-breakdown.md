# M11-T2 Task Breakdown - active re-prompting with richer tolerance

> **Status:** drafted for reviewer gate 1; not approved for implementation yet.
> **Milestone source:** `design/milestone11-consensus-robustness-plan.md` section M11-T2.
> **Branch:** `m11-t2-active-reprompting`.
> **Grounded on:** `master` `b91c622` (2026-07-01). Implementer must re-check line numbers on the task branch before editing.

## 1. Scope Lock

M11-T2 changes only the bounded correction prompt for phase-illegal planning actions. It must not change the legal
consensus state machine, the retry budget, peer-safe eject semantics, wire contracts, MCP tool definitions, or late
post-planning no-op behavior.

Allowed behavior change:

```text
illegal current-phase planning action -> correction prompt names the rejected action, current phase when known,
legal actions, and one concrete instruction to resend via consensus_respond(action, payload)
```

Required preservation:

```text
MAX_REGRESSION_RETRIES remains 2
valid corrected action is accepted without eject
repeated non-compliance still peer-safe ejects only the offender
legal happy-path consensus remains green
```

Out of scope:

- T3 wire-contract surfaces and any contract/client file.
- `ejectPlanner` semantics in `packages/runtime-core/src/registry/team-coordinator.ts:1623-1692`.
- Post-planning late-message no-op behavior in `packages/runtime-core/src/registry/team-coordinator.ts:975-1185`.
- Any change that makes old standalone planning MCP tools legal again.
- Any change to phase transition policy, discussion turn limits, proposal fallback, or watchdog policy.

## 2. Edit Surfaces

### Coordinator validation context

- `packages/runtime-core/src/registry/team-coordinator.ts:1910-1963`
  - Keep the authoritative expected set lookup at `:1916`.
  - Inside the illegal-action branch at `:1921-1953`, derive the current phase with `getPlanningPhase(taskId)`.
  - Pass richer context to the correction prompt: rejected action, expected action set, phase, and attempt number.
  - Preserve `MAX_REGRESSION_RETRIES = 2` behavior. Do not change `retryCount < MAX_REGRESSION_RETRIES`, retry-key shape, retry clearing, or the call to `ejectPlanner`.
  - Do not alter successful validation at `:1956-1962`.

DoD:
- Illegal forward/lateral actions still return `false` from validation and only enqueue a correction while under budget.
- Budget exhaustion still calls `ejectPlanner(senderAgentId, reason)` and returns `false`.
- Advancing legal actions still clear retries exactly as before.

### Coordinator correction prompt text

- `packages/runtime-core/src/registry/team-coordinator.ts:1981-2064`
  - Update `askProtocolCorrection` at `:2030-2064` to build the richer prompt.
  - Required content in the prompt:
    - rejected action, for example `submit_plan`;
    - current phase when available, for example `discussion`;
    - legal action set, for example `[opinion, agreement_proposal]`;
    - one concrete resend instruction using the M11-T1 vocabulary, for example:
      `Resend by calling consensus_respond with action set to one of [opinion, agreement_proposal] and payload matching that action.`
  - Do not include correction wording that tells the agent to use a removed standalone MCP tool.
  - Avoid reusing `MESSAGE_TYPE_MOTIVATION_REQUIREMENT` in this correction if it keeps the old `message_type` wording.
  - Keep transcript recording, `emitTeamTask`, and `sendProtocol(... type: 'message_received' ...)` behavior unchanged.
  - `askRegressionConfirmation` at `:1981-2021` may be edited only to keep vocabulary consistent. Preserve the current confirmation semantics: a confirmed regression still exhausts through the existing budget/eject path, not a new policy.

DoD:
- The system transcript entry and delivered protocol message carry identical correction text.
- The prompt is actionable without requiring the model to infer the legal action names from prior context.
- No new state is introduced outside the current retry maps and phase/expected readers.

### Phase label helper

- `packages/runtime-core/src/registry/team-coordinator.ts:936-960`
  - Read-only unless prompt formatting needs a stable phase label helper.
  - If a helper is needed, keep it local and deterministic: no phase mutation, no new fallback inference, no behavior change.
- `packages/runtime-core/src/registry/team-coordinator.ts:2074-2077`
  - Read-only unless a small prompt-format helper belongs next to existing phase helpers.

DoD:
- `getPlanningPhase` inference remains unchanged.
- Any helper is pure formatting only and is covered by the focused correction test.

### Tests

Prefer a new focused adjacent file:

- `packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts` (new)
  - Reuse the hermetic `child_process` and `fs.existsSync` mocks from
    `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:4-19` if the test uses MCP agents.
  - Set up a `Registry`, two MCP planners, one worker, and a planner-planner-worker team.
  - Drive the task deterministically to discussion:
    - `assignTeamTask(...)`;
    - both planners call `consensus_respond({ action: 'ack_planning_protocol', payload: {} })`;
    - both planners call `consensus_respond({ action: 'fact_collection_end', payload: { summary: 'facts' } })`.
  - Use `registry.on('team_task', ...)` to retain the latest emitted task and inspect the transcript.

Alternative if the new file would duplicate too much setup:

- `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:33-139`
  - Add narrowly focused `it(...)` blocks after the existing full-flow test.
  - Do not change the existing happy-path test's assertions except for local helper extraction needed to reduce duplication.

DoD:
- Tests are deterministic and do not launch real agents or create real worktrees.
- Tests inspect task transcript/status rather than private coordinator fields.
- The existing full mocked consensus path remains a regression check, not the only evidence.

## 3. DoD Claim Rows

| Row | Claim | Implementation evidence | Reviewer evidence |
|-----|-------|-------------------------|-------------------|
| D1 | Correction message includes rejected action, current phase when available, legal action set, and one concrete resend instruction using `consensus_respond(action, payload)`. | Focused test asserts correction transcript/protocol text contains `submit_plan`, `discussion`, `[opinion, agreement_proposal]`, `consensus_respond`, `action`, and `payload`. | Reviewer reruns focused test and reads `team-coordinator.ts:2030-2064`. |
| D2 | Illegal first action followed by valid corrected action is accepted within one correction, with no eject. | Focused test sends illegal `submit_plan` in discussion, then legal `opinion`; task stays `planning` and transcript has no `ejected` entry. | Reviewer reruns focused test and checks no offender shutdown/eject event is observed. |
| D3 | Repeated non-compliance still reaches peer-safe eject after the retry budget. | Focused test sends illegal `submit_plan` through attempts 1, 2, and budget exhaustion; task becomes `awaiting_operator`, transcript names offender ejection, surviving planner is not killed. | Reviewer reruns focused test and reads `team-coordinator.ts:1623-1692` only to confirm it was not edited. |
| D4 | Legal happy-path consensus behavior is unchanged. | Existing mocked MCP consensus test remains green. | Reviewer reruns the happy-path test and confirms no unrelated coordinator surfaces changed. |
| D5 | Typecheck, full suite, and pollution gates pass. | `tsc -b`, `npm test`, `git diff --stat`, `git status --short --branch`. | Reviewer reruns gates before merge. |

## 4. Sequencing

### Step A - Preflight inventory

Tasks:
- Create branch `m11-t2-active-reprompting`.
- Re-check current line numbers and confirm tracked worktree cleanliness.
- Search for correction/eject surfaces before editing.

Commands:

```bash
git switch -c m11-t2-active-reprompting
git status --short --branch
rg -n "MAX_REGRESSION_RETRIES|askProtocolCorrection|askRegressionConfirmation|ejectPlanner|consensus_respond|message_type" packages/runtime-core/src/registry/team-coordinator.ts packages/runtime-core/src/registry/__tests__ -S
```

DoD:
- Branch exists and starts clean.
- Implementer has confirmed no unexpected correction/eject tests already exist.
- Any extra production surface needed outside section 2 is reported before editing.

### Step B - Prompt context and formatting

Tasks:
- Pass phase/expected context from `validateProtocolStep` to `askProtocolCorrection`.
- Update prompt text with the required M11-T1 action vocabulary.
- Touch `askRegressionConfirmation` only if needed for vocabulary consistency.

Smoke check:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts
```

DoD:
- Focused prompt assertion fails before the code edit and passes after it.
- No retry/eject code is edited except for argument plumbing.

### Step C - Focused correction/eject tests

Tasks:
- Add deterministic correction-then-acceptance test.
- Add deterministic repeated-non-compliance eject preservation test.
- If setup helpers are extracted from `team-mcp-consensus.test.ts`, keep them inside registry tests and avoid shared production helpers.

Commands:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts
npx vitest run packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts
```

DoD:
- Illegal first action produces exactly one correction before the corrected legal action is accepted.
- Repeated illegal action exhausts the existing budget and peer-safe ejects.
- Existing mocked MCP happy path remains green.

### Step D - Regression gates and docs

Tasks:
- Run typecheck and full suite.
- Update `design/milestone11-consensus-robustness-implementation.md` with implementer claims, exact commands, and telemetry.
- Do not mark VERIFIED; reviewer owns verdicts.

Commands:

```bash
tsc -b
npm test
git diff --stat
git status --short --branch
node scripts/usage.mjs
```

DoD:
- Typecheck and suite are green or failures are reported honestly with exact output.
- Diff is limited to scoped coordinator/test/docs files.
- Ledger has task claims and telemetry block.

### Step E - Optional live observation

Run only after deterministic gates are green and only if budget/provider availability is acceptable:

```bash
node scripts/usage.mjs
MCP_GATE_PROVIDER=<available-provider> node scripts/test-live-gate.mjs
```

DoD:
- This is observation, not the bug-localizing gate.
- If the provider is unavailable, quota-bound, or inconclusive, record that fact and do not alter production behavior to satisfy a live run.

## 5. Retry Budgets

| Check | Command | Max attempts | Stop condition |
|-------|---------|--------------|----------------|
| Focused correction prompt test | `npx vitest run packages/runtime-core/src/registry/__tests__/team-protocol-correction.test.ts` | 3 | Stop after attempt 3 and report the failing assertion/output. |
| Focused correction-then-valid acceptance test | Same focused file | 3 | Stop after attempt 3; do not alter coordinator state semantics to make it pass. |
| Focused repeated non-compliance/eject test | Same focused file | 2 | Stop after attempt 2; do not edit `ejectPlanner` or retry budget semantics. |
| Happy-path MCP consensus regression | `npx vitest run packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 2 | Stop after attempt 2; no broad harness rewrite. |
| TypeScript build | `tsc -b` | 2 | Stop after attempt 2 and report diagnostics. |
| Full suite | `npm test` | 2 | Stop after attempt 2 and report the failing test(s). |
| Live weak-model observation | `MCP_GATE_PROVIDER=<available-provider> node scripts/test-live-gate.mjs` | 1 | Record the observation; do not change the bar or widen scope for a live-model miss. |

One attempt means one run of the named check plus one in-scope fix. A show-stopper fence beats the attempt budget:
if passing a check appears to require changing wire contracts, `ejectPlanner`, late-message no-op behavior, retry
budget, or legal happy-path semantics, stop and report before making that change.

## 6. Reviewer Gate 1 Checklist

- Exact production edit scope is limited to `team-coordinator.ts:1910-1963`, `:1981-2064`, and optional pure helper formatting around `:936-960` or `:2074-2077`.
- Test scope is a focused adjacent registry test plus the existing mocked MCP consensus regression.
- DoD rows cover richer prompt content, one-correction recovery, peer-safe eject preservation, happy path preservation, and gates.
- Retry budgets are per check and include clear stop conditions.
- No M11-T3 wire/referee work is included.
