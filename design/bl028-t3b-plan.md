# Plan — BL-028 T3b: the non-reply vocabulary gets producers, and the advisory gets a reader

**Parent plan:** `design/bl028-plan.md` (§5 phasing — PO-ratified three-phase shape; §2 is **retracted in
place**, read the retraction before the section). **Item:** [[BL-028]] — `status: todo`, 1 of 3 phases merged,
`blocked_by: [BL-084]` now **discharged** (BL-084 `done` 2026-07-27).
**Written:** 2026-08-08 by Claude as planner. **Gate 1 (plan review) pending.**

## 1. What is actually true today — read from the code, not from the phasing note

- **The vocabulary has exactly one producer.** `AgentNonReplyReason`'s seven names live at
  `packages/contracts/src/types.ts:136-151`. A repo-wide search for `AgentNonReply|agent_non_reply` across both
  repos — AgentTalk **and** `agentalk-mcp-client`, which returns nothing at all — yields: the type, the notice
  interface, **one emit** (`registry.ts:994`, `reason: 'quiet'`), and the T3a test. **Six names have no
  producer.**
- **The advisory has no reader either.** `agent_non_reply` is consumed by exactly one thing in either repo:
  `bl028-idle-advisory.test.ts:61`. No UI, no recorder, no coordinator. T3a's stated compounding value was that
  we would "measure, for the first time, how long real turns actually go quiet" (`bl028-plan.md:132-140`) — as
  the input to T3c's threshold, "which today we would be guessing". **That measurement is not being retained
  anywhere.** A `console.warn` on the orchestrator's stdout is the whole record.
- **The two exemptions are reached, and they are the `awaiting-input` case in all but name.**
  `quietForMs` (`registry.ts:889`) returns `undefined` for `isAgentFactCollecting` (`:927`) and
  `isTaskAwaitingOperator` (`:938`). *(Both refs corrected at Gate 1 — I had written `:944`/`:951` from a
  reading a few edits stale. Verify by symbol, never by line: this file's own op-note, violated within the
  hour.)* Both predicates key off the *task*, not the agent
  (`team-coordinator.ts:1576`, `:1589`), so an agent can hold `currentTurnId` while its task sits at
  `awaiting_operator` — the sweep does see these agents and then deliberately says nothing about them.
- **`lastProgressAt` coverage is real and total** — one write in `handleMcpToolCall` (`:484`), which every agent
  action on **both** transports passes through, plus the post-`await_turn` re-stamp (`:508`). Nothing in T3b
  needs to touch it.

## 2. The three decisions this plan exists to surface

### D1 — `quietForMs` must return a *classification*, not a number *(mine; no PO call needed)*

Its `number | undefined` return conflates three different facts behind one `undefined`: **not a candidate** (no
outstanding obligation), **exempt** (a human is in the loop), and **silent but under threshold**. You cannot
name `awaiting-input` through a channel that has already erased the distinction.

Proposed: `classifySilence(agent): { reason: AgentNonReplyReason; silentForMs: number } | undefined`. This is
also the seam **T3c** needs — the one place that will later ask "does this reason escalate?" — so building it
here is what makes T3c a small change rather than a re-architecture. `quietForMs` disappears into it.

### D2 — ⚠️ **T3b changes an existing test's behaviour contract. This is a PO call, not mine.**

`B5` currently asserts `expect(notices).toEqual([])` for both exemptions — its title is *"fact-collection and
awaiting_operator still **suppress**"* (`bl028-idle-advisory.test.ts:153-166`). Naming the exemptions
necessarily moves that line. CLAUDE.md: *"When updating tests, I'll treat them as behavior contracts unless you
explicitly approve changing those contracts."* Two honest readings:

- **(i) Name-and-report** — the exemptions emit `agent_non_reply` with `reason: 'awaiting-input'`. B5 becomes
  *"…are reported as `awaiting-input`, and still propagate nothing"*.
- **(ii) Name-but-still-suppress** — the classifier knows the reason internally (T3c gets its seam), but nothing
  is emitted for the two exemptions. B5's assertion is untouched.

**Recommendation: (i).** The vocabulary's entire argument is LB-67 Finding 1 — *each reason implies a different
obligation for the sender*. A reason that is computed and then swallowed implies nothing to anyone, and under
(ii) T3b would deliver two internal enum values and no observable change. The safety property that matters is
not "the log stays quiet", it is **`awaiting-input` must never become a kill** — and that property is *stronger*
under (i), because the reason is on the record where T3c has to dispose of it explicitly, rather than being an
`if` that silently returns before T3c's escalation check is ever reached.

**Risk of (i), stated plainly:** an agent parked at `awaiting_operator` for an hour produces one notice per
obligation (the `quietReported` dedup is per `turnId`, `:981`), not one per 30s sweep. A human-paused task
therefore adds one line, not a stream. That is the only observable difference.

### D3 — give the advisory a reader *(declared deviation from §5's text — PO's call to accept)*

§5 describes T3b as the vocabulary and the exemptions. I want one addition: a listener in `server.ts` following
the **exact** `workflow_gate_attempt` precedent (`server.ts:1282-1286`) — `recorder?.record('runtime',
'agent_non_reply', notice)` + `broadcast({ type: 'agent_non_reply', ...notice })`.

**Why it belongs in T3b rather than later:** without it, T3b's product is a *second* reason nobody can observe,
and T3c is still supposed to be entered "with T3a's measured distribution in hand" — a distribution we are
currently discarding.

**Contract-safe by construction — and this one I checked at the artifact, not at the comment.**
`packages/contracts/wire-contract.json` is `{version: 8, hash, data}` where `data`'s keys are **exactly**
`mcpTools`, `packetTypes`, `protocolPrefix`, and `computeContractHash` hashes `candidate.data`
(`scripts/verify-contract.js:11-13`). A registry EventEmitter event plus a web-UI broadcast touches none of the
three, so the hash cannot move. *(`types.ts:156-160` asserts this too; I had repeated it from that comment,
which is Reviewer Rule 5's exact trap. It happens to be true.)*

> **⚠️ Gate-1 finding — the broadcast half, as originally written, would have reached nothing.** I claimed "the
> UI is a passive display; I add no component" and listed "does the UI tolerate an unknown broadcast `type`?" as
> a risk to check during implementation. Checked now, in 30 seconds: `App.tsx:202`'s `switch (message.type)` has
> **no `default` branch**, so an unknown type is silently ignored — it does not throw, and it does not display.
> **Both halves of what I wrote were wrong**: the risk is discharged, and the value was overstated. Broadcasting
> without a matching `case` would have handed the recorder a measurement and left the UI exactly as blind as
> before, while the plan read as though visibility had been delivered.
>
> **So D3 splits, and the PO picks:**
> - **D3a — record only.** One `recorder?.record('runtime', 'agent_non_reply', notice)`; no broadcast. Achieves
>   the *measurement* T3c needs. Smallest possible diff, zero UI surface.
> - **D3b — record + broadcast + one `case` in `App.tsx`**, ~6 lines in the identical shape as
>   `workflow_gate_attempt` (`App.tsx:232-241`) → `pushSidebarEvent('in', 'Silent:<reason>', …)`. Achieves
>   *visibility*: the operator sees that an agent went quiet, and why.
>
> **Recommendation: D3b.** "An agent is silent and here is the reason" is the product; a measurement only the
> recorder holds still leaves a human watching a stalled team with nothing on screen. It is the precedent's own
> shape, in the file that already does it, and it adds no component — one case arm in an existing switch.

## 3. What T3b deliberately does NOT wire — per name, with the reason

Required by the item's own standard: *a name in `types.ts` is not a claim the condition is detected.*

| Name | Why not in T3b |
|---|---|
| `exited` | The condition is real, but the observation point is the disconnect/reconnect-timeout path (`registry.ts:1331-1401`) — adjacent to the M03 propagation chokepoint. Bigger blast radius than a sweep-local change; **its own unit.** |
| `errored` | Same path, same reason. BL-084 already gives the *error* side a typed reason; bridging the two taxonomies is a design question, not a wiring job. |
| `turn-ended` | Needs a "the turn completed and no reply came" hook. `markTerminalActionComplete` clears `currentTurnId` (`:456`) without distinguishing reply from no-reply. |
| `user-stopped` · `receiver-cancelled` | **No observation point exists in our engine at all.** LB-67 lists them from *their* broker's PTY/monitor surface. Wiring these would mean inventing the condition, not detecting it — the precise error this item exists to retire. |

If the PO wants `exited`/`errored`, that is **T3b-2** and I will plan it separately. It is not scope I take
silently.

## 4. Scope fence

**May touch:** `packages/runtime-core/src/registry/registry.ts` (the classifier + `checkIdleAgents` only) ·
`apps/orchestrator/src/server.ts` (one listener) · **`apps/web/src/App.tsx` (one `case` arm — only under D3b)** ·
`packages/runtime-core/src/registry/__tests__/` (B5's contract per D2, plus the new T3b bars) · this plan + the
BL-028 item.

**May NOT touch — DO-NOT-TOUCH:** `setAgentStatus` · `handleAgentFailure` · `team-coordinator.ts` (both
predicates stay byte-for-byte) · `packages/contracts` wire types and the contract hash · `registry/config.ts`
thresholds · `in-process-driver.ts` · the reconnect/disconnect paths. **No kill path is created.** If T3b needs
any of these, that is a show-stopper and I stop and report.

## 5. Bars — each with the mutation that must turn it red

| Bar | Asserts | Mutation that must fail it |
|---|---|---|
| **C1** | A fact-collecting agent past threshold is reported with `reason: 'awaiting-input'` | Restore the bare `return undefined` in the fact-collection branch |
| **C2** | An `awaiting_operator` agent past threshold is reported with `reason: 'awaiting-input'` | Restore the bare `return undefined` in that branch |
| **C3** | Neither emits `quiet` — the reason is the *specific* one, not the generic one | Have the classifier fall through to `'quiet'` for exemptions |
| **C4** | `handleAgentFailure` is never called and no status changes, for **both** reasons | Point the classifier's result at `setAgentStatus` |
| **C5** | An ordinary silent agent still reports `quiet` (T3a unregressed) | Make the classifier return `'awaiting-input'` unconditionally |
| **C6** | One notice per obligation, per reason — dedup survives the reason split | Key `quietReported` on `agentId` alone |
| **C7** | `server.ts` records the notice (and under D3b, broadcasts it) | Drop the `recorder.record` (or, under D3b, the `broadcast`) |
| **C8** | *(D3b only)* the UI's `case` renders the reason — asserted against the real switch, not a mock | Delete the `case` arm; the switch's missing `default` means the test must fail on absence, not on a throw |

**C7 needs a real listener assertion, not a spy on my own call.** IP-15's shape is a bar that passes whether the
mechanism works or not; the T3a header records six mutations actually run, and I will run all seven of these and
report each result — a mutation not executed is a claim, not a bar.

## 6. Retry budget, pre-registered per bar

C1 · C2 · C3 · C5 · C6: **max 2 attempts each.** C4: **max 2** (assertion-only). C7: **max 3** — it crosses into
`server.ts`, where the test harness is less familiar to me and the honest failure mode is my own wiring rather
than the code under test. On the final attempt for any bar I say so, and if it fails I **STOP and report**.

## 7. Risk, stated plainly

The change is additive within one method plus one listener, and creates no path to `setAgentStatus` — so the
realistic failure is **noise**, not a kill: if either exemption predicate is truthy more often than I believe, a
run gains notices. Bounded by the per-obligation dedup, and visible immediately in the recorder.

**The risk this section originally named is discharged** — it said the one thing a test would not catch was
whether the UI tolerates an unknown broadcast `type`, to be checked during implementation. Checked at Gate 1
instead: no `default` branch in `App.tsx:202`, so an unknown type is inert. See the D3 finding above; the
consequence was not a crash risk but an overstated value claim.

**What remains genuinely uncertain:** under D3b, whether a sidebar entry per silent obligation is *useful* or
merely more noise in a 40-entry ring buffer (`pushSidebarEvent` slices to 40). Unknowable before a real run —
which is itself an argument for shipping it and looking, rather than reasoning about it.

## 8. Open questions for Gate 1 / the PO

1. **D2 — approve changing B5's contract, and which reading: (i) name-and-report, or (ii) name-but-suppress?**
   I recommend (i). This is the only question that blocks implementation.
2. **D3 — accept the declared deviation, and if so which: D3a (record only) or D3b (record + broadcast + one UI
   `case`)?** I recommend **D3b**. Rejecting D3 entirely is also coherent — it holds T3b to §5's literal text and
   leaves the notices unread, which is what T3a already does.
3. **D4 — is T3b the last phase?** Parent §9 q2 is still open: *should the sweep ever kill at all?* T3b does not
   need the answer, but if it is "no", BL-028 closes on T3b and the gap (nothing detects a hung agent in an
   ordinary orchestrator team — the wall-clock cap is the **operator seat's**) becomes a deliberate, recorded
   choice rather than today's accident.
4. **`exited`/`errored` as T3b-2** — want it filed now, or left until the vocabulary has a reader and we can see
   whether the notices are worth more producers?

## 9. Gate 1 — plan review (Claude as plan reviewer, 2026-08-08)

Reviewed under the resource-scarcity fallback: I planned it and I reviewed it, which is **not** the independence
default (`AGENT.md` → Plan Reviewer ≠ Planner). Declared loudly rather than glossed — the PO is the second pair
of eyes here, so the questions in §8 matter more than they normally would.

| Finding | Verdict |
|---|---|
| **F1** — D3's broadcast reaches nothing: `App.tsx:202` has no `default`, so an unknown `type` is inert. The plan claimed "no component needed" *and* listed the tolerance question as an open risk; both wrong in opposite directions. | **REFUTED → fixed in place.** D3 split into D3a/D3b; §7's risk paragraph rewritten; bar **C8** added. |
| **F2** — the contract-hash claim was lifted from a code comment (`types.ts:156-160`). | **VERIFIED at the artifact.** `wire-contract.json` `data` = exactly `{mcpTools, packetTypes, protocolPrefix}`, v8; `verify-contract.js:11-13` hashes `candidate.data`. Claim is true; provenance now first-hand. |
| **F3** — exemption line refs `:944`/`:951` were stale by a few edits. | **REFUTED → corrected** to `:927`/`:938`, by symbol. My own op-note, violated the same session. |
| **F4** — no consumer of `agent_non_reply` exists in `agentalk-mcp-client` either. | **VERIFIED** — repo-wide search returns nothing; the "no reader" claim covers both repos. |
| **D2** (test-contract change) and **D3** (deviation) | **NOT the reviewer's to grant.** Both are PO calls: one changes a behaviour contract, the other deviates from a PO-ratified phasing note. Gate 1 is **conditionally approved, blocked on §8 q1 and q2.** |

**Gate 1 verdict: APPROVED-PENDING-PO.** The scope fence, the bars and their mutations are sound and no bar
depends on the unanswered questions except through which reading of D2/D3 gets built. Implementation may not
start until q1 and q2 are answered.
