# Plan — the meter-cap cluster: BL-118, BL-114, BL-117

**Author:** Claude (planner). **Date:** 2026-08-05. **Status:** awaiting **Gate 1** (plan review) **and one PO
decision** (§4).
**Items:** [[BL-118]] (a cap kill orphans the provider CLI) · [[BL-114]] (the meter cap fails **open**) ·
[[BL-117]] (the meter cap fires on a sum it **cannot attribute**).
**Repo:** `agentalk-mcp-client` (all three). **Scope class:** cap + termination semantics — `human-only`, shared
launcher logic, behaviour-changing. **Not startable without Gate 1.**

---

## 1. Why these three are one plan and not three tickets

They are the same rail seen from three sides, and each one's obvious fix breaks another:

| | Failure | Where |
|---|---|---|
| BL-114 | meter unreadable ⇒ coerced to `0` ⇒ **never fires** | `scripts/launcher.mjs:229` |
| BL-117 | meter readable ⇒ fires on a **machine-wide sum** it cannot attribute | `lib/bite0-launcher.mjs:104-113` |
| BL-118 | when *anything* fires, the provider CLI is **orphaned and keeps spending** | `lib/agent-launcher.mjs:201` |

**BL-117's own text is right that BL-114 is not its duplicate** — distinct defects, distinct bars, and `hmp5` is
evidence about BL-117 only. This plan keeps them separately closeable. What it refuses to do is fix one in a way
that silently worsens another, which is exactly what happens if they are taken in isolation (§3, §5).

---

## 2. The finding that reshaped this plan — BL-114's stated fix is INCOMPLETE, and applying it alone is worse than the bug

BL-114 says: *"distinguish 'read failed' from 'read zero' by rejecting instead of coercing, so the existing
skip-a-tick path handles it."* The skip-a-tick path is real and correct (`bite0-launcher.mjs:115-118`).
**But the coercion exists in TWO places, and the item names only one.**

```js
// poll path — the one BL-114 names          // baseline path — the one it does not
readMeterPercent → `: 0`  (launcher.mjs:229)  try   { __meterBaseline = await readMeterPercent(...) }
                                              catch { __meterBaseline = 0 }        (bite0-launcher.mjs:146-147)
```

and the comparison is `const delta = pct - (config.__meterBaseline ?? 0)` (`:105`, `:108`).

**So a naive fix produces a NEW and much worse failure:** meter unreadable at launch ⇒ baseline `0`; meter
readable ten seconds later at, say, 40% ⇒ `delta = 40 − 0 = 40` ⇒ **immediate breach, run killed at once, on a
worker that has spent nothing.** Today's bug never fires; the naive fix fires instantly and wrongly. Given
[[LB-11]] says the meter is jittery by nature, that is not a corner case — it is the normal degraded path.

**Therefore the baseline must be tri-state — a number, or UNKNOWN — and an unknown baseline must not arm the
rail.** That is T2's core, and it is not in either item's text.

---

## 3. Sequencing — and why the PO decision comes before most of the code

**T1 is independent of every decision: orphaned processes are wrong under all four of BL-117's options.** It also
*underwrites* them — if the meter rail is demoted (§4 option b), `cap.wallClockMs` becomes the **only**
terminating rail, and it had better terminate completely. **T1 first, unconditionally.**

**T2's risk profile depends entirely on the §4 decision.** If the meter keeps *terminating*, T2's baseline
handling is safety-critical (§2). If the meter becomes a *warning*, the same code is merely observability and the
false-kill class disappears by construction. **Building T2 before the decision means building the dangerous
version of it and possibly throwing it away.**

```
T1  BL-118  make "terminate" mean terminate      ← start now, decision-independent
 ↓
D   BL-117  PO picks a direction (§4)            ← blocks T2's shape, not T1
 ↓
T2  BL-114  meter read + baseline fail CLOSED    ← shaped by D
```

---

## 4. ⛔ THE PO DECISION — BL-117's direction. Not mine to take.

BL-117 records four directions and says *"none chosen — deliberately not pre-judged."* It also warns:
***"Do not read this as 'the cap should be removed.'"*** The budget risk is real — a named-but-unmitigated one
already took a session window to 100%.

| | Direction | Cost | What it buys / does not |
|---|---|---|---|
| (a) | baseline + compare only a **worker-attributable** figure | large, maybe impossible | the meter is machine-wide; there may be no such figure to obtain |
| **(b)** | **demote to a WARNING** — keep reading and recording, stop terminating | **small** | removes shared-fate kills; `cap.wallClockMs` becomes the only terminating rail |
| (c) | keep terminating, require the supervising session idle | unenforceable | BL-117 already calls this "probably wrong" |
| (d) | per-actor accounting | largest | the real fix; a project, not a task |

**Planner's recommendation: (b), and the argument is that the instrument cannot mean what it is being read to
mean.** A machine-wide number cannot answer "has *this worker* overspent," so terminating on it is a coin-flip
dressed as a rail — it killed complete, verified work on `hmp5` fourteen seconds after the commit. Demoting it
keeps every byte of the observability (the reading, the delta, the artifact record) and removes only the
authority to kill, which it never had grounds for. **It does not remove the budget protection it never
provided.**

**Two consequences the PO must accept with (b), stated plainly rather than buried:**

1. **`cap.wallClockMs` becomes the only terminating rail.** That is exactly why T1 ships first — and it is worth
   noting the wall-clock rail is the one that *is* proven to terminate ([[BL-096]], e2e, PID confirmed dead).
2. **`AGENT.md`'s OPERATOR charter must be amended.** It currently makes `cap.meter` **MANDATORY** and justifies
   it as *the* mitigation for the shared-pool risk. Under (b) that sentence is false, and BL-117 already says
   *"any doc describing `cap.meter` as containment is overclaiming and should be corrected when this is fixed."*
   **Governance wording is the PO's** — this plan does not draft it.

**If the PO picks anything other than (b), T2 must ship the safety-critical baseline handling in §2 and its bar
rows become blocking rather than merely correct.**

### ✅ RATIFIED — the PO chose **(b), demote to a warning** (2026-08-05)

Accepted with both consequences above. Effects on this plan:

- **BL-117 becomes a small, well-bounded code change**, not a research direction: on breach, `emit` a warning
  event and **let the run continue**; do not `finish()`. The reading, the delta and the artifact record all
  survive — only the authority to kill is removed.
- **§2's baseline trap stops being safety-critical and becomes an observability defect.** With no termination
  path, a fabricated `0` baseline can no longer kill anything; it can only make the artifact lie. Still fixed —
  a warning that is silently wrong is still wrong — but its bar is now *correctness*, not *safety*.
- **T2 and T3 collapse into one delivery** touching one code region, with **separate bars** — which is exactly
  the "one visit to the function, two bars" shape recorded on BL-114, and it keeps BL-117's *"close neither on
  the other's evidence"* intact.
- **The `AGENT.md` charter amendment is OWED and is the PO's.** Until it lands, the charter's *"`cap.meter` is
  MANDATORY … the mitigation"* is false in code. **This plan does not draft it**; it is flagged at closure.

**Revised sequence:** **T1** (BL-118, decision-independent) → **T2** (BL-117(b) demotion **+** BL-114 fail-closed
baseline, one visit, two bars).

---

## 5. The work

### T1 — BL-118: make "terminate" mean terminate  *(decision-independent; start on Gate 1 approval)*

**Diagnosis, verified in source and by observation** — both, in that order:
- `terminateAgent` is `record.child.kill?.('SIGTERM')` on **a single pid** (`lib/agent-launcher.mjs:201`) — not a
  process-group kill.
- The provider CLI is a **grandchild**, spawned inside `llm-agent` by `BasePersistentExecutor.initialize`
  (`lib/executor-runtime.mjs:171`).
- **`llm-agent.mjs` installs NO signal handlers whatsoever** (verified: no `process.on`, no `SIGTERM`, no
  `SIGINT`). So SIGTERM takes node's default path and the process dies *without* running any cleanup.
- `BasePersistentExecutor.close()` **already exists and already kills its child** (`:224`). **The machinery is
  there; only the wiring is missing.**

**Change (narrow, deliberately not a group kill):** `llm-agent` installs a `SIGTERM`/`SIGINT` handler that awaits
the active executor's `close()` and then exits. Blast radius stays *inside the agent* — a group kill would signal
everything sharing the group, including things a future caller has not thought about.

**Mandatory guard:** the handler must exit on a short deadline even if `close()` hangs. Without it, a hung
provider makes `SIGTERM` effectively ignorable — turning a leak into an *unkillable* worker, which is strictly
worse than the bug being fixed.

- **Bar:** after a cap kill, **no provider-CLI descendant of the terminated agent is alive** — asserted *before*
  any self-exit window elapses.
- **Mutation:** remove the handler ⇒ bar red.
- **⚠️ The [[BL-096]] harness cannot serve as this bar.** Its fake bridge self-exits after 25s, which masks the
  behaviour by design. A bar built on it would pass regardless. **This is the trap most likely to produce a
  false green here.**

### T2 — BL-114: the meter read fails CLOSED, on **both** paths  *(shaped by §4)*

1. `readMeterPercent` stops coercing: an absent figure becomes an explicit failure, not `0`.
2. **The baseline becomes tri-state.** Failure ⇒ `null` (**unknown**), never `0`.
3. **An unknown baseline does not arm the rail.** On each poll, if the baseline is unknown, the first *successful*
   read **establishes** it and that tick makes no comparison. The rail arms when the meter becomes readable, and
   can never compare a live reading against a fabricated zero.
4. **Reachability is recorded in the run artifact** via the existing `emit`/`record` sink, so a grader writes
   `unavailable` instead of silently reading `0`.

- **Bars:** (i) meter unreadable throughout ⇒ rail never fires, wall-clock still terminates; (ii) **unreadable at
  baseline, readable later ⇒ NO breach** — the §2 regression, pinned; (iii) readable throughout ⇒ behaviour
  identical to today (**parity is the falsifiable bar**, per BL-084 T1's precedent).
- **Mutation:** restore either coercion ⇒ bar (ii) red.
- **Explicitly NOT done:** making an unreadable meter *fail the run*. BL-114 forbids it without a PO call, and
  [[LB-11]] says the meter is jittery by nature.

---

## 6. Scope fence

**May touch:** `lib/bite0-launcher.mjs` (baseline + poll), `scripts/launcher.mjs` (`readMeterPercent`),
`llm-agent.mjs` (signal handler), and tests. **May NOT touch:** the orchestrator, `team-coordinator.ts`, the
registry, `terminateAgent`'s own signature, or anything under `apps/`. **`AGENT.md` is out of scope** — the
charter amendment (§4.2) is the PO's.

**Show-stopper fence:** if T1 reveals that a provider survives even a correct `close()`, that is a **report**, not
a widening into process-group work.

---

## 7. What this plan does not claim

- It does **not** claim BL-118 caused the `hmp5` kill. `hmp5` has its own recorded cause; BL-118 is a mechanism
  that makes *future* meter readings less trustworthy, not a retro-diagnosis.
- It does **not** close [[BL-096]]'s third question (*whether cleanup behaves*). T1 touches process teardown, not
  worktree/branch teardown — that stays [[BL-103]].
- It does **not** make the meter attributable. Under (b) nothing becomes measurable that was not; the honest
  claim is that we **stop acting** on a number that cannot support the action.
