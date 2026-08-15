# BL-127 + BL-128 — making the non-reply sweep able to fire at all

**Status:** DRAFT — gate 1 (plan review) pending. **No engine code has been touched.**
**Planner:** Claude, 2026-08-14. **Occasion:** PO decision, same day — *"plan first, don't touch engine."*
**Inputs:** [[BL-127]], [[BL-128]], `design/archive/bl124-s3-distribution.md`, `design/bl028-plan.md`.

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

---

## 10. Gate 2 — implementation review

**Reviewer:** Claude, 2026-08-14, on `task-BL-127` at `9479f25`. **⚠️ Independence NOT obtained, again, and by
the same mechanism as gate 1.** The default is **Implementation Reviewer ≠ Implementer**. Both branch commits
are authored under the PO's git identity (the machine default, so authorship proves nothing), but the closing
blocks are written in first-person agent voice and this plan is mine — so on the balance of evidence I am
reviewing my own implementation. Under the resource-scarcity fallback that is permitted; **it is still worth
less than an independent pass, and the strongest findings below are the ones I could check by running something
rather than by reading.** Recorded rather than glossed, as §9 recorded the same gap.

**Steelman first.** The delivery does the thing this plan was written to force: it treats the *clear* path as
the load-bearing half rather than the mint, and the bars drive the **real** exec path — `McpCompleter.complete`
queues, `await_turn` stamps — instead of hand-setting `currentTurnId`. A test that stamped the field itself
would pass against the very bug, and this one does not. The B5 assertion is the right shape too: the defect was
a *relationship* between two constants in modules that cannot see each other, and it now fails closed at
construction.

### Verdict rows — every one earned by running, not by reading the diff

| Bar | Verdict | Evidence (commands run by me, at `9479f25`) |
|---|---|---|
| **B1** — exec turn sets `currentTurnId` on delivery | **VERIFIED ✅** | Green at baseline. **Mutation executed:** deleted `turnId,` from the turn literal → **4 red, B1 among them** |
| **B2a** — `submit_exec_result` clears | **VERIFIED ✅** | **Mutation executed:** removed the `cleanup()` clear → B2a red |
| **B2b** — the guard firing clears | **VERIFIED ✅** | same mutation → B2b red |
| **B2c** — terminal mid-exec clears | **VERIFIED ✅** | same mutation → B2c red |
| **B3** — a finished-then-idle agent produces **no** notice | **VERIFIED ✅** | same mutation → **B3 red**. This is the row that matters: B3 asserts an *absence* and would pass trivially against a dead detector. **It went red on the mutation, so it is load-bearing, not decorative** — the implementer's claim on this point reproduced exactly |
| **B4** — a silent exec turn produces **exactly one** notice | **VERIFIED ✅** | Green; asserts `turnId` match, `silentForMs > IDLE_MS`, and `status !== 'error'` — the advisory contract holds |
| **B5** — the guard strictly outlives the threshold | **VERIFIED ✅** *(with a scope limit — F2)* | **Mutation executed:** `<=` → `<` → the boundary bar red. Production's own value checked: `config.ts:19` is `agentIdleTimeoutMs: 180000`, so B5's `assertExecGuardOutlivesIdleThreshold(180_000)` tests the real number |
| **B6** — a planner exec turn is no longer killed at 120 s | **VERIFIED ✅** | **Mutation executed:** re-gated the default on `maintainsSession` → **2 red**. Asserts the *resolved* deadline, per D3 — no wall clock burned |
| **B7** — suite green at baseline; sink + `classifySilence` zero diff | **VERIFIED ✅** | master **754 / 90 files** → branch **766 / 92 files** = **+12, exactly the two new bar files (9 + 3)**. So no existing test was added to, removed, or weakened. `non-reply-sink.ts` diff **empty**; `classifySilence` **not touched**; changed files are exactly §5's allowlist; `npm run test -w @agenttalk/contracts` → **hash v8 verified, client alignment verified** |

`tsc -b` exit **0**. Full suite **766 passed / 0 failed**. `validate-backlog.mjs` → **130 items, 0 warnings**.
`bl093-backlog-selectable.test.ts` → **15 passed** (the eligible set is unchanged by this delivery).

### The interaction I went looking for, because it was the one that could bite

The chokepoint clears `currentTurnId` on terminal status — and `registry.ts:1422` **reads that same field** to
decide whether a dead agent is `error` or `terminated` (`agent.currentTurnId ? 'error' : 'terminated'`). If the
clear beat the read, an agent that died holding an obligation would be misclassified, silently, and the closing
block's own retraction would have been wrong in the opposite direction.

**It holds, for two independent reasons.** `onStatus` reacts *only* to `error`/`terminated`, and the reconnect
grace sets `reconnecting` (`registry.ts:1418`) — which does not trigger cleanup, so the obligation survives the
window. And at the timeout, `target` is computed **before** any `setAgentStatus` call. **Checked by reading both
paths, then corroborated by the 766-green suite.**

**The retraction in BL-127's closing block is CORRECT and I reproduced it independently:** the `conversation_end`
path *does* clear (`registry.ts:1393`), and the abnormal-drop path retains deliberately, feeding line 1422.
Gate 1's D1 claim that "the codebase already leaks obligations" was wrong, and the PO chose the chokepoint partly
on its strength. **Retracting a finding that had already influenced a PO decision is the right behaviour and I
want it on the record as such** — the fix that shipped is narrower than the claim that motivated it, which is the
outcome the show-stopper fence exists to produce.

### Findings — disposed, per Rule 7

**F1 — a false state claim, committed to the backlog. FIXED by me under Rule 6 (declared).** BL-028's update
block read *"[[BL-127]] and [[BL-128]] are fixed **and merged**"*. **They were not merged** — they are not merged
now; master carries neither commit. False when written, and it would have stayed false forever if this branch
were abandoned. Corrected in place to "fixed and gate-2 verified on the branch; the merge is gate 3's", with the
original wording preserved in a parenthetical so the record shows the correction rather than hiding it.
**Zero-risk (prose, no code) — but I want the shape named: this is [[BL-130]]'s exact family, written ONE COMMIT
after BL-130 finished correcting three of them.** The lesson that keeps not sticking is that a claim about state
written in advance of the state is a lie with a delivery date.

**F2 — the B5 invariant does not cover the healthcheck path, while its comment says it covers everything.
Recorded, NOT fixed — it needs a scope decision.** `assertExecGuardOutlivesIdleThreshold` checks only the
*default* guard (`resolveWorkerTurnTimeoutMs() + GRACE` = 605 s). The healthcheck passes an explicit short
deadline with `timeoutBackstopGraceMs: 0` (`in-process-driver.ts:199-201`), so its exec turns run a **~30 s
guard against the 180 s threshold — the very inversion this assertion exists to prevent, still present on that
path.** *Benign in effect:* the turn is torn down and the chokepoint clears the obligation, so no false notice,
and nobody wants a liveness ping watched by a non-reply sweep. *Not benign in the comment:* the doc block states
the invariant universally — *"a turn must be allowed to outlive the threshold"* — and a future reader will take
the assertion as covering every exec path. It does not. **Under B5′ as revised at gate 1 (a startup assertion +
a rejection test) the bar is MET, so this is not a refutation** — it is a gap between what the code checks and
what its comment claims, which is the family this whole task descends from. **Recommend a backlog item; filing is
the SM/PO's call, not mine.**

**F3 — `AGENTTALK_WORKER_TURN_TIMEOUT_MS` now moves planner turns; the env var's name is narrower than its
effect. ACCEPTED as declared.** The implementer surfaced this in the closing block and left the rename out of
scope as a gratuitous break of a documented operator knob. **That is the correct call** and the correct way to
report it — the deviation is disclosed, bounded, and reversible.

**F4 — worktree hygiene, for gate 3.** `apps/web/node_modules` is untracked-and-unignored in the worktree. It is
**not** in either commit (`git diff --name-only master..HEAD` is six files), so it cannot reach mainline — but the
closure sweep should account for it, and `.gitignore` arguably should.

### Verdict

**VERIFIED ✅ — all nine bars, each with a mutation or a diff-level check I executed myself. F1 fixed in place
and declared; F2 recorded as a scope question; F3 accepted; F4 handed to gate 3.**

**This does NOT close the task.** Gate 3 is a separate seat and by default a *different actor* — fresh eyes at
close — and the merge is the PO's. What I am handing over is: the bars are real, the mutations are real, the
suite delta is exactly the new bars and nothing else, and the one substantive defect I found was a false claim
about merge state rather than a fault in the code.

---

## 11. Gate 3 — closure sweep and merge

**Task-end Reviewer:** Claude, 2026-08-14. **Merged `29a87c9`** (`--no-ff`, per the repo's merge convention).

**⚠️ Independence waived by explicit PO decision, and this is the third hat on one task.** The default is
Task-end Reviewer ≠ Implementation Reviewer — *fresh eyes at close*, the seat adopted from the M15-T3 catch.
I held gate 2, and I authored this plan. I raised the waiver before taking the seat and the PO assigned it
anyway; that is the PO's call to make and it is made. **What it costs is real and should not be smoothed over:
the closure sweep below re-ran everything independently, but "independently" here means a second run, not a
second reader.** A defect that both gate 2 and the plan share is one this sweep is structurally unable to see.

### The sweep — re-run at `ca3f32e`, not inherited from gate 2

| Check | Result |
|---|---|
| Full suite | **766 passed / 92 files, 0 failed** |
| `tsc -b` | **exit 0** |
| `@agenttalk/contracts` | **hash v8 verified · client alignment verified** |
| `validate-backlog.mjs` | **130 items, 0 warnings** |
| `bl093-backlog-selectable.test.ts` | **15 passed** — the eligible set is untouched by this delivery |
| Worktree / branch hygiene | two worktrees, both accounted for; master clean before and after |
| Post-merge re-verification on master | **suite 766/92 green · tsc exit 0 · backlog 0 warnings** |

**DoD (§5) — every element maps to a bar that went red under a mutation executed at gate 2:** an exec turn
*sets* an obligation (B1) · *clears* it on completion (B2a/b/c) · a genuinely silent exec turn *produces* a
notice (B4) · a healthy idle agent produces *none* (B3). **All VERIFIED. No row deferred, none REFUTED.**

### F4 resolved, and it is not what it looked like

Gate 2 flagged `apps/web/node_modules` as untracked-and-unignored and guessed at a `.gitignore` gap. **Wrong
diagnosis — the real one is better.** It is a **symlink** (created 16:07 during the branch's build) pointing
back into the primary checkout, and `.gitignore:12` is `node_modules/` **with a trailing slash — which matches
directories only, never a symlink.** Hence the `??`. It is in no commit, so it never threatened mainline.

**But the observation worth keeping is the containment one, not the hygiene one:** the per-task worktree is the
project's declared safety sandbox for autonomous agents, and here its web dependencies are a symlink **into the
real checkout**. Nothing wrote through it this time and no agent ran autonomously in this worktree — so this is
an observation, not a finding. Recorded because the sandbox's whole value is that it is airtight, and this is a
seam in it. → recommended as a backlog item alongside F2.

### PO questions — final disposition

- **§8 q1** (fix the inversion, not the number) — answered: option (a). Delivered.
- **§8 q2** (planner deadline) — answered: 600 s, same as the worker. Delivered, with the env-var naming
  consequence disclosed (F3).
- **§8 q3** (should BL-028 T3c's `blocked_by` gain these two?) — **never answered, and now moot by events.**
  Both items are `done`, so a `blocked_by` naming them would resolve on sight. **No action needed; recorded so
  a future reader does not go looking for a decision that stopped mattering.**
- **§9 q4** (per-site clears vs a single chokepoint) — answered: chokepoint. Delivered, and it is the half the
  closing block correctly calls load-bearing.
- **Still open, untouched, and correctly flagged by the implementer:** *should the sweep ever kill at all?*
  Nothing in this task gave it a route to `setAgentStatus`, and B4 pins that.

### What this task did NOT establish — read this before scheduling BL-028 T3c

The sweep can now **observe** an exec turn. That is a capability, not a measurement. **There is still no
distribution**, and the honest sequence is: let the instrument run against real traffic *first*, then ask what
threshold the data supports. T3c's old framing — derive a number, then act — was void before this task and is
still void after it. The number was never the blocker.

**Telemetry (task closure):**
- task:        BL-127 + BL-128 (coupled — fixing either alone leaves the detector dead)
- wall-clock:  2026-08-14 16:16 → 21:47 (Δ ~5h31m, spanning two sessions; review+closure ~50m)
- budget:      weekly 17%→18% (Δ ~1%), session —→9% (Δ ~9%)  [claude, per `scripts/usage.mjs`; the meter was
               DOWN for BL-124's closure and is back up — figures are real, not estimated]
- gate:        tsc 0, suite 766/766 (92 files), contracts v8 ✅, backlog 0 warnings, pollution clean
- diff:        7 files, +516/-8; commits `8e4affe` `9479f25` `ca3f32e`, merge `29a87c9`
- outcome:     **MERGED ✅** — not pushed; the push is the PO's, absolutely and without exception
