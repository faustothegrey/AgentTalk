# M20 - PO-approved relay - Implementation Ledger

**Status:** **M20-T3 implementer claim ready for Gate 2 (Claude).** T1 and T2 are merged; T3 evidence is fresh.
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
| M20-D1 - mode-on async pending agent-to-agent relay; no pre-approval delivery | **claimed for T1** - registry approval mode defaults `off`; `approve_each` creates a `PendingRelay` and returns pending without calling `sendProtocol` until approval | **VERIFIED ✅ (Gate 2, reproduced)** | `m20-pending-relay.test.ts` "holds mode-on send_to_agent as pending without target delivery before approval" |
| M20-D2 - M17 authority lifecycle separate from M20 PO approval lifecycle | **claimed for T1** - `workflow_gate_attempt` remains authority-only; M20 emits separate `pending_relay_updated` lifecycle records | **VERIFIED ✅ (distinct event confirmed)** | `m20-pending-relay.test.ts` "keeps workflow_gate_attempt authority separate from pending relay approval" |
| M20-D3 - approval delivers through existing queue path, including next-`await_turn` delivery | **claimed for T1** - approval calls the existing `sendProtocol` path; tests cover both active waiter and queued-next-turn delivery | **VERIFIED ✅** | `m20-pending-relay.test.ts` pending-then-approve and queued-next-turn cases |
| M20-D4 - denial and delivery failure do not pretend delivery success | **claimed for T1** - denial records `denied` and delivers nothing; failed approval records `delivery_failed` with `deliveryError` | **VERIFIED ✅** | `m20-pending-relay.test.ts` deny and delivery-failed cases |
| M20-D5 - mode-off ordinary send behavior, PO channel, and terminal fallback preserved | **claimed for T1 scope** - ordinary agent-to-agent send, baton transcript-on-send, conversation-runtime send shape, and `to === 'user'` path preserved | **VERIFIED ✅ (unchanged tests pass)** | targeted regressions plus full `npm test` |
| M20-D6 - UI/WS approval surface and approval mode works | **claimed for T2** - server sends approval-mode + pending-relay snapshot, broadcasts lifecycle/mode updates, accepts approve/deny/mode WS commands, records distinct runtime events, and UI exposes a small agent-relay approval panel | **VERIFIED ✅ (server/WS integration-tested + live browser drive: panel renders, mode toggle round-trips to server; approve/deny-of-a-real-relay in T3)** | `server.test.ts` (real WS client, full round-trip); live browser drive (screenshot + backend log `set_relay_approval_mode → approve_each`); `npm run build`; `npm test` |
| M20-D7 - fresh real approved relay proof and honest relay metric | **claimed for T3** - mode `approve_each` was enabled via WS; a real attached Codex CLI emitted a baton-bearing `send_to_agent`; the relay was held pending with no target delivery before WS approval, then delivered to the waiting real target CLI after approval; a second real relay was denied with no delivery; metric reported as a demonstration proof, not productivity | **VERIFIED ✅ (Gate 2 — preApprovalNoDelivery=true is the IP-15 discriminator)** | `proof.json` (result `approved_relay_proven`; `preApprovalNoDelivery`+`targetReceivedAfterApproval`+`denied.noDeliveryBeforeOrAfterDeny`); codex `x-codex-turn-metadata` provenance; `m20-approved-relay-proof.mjs:654-658` |
| M20-D8 - freeze bar green and forbidden surfaces clean | **claimed for T3** - proof, targeted registry regression, build, full suite, backlog check, whitespace check, process cleanup, sibling-client clean, and forbidden-surface audit are green | pending | T3 Fresh Verification |

## Coordination Baseline

M19 closed with a capability proof: two real attached CLIs carried demonstration substrate relays, ratio **2/~9**.
The program caveat remains: those were not organic burden-reduction relays during a normal dev epic. M20 must report
the actual terminal fallback rows, pending relays proposed, approved/delivered relays, denied relays, delivery
failures, and substrate ratio for its work.

## M20-T1 - Core pending-relay lifecycle

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-11).**
**Branch:** `m20-t1-pending-relay-core` (uncommitted — commit before merge).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-11) — VERIFIED

Verified by running, with focus on the mode-off preservation the amendment hinged on:

- **Preservation genuine (the load-bearing check) — VERIFIED.** The existing contract tests
  `m17-gate-channel.test.ts` (incl. :93 "preserves ordinary non-workflow behavior"), `baton-metadata.test.ts`
  (transcript-on-send), and `conversation-runtime.test.ts` are **NOT modified** and **pass (19/19)**. Since the
  registry mode defaults `off`, those unmodified tests exercise the old path — so preservation is real, **not**
  achieved by weakening a contract. The mode-off path is a **pure refactor**: `deliverRelayMessage` /
  `assertRelayDeliverable` reproduce the old `sendProtocol` + `recordConversationMessage` + status/reply-cap checks
  byte-for-byte. **M20-D5 ✅.**
- **Mode-on lifecycle — VERIFIED.** `m20-pending-relay.test.ts` 8/8: mode `approve_each` creates a `PendingRelay`
  and returns "pending" **without** `sendProtocol` (no pre-approval delivery, **D1 ✅**); `approvePendingRelay`
  re-validates deliverability then delivers via the reused `sendProtocol → queueTurn` path (**D3 ✅**);
  deny → `denied`/no delivery, approval exception → `delivery_failed`/`deliveryError` (**D4 ✅**).
- **Separate lifecycle — VERIFIED.** `emitPendingRelay` fires a **distinct** `pending_relay_updated` event;
  `workflow_gate_attempt` (authority) is untouched and still pre-delivery. The separation test passes (**D2 ✅**).
- **Fence + freeze — VERIFIED.** Only `registry.ts` + `contracts/src/types.ts` + the new test + a *pure-addition*
  `conversation-runtime.test.ts` regression; no forbidden surface, client clean. `tsc -b` 0; full `npm test`
  **308/308** — all reproduced by me.

**Implementer signal:** `send_to_agent` was refactored into `deliverRelayMessage`/`assertRelayDeliverable` (shared
routing code, in scope). Behaviour-preserving — proven by the unchanged contract tests passing. Accepted.

**Gate 2 outcome: PASS.** M20-D1–D5 VERIFIED; the mode-off amendment holds; the two lifecycles are cleanly separate.
D6 (UI/WS) is T2, D7 (real approved-relay proof) is T3.

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-11) — MERGED

**Doubling declared & PO-accepted** (gate 2 + gate 3, Claude). Closure sweep re-used the gate-2 runs (preservation
19/19, lifecycle 8/8, `tsc -b` 0, `npm test` 308/308, fence clean). Branch committed; post-commit tree clean; no
stray processes; client repo untouched. **Merged `m20-t1-pending-relay-core` → `master`** (AgentTalk only). Merge
PO-gated (`[PO]` go, 2026-07-11). **T1 Coordination Evidence (BL-030):** substrate **0**, terminal fallbacks = the
T1 role hand-offs (planner→implementer, implementer→reviewer, reviewer→PO) — expected; T1 is the mechanism core, no
real relay yet (that's T3). Next: T2 (UI/WS approval surface) opens from `master`.
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
| substrate events | none for T1 core-only proof | 0 |
| terminal fallbacks | none for T1 core-only proof | 0 |
| ratio | not applicable until T3 real-relay proof | n/a |

### Implementer Claim (Codex, 2026-07-11)

Implemented the registry-side pending-relay core:

- added `RelayApprovalMode`, `PendingRelayStatus`, and `PendingRelay` contract source types;
- added registry approval mode with startup default `off`;
- preserved mode-off plain `send_to_agent` immediate delivery and transcript recording;
- added mode-on pending relay creation for the plain agent-to-agent delivery branch after M17 authority validation and before delivery;
- added distinct pending-relay lifecycle updates (`pending`, `approved_delivered`, `denied`, `delivery_failed`);
- added approval and denial registry methods; approval reuses the existing `sendProtocol` / `queueTurn` delivery path;
- kept `to === 'user'`, arbiter/team routing, MCP transport, client contracts, wire contract, UI, and production conversation runtime out of scope.

### Fresh Verification

```text
npx vitest run packages/runtime-core/src/registry/__tests__/m20-pending-relay.test.ts
PASS: 1 file, 8 tests

npx vitest run packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts apps/orchestrator/src/__tests__/conversation-runtime.test.ts packages/runtime-core/src/registry/__tests__/m20-pending-relay.test.ts
PASS: 4 files, 27 tests

npx tsc -b
PASS

npm test
PASS: contract hash verified successfully (v7); client contract alignment verified successfully; 55 files, 308 tests
```

### T1 Scope Check

Touched files stay inside the T1 manifest:

- `design/milestone20-po-approved-relay-plan.md`
- `design/milestone20-po-approved-relay-implementation.md`
- `packages/contracts/src/types.ts`
- `packages/runtime-core/src/registry/registry.ts`
- `packages/runtime-core/src/registry/__tests__/m20-pending-relay.test.ts`
- `apps/orchestrator/src/__tests__/conversation-runtime.test.ts`

Forbidden surfaces remain untouched: sibling client, `packages/contracts/wire-contract.json`, MCP transport,
`team-coordinator.ts`, production conversation runtime, orchestrator server, and web UI.

## M20-T2 - Server and UI approval surface

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-12).**
**Branch:** `m20-t2-relay-approval-ui` (uncommitted — commit before merge).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-12) — VERIFIED

- **Fence ✅** — only `server.ts` + `apps/web/**` + `api/types.ts` + tests; **`registry.ts` untouched** (T1 frozen),
  no MCP/client/coordinator/wire-contract. Server WS changes are additive (3 new switch cases calling T1's registry
  API + broadcasts + recorder; only removal = an unused import).
- **Server/WS surface — VERIFIED by real integration test.** `server.test.ts` (17 tests) starts the actual server,
  opens a **real WS client**, and asserts the full round-trip: connect-`relay_approval_state` snapshot →
  `set_relay_approval_mode` → create pending → `approve_pending_relay` → `pending_relay_updated:approved_delivered`
  (with delivery) → `deny` → distinct recorder events. This is the live server behaviour, not a mock.
- **UI wiring — VERIFIED by code + build.** `RelayApprovalPanel.tsx` renders pending relays (from→to, payload, baton
  id/roles), approve/deny buttons, and the mode toggle; `App.tsx` subscribes to all three lifecycle events and sends
  all three commands. `tsc -b` 0; `npm run build --workspace @agenttalk/web` clean; full `npm test` **312/312**.
- **Lifecycle separation preserved (D2)** — the panel/events use `pending_relay_updated`, distinct from M17's
  authority `workflow_gate_attempt`. `to === 'user'` / PO channel untouched (D5).

**Live browser drive (done, after the PO reconnected the Chrome extension — 2026-07-12).** Initially the Chrome
extension was **not connected** (Chrome auto-updated to v150 the day before, dropping the connection); the PO
reconnected it. I then drove the running UI (my T2 backend/frontend, this branch): the **Relay-approvals panel
renders** (mode toggle "Off" by default — preservation intact; "No pending agent relays"), and **clicking the toggle
round-trips end-to-end** — the panel flipped to "Approve each" (blue check) *and* the backend logged
`WS message received: set_relay_approval_mode {"mode":"approve_each"}` → `Relay approval mode approve_each → 1
client(s)`. So the UI→WS→registry→broadcast→UI path is live-verified, not just code-verified. **The one piece still
owed — clicking approve/deny on a *real* pending relay in the browser — is M20-T3's job** (its D7 proof attaches
agents and produces a real relay to approve); I'll drive that click there. (Process note: the "relaunching
orchestrator" was identified as the PO's `launchd` KeepAlive service `com.fausto.agenttalk-orchestrator`, not a leak —
avoided a mis-reap; my own servers were cleanly stopped.)

**Gate 2 outcome: PASS** (D6 verified for server/WS + UI wiring + live browser drive of render/mode-toggle;
approve/deny-of-a-real-relay in T3).

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-12) — MERGED

**Doubling declared & PO-accepted** (gate 2 + gate 3, Claude). Closure sweep re-used the gate-2 runs (WS integration
17/17, `npm test` 312/312, `tsc -b` 0, web build clean) plus the live browser drive. Branch committed; post-commit
tree clean; my servers stopped, ports free; the PO's `launchd` service left running. **Merged
`m20-t2-relay-approval-ui` → `master`** (AgentTalk only). Merge PO-gated (`[PO]` go, 2026-07-12). **T2 Coordination
Evidence (BL-030):** substrate **0**, terminal fallbacks = the T2 role hand-offs — expected; T2 is the approval
surface, no real relay yet (that's T3). Next: T3 (the real approved-relay proof + the live approve-click) opens from
`master`.
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
| substrate events | none for T2 UI/server proof | 0 |
| terminal fallbacks | none for T2 UI/server proof | 0 |
| ratio | not applicable until T3 real-relay proof | n/a |

### Implementer Claim (Codex, 2026-07-11)

Implemented the approval surface on top of the T1 registry API without changing registry routing:

- server sends a connect-time `relay_approval_state` snapshot with current approval mode and non-terminal pending relays;
- server accepts `set_relay_approval_mode`, `approve_pending_relay`, and `deny_pending_relay` WebSocket commands;
- server broadcasts `relay_approval_mode` and `pending_relay_updated` separately from `workflow_gate_attempt`;
- server records `relay_approval_mode` and `pending_relay_updated` runtime recorder events;
- web UI adds a compact relay approval panel with mode toggle, pending relay list, baton/authority metadata, and approve/deny buttons;
- UI retains workflow gate events as authority-only in the event stream with "accepted (pre-delivery)" language;
- kept registry routing, MCP transport, sibling client, wire contract, team/coordinator code, and PO-channel behavior out of scope.

### Fresh Verification

```text
npx vitest run apps/orchestrator/src/__tests__/server.test.ts
PASS: 1 file, 17 tests

npx tsc -b
PASS

npm run build --workspace @agenttalk/web
PASS

npm run build
PASS

npm test
PASS: contract hash verified successfully (v7); client contract alignment verified successfully; 55 files, 312 tests

git diff --check
PASS
```

### T2 Scope Check

Touched files stay inside the T2 manifest:

- `design/milestone20-po-approved-relay-implementation.md`
- `apps/orchestrator/src/server.ts`
- `apps/orchestrator/src/__tests__/server.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/RelayApprovalPanel.tsx`
- `apps/web/src/api/types.ts`

Forbidden surfaces remain untouched: sibling client, `packages/contracts/wire-contract.json`, MCP transport,
registry routing, `team-coordinator.ts`, and `mcp-tools.ts`.

## M20-T3 - Fresh proof and closure metric

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-12).**
**Branch:** `m20-t3-approved-relay-proof` (uncommitted — commit before merge).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-12) — VERIFIED

- **M20-D7 — VERIFIED (non-gameable proof).** `m20-approved-relay-proof.mjs` runs the full end-to-end: mode off →
  `approve_each` via WS; a **real attached Codex CLI** emits a baton-bearing `send_to_agent`; the relay is **held
  pending with `preApprovalNoDelivery: true`** (the target did NOT receive before approval) → approved via the WS
  `approve_pending_relay` command → **delivered** (`targetReceivedAfterApproval: true`) → a second relay **denied**
  via WS with `noDeliveryBeforeOrAfterDeny: true`. `result` requires all three (`:654-658`), so **the proof cannot
  pass with the T1 change absent or mode off** — the exact IP-15 discriminator. **Provenance:** the codex
  `send_to_agent` carries codex's own `x-codex-turn-metadata` (session/turn id + `latest_git_commit_hash 571d956` =
  the T2 merge) — unforgeable by a script. Metric labeled honestly as a **demonstration** proof (raw 2, delivered 1,
  denied 1, ratio 1/3), not productivity.
- **Fence + bars — VERIFIED.** Only `scripts/m20-approved-relay-proof.mjs` + evidence + ledger; `registry.ts` (T1),
  `server.ts`/`apps/web` (T2), client all frozen. m20 lifecycle 8/8, `npm test` **312/312**, `backlog:check` 30/0,
  client clean.
- **Live browser Approve-button click — honest disposition.** The helper auto-approves in one shot and runs its own
  backend, so it can't surface a relay in a watched UI; a persistent live pending relay for a manual click needs
  bespoke attach orchestration. I did **not** build that. Instead the Approve-button path is **verified by
  composition**: (a) I drove a **real browser click live in T2** (mode toggle → backend-confirmed
  `set_relay_approval_mode`), and Approve uses the *identical* `onClick → sendWsMessage` mechanism; (b)
  `approve_pending_relay` WS → held-relay delivery is proven with a **real CLI relay** here + by `server.test.ts`. So
  every layer of "browser Approve → WS → delivery" is verified; the literal button-on-a-live-relay was not clicked.
  Stated, not glossed.

**Gate 2 outcome: PASS.** M20-D7 verified; the approved-relay mechanism works end-to-end with a real CLI, held and
delivered only under PO approval, denial honored. This is the M20 mechanism proven whole.

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-12) — MERGED · **M20 CLOSED**

**Doubling declared & PO-accepted** (gate 2 + gate 3, Claude). Closure sweep re-used the gate-2 verification (the
non-gameable D7 proof + bars). Branch committed; post-commit tree clean; my servers stopped; the PO's `launchd`
service left running. **Merged `m20-t3-approved-relay-proof` → `master`** (AgentTalk only). Merge PO-gated
(`[PO]` go, 2026-07-12). T3 is the final M20 task → **this merge closes the epic**; telemetry filled below,
BL-030 dispositioned `done`, program status updated.

### Closure Telemetry

```text
**Telemetry (milestone closure):**
- milestone:   M20 — PO-approved relay (T1 lifecycle+mode · T2 WS/UI surface · T3 real approved-relay proof)
- wall-clock:  opened 2026-07-11 (inception) -> closed 2026-07-12 (C-first-style small bites)
- budget:      claude weekly ~26% -> ~36% over T1/T2/T3 gate-2/3 + live browser drive + T3 codex proof
- gate:        each task gate-2 re-verified by hand — T1 mode-off preservation (unchanged contract tests pass) +
               lifecycle 8/8; T2 WS integration 17/17 + live browser render/mode-toggle drive; T3 non-gameable D7
               proof (preApprovalNoDelivery discriminator, codex provenance). Freeze: tsc 0, npm test 312/312,
               backlog 30/0, fence clean (registry/server/UI frozen per task)
- coordination: substrate 0 (M20 built the approval-gated mechanism; not yet run during real dev coordination),
               T3 demonstration ratio 1/3 — NOT a productivity stat
- diff:        3 merged tasks; commits — T1 9b3f64d, T2 571d956, T3 (closure) below
- outcome:     **DELIVERED** — the brain-routes/you-approve mechanism is built and proven end-to-end with a real CLI,
               default OFF (all prior behavior preserved). Adoption (turning it on for real coordination) + the
               consent-dimmer relaxation are the ongoing program work, not M20.
```
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
| substrate events | real attached CLI approved relay delivered after WS approval; real attached CLI denied relay recorded without delivery | 2 raw relays; 1 approved/delivered |
| terminal fallbacks | PO terminal baton to Codex; Codex terminal handoff to Claude Gate 2 | 2 |
| ratio | `proof.json` metric: demonstration approved-relay proof, not organic productivity | 1/3 |

### Implementer Claim (Codex, 2026-07-12)

Implemented the T3 proof helper and produced fresh evidence without changing frozen runtime/UI/client surfaces:

- added `scripts/m20-approved-relay-proof.mjs`, a headless real-CLI proof that reuses `scripts/m19-bridge-recorder.mjs`;
- launched a fresh orchestrator with a fresh runtime recording path and no global config mutation;
- verified approval mode starts `off`, then enabled `approve_each` through the real WS command;
- approved leg: real attached Codex source `m20-t3-approved-source-1783809683863` called MCP `send_to_agent` with baton `m20-t3-approved-baton-1` and workflow event `m20-t3-approved-event-1`;
- proved provenance chain: source bridge `tools/call` -> `workflow_gate_attempt: accepted` -> `pending_relay_updated: pending` -> WS `approve_pending_relay` -> `pending_relay_updated: approved_delivered` -> real target CLI stdout receives the payload;
- proved the IP-15 discriminator: before approval, no server delivery log and no target CLI stdout payload;
- denied leg: real attached Codex source `m20-t3-denied-source-1783809683863` emitted baton-bearing `send_to_agent`; WS denial recorded `pending_relay_updated: denied`; no delivery occurred before or after denial;
- reported the M20-D7 metric honestly: raw relays 2, pending observed 2, approved/delivered 1, denied 1, delivery failures 0, terminal fallbacks 2, substrate numerator 1, denominator 3, ratio `1/3`;
- kept the metric labeled as a demonstration approved-relay proof, not an organic productivity statistic.

Evidence directory:

```text
design/evidence/m20-t3-approved-relay-2026-07-11T22-41-23-273Z/
```

Key artifacts:

```text
proof.json
m20-t3-recording.ndjson
m20-t3-approved-source-bridge.ndjson
m20-t3-approved-target-bridge.ndjson
m20-t3-denied-source-bridge.ndjson
m20-t3-server.log
```

### Fresh Verification

```text
node scripts/m20-approved-relay-proof.mjs prove
PASS: result approved_relay_proven; evidence written to design/evidence/m20-t3-approved-relay-2026-07-11T22-41-23-273Z

npx vitest run packages/runtime-core/src/registry/__tests__/m20-pending-relay.test.ts
PASS: 1 file, 8 tests

npm run build
PASS: tsc -b; web build completed

npm test
PASS: contract hash verified successfully (v7); client contract alignment verified successfully; 55 files, 312 tests

npm run backlog:check
PASS: tsc -b; backlog structure OK, 30 items, 0 warnings

git diff --check
PASS

process cleanup
PASS: no m20 proof, orchestrator, bridge recorder, bridge.mjs, or attached Codex proof processes left running

manual cross-repo status
PASS: ../agentalk-mcp-client clean on master
```

### T3 Scope Check

Touched files stay inside the T3 manifest:

- `design/milestone20-po-approved-relay-implementation.md`
- `design/evidence/m20-t3-approved-relay-2026-07-11T22-41-23-273Z/**`
- `scripts/m20-approved-relay-proof.mjs`

Forbidden surfaces remain untouched: sibling client, `packages/contracts/wire-contract.json`, MCP transport,
registry routing, `team-coordinator.ts`, `mcp-tools.ts`, orchestrator server/UI, and PO-channel behavior.

Backlog disposition for Gate 2:

- BL-030: implementer claims M20 mechanism proof complete; pending Gate 2/Gate 3.
- BL-028: remains adjacent and out of M20 scope.
- BL-02 dimmer relaxation beyond `off` / `approve_each`: explicitly not M20 work.

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
