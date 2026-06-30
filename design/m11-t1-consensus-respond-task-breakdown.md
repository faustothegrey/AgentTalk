# M11-T1 Task Breakdown - single tool `consensus_respond(action, payload)`

> **Status:** drafted for Fausto review; not approved for implementation yet.
> **Milestone source:** `design/milestone11-consensus-robustness-plan.md` section M11-T1.
> **Branch:** `m11-t1-consensus-respond`.
> **Grounded on:** `master` `c507dbf` (2026-06-30). Implementer must re-check line numbers on the task branch before editing.

## 1. Scope lock

M11-T1 changes only the MCP/runtime planning action surface. The API structured generation path stays:

```text
respond(message_type, message_payload)
```

The runtime request emitted from that API result becomes:

```text
consensus_respond(action, payload)
```

Coordinator semantics are preserved. Legal action values must route to the same coordinator handlers as today; illegal, malformed, or out-of-phase actions must soft-reject through the existing registry/coordinator error path, not crash or widen behavior.

Allowed planning actions for `consensus_respond.action`:

```text
opinion
agreement_proposal
agreement_acceptance
ack_planning_protocol
fact_collection_end
submit_plan
```

Non-planning tools remain separate: `list_agents`, `send_to_agent`, `submit_work_response`, `submit_work_result`, `submit_usage_stats`, `await_turn`, and `submit_exec_result`.

## 2. Edit Surfaces

### Runtime MCP tool definition

- `packages/runtime-core/src/registry/mcp-tools.ts:12-125`
  - Replace the five old planning tool definitions at `:48-125` with one `consensus_respond` tool.
  - Preserve `send_to_agent` at `:21-47` for ordinary peer/user messaging.
  - The new tool schema should require `action` and `payload`; `action` uses the static enum above; `payload` is an object because phase legality and payload field checks remain server-side.

DoD:
- `AGENTTALK_MCP_TOOLS.map(t => t.name)` includes `consensus_respond`.
- It does not include `agreement_proposal`, `agreement_acceptance`, `ack_planning_protocol`, `fact_collection_end`, or `submit_plan`.
- Non-planning tool names are unchanged.

### Registry runtime dispatch

- `packages/runtime-core/src/registry/registry.ts:29-86`
  - Add helper extraction for `consensus_respond` arguments.
  - Preserve `getExpectedResponseTypes`, `includesPlanningExpectedResponseType`, `getProposalText`, and `getPlanningText` behavior for existing payload shapes, adapting them to read from the nested payload where needed.
- `packages/runtime-core/src/registry/registry.ts:336-405`
  - Preserve `send_to_agent` behavior for `to: "user"` and non-planning peer messages.
  - Remove planning `opinion` dependence on `send_to_agent` for the collapsed runtime path. Planning opinions should be routed by `consensus_respond(action: "opinion", payload)`.
- `packages/runtime-core/src/registry/registry.ts:407-464`
  - Replace the old individual planning `case` handlers with one `case "consensus_respond"`.
  - Dispatch inside that handler:
    - `opinion` -> `teamCoordinator.handlePlanningMessage(agent.id, payload.text, payload.replyToMessageId, payload.expected_response_types)`.
    - `agreement_proposal` -> existing `handleAgreementProposal(...)`.
    - `agreement_acceptance` -> existing `handleAgreementReached(...)`.
    - `ack_planning_protocol` -> existing `handlePlanningProtocolAck(...)`.
    - `fact_collection_end` -> existing `handleFactCollectionEnd(...)`.
    - `submit_plan` -> existing `handlePlanSubmitted(...)`.
  - Keep terminal-action dedupe at the start of each legal dispatch.
  - Wrap coordinator rejections in `softProtocolReject(action, agent.id, err)` as today.
  - Illegal `action` values soft-reject with an action-specific message; they do not throw past `handleMcpToolCall`.

DoD:
- Every legal action reaches the same coordinator method as before.
- The old planning tool names are no longer accepted as MCP tool cases.
- `send_to_agent` still works for user and ordinary non-planning messages.

### API structured translation

- `packages/runtime-core/src/agents/translation.ts:11-82`
  - Translate planning structured responses to `call: "consensus_respond"`.
  - For every planning `message_type`, set `args.action = structured.message_type` and `args.payload = structured.message_payload`, preserving the existing payload fields.
  - `opinion` no longer returns `send_to_agent` on planning structured turns.
  - Preserve default/non-planning behavior for `work_accept`, `work_refuse`, and `healthcheck_ack`.

DoD:
- Translation tests show `opinion`, `agreement_proposal`, `agreement_acceptance`, `ack_planning_protocol`, `fact_collection_end`, and `submit_plan` all return `consensus_respond`.
- Non-planning structured responses still route through the existing protocol request builder.

### API schema preservation

- `packages/runtime-core/src/agents/response-schema.ts:16-28`
  - Keep `STRUCTURED_MESSAGE_TYPES` names unchanged.
- `packages/runtime-core/src/agents/response-schema.ts:83-142`
  - Keep `buildProtocolToolSchema().function.name === "respond"`.
  - Keep required fields exactly `message_type` and `message_payload`.
- `packages/runtime-core/src/agents/response-schema.ts:152-194`
  - Keep payload validation rules unchanged.
- `packages/runtime-core/src/agents/response-schema.ts:281-346`
  - Keep prompt language in API terms (`message_type`, `message_payload`) unless a wording tweak is required to explain that the server maps it internally. Any wording change must not rename the API tool.

DoD:
- Existing API-side tests still prove `respond(message_type, message_payload)`.
- No provider-facing API function rename to `consensus_respond`.

### In-process runtime callers

- `packages/runtime-core/src/agents/in-process-driver.ts:142-175`
  - Update auto-proposal and translated structured request dispatch to use `consensus_respond`.
  - Preserve the non-planning degrade path through `send_to_agent`.
- `packages/runtime-core/src/agents/in-process-driver.ts:203-241`
  - Update fact-collection completion calls to use `consensus_respond(action: "fact_collection_end", payload: { summary })`.
  - Preserve the fallback behavior that submits `"No facts collected."` when no text is returned.

DoD:
- Existing in-process driver behavior stays green.
- The planning driver no longer invokes removed planning MCP tool names.

### Contract parser and type surface

- `packages/contracts/src/protocol-payloads.ts:20-29`
  - Keep `send_to_agent` payload shape unchanged.
- `packages/contracts/src/protocol-payloads.ts:40-48`
  - Replace or deprecate the old `SubmitPlanRequestPayload` as a standalone MCP request type.
- `packages/contracts/src/protocol-payloads.ts:76-106`
  - Replace old planning request interfaces with one `ConsensusRespondRequestPayload`.
  - Shape: `{ id, call: "consensus_respond", args: { action, payload } }`.
- `packages/contracts/src/protocol-payloads.ts:108-119`
  - Update `RequestPayload` union to include `ConsensusRespondRequestPayload` and remove old standalone planning request payloads.
- `packages/contracts/src/protocol-payloads.ts:301-319` and `:363-422`
  - Replace parser cases for old planning tool names with `consensus_respond`.
  - Validate `args.action` is a string in the allowed action set and `args.payload` is an object. Leave phase legality to runtime/coordinator.

DoD:
- `parseRequestPayload` accepts valid `consensus_respond` payloads.
- `parseRequestPayload` rejects old standalone planning tool calls.
- Existing non-planning payload parsing remains unchanged.

### Wire contract v5 to v6

- `packages/contracts/wire-contract.json:1-27`
  - Bump `version` from `5` to `6`.
  - Replace old planning entries in `data.mcpTools` with `consensus_respond`.
  - Recompute `hash` from `JSON.stringify(contract.data, null, 2)`.
- `/Users/fausto/Software/agentalk-mcp-client/wire-contract.json:1-27`
  - Copy the AgentTalk contract byte-for-byte after hash verification.
- `packages/contracts/scripts/verify-contract.js:1-21`
  - Verification only; edit only if the hash algorithm itself proves broken. If this needs a logic change, stop and report.
- `/Users/fausto/Software/agentalk-mcp-client/scripts/verify-contract.js:1-21`
  - Verification only; edit only if the hash algorithm itself proves broken. If this needs a logic change, stop and report.
- `/Users/fausto/Software/agentalk-mcp-client/attach-skill.md:5-10`
  - Update the planner instruction that currently says to submit with `submit_plan`.
  - It must tell attached planners to submit planning responses through `consensus_respond(action,payload)`.
  - Preserve the existing `await_turn` loop discipline and `send_to_agent` guidance for ordinary user/peer messages.

DoD:
- Both contract files are v6.
- Both contract hash checks pass.
- `cmp -s packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json` passes.
- Client attach guidance no longer instructs planners to call removed planning MCP tools.

### Tests and harnesses

- `packages/runtime-core/src/registry/__tests__/mcp-tools.test.ts:6-15`
  - Assert the v6 tool set and absence of old planning tools.
- `packages/runtime-core/src/agents/__tests__/translation.test.ts:7-51`
  - Update planning translation assertions to `consensus_respond(action,payload)`.
- `packages/runtime-core/src/agents/__tests__/response-schema.test.ts:12-60`
  - Preserve API `respond` assertions.
  - Add a focused assertion that API envelopes still parse unchanged before translation.
- `packages/runtime-core/src/agents/__tests__/completer.test.ts:29-49`
  - Preserve tool-call name `respond` and `message_type` enum assertions.
- `packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts:52-107`
  - Update planning and fact collection expectations to `consensus_respond`.
  - Leave non-planning `send_to_agent` expectations at `:23-50` unchanged.
- `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts:33-139`
  - Keep mocked MCP consensus green through the new dispatch.
  - Add an assertion or event observation that planning actions reach `consensus_respond`, not old planning tool names.
- `packages/runtime-core/src/registry/__tests__/team-api-consensus.test.ts:26-110`
  - Keep mocked API consensus green with the API envelope unchanged.
- `apps/orchestrator/src/__tests__/protocol-payloads.test.ts:4-54`
  - Replace old planning payload parser tests with `consensus_respond`.
  - Add rejection coverage for at least one removed standalone planning call.
- `scripts/test-mcp-gate.mjs:12-87`
  - Update only if the live success condition or expected tool names need to observe `consensus_respond`.
- `scripts/test-mcp-provider.mjs:12-109`
  - Update, fold into `test-mcp-gate.mjs`, or explicitly deprecate if it is no longer an active gate.
  - If kept, update the old success observation at `:67-70` only if the new runtime path changes what a successful planning turn emits.
- `scripts/test-live-gate.mjs:12-131`
  - Update only if the live consensus harness observes old planning tool names directly.

DoD:
- Existing consensus tests remain green.
- Tests prove both halves of the contract: API still emits `respond(...)`; MCP/runtime receives `consensus_respond(...)`.
- All active live MCP gate scripts either work with v6 or are explicitly marked retired/deprecated in the task notes.

## 3. Sub-step Plan

### Step A - Preflight inventory

Tasks:
- Create branch `m11-t1-consensus-respond`.
- Re-run targeted search for old planning tool names in production and tests.
- Verify both contract copies currently match at v5 before editing.

Commands:

```bash
git switch -c m11-t1-consensus-respond
rg -n "agreement_proposal|agreement_acceptance|ack_planning_protocol|fact_collection_end|submit_plan|consensus_respond" packages apps scripts /Users/fausto/Software/agentalk-mcp-client -S
node packages/contracts/scripts/verify-contract.js
(cd ../agentalk-mcp-client && node scripts/verify-contract.js)
cmp -s packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json
```

DoD:
- Branch exists.
- v5 contract state is known clean before mutation.
- Any extra old-tool consumers not listed above are reported before editing.

### Step B - Runtime dispatch collapse

Tasks:
- Add `consensus_respond` tool definition.
- Add registry extraction and dispatch.
- Update translation and in-process driver callers.
- Update contract parser/type surface.

DoD:
- Direct unit tests can call `handleMcpToolCall(agent, "consensus_respond", ...)` for each legal action.
- Removed planning tool names are absent from advertised MCP tools and contract parser.
- Illegal actions return a soft protocol rejection.

### Step C - Test contract preservation

Tasks:
- Update tests named in section 2.
- Add focused coverage for old-name rejection and illegal action soft-reject.
- Keep API schema tests explicitly unchanged.

DoD:
- API `respond(message_type,message_payload)` tests pass unchanged in meaning.
- Mocked MCP and API consensus both pass.
- Removed old planning tool names do not survive in runtime tool lists, contract lists, or translated planning requests.

### Step D - Wire-contract lockstep v5 to v6

Tasks:
- Mutate AgentTalk contract first.
- Recompute hash.
- Copy byte-for-byte to client repo.
- Verify both sides and byte identity.

DoD:
- Version `6` on both copies.
- Same hash on both copies.
- Both verification scripts pass.
- Byte comparison passes.

### Step E - Build and live gate

Tasks:
- Build AgentTalk.
- Run focused and full tests.
- Run one live provider gate after contract verification.
- Record provider, hash, commands, and pollution check in the M11 implementation ledger.

DoD:
- `tsc -b` passes.
- Full suite passes.
- Live MCP gate passes on at least one available provider, or a model/quota failure is reported without widening production behavior.
- `git diff --stat`, `git status --short --branch`, and `git worktree list --porcelain` are recorded.

## 4. Wire-contract Lockstep Procedure

1. In AgentTalk, edit `packages/contracts/wire-contract.json`.
2. Change `version` from `5` to `6`.
3. In `data.mcpTools`, remove:
   - `agreement_proposal`
   - `agreement_acceptance`
   - `ack_planning_protocol`
   - `fact_collection_end`
   - `submit_plan`
4. Add:
   - `consensus_respond`
5. Recompute the hash with the existing algorithm:

```bash
node -e "const fs=require('fs'); const crypto=require('crypto'); const c=JSON.parse(fs.readFileSync('packages/contracts/wire-contract.json','utf8')); console.log(crypto.createHash('sha256').update(JSON.stringify(c.data,null,2)).digest('hex'))"
```

6. Write that hash into `packages/contracts/wire-contract.json`.
7. Verify AgentTalk:

```bash
node packages/contracts/scripts/verify-contract.js
```

8. Copy the whole file byte-for-byte:

```bash
cp packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json
```

9. Verify client:

```bash
(cd ../agentalk-mcp-client && node scripts/verify-contract.js)
```

10. Verify byte identity:

```bash
cmp -s packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json
```

11. Only after all three checks pass, run build/tests/live gate.

DoD:
- No code is run against mismatched contract copies.
- Any contract mismatch stops implementation work and is reported before live testing.

## 5. Test Matrix and Retry Budgets

Each attempt means one test run plus one in-scope fix. On the final allowed attempt, if it still fails, stop and report.

| Check | Command | Budget |
|---|---|---|
| Contract hash, AgentTalk | `node packages/contracts/scripts/verify-contract.js` | max 2 attempts |
| Contract hash, client | `(cd ../agentalk-mcp-client && node scripts/verify-contract.js)` | max 2 attempts |
| Contract byte identity | `cmp -s packages/contracts/wire-contract.json ../agentalk-mcp-client/wire-contract.json` | max 2 attempts |
| MCP tools drift guard | `npm test -- packages/runtime-core/src/registry/__tests__/mcp-tools.test.ts` | max 3 attempts |
| Translation tests | `npm test -- packages/runtime-core/src/agents/__tests__/translation.test.ts` | max 3 attempts |
| API schema tests | `npm test -- packages/runtime-core/src/agents/__tests__/response-schema.test.ts packages/runtime-core/src/agents/__tests__/completer.test.ts` | max 2 attempts |
| In-process driver tests | `npm test -- packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts` | max 2 attempts |
| Contract payload parser tests | `npm test -- apps/orchestrator/src/__tests__/protocol-payloads.test.ts` | max 3 attempts |
| Mocked MCP consensus | `npm test -- packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | max 3 attempts |
| Mocked API consensus | `npm test -- packages/runtime-core/src/registry/__tests__/team-api-consensus.test.ts` | max 2 attempts |
| TypeScript build | `tsc -b` | max 2 attempts |
| Full suite | `npm test` | max 2 attempts |
| Live MCP gate | `MCP_GATE_PROVIDER=<available-provider> node scripts/test-mcp-gate.mjs` or `node scripts/test-mcp-gate.mjs <available-provider>` | max 1 attempt per provider |
| AgentTalk markdown/diff hygiene | `git diff --check -- design packages apps scripts` | max 2 attempts |
| Client markdown/diff hygiene | `git -C ../agentalk-mcp-client diff --check -- wire-contract.json attach-skill.md` | max 2 attempts |

Live-gate rule:
- Use one currently available provider after build/tests/contract checks are green.
- If the live run fails from provider quota or model behavior after deterministic checks are green, stop and report. Do not change production behavior to satisfy a flaky live response.

## 6. Ledger Closure Requirements

Before claiming implementation done, update `design/milestone11-consensus-robustness-implementation.md` with:

- v6 contract hash.
- Exact contract verification commands and outputs.
- Focused test commands and final outputs.
- `tsc -b` and full-suite final outputs.
- Live provider used and final output.
- Pollution check:

```bash
git diff --stat
git status --short --branch
git worktree list --porcelain
```

Task closure telemetry should use the standard block from `AGENT.md`, including budget readings where available.

## 7. Out-of-scope / Stop Conditions

Stop and report before changing any of the following:

- API function name `respond`.
- API envelope field names `message_type` / `message_payload`.
- Coordinator phase semantics, retry/eject behavior, or legal action ordering.
- Phase-scoped dynamic MCP schemas or `tools/list` update behavior.
- Client executor logic outside contract verification/copying.
- Any compatibility shim that keeps old planning MCP tools accepted after v6. This requires explicit PO-approved rescope before implementation.
- Any full behavior change discovered while adapting tests.
