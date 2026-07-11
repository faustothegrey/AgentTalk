# Milestone 20 - PO-approved relay

**Status:** Gate 1 condition folded, pending Plan Reviewer full approval.
**Backlog:** BL-030 (`doing`) is the epic driver. BL-028 is adjacent but not M20 work.
**Program:** `design/self-hosting-program-draft.md` M20.
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** PO-assigned after Gate 1. **Implementation Reviewer:** Codex unless
reassigned by PO. **Task-end Reviewer:** Claude unless reassigned by PO.

## Why

M19 proved real attached CLIs can carry baton-bearing `send_to_agent` calls through AgentTalk, but its two substrate
rows were demonstration relays. The remaining program work is reducing the PO's real terminal burden during ordinary
development coordination.

M20 is the smallest mechanism step: AgentTalk computes an agent-to-agent relay, holds it pending the PO's one-click
approval in the UI when approval mode is enabled, and delivers it only on yes. The PO stays the reference clock. PO
gates, opinions, merges, and direct PO-channel messages remain outside AgentTalk mediation.

## Goal

Deliver one approval-gated agent-to-agent relay path:

- approval mode is explicit and default OFF, preserving today's ordinary `send_to_agent` behavior;
- when approval mode is ON, `send_to_agent` to another agent returns promptly with a clear pending-approval result;
- the relay is stored in a distinct pending-relay lifecycle, not in M17's authority verdict;
- the UI shows the pending relay with from/to, payload, baton, and workflow gate metadata;
- PO approve delivers through the existing `sendProtocol` -> `agent.queueTurn` path;
- PO deny records the denial and delivers nothing;
- `to === 'user'` and terminal fallback remain unchanged.

## Ratified Design Decisions

1. **Async, not blocking.** Human latency must not live inside the sender's MCP tool call. The sender receives
   "pending PO approval" and the relay waits in a queue.
2. **Reuse the existing target turn queue.** On approval, call the existing delivery path. `sendProtocol` queues the
   `message_received` event; `Agent.queueTurn` resolves an active waiter or stores it for the next `await_turn`.
3. **Separate audit lifecycle.** `workflow_gate_attempt: accepted` means authority accepted before delivery. It does
   not mean PO-approved or delivered. M20 adds a separate relay lifecycle:
   `pending`, `approved_delivered`, `denied`, `delivery_failed`.
4. **PO reference clock.** Only agent-to-agent relays move. The PO channel and human gate authority remain direct and
   manual.
5. **Conditional approval mode.** The gate is not universal. Mode OFF is the default and preserves ordinary
   immediate delivery and transcript recording. Mode ON is approve-each, and is the only mode M20 implements. Later
   dimmer steps such as approve-by-exception or autonomous delivery stay future work.

## Outcome Rule

| Outcome | Meaning |
|---|---|
| **M20 delivered** | A real agent-to-agent relay is held, approved by the PO, delivered over the substrate, and recorded with separate authority and approval lifecycle evidence. |
| **ENABLER-BLOCKED** | The pending-relay path or UI approval surface cannot be made reliable inside the approved fence without changing PO-channel semantics, MCP schema, or autonomous wake. |
| **REFUTED / replan** | Gate evidence shows the plan premise is wrong, or implementation requires out-of-scope behavior such as blocking sender tool calls, client changes, or scope-write enforcement. |

## Non-goals

- No mediation of `to === 'user'`, PO gates, PO opinions, PO merge decisions, or terminal fallback.
- No autonomous wake. The PO's yes action is enough for M20; BL-028 remains adjacent.
- No 3+ agent routing, nested delegation, thread-correlation redesign, or consent relaxation beyond the explicit
  OFF/default and approve-each ON modes.
- No scope-write enforcement, role-skill injection, or provider/vendor refactor.
- No MCP tool/schema redesign, wire-contract version change, or sibling `agentalk-mcp-client` change.
- No weakening of the M17 authority check or relabeling of `workflow_gate_attempt`.
- No arbiter/team-coordinator routing changes. M20 gates the plain `send_to_agent` delivery branch at the existing
  delivery call, not coordinator-internal message sends.

Automatic Gate-1 hand-back: if the plan reviewer concludes any of the non-goals above are required for the first
bite, M20 must be replanned before implementation opens.

## Scope Fence

**Allowed, epic-wide:**

- `design/milestone20-po-approved-relay-plan.md`
- `design/milestone20-po-approved-relay-implementation.md`
- `design/evidence/**`
- Focused shared types for pending relays in `packages/contracts/src/**` and `apps/web/src/api/types.ts`
- `packages/runtime-core/src/registry/registry.ts`
- Focused registry tests under `packages/runtime-core/src/registry/__tests__/**`
- `apps/orchestrator/src/server.ts`
- Focused orchestrator server tests under `apps/orchestrator/src/__tests__/**`
- Focused UI work under `apps/web/src/**`
- New `scripts/m20-*` proof helpers only if needed for fresh evidence

**Forbidden unless Gate 1 is amended:**

- `../agentalk-mcp-client/**`
- `packages/contracts/wire-contract.json`
- `packages/mcp-transport/**`
- New MCP tools or MCP schema changes
- `to === 'user'` behavior changes beyond tests proving it is unchanged
- PO gate/opinion/merge mediation
- Autonomous wake / BL-028
- Consent relaxation beyond OFF/default and approve-each ON
- Approval mode default changes
- Multi-agent or nested relay routing
- Arbiter/team-coordinator routing changes
- `packages/runtime-core/src/conversations/runtime.ts` behavior changes
- Scope-write enforcement / BL-015 L1/L2
- Broad provider/vendor refactor / BL-024

## Pending-Relay Lifecycle Spec

### Record Shape

The registry owns an in-memory pending-relay store for M20. Persistence can remain out of scope for the first bite.

```ts
type PendingRelayStatus =
  | 'pending'
  | 'approved_delivered'
  | 'denied'
  | 'delivery_failed';

interface PendingRelay {
  id: string;
  status: PendingRelayStatus;
  fromAgentId: string;
  toAgentId: string;
  payload: string;
  replyToMessageId?: string;
  baton?: unknown;
  workflowEvent?: unknown;
  createdAt: string;
  decidedAt?: string;
  deliveredAt?: string;
  deliveryError?: string;
}
```

Implementation may refine field names during coding, but the semantics above are fixed. A pending relay is distinct
from a workflow gate attempt.

### Approval Mode

M20 introduces an explicit approval mode in the registry/orchestrator layer:

```ts
type RelayApprovalMode = 'off' | 'approve_each';
```

The default is `off` on startup. In mode `off`, ordinary `send_to_agent` is byte-for-byte semantic preservation:
immediate delivery, immediate conversation transcript recording, and the existing success text. Mode `approve_each`
enables the pending-relay lifecycle for the plain agent-to-agent delivery branch. This mode is the first dimmer
position; later positions are not M20 work.

Preserved-when-off contracts:

- `packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts`, test "preserves ordinary non-workflow
  send_to_agent behavior";
- `packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts`, transcript-on-send behavior;
- `packages/runtime-core/src/conversations/runtime.ts`, automated conversation replies that emit
  `send_to_agent(to=peer)`.

### Sender Flow

For `send_to_agent` with `to !== 'user'` on the plain agent-to-agent delivery branch:

1. Preserve duplicate-terminal-action handling.
2. Preserve M17 authority validation exactly. If authority refuses, emit `workflow_gate_attempt` with
   `result:'refused'` and throw as today.
3. If authority accepts, emit `workflow_gate_attempt` with `result:'accepted'`. This remains a pre-delivery authority
   result.
4. Preserve the existing arbiter/team special-case branch as out of scope.
5. If approval mode is `off`, execute today's immediate delivery and transcript-recording path unchanged.
6. If approval mode is `approve_each`, validate target existence and the current ready/busy status as today before
   creating a pending relay. This keeps M06 preserve-behavior discipline for invalid targets.
7. Create a `PendingRelay` with `status:'pending'`, emit/broadcast a pending-relay lifecycle event, mark the sender's
   terminal action complete, and return a tool result such as "Message pending PO approval."
8. Do not call `sendProtocol` and do not record the conversation message yet.

### Approve Flow

For PO approval:

1. Re-read the pending relay and require `status:'pending'`.
2. Revalidate target status and conversation reply cap at delivery time. If delivery is no longer legal, set
   `status:'delivery_failed'` with `deliveryError`, emit/broadcast it, and do not deliver.
3. Call the existing delivery path:
   `sendProtocol(toAgentId, 'EVT', { type:'message_received', from, payload, replyToMessageId? })`.
4. Record the conversation message only after successful delivery, preserving baton and workflowEvent metadata.
5. Set `status:'approved_delivered'`, set `deliveredAt`, and emit/broadcast the lifecycle update.

Because `sendProtocol` already calls `agent.queueTurn`, an awaiting target receives immediately and a non-polling
target receives on its next `await_turn`.

### Deny Flow

For PO denial:

1. Re-read the pending relay and require `status:'pending'`.
2. Set `status:'denied'` and `decidedAt`.
3. Emit/broadcast the lifecycle update.
4. Deliver nothing to sender or target in M20. The sender already received a pending result; any follow-up remains a
   terminal fallback or future work.

## Server and UI Surface

The orchestrator exposes pending relays to the web UI:

- broadcast event: `pending_relay_updated` with the full relay record;
- connect-time snapshot: current non-terminal pending relays;
- approval-mode snapshot/update, defaulting to `off`;
- PO commands, preferably through the existing WebSocket switch:
  `set_relay_approval_mode`, `approve_pending_relay`, and `deny_pending_relay`.

The web UI adds a small approval panel, not a new landing page:

- list pending relays with from, to, payload preview, baton id/roles when present, and workflow gate/action when
  present;
- expose the approval mode clearly as OFF/default or approve-each ON;
- show `workflow_gate_attempt` events as authority-only, retaining the current "accepted (pre-delivery)" language;
- approve and deny buttons;
- visible delivered/denied/failure state until superseded or cleared by the existing event history.

## Task Breakdown

1. **M20-T1 - Core pending-relay lifecycle.**

   Implement the registry-side store, lifecycle events, async `send_to_agent` hold, approval delivery, denial, and
   delivery-failed path.

   Required shape:
   - authority validation still happens before a pending relay is created;
   - `workflow_gate_attempt` remains authority-only;
   - existing arbiter/team special-case routing remains out of scope and unchanged;
   - approval mode defaults OFF and ordinary `send_to_agent` remains today's immediate-deliver-and-record behavior;
   - when approval mode is ON, `send_to_agent` to another agent returns pending promptly and does not deliver before approval;
   - approval delivers through existing `sendProtocol`;
   - denial delivers nothing;
   - `to === 'user'` behavior is unchanged.

   Stop condition: if implementation requires changing MCP tool schemas, the sibling client, or the PO channel,
   stop and ask for a Gate-1 amendment.

2. **M20-T2 - Orchestrator and UI approval surface.**

   Wire the pending-relay lifecycle into the server/WebSocket layer and the web UI.

   Required shape:
   - server records lifecycle events separately from `workflow_gate_attempt`;
   - server/UI surface the approval mode and default it OFF;
   - UI receives a snapshot and live updates;
   - approve/deny buttons call the server and update state;
   - no UI affordance implies AgentTalk controls PO gates, opinions, or merges.

   Stop condition: if the UI requires a broader navigation redesign or persistent storage to satisfy C1, stop and
   ask for a scope decision rather than expanding the bite.

3. **M20-T3 - Fresh proof, relay metric, and closure evidence.**

   Prove the mechanism during one real agent-to-agent hand-off.

   Required shape:
   - mode-off ordinary behavior is re-proven before the mode-on proof;
   - at least one real attached CLI source emits a baton-bearing `send_to_agent` to another agent;
   - AgentTalk records M17 authority accepted, then separately records pending relay pending;
   - before PO approval, the target has not received the turn;
   - PO approval through the UI/WS surface delivers the held message;
   - target receives through `await_turn` or queued delivery on the next `await_turn`;
   - PO denial is also proven in a focused negative check, with no target delivery;
   - terminal fallback remains available and every manual relay/fallback row is counted.

   Stop condition: if the proof can only pass by scripting direct delivery around the pending-relay approval path,
   do not claim C3. Record the blocker.

## DoD Claims

| Claim | Bar |
|---|---|
| M20-D1 | With approval mode ON, agent-to-agent `send_to_agent` is async: returns pending PO approval without waiting on a human, and no target delivery occurs before approval. |
| M20-D2 | M17 authority lifecycle and M20 approval lifecycle are distinct in records, events, UI, and tests. `workflow_gate_attempt: accepted` never means PO-approved or delivered. |
| M20-D3 | PO approval delivers via the existing queue path. A waiting target receives immediately; a non-polling target receives on its next `await_turn`. |
| M20-D4 | PO denial records `denied` and delivers nothing to the target. Delivery failure records `delivery_failed` without pretending success. |
| M20-D5 | Approval mode defaults OFF and preserves ordinary behavior: non-workflow `send_to_agent`, baton transcript-on-send, automated conversation-runtime replies, `to === 'user'`, PO gates/opinions/merges, and terminal fallback are not mediated by AgentTalk. |
| M20-D6 | The web UI and WS/server surface show pending relays, expose approval mode, and allow one-click approve/deny with visible lifecycle updates. |
| M20-D7 | Fresh evidence proves one real agent-to-agent baton crosses the substrate under PO approval during actual work, with terminal fallback rows and relay metrics reported honestly. No proof may pass without the pending-relay change. |
| M20-D8 | Freeze bar green: targeted tests, `npx tsc -b`, `npm run build`, full `npm test`, backlog validation, whitespace checks, pollution/process checks, and no forbidden-surface diff. |

## Verification Budgets

### M20-T1

| Check | Max attempts |
|---|---:|
| registry pending-relay unit tests | 3 |
| authority-vs-approval separation tests | 3 |
| mode-off ordinary non-workflow `send_to_agent` regression | 2 |
| mode-off baton transcript-on-send regression | 2 |
| mode-off conversation runtime auto-reply regression | 2 |
| `to === 'user'` unchanged regression | 2 |
| approval delivery to active `await_turn` waiter | 2 |
| approval delivery queued until next `await_turn` | 2 |
| deny and delivery-failed negative tests | 2 |
| targeted registry tests | 2 |
| `npx tsc -b` | 2 |
| `git diff --check` | 2 |

### M20-T2

| Check | Max attempts |
|---|---:|
| server WS snapshot/update tests | 3 |
| approval mode default-off and update tests | 3 |
| approve/deny command tests | 3 |
| recorder event shape test | 2 |
| focused UI render/state test if local harness exists; otherwise `npm run build --workspace @agenttalk/web` | 2 |
| `npm run build` | 2 |
| `git diff --check` | 2 |

### M20-T3

| Check | Max attempts |
|---|---:|
| fresh real attached CLI pending-relay proof | 2 |
| mode-off ordinary behavior control | 2 |
| pre-approval no-delivery assertion | 2 |
| PO approval through UI/WS delivers held relay | 2 |
| target queued-delivery proof | 2 |
| PO denial no-delivery proof | 2 |
| relay metric and terminal fallback audit | 2 |
| full `npm test` | 1 |
| `npm run build` | 1 |
| `npm run backlog:check` | 1 |
| pollution/process cleanup report | 1 |

### Epic Closure

| Check | Max attempts |
|---|---:|
| M20-D1..M20-D8 sweep from ledger/evidence | 1 |
| forbidden-surface diff audit | 1 |
| fresh evidence audit against IP-15 | 1 |
| program relay metric update | 1 |

## Gate 1 Review Focus

The plan reviewer should focus on these questions:

1. Does the async pending-relay design preserve sender tool-call safety better than blocking?
2. Are M17 authority acceptance and M20 PO approval/delivery unmistakably separate?
3. Is the queue reuse claim sufficiently grounded in `sendProtocol` and `Agent.queueTurn`?
4. Is the `to === 'user'` path protected strongly enough?
5. Are autonomous wake, consent relaxation, and scope-write enforcement clearly excluded?
