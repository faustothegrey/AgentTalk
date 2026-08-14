# BL-133 — a team-level progress predicate

**Planner:** Claude, 2026-08-14. **Item:** [[BL-133]], split out of [[BL-129]] at its closure.

## 1. The question this answers, and why it is a different question

Every anti-hang instrument we have asks **"does an agent owe a reply?"** — `classifySilence` gates on
`currentTurnId`, M03 propagation needs an agent to enter `error`. The wedge observed in [[BL-124]] S3 answered
*no* to both: team `status: planning`, `GET /api/conversations` → `[]`, all three members `ready`, **no
`currentTurnId` anywhere**. Nobody owed anything, so nothing could fire.

**"Quiet" is a property of an AGENT. "Not progressing" is a property of a TEAM.** No amount of tuning the
first produces the second. That is the whole item.

## 2. What the code already gives us — the good news, verified

`recordTaskTranscript` (`team-coordinator.ts:1525`) is a genuine **chokepoint**: **30 call sites** route
through it, and its last line already writes `task.updatedAt = now`. So a trustworthy progress clock **already
exists and is already maintained** — it just has no reader.

`getTeams()` (`:1470`) and `getTask()` (`:1553`) are **already public**. So the detector needs **zero changes
to `team-coordinator.ts`** — the frozen engine stays byte-for-byte. That is the single most important fact in
this plan.

*(Checked, and worth recording because it was my first instinct and it was wrong: `team.updatedAt` has 12 write
sites of mixed meaning and is NOT a progress signal. `task.updatedAt` has exactly one — the chokepoint. The
field with fewer writers is the trustworthy one.)*

## 3. The predicate

A team is **stalled** when all of:
1. it has a `currentTaskId`;
2. that task's status is in the **ACTIVE** set; and
3. `now - Date.parse(task.updatedAt) > teamNoProgressTimeoutMs`.

**ACTIVE = `planning` · `delegated` · `in_progress`.**

**Deliberately EXCLUDED, and this is the design's sharpest edge:**
- **`awaiting_confirmation`** — waiting on a *human* to confirm a plan. It can legitimately sit overnight.
- **`awaiting_operator`** — the M08-T3 fence. A human is *expected* to be slow; that is what the fence is for.
- `refused` · `completed` · `interrupted` — terminal.

**Firing on either "awaiting" state would be the defining failure of this feature.** A detector that reports a
human being slow as a system fault trains its reader to ignore it, and an ignored detector is worse than none —
it is the false-notice argument from [[BL-127]] §3, one level up.

## 4. The threshold, and the invariant it must satisfy

**Default: `teamNoProgressTimeoutMs = 900_000` (15 min).**

**⛔ It MUST strictly exceed the exec guard (`resolveWorkerTurnTimeoutMs() + EXEC_TIMEOUT_BACKSTOP_GRACE_MS` =
605 s).** A worker legitimately holds a single exec turn for up to 600 s producing **no transcript entry at
all**, so a threshold below the guard reports every long worker turn as a stall. That is not a tuning
preference, it is a correctness relationship between two constants in modules that do not know about each
other — **exactly [[BL-128]], which disabled the non-reply sweep for 41 boots with no test going red.**

So it is asserted at construction and **fails closed**, alongside `assertExecGuardOutlivesIdleThreshold`. The
full ordering the engine now guarantees:

```
agentIdleTimeoutMs (180s)  <  execGuard (605s)  <  teamNoProgressTimeoutMs (900s)
        │                          │                          │
   "an agent owes a reply     "a turn may run           "a TEAM has produced
    and has gone quiet"        this long"                nothing for this long"
```

## 5. What it DOES when it fires — advisory, and nothing else

It emits `team_no_progress` carrying a `TeamNoProgressNotice`. **Nothing branches on it. Nothing dies of it.**
No path to `setAgentStatus`, none to `handleAgentFailure`, no task-status write.

Three reasons, in order of weight:
1. **[[BL-028]] T3a's advisory contract** is deliberate and [[BL-127]]'s bar B4 pins it. This is its sibling.
2. **LB-96's relaxation condition names this feature as its precondition** — *"once a hang is observable
   without a kill, the kill has no remaining justification"*. A detector that itself kills cannot discharge that.
3. We have **no measurement**. Escalation should follow data, and this is the instrument that produces it.

**Reported once per `(teamId, taskId)`**, cleared when progress resumes — the same dedup shape as
`nonReplyReported`, for the same reason (a 30 s sweep must not re-emit every tick).

## 6. Scope

**May touch:** `packages/contracts/src/types.ts` (the notice type) · `registry/config.ts` (the threshold) ·
`registry/registry.ts` (the sweep, the assertion, the dedup) · a new test file.

**May NOT touch:** **`team-coordinator.ts` (zero diff — the whole design rests on this)** · `classifySilence` ·
`non-reply-sink.ts` · the exec guard or idle threshold *values* · any existing test's assertions.

**Done =** a team with an active task and no transcript activity past the threshold produces exactly one
advisory notice; a parked or task-less team produces none; nothing is killed.

## 7. Bars (pre-registered, every one gets a mutation)

| # | Bar |
|---|---|
| **B1** | An active task with no progress past the threshold → **exactly one** notice, carrying `stalledForMs` |
| **B2** | Progress (a transcript entry) **clears** the dedup, so a later stall is reported again |
| **B3** | A team with **no** `currentTaskId` → **no** notice |
| **B4** | `awaiting_confirmation` and `awaiting_operator` → **no** notice (§3's edge) |
| **B5** | **Nothing dies:** agent statuses unchanged, `handleAgentFailure` never called, task status unchanged |
| **B6** | A config where the threshold does not outlive the exec guard is **REJECTED** at construction, strict boundary (equal is not enough) |
| **B7** | Suite green; **`team-coordinator.ts` zero diff** |

**B5 is the one that matters most.** It asserts an *absence*, so it would pass trivially against a detector
that cannot fire — which is precisely the trap [[BL-127]] B3 documented. **It is only meaningful sitting beside
B1**, which proves the same machinery does fire. Neither is worth anything alone.

## 8. Show-stopper fence

`registry.ts` is shared engine code. Stop and report on: any change to `classifySilence`, to the existing
sweep's behaviour, to `handleAgentFailure`, or any path that gives this detector a route to `setAgentStatus`.
**This detector stays advisory. If making it fire requires making it kill, that is a PO decision, not an
implementation detail.**

## 9. Gate 1 — plan review

**Reviewer:** Claude. **⚠️ Independence NOT obtained** — I wrote this plan; Codex and agy remain PO-declared
unavailable. Self-review, worth less than an independent pass, recorded rather than glossed.

**Steelman.** The design's strength is that it adds a reader to a clock that already exists and is already
correctly maintained, and touches none of the frozen engine to do it. The §3 exclusions show the author
identified the failure mode that would make the feature actively harmful.

**Attack — two defects:**

**D1 — `Date.parse` on `task.updatedAt` is an unguarded parse of a string field.** If it is ever malformed or
absent, `Date.parse` yields `NaN`, `now - NaN` is `NaN`, and `NaN > threshold` is **false** — so the detector
**silently never fires**. That is the fail-*open* shape [[BL-114]] and [[BL-101]] exist to prevent, and it
reads identically to a healthy system. → **the sweep must treat an unparseable timestamp as a defect it
REPORTS, not as "no stall"**; bar added.

**D2 — B1 says "exactly one notice" but the dedup key is not stated.** `(teamId, taskId)` is right, but a task
that stalls, progresses, and stalls again must notice **twice** — B2 covers that only if the key is cleared on
progress rather than on notice. → **B2 must assert the second notice explicitly**, not merely that the entry
was cleared.

**Verdict: APPROVED with D1 and D2 folded in.** Both are bar-quality defects; neither changes the shape.

### 7′. Bars, revised after gate 1

| # | Bar | Change |
|---|---|---|
| **B8** | An unparseable / missing `task.updatedAt` is reported as a defect, never silently treated as "no stall" | **D1** — fail closed, not open |
| **B2′** | stall → notice → progress → stall again produces a **SECOND** notice | **D2** — pins the clear-on-progress semantics |
