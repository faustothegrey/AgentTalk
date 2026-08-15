# BL-124 S3 — the distribution, and why there isn't one

**Written:** 2026-08-14 by Claude (planner + temporary implementer, resource-scarcity fallback).
**Parent:** `design/archive/bl124-plan.md` (S3, §5) · `design/archive/bl124-s2-deploy.md` §7.
**Consumes:** the live orchestrator's non-reply sink. **Consumed by:** [[BL-028]] T3c.

> **The one-sentence version:** the sink is empty after real traffic, and the reason is not that
> nothing was quiet — it is that the detector cannot fire on any turn class as deployed. **W2,
> definitively.**

---

## 1. The result

```
$ node bl124-reduce.mjs
SINK ABSENT: /Users/fausto/.agenttalk/agent-non-reply.jsonl
That is a RESULT, not an error: the sink opens nothing until a notice arrives.
notices=0 boots=0
```

**Zero notices. Zero boot markers. The file was never created.** Plan §5 pre-committed to reporting
that as a result rather than a failed spike, and this document does so — but the interesting half is
§3, because an empty sink alone could not have told us *why*.

Reduction by `reason × transport` is therefore vacuous. It is not reported as "0 in every bucket",
because that would imply the buckets were reachable and merely unvisited. They were not reachable.

## 2. What was actually run

Against the **live** orchestrator (pid 89437, port 3741, MCP 54321) — deliberately not a fresh
backend, because the sink's default path resolves off `os.homedir()` and is machine-global, so a
second instance would append into the same file indistinguishably.

The live process was confirmed to carry S1 **before** any traffic: `apps/orchestrator/dist/server.js`
and `packages/observability/dist/recordings/non-reply-sink.js` both built 2026-08-13 18:12, process
started 2026-08-13 21:07:52. Code on disk = code in memory, established by timestamp rather than
assumed.

| Run | Shape | Provider | Outcome | Longest unbroken silence while holding a turn |
|---|---|---|---|---|
| smoke | worker-only | claude/opus | `completed` in 55 s | ~50 s |
| **R1** | 2 planners + 1 worker | claude/opus | **hung in `planning`** | planner turn killed at **120 s** |
| **R2** | worker-only, substantial task | claude/opus | `completed` in 235 s | **233 s** |

**Two runs against a three-run stopping rule.** Stated plainly rather than papered over. Runs 2 and
3 of the original design were dropped once §3 was established, because they would have sampled a
distribution that provably cannot exist — and the finding is structural, not statistical, so more
samples add nothing. The pre-registration is at `design/operator/`-adjacent scratch and its terms
were fixed before any result was visible: stop at 20 notices or 3 runs; never widen the run to make
the sink non-empty.

**R2 is the load-bearing run.** Its worker held an obligation in unbroken silence for **233 s** —
53 s past the 180 s threshold, spanning one or two of the 30 s sweep ticks. It produced **no notice
and no `console.warn`**. `registry.ts:1028` warns unconditionally *before* the emit, so the absence
of a warn proves the failure is upstream of the sink: `classifySilence` never classified. No
`[NonReplySink] DEGRADED` line either — the sink was never asked to write.

Six MCP tool calls were made by that worker, all at the two ends of the turn (`report_environment`,
`await_turn`, then `submit_exec_result` / `submit_work_response` / `submit_work_result` /
`await_turn`). Nothing between, so `lastProgressAt` was genuinely stale for the full 233 s. The
silence was real.

## 3. Why the sink is empty — two independent mechanisms, and together they cover every turn

### 3a. An `exec_rpc` turn carries no obligation id, so the gate never opens

`currentTurnId` is assigned from `turn.turnId ?? turn.messageId` — `registry.ts:504-507` (attached
`await_turn`) and `in-process-driver.ts:106-109` (driver loop). And `turnId` is minted in **exactly
one place in the runtime**: `registry.ts:734`, inside a legacy-compat block that aliases it from an
inbound event's `messageId`:

```ts
if ('messageId' in evtPayload) {
  turnPayload.turnId = evtPayload.messageId;
}
```

An `exec_rpc` turn is built at `completer.ts:93-99` as `{ type, prompt, cwd?, timeoutMs? }` — **no
`turnId`, no `messageId`** — and delivered through `queueExecTurn` / `awaitExecTurn`
(`agent.ts:122-146`), which bypasses that EVT path entirely. Confirmed on the wire, in the attach
client's own printout of the turn it received:

```
Received turn: { type: 'exec_rpc', prompt: '…', cwd: 'agentalk-task-…', timeoutMs: 600000 }
```

So for every exec turn, `classifySilence`'s first gate — `if (!agent.currentTurnId) return
undefined` (`registry.ts:929`) — returns `undefined` on every sweep, permanently.

**This is the turn the sweep exists to watch.** The exec turn is where a provider CLI runs for
minutes; a hung coding agent hangs *there*. The detector is blind to precisely its own target.

### 3b. Where the id does exist, a shorter timer tears the turn down first

Conversation and consensus turns arrive as events carrying `messageId`, so `currentTurnId` **is**
set for them. But those paths never forward a per-turn deadline, so they run on the completer's
bare default:

```ts
const guardMs = opts?.timeoutMs !== undefined ? opts.timeoutMs + backstopGraceMs
                                              : DEFAULT_EXEC_TIMEOUT_MS;   // completer.ts:52-54
```

`DEFAULT_EXEC_TIMEOUT_MS = 120_000` (`completer.ts:10`) against `agentIdleTimeoutMs: 180000`
(`registry/config.ts:19`). **120 s < 180 s**, so the guard fires a full minute before the threshold
can mature. `loop()`'s catch (`in-process-driver.ts:122-135`) then ends the turn and breaks, and the
obligation is gone.

Only the worker branch forwards a deadline — `execOpts.timeoutMs = resolveWorkerTurnTimeoutMs()`
(`in-process-driver.ts:391`), default 600 s — and it is gated on `this.completer.maintainsSession`,
with the comment at `:364-365` saying so outright: *"Planner paths never pass this opt."*

Observed live during R1:

```
[InProcessAgentDriver s3-r1-planner-a] exec failed, ending turn:
  Exec for agent s3-r1-planner-a timed out after 120000ms
```

### 3c. The composition

| Turn class | Obligation id set? | Exec guard | Sweep can fire? |
|---|---|---|---|
| worker `exec_rpc` | **never** (§3a) | 605 s | **No** — no obligation to observe |
| conversation / consensus | yes, from `messageId` | **120 s** (§3b) | **No** — torn down 60 s early |

**Every turn class is excluded, by one of two independent mechanisms.** Raising the guard would not
help §3a; minting a turn id would not help §3b. Both must be fixed for the detector to fire at all.

## 4. W1 vs W2 — resolved

`design/archive/bl124-plan.md` §2 posed the fork. The answer is **W2**, and more completely than W2 was
stated:

> **W2 — the sweep does not fire in practice.** *"Some condition in `classifySilence` — most
> plausibly `currentTurnId` being cleared earlier than the gate assumes, or the once-per-obligation
> dedup key — means real runs never reach the emit."*

The plan guessed the right field for the wrong reason. `currentTurnId` is not *cleared early* — for
exec turns it is **never set at all**. The dedup key is innocent.

**W1 is refuted.** Real traffic *was* quiet past the threshold: 233 s of it, in one turn, on the
live instance. The instrument saw nothing.

**And this retires the 41-boot puzzle.** `design/archive/bl124-plan.md` §1 recorded zero `"has not replied"`
lines across 41 boots and could not date the activity against the merge. That ambiguity is gone: the
count would be zero across any number of boots and any amount of traffic.

## 5. What this means for [[BL-028]] T3c

**T3c cannot proceed on its stated premise, and the premise was never the real blocker.** It was to
derive an escalation threshold from a measured distribution of real silences. There is no
distribution to derive one from — and a threshold on a detector that cannot fire would be a number
with no referent. T3c's actual precondition is now: **make the sweep able to observe an exec turn.**

`design/archive/bl124-plan.md` §5 anticipated exactly this and called it correctly:

> *"that refutes W1 and lands us in W2 — a live defect in a shipped detector, which is a larger
> finding than the threshold this spike set out to inform."*

It is larger. The spike delivered the thing it was built to protect against delivering: an honest
negative, arrived at without touching the threshold.

## 6. Honest limits of this result

- **Two runs, not three.** Justified in §2, but it is a shortfall against a pre-registered rule and
  is not dressed up as anything else.
- **Single provider (claude/opus).** Sufficient by plan §8 q3 — `activateAgent` starts an
  `InProcessAgentDriver` for both transports (`registry.ts:382-391`) — and the mechanisms in §3 are
  provider-independent by construction. But no second vendor was exercised.
- **§3b's scope is argued from one observed timeout plus the code.** I saw the 120 s kill on one
  planner turn and read the branch that explains it. I did not enumerate every call site that
  reaches `executePrompt` without a deadline.
- **Nothing here was fixed, and nothing here is a proposal.** Both mechanisms are shared engine code
  and both are show-stoppers under plan §6 and the Implementer Rules. They are filed as [[BL-127]]
  and [[BL-128]]; the disposition is the PO's.
- **The sink itself is not implicated and was never exercised.** S1's bars pinned its behaviour
  in-process; this run never reached it. Its correctness remains as evidenced at S1's close — no
  more, no less.

## 7. What was left running, and cleaned up

The R1 team (`team-1786704512290-3`) remains registered on the live orchestrator in `planning`, with
its conversation gone and its members idle — the artifact of [[BL-129]]. Worktrees `/tmp/att-s3-*`
and branches `s3-traffic-*` created for the runs were removed at close; `git worktree list` is back
to the primary checkout alone.
