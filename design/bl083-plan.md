# BL-083 — bound agent→agent relay outside a conversation

**Status:** ✅ **DELIVERED — D1 chosen by the PO, merged 2026-07-27 (`bf83811`, fix `51a9664`) and pushed.**
The closing block, evidence and telemetry live in the [[BL-083]] backlog item; read that first. Open questions
2–4 (§9) were **not** answered explicitly and were implemented on this plan's stated defaults: ceiling **50**
configurable · reset on new-assignment events excluding `healthcheck` · **surfaced** error rather than silent
park. §9.4 (make it rung 6) was **not** taken — implemented directly.
**Planner:** Claude, 2026-07-27. **Item:** [[BL-083]] (filed 2026-07-27 from the rung-5 run).
**Related:** [[BL-041]] (same hazard class, planning path) · [[BL-047]] (surfaced it) · [[BL-078]] ·
[[BL-028]] · M20 relay approval.

---

## 0. Lead with the correction: the filed item is too narrow

BL-083 is filed as *"two **idle** in-process agents relay to each other without bound when no conversation
is active."* That is true, and it is not the whole defect.

**Verified today: no team task creates a conversation at all.** So the missing cap is not an idle-agent edge
case reachable after a conversation ends — **it is the standing condition of the normal team/baton relay
path.** A `planner-worker` team, mid-task, with both agents healthy and working exactly as designed, is
relaying agent→agent with **no reply cap of any kind**.

Reproduced, not inferred (throwaway probe, run at 12:13, deleted after — not committed):

```
[PROBE] composition        = planner-worker
[PROBE] conversations      = 0
[PROBE] active conv found  = undefined
[PROBE] => reply cap on a planner->worker relay: DOES NOT APPLY (uncapped)
```

This matters because it **eliminates two of the three fix directions the backlog item proposes** (§4), and
because it changes the severity story: the item reads as "a defect on an idle path," and the truth is "the
cap we believe we have on agent→agent relay has never applied to teams."

---

## 1. The finding, restated

`assertRelayDeliverable` is the single chokepoint every agent→agent relay passes through. It applies a reply
cap **only when an active conversation is found for the pair.** With no conversation there is no cap, so
agent A answers, relays to B, which answers, relays back — unbounded. The rung-5 worker measured **38
provider calls in 300 ms**; the reviewer's independent reproduction reached **heap exhaustion in 33.75 s**
(on `master`, with the BL-047 fix merged — so BL-047 neither introduced nor widened it).

**Live, every iteration is a real billed API call.** No conversation need ever have existed, and no operator
action is required to start it.

---

## 2. Root cause — verified by reading and running, not inferred

**a. The cap and its counter are both conversation-scoped.** `registry.ts:862-874`:

```ts
private assertRelayDeliverable(fromAgentId, targetAgent, conversation?) {
  if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') { throw … }
  if (conversation) {                                   // ← the entire cap lives in here
    const currentCount = conversation.replyCounts[fromAgentId] ?? 0;
    if (currentCount >= conversation.maxRepliesPerAgent) { … throw … }
  }
}
```

The *increment* is equally conversation-scoped — `deliverRelayMessage` calls
`recordConversationMessage` only `if (input.conversation)` (`registry.ts:921-931`), and the reply counting
lives inside `conversations.recordMessage` (`conversation-coordinator.ts:151-169`).

> **Consequence that shapes the fix: with no conversation there is no counter to consult, not merely a check
> that is skipped.** Any direction of the form "apply the cap anyway" requires **new state**. This is the
> single most important design fact in this plan, and the backlog item does not say it.

**b. Conversations are created only by explicit operator action.** `registry.startConversation`
(`registry.ts:211`) is reachable from exactly two non-test callers: the orchestrator HTTP endpoint
(`apps/orchestrator/src/server.ts:1061`) and the scenario runner
(`packages/runtime-scenarios/src/scenarios/scenario-runner.ts:153`). **Neither `team-coordinator.ts` nor
`arbiter-coordinator.ts` creates one** — grep for `startConversation`/`conversationCoordinator` in both
returns nothing. Confirmed by the probe in §0.

**c. So the relay path taken by team members is the uncapped one.** An agent's `send_to_agent` reaches
`registry.ts:472-499`: `findActiveConversationByAgents` → `undefined` → `assertRelayDeliverable` applies
**only** the target-status check → `deliverRelayMessage`. The `baton` and `workflowEvent` parameters of
`send_to_agent` (`registry.ts:421`) are the M16/M20 workflow-baton path, and it is this call.

---

## 3. What actually bounds relay today — the inventory

Because several caps exist, it is easy to believe this one is covered. It is not. Every bound in the system:

| Path | Bound today | Where |
|---|---|---|
| Operator-started conversation | reply cap per agent | `registry.ts:867-872`, `conversation-store.ts:74` |
| Team **planning** protocol (`consensus_respond`) | `task.replyCounts` vs `task.maxRepliesPerAgent` | `team-coordinator.ts:492-499` |
| Arbiter planning | `maxRepliesTotal = maxRepliesPerAgent × 2` | `arbiter-coordinator.ts:134, 258` |
| Planner re-request loop ([[BL-041]]) | explicit cap | `team-coordinator.ts:458` |
| In-process driver at `conversation_end` | `stop()` — **accidental**, in-process only | `in-process-driver.ts`, and see the BL-047 note at `registry.ts:632-644` |
| M20 `relayApprovalMode: 'approve_each'` | PO approves every relay | `registry.ts:477-488` — **opt-in, off by default** |
| **Generic `send_to_agent`, no conversation** | **target status `ready\|busy` only** | `registry.ts:863-865` — **THE HOLE** |

Two observations worth carrying into the decision. The only thing that ever stopped the idle case was the
in-process driver's `stop()` — a brake **nobody designed as one**, which is exactly why BL-047's option 2
("never stop the driver") was refuted on evidence rather than adopted. And the one existing *global* brake,
M20's `approve_each`, already demonstrates that a per-relay gate at this chokepoint is architecturally
acceptable.

---

## 4. The decision for the PO — this is the plan's actual output

The behaviour question is BL-083's own: **should an agent relay to a peer when no conversation is active?**
Given §0 and §2, "no" is not available without breaking teams. The four directions:

**D1 — a pair-scoped relay budget that does not depend on conversations. ✅ RECOMMENDED.**
Track relay counts per ordered agent pair (or per sender) in the registry, independent of `Conversation`,
and enforce a ceiling in `assertRelayDeliverable` when no conversation is found. Conversation-backed relays
keep using the existing conversation cap unchanged — so nothing about today's conversation behaviour moves.
*Cost:* new state + a reset/expiry rule (the real design work: when does a pair's budget reset?). *Risk:* a
ceiling too low truncates a legitimate long baton exchange — so the default must be generous (an anti-runaway
rail, not a conversation cap) and configurable.

**D2 — drop or park relays addressed to an agent outside any conversation. ❌ REJECT.**
The backlog offers this. §0 refutes it: team members are *always* outside a conversation, so this drops every
team baton. It would break M16/M20 outright.

**D3 — require an active conversation for agent→agent relay. ❌ REJECT.**
Same refutation, stated more strongly — teams create zero conversations, so this forbids all team relay.
Adopting it would mean making team tasks create conversations first, which is a far larger change and would
retrofit conversation semantics (topics, reply caps, completion) onto team tasks that deliberately have their
own.

**D4 — make the accidental brake deliberate: an idle agent with no conversation refuses to relay. ⚠️ PARTIAL.**
Narrow and cheap, and it closes the exact case BL-083 reports. But it leaves the team path — the *larger*
exposure found in §0 — completely uncapped, and it re-derives the brake we already know is load-bearing
rather than replacing it with a designed one. Viable only as an explicit stopgap.

> **PO decision required before any implementation.** D1 changes established behaviour on shared engine code
> (`registry.ts`, the relay chokepoint every path funnels through). No agent — including me wearing the
> implementer hat — may pick this. **If the PO prefers to bound the blast radius further, D4-then-D1 is a
> defensible two-step; I do not recommend it, because it ships a known-incomplete fix against a
> money-burning defect.**

---

## 5. Cost measurement — the one place the parked metric is free

The PO parked cost measurement (the meter goes stale for hours; the per-run `usage` sidecar is not physically
consistent). **BL-083 does not need it.** This defect is natively denominated in **provider calls**, countable
at the call site with no meter, no tokens and no plan-window percentages:

```
before:  38 provider calls in 300 ms  (worker, measured)  /  heap exhaustion in 33.75 s (reviewer)
after:   ≤ ceiling, then a refusal
```

That is a real *measured* improvement — which the autonomous-development ladder's central claim eventually
requires — obtained without un-parking anything the PO deliberately set aside.

---

## 6. Scope

**May touch:** `packages/runtime-core/src/registry/registry.ts` (`assertRelayDeliverable` + the new
pair-budget state), and a new test file under `packages/runtime-core/src/registry/__tests__/`.

**May NOT touch:** `team-coordinator.ts` · `arbiter-coordinator.ts` · `conversation-coordinator.ts` ·
`conversation-store.ts` · `in-process-driver.ts` · the M20 approval mode · anything under `apps/`.

**Explicitly out of scope, and each is a show-stopper if it looks necessary:**
- Routing the driver through `setAgentStatus` — that is **[[BL-078]]**, an undecided PO question. Touching it
  silently switches on M03 failure propagation for in-process agents.
- Reviving the idle timeout — **[[BL-028]]**, which its own entry says must not land alone (it needs LB-67's
  typed non-reply `reason`, or a correctly-paused agent gets killed).
- Removing or weakening the `conversation_end` `stop()` brake. It is load-bearing until D1 replaces it.
- Making team tasks create conversations (that is D3, rejected).

**Fence stated as a property, not a file list** (rung-5 lesson: a bright-line file rule failed by forbidding
the sanctioned fix): *do not change how any **conversation-backed** relay behaves, and do not alter agent
status semantics. The only behaviour that may change is the ceiling applied to relays where no conversation
is found.*

---

## 7. Definition of Done

The bar is written **before** the fix, and must be **RED before, GREEN after** — that ordering is
unfakeable, unlike a post-hoc revert.

| # | Row | How it is verified |
|---|---|---|
| 1 | A bounded reproduction of the uncapped idle relay is RED on `master` before the fix | New test; asserts an unbounded call count **with a hard iteration ceiling so it cannot OOM the suite** |
| 2 | The same test is GREEN after the fix | Provider calls ≤ ceiling, then a refusal |
| 3 | The **precondition guard** passes: the test proves the symptom is present, not that the harness is broken | Explicit assertion that relay is reached at all, distinct from the count assertion |
| 4 | A team `planner-worker` relay is bounded too — the §0 exposure | New test on the team path, no conversation |
| 5 | Conversation-backed relay behaviour is **unchanged** | The existing conversation-cap tests pass untouched |
| 6 | The BL-047 brake test still pins its behaviour | `bl047-api-agent-conversation-reuse.test.ts` passes unmodified |
| 7 | `npx tsc -b` → 0 | Recorded output |
| 8 | `npx vitest run` → full suite green (baseline **410/410**, 71 files) | Recorded output |
| 9 | No worktree/process pollution | `git worktree list` + `ps` |
| 10 | Measured before/after in **provider calls** (§5) | Recorded in the closing block |

**Row 3 is not ceremony.** On rung 5 my pre-registered grader was wrong twice, and a precondition guard is
the only reason a false verdict was not reported. A bar that can pass for the wrong reason is not a bar.

---

## 8. Work discipline

Per-task **git worktree**, never the primary checkout: `node scripts/wt-setup.mjs create BL-083 --base
origin/master`. Stage files **explicitly**, never `git add -A`. The agent **commits and stops; the PO
merges** — and *merge* and *push* are separate words, each awaited literally.

**Independence caveat, stated in the delivery:** as sole available agent I would author and review this. What
catches defects is running the code and checking the artifact — never a re-read of my own diff, never a
status field.

---

## 9. Open questions for the PO gate

1. **Which direction — D1 (recommended), or D4 as a stopgap first?** §4.
2. **What is the ceiling, and when does a pair's budget reset?** My proposal: a generous default (≥ 50
   relays per ordered pair) reset on `conversation_start` / `team_task_assign` / a wall-clock idle window —
   deliberately an anti-runaway rail, not a conversation cap. This is the one genuinely undecided design
   parameter in D1.
3. **Should the refusal be silent-and-parked, or a surfaced error?** An error is more honest but propagates
   into agent-visible failure text; parking is quieter but hides a real event. I lean surfaced.
4. **Does the fix warrant being rung 6** (handed to a governed worker with the direction already decided),
   rather than implemented directly? It would test the graded fence — staying inside one sanctioned behaviour
   change while refusing BL-078 and BL-028, both of which sit adjacent. Recorded as an option; the PO's call,
   and it should not delay the fix if the answer is no.
