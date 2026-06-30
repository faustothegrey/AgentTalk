# Milestone 11 — Consensus / Protocol Robustness — Plan

> **Status:** reviewer approved — opened by SM Hermes on PO's behalf, confirmed by PO Fausto, and gate-1 approved by Codex reviewer (2026-06-30).
> **Origin:** Follow-on to the old M10 (graded, stateful protocol brain). T1 (ejectPlanner), T2 (graded
> loop), T4 (API enforcement), and Bridge v3 (DiagramTalk overlay) were **done under M10**. The remaining
> work — T3 (single tool), turn-budget/referee, affordance spike, and active re-prompting — gets a fresh
> number here.
> **Old plans:** `design/milestone10-protocol-compliance-plan.md` (thesis), `design/milestone10-phase2-plan.md`
> (T1–T4 implementation breakdown, D1/D2/D3). M10 became the DiagramTalk overlay; these deferred items
> carry forward into M11.
> **Backlog:** The "Failure-modes split → M09 portion stays open" item in `design/backlog.md` is promoted
> here.

---

## 1. Thesis

The old M10 built the **graded, bounded, closed-loop protocol brain**: illegal move → correct + retry (N=2) → peer-safe eject (not dual-kill). That shipped (T1+T2 merged).

What it didn't ship:
- **T3** — single-tool collapse (replacing the 12-tool surface with one `consensus_respond`)
- **Turn-budget / referee** — bound discussion, force-advance or fail the round on non-convergence
- **Affordance-protocol spike** — dynamic skills per phase + phase-scoped MCP toolset
- **Active re-prompting** — the richer tolerance (coerce toward a valid transition, not just soft-reject)

These are the remaining pieces to make multi-agent consensus genuinely robust — not just tolerant (survives), but efficient (succeeds consistently).

## 2. What's already done

| Item | Status |
|------|--------|
| T1 — Peer-safe `ejectPlanner(agentId, reason)` | ✅ merged (`76e5b34`) |
| T2 — Graded loop (correct → retry N=2 → eject) | ✅ merged (`5fea20c`) |
| T3 — Single tool `consensus_respond` | ❌ deferred (D3) |
| T4 — API enforcement (tools + tool_choice + strict enum) | ✅ merged (`d0462b6`) |
| Bridge v3 — DiagramTalk overlay | ✅ merged (`53593a4`) |
| Late-message race tolerance (post-planning stragglers) | ✅ merged (`cf05d50`) — part of M08 |
| Protocol violation soft-reject (isError, not crash) | ✅ merged (`dae80c2`) — part of M08 |

## 3. M11 task breakdown

> **Baseline for file/line scopes:** `master` `5cd03df` (2026-06-30). These are planning anchors, not a license
> to edit beyond the named surfaces. Implementers must re-check the exact lines on their task branch before editing.

### SP1 — Affordance-protocol spike (dynamic skills + scoped toolset)

**Purpose.** Determine whether the next structural improvement should be dynamic per-phase guidance/tool exposure,
or whether M11 should stop after M11-T1 + M11-T2 + M11-T3. This task is a **spike only**.

**Allowed scope (read/probe/docs only):**
- Read current MCP tool surface in `packages/runtime-core/src/registry/mcp-tools.ts:12-125`.
- Read current wire contract in `packages/contracts/wire-contract.json:1-27` and sibling client copy
  `/Users/fausto/Software/agentalk-mcp-client/wire-contract.json:1-27`.
- Read MCP client handshake/contract plumbing in `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs:20-38`
  and tool-call wrapper in `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs:86-99`.
- Read provider execution routing in `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:25-38`
  and factory selection in `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:811-837`.
- Read Gemini persistent MCP injection/turn handling in
  `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:380-615`.
- Read Codex persistent MCP injection/turn handling in
  `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:627-768`.
- Read existing live harnesses `scripts/test-mcp-gate.mjs:12-87` and `scripts/test-live-gate.mjs:12-131`.
- Write findings into `design/milestone11-consensus-robustness-implementation.md` or a dedicated
  `design/milestone11-affordance-protocol-spike.md` if the findings are too long for the ledger.

**Do not touch:** production runtime code, `wire-contract.json`, client code, or tests. If a probe requires changing
runtime/client behavior, stop and record the needed implementation as a recommendation, not as this task's diff.

**Probe questions:**
1. Can `agy`/Gemini persistent execution respect a dynamically injected per-turn instruction/skill, or only launch-time
   instructions?
2. Can Codex MCP execution respect a dynamically injected per-turn instruction/skill in the same way?
3. Can the MCP toolset be scoped per phase in practice, or is the advertised tool list static for the session?
4. If T3 exposes only `consensus_respond`, can the `action` enum be narrowed per phase at the tool schema level, or
   must the server continue validating phase legality after receipt?

**DoD:**
- A findings table records each probed harness/provider, exact command or manual procedure, result, and limitation.
- Recommendation is explicit: **implement now**, **defer to a later milestone**, or **drop**.
- Any live/probe run records provider budget impact and whether it used a real model or a fake/mocked bridge.
- No repo pollution after probes: `git status --short`, `git worktree list`, and task branches checked.

**Retry budget:**
- Static read/probe design: max 1 pass; if inconclusive, record the unknown.
- Each live harness probe: max 1 run per provider/harness. Do not burn retries on protocol-unfit/free flaky models.
- Documentation review command (`git diff --check`): max 2 attempts for markdown formatting fixes.

### M11-T1 — Single tool `consensus_respond(action, payload)` (origin: M10-T3)

**Purpose.** Collapse the planning protocol MCP surface from several planning tools into one
`consensus_respond(action, payload)` tool. The server still validates action legality against the current phase; the
tool collapse removes the wrong-tool class at the MCP surface and makes the contract easier to scope later.

**Allowed production scope:**
- `packages/runtime-core/src/registry/mcp-tools.ts:12-125`: replace planning tools
  `agreement_proposal`, `agreement_acceptance`, `ack_planning_protocol`, `fact_collection_end`, and `submit_plan`
  with one `consensus_respond` definition. `opinion` is not a separate MCP tool today (it rides through
  `send_to_agent`), but under T3 it must become `consensus_respond({ action: 'opinion', payload })` for planning
  consensus. Preserve `send_to_agent` for non-planning peer/user messages unless a reviewer-approved M11-T1 subdecision
  says otherwise.
- `packages/runtime-core/src/registry/registry.ts:29-86`, the current `send_to_agent` planning/discussion path around
  `360-404`, and planning tool handlers at `407-464`: add argument extraction for `{ action, payload }`; dispatch
  `action` through the existing coordinator/conversation behavior; preserve soft reject behavior (`softProtocolReject`)
  and terminal-action dedupe.
- `packages/runtime-core/src/agents/translation.ts:11-82`: change structured-response translation so planning
  message types become a `consensus_respond` request with `action = structured.message_type` and payload equal to the
  existing message payload, including `opinion`.
- `packages/runtime-core/src/agents/response-schema.ts:16-28`, `83-142`, `152-194`, `281-346`: keep the
  API-path schema unchanged as `respond(message_type, message_payload)` for M11. Decision: API structured turns
  already use one function tool, and renaming it would add provider-facing churn without improving the MCP wire
  contract. M11-T1 changes the MCP/runtime planning action surface to `consensus_respond(action,payload)`; API responses
  continue to parse as the existing structured envelope and are translated into the new runtime request.
- `packages/contracts/wire-contract.json:1-27`: bump v5 -> v6 and recompute hash after changing `data.mcpTools`.
- `/Users/fausto/Software/agentalk-mcp-client/wire-contract.json:1-27`: update byte-identically with the runtime
  contract.
- Client contract verification only: `/Users/fausto/Software/agentalk-mcp-client/scripts/verify-contract.js:1-21`
  should not need logic changes; if it does, stop and report why.

**Allowed tests/scripts scope:**
- `packages/runtime-core/src/registry/__tests__/mcp-tools.test.ts:6-15`: drift guard must assert the v6 tool set.
- `packages/runtime-core/src/agents/__tests__/translation.test.ts:7-51`: update planning translation assertions to
  `consensus_respond`.
- `packages/runtime-core/src/agents/__tests__/response-schema.test.ts:12-60` and
  `packages/runtime-core/src/agents/__tests__/completer.test.ts:29-49`: preserve the existing API `respond` schema
  and add/adjust assertions only as needed to prove the API envelope still translates into `consensus_respond`.
- `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:33-139` and
  `packages/runtime-core/src/registry/__tests__/team-api-consensus.test.ts:26-110`: keep full mocked consensus green
  through the new dispatch.
- `scripts/test-mcp-gate.mjs:12-87` and `scripts/test-live-gate.mjs:12-131`: update only if live harness assertions
  or expected tool names must change.

**Wire-contract lockstep procedure:**
1. In AgentTalk, edit `packages/contracts/wire-contract.json`: remove old planning MCP tools, add
   `consensus_respond`, bump `version` from 5 to 6.
2. Recompute `hash` as SHA-256 of `JSON.stringify(contract.data, null, 2)`; verify with
   `node packages/contracts/scripts/verify-contract.js`.
3. Copy the entire JSON file byte-for-byte to `/Users/fausto/Software/agentalk-mcp-client/wire-contract.json`.
4. Verify client hash with `node scripts/verify-contract.js` from `/Users/fausto/Software/agentalk-mcp-client`.
5. Prove byte identity: `cmp -s packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json`.
6. Build before live: `tsc -b`.
7. Run a live handshake gate against one available provider only after both contract checks pass.

**DoD:**
- Runtime exposes exactly one planning MCP tool, `consensus_respond`, and no longer advertises the five old planning
  MCP tools; planning `opinion` no longer requires the model to choose `send_to_agent`.
- API structured generation still exposes the existing single `respond(message_type, message_payload)` function tool;
  the post-parse translation produces the same `consensus_respond` runtime request used by MCP planning.
- Existing coordinator behavior is preserved: legal `action` values route to the same handlers; illegal/out-of-phase
  actions still soft-reject rather than crash.
- AgentTalk and `agentalk-mcp-client` wire contracts are version 6, hash-valid, and byte-identical.
- Mocked MCP and API consensus tests pass.
- Live gate green on at least one available provider with the v6 contract.
- Ledger records the exact hash, commands, live provider used, and pollution check.

**Retry budget:**
- Contract/hash verification: max 2 attempts.
- Focused runtime tests (`translation`, `response-schema`, `mcp-tools`, mocked consensus): max 3 attempts per failing
  test file.
- `tsc -b`: max 2 attempts.
- Full suite (`npm test`): max 2 attempts.
- Live gate: max 1 attempt per provider. If it fails from model behavior or quota after contract/build/tests are green,
  stop and report rather than reshaping production behavior.

### M11-T2 — Active re-prompting (richer tolerance)

**Purpose.** Improve the correction message for illegal protocol actions so the offender is actively steered toward a
valid next action after one correction, using the final M11-T1 vocabulary.

**Allowed production scope:**
- `packages/runtime-core/src/registry/team-coordinator.ts:1910-1963`: validation path only as needed to pass richer
  context into the correction prompt.
- `packages/runtime-core/src/registry/team-coordinator.ts:1981-2064`: update correction prompt content; preserve retry
  budget (`MAX_REGRESSION_RETRIES = 2`) and peer-safe eject behavior.
- `packages/runtime-core/src/registry/team-coordinator.ts:936-960` and `2074-2077`: read current phase/expected set;
  edit only if the prompt needs a stable phase label helper.
- Tests should live in or near existing registry consensus tests, especially
  `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:33-139` or an adjacent focused test file.

**Do not touch:** T3 wire-contract surfaces, `ejectPlanner` semantics (`team-coordinator.ts:1623-1692`), or
post-planning late-message no-op behavior (`team-coordinator.ts:975-1185`) unless a reviewer/PO explicitly expands
scope.

**DoD:**
- When an agent sends an illegal action for the current phase, the transcript/system event includes: the rejected
  action, current phase when available, legal action set, and one concrete instruction to resend using the M11-T1 action
  vocabulary.
- A deterministic probe/test shows an illegal first action followed by a valid corrected action is accepted within
  one correction and does not eject the planner.
- Existing exhaustion behavior still works: repeated non-compliance reaches peer-safe eject after the configured
  budget, not dual-kill.
- No change to legal happy-path consensus behavior.

**Retry budget:**
- Focused M11-T2 correction tests: max 3 attempts.
- Regression/eject preservation test: max 2 attempts.
- `tsc -b`: max 2 attempts.
- Full suite: max 2 attempts.
- Live weak-model observation: max 1 run; if inconclusive, record as observation rather than changing the bar.

### M11-T3 — Turn-budget / Referee

**Purpose.** Bound non-converging discussion loops. M11-T1 prevents wrong tools; M11-T2 improves correction; M11-T3 prevents a
model from choosing legal-but-unproductive actions forever.

**Allowed production scope:**
- `packages/runtime-core/src/registry/team-coordinator.ts:72-86`: add a named discussion-turn limit, default
  `MAX_DISCUSSION_TURNS = 6` unless reviewer/PO changes it before implementation.
- `packages/runtime-core/src/registry/team-coordinator.ts:141-152`: add per-task discussion turn state.
- `packages/runtime-core/src/registry/team-coordinator.ts:315-360` and `1055-1138`: initialize/reset discussion budget
  when a multi-planner task enters discussion.
- `packages/runtime-core/src/registry/team-coordinator.ts:615-880` (agreement request/fallback area) and
  `1910-1963`: count legal discussion actions (`opinion` / `agreement_proposal`) in the discussion phase and invoke
  referee behavior once the budget is exhausted.
- `packages/runtime-core/src/registry/team-coordinator.ts:1847-1860`, `1208-1216`, `1320-1324`, `1694-1718`: cleanup
  any new state on interruption, plan submission, rejection, and agent removal.

**Referee policy for v1.** Fail the round cleanly by reusing the existing planning interruption path once
`MAX_DISCUSSION_TURNS` legal discussion turns occur without agreement/submittal. Do **not** force-advance to proposal
without agreement in v1; force-advance is a future PO decision because it changes consensus semantics.

**Allowed tests/scripts scope:**
- Add focused deterministic tests under `packages/runtime-core/src/registry/__tests__/` proving the budget boundary.
- Extend existing mocked consensus tests only to keep the happy path under the budget.
- Add or update a task-specific live observation harness (for example a flag or sibling of
  `scripts/test-live-gate.mjs:72-131`) that starts a real multi-planner round designed to keep discussion legal but
  non-converging until the referee fires. Required command shape: `MCP_GATE_PROVIDER=<available-provider> node
  scripts/<mt1-live-referee-probe>.mjs` after `tsc -b`. Use exactly one available fit provider; if no provider/quota
  is available, stop and request reviewer/PO deferral instead of closing M11-T3.

**DoD:**
- At exactly `MAX_DISCUSSION_TURNS` non-converging legal discussion actions, planning transitions to a clean
  interrupted/referee outcome with a transcript entry naming the exhausted budget.
- No `MAX_DISCUSSION_TURNS + 1` discussion action is routed to a peer after interruption.
- Happy-path consensus still reaches `submit_plan` before the budget and remains green.
- New budget state is cleared on every existing terminal/cleanup path.
- Required live observation is recorded in the ledger with provider, command, final status, and budget reading. The
  live run is a one-attempt observation of the real loop; deterministic tests remain the bug-localizing evidence.

**Retry budget:**
- Focused referee boundary test: max 3 attempts.
- Happy-path mocked consensus regression: max 2 attempts.
- `tsc -b`: max 2 attempts.
- Full suite: max 2 attempts.
- Required live referee observation: max 1 run on one available fit provider; never use known protocol-unfit/free
  flaky models. Quota/provider unavailability is a reviewer/PO deferral decision, not an implementer workaround.

## 4. Confirmed decisions

| Decision | Confirmed value |
|----------|-----------------|
| Milestone number | M11 |
| Sequencing | SP1 -> M11-T1 -> M11-T2 -> M11-T3 |
| SP1 spike timing | First, separate, read/probe/docs only |
| M11-T1 contract bump | Current v5 -> v6 |
| M11-T1 API schema naming | Keep API function tool as `respond(message_type, message_payload)`; translate post-parse to MCP/runtime `consensus_respond(action,payload)` |
| Turn-budget N | Start at `MAX_DISCUSSION_TURNS = 6` |
| M11-T3 referee policy | Fail/interruption in v1; no force-advance without a later PO decision |

## 5. Definition of Done (M11)

1. M11-T1: single `consensus_respond` tool live on ≥1 provider; wire-contract hash-verified; old multi-tool surface removed.
2. M11-T3: turn-budget/referee proven (deterministic test + live observation); discussion bounded, non-convergence handled cleanly.
3. SP1: affordance spike complete with per-harness findings and recommendation.
4. M11-T2: active re-prompting ships the current legal set on correction; probe test green.
5. Gate: `tsc -b` 0 + full suite green (updated contracts where changed); no pollution (LB-9); telemetry block per task.
6. All ledger entries written; backlog updated.

## 6. Sequencing

1. **SP1 (spike)** — read-only, zero production changes, informs later decisions. Run first.
2. **M11-T1** — single-tool collapse. Independent of spike outcome; wire-contract work.
3. **M11-T2** — active re-prompting. Depends on M11-T1 (the tool vocabulary changes).
4. **M11-T3** — turn-budget/referee. Depends on M11-T1 (the action set is final). Last, and lowest priority if budget is tight.

## 7. Open items

- None for gate 1. Next step: implementer takes SP1 under this approved scope.
