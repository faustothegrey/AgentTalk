# Plan — O2: delete the unreachable `busy` branch, and make the helper say what it does

**Author:** Claude (planner). **Date:** 2026-08-07. **Status:** awaiting **Gate 1**.
**Source:** `design/archive/bl120-attached-busy-investigation.md` §6 (recommendation O2), delivered autonomously on
operator run `hmp6` and graded PASS. **Item:** to be filed as BL-121 at the gate.
**Scope class:** engine, shared status logic — but a **provably zero-behaviour-change** one. See §2.

> The record half of O2 is **already done** (merged `8145fbb`, `e1e7830`): the false claim was retracted in the
> plan, the code comments, the test docstring, a test title and two backlog items. **What remains is the code
> half only**, which is what this plan covers.

---

## 1. What is true today — read from the code at `df6caf2`

| Fact | Where |
|---|---|
| `setAgentBusyState(agent, busy)` has exactly **one** call site, passing `false` | declared `:822`, called `:548` (`send_to_agent`, `to === 'user'`) |
| So the `busy === true` branch — and `updateAgentSessionStatus(agent, 'busy')` — is **unreachable** | `:823-827` |
| `sessionStatus` is written at exactly **two** sites | `:348` (direct, `'starting'`) and `:840` (via the helper) |
| …and emitted at exactly **two** sites | `:367` (direct, in `activateAgent`) and `:841` (via the helper) |
| So in production `sessionStatus ∈ { undefined, 'starting', 'ready' }` — `'busy'`, `'restarting'`, `'error'` are **all** unreachable | — |
| No component in either repo reads `sessionStatus` | investigation §4 B3/B4/B9, re-verified by the grader |
| `busy` on `agent.status` has two real producers, neither of them this helper | `in-process-driver.ts:118` (both transports) · `registry.ts:1367` (reconnect restore) |

**A correction to the source document, found while planning.** `bl120-attached-busy-investigation.md` §4 row B1
calls `updateAgentSessionStatus` *"The sole writer"*. It is not — `activateAgent` writes and emits directly,
bypassing it (`:348`/`:367`). The investigation's **§2.1 names both sites correctly**, so its conclusion is
unaffected and the recommendation stands; only that one phrase is loose. Recorded rather than silently relied on.

## 2. Why this is provably zero-behaviour-change, and what that is worth

**Unreachable code cannot be observed disappearing.** With `busy === false` the helper does exactly two things:
sets `sessionStatus = 'ready'` (emitting if it changed), and moves `status` from `busy` to `ready` if it was
`busy`. Removing the other branch leaves both. There is no input under which the two versions differ, because
there is no input that reaches the branch being removed.

That is the entire argument, and it is why O2 was preferred over wiring:

- **O1 (wire it)** buys `sessionStatus = 'busy'` — a broadcast the only client drops and a REST field no
  component reads — while placing a **second `busy` producer** next to `ArbiterCoordinator`'s strict
  `=== 'ready'` convergence gate (`arbiter-coordinator.ts:196`) and a transition table that **throws**. That is
  not theoretical: an escaped `Invalid transition: terminated -> busy` once killed the orchestrator process
  (M17 G3-4, [[BL-020]]).
- **O2** touches neither of those readers, because it removes a producer rather than adding one.

## 3. The change

1. **`setAgentBusyState(agent, busy: boolean)` → `markAgentIdle(agent: Agent)`** — no boolean, no dead branch:
   ```
   private markAgentIdle(agent: Agent): void {
     this.updateAgentSessionStatus(agent, 'ready');
     if (agent.status === 'busy') {
       this.setAgentStatus(agent, 'ready');
     }
   }
   ```
2. **The one call site** (`:548`) becomes `this.markAgentIdle(agent)`.
3. **A comment** recording that `busy` is produced by the driver and the reconnect restore, and that this helper
   deliberately does not produce it — so the next reader does not re-add the symmetry as a "fix".

**The rename is the point, not decoration.** `setAgentBusyState` names a capability the method does not have;
that name is what made a reviewer (me) assume a `busy` producer lived here and reason outward from it. A helper
called `markAgentIdle` cannot be misread that way.

## 4. Bars — each falsifiable, with its mutation

| # | Bar | Mutation that must turn it red |
|---|---|---|
| **B1** | **Observable-event parity.** Driving `send_to_agent → user` emits the identical ordered sequence of `status` and `session_status` events before and after, for an agent that is `busy` **and** for one that is `ready` | drop the `updateAgentSessionStatus` call, or the `status === 'busy'` guard |
| **B2** | The helper **cannot** produce `busy`: it has no parameter and no `'busy'` literal | re-add the branch |
| **B3** | **The `busy` producers are pinned** — the driver and the reconnect restore, and nothing in `registry.ts` writes `sessionStatus = 'busy'` | add a third producer |
| **B4** | `tsc -b` 0 · suite **722/722** (86 files), unchanged | — |

**B1 is the falsifiable bar.** B2 alone is satisfied by deleting the method entirely; B1 is what proves the
*remaining* behaviour is untouched. It is written against the **emitted events**, not the internal fields,
because events are what a consumer actually observes.

## 5. Scope fence

**May touch:** `registry/registry.ts` — the helper, its one call site, and a comment — plus one new test file.

**May NOT touch:** `updateAgentSessionStatus` itself · the `activateAgent` `:348`/`:367` pair · `setAgentStatus`
/ `notifyAgentStatus` / `reportAgentError` · `ALLOWED_TRANSITIONS` · `arbiter-coordinator.ts` · anything under
`apps/`.

**⛔ Explicitly NOT in scope — the tempting adjacent cleanups, each with its reason:**
- **Narrowing `AgentSessionStatus`** to drop the unreachable `'busy'`/`'restarting'`/`'error'`. That union feeds
  `isAgentSessionStatus` in `contracts/src/protocol-payloads.ts`, and `mcp-server.ts` rejects a contract
  mismatch on **binary hash equality** (LB-66) — so it risks a lockstep break across both repos for a type
  nobody reads. Separate item if ever wanted.
- **Deleting `sessionStatus`** — the investigation recommends against it (§6): keep the field, remove the dead
  producer, so a session-level axis can be designed later *with a consumer* (its O3).
- **The `apps/web/src/api/types.ts:46` drift** (`'reconnecting'` vs the contract's `'restarting'`) — real, found
  by the hmp6 worker, out of scope here. File it.

**⛔ Show-stopper:** if B1 shows *any* event-sequence difference, **stop and report.** That would mean the
branch was not unreachable after all, and the whole justification collapses.

## 6. Risk

**The residual risk is on the naming, not the deletion.** Deleting unreachable code has no observable effect
(§2). The one way this goes wrong is a botched edit to the *reachable* half — which is exactly what B1 exists to
catch, and why B1 covers both the `busy` and the `ready` starting states rather than only the interesting one.

**Effort:** very small — one method, one call site, one test. The care is in B1, not the diff.

## 7. Open question for the gate

**Should this be the next operator rung, or should I implement it directly?**

It is an unusually good rung: the blast radius is provably zero, the bar is mechanical (event-sequence parity),
and a botched attempt fails B1 loudly rather than silently. It would also be the **first rung where an agent
changes engine code**, which is a real step up the ladder from hmp6's read-only investigation — and the
containment story (worktree, no merge rights, PO-gated) is unchanged.

Against: it is shared status logic, and the last two changes in this area both produced a false claim that
outlived them.

**My recommendation: run it as a rung.** The thing that made those false claims survive was not who wrote the
code — it was that nothing checked the claim against the running system. B1 does. If the PO prefers, I implement
it directly and it takes ten minutes.
