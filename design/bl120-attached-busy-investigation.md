# BL-120 — `setAgentBusyState(agent, true)` is unreachable: investigation

**Item:** [[BL-120]] (`design/backlog.md`) · **Origin:** `design/bl028-plan.md` §9 q4
**Deliverable:** this document. **Code changed: none.**
**Written:** 2026-08-07, against `master` `04a30e7` / branch `task-op-hmp6`.
**Verification method:** every claim below is either a `file:line` read at that sha, or the output of the live
probe in §2.2. Where I could not establish something, it is stated as such in §7 rather than smoothed over.

---

## 1. Summary — the recommendation, up front

**Recommended: option O2 — delete the unreachable `true` branch, and correct the record. Do *not* wire it.**

The item is **half right, and the half it gets wrong is the half that motivates the fix.**

- ✅ **Correct:** `setAgentBusyState`'s `true` branch is unreachable, and **`agent.sessionStatus` never becomes
  `'busy'`.** Confirmed by reading and by running.
- ❌ **Refuted, with evidence (§2.2):** *"an attached agent's status never says `busy`"*. **It does.** An attached
  agent runs an `InProcessAgentDriver` exactly like an in-process one — only its `Completer` differs — and that
  driver calls `notifyAgentStatus(agent, 'busy')` on every turn it pulls. A live attached agent went
  `creating → starting → ready → busy` in the probe below.
- ❌ **Refuted:** *"the UI cannot show an attached agent as working."* The UI reads `status`, receives the `busy`
  broadcast, and already renders `BUSY`. What it does **not** read is `sessionStatus` — the web client has no
  `case 'session_status'` in its WebSocket switch at all (§4, B3).

The consequence is decisive for the decision: **wiring the `true` branch at the natural site changes nothing any
production reader observes.** At `await_turn` the agent's `status` is *already* `busy` (the driver set it before
dispatching the exec), so the helper's `if (busy && agent.status === 'ready')` guard does not fire; the only net
effect is `sessionStatus = 'busy'`, which is broadcast to a client that drops it and read by no component in
either repo. That is a behaviour change on shared status logic — with a real hazard next to it (§5, A1/A9) — in
exchange for nothing.

So the honest disposition is not "wire it" and not "leave the trap in place", but **remove the dead branch and fix
the belief that produced the item.** Reasons in full in §6.

---

## 2. The premise, verified rather than quoted

### 2.1 What the code says

| Claim | Site | Verdict |
|---|---|---|
| `setAgentBusyState` has exactly one call site, passing `false` | declared `registry.ts:822`; called `registry.ts:548` (`send_to_agent`, `to === 'user'`) | **TRUE** — `private`, one caller, literal `false` |
| Therefore `updateAgentSessionStatus(agent, 'busy')` is unreachable | `registry.ts:823` | **TRUE** |
| `sessionStatus` has no other writer | `registry.ts:348` (`'starting'`) and `registry.ts:840` (via the helper) are the *only* assignments | **TRUE** — so in production `sessionStatus ∈ {undefined, 'starting', 'ready'}`. `'busy'`, `'restarting'` and `'error'` are **all** unreachable, not just `'busy'` |
| `await_turn` sets `currentTurnId` and leaves status alone | `registry.ts:497-510` | **TRUE** |
| The reconnect restore is the only other route to `busy` | `registry.ts:1367` | **FALSE** — see 2.2 |
| An attached agent's `status` never says `busy` | — | **FALSE** — see 2.2 |

The last two are also asserted, in the same words, by the T3a code comment at **`registry.ts:877-880`** and by
**`design/bl028-plan.md` §2**, whose proof table records `in-process-driver.ts` as *"in-process only"*. Both are
wrong for the same reason, and this item inherited the error from them.

### 2.2 What the code does — the live probe

`activateAgent` (`registry.ts:377-393`) branches on `agent.transport === 'in-process' || agent.transport ===
'attached'` and starts an `InProcessAgentDriver` for **both**; only the `Completer` differs (`ApiCompleter` vs
`McpCompleter`). `sendProtocol` calls `agent.queueTurn(...)` for **every** EVT on **every** transport
(`registry.ts:753`) — the comment at `registry.ts:742-745` even says so outright: *"`apiDrivers` holds drivers for
the attached transport too."* The driver's loop then pulls that turn and calls `notifyAgentStatus(agent, 'busy')`
(`in-process-driver.ts:118`).

Run against the built runtime — real `Registry`, real driver, real `sendProtocol`, nothing mocked, no file
written:

```
$ node --input-type=module -e "
    import { Registry } from './packages/runtime-core/dist/registry/registry.js';
    const r = new Registry(); const seen = [];
    r.on('status', e => seen.push(`status=${e.status}`));
    r.on('session_status', e => seen.push(`sessionStatus=${e.sessionStatus}`));
    const a = await r.createAgent('probe-attached', { transport: 'attached' });
    await r.activateAgent(a.id);
    await r.sendProtocol(a.id, 'EVT', { type:'message_received', from:'user', payload:'hi' });
    await new Promise(res => setTimeout(res, 400));
    console.log('events:', JSON.stringify(seen));
    console.log(a.status, a.sessionStatus, a.currentTurnId); await r.destroy(); process.exit(0);"

[Registry] Starting InProcessAgentDriver for attached agent probe-attached (provider=mcp)
[Agent probe-attached] starting -> ready
[Agent probe-attached] ready -> busy
events: ["status=starting","sessionStatus=starting","status=ready","status=busy"]
agent.status = busy | agent.sessionStatus = starting | currentTurnId = msg-1786104500912-1
```

**Read it carefully — it refutes one claim and confirms the other in the same four lines.** `status` reaches
`busy` on the attached transport, with no disconnect involved. `sessionStatus` is still `'starting'`: it never
even reaches `'ready'`, because the *only* thing that sets `'ready'` is the `false` call at
`send_to_agent → user`, which this agent had not yet made.

**The real defect is therefore narrower and different from the filed one:** it is not "attached agents are never
busy", it is **"`sessionStatus` is a vestigial field that is written twice and read by nobody."**

### 2.3 Consequence for BL-028 (flagged, not re-litigated)

T3a replaced the sweep's `status === 'busy'` gate with `currentTurnId`. Its *stated* justification — that the old
gate was unreachable on the attached transport — is refuted above. Its *effect* is not harmed: the driver sets
`currentTurnId` and `busy` at the same point (`in-process-driver.ts:107-118`), so on the normal path the two
windows very nearly coincide, and `currentTurnId` remains the better-motivated gate ("somebody is waiting for
this agent"). **I am recording this as a finding for the PO, not proposing that T3a be revisited** — that is a
scope decision, and this document changes no code.

---

## 3. Reader inventory — `agent.status`

The bar is per-reader. `'busy'` is only *distinguishable* to a reader that treats it differently from `'ready'`;
readers of the `ready || busy` form are listed anyway, because "no change, and here is why" is the answer the bar
asks for. **"If wired" below means: `setAgentBusyState(agent, true)` is called at turn delivery — the only site
that makes sense, since the `false` counterpart already sits on the terminal action.**

| # | Reader | Site | Treats `busy` as | If wired |
|---|---|---|---|---|
| **A1** | **`ArbiterCoordinator.handleAgentStatus`** | `arbiter-coordinator.ts:182`, `:196` | **strict `=== 'ready'`** | **The one behaviourally sensitive reader in the codebase.** Arbiter convergence is evaluated only when *every* planner reads `'ready'`; a planner in `busy` suppresses it. Any change that widens the `busy` window near planner turns can delay or skip convergence. Reached from `registry.ts:217-219` on every `status` emit. **Today this is not newly harmed** (the driver already produces those transitions) — but it is the reader any future wiring must be argued against. |
| **A2** | `ConversationCoordinator.startConversation` | `conversation-coordinator.ts:41` | `ready \|\| busy` | no change |
| **A3** | `TeamCoordinator` team-join validation | `team-coordinator.ts:233` | `ready \|\| busy` | no change |
| **A4** | `Registry.requestUsageStats` | `registry.ts:405` | `ready \|\| busy` | no change |
| **A5** | `Registry.assertRelayDeliverable` | `registry.ts:1051` | `ready \|\| busy` | no change |
| **A6** | `Registry.sendScheduledMessage` | `registry.ts:1249` | `ready \|\| busy` | no change |
| **A7** | `Registry.quietForMs` (BL-028 T3a sweep) | `registry.ts:888` | reads `error`/`terminated` only; gates on `currentTurnId` | no change — T3a deliberately removed the `busy` gate |
| **A8** | reconnect restore, `handleMcpConnect` | `registry.ts:1362-1368` | writer *and* reader (`currentTurnId ? 'busy' : 'ready'`) | no change; still the only *post-disconnect* route |
| **A9** | **`Agent.setStatus` / `ALLOWED_TRANSITIONS`** | `agent.ts:16-24`, `:78-85` | **throws** on an illegal transition | **The hazard.** `busy` has no self-transition and `starting → busy` is not allowed, so a naive `setAgentStatus(agent,'busy')` at turn delivery **throws**. Today `setAgentBusyState`'s `if (busy && agent.status === 'ready')` guard is exactly what prevents that — the helper is defensively written, and any replacement must keep the guard. Precedent that this is not theoretical: M17 G3-4, where an escaped `Invalid transition: terminated -> busy` **killed the orchestrator process** (`design/milestone17-gate-over-channel-implementation.md:501-504`, filed as BL-020). |
| **A10** | `InProcessAgentDriver.loop` | `in-process-driver.ts:118`, `:120` | writer *and* reader | It is *already* the producer of `busy`, on **both** transports (§2.2). Wiring a second producer creates a redundant one. |
| **A11** | `InProcessAgentDriver.handleTurn` (`conversation_end`) | `in-process-driver.ts:157` | `busy → ready` | no change |
| **A12** | `McpCompleter.complete` status listener | `completer.ts:67-74` | rejects on `error`/`terminated` only | no change |
| **A13** | `ScenarioRunner.waitForAgentReady` | `scenario-runner.ts:234`, `:250` | `ready \|\| busy` | no change |
| **A14** | `Registry.setAgentStatus` → `handleAgentFailure` (M03) | `registry.ts:286-294` | fires on fault-class `error` only | no change — a `busy` transition never propagates |
| **A15** | orchestrator REST + `status` broadcast | `server.ts:200`, `:676`, `registry.on('status')` | pass-through | `busy` already surfaces here |
| **A16** | web `handleWsMessage` `case 'status'` → `useAgents.updateAgentStatus` | `App.tsx:205-212`, `hooks/useAgents.ts:43-45` | pass-through | already receives `busy` |
| **A17** | web `AgentsView` badge + icon | `AgentsView.tsx:12-19`, `:102`, `:138-139` | renders | **already renders `BUSY`** with the yellow dot / grey `Activity` icon (`busy` falls to the `default` arm). This is the item's "the UI cannot show it" claim, refuted. |
| **A18** | web `AgentList` | `components/agents/AgentList.tsx:58` | renders | same as A17 |
| **A19** | web `SchedulerView` / `ChatSidebar` / `TeamSidebar` availability filters | `SchedulerView.tsx:50`, `chat/ChatSidebar.tsx:30`, `team/TeamSidebar.tsx:85` | `ready \|\| busy` | no change |
| **A20** | web `waitForAgentsReady` (autostart) | `App.tsx:379-381` | `ready \|\| busy` | no change |
| **A21** | observability recording playback | `recordings/playback.ts:106-110` | records replay state | replays whatever was emitted; no semantics |

**Sweep method (so the exhaustiveness claim is checkable, not asserted):** `grep -rn "\.status ===\|\.status
!==\|'busy'\|\"busy\"" packages/*/src apps/orchestrator/src apps/web/src`, excluding `node_modules`, `dist` and
tests, then each hit classified by hand and non-agent `status` fields (conversation / task / relay / team / run /
HTTP / `Promise.allSettled`) discarded. A1 is the only strict-`'ready'` reader in the result.

---

## 4. Reader inventory — `agent.sessionStatus`

This is the field the `true` branch actually governs, and its inventory is the argument.

| # | Reader | Site | If wired |
|---|---|---|---|
| **B1** | `updateAgentSessionStatus` → `emit('session_status')` | `registry.ts:835-845` | The sole writer; would emit `'busy'` |
| **B2** | orchestrator `registry.on('session_status')` → recorder + `broadcast` | `server.ts:1240-1243` | Would broadcast `{type:'session_status', sessionStatus:'busy'}` to every WS client |
| **B3** | **web WebSocket switch** | `App.tsx:201-256` | **Nothing happens. There is no `case 'session_status'`** — the full case list is `agent_added`, `status`, `usage`, `agent_message`, `conversation_started`, `conversation`, `team_updated`, `team_task_updated`, `team_planning_complete`, `workflow_gate_attempt`, `relay_approval_state`, `relay_approval_mode`, `pending_relay_updated`, `relay_approval_error`. The broadcast is silently discarded. |
| **B4** | `GET /api/agents` serialization | `server.ts:207` | Would serve `'busy'`. The web `Agent` type declares the field (`apps/web/src/api/types.ts:46`) but **no component reads it** — `grep -rn sessionStatus apps/web/src` returns that one type line and nothing else. |
| **B5** | `POST /api/agents` response + `agent_added` broadcast | `server.ts:683` | as B4 |
| **B6** | recording playback | `recordings/playback.ts:112-115` | replay state gains a value; no consumer |
| **B7** | `play-recording` tool | `apps/orchestrator/src/tools/play-recording.ts:21` | prints it |
| **B8** | wire contract: `BusyStateEventPayload`, `SessionUpdateEventPayload`, `isAgentSessionStatus` | `contracts/src/protocol-payloads.ts:101-110`, `:383-395`, `:541-543` | **Declared, parsed, and never used.** Neither `busy_state` nor `session_update` is produced or consumed anywhere in the runtime — `grep` finds them only inside `protocol-payloads.ts`. They are vestiges of the pre-MCP stdio protocol. (Being already in the contract, *using* them would not move the `verify-contract.js` hash — the LB-66 constraint is not an obstacle here, in either direction.) |
| **B9** | the attached client (`agentalk-mcp-client`) | — | **No reader.** Read-only grep of that repo for `sessionStatus` / `busy_state` / `session_update` / `'busy'` returns only `lib/executor-runtime.mjs:100,355,566,712`, which are the client's own **private** `#status`/`_status` field for its local executor — never sent to the orchestrator, never derived from this one. Same name, unrelated variable. |

**Net effect of wiring, stated exactly:** one extra WebSocket frame per turn, dropped by the only client; one
extra field value in a REST payload nothing reads; one extra line in recordings. **No behavioural change reaches
any consumer.**

**Incidental drift found while doing this** (recorded, not fixed, not part of the recommendation):
`apps/web/src/api/types.ts:46` types `sessionStatus` as `'starting'|'ready'|'busy'|'reconnecting'|'error'`, while
`AgentSessionStatus` (`contracts/src/types.ts:176`) is `'starting'|'ready'|'busy'|'restarting'|'error'`. The web
union has `'reconnecting'` where the contract has `'restarting'`. Harmless today precisely because nothing reads
the field.

---

## 5. The options

The record does **not** enumerate options anywhere — [[BL-120]], `bl028-plan.md` §9 q4 and `hmp6.config.json`
each say "weigh the options" without listing them. The set below is therefore **constructed from what the record
implies**, and I flag that rather than pretending to be quoting a list.

### O0 — Do nothing
Leave the dead branch and the stale claims in place.
**For:** zero risk. **Against:** the trap stays armed. This item exists *because* a wrong belief about `busy` was
written into a plan (`bl028-plan.md` §2), a code comment (`registry.ts:877-880`) and then a backlog item, and was
acted on. Leaving all three uncorrected guarantees the next reader inherits it.

### O1 — Wire the `true` branch
Call `setAgentBusyState(agent, true)` at turn delivery (`await_turn`, `registry.ts:497`), mirroring the `false`
call on the terminal action.
**For:** removes the asymmetry; `sessionStatus` would finally exercise its full union.
**Against, and this is decisive:** at `await_turn` the agent's `status` is *already* `busy` — the driver set it
before `McpCompleter` queued the exec turn (`in-process-driver.ts:118` → `completer.ts:100`) — so the helper's
`ready` guard does not fire and **`status` does not move at all**. The whole delivered value is
`sessionStatus = 'busy'`, whose complete consumer set is §4: a broadcast the UI drops (B3) and a REST field no
component reads (B4). It is a behaviour change on shared status logic, adjacent to a strict-`'ready'` reader (A1)
and a throwing transition table (A9), **in exchange for nothing observable.**

### O2 — Delete the dead branch, and correct the record ✅
Reduce `setAgentBusyState` to its reachable behaviour (an "agent is idle again" helper: set
`sessionStatus = 'ready'`, and `busy → ready` on `status`), rename it accordingly, and fix the two stale
statements — `bl028-plan.md` §2's proof table and the `registry.ts:877-880` comment — to say what §2.2 shows.
**For:** the only option that is a **provable zero-behaviour-change** (unreachable code cannot be observed
disappearing), and the only one that removes the *cause* rather than the symptom. **Against:** it deletes an
affordance someone once intended; if a session-level axis is later wanted, it is re-added deliberately (O3).

### O3 — Make `sessionStatus` a real axis
Drive `sessionStatus` from the same lifecycle points that already drive `status` (or from
`notifyAgentStatus`), **and** add the missing `case 'session_status'` to the web client so something reads it.
**For:** the only option that delivers user-visible value, and there is a coherent design behind it — a
session/transport-level axis distinct from the engine's `status`.
**Against:** it is a **feature**, not a defect fix; it is strictly larger than this item; and it needs a consumer
designed first. Building the producer while B3 stays absent repeats the mistake that created this field. Should
be a separate backlog item if the PO wants it.

### O4 — Wire it *and* teach the UI to read it
O1 + the web `case 'session_status'`.
**Against:** this is O3 with the design work skipped — it would render `sessionStatus` next to `status`, where
`status` already says `BUSY` (A17), so the UI would show two fields saying the same thing with different
lifetimes. Worse than either O1 or O3 alone.

---

## 6. Recommendation — O2, with reasons

**Recommend O2: delete the unreachable `true` branch and correct the record. Do not wire it. Do not delete
`sessionStatus` itself.**

1. **The motivation for wiring does not survive contact with the code.** Both consequences the item cites are
   already satisfied by `status`: the UI shows attached agents as `BUSY` (A17), and the T3a sweep no longer gates
   on `busy` at all (A7). O1 buys no observable behaviour (§4, net effect).
2. **O2 is the only option whose blast radius is provably zero.** Unreachable code has no readers by definition;
   every row in §3 and §4 is unaffected. Every other option is a behaviour change on shared status logic and
   therefore needs full planning and Gate 1.
3. **The residual risk sits on the wiring side, not the deleting side.** A1 (arbiter strict `=== 'ready'`) and A9
   (a transition table that *throws*, with a precedent of killing the orchestrator) are the two places where a
   careless second `busy` producer does damage. O2 touches neither; O1 introduces a producer next to both.
4. **The actual defect is the belief, and O2 is the only option that fixes it.** A wrong claim about `busy`
   propagated plan → comment → backlog item → this run's brief. Deleting the branch without correcting
   `bl028-plan.md` §2 and `registry.ts:877-880` would leave the misleading text as the surviving artifact.
5. **It keeps the door open.** If the PO wants a session-level axis, O3 remains available and is *better* posed
   after O2: the field's semantics get designed with a consumer, instead of inherited from a branch nobody could
   reach.

**Scope note:** O2 is still a code change and **is not made here** (§8). It is small — one helper reduced and
renamed, two documentation corrections — but the rename touches shared registry code and the corrections touch a
merged plan, so it belongs in its own task under the normal gates.

**Explicitly NOT recommended:** wiring the branch (O1/O4), and any widening of what produces `busy` on `status`,
until A1's strict-`'ready'` convergence gate has been examined on its own terms.

---

## 7. What I could not determine — stated plainly

1. **Original intent.** Why `setAgentBusyState` was written symmetric, and whether `busy_state` /
   `session_update` (B8) once had a producer, is not recoverable from the code at this sha. I did not search
   history for it; the conclusion does not depend on it, but "it was vestigial" is my inference, not a
   documented fact.
2. **Whether a *third-party* attached client reads `sessionStatus`.** I verified `agentalk-mcp-client` (B9) and
   this repo. Any other client that ever attached is outside both trees and outside what I can check.
3. **A1's real-world sensitivity.** I established that `ArbiterCoordinator` requires all planners strictly
   `'ready'` and that the driver already moves planners through `busy`. Whether arbiter convergence is *currently*
   delayed by that in live runs is a live-run question I did not run — it needs an arbiter-mode team, which is
   beyond a read-only investigation. **I am flagging it as the open risk, not claiming a defect.**
4. **The full `sessionStatus === 'restarting'` story.** That value is unreachable like `'busy'`, and I did not
   trace what was once meant to set it.

---

## 8. Scope statement — what this run did and did not do

**Changed:** exactly one file, this document. No `.ts`, `.mjs`, `.json`, no test added, edited or removed, no
`AGENT.md`. `git diff --stat` shows one path.

**Deliberately NOT done, per Implementer Rule 2:** the fix. Wiring — or deleting — the branch is a change to
shared status logic in `registry.ts`, which is a show-stopper for an implementer to make unilaterally, and this
item is filed as an investigation precisely because *nobody has established what else would move*. §3 and §4 are
that establishment; §6 is a recommendation for the gate that reads it, not an action taken. **The document may
recommend the change; it may not be the change.**

**Read outside the workdir:** one read-only `grep` over `/Users/fausto/Software/agentalk-mcp-client` for B9.
Nothing there was written or modified.
