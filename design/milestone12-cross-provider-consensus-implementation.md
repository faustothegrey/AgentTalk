# M12 — Cross-Provider Consensus — Implementation Breakdown

> **Status:** Planner breakdown — ready for Reviewer gate 1.
> **Plan:** `design/milestone12-cross-provider-consensus-plan.md`
> **Base:** `master` at `edc6a3b` (2026-07-01).
> **Planner:** Codex. **Architect:** Claude. **PO:** Fausto.

This is the task-level handoff for M12. It starts with **M12-T2** because the timeout coupling should be fixed
before the live harness is added.

## Sequencing

Execution order:

1. **M12-T2** — Fix C1: fact-collection timeout is member-provider-aware.
2. **M12-T1** — Add the cross-provider live harness.
3. **M12-T3** — Add deterministic provider-mix invariance coverage.
4. **M12-PF** — Run a cheap Codex MCP parse/attach preflight.
5. **M12-T4** — Run and record capped live mixed-provider observations.
6. **M12-T5** — Close docs, backlog, telemetry, and calibration.

Hard rule for all implementation tasks: no opportunistic protocol, parser, MCP tool-surface, or client-repo changes.
If a live or deterministic check exposes a broader problem, report it as a finding and stop for a scope decision.

## Claim / Verdict Ledger

The implementer records **Claim** entries with command output. The reviewer records **Verdict** only after running
the relevant check.

| Task | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| M12-T2 | not-started | not-checked | Pending Reviewer gate 1. |
| M12-T1 | not-started | not-checked | Pending T2. |
| M12-T3 | not-started | not-checked | Pending T1. |
| M12-PF | not-started | not-checked | Pending T3. |
| M12-T4 | not-started | not-checked | Pending PF. |
| M12-T5 | not-started | not-checked | Pending T4. |

## M12-T2 — Member-Provider-Aware Fact-Collection Timeout

### Intent

Fix C1 from the plan: the current fact-collection timeout uses a team-level provider field, so a mixed MCP team
created with `createTeam(members)` does not get Gemini's extended window even when one planner is Gemini.

The fix must compute the timeout as:

```ts
max(this.factCollectionTimeoutMs, ...per-member required minimums)
```

Today the only special per-provider minimum is Gemini's `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`. Codex and other
providers currently require the base `this.factCollectionTimeoutMs`; do not invent a Codex-specific duration in this
task. Make the implementation extensible enough that adding one later is local.

### Exact Source Scope

Allowed runtime file:

| File | Lines at `edc6a3b` | Scope |
|---|---:|---|
| `packages/runtime-core/src/registry/team-coordinator.ts` | 28-61 | Read existing `TeamCoordinatorDeps.getAgent`; use it to inspect member agents. No dependency shape change expected. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 72-80 | Read timeout constants. Add only a tiny provider-minimum helper/table here if needed. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 130-165 | Read coordinator fields/constructor. Do not add new constructor options unless absolutely required. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 168-190 | Read `createTeam`; preserve the optional legacy `team.provider` behavior. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 1018-1024 | Replace the direct `team.provider === 'gemini'` timeout branch with the member-aware helper result. |

Allowed test file:

| File | Lines at `edc6a3b` | Scope |
|---|---:|---|
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 1-31 | Reuse existing hermetic mocks/setup style if adding the regression here. |
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 33-46 | Reuse mixed/team creation pattern; convert only in the new regression, not the existing test. |
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 96-104 | Reuse mocked MCP turn flow only if needed. Prefer a narrower fake-timer test. |

Alternative allowed test file:

| File | Scope |
|---|---|
| `packages/runtime-core/src/registry/__tests__/team-fact-collection-timeout.test.ts` | Create this file if the regression is cleaner as a focused fake-timer test. Use the same `child_process` and `fs.existsSync` mocks as the existing MCP consensus tests to preserve hermeticity. |

Out of scope for T2:

| File / area | Reason |
|---|---|
| `packages/contracts/src/types.ts` | No contract shape change is needed. |
| `packages/runtime-core/src/registry/registry.ts` | Provider-blind routing is not part of C1. |
| `packages/runtime-core/src/agents/*` | Parser/completer behavior is not part of C1. |
| `packages/contracts/wire-contract.json` | MCP wire contract must remain unchanged. |
| `scripts/*` | Harness work is T1/PF/T4, not T2. |
| `../agentalk-mcp-client/*` | Client changes are explicitly cross-repo findings, not T2. |

### Implementation Shape

Recommended minimal shape:

1. Add a private helper near the timeout constants or inside `TeamCoordinator`:

   ```ts
   private getFactCollectionTimeoutMs(team: Team): number
   ```

2. The helper should:
   - Start with `this.factCollectionTimeoutMs`.
   - Include `team.provider` as a legacy team-level hint, preserving all prior all-Gemini behavior.
   - For each `team.members` entry, call `this.deps.getAgent(member.agentId)` and inspect both:
     - `agent.providerName` for MCP-backed external model identity (`'gemini'`, `'codex'`, `'claude'`).
     - `agent.provider` for direct legacy provider identity (`'gemini'`, `'codex'`, `'claude'`).
   - Map provider identity to a required minimum:
     - `gemini` -> `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`.
     - all other current providers -> `this.factCollectionTimeoutMs`.
   - Return the maximum.

3. Replace lines 1019-1021 with:

   ```ts
   const timeoutMs = this.getFactCollectionTimeoutMs(team);
   ```

Do not change phase transitions, protocol correction behavior, parser behavior, team creation, or member validation.

### Required Regression Coverage

Use fake timers or a `setTimeout` spy so the test observes the scheduled delay without waiting real minutes.

Minimum assertions:

| Case | Setup | Expected scheduled timeout |
|---|---|---|
| Mixed MCP Gemini+Codex team, no `team.provider` | `planner-a` has `{ provider: 'mcp', providerName: 'gemini' }`; `planner-b` has `{ provider: 'mcp', providerName: 'codex' }`; `createTeam(members)` with no provider arg. | `720_000` (or `max(customBase, 720_000)` if the test sets a custom base). |
| All non-Gemini mixed MCP team, no `team.provider` | e.g. Codex+Claude planners, Gemini absent. | Base `factCollectionTimeoutMs`. |
| Legacy team-provider Gemini | `createTeam(members, 'gemini')`, even if member metadata is absent or generic. | Gemini extended timeout, preserving old behavior. |

Optional but useful:

| Case | Setup | Expected scheduled timeout |
|---|---|---|
| Custom base above Gemini default | Registry/coordinator configured with `factCollectionTimeoutMs > 720_000`, with a Gemini member. | Custom base, proving the helper uses max rather than hard-coding Gemini. |

If reaching `TeamCoordinator` options through `Registry` is awkward, instantiate `TeamCoordinator` directly in the
focused test with a minimal `deps` object. If direct construction is too coupled, use `Registry` and spy on global
`setTimeout`.

### DoD Claim Rows for M12-T2

The implementer must fill these rows in the claim section when handing off:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T2-C1 | Timeout selection is member-provider-aware and preserves legacy `team.provider` behavior. | Diff reference to `team-coordinator.ts` helper and the line replacing the old branch. |
| T2-C2 | Mixed MCP Gemini+Codex team with no `team.provider` schedules the Gemini extended timeout. | Regression test name and output from targeted Vitest run. |
| T2-C3 | Non-Gemini teams keep the base timeout. | Regression test assertion and targeted Vitest output. |
| T2-C4 | Existing all-Gemini / legacy provider behavior is preserved. | Regression test assertion and targeted Vitest output. |
| T2-C5 | No out-of-scope files changed. | `git diff --stat` and changed-file list. |
| T2-C6 | Typecheck and full suite are clean, or failure is honestly reported. | Exact final output from `tsc -b` and `npm test`. |

### Retry Budgets for M12-T2

The implementer must pre-register attempts before running each check and stop at the limit.

| Check | Command | Max attempts | Stop condition |
|---|---|---:|---|
| Targeted T2 regression | `npx vitest run packages/runtime-core/src/registry/__tests__/<chosen-test-file>` | 3 | If failing after attempt 3, stop and report the exact failing assertion/output. |
| Typecheck | `npx tsc -b` | 2 | If failing after attempt 2, stop unless the fix is strictly within T2 source scope. |
| Full suite | `npm test` | 2 | If failing after attempt 2, stop and report whether failure is related to T2. |
| Diff scope audit | `git diff --stat && git diff --name-only` | 1 | If any out-of-scope file appears, revert only the implementer's out-of-scope change or stop for guidance if uncertain. |

No live LLM commands are part of T2.

## Later Task Skeletons

### M12-T1 — Cross-Provider Live Harness

Scope:

| File | Scope |
|---|---|
| `scripts/test-live-cross-provider.mjs` | New script forked from `scripts/test-live-gate.mjs`, with `PLANNER_A_PROVIDER`, `PLANNER_B_PROVIDER`, and `WORKER_PROVIDER` env overrides. |
| `scripts/test-live-gate.mjs` | Read-only baseline unless the reviewer explicitly approves a shared helper extraction. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T1-C1 | New script creates three MCP agents with per-agent `providerName` values. | Diff reference. |
| T1-C2 | New script launches each external agent with matching `llm-agent.mjs --provider <provider>`. | Diff reference and dry/structural command output where possible. |
| T1-C3 | Existing all-Gemini gate remains unchanged behaviorally. | Diff scope and reviewer inspection; no edits to `test-live-gate.mjs` unless approved. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| `npx tsc -b` | 2 |
| structural script run, if designed with a no-live mode | 2 |
| `git diff --stat && git diff --name-only` | 1 |

### M12-T3 — Provider-Mix Invariance Test

Scope:

| File | Scope |
|---|---|
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` or new focused test | Add deterministic coverage that mixed `providerName` metadata does not change `await_turn` routing or `consensus_respond` dispatch. |
| `packages/runtime-core/src/registry/registry.ts` | Read-only unless the test exposes a real T3 regression and Reviewer/PO authorize a fix. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T3-C1 | Mixed provider metadata still uses exec-turn routing. | Test assertion. |
| T3-C2 | `consensus_respond` dispatch remains action-based, not provider-based. | Test assertion. |
| T3-C3 | Full suite and typecheck clean. | Exact command output. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Targeted T3 Vitest | 3 |
| `npx tsc -b` | 2 |
| `npm test` | 2 |

### M12-PF — Codex MCP Preflight

Scope:

| File | Scope |
|---|---|
| No production file required by default. | Prefer running an existing or T1-created one-agent preflight. If a script is needed, spec it separately before adding it. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| PF-C1 | One Codex MCP agent attaches and completes one structured turn. | Command, transcript/log excerpt, usage before/after. |
| PF-C2 | Any parse failure is classified as Layer 1 client cleanup or Layer 2 AgentTalk structured parse. | Exact error/output and file boundary. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Single-agent Codex MCP preflight | 2 |
| Usage meter read before/after | 1 each, best-effort |

### M12-T4 — Recorded Live Mixed-Provider Run

Scope:

| File | Scope |
|---|---|
| `scripts/test-live-cross-provider.mjs` | Execute only; do not edit during T4 unless a separate scope decision is made. |
| `design/milestone12-cross-provider-consensus-implementation.md` | Record transcript summary, attempts, usage, and outcome. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T4-C1 | PF was run before full live consensus. | PF evidence link/section. |
| T4-C2 | Up to 4 live attempts were run or intentionally stopped earlier for budget/blocker. | Attempt log with commands and outcomes. |
| T4-C3 | Clean completion, or honest partial with follow-on finding. | Transcript summary and classification. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Full Gemini+Codex live round | 4 total across the epic |
| Usage meter read before/after live window | 1 each, best-effort |

### M12-T5 — Docs / Close

Scope:

| File | Scope |
|---|---|
| `design/milestone12-cross-provider-consensus-implementation.md` | Final claim/verdict rows, telemetry blocks, live observations. |
| `design/backlog.md` | Close/disposition the deferred cross-provider consensus item. |
| `design/logbook.md` | Add LB-11-style calibration entry for cross-provider work. |
| `design/session-primers/*` and `design/lessons/*` | Only if this is a session-close handoff. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T5-C1 | Backlog item dispositioned. | Diff reference. |
| T5-C2 | Telemetry recorded where available. | Ledger section. |
| T5-C3 | Final suite/typecheck state recorded. | Exact command output or reason unavailable. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Docs consistency grep for stale M12 status | 2 |
| `git diff --stat && git diff --name-only` | 1 |

