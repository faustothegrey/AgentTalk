# BL-127 + BL-128 — making the non-reply sweep able to fire at all

**Status:** DRAFT — gate 1 (plan review) pending. **No engine code has been touched.**
**Planner:** Claude, 2026-08-14. **Occasion:** PO decision, same day — *"plan first, don't touch engine."*
**Inputs:** [[BL-127]], [[BL-128]], `design/bl124-s3-distribution.md`, `design/bl028-plan.md`.

> **Read §3 before anything else.** It records a consequence that appears in **neither** backlog item and
> which makes the naive form of the BL-127 fix **actively worse than the bug**. It is the reason this plan
> exists rather than a two-line patch.

---

## 1. Why these two are one task

The sweep emits nothing, on every turn class, for two independent reasons:

| | Turn class | Blocker | Site |
|---|---|---|---|
| **BL-127** | `exec_rpc` — the long provider-CLI turns the sweep exists to watch | carries **no obligation id**, so `currentTurnId` is never set and `classifySilence` returns `undefined` at its first gate | `registry.ts:929` · turn built at `completer.ts:93-99` |
| **BL-128** | every turn that *does* carry an id | the exec guard tears the turn down at **120 s**, 60 s before the **180 s** threshold matures | `completer.ts:10` vs `registry/config.ts:19` |

**Fixing either alone leaves the detector dead**, which is the whole argument for one task: mint an id and the
120 s guard still kills the turn before 180 s; raise the guard and exec turns still carry no id. I re-derived
both from the code rather than taking the items' word (see the citations above — each points at the code that
makes the claim true).

**Not in scope, deliberately:** [[BL-129]] (a hung team nothing can detect), §9 q2 of `bl028-plan.md` (*should
the sweep ever kill at all?*). This task makes the sweep **able to observe**. Whether observation should ever
escalate stays open and is not pre-empted here.

---

## 2. What the code actually does today

The stamping site **already handles exec turns**, which is better news than BL-127 implies:

```ts
// registry.ts:502-508 — await_turn
const turn = this.agentUsesExecTurns(agent) ? await agent.awaitExecTurn() : await agent.awaitTurn();
if (turn.turnId)        agent.currentTurnId = turn.turnId as string;
else if (turn.messageId) agent.currentTurnId = turn.messageId as string;
agent.lastProgressAt = Date.now();
```

Both branches flow into the same stamp. The exec turn simply arrives with neither field:

```ts
// completer.ts:93-99
const turn: Record<string, unknown> = { type: 'exec_rpc', prompt };
if (opts?.cwd)       turn.cwd = opts.cwd;
if (opts?.timeoutMs) turn.timeoutMs = opts.timeoutMs;
this.agent.queueExecTurn(turn);
```

So BL-127's *minting* half is genuinely small. **Scope note:** `exec_rpc` is the **attached** transport's
mechanism. A pure in-process/API agent calls the provider directly and never builds one, so this task does not
change the API path.

---

## 3. ⛔ The consequence neither item names — minting an id without a clear path is worse than the bug

**`submit_exec_result` does not clear `currentTurnId`.** It clears only `activeExecTurn`:

```ts
// registry.ts:676-682
case 'submit_exec_result': {
  agent.activeExecTurn = undefined;                 // ← the only thing cleared
  this.emit('exec_result', { agentId: agent.id, text: args.text, usage: args.usage });
  return { … };
}
```

`currentTurnId` is cleared in exactly three places, and an exec turn's normal completion reaches **none** of
them: `markTerminalActionComplete` (`registry.ts:461`, reached by `submit_work_result` and siblings),
`in-process-driver.ts:160` (`conversation_end`), and `registry.ts:1366` (the reconnect path).

**Therefore the naive fix — add `turnId` at `completer.ts:93` and stop — produces this:** an attached agent
finishes its first exec turn, `submit_exec_result` leaves the stale id in place, the agent goes idle with an
obligation that no longer exists, and **180 s later the sweep reports a perfectly healthy idle agent as
silent — then does so for every agent, forever.** The first live run would fill the sink with false notices,
and BL-028 T3c would end up deriving its threshold from pure noise.

That inverts the value of the whole exercise: today the instrument reads zero and we know why; the naive fix
makes it read a large number that means nothing. **A detector that cries wolf is worse than one known to be
mute**, because the mute one does not launder noise into a measurement.

**So BL-127's fix has two halves and the second is the load-bearing one:** mint the id **and** clear it when
the exec turn completes. Both must land together or not at all.

---

## 4. The BL-128 design fork — evidence, then a recommendation

The item is explicit that this is *"a design call, not a constant swap"*, and it is right. The asymmetry:

- `DEFAULT_EXEC_TIMEOUT_MS = 120_000` (`completer.ts:10`) applies when no `timeoutMs` is forwarded.
- Only the **worker** branch forwards one — `execOpts.timeoutMs = resolveWorkerTurnTimeoutMs()`
  (`in-process-driver.ts:391`, default **600 s**, env-configurable), gated on `this.completer.maintainsSession`.
- The comment at `:364-365` states the rest outright: *"Planner paths never pass this opt."*

**So planner turns run at 120 s — one fifth of a worker's deadline — while doing work that demonstrably
exceeds it.** An R1 planner turn was killed mid-thought at exactly 120 s during S3 and its completed response
was discarded. The 600 s worker figure was itself raised because *"rung 5 finished in ~10 minutes — i.e. at
the cap"*. The 120 s default is not a considered planner budget; it is an M08-era backstop that no one has
revisited since real CLIs started doing real work behind it.

| Option | Effect | Assessment |
|---|---|---|
| **(a) Forward a deadline on all paths** — planner turns get their own resolved timeout, same mechanism as the worker's | removes the special case; every exec turn has an explicit, configurable deadline | **Recommended.** It fixes the *inversion* rather than the *number*, and it makes the relationship "guard > threshold" an explicit property instead of a coincidence of two unrelated constants. |
| (b) Raise `DEFAULT_EXEC_TIMEOUT_MS` above 180 s | one-line, minimal | Leaves planner turns on a hard-coded budget nobody chose, and re-creates the same silent coupling at a new number. |
| (c) Lower `agentIdleTimeoutMs` below 120 s | no engine-behaviour change to turns | **Reject.** The threshold is the *output* of BL-028's measurement; tuning it to fit a guard is exactly the show-stopper `bl124-plan.md` §6 fences. |

**Recommendation: (a), with an invariant.** Whatever the numbers, the code should *assert* that the exec guard
outlives the non-reply threshold, so this inversion cannot silently return. A constant relationship that must
hold and is checked nowhere is how we got here.

---

## 5. Proposed scope

**May touch:** `packages/runtime-core/src/agents/completer.ts` (mint id; guard resolution) ·
`packages/runtime-core/src/registry/registry.ts` (`submit_exec_result` clear path) ·
`packages/runtime-core/src/agents/in-process-driver.ts` (forward a deadline on the planner path) · new tests.

**May NOT touch:** `team-coordinator.ts` · consensus/protocol · `classifySilence` itself (T3b's contract) ·
`non-reply-sink.ts` · `agentIdleTimeoutMs`'s **value** · any existing test's assertions.

**Done =** an exec turn sets an obligation, clears it on completion, and a genuinely silent exec turn produces
a notice — with no notice produced for a healthy idle agent.

## 6. Bars (pre-registered, to be reviewed at gate 1)

| # | Bar | Why it is the bar and not a weaker one |
|---|---|---|
| **B1** | An `exec_rpc` turn sets `currentTurnId` on delivery | BL-127's minting half |
| **B2** | `submit_exec_result` **clears** it | §3 — the half that prevents false notices |
| **B3** | An agent that completes an exec turn and idles past 180 s produces **no** notice | the false-positive guard, stated as the *absence* of an event |
| **B4** | A silent exec turn past threshold produces **exactly one** notice | the actual capability, end to end |
| **B5** | The exec guard is **strictly greater** than `agentIdleTimeoutMs` for every path that builds an exec turn | pins §4's invariant so the inversion cannot return |
| **B6** | A planner exec turn is no longer killed at 120 s | BL-128's observed defect |
| **B7** | Suite green at the recorded baseline; `classifySilence` and the sink have **zero** diff | proves the fix is upstream, where S3 showed the failure is |

**Every bar gets a mutation run** — each must be shown to turn red on a deliberate break, per BL-028 T3b's
precedent. B3 especially: a bar asserting an absence passes trivially against a detector that cannot fire,
which is the exact trap this whole item is about.

## 7. Show-stopper fence

All three files are **shared engine code**. Under Implementer Rule 2 the implementer stops and reports on any
behaviour change beyond the ones this plan names — in particular: any change to `classifySilence`, to the
threshold's value, to `handleAgentFailure`, or any path that gives the sweep a route to `setAgentStatus`.
**The sweep stays advisory. Nothing in this task may make it kill.**

## 8. Open questions for the PO — needed before implementation

1. **§4's fork** — confirm (a), or choose otherwise. Recommendation and evidence above.
2. **What should a planner turn's deadline be?** The worker's is 600 s and configurable. Same default, or a
   distinct one? This is a product judgement about how long a planner may think, not a technical one.
3. **Sequencing** — BL-127/BL-128 sit in front of [[BL-028]] T3c, whose old premise is now void (note recorded
   on the item, 2026-08-14). Should T3c's `blocked_by` gain these two? That edit is the SM/PO's, not mine.

---

## 9. Gate 1 — plan review

**Reviewer:** Claude, 2026-08-14. **⚠️ Independence NOT obtained:** the default is **Plan Reviewer ≠ Planner**,
and I authored this plan. Under the resource-scarcity fallback (Codex and agy PO-declared unavailable) one
actor may hold both, declaring it loudly and keeping each gate's discipline separately. **This is self-review
and its findings are worth less than an independent pass.** Recorded rather than glossed, as BL-028 T3b
recorded the same gap. If the PO wants gate 1 held properly, it should wait for a second agent.

**Steelman first.** The plan's central move is right: it refuses to treat BL-127 as a one-line patch, and §3
identifies a failure mode — a detector that manufactures false notices — that is genuinely worse than the
mute detector we have. Reading the *clear* path before writing the *mint* path is the discipline that was
missing from both backlog items.

**Then the attack. Three defects, all in the plan's own bars:**

**D1 — §3 fixes ONE of the exec turn's termination paths and the plan does not notice.** It specifies clearing
`currentTurnId` at `submit_exec_result` — the **success** path. But the guard firing (`completer.ts:85-90`,
`reject(new McpError('timeout', …))` at `:89`) ends the turn through `in-process-driver.ts`'s catch, and the worker effect-fence
diverts to `awaiting_operator`. **Neither clears `currentTurnId`.** After the fix a timed-out exec turn leaves
a stale obligation behind, which is the same false-notice bug §3 exists to prevent, arriving by the other door.
Partly masked — `classifySilence` exempts `error`/`terminated` (`registry.ts:936`) — but `awaiting_operator` is
*not* a terminal agent status: it is an exemption that returns `awaiting-input`, so a stale obligation there
becomes a growing `silentForMs` that re-notices whenever the reason changes.
**Worth noting how deep this goes:** the terminal guard's own comment concedes the clean-close and 1011 paths
*"return WITHOUT clearing `currentTurnId`"*. **The codebase already leaks obligations and papers over it with a
status check.** Minting ids for the highest-volume turn class widens that surface. → **B2 must cover every
exec-turn termination path, not just the happy one**, and the plan must say whether the fix is per-path or a
single chokepoint. *(Chokepoint is the better shape and should be evaluated first — but it touches shared
lifecycle code, so it is a show-stopper-fence question, not the implementer's to decide.)*

**D2 — B5 is not testable as written.** *"The exec guard is strictly greater than `agentIdleTimeoutMs`"*
spans two modules that do not know about each other: `Completer` has no access to `RegistryConfig`, and
`agentIdleTimeoutMs` is a constructor default (`config.ts:19`). As stated the bar is an aspiration, and an
untestable bar is exactly the kind that gets quietly downgraded to `not-checked` at delivery. **The plan must
name where the invariant lives** — the honest options are a startup assertion in the registry (which can see
both) or an explicit config-level relationship — and if neither is acceptable, **B5 should be struck rather
than carried as decoration.**

**D3 — B6 has no stated method, and its naive form costs 120 s of wall clock per run.** *"A planner exec turn
is no longer killed at 120 s"* is a timing assertion; verifying it literally means waiting past 120 s. The
plan must commit to fake timers or to asserting the resolved `guardMs` directly. **The B6 mutation run is the
one at real risk here**: a bar that is slow and awkward is the bar that gets asserted rather than executed.

**Verdict: CHANGES REQUIRED — not approved as drafted.** D1 is substantive (the plan would ship a variant of
the bug it was written to prevent); D2 and D3 are bar-quality defects that would surface at delivery as
`not-checked` rows. **None is a reason to change the plan's shape** — §1's coupling argument, §3's core
finding and §4's recommendation all stand.

**Disposition:** D1, D2 and D3 folded back into §6 below as revised bars, by the planner, before implementation.
**Gate 1 is NOT closed by this pass** — a self-held review cannot close it. It stands as: *the plan is sound in
shape, three defects were caught and folded in, and the PO decides whether that suffices or a second agent
should hold the gate.*

### 6′. Bars, revised after gate 1

| # | Bar | Change |
|---|---|---|
| **B2′** | `currentTurnId` is cleared on **every** exec-turn termination path — success (`submit_exec_result`), guard timeout, and effect-fence diversion to `awaiting_operator` | **D1.** One test per path; the "which shape" question goes to the PO, below |
| **B5′** | *Either* a startup assertion that the exec guard exceeds `agentIdleTimeoutMs`, with a test that a violating config is rejected — *or* B5 is **struck** | **D2.** No untestable bar survives into delivery |
| **B6′** | The **resolved `guardMs`** for a planner exec turn is asserted directly (not by elapsing real time) and exceeds the threshold | **D3.** Makes the bar fast, so its mutation run actually gets executed |

**New PO question 4:** D1's fix shape — clear at each of the three exec-turn termination sites, or introduce a
single lifecycle chokepoint that also closes the pre-existing clean-close leak the terminal guard's comment
concedes? The chokepoint is cleaner and strictly larger; it touches shared lifecycle code and would be
**out of scope under Rule 2 without your explicit say-so.**
