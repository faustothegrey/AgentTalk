# BL-084 — a typed reason on the error transition, and fault-class-only propagation

**Status:** PLAN — awaiting Gate 1 (plan review) and the PO's ratification of the **classification table** (§4).
**Planner:** Claude, 2026-07-27. **Item:** [[BL-084]], filed out of the [[BL-078]] decision brief §5c.
**Unblocks:** [[BL-078]] (deferred on this) · [[BL-028]] (the dead idle timeout).
**Reading order:** `design/bl078-decision.md` first — it holds the measured blast radius this plan builds on.

---

## 0. The distinction that shapes everything below

BL-084's filing says "adopt LB-67 Finding 1's reason vocabulary." **Read that as the starting point, not the
scope** — because LB-67's seven reasons answer a *different question* than the one BL-078 needs answered:

| | question | consumer |
|---|---|---|
| **LB-67 Finding 1** (`turn-ended · exited · quiet · user-stopped · errored · awaiting-input · receiver-cancelled`) | *why did a peer not reply to my message?* | the **sender's** next move; [[BL-028]]'s idle sweep |
| **What BL-078 needs** | *why did this agent enter `error`, and is that its fault?* | **M03 propagation** — kill the team or not |

They overlap (`errored`, `exited`) and diverge (`receiver-cancelled` is not an error cause; a workflow-gate
refusal is not a non-reply). **Adopting the seven verbatim as the error taxonomy would be a design error** —
it would model a defect as a delivery outcome. What both items actually need is **one primitive: a typed reason
attached to the status transition, plus a predicate that says whether it is fault-class.** LB-67's vocabulary is
then the natural *superset* the non-reply path draws from later, not the shape of this change.

## 1. Goal, in one line

**A status transition into `error` carries a typed reason, and M03 propagation fires only for fault-class
reasons** — so a conversation ending normally, a rail firing correctly, or a refused privilege escalation stops
being indistinguishable from a crash.

## 2. Why two items are stuck behind this (verified, in the brief)

`error` is one undifferentiated bucket. `Registry.setAgentStatus` fires
`teamCoordinator.handleAgentFailure` on *any* entry into `error` (`registry.ts:226-228`), and that interrupts the
task, sets `team.status='error'`, deletes `currentTaskId`, and **requests shutdown of every other member**. So:

- **BL-078** cannot route driver errors through `setAgentStatus`, because five of seven driver-path triggers are
  not faults (brief §3, measured).
- **BL-028** cannot switch on the idle sweep, because an agent paused `awaiting-input` is observationally
  identical to a dead one.

Same missing primitive, two directions.

## 3. Design — one enum, one predicate, one chokepoint

```
AgentErrorReason        // the typed reason, on the transition
  ├─ fault-class        → propagation fires (M03 Shared-Fate, unchanged severity)
  └─ non-fault          → status changes, UI sees it, NO propagation

setAgentStatus(agent, status, reason?)      // reason required when status === 'error'
isFaultClass(reason): boolean               // the single decision point
  └─ handleAgentFailure called only when isFaultClass(reason)
```

Three properties worth stating because they are what make this safe:

1. **One decision point.** Propagation already funnels through exactly one `if` (`registry.ts:226-228`). The
   change is to make that `if` consult the reason. No new propagation paths.
2. **The default is the safe direction.** An *unlabelled* error must be treated as **fault-class**, preserving
   today's behaviour for any call site not yet migrated. Migration then only ever *removes* propagation, never
   silently adds it.
3. **`notifyAgentStatus` survives as-is** (BL-077's side-effect-free notifier) until T2 decides otherwise —
   see the phasing.

## 4. The classification — the real decision content, for the PO to ratify

Inventory of everything that reaches `error`, from the brief plus a fresh sweep of `handleMcpToolCall`'s throws
(`registry.ts:388-600`) and the attached close paths (`registry.ts:1112-1167`). **My proposal; the PO ratifies —
each row is a behaviour call, not an implementation detail:**

| Trigger | Site | Proposed |
|---|---|---|
| Conversation **reply cap** reached | `registry.ts:869-872` | **non-fault** — it is how a conversation ends |
| **BL-083 relay budget** exhausted | `registry.ts` (BL-083) | **non-fault** — a rail firing correctly |
| Target agent not `ready`/`busy` | `registry.ts:863-865` | **non-fault** — normal in attach mode |
| Workflow-gate refusal (`[PO]`/`[SM]` tag, wrong role) | `registry.ts:434/437/440` | **non-fault** — a deliberate security refusal; propagating a *rejected* escalation is a DoS lever |
| `Planning task is not active for team X` | `registry.ts:471` | **non-fault** — a routing guard |
| Invalid / stale healthcheck token | `registry.ts:417/421` | **non-fault** — usually a late ack |
| `Unknown MCP tool call` | `registry.ts:599` (now `:651`) | **non-fault** — ✅ **PO-RATIFIED 2026-07-27**, reversing the proposal in this row. A mistyped/hallucinated tool name harms nobody else and is the same transient class as the malformed JSON `parseWithRetry` already retries; propagating it lets one typo kill a team and hands anyone able to induce a bad tool name a DoS lever (as with `workflow-gate-refusal`). Landed in `task-bl084r1`. |
| `Failed to start conversation` | `in-process-driver.ts:117` | **fault** |
| Provider/exec crash | already fenced to `awaiting_operator` (M08-T3) or swallowed to `null` | unchanged — do not touch |
| **Attached:** MCP close code 1011 (internal error) | `registry.ts:1123` | **fault** — propagates today, keeps propagating |
| **Attached:** reconnect timeout with an in-flight turn | `registry.ts:1160-1163` | **fault** — propagates today, keeps propagating |

**Load-bearing finding: the attached path needs labels, not a semantic change.** Both attached `error` sites are
genuine faults, so applying the predicate there is **behaviour-preserving**. Clean closes and
`conversation_end` already go to `terminated`, which never propagated. **So the only place where behaviour
actually changes is the in-process path** — which is precisely BL-078. That is a much smaller blast radius than
"propagate on both transports" sounds, and it is why §5's phasing works.

## 5. Phasing — three units, and only the middle one changes behaviour

**T1 — the primitive, behaviour-preserving.** Add the enum, the `reason` parameter, and `isFaultClass`. Label
every existing call site so that **every propagation decision today is reproduced exactly**: all current
attached `error`s are fault-class (they propagate, as now); in-process errors still go through
`notifyAgentStatus` (they do not propagate, as now). **Provable by construction:** the suite must pass
unchanged, and a test asserts `handleAgentFailure` call-for-call parity. A pure refactor that lands the
vocabulary.

**T2 — the BL-078 fix, the only behaviour change.** Route the driver's error transition through the
reason-aware path, passing the classified reason. Fault-class in-process errors now propagate; the five
non-fault triggers do not. **This is where BL-077's pinning test is deliberately rewritten** — it exists to
pin today's semantics until this moment. Diff should be small; the thinking is all in §4's table.

**T3 — [[BL-028]], separately.** The idle sweep can then land, passing a non-fault reason
(`quiet`/`awaiting-input`), so a correctly-paused agent is no longer killed. **Out of scope here** — it is its
own item with its own risks (and needs the sender-side non-reply reason, §0's other axis).

**Recommendation: land T1 alone first, and stop.** It is the whole primitive with zero behaviour change, it is
independently valuable, and it makes T2 a small reviewable diff instead of a large one entangled with a
refactor.

## 6. Scope

**T1 may touch:** `packages/runtime-core/src/registry/registry.ts` (the transition + predicate),
`packages/contracts/src/types.ts` (the enum), and new/updated tests.
**May NOT touch:** `team-coordinator.ts` (`handleAgentFailure` stays byte-for-byte — only its *caller's
condition* changes) · `in-process-driver.ts` (that is T2) · `conversation-coordinator.ts` ·
`conversation-store.ts` · the M08-T3 `awaiting_operator` fence · anything under `apps/` except a config-shape
test if the enum forces one (see BL-083's deviation 2 — the same `toEqual` trap lives there).

**Fence, stated as a property:** *no propagation decision may change in T1. An unlabelled error stays
fault-class. `handleAgentFailure`'s behaviour, once called, is untouched in all three phases.*

**Show-stoppers — stop and report, do not fix:** any temptation to make the idle sweep live (that is BL-028),
to alter the `conversation_end` `stop()` brake, to change BL-083's budget semantics, or to "tidy"
`handleAgentFailure` while in there.

## 7. Risks

- **The classification is a judgement call, and a wrong row is a live defect** — either a crash that no longer
  stops a team (too lenient) or a normal ending that kills one (too strict). Mitigation: the PO ratifies §4
  before code, and every row gets a test naming the row.
- **`Unknown MCP tool call` is the genuinely unclear row.** It is a protocol violation, but it harms nobody
  else and a strict reading kills a team for one malformed call. Flagged as an open question, not silently
  decided.
- **Unlabelled call sites drifting in later** and silently propagating. Mitigation: make `reason` **required**
  when `status === 'error'` at the type level, so a new site cannot compile without a decision.
- **T1 looks like a no-op and invites a rubber-stamp review.** Mitigation: its DoD bar is *parity*, which is
  falsifiable — see below.

## 8. Definition of Done (T1)

Bar written **before** the code, RED before / GREEN after — that ordering is unfakeable.

| # | Row | Verified by |
|---|---|---|
| 1 | `reason` is **required** by the type system when transitioning to `error` | `tsc` fails on a site without it (demonstrated, then fixed) |
| 2 | Propagation parity: `handleAgentFailure` fires for exactly the same set of transitions as before | New test spying the call across every reachable trigger |
| 3 | Every §4 row has a test naming it and asserting its class | New test file, one case per row |
| 4 | An **unlabelled** error still propagates (the safe default) | Explicit test |
| 5 | `handleAgentFailure` itself is byte-for-byte unchanged | `git diff` on `team-coordinator.ts` is empty |
| 6 | BL-077's pinning test **still passes untouched** in T1 (it is only rewritten in T2) | Recorded run |
| 7 | `npx tsc -b` → 0 · full suite green (baseline **416/416**, 72 files) | Recorded output |
| 8 | Mutation check: flipping one row's class fails that row's test | Recorded |
| 9 | No worktree/process pollution | `git worktree list` + `ps` |

## 9. Open questions for the PO gate

1. ~~**Ratify §4's table**~~ ✅ **DONE — PO ratified 2026-07-27: `unknown-mcp-tool` is NON-FAULT**, reversing
   this plan's proposal. Rationale is the asymmetry of being wrong: wrong as non-fault, a confused agent limps and
   is still bounded by the wall-clock cap, the reply cap and BL-083's relay budget; wrong as fault, a team dies for
   a typo. **All eleven rows are now ratified.** The flip is behaviour-neutral today — the literal is passed at no
   `setAgentStatus` call site (verified), so it only takes effect in T2, which is exactly when it must be right.
2. **Land T1 alone, or T1+T2 together?** I recommend T1 alone, then re-gate.
3. **Should the reason be surfaced to the UI and the transcript?** It is the honest thing (an operator seeing
   `error` deserves to know it was a reply cap, not a crash) but it widens T1 into the event payload and the
   web UI. My inclination: emit it on the existing `status` event in T1, leave the UI rendering to a follow-up.
4. **Naming.** `AgentErrorReason` + `isFaultClass` above, but this vocabulary will outlive the change and
   BL-028 will extend it — worth ten seconds of your preference now rather than a rename later.
