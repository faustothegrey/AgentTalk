# Milestone 18 - Self-hosting milestone

**Status:** **Gate 1 amendment pending for M18-T3a** (Codex planner amendment, 2026-07-09). Original M18 Gate 1 was
approved by Claude; T3 was later superseded by PO rescope and T3a requires a fresh Gate 1 review.
**Backlog:** BL-021 (`doing`), absorbing BL-015 L0, BL-020, and BL-017.
**Program:** `design/self-hosting-program-draft.md` (self-hosting M16 -> M18), M18 section and INCEPTION block.
**Prior epic:** M17 closed the gate-over-channel authority path; M18 uses that substrate for one small real dev
epic and files the friction it observes.
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
**Task-end Reviewer:** Claude.

## Why

M16 proved one real baton can travel through the orchestrator attach server. M17 made gate-channel authority
explicit: attached sessions can emit structured workflow events only when the brain's session -> identity ->
workflow-role mapping allows it.

M18 turns those capabilities back onto AgentTalk itself. The epic is deliberately small, but real: it adds the first
detective scope-fence layer, fixes a live robustness defect found by the M17 proof, then repairs the exec bridge so
real CLI sessions can carry baton and gate envelopes. Its product output matters, but the larger proof is the
coordination record: how much of the work ran over AgentTalk, where the terminal was still needed, and what friction
became backlog.

## Goal

One full, deliberately small development epic runs end-to-end on the AgentTalk substrate:

- planning baton, Gate 1, implementation hand-offs, Gate 2, Gate 3, and closure are recorded;
- terminal relay is used only for declared fallback moments;
- relay count is recorded per task and falls measurably after T3a;
- the SM files friction -> backlog entries citing recording evidence after the epic.

## Non-goals

- No BL-015 L1/L2. T1 is L0 only: a per-task scope manifest plus `scope-check` script. Provider write guards,
  substrate-administered fenced worktrees, baton-carried manifests, and recorded fence-violation runtime events
  stay gated with BL-014 at M19. If any L1/L2 shape appears in T1, Gate 1 must hand the plan back.
- No broad workflow redesign, consensus redesign, or arbiter redesign.
- No `team-coordinator.ts` behavior changes.
- No new MCP tool for T3a unless the work stops first, BL-018 is reopened, and the PO explicitly authorizes the
  contract-hash bump path.
- No DiagramTalk repair in the core DoD. It remains a droppable rider only after T3a and only if genuinely cheap.
- No committed `.mcp.json` / MCP-client config template in T3a. The rider is explicitly dropped from this task; if
  the T3a proof shows a template would materially reduce future friction, record it as a follow-up from the evidence.
- No claim that T1/T2 can avoid all terminal relay. Before BL-017 closes through T3a, real CLI sessions still cannot
  attach and emit workflow envelopes themselves.

## Scope Fence

**Allowed, epic-wide:**

- This plan, the M18 implementation ledger once opened, and documentation updates that reflect the delivered tasks.
- Focused tests, scripts, runbooks, and committed proof artifacts needed for the task bars.
- Recording and relay-count evidence for M18's own coordination.
- Existing AgentTalk workflow-event channel usage for gates and batons.

**Forbidden, epic-wide:**

- `packages/runtime-core/src/registry/team-coordinator.ts` behavior changes.
- Weakening existing M16/M17 proof semantics, authority checks, or identity baselines.
- Silent terminal relay. Every terminal relay/restart must be logged as a declared fallback moment with reason,
  timestamp, task, sender role, receiver role, and whether the missing substrate capability was BL-017, BL-020, or
  operator error.
- Broad UI polish or new observability systems beyond what is required to inspect the recordings.
- Hidden cross-repo contract drift. If T3a needs a new MCP tool, stop before implementation and escalate.

Any scope growth is an automatic Gate-1 hand-back before implementation starts, or a mid-task reviewer/SM stop if it
appears later.

## Substrate Coordination Spec

M18 is the guinea pig. The epic must use AgentTalk as the primary coordination channel to the maximum extent the
current substrate permits, and must measure the shortfall honestly.

For every task, the implementation ledger must include a **Coordination Evidence** block with:

- substrate events recorded: planning baton, Gate 1 result, implementer hand-off, Gate 2 verdicts, Gate 3 result,
  and merge/closure where applicable;
- terminal fallback rows: count plus one row per fallback moment, with reason and artifact pointer;
- relay count: total human/terminal relays for that task;
- proof pointer: recording file, NDJSON slice, log excerpt, or runbook output used by reviewers.

Minimum expected substrate usage:

| Phase | T1 expectation | T2 expectation | T3a expectation |
|---|---|---|---|
| Gate/baton recording | Use the M17 workflow-event path where available; otherwise SM terminal relay must be declared. | Same, plus a crash/restart fallback is acceptable evidence for BL-020 if it happens live. | A real CLI session must attach through the repaired bridge, then carry a baton/workflow envelope for at least one gate or baton path. |
| Terminal relay | Allowed but counted; expected non-zero because BL-017 is open. | Allowed but counted; expected non-zero because BL-017 is still open. | Expected to fall measurably after the fix; any remaining terminal relay needs a non-BL-017 reason. |
| Recording evidence | Required for every gate/baton that does use AgentTalk. | Required, plus disconnect-survival evidence. | Required, plus A/B handshake evidence and structured-argument survival evidence from the real CLI path. |

The DoD does not require "relay ~= 0" for all of M18. It requires the count to be recorded honestly per task, every
fallback to be declared, and the count to fall after T3a relative to T1/T2.

## Task Breakdown

1. **M18-T1 - BL-015 L0: scope manifest and `scope-check`.**
   Add the detective layer only:
   - define a machine-readable per-task `@scope` manifest syntax next to the task ledger section;
   - add a `scope-check` script that parses the active task's manifest and compares changed paths against allowed,
     forbidden, and free globs;
   - document how implementers and reviewers run it during Rule-5 self-check and gates;
   - prove it catches an out-of-scope path and passes an in-scope path.

   Required fence: zero `runtime-core` production changes. No provider hooks, no substrate-enforced worktree, no
   baton-carried manifest.

2. **M18-T2 - BL-020: attached-client disconnect cannot kill the orchestrator.**
   Fix the in-process driver/lifecycle path so a disconnect during an in-flight turn cannot throw an illegal
   status transition out of the loop and kill the orchestrator process.

   The plan must preserve existing lifecycle behavior and include the checks named in the planner POV:
   - a disconnect-mid-turn regression for the observed BL-020 crash class;
   - preserved behavior for normal exec errors;
   - preserved behavior for clean termination;
   - preserved M08 transport-fault handling;
   - preserved M17 workflow-gate authority/recording behavior.

   The expected fix surface is `packages/runtime-core/src/agents/in-process-driver.ts` and narrowly related tests.
   Any broader lifecycle redesign is out of scope unless Gate 1 is amended.

3. **M18-T3 - CLOSED: SUPERSEDED.**
   The original BL-017 diagnosis was wrong: structured `send_to_agent` arguments already survive the bridge, and the
   dead T3 proof passed without its change. T3 branches remain unmerged archive branches; no T3 code is carried
   forward. The replacement task is T3a below.

3a. **M18-T3a - BL-017: real CLI attach handshake.**
   Repair the standalone stdio/WebSocket bridge so real CLI MCP clients can pass the AgentTalk contract-hash
   handshake and attach to the orchestrator. The fix is client-side and transport-only: `bridge.mjs` must read the
   `contractHash` query parameter from the WebSocket URL it already receives and inject that value into
   `initialize.params.clientInfo.contractHash` when relaying an `initialize` JSON-RPC request that lacks the hash.
   Preserve the client's existing `clientInfo` fields and pass all non-`initialize` traffic through unchanged.

   Required bars:
   - A/B proof: the Door 1 real CLI proof fails on the unfixed bridge with the server-side contract-hash rejection
     (`got undefined`), then passes with the T3a fix using the same real CLI/orchestrator path.
   - Passing proof must show env-var envelope injection is absent: `AGENTTALK_BATON` and
     `AGENTTALK_WORKFLOW_EVENT` unset, and no bridge code path that injects those envelope values.
   - Passing proof must show the real CLI session natively emits `send_to_agent` with structured `baton` and
     `workflowEvent`, the M17 authority guard accepts the event for the registry-owned role, and the message routes.
   - Existing generic relay behavior remains unchanged for non-`initialize` messages and for `initialize` messages
     that already contain a `clientInfo.contractHash`.
   - No server handshake semantic change, no runtime-core production change, no new MCP tool, and no wire-contract
     change. If any of those appears necessary, stop, reopen BL-018 where relevant, and ask the PO before authoring or
     implementing that shape.
   - The `.mcp.json` template rider is dropped from T3a. Do not commit a template in this task; record a follow-up
     friction item only if the proof shows the missing template is a real obstacle.

   Required T3a fence:
   - Allowed: `../agentalk-mcp-client/bridge.mjs`, focused bridge tests in `../agentalk-mcp-client`, this plan, the
     M18 implementation ledger, and T3a proof artifacts under `design/evidence/`.
   - Forbidden: `packages/mcp-transport/src/mcp-server.ts` handshake semantics, any `packages/runtime-core/**`
     production change, `packages/contracts/wire-contract.json`, new MCP tools, and any env-var envelope injection
     mechanism such as `AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT`.
   - Explicitly out: committed `.mcp.json` / real-CLI config templates for this task.

## DoD Claims

| Claim | Bar |
|---|---|
| C1 | M18's own planning baton, Gate 1, implementation hand-offs, Gate 2 verdicts, Gate 3 closures, and task closure records have AgentTalk recording evidence wherever the substrate can carry them. |
| C2 | Every terminal relay/restart/fallback is logged with reason, task, sender role, receiver role, and artifact pointer; no fallback is silently omitted. |
| C3 | Relay count is recorded per task and falls measurably after T3a; the claim is based on the ledger's fallback rows and recording evidence, not memory. |
| C4 | T1 delivers BL-015 L0 only: scope manifest plus `scope-check`; L1/L2 remain open for M19 with BL-014. |
| C5 | T2 closes BL-020: disconnecting an attached client during an in-flight turn no longer kills the orchestrator, and normal error/clean termination/M08/M17 behavior is preserved. |
| C6 | T3a closes BL-017 by proving real CLI sessions can attach through the bridge and then carry `send_to_agent` structured `baton` and `workflowEvent` args; no new MCP tool or wire-contract change is introduced without PO escalation. |
| C7 | SM files friction -> backlog entries from M18 recordings after T3a/closure, citing recording evidence. This is the program-loop DoD for M18. |
| C8 | Freeze bar green at closure: targeted tests, `npx tsc -b`, full `npm test`, M14 identity harness, `npm run backlog:check`, whitespace checks, pollution checks, and zero `team-coordinator.ts` diff. |

## Verification Budgets

### M18-T1

| Check | Max attempts |
|---|---:|
| `scope-check` parser/unit tests | 3 |
| out-of-scope negative fixture/probe | 3 |
| in-scope/free-path positive fixture/probe | 3 |
| documentation/ledger manifest drift check | 2 |
| `npx tsc -b` | 2 |
| targeted relevant tests | 2 |
| full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check && git diff --cached --check` | 2 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

### M18-T2

| Check | Max attempts |
|---|---:|
| disconnect-mid-turn regression | 3 |
| normal exec-error preservation check | 2 |
| clean termination preservation check | 2 |
| M08 transport-fault preservation check | 2 |
| M17 workflow-gate authority/recording preservation check | 2 |
| `npx tsc -b` | 2 |
| targeted relevant tests | 2 |
| full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check && git diff --cached --check` | 2 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

### M18-T3a

| Check | Max attempts |
|---|---:|
| bridge injects URL `contractHash` into missing `initialize.params.clientInfo.contractHash` | 3 |
| bridge preserves existing `initialize.params.clientInfo` fields and an already-present hash | 3 |
| bridge leaves non-`initialize` / generic relay traffic byte-equivalent | 3 |
| no env-var envelope injection code or tests (`AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT`) | 1 |
| Door 1 A/B live proof: unfixed bridge fails handshake, fixed bridge passes and emits baton/workflowEvent | 2 |
| server M17 authority acceptance/refusal evidence from the passing real CLI proof | 2 |
| contract hash/name check (`wire-contract.json` unchanged unless PO escalates) | 1 |
| forbidden-surface diff check: `mcp-server.ts`, runtime-core production, contracts, MCP tools | 1 |
| client build/lint/test check | 2 |
| targeted relevant tests in both repos, where touched | 2 |
| full AgentTalk `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check && git diff --cached --check` in touched repos | 2 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` in touched repos | 1 |

### Epic Closure

| Check | Max attempts |
|---|---:|
| DoD C1-C8 sweep from recordings/ledger | 1 |
| relay-count comparison T1/T2 vs T3a | 1 |
| friction -> backlog entries cite recording evidence | 2 |
| full freeze bar re-run | 1 |
| task-closure telemetry blocks present | 1 |

## Risks

1. **T1 can accidentally become M19.** The first sign is provider hooks, fenced worktree provisioning,
   baton-carried manifests, or runtime fence events. That is not "finishing BL-015"; it is scope creep into L1/L2.
2. **T2 can over-correct lifecycle semantics.** The fix must tolerate terminal states without turning genuine
   faults invisible. Preserve M08/M17 behavior by test, not assertion.
3. **T3a can drift across the handshake boundary.** The server is right to require the contract hash; the risky
   surface is the bridge failing to supply it for real CLI clients. Server handshake changes, runtime-core changes,
   new tools, or wire-contract edits are stop conditions.
4. **Substrate proof can become theater.** Counting only successful AgentTalk messages would hide the real gap.
   The relay-count table and fallback rows are load-bearing evidence.
5. **Budget pressure can tempt shallow live proof.** The live proof is the point of M18. If budget gets tight, cut
   DiagramTalk/rider work first, not recording evidence or fallback accounting.

## Gate 1 Review Focus

Claude should specifically challenge:

- whether the T1 fence is tight enough to exclude L1/L2;
- whether the T2 preservation checks cover the live BL-020 failure without swallowing unrelated errors;
- whether T3a's fence keeps the fix in `bridge.mjs` and excludes server handshake semantics, runtime-core,
  new-tool, and wire-contract drift;
- whether the substrate-coordination evidence is measurable enough for C1-C3 and C7.

## Gate 1 Amendment Request (Codex, planner, 2026-07-09) — PENDING CLAUDE REVIEW

T3 is superseded and not merged; T3a is the replacement plan. Load-bearing planning claims checked before authoring:
`packages/mcp-transport/src/mcp-server.ts` rejects `initialize` when `params.clientInfo.contractHash` is missing or
wrong; `../agentalk-mcp-client/bridge.mjs` on `master` is a verbatim stdio/WebSocket relay and has no contract-hash
injection; `../agentalk-mcp-client/lib/mcp-client.mjs` shows SDK-style clients do send the hash, explaining why prior
SDK proofs hid the real CLI blocker; `design/evidence/m18-door1-real-cli-proof.ndjson` and LB-66 record the Door 1
A/B observation. The `.mcp.json` template rider is explicitly dropped from T3a.

Gate 1 reviewer should rule only on this amendment's T3a spec, DoD rows, budgets, and fence; the prior T1/T2 plan
sections remain historical/delivered context.

## Original Gate 1 Record (Claude, plan reviewer, 2026-07-09) — APPROVED

Load-bearing claims verified against the repo before ruling (Reviewer Rule 1/5): server `send_to_agent`
schema already carries optional `baton`/`workflowEvent` (`packages/runtime-core/src/registry/mcp-tools.ts:44,56`);
`packages/contracts/wire-contract.json` exists (v7, tool-names-only hash per the M17 Gate-1 check);
`scripts/m14-identity-harness.mjs` exists and implements `--check` (line 195); T2's narrow test surface
exists (`packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts`); client repo `src` has zero
baton/workflowEvent handling (the T3 gap is real); `npm run backlog:check` re-run green (21 items, 0
warnings); banned-wording scan clean. The four review-focus challenges each hold — fence enumerates all
L1/L2 shapes as hand-back triggers; T2 preservation is check-per-behavior with budgets; the T3 stop is
stated identically in three places; C1-C3/C7 are grounded in fixed ledger fields.

**One binding Gate-1 note:** the epic's relay counting starts at inception, not at T1's first commit. When
the M18 ledger opens, its coordination baseline must seed the relays already spent (planner POV relay, plan
baton, this Gate-1 result relay — ~3 at approval time). Next act: implementer baton for M18-T1.
