# Milestone 19 - Real CLI relay and ratio

**Status:** **Gate 1 approved after conditional refinements — implementation opens only after PO implementer assignment.**
**Backlog:** BL-027 (`doing`) is the epic driver; BL-018 and BL-026 are blocking enablers; BL-024 is a constraint.
**Program:** `design/self-hosting-program-draft.md`, M18 closed with relays 19 / substrate events 0.
**Prior evidence:** `design/spike2-consensus-real-cli-implementation.md` closed ATTACH-BLOCKED on 2026-07-11.
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** PO-assigned. **Implementation Reviewer:** Codex unless reassigned by PO.
**Task-end Reviewer:** Claude.

## Why

M18 proved the gate-over-channel substrate and fixed the first real attach wall, but it did not reduce the PO's
terminal relay burden. Its closure metric was **19 relays / 0 substrate events**, so C3 stayed deferred. SP2 then
answered the remaining unknown for M19: consensus over two real attached CLIs is not currently available. Codex can
reach native `await_turn`, Claude Code connects but denies the AgentTalk MCP tool call in non-interactive mode, and
the sibling `agentalk-mcp-client` contract is stale at v5 while AgentTalk is on v7.

M19 therefore must not pretend SDK MCP clients discharge the program metric. The milestone first repairs enough of
the real-CLI attach path to make a supported operator ritual, then uses plain role-to-role batons over that path to
produce the first real substrate-carried hand-off and report the BL-027 ratio.

## Goal

Deliver the smallest honest step from "real CLI attach is a hand-built proof trick" to "a real role hand-off can
cross AgentTalk and be counted":

- align the AgentTalk and `agentalk-mcp-client` wire contract enough that the current client no longer fails by
  design;
- provide a supported real-CLI attach ritual for Codex CLI and Claude Code, including non-interactive Claude tool
  permission grants;
- run one deliberately small role-to-role coordination step over real attached CLI sessions using plain batons, not
  consensus;
- report both the raw relay count and the substrate-carried ratio, with every terminal fallback declared.

## Outcome Rule

M19 has three possible honest outcomes:

| Outcome | Meaning |
|---|---|
| **C3 discharged** | T1/T2 pass, T3 records at least one real attached CLI workflow/baton event, and the closure reports the BL-027 ratio. |
| **ENABLER-BLOCKED** | T1 or T2 exposes an attach blocker that cannot be fixed inside the approved fence/budget. C3 remains deferred and M20 inherits the relay proof. |
| **REFUTED / replan** | Gate evidence shows the plan's premise is wrong, or an implementation needs scope growth such as full contract negotiation, provider/vendor refactor, or role-brief injection. |

SDK MCP clients may be used as controls, but they cannot satisfy the BL-027 numerator for M19.

## Non-goals

- No consensus-over-real-CLI path. SP2 says M19 should use plain batons for the file-agreement step.
- No full versioned contract negotiation unless T1 proves simple contract alignment is insufficient and the PO
  amends Gate 1.
- No broad provider refactor for BL-024. M19 records the observed `provider: "mcp"` shape and avoids provider-shaped
  timing assumptions; transport/vendor separation remains backlog unless the PO re-rules it.
- No BL-014 role-skill injection, BL-015 L1/L2 fences, or BL-016 growth/debrief mechanism.
- No `team-coordinator.ts` consensus behavior changes.
- No use of `scripts/m17-live-gate-proof.mjs` as proof evidence.
- No hidden terminal relay. Every manual baton/poke/config handoff is counted.

## Scope Fence

**Allowed, epic-wide:**

- This plan, `design/milestone19-real-cli-relay-implementation.md`, evidence under `design/evidence/**`, and
  documentation updates that reflect delivered behavior.
- Focused contract-alignment work in `packages/contracts/**` and `../agentalk-mcp-client/wire-contract.json` /
  its contract verification script/tests.
- Focused attach-runbook or operator script work needed to register/start agents, print per-CLI config, and prove
  the `creating` -> `start` trap is handled. New scripts should use an `m19-` prefix unless Gate 1 approves a
  stable general-purpose name.
- Focused real-CLI proof artifacts for Codex CLI and Claude Code.
- Existing M17 workflow-event channel and `send_to_agent` path for plain baton/gate events.

**Forbidden, epic-wide unless Gate 1 is amended:**

- `packages/runtime-core/src/registry/team-coordinator.ts` consensus/protocol behavior changes.
- New MCP tools or broad MCP schema redesign.
- Full wire-contract negotiation or compatibility matrix beyond T1's approved alignment/fail-fast slice.
- Provider/vendor architecture refactor for BL-024.
- Role-skill injection, provider write guards, substrate-administered worktrees, or role-capability enforcement.
- Weakening M16/M17 authority checks, M18 attach proof semantics, or SP2 evidence bars.

Cross-repo scope note: BL-022 remains open, so AgentTalk `scope-check` is not sufficient for M19. Every task that
touches `agentalk-mcp-client` must include manual status/diff checks in both repos.

## Substrate Coordination Spec

M19 measures the exact burden the program is meant to reduce.

For every task, the implementation ledger must include a **Coordination Evidence** block:

- substrate events recorded: any baton, workflow gate event, reviewer verdict, SM go/no-go, or role-to-role file
  agreement carried by AgentTalk;
- terminal fallback rows: one row per manual relay/poke/config handoff, with reason, sender role, receiver role,
  task, and artifact pointer;
- ratio: `substrate-carried role hand-offs / total role hand-offs` for that task;
- proof pointer: recorder file, debug log, command output, or runbook evidence.

Reading a UI is not a relay. PO decisions are not relays. Manual pasting between sessions, typing on another actor's
behalf, and poking an idle agent are relays.

## Task Breakdown

1. **M19-T1 - BL-018: contract alignment and stale-client guard.**
   Make the sibling real-CLI client no longer fail by design against the current AgentTalk server contract.

   Required shape:
   - Update `agentalk-mcp-client/wire-contract.json` to match the current AgentTalk v7 contract, or add a generated
     sync path that produces the same committed result.
   - Preserve the server-side hard reject on wrong hashes. This is not a protocol weakening task.
   - Add a focused check that fails when AgentTalk and client committed contracts diverge, with clear version/hash
     output.
   - Re-run the SP2 live harness control or a narrower equivalent to prove the stale v5 hash no longer blocks
     attach.

   Stop condition: if the implementation needs true multi-version negotiation, compatibility fallback, or an MCP
   schema redesign, stop and ask for a Gate-1 amendment before coding it.

2. **M19-T2 - BL-026: supported real-CLI attach ritual.**
   Turn SP2's hand-built ritual into a supported, reviewable operator path for Codex CLI and Claude Code.

   Required shape:
   - Register and start agents, assign workflow roles where needed, and print the per-agent WebSocket URL with the
     current contract hash.
   - Emit per-CLI config snippets without mutating global CLI config.
   - For Codex CLI, use the known working `mcp_servers.agenttalk-bridge` override shape.
   - For Claude Code, prove the non-interactive permission block is cleared with explicit `--allowedTools` and/or
     `--permission-mode` settings for the AgentTalk MCP tools. The required tool set must include at least
     `mcp__agenttalk-bridge__await_turn`, `mcp__agenttalk-bridge__send_to_agent`, and any other bridge tool used by
     the proof. The bar is functional, not just permission-shaped: Claude Code must call `await_turn`
     non-interactively and either block waiting on a real turn or receive one from AgentTalk.
   - Record failure modes cleanly: stale port/hash, missing `start`, denied Claude tool permission, and TUI
     unobservability.

   Stop condition: if Claude Code still cannot pre-approve `await_turn` after the documented permission knobs are
   used, close M19 as ENABLER-BLOCKED unless the PO authorizes a different proof vehicle.

3. **M19-T3 - BL-027: one real attached role hand-off and ratio.**
   Use the supported attach ritual to carry one small coordination act over real attached CLI sessions.

   Required shape:
   - Use plain batons, not consensus. The file-agreement step is a role-to-role message such as "planner proposes
     one low-risk AgentTalk file for a future refactor; reviewer acknowledges or challenges."
   - At least one real attached CLI session must emit a structured `workflow_gate_event` or baton-bearing
     `send_to_agent` that the brain accepts and records.
   - The event must be chosen by the attached CLI/tool call path, not injected by a proof script after the fact.
   - Provenance must be established by correlating the recorded `workflow_gate_attempt` to the attached agent's own
     WebSocket/bridge transaction for the same `send_to_agent` tool call: same agent id, same connection/run, same
     JSON-RPC request/tool name, and matching timestamp/order. If the current bridge output is insufficient, the
     proof must use an `m19-*` wrapper or run log that records the CLI-to-bridge transaction without mutating global
     CLI config. A recorder event alone is not enough.
   - The ledger must distinguish recorded workflow events from terminal relays and from SDK controls.
   - Report BL-027 for the task and milestone: raw terminal relays, substrate-carried hand-offs, denominator, and
     ratio.

   Stop condition: if T1/T2 did not produce a working real-CLI path, do not run T3 with SDK clients and call it a
   success. Use SDK clients only as controls and leave C3 deferred.

## DoD Claims

| Claim | Bar |
|---|---|
| M19-D1 | T1 closes the observed stale-contract blocker: AgentTalk and `agentalk-mcp-client` committed wire contracts are aligned or generated from one source, and a check fails on divergence. |
| M19-D2 | T1 preserves the server hard-reject semantics for wrong/missing hashes; no broad negotiation or compatibility fallback lands without a Gate-1 amendment. |
| M19-D3 | T2 provides a supported attach ritual for Codex CLI and Claude Code that uses fresh ports/hashes, starts agents out of `creating`, avoids global config mutation, and records exact commands/config. |
| M19-D4 | T2 proves Claude Code can call `await_turn` non-interactively and actually block on or receive an AgentTalk turn through explicit tool permission settings, or records ENABLER-BLOCKED with exact evidence. |
| M19-D5 | T3 records at least one real attached CLI substrate-carried baton or workflow event chosen through the real CLI MCP tool surface; provenance is verified by correlating recorder evidence to the attached agent's own bridge/WebSocket transaction log; SDK clients do not satisfy this row. |
| M19-D6 | T3 and closure report BL-027 honestly: raw relay count, substrate numerator, denominator, ratio, and every terminal fallback row. |
| M19-D7 | BL-024 is handled as a constraint only: provider values observed during real attach are recorded, and no provider-shaped timing assumption is introduced. |
| M19-D8 | Evidence bars are fresh-run based: no stale NDJSON, no `scripts/m17-live-gate-proof.mjs`, and no proof that would pass without the intended change. |
| M19-D9 | Freeze bar green: targeted tests, `npx tsc -b`, full `npm test`, client `npm run build` where touched, backlog validation, whitespace checks, pollution/process checks, and no forbidden-surface diff. |

## Verification Budgets

### M19-T1

| Check | Max attempts |
|---|---:|
| contract sync/alignment unit or script check | 3 |
| negative divergence fixture/probe | 3 |
| server wrong-hash hard-reject preservation | 2 |
| live harness or equivalent no-longer-v5 proof | 2 |
| AgentTalk targeted contract tests | 2 |
| client `npm run build` | 2 |
| `npx tsc -b` | 2 |
| full AgentTalk `npm test` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check` in both repos | 2 |
| cross-repo status/diff pollution check | 1 |

### M19-T2

| Check | Max attempts |
|---|---:|
| Codex CLI attach with printed config and `await_turn` | 2 |
| Claude Code attach with explicit allowed tools and functional `await_turn` block/turn receipt | 2 |
| missing-start / stale-port / stale-hash failure-mode probe | 2 |
| no global config mutation audit | 1 |
| runbook/script dry-run output check | 3 |
| targeted attach tests where code is touched | 2 |
| client `npm run build` if client code touched | 2 |
| AgentTalk targeted tests if AgentTalk code touched | 2 |
| `git diff --check` in touched repos | 2 |
| process/port cleanup report | 1 |

### M19-T3

| Check | Max attempts |
|---|---:|
| real attached CLI role hand-off proof | 2 |
| recorder assertion for accepted workflow/baton event | 2 |
| bridge/WebSocket transaction correlation proving event came from CLI MCP tool path, not SDK injection | 2 |
| BL-027 ratio audit | 2 |
| SDK control, if used, clearly labeled as non-numerator | 1 |
| M17 authority negative/positive preservation relevant to the event | 2 |
| full freeze bar | 1 |
| process/port/worktree cleanup report | 1 |

### Epic Closure

| Check | Max attempts |
|---|---:|
| DoD M19-D1..M19-D9 sweep from ledger/evidence | 1 |
| BL-027 milestone ratio calculation | 1 |
| backlog disposition update recommendations | 1 |
| task closure telemetry blocks present | 1 |

## Backlog Disposition Expected at Closure

- **BL-018:** done only if T1 provides contract alignment plus stale-client guard. If T1 discovers negotiation is
  needed and not delivered, leave open with evidence.
- **BL-026:** done only if T2 supports both Codex CLI and Claude Code without global config mutation. If Claude
  remains permission-blocked, leave open/blocked with evidence.
- **BL-027:** done for M19 only if T3 produces a real attached substrate numerator and ratio.
- **BL-024:** stays todo/deferred as architecture debt unless PO separately scopes it.
- **BL-022 / BL-023 / BL-025 / BL-028:** stay todo as constraints and review checks unless directly changed by PO.
- **BL-014 / BL-015 / BL-016:** stay deferred. Do not reopen role briefs, higher-tier fences, or debrief mechanism
  until the substrate carries actual coordination.

## Risks

1. **B-shaped proof creep.** SDK clients can make the recorder look good while leaving the PO's real terminal burden
   unchanged. The plan forbids counting them in the BL-027 numerator.
2. **T1 can turn into full negotiation.** The recurrence justifies contract alignment and a guard, not necessarily
   a compatibility framework. Full negotiation is a Gate-1 amendment.
3. **T2 can silently mutate operator state.** Global CLI config edits are forbidden; per-command config and generated
   snippets are the safe path.
4. **Claude permission may not be enough.** The CLI exposes `--allowedTools` and `--permission-mode`, but M19 must
   prove those knobs work for dynamic MCP tools rather than assuming it.
5. **Provider conflation can distort timing.** Real attached agents register as `provider: "mcp"` per SP2; do not
   rely on vendor-shaped timeout branches for M19 evidence.
6. **TUI capture remains weak evidence.** Prefer recorder events, debug logs, server logs, and explicit command
   output. Treat alt-screen captures as secondary.

## Gate 1 Review Focus

Claude should specifically challenge:

- whether T1 is too small for BL-018 recurrence, or too large for M19's small-bite constraint;
- whether T2's Claude permission bar is concrete enough to avoid another SP2-style blocked attempt;
- whether T3's numerator definition prevents SDK/proof-script theater;
- whether BL-024 should remain a constraint rather than a task;
- whether the plan has a clean ENABLER-BLOCKED outcome if real-CLI attach is still not affordable.
