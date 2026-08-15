# Plan — BL-084 **T2**: in-process faults propagate (the [[BL-078]] fix)

**Author:** Claude (planner). **Date:** 2026-08-07. **Status:** awaiting **Gate 1**.
**Parent plan:** `design/archive/bl084-plan.md` (T1 merged `05f78e3`). **Analysis:** `design/archive/bl078-decision.md`.
**Scope class:** engine, shared paths, **the only real behaviour change in the BL-084 arc**. `human-only`.

> This plan exists because the parent's §5 said *"land T1 alone, then re-gate."* This is that re-gate.

---

## 1. What is actually true today — read from the code, not the items

| Fact | Where |
|---|---|
| `isFaultClass` is live and is the single propagation decision | `registry/registry.ts:71`, consulted at `:278` |
| A transition into `error` **cannot compile** without a reason (overloads) | `registry.ts:269-271` |
| `setAgentStatus` is **`private`** | `registry.ts:269` |
| The in-process path has **exactly ONE** `error` site | `agents/in-process-driver.ts:122` |
| …and it is a **catch-all** (`catch (err)` around the whole turn loop) | `in-process-driver.ts:116-126` |
| `conversation-start-failed` is **classified but never set** — no production site assigns it | `types.ts:39`, `registry.ts:49` |
| Two tests pin "in-process error does NOT propagate", and **both exercise the same condition** | `bl077-driver-status-broadcast.test.ts:105`, `bl084-error-reason.test.ts:271` |

**T1 left T2 a marker rather than a guess** — `bl084-error-reason.test.ts:269`: *"THIS is the assertion T2
deliberately rewrites — it exists to pin today's semantics until that moment."*

## 2. The finding that shapes this plan, and it is not in either item

**The in-process error site is a CATCH-ALL, so there is no per-condition reason available where the
classification has to happen.** The taxonomy is per-cause; the call site catches everything `awaitTurn()` or
`handleTurn()` throws. Nothing at `:122` knows *why*.

So the reason must **travel with the error**. String-matching the message is rejected outright — it would make
propagation depend on prose.

**And that forces the real decision of this task: what happens to an error that carries NO reason?**

## 3. ⛔ The load-bearing decision — an unlabelled error is NON-FAULT

| | Consequence |
|---|---|
| default **fault** | Every unlabelled throw on the in-process path becomes a **team-wide kill**. Today that path propagates *nothing*, so this is the largest blast radius available, and it is exactly the DoS-lever shape the taxonomy was built to prevent. |
| default **non-fault** ✅ | T2 becomes **strictly additive**: propagation switches on *only* where a fault has been positively identified. Blast radius = one condition. |

**Choose non-fault.** Wrong in that direction, a broken in-process agent behaves exactly as it does today —
which is a known, shipped, unremarkable state. Wrong the other way, one unanticipated throw kills a team. That
asymmetry is the same one the PO used to ratify `unknown-mcp-tool` as non-fault (`types.ts:58-65`).

**It does not weaken T1's type guarantee.** The catch site still passes an *explicit* reason —
**`driver-error-unclassified`** (new, non-fault). Nothing becomes unclassified *by omission*; it becomes
unclassified **by name**, which is greppable, countable in the artifact, and honest about what we do not know.

## 4. The change

1. **A reason carrier.** `AgentReasonedError extends Error { readonly reason: AgentErrorReason }` in
   `contracts`. Thrown where a cause is known; read at the catch.
2. **Label the one known fault at its origin** — `in-process-driver.ts:134` (`Failed to start conversation`)
   throws `AgentReasonedError('conversation-start-failed')`. This is the name that has been waiting since T1.
3. **A public entry point.** `setAgentStatus` is `private`, so the driver cannot call it. Add
   **`Registry.reportAgentError(agent, reason)`** — the error-transition sibling of `notifyAgentStatus`, routing
   through the same `isFaultClass` decision at `:278`.
   **`notifyAgentStatus` is left EXACTLY as it is** for `starting`/`ready`/`busy`. Its side-effect-free contract
   is right for those and must not be widened — this adds a door, it does not move a wall.
4. **`:122` becomes** `reportAgentError(this.agent, reasonOf(err))`, where `reasonOf` returns the carried reason
   or `'driver-error-unclassified'`.
5. **Rewrite both pinning tests** to assert the new semantics. Declared, not silent: they are behaviour
   contracts and the PO's Gate-1 approval is what authorises changing them.

**Net observable change: one condition.** `conversation_start` with no peers/topic now interrupts its team.
Everything else on that path behaves byte-for-byte as today.

## 5. Bars — each falsifiable, with its mutation

| # | Bar | Mutation that must turn it red |
|---|---|---|
| **B1** | The behaviour change: the `conversation_start`-with-no-peers path **DOES** call `handleAgentFailure` | remove the label at the throw site |
| **B2** | **Parity** — every non-fault reason still does **not** propagate (reply cap, relay budget, target unavailable, workflow-gate refusal, planning-task-inactive, healthcheck token, unknown tool) | flip any one row in `isFaultClass` |
| **B3** | **Fail-safe default** — an unlabelled throw does **not** propagate, and surfaces as `driver-error-unclassified` | default the catch to fault |
| **B4** | No double-fire: the `oldStatus !== 'error'` guard still holds | remove the guard |
| **B5** | **Attached path untouched** — its propagating set is identical before and after | — (regression) |

**B2 is the falsifiable bar of this task**, exactly as parity was for T1. B1 alone would be satisfied by a
change that propagates *everything*.

## 6. Scope fence

**May touch:** `agents/in-process-driver.ts`, `registry/registry.ts` (the new public method only),
`contracts/src/types.ts` (one new non-fault reason + the error class), and the two named tests.

**May NOT touch:** `team-coordinator.ts` (**expect a 0-line diff**, as T1 achieved), the attached transport
path, BL-083's budget logic, or `idle-timeout` — **that row is [[BL-028]]/T3 and `types.ts:46-51` says in
terms: "Do NOT flip it here."**

**⛔ Show-stopper:** if wiring this reveals that `handleAgentFailure` misbehaves for an in-process agent — e.g.
requesting shutdown of members that do not exist, or an unclean interrupt — **STOP and report.** That is engine
behaviour beyond the label and needs its own decision.

## 7. Risk, stated plainly

The failure mode if a classification is wrong is **team-wide shutdown on a normal event**. §3's default bounds
it, but does not eliminate it for the one row we *do* flip. So the implementer re-reads
`conversation-start-failed` against its live call site rather than inheriting T1's labelling on trust — T1
labelled to *preserve* behaviour, and T2 is the first time a label actually *causes* something.

**Effort:** small — one condition, one new method, one new reason, two rewritten tests. The care is in §3 and
§5, not the diff size.

## 8. What T2 does not do

It does **not** close [[BL-028]] (that is T3, and it needs the sender-side non-reply reason as well), and it
does **not** make the idle sweep live. It closes **[[BL-078]]** and unblocks T3.
