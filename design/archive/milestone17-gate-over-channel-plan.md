# Milestone 17 - The gate over the channel

**Status:** Gate 1 approved with required amendments applied; awaiting quick re-check (2026-07-09).
**Backlog:** BL-019 (`doing`).
**Program:** `design/self-hosting-program-draft.md` (self-hosting M16 -> M18), M17 section and INCEPTION block.
**Prior epic:** M16 closed with one recorded workflow baton; M17 turns that metadata into brain-enforced workflow
authority.
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
**Task-end Reviewer:** Claude.

## Why

M16 proved that one workflow baton can travel through the real AgentTalk attach server and be recorded with
structured metadata. It did not decide whether the sender was allowed to make that workflow act. M17 closes that
gap for the gate path: reviewer verdicts and SM go/no-go messages become structured, recorded channel events whose
authority is checked by the brain before delivery.

The goal is workflow correctness, not adversarial security. The load-bearing design is the mapping from attached
session to agent identity to assigned workflow role. Origin tags are consequences of that mapping: `[SM]` is valid
only for the current SM-assigned agent/session, and `[PO]` is valid only from the trusted UI/API path (`[Human]`
is a legacy alias for that trusted source).

## Goal

AgentTalk can route, enforce, display, and record workflow-gate messages over the attach channel:

- a real Implementation Reviewer verdict travels through AgentTalk as a structured workflow event;
- a real SM go/no-go travels through AgentTalk as a structured workflow event;
- the brain refuses a PO-level act attempted by a non-`[Human]` sender;
- recordings and existing UI surfaces expose enough metadata for Gate 2/Gate 3 review.

## Non-goals

- No exec-bridge baton repair. BL-017 stays out of M17; direct SDK MCP clients are acceptable proof vehicles for
  the M17 live proof.
- No versioned wire-contract negotiation. BL-018 stays deferred; M17 may at most add a clearer contract version
  label if the implementation needs it for operator/debug clarity.
- No role-skill injection. BL-014 re-gates after M17 evidence.
- No broad workflow engine, consensus, arbiter, or planning-protocol redesign.
- No `team-coordinator.ts` behavior changes.
- No UI redesign. Existing conversation/runtime event surfaces are enough unless a tiny metadata display is needed
  to make the proof inspectable.
- No removal of terminal relay. Terminal remains a documented fallback channel.

## Scope Fence

**Allowed:**

- Add small contract types for workflow authority metadata and gate-channel events.
- Add a registry-owned session identity and workflow role assignment model for attached sessions.
- Extend the existing `send_to_agent`/MCP routing path so workflow-gate messages carry structured metadata and are
  refused before delivery when authority does not match the sender. Do not add a new MCP tool; this is
  wire-contract-hash-neutral because the current `wire-contract.json` tracks MCP tool names/packet types, not the
  `send_to_agent` argument schema.
- Record accepted and refused gate-channel events in NDJSON through the registry event -> `SessionRecorder` runtime
  channel.
- Surface gate-channel events through existing WebSocket/UI state with minimal presentation changes.
- Add focused tests for identity mapping, authorized delivery, unauthorized refusal, and recording shape.
- Add one live proof script or runbook using the real orchestrator attach server and direct SDK MCP clients.
- Update workflow docs to say the AgentTalk channel is primary for gate messages once M17 lands, with terminal as
  fallback.
- This plan and the M17 implementation ledger.

**Forbidden:**

- `packages/runtime-core/src/registry/team-coordinator.ts` behavior changes.
- Changes to consensus or arbiter state machines.
- Changes in `/Users/fausto/Software/agentalk-mcp-client` or the exec-bridge translation layer.
- Any implementation of contract-hash negotiation or compatibility fallback beyond a clearer version label.
- Broad auth/security claims. M17 enforces workflow authority for known attached sessions; it is not a security
  boundary against a hostile local operator.
- Hidden weakening of existing tests, identity harness baselines, or M16 baton behavior.

Any scope growth is an automatic Gate-1 hand-back to the PO/Architect/Plan Reviewer before implementation starts.

## Authority Model

M17 should introduce a small explicit workflow authority envelope on `send_to_agent`. The exact type names are
implementation details,
but the model should be this strict:

```ts
type WorkflowOrigin = '[Human]' | '[PO]' | '[SM]';

type WorkflowRole =
  | 'planner'
  | 'plan-reviewer'
  | 'implementation-reviewer'
  | 'task-end-reviewer'
  | 'implementer'
  | 'architect'
  | 'scrum-master'
  | 'product-owner';

type WorkflowGateEvent = {
  kind: 'workflow_gate_event';
  gate: 'gate-1' | 'gate-2' | 'gate-3' | 'backlog-gate';
  action: 'verdict' | 'go' | 'no-go' | 'baton' | 'po-act';
  originTag: WorkflowOrigin;
  fromAgentId?: string;
  fromRole: WorkflowRole;
  toAgentId?: string;
  toRole?: WorkflowRole;
  taskId?: string;
  eventId: string;
};
```

The mapping source should be registry-owned and deterministic for the proof: when an attached session registers or
activates, the brain can associate that agent id with a workflow role assignment for the current proof/task. The
implementation must not infer authority from bracketed text alone. If the payload says `[SM]` but the sender's
registered role is not the current SM authority, the brain refuses the workflow event before it is recorded as a
delivered gate message.

`[PO]` is the canonical PO-origin tag. `[Human]` is a legacy alias for the same trusted source, kept only so older
wording and artifacts remain interpretable. PO-origin is valid only from the trusted UI/API path, not from an
attached agent session. The negative test must prove that an attached non-human session cannot make a PO-level act
simply by sending `[PO]` or `[Human]` metadata. Building a full PO approval workflow is out of scope.

## Task Breakdown

1. **M17-T1 - Session identity, workflow role assignments, and authority checks.**
   Define the minimal contract/runtime model for mapping attached agent ids to workflow roles and allowed origins.
   Add focused registry tests proving:
   - an assigned Implementation Reviewer can emit a reviewer verdict event;
   - the assigned SM can emit a go/no-go event;
   - a non-SM attached agent cannot emit an `[SM]` workflow event;
   - a non-human attached agent cannot emit a PO-level or `[Human]` workflow event;
   - ordinary non-workflow `send_to_agent` behavior is unchanged.

2. **M17-T2 - Gate event recording and UI surfacing.**
   Emit a registry event for every workflow-gate attempt and record it through the `SessionRecorder` runtime
   channel with enough metadata for review. Accepted and refused events both ride this registry event -> recorder
   path. Refused events must throw before delivery and therefore must not depend on the conversation-gated transcript
   path at `registry.ts:426`; a refusal cannot create a delivered conversation transcript entry. Surface accepted
   and refused gate-event status through existing WebSocket/UI event paths. Keep presentation small:
   the reviewer must be able to inspect who acted, what role they acted as, the gate/action, and whether the brain
   accepted or refused it.

3. **M17-T3 - Live gate-over-channel proof and docs.**
   Add or update a live proof script/runbook against the real orchestrator attach server using direct SDK MCP
   clients. The proof should attach at least three seats for the scenario:
   - an Implementation Reviewer session that sends a real verdict;
   - an SM session that sends a real go/no-go;
   - a non-human session that attempts a PO-level act and is refused.

   Commit the NDJSON evidence and update workflow docs to name AgentTalk as the primary channel for reviewer
   verdicts and SM go/no-go once M17 is merged, with terminal fallback still documented.

## DoD Claims

| Claim | Bar |
|---|---|
| C1 | A real Implementation Reviewer verdict and a real SM go/no-go are delivered through AgentTalk with structured workflow metadata and recorded in NDJSON. |
| C2 | A PO-level act (`[PO]`, or legacy alias `[Human]`) attempted by an attached non-human session is refused by the brain before delivery; the refusal is test-proven and recorded via the runtime gate-event channel. |
| C3 | Session -> agent identity -> workflow role mapping is explicit in runtime state and used for enforcement; bracketed payload text alone is never authoritative. |
| C4 | Existing non-workflow messaging behavior is preserved, including ordinary `send_to_agent` delivery, M16 baton metadata, user messages, and pair conversations. |
| C5 | Accepted and refused gate events are inspectable through existing UI/WebSocket/recording surfaces without a broad UI redesign; refusal evidence does not rely on conversation transcripts. |
| C6 | Out-of-fence items remain out: no exec-bridge baton repair (BL-017), no contract negotiation (BL-018), and no client-repo changes. |
| C7 | Freeze bar green: targeted tests, `npx tsc -b`, full `npm test`, M14 identity harness, `npm run backlog:check`, whitespace checks, pollution checks, and zero `team-coordinator.ts` diff. |

## Live Proof Shape

The proof should mirror M16's proven topology:

1. Start the real orchestrator with a dedicated MCP port and recording path, e.g.
   `PORT=3000 AGENTTALK_MCP_PORT=9898 AGENTTALK_RECORDING_PATH=./recordings node apps/orchestrator/dist/index.js serve`.
2. Use direct `@modelcontextprotocol/sdk` MCP clients to attach deterministic sessions to the real WebSocket MCP
   server. This is the approved proof vehicle for M17 because the exec bridge cannot carry baton/workflow metadata
   yet.
3. Register workflow role assignments for the proof sessions through the implementation's selected minimal path.
4. Establish the proof conversation topology explicitly: active conversations may exist for accepted
   agent-to-agent deliveries, such as `implementation-reviewer-seat -> implementer-seat` for the verdict and
   `sm-seat -> planner-seat` for the go/no-go. These conversations prove delivered message visibility only; the
   authoritative gate-event evidence is still the runtime recorder event.
5. Drive one accepted Implementation Reviewer verdict over the channel.
6. Drive one accepted SM go/no-go over the channel.
7. Drive one refused non-human PO-level act over the channel. This attempt should target a plausible PO/trusted
   channel but must throw before delivery; no active conversation transcript entry is expected or acceptable as the
   refusal proof.
8. Inspect the recording and UI/WebSocket state for accepted runtime gate events and the refused runtime gate event.

The proof must state its limitation in the ledger: it proves brain-side channel/enforcement with direct SDK MCP
clients. It does not prove real CLI sessions can emit the same envelopes; that remains BL-017.

## Verification Budgets

| Check | Max attempts |
|---|---:|
| Targeted authority mapping/enforcement tests | 3 |
| Targeted recording/UI event tests | 3 |
| Existing non-workflow messaging regression tests | 2 |
| Live gate-over-channel proof | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `npm run backlog:check` | 1 |
| `git diff --check && git diff --cached --check` | 2 |
| Pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

## Risks

1. **Authority mapping could become too implicit.** If the implementation only checks payload text or agent ids by
   convention, the refusal test is weak. The role assignment must be data owned by the brain.
2. **BL-017 pressure may re-enter through the proof.** The plan explicitly permits direct SDK MCP clients. If a
   reviewer requires real CLI sessions for M17, the scope must return to the PO before implementation.
3. **Contract churn could trigger BL-018 temptation.** If the implementation changes the wire contract, use the
   existing manual PO-gated sync process. Do not build negotiation.
4. **UI polish could sprawl.** Inspectability is the bar; presentation quality can improve later.
5. **Role vocabulary may collide with existing team roles.** `TeamRole` currently only models planner/worker. M17
   should add a separate workflow-role concept rather than overloading team execution roles.

## Gate 1 Rulings Applied

Plan Reviewer approved the plan with required amendments on 2026-07-09. Amendments applied here:

1. Accepted and refused gate events ride the registry event -> `SessionRecorder` runtime channel. Refusals throw
   before delivery and cannot rely on conversation transcripts.
2. `[PO]` is canonical; `[Human]` is a legacy alias. PO-origin is valid only from the trusted UI/API path.
3. Extend `send_to_agent`; do not add a new MCP tool. This is hash-neutral against the current `wire-contract.json`
   because the contract records the tool name, not the argument schema.
