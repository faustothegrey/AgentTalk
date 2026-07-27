# BL-078 — should a driver-path agent error propagate failure?

**Status:** DECISION BRIEF for the PO — analysis complete, **no code written, nothing decided**.
**Author:** Claude (planner), 2026-07-27. **Item:** [[BL-078]], filed from [[BL-077]].
**Related:** [[BL-028]] (dead idle timeout — shares this brief's blocker) · [[BL-083]] (merged today; adds one
case to the blast radius) · LB-67 Finding 1 (the typed non-reply `reason`) · M03 Shared-Fate.

**Recommendation in one line: take (a) now — document the asymmetry — and make (b) conditional on a typed
error reason, converging with BL-028. (b) as filed is not safe, and the reason is measurable, not aesthetic.**

---

## 1. What propagation actually does (verified: `team-coordinator.ts:1596-1641`)

`handleAgentFailure` is not a status tweak. On a task in `delegated` / `in_progress` /
`awaiting_confirmation` it:

- sets `task.status = 'interrupted'` and records a transcript entry,
- sets `team.status = 'error'` and **deletes `team.currentTaskId`**,
- notifies **every other member**, and calls **`requestAgentShutdown(member.agentId)` on each** — including
  members that are working perfectly.

On a `planning` task it routes to `interruptPlanningForMissingEvents`. So propagation is a **team-wide hard
stop**. That severity is the whole point of M03 Shared-Fate, and it is also why the trigger has to be right.

## 2. The asymmetry today (verified)

| Path | Route | Propagates? |
|---|---|---|
| Attached transport (disconnect / error) | `setAgentStatus` (`registry.ts:1117-1162`) | **Yes** — `setAgentStatus` fires `handleAgentFailure` on entry to `error` (`registry.ts:226-228`) |
| In-process / API driver | `notifyAgentStatus` (`in-process-driver.ts:105`) | **No** — deliberately side-effect-free (BL-077) |

BL-077 made the driver's transitions *visible* to the UI without changing propagation, and flagged the
semantics question here. A BL-077 regression test currently **pins** the non-propagating behaviour
(`bl077-driver-status-broadcast.test.ts:84-105`, asserting `handleAgentFailure` was **not** called) — so if the
answer is (b), that test is the first thing to change, by design.

## 3. The blast radius of (b) = everything that reaches `error` on the driver path

`handleMcpToolCall` (`registry.ts:388`) has **no outer try/catch** — its inner blocks at 432 / 519 / 840 are
local and the gate one rethrows. The driver awaits it at `in-process-driver.ts:216` with no catch, so **any**
throw lands in the loop's catch and becomes `notifyAgentStatus('error')` (`in-process-driver.ts:99-108`).
Under (b) each of these would additionally trigger the team-wide stop in §1:

| Trigger | Is it an agent *fault*? |
|---|---|
| **Conversation reply cap reached** (`registry.ts:869-872`) | **No — it is how a conversation ENDS.** `markConversationCompleted` is called on the line immediately *before* the throw |
| **BL-083 relay budget exhausted** (merged today) | **No** — an anti-runaway rail doing its job |
| Target agent not `ready`/`busy` (`registry.ts:863-865`) | **No** — a peer that terminated or is reconnecting is normal in attach mode |
| Workflow-gate refusal — unauthorized `[PO]`/`[SM]` origin tag or wrong role (`registry.ts:428-441`) | **No — it is a deliberate security refusal.** Propagating it means a *rejected* privilege escalation kills the team |
| `Planning task is not active for team X` (`registry.ts:469`) | **No** — a routing guard |
| `Failed to start conversation` (`in-process-driver.ts:117`) | Plausibly yes |
| Provider/exec crash | Already handled: swallowed to `null`, or fenced to `awaiting_operator` via `McpError` (M08-T3) |

**Measured, not inferred.** A probe (throwaway, deleted, not committed) drove an in-process agent into the
BL-083 budget throw and observed:

```
[InProcessAgentDriver p78-c] error: Error: Relay budget exhausted for p78-c → p78-d: 2/2 relays …
[PROBE-B] agent a status = error
[PROBE-B] agent b status = ready
[PROBE-B] => under option (b), handleAgentFailure would fire: YES
```

**Honest limit on the evidence:** the *reply-cap* row is established by reading the chain, not by a live run —
a second probe for it failed its own harness (the mocked provider never satisfied the startup healthcheck) and
I stopped at its pre-registered budget rather than iterate. It throws from **the same function**
(`assertRelayDeliverable`) that probe B exercised live, so the mechanism is proven and only the trigger differs.
Treat the reply-cap row as verified-by-reading, and re-probe it before implementing (b).

## 4. Why this makes (b)-as-filed unsafe

Most of the table is **expected control flow and deliberate refusals, not faults.** The sharpest case: an agent
that reaches its conversation reply cap — *the designed way a conversation terminates* — would interrupt the
team's task and request shutdown of its teammates. A close second: a **rejected** privilege escalation would
kill the team, handing anything that can trigger a gate refusal a denial-of-service lever.

The system currently has **no way to say "this agent stopped for a normal reason" vs "this agent is broken."**
`error` is one undifferentiated bucket, and (b) attaches a team-wide kill to the whole bucket.

**This is precisely BL-028's blocker, restated.** BL-028's own entry says: do not land the idle timeout alone —
land it *with* LB-67 Finding 1's typed non-reply `reason` (`turn-ended · exited · quiet · user-stopped ·
errored · receiver-cancelled · awaiting-input`), because otherwise an agent paused awaiting input is
observationally identical to a dead one and M03 kills a team for correct behaviour. **BL-078 and BL-028 are the
same missing primitive seen from two directions.** Solving it once unblocks both; solving neither is safer
than solving one badly.

## 5. Options

**(a) Leave as-is and document the asymmetry. ✅ RECOMMENDED NOW.**
Zero risk, zero code. Records the truth in `AGENT.md`/the M03 notes: **in-process agents do not propagate
failure, and nothing detects a hung agent** ([[BL-028]]). This is honest documentation of a real gap, not a
fix — and today it is *load-bearing* rather than merely tolerable, because five of the seven triggers above are
not faults. *Cost:* the gap persists — a genuinely broken in-process agent leaves its team stuck until the
wall-clock cap.

**(b) Propagate now. ❌ NOT RECOMMENDED.**
Would convert normal conversation completion, an anti-runaway rail, and a rejected privilege escalation into
team-wide kills. Every row in §3 needs individual triage first, which *is* the typed-reason work.

**(c) Typed reason first, then narrow propagation. ⭐ THE REAL ANSWER, and a separate unit of work.**
Introduce the typed reason (LB-67 Finding 1), classify each §3 trigger as fault vs non-fault, then propagate
**only** fault-class errors — on both transports, which also removes the asymmetry rather than papering over
it. Then BL-078 and BL-028 both close on top of it. *Cost:* a real epic-sized piece touching shared engine
code, needing its own plan and Gate 1. Not a "while we're here."

## 6. What I recommend the PO decide

1. **Adopt (a) now** — I document the asymmetry, BL-078 moves to `deferred` with (c) as its reopen condition.
2. **File (c) as its own item** — "typed agent-error reason; propagate fault-class only" — with **BL-078 and
   BL-028 both marked as depending on it.** That converts three vague items into one real piece of work plus
   two dependents.
3. **Separately, a wart I introduced today and am flagging rather than quietly fixing:** BL-083's
   budget-exhausted throw errors the agent and stops its loop (probe B). That matches the pre-existing
   reply-cap behaviour exactly, so it is consistent — but "a rail fired correctly" arguably should not read as
   `error` at all. It is a **behaviour change to alter, so I have not touched it.** Candidate follow-up item,
   and a natural first customer of (c)'s typed reason.

**Nothing here is decided.** (a) vs (b) vs (c) is a product/engine call reserved to the PO; §6.2 and §6.3 are
proposals to file, not filings.
