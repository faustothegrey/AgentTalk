# M20 - PO-approved relay - Implementation Ledger

**Status:** **Gate 1 APPROVED (fold verified by Plan Reviewer Claude, 2026-07-11).** Implementation may open on T1.
**Plan:** `design/milestone20-po-approved-relay-plan.md`
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** **Codex (PO-assigned, epic-scoped, 2026-07-11 `[PO]`)** — Gemini is the
default; straight PO reassignment. **Implementation Reviewer (gate 2):** **Claude** (shuffled from Codex — the
implementer cannot review its own work). **Task-end Reviewer (gate 3):** Claude *(concentration note below)*.

> **⚠️ Concentration note (SM/architect flag).** As in M19, Codex plans+implements while Claude holds gate 1 + gate 2
> + gate 3 + architect + SM. Gates stay independent *of the implementer* (Codex ≠ reviewer). The gate-2/gate-3
> fresh-eyes separation is doubled up (declared, PO-accepted); merges stay PO-gated. Decide before closure whether to
> route the gate-3 sweep to fresh eyes (PO or Gemini) or accept the doubling.

This ledger records M20 claims, verifier verdicts, coordination evidence, implementation signals, and closure
telemetry.

## Gate 1 Review (Plan Reviewer: Claude, 2026-07-11) — CONDITIONAL (one required amendment)

**The design is sound and I verified its load-bearing code claims** (not just read them): the Sender-Flow steps map
exactly onto `registry.ts:374-458` (authority check `:379-395` → arbiter branch `:407-411`, correctly excluded →
target validation `:422-427` → the single `sendProtocol` delivery `:438-443`); the `queueTurn` reuse holds
(`registry.ts:580`, `agent.ts:81-90`); the WS command switch exists to extend (`server.ts:890`, cases
`attach`/`message`/`team_message` + default); the separate-lifecycle and IP-15 bars are right. Async-not-blocking is
the correct call.

**REQUIRED AMENDMENT (blocks approval) — the gate must be conditional, not universal.** The plan gates **every**
agent-to-agent `send_to_agent` delivery. But that path is a live behavior contract, and holding it universally breaks
three grounded things:
- **`m17-gate-channel.test.ts:93`** — a test named *"preserves ordinary non-workflow send_to_agent behavior"* asserts
  a plain send resolves to `{text:'Message sent successfully'}`. M20 makes it `"pending PO approval"` → **breaks the
  exact contract it protects.**
- **`baton-metadata.test.ts`** — asserts the conversation transcript records the message on send; M20 defers
  recording until approval → **breaks.**
- **`packages/runtime-core/src/conversations/runtime.ts:251`** — *production* code auto-emits `send_to_agent(to=peer)`
  for in-process/api agent conversations. Under a universal gate those auto-replies **hang forever** (no PO approves
  an automated chat) → a **functional regression**, not just a test.

This collides with the plan's own M06 "preserve-behavior" claim. **Fix (recommended, and it *strengthens* the
design):** make the approval gate **conditional — an explicit approval mode, default OFF.** Mode OFF → ordinary
`send_to_agent` behaves exactly as today (immediate delivery + transcript recording; existing tests + the
conversation runtime untouched). Mode ON (what the PO switches on to babysit) → agent→agent relays are held for
approval. This preserves every existing contract, matches the PO's intent, and *is* the dimmer (OFF → approve-each →
approve-by-exception → autonomous are settings on the same switch). The plan must: (a) add the mode trigger to the
Sender Flow; (b) name `m17-gate-channel.test.ts:93` / `baton-metadata.test.ts` / `conversations/runtime.ts` as
contracts preserved when the mode is off; (c) extend **M20-D5** to "ordinary `send_to_agent` unchanged when approval
mode is off," with a regression test proving it.

**Verdict: CONDITIONAL — approve on this one amendment.** Everything else (async, lifecycle, queue reuse, fence,
UI/WS, evidence bars) stands. Fold the amendment and re-post; Gate 1 flips to full approval.

### Gate 1 focus questions (answered)
1. Async safer than blocking — **yes** (agreed; verified the tool-timeout reasoning).
2. Authority vs PO-approval separation — **yes**, clean (D2 + separate lifecycle).
3. Queue reuse grounded — **yes**, verified in code.
4. `to === 'user'` protected — **yes for the user branch; but the *ordinary agent→agent* path is not**, per the
   required amendment above.
5. Wake / consent-relaxation / scope-enforcement excluded — **yes**, clearly.

### Condition Fold (Planner: Codex, 2026-07-11)

Folded the required amendment into the plan:

- added explicit `RelayApprovalMode = 'off' | 'approve_each'`;
- made `off` the startup default and specified today's immediate-deliver-and-record behavior when off;
- limited pending-relay hold behavior to `approve_each`;
- named the preserved-when-off contracts:
  `m17-gate-channel.test.ts` ordinary non-workflow `send_to_agent`,
  `baton-metadata.test.ts` transcript-on-send, and
  `packages/runtime-core/src/conversations/runtime.ts` automated peer replies;
- extended M20-D5 and verification budgets with mode-off regressions;
- added server/UI approval-mode snapshot/update to T2.

Implementation remains closed until Gate 1 full approval is confirmed and the PO assigns the implementer seat.

**Fold verified — Gate 1 FULLY APPROVED (Plan Reviewer: Claude, 2026-07-11).** I checked the fold against the **plan**
(not this ledger): `RelayApprovalMode = 'off' | 'approve_each'` (plan L139), default `off` = "byte-for-byte semantic
preservation" (L142), the Sender Flow branches on mode (L165-166), all three preserved-when-off contracts named
(L147-152: `m17-gate-channel.test.ts` ordinary send, `baton-metadata.test.ts` transcript-on-send,
`conversations/runtime.ts` auto-replies), M20-D5 extended (L275), and mode-off regressions in the budgets. The one
condition is resolved; the design premises were already verified above. **Gate 1 is closed APPROVED.** PO assigned
**Codex** as M20 implementer (`[PO]`, 2026-07-11) → gate 2 shuffles to Claude. Next: T1 opens on branch
`m20-t1-pending-relay-core`.

## Grounding Facts

- Interposition point: `packages/runtime-core/src/registry/registry.ts` agent-to-agent delivery currently calls
  `sendProtocol(targetAgent.id, 'EVT', { type:'message_received', ... })` after the M17 authority check and after
  the `to === 'user'` branch.
- Arbiter/team special-case routing sits before that plain delivery call and is out of scope for M20's first bite.
- M17 authority check: `workflow_gate_attempt: accepted` means authority accepted before delivery. It is not PO
  approval or delivery.
- Queue reuse: `sendProtocol` queues `EVT` payloads through `agent.queueTurn`; `Agent.queueTurn` resolves a waiting
  turn or stores the payload for the next `await_turn`.
- Approval mode is explicit and defaults OFF. Mode OFF must preserve ordinary immediate delivery and transcript
  recording; mode `approve_each` enables the M20 pending-relay lifecycle.
- M20 must preserve the PO reference clock: PO gates, opinions, merge decisions, and `to === 'user'` remain direct.

## Claim / Verdict Ledger

| Item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| M20-D1 - mode-on async pending agent-to-agent relay; no pre-approval delivery | pending | pending | M20-T1 / M20-T3 |
| M20-D2 - M17 authority lifecycle separate from M20 PO approval lifecycle | pending | pending | M20-T1 / M20-T2 / M20-T3 |
| M20-D3 - approval delivers through existing queue path, including next-`await_turn` delivery | pending | pending | M20-T1 / M20-T3 |
| M20-D4 - denial and delivery failure do not pretend delivery success | pending | pending | M20-T1 / M20-T2 |
| M20-D5 - mode-off ordinary send behavior, PO channel, and terminal fallback preserved | pending | pending | all tasks |
| M20-D6 - UI/WS approval surface and approval mode works | pending | pending | M20-T2 / M20-T3 |
| M20-D7 - fresh real approved relay proof and honest relay metric | pending | pending | M20-T3 / closure |
| M20-D8 - freeze bar green and forbidden surfaces clean | pending | pending | closure |

## Coordination Baseline

M19 closed with a capability proof: two real attached CLIs carried demonstration substrate relays, ratio **2/~9**.
The program caveat remains: those were not organic burden-reduction relays during a normal dev epic. M20 must report
the actual terminal fallback rows, pending relays proposed, approved/delivered relays, denied relays, delivery
failures, and substrate ratio for its work.

## M20-T1 - Core pending-relay lifecycle

**Status:** pending Gate 1 / PO implementer assignment.
**Branch:** `m20-t1-pending-relay-core` when implementation begins.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone20-po-approved-relay-plan.md
    - design/milestone20-po-approved-relay-implementation.md
    - design/evidence/**
    - packages/contracts/src/**
    - packages/runtime-core/src/registry/registry.ts
    - packages/runtime-core/src/registry/__tests__/**
    - apps/orchestrator/src/__tests__/conversation-runtime.test.ts
  forbidden:
    - ../agentalk-mcp-client/**
    - packages/contracts/wire-contract.json
    - packages/mcp-transport/**
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/conversations/runtime.ts
    - apps/web/src/**
    - apps/orchestrator/src/server.ts
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | pending | 0 |
| terminal fallbacks | pending | 0 |
| ratio | pending | pending |

## M20-T2 - Server and UI approval surface

**Status:** pending M20-T1.
**Branch:** `m20-t2-relay-approval-ui` when implementation begins.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone20-po-approved-relay-implementation.md
    - design/evidence/**
    - packages/contracts/src/**
    - apps/orchestrator/src/server.ts
    - apps/orchestrator/src/__tests__/**
    - apps/web/src/**
  forbidden:
    - ../agentalk-mcp-client/**
    - packages/contracts/wire-contract.json
    - packages/mcp-transport/**
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/registry/mcp-tools.ts
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | pending | 0 |
| terminal fallbacks | pending | 0 |
| ratio | pending | pending |

## M20-T3 - Fresh proof and closure metric

**Status:** pending M20-T2.
**Branch:** `m20-t3-approved-relay-proof` when implementation begins.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone20-po-approved-relay-implementation.md
    - design/evidence/**
    - scripts/m20-*
    - scripts/__tests__/**
    - apps/orchestrator/src/__tests__/**
    - packages/runtime-core/src/registry/__tests__/**
  forbidden:
    - ../agentalk-mcp-client/**
    - packages/contracts/wire-contract.json
    - packages/mcp-transport/**
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/registry/mcp-tools.ts
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | pending | 0 |
| terminal fallbacks | pending | 0 |
| ratio | pending | pending |

## Impediments

| ID | What blocked | Blocks | Status | Unblock condition |
|---|---|---|---|---|
| none | - | - | - | - |

## Implementer Signals

| ID | Type | Re | What and why | Reviewer disposition |
|---|---|---|---|---|
| none | - | - | - | - |

## Closure Telemetry

```text
**Telemetry (milestone closure):**
- milestone:   M20
- wall-clock:  <start> -> <close> (<delta>)
- budget:      weekly <a%->b%>, session/5h <a%->b%> [or unavailable]
- gate:        <checks run>
- coordination: terminal fallbacks <n>, pending relays <p>, approved/delivered <a>, denied <d>, failed <f>, ratio <a>/<n+p>
- diff:        <N files, +adds/-dels>, commits <hashes>
- outcome:     <M20 delivered / ENABLER-BLOCKED / REFUTED>
```
