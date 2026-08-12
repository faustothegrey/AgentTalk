# Plan — BL-028: the idle sweep, and what should actually be authoritative about a silent agent

**Author:** Claude (planner). **Date:** 2026-08-07.
**Status (corrected 2026-08-11 — this line read "awaiting Gate 1" for three days after the work shipped):**
**T3a MERGED** (`f6c7655`) · **T3b MERGED** (`9ba8197`, plan: `design/bl028-t3b-plan.md`) · **T3c
OUTSTANDING** — the only unit that can kill, gated separately, and now **preceded by [[BL-124]]**
(`design/bl124-plan.md`): T3a's promised silence distribution was never durably recorded on the live
orchestrator, so T3c's stated precondition is unmet. Of §9's questions, **q1 and q3 were ratified and
shipped**, **q4 is closed** (the dead `setAgentBusyState` branch was filed and removed by [[BL-121]]), **q5**
was settled by T3b's naming. **q2 — does the sweep ever kill at all? — remains open and is still the live PO
call**, deliberately deferred until BL-124 produces numbers.
**Item:** [[BL-028]] (filed 2026-07-10, unblocked 2026-08-07 when [[BL-084]] closed).
**Parents:** `design/bl084-plan.md` (the taxonomy, §0 for the two-axis distinction) · `design/bl084-t2-plan.md`
(the shape this copies) · **evidence:** LB-70, LB-67 Finding 1, `design/bl078-decision.md`.
**Scope class:** engine, shared paths, a live behaviour change on a currently-dead mechanism. `human-only`.

> **Read §2 before anything else.** The item's fix sketch is a hypothesis about the code, and on this one the
> code disagrees in a way that changes what the fix *is*.

---

## 1. What is actually true today — read from the code, not the item

| Fact | Where |
|---|---|
| The sweep runs every 30s over every agent | `registry.ts:218`, `checkIdleAgents` `:871` |
| `agentIdleTimeoutMs` = **180_000** | `registry/config.ts:19` |
| `hasAgentTimedOut` gates on **`status === 'busy'`** first | `registry.ts:848` |
| …then exempts fact-collection and `awaiting_operator` | `:853`, `:860` (M08-T3 effect fence) |
| …then short-circuits on `if (!agent.lastProgressAt) return false` | `:864` |
| **`lastProgressAt` is declared, read twice, and written NOWHERE** in either repo | `agents/agent.ts:32`; reads at `:864`/`:868` |
| The sweep's kill is already classified `idle-timeout` → **fault-class** | `registry.ts:52`, `:879` |
| `types.ts` says of that row, in terms: *"Do NOT flip it here… BL-028 is the item that revisits this"* | `contracts/src/types.ts:46-51` |
| The only idle test asserts the **exemption** predicate, so it passes either way (**IP-15**) | `team-worker-effect-fence.test.ts:70-71` |

Verified with `node` line-scans, not `grep` — `grep` under-reported on `registry.ts` twice during this session
(the standing op-note; it silently missed `setAgentBusyState` at `:533`/`:807`).

## 2. ⛔⛔ RETRACTED 2026-08-07 — THIS SECTION'S CENTRAL CLAIM IS FALSE

> **Read this before §2, and do not cite §2 as evidence for anything.** The "third deadness" below —
> *"on the attached transport, `Agent.status` essentially never becomes `'busy'`"* — **is wrong.**
>
> `activateAgent` (`registry.ts:377`) starts an `InProcessAgentDriver` for **both** transports; only the
> `Completer` differs (`ApiCompleter` vs `McpCompleter`). That driver calls `notifyAgentStatus(agent, 'busy')`
> on every turn it pulls (`in-process-driver.ts:118`). **An attached agent goes `ready → busy` with no
> disconnect involved** — reproduced by live probe twice, independently. The proof table below lists
> `in-process-driver.ts:112` as *"in-process only"*, and that row is the error: **I read a FILE NAME as a
> statement of scope instead of reading the call site.** `registry.ts:742` says the opposite in plain words —
> *"`apiDrivers` holds drivers for the attached transport too."*
>
> **What survives, and it is narrower:** `setAgentBusyState`'s `true` branch really is unreachable, so
> **`sessionStatus`** never becomes `'busy'` — along with `'restarting'` and `'error'`, all three unreachable.
> The real defect is a vestigial field written twice and read by nobody.
>
> **What this does NOT retract:** the `currentTurnId` gate T3a shipped. *"An obligation is outstanding"* is a
> sharper question than *"is this agent busy"* and is the one the sweep asks. It was **argued from a false
> premise, not built on one** — the behaviour is right for a reason this section failed to state.
>
> **Also false, in the same breath:** *"writing `lastProgressAt` alone would have revived the sweep for
> in-process agents ONLY"*. It would have covered attached agents too. **The item's original "doubly dead"
> diagnosis was correct and my correction to it was the error.**
>
> Refuted by the worker on run **hmp6**, commissioned to investigate [[BL-120]] — an item this very section
> produced. Full evidence: `design/bl120-attached-busy-investigation.md` §2.2.

## 2. ~~The finding that changes the fix — the sweep is **triply** dead, and the third deadness inverts the item~~ *(RETRACTED — see above; kept as the record of the mistake)*

The item calls the mechanism "doubly dead": `lastProgressAt` never written, and only `busy` agents swept. There
is a **third**, and it is the one that matters:

> **On the attached transport, `Agent.status` essentially never becomes `'busy'` — so the sweep could not touch
> an attached agent even if `lastProgressAt` were written.**

**Proof, three production writers of `busy` and no more:**

| Site | Reaches attached agents? |
|---|---|
| `in-process-driver.ts:112` — `notifyAgentStatus(agent,'busy')` per turn | **no** — in-process only |
| `registry.ts:811`, inside `setAgentBusyState(agent, true)` | **no** — `setAgentBusyState` has exactly **one** call site, `registry.ts:533`, and it passes **`false`**. The `true` branch is unreachable. |
| `registry.ts:1287` — reconnect restore, `agent.currentTurnId ? 'busy' : 'ready'` | **only** after a disconnect+reconnect with a turn in flight |

An attached agent pulls its turn through `await_turn` (`:487-495`), which sets `currentTurnId` and **leaves the
status alone**. It works, replies, and finishes — `ready` throughout.

**Consequence, and this is the whole point:** doing what the item says — make `lastProgressAt` get written —
revives the sweep **for in-process agents only**. That is the transport where a hang matters *least*: it is our
own process calling a completer, with the driver loop right there. The motivating failure — a wedged provider
CLI, *"verbatim the Hermes failure mode (LB-49)"*, in the item's own words — is **attached**, and would stay
exactly as invisible as it is today.

**So the headline fix in the item does not fix the thing the item is about.** Filed as a correction to BL-028,
not as a criticism of it: the item was written from a `grep` for the write of one field, and that grep was right.

## 3. The second thing the item's sketch leaves in place — silence as authority

The sketch is *"land the sweep together with the typed non-reply reason."* Do that literally and the deciding
signal is still **180 seconds of quiet**. Two independent reasons that is wrong:

1. **LB-67's own source retired exactly this heuristic.** Traycer demotes PTY silence to `quiet` — *advisory,
   may still be mid-turn* — and `inbox.ts:19-22` records that **monitor presence replaced "the older PTY-data
   heuristic"** as the authoritative reachability signal. LB-67 called this *"the single highest-value finding
   in this entry"* and then noted we still treat idle-timeout as authoritative. Adopting the vocabulary while
   keeping silence as the judge takes the label and leaves the lesson.
2. **180s is shorter than real work.** A real coding CLI routinely spends longer than three minutes on one turn.
   The item's own note — *"the sweep cannot kill a slow real-CLI conversation — we are accidentally immune"* —
   is a statement about the mechanism being **dead**, not about the threshold being safe. Revive it naively and
   we lose that immunity on day one.

**And we already own the better instrument.** `requestHealthCheck` (`registry.ts:832`) + `HealthcheckManager`
send a real prompt and require a real ack inside `healthcheckTimeoutMs` (30s). Silence should **trigger a
probe**; the **probe's failure** should be the fault. That converts a heuristic into a positive test, and it is
the difference between *"was quiet"* and *"did not answer when asked"*.

## 4. Design — one chokepoint, one gate change, and a signal that starts out unable to kill

```
lastProgressAt   ← written at ONE chokepoint: handleMcpToolCall entry (registry.ts:471)
                   + the in-process driver's turn boundary. Any agent action = evidence of life.

sweep gate       : status === 'busy'        ✗  (unreachable when attached — §2)
                 → currentTurnId !== undefined ✓ (transport-neutral: someone is WAITING on this agent)

sweep output     : an AgentNonReplyReason, NOT a status transition
                   quiet → ADVISORY (emitted, never propagating)
```

**Why `currentTurnId` is the right gate.** It is set when an assignment is delivered — attached `:490`,
in-process `:107` — and cleared when the terminal action completes (`markTerminalActionComplete` `:453`, the
conversation-end path `:154`, the disconnect path `:1217`). It means *"an obligation is outstanding"*, which is
precisely Traycer Finding 2's `expectsReply` cut: **you are told a peer went silent only if you were actually
waiting.** It is also self-cleaning — the `approve_each` relay path completes the sender's terminal action
before parking the message (`:571`), so a human-gated relay leaves nobody swept.

**Why the vocabulary stays separate from the fault taxonomy.** `AgentErrorReason` answers *"is this the agent's
fault?"*; the sweep answers *"why did a peer not reply?"* — different question, different consumer.
`design/bl084-plan.md` §0 rejected conflating them once already; this plan does not reopen that. The non-reply
reason is a **new, sibling** union, and only its escalation path (T3c) ever produces an `AgentErrorReason`.

## 5. Phasing — three units, and only the last one can kill anything

**T3a — the sweep goes live as an ADVISORY.** Write `lastProgressAt`; swap the gate to `currentTurnId`; emit
`quiet` as a registry event; **do not touch `setAgentStatus`**. `checkIdleAgents`'s call to
`setAgentStatus(agent,'error','idle-timeout')` (`:879`) is **removed, not re-pointed** — after T3a nothing
reaches that transition, and `idle-timeout` keeps its fault-class row for T3c.
*Value delivered alone:* the dead code is live, the false-feature claim is closed, and — the part that compounds
— **we measure, for the first time, how long real turns actually go quiet.** That number is the input to T3c's
threshold, which today we would be guessing.

**T3b — the non-reply vocabulary and the exemptions, as names.** `turn-ended · exited · quiet · user-stopped ·
errored · receiver-cancelled · awaiting-input` (LB-67 Finding 1). The two exemptions already hard-coded as
predicates — fact-collection (`:853`) and `awaiting_operator` (`:860`) — become the named `awaiting-input`
case rather than ad-hoc `if`s. **Surfacing, not killing.**

**T3c — escalation, and ONLY after T3a has produced numbers.** Silence past threshold → active healthcheck
probe → **no ack** → `setAgentStatus(agent,'error','idle-timeout')`, fault-class, M03 propagates. This is where
that row finally becomes live *and* honest, because by then it means "did not answer a direct probe".
**Gate T3c separately.** It is the only unit with a kill in it, and it should be entered with T3a's measured
distribution in hand.

**This honours the item's ordering constraint rather than breaking it.** BL-028 says: never land a killing
sweep without the non-reply vocabulary. T3a **cannot kill at all**; the kill arrives in T3c, after T3b exists.

**Recommendation: land T3a alone, then re-gate** — the same call the parent plan made for T1, for the same
reason.

## 6. Bars — each falsifiable, with the mutation that must turn it red (T3a)

| # | Bar | Mutation that must turn it red |
|---|---|---|
| **B1** | An **attached** agent with an outstanding turn and no activity past the threshold **is** reported `quiet` | restore the `status === 'busy'` gate — **this is the §2 bar; it fails today** |
| **B2** | **Nothing propagates.** Across every sweep outcome, `handleAgentFailure` is never called and no status changes | re-point the sweep at `setAgentStatus` |
| **B3** | An agent with **no** outstanding obligation (`currentTurnId === undefined`) is **never** swept | gate on `lastProgressAt` alone |
| **B4** | Any MCP tool call **resets** the clock — an agent that is working chattily is never reported | drop the write at the chokepoint |
| **B5** | Both existing exemptions (fact-collection, `awaiting_operator`) still suppress the notice | remove either exemption |
| **B6** | **IP-15 is retired**: a test that fails if `lastProgressAt` stops being written | revert the write |

**B1 and B2 are the falsifiable pair.** B1 alone is satisfied by a sweep that reports everything; B2 alone by a
sweep that does nothing. B6 exists because this item's own headline finding was *a guard that passed identically
whether the mechanism worked or not* — shipping the fix without a test that can detect its regression would
repeat the defect being fixed.

## 7. Scope fence

**May touch:** `registry/registry.ts` (the `lastProgressAt` write, `hasAgentTimedOut`, `checkIdleAgents`, one
new event), `agents/in-process-driver.ts` (the turn-boundary write), `contracts/src/types.ts` (the new non-reply
union — a **type-only** add), `registry/config.ts` if the threshold gains a name, and new tests.

**May NOT touch:** `team-coordinator.ts` (**expect a 0-line diff**, as T1 and T2 both achieved) ·
`handleAgentFailure` · the M08-T3 `awaiting_operator` fence itself (read it, do not modify it) ·
`FAULT_CLASS_BY_REASON`'s rows, **including `idle-timeout`** — T3a removes the *caller*, it does not reclassify
the row · BL-083's budget logic · `notifyAgentStatus` / `reportAgentError` semantics.

**⚠️ The wire contract is a live constraint here.** `verify-contract.js` hashes `{mcpTools, packetTypes,
protocolPrefix}`, and `mcp-server.ts:150` rejects a mismatch on **binary hash equality** (LB-66) — so a new
**protocol packet type** breaks every attached client until both repos ship in lockstep. The advisory must
therefore ride the registry's **EventEmitter** surface (the `status` / `mcp_tool_call` / `pending_relay_updated`
family), **not** a new EVT. A type-only add to `contracts/src/types.ts` does not move the hash
(`types.ts:6-7`).

**⛔ Show-stoppers — stop and report, do not fix:** the `busy`-is-unreachable finding turning out to have a
fourth writer this plan missed (say so, do not quietly widen the gate); any temptation to fix
`setAgentBusyState`'s dead `true` branch (**that is a separate item — file it, and see §9 q4**); any sweep
outcome that reaches `setAgentStatus`; a turn-boundary write that needs `handleTurn` restructured.

## 8. Risk, stated plainly

T3a's blast radius is **an event nobody consumes yet**, which is as close to zero as a live-code change gets.
The real risks are the two the phasing exists to hold back:

- **A threshold chosen from intuition.** Mitigated by construction: T3a *measures* before T3c *acts*.
- **`awaiting-input` is not fully enumerated in our own code.** We have two known pauses (fact-collection,
  `awaiting_operator`). Whether there are others is unknown, and T3a is the instrument that would reveal them —
  which is the argument for shipping the advisory *first* rather than reasoning about the list in advance.

**Effort:** T3a is small — one write, one predicate, one event, tests. The care is in §2 and §6, not the diff.

## 9. Open questions for the Gate-1 / PO decision

1. **Ratify the three-phase shape, or hold the item's "one piece of work, not two"?** I am proposing a
   deviation from a PO-approved filing and flagging it as one. My case is §2: the item's single piece assumes a
   fix that would not reach the transport it cares about.
2. **Does the sweep ever kill — i.e. is T3c wanted at all?** A detector that only ever reports is a legitimate
   end state. Note the honest gap: the wall-clock cap that gets cited as the anti-hang rail is the **operator
   seat's** `cap.wallClockMs`, which does not cover an ordinary orchestrator team. If T3c is dropped, nothing
   stops a hung attached agent — that would be a deliberate, recorded choice rather than today's accident.
3. **`busy` → `currentTurnId` widens what is observable.** Attached agents become sweepable for the first time.
   Advisory-only, but it is new output about real runs — worth a conscious yes.
4. **`setAgentBusyState(agent, true)` is unreachable dead code** (`registry.ts:807-818`), so an attached agent's
   `status` and `sessionStatus` never say `busy` and the UI cannot show it. Out of scope here and **not** to be
   fixed in passing. Shall I file it as its own backlog item?
5. **Naming.** `AgentNonReplyReason` + `nonReplyReasonOf`, mirroring `AgentErrorReason` + `reasonOf`. As with
   BL-084 §9 q4, this vocabulary will outlive the change — worth ten seconds now rather than a rename later.
