# BL-134 — workable ⟹ eligible: retire `autonomy` as a gate, express fencing as `blocked_by`

**Status:** plan, awaiting gate 1 (plan reviewer)
**Planner:** Claude, 2026-08-15
**Blocked on:** [[BL-136]] — this plan leans the whole containment argument on Gate B, so Gate B's
recursion fence must be closed *first*. That dependency is itself a dogfood of the mechanism proposed here.

---

## 0. The change in one sentence

**Two levels replace three states:**

| Term | Means | Computed from | Who decides |
|---|---|---|---|
| **workable** | there is real work here and nothing is holding it | `status === 'todo' && blockedBy.every(isResolved)` | the backlog, mechanically |
| **launchable** | an agent may actually be started on it | a committed `design/operator/<run>.authorized` containing exactly `[PO] AUTHORIZED-RUN: <run>` | the PO, per run, at a sha |

`autonomy` disappears from both. Everything it really encoded is expressed as `blocked_by` (readiness) or
lives at the launch gate (recursion).

## 1. PO decision history — recorded, because the reasoning moved twice

1. PO framing: *"the way backlog items are eligible is too complicated; any workable backlog item must also be
   eligible for Hermes launching externally."*
2. Planner offered four options and recommended (a). **PO chose (b) — flip the default.**
3. Planner's argument against (b) was then found **factually wrong** (§2a) and a plan for (b) was written.
4. PO asked for a second, thorough pass. That pass found **(b) does not satisfy the stated requirement at all**
   (§2b), and that the field is mis-typed at the concept level (§3). **PO directed this rewrite.**

**This plan implements neither (a) as first pitched nor (b).** It implements the design §0 describes.

## 2. Two errors this plan exists to correct — both the planner's

### 2a. "(b) breaks fail-closed — 79 items go selectable" — FALSE

Measured at `f1d17b3`, fence-aware. `99` items carry no `autonomy` header (not 79 — that number came from
counting *occurrences*, including the schema example inside a code fence). Of those 99: **74 `done`, 22
`deferred`, 3 `dropped`, ZERO `todo`.** The predicate's first clause is `status === 'todo'`, which already
excluded every one of them. There was no mass release to fear.

### 2b. "(b) delivers the requirement" — ALSO FALSE, and this is the one that matters

Flipping the default yields *"any workable item **that nobody marked** is eligible."* Marked items stay fenced,
and **the only workable item in the backlog is marked**:

| | selectable set today |
|---|---|
| current predicate | `{}` |
| option (b) | **`{}`** — BL-028 carries an explicit `autonomy: human-only` |
| the stated requirement | `{BL-028}` |

BL-028 is `todo` with `blocked_by: [BL-084]`, and BL-084 is `done` — workable by every measure. **Option (b)
changes nothing whatsoever.** The first plan recorded this in its closing section as a footnote; it was the
headline.

## 3. The diagnosis: `autonomy` is a *readiness* field wearing an *authorization* field's clothes

Read the three values as they are actually defined in `design/backlog.md` and
`design/operator-seat/references/backlog-semantics.md`:

| Value | Documented as | What it actually asserts |
|---|---|---|
| `eligible` | "work bounded, DoD legible" | **the item is specified** |
| `human-only` | "judgement the item doesn't encode" | **the item is under-specified** |
| `po-decision` | "the resolution IS a PO call" | **it is a question, not a task** |

All three describe *how ready the item is*. None describes *who may touch it*. The single genuinely
authorization-shaped clause hidden inside `human-only` is the recursion guard — *"execution would itself mean
launching a session"* — and recursion is a property of the **brief and goal**, not of the item, so it belongs
at Gate B (§6, [[BL-136]]).

**This mis-typing is the complexity the PO reported.** Because the field is documented as fail-closed
governance, typing `eligible` reads as *granting a privilege*, so it is done once at a time with a pin-test
ritual — when what it actually asserts is *"this one is ready."*

## 4. Why `blocked_by` is strictly better than `human-only` for the real job

BL-028 is the live test case, and it is not dangerous — it is **unspecified**. Its remaining phase T3c
contains an undecided PO question (§9 q2, *"should the sweep ever kill at all?"*). You cannot hand an agent a
spec with a hole where a decision should be.

That is not an authorization fact. It is a dependency.

| | `autonomy: human-only` | `blocked_by: [BL-135]` |
|---|---|---|
| states a reason | no — it says only "no" | **yes — a filed, readable item** |
| releases itself | never; a human must remember | **automatically, when the blocker closes** (`isResolved`) |
| can dangle | n/a | **no — a dangling id fails `backlog:check`** |
| auditable | a field nobody can second-guess | a chain anyone can walk |

The self-releasing property is already documented behaviour: *"Closing a blocker releases dependents by
itself"* (`backlog-semantics.md`). Fencing-by-blocker **forces the fencer to name the reason as an item**,
where `human-only` names nothing and expires never.

## 5. What happens to the OPERATOR charter's safety argument

`AGENT.md` → 🔧 The OPERATOR seat → **Visibility** currently justifies Hermes's write access with:

> **[[BL-093]] made `autonomy` fail closed**: an item that does not say it is eligible *is not eligible*. So an
> item Hermes files defaults to `human-only` and reaches no worker until the PO says so. […] **And the guard is
> mechanical, not merely stated:** `bl093-backlog-selectable.test.ts:147` pins the real `design/backlog.md`'s
> selectable set *exactly* […] **Do not loosen it to accommodate the operator** — that test is now this fence's
> enforcement.

**That paragraph credits Gate A with a containment that Gate B provides, and it was always doing so.**
`selectableBacklogItems` populates an API view and two reports. It launches nothing. What actually stops
Hermes handing itself work is `hmp-commission.mjs:336-341` — a PO-committed authorization file naming that
run, at that sha, replay-guarded by `design/operator/.hmp-launched.json`.

**Replacement wording (proposed; the PO owns this prose):**

> An item Hermes files may become **workable** — but *workable is not launchable*. A launch requires
> `design/operator/<run>.authorized`, containing exactly `[PO] AUTHORIZED-RUN: <run>`, **committed at the
> repo-sha the commission names** (`hmp-commission.mjs:336-341`), single-use via the launch ledger. The
> operator can put anything it likes in front of you; it cannot hand any of it to an agent.

This is stronger than what it replaces: per-run rather than per-commit, sha-bound, and single-use.

**⛔ THE WORDING ABOVE IS SUPERSEDED — DO NOT SHIP IT. Rewritten below after [[BL-137]] merged (2026-08-15).**
Three things in it are now false or stale, and the third is the reason BL-134 was blocked in the first place:

1. **The path moved** — `design/po/<run>.authorized`, not `design/operator/`.
2. **The line reference has shifted** and must be re-read, not copied.
3. **"it cannot hand any of it to an agent" remains FALSE, and BL-137 did not make it true.** BL-137
   established that the operator *can* write the authorization — the seat holds a shell, the SSH key is
   unencrypted ([[BL-139]]), and only a secret it cannot read would be a fence. What changed is that the write
   is now **conspicuous**, not that it is prevented.

**Replacement wording (proposed; the PO still owns this prose — q2):**

> An item Hermes files may become **workable** — but *workable is not launchable*. A launch requires
> `design/po/<run>.authorized`, containing exactly `[PO] AUTHORIZED-RUN: <run>`, **committed at the repo-sha
> the commission names**, single-use via the launch ledger, and written by the PO's `approve <token>` alone.
> It lives in a directory **nothing else writes**, so an operator write there is conspicuous — and a foreign
> path in a bracketed run ([[BL-138]]). **This is detection, not prevention:** nothing mechanically stops a
> process holding a shell from writing it. The fence is the seat observing its instructions, and the
> instruments that make a breach visible.

**That is weaker than the superseded draft claimed, and deliberately so.** Shipping "it cannot hand any of it
to an agent" would replace one overstated fence with another — precisely the defect [[BL-136]] corrected in
`SKILL.md` and [[BL-137]] corrected in `AGENT.md` and `hmp-commission.mjs`. **The honest sentence is the
deliverable.**

## 6. Gate B must hold first — hence the `blocked_by`

This plan moves the whole containment argument onto Gate B. Gate B currently has a hole, verified:

- `findsLaunchInstruction` is called **once**, on the `brief` — `hmp-commission.mjs:343`
- **`config.goal` is never scanned** — the identifier appears in that file only inside a comment
- but `config.goal` is what the worker receives as its **first turn** — `bite0-launcher.mjs:195`
- the config is already parsed ten lines above the check (`hmp-commission.mjs:357-365`)
- `design/operator-seat/SKILL.md:167-170` instructs Hermes to run that scan **by hand**

So the fence protects the document the worker may never read, and not the instruction it actually receives.
Filed as **[[BL-136]]**; BL-134 is `blocked_by` it.

**⛔ A near-miss recorded rather than buried.** This pass almost reported a second hole: *"commission mandates
`cap.meter` — which `AGENT.md` says cannot end a run — but never checks `cap.wallClockMs`, the only
terminating rail."* The first half is true; the conclusion is **wrong**. `bite0-launcher.mjs:36` throws
`config.cap.wallClockMs must be > 0`. It is enforced, downstream. Moving it to commission would make the
refusal legible and dry-runnable, but **it is not a containment hole** and this plan does not claim one.
Forty seconds of reading separated a real finding from a repeat of [[BL-132]].

## 7. Scope

**MAY touch:**

| File | Change |
|---|---|
| `apps/orchestrator/src/backlog.ts` | drop the `autonomy === 'eligible'` clause from `selectableBacklogItems`; keep the field parsed and exposed, redocumented as **advisory readiness metadata**; rewrite the function's doc comment |
| `scripts/infra-invariant.mjs` | `parseSelectableIds` mirrors the new predicate (it duplicates it deliberately; a drift test pins the two); this becomes the tripwire's new home (§8) |
| `scripts/validate-backlog.mjs` | **migration warning**: a `todo` item whose `autonomy` is `human-only`/`po-decision` with **no unresolved blocker** is fenced by a field that no longer fences → "convert to `blocked_by`" |
| `apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts` | contract changes enumerated in §9 |
| `design/backlog.md` | schema block (lines 25-46); BL-028's `blocked_by`; the BL-134 item |
| `AGENT.md` | the OPERATOR **Visibility** paragraph, per §5 |
| `design/operator-seat/references/backlog-semantics.md` · `SKILL.md` | both state the fail-closed default and the three-value ladder |

**MAY NOT touch:** `scripts/hmp-commission.mjs` (that is [[BL-136]]; a launch-gate change does not get bundled
into a bookkeeping change) · `team-coordinator.ts` · the registry · anything on the exec/turn path.

**Deliberately NOT done: stripping `autonomy` from the 54 items that carry it.** A 54-item mechanical diff
inside a simplification task is a bad trade. The field stays, demoted to advisory, and the §7 migration warning
surfaces each case that still needs converting — a guided migration instead of a blind rewrite.

## 8. The pin test is retired deliberately — and the tripwire moves, it does not vanish

`bl093-backlog-selectable.test.ts:147` pins the real backlog's selectable set **exactly**, so any change forces
a human look. Under the new predicate that set changes whenever *any* item is filed or *any* blocker resolves
— ordinary backlog motion, not a governance event. Kept as-is it becomes churn, and the first person to
"fix the red" would loosen it, which its own comment forbids.

**It moves to `scripts/infra-invariant.mjs`, which is the better home and always was:** the harness brackets
every operator run (`snapshot` before, `check` after), so the workable set is reported **at the moment it
matters — a launch** — rather than at every commit. A `critical` there already gates the next operator run.

This is a conscious loss of a commit-time tripwire in exchange for a run-time one. **No fake replacement is
manufactured**: if the PO wants the commit-time bar kept as well, say so at gate 1 and it stays, pinning the
*workable* set instead of the selectable one.

**Gate 1 (§13 F3) sharpened this: it is not only a change of location, it is a change of FREQUENCY** —
every-commit becomes only-when-an-operator-runs. If no operator run happens, nothing checks at all. That is
defensible because a launch is the risk moment, but it must be read as the trade it is: **fewer checks, better
timed.** A harness bug now goes unnoticed longer.

## 9. Test contracts that change — enumerated, because they are contracts

Under the M06 rule these are behaviour contracts; each change is named here, not discovered in a diff.

| # | Assertion | Disposition |
|---|---|---|
| 1 | "an item with no `autonomy` header is not selectable" | **inverts** — it is selectable if workable |
| 2 | "an unknown `autonomy` value is not selectable" | **inverts** — `autonomy` no longer participates |
| 3 | "`doing` is excluded — someone already has it" | **unchanged** |
| 4 | "requires EVERY blocker to be resolved, not just one" | **unchanged — and now load-bearing**, since it is the only fence left |
| 5 | "an unknown blocker id keeps the item back" | **unchanged — now load-bearing** for the same reason |
| 6 | the real-backlog exact pin at `:147` | **retired**, per §8, with the reasoning recorded in place |

**Mutation discipline is mandatory on rows 3-5.** They carry the entire predicate now. An absence-asserting
bar that passes for the wrong reason is this project's documented failure mode (a test double lacking the
method under test, caught 2026-08-14), and rows 4-5 are exactly that shape.

## 10. Definition of Done

| # | Bar |
|---|---|
| D1 | `selectableBacklogItems` is `status === 'todo' && blockedBy.every(isResolved)`; `autonomy` appears nowhere in it |
| D2 | `autonomy` is still parsed, still in the API projection, documented as **advisory** — no silent field removal |
| D3 | `parseSelectableIds` agrees with the real parser; the existing drift test is green |
| D4 | `validate-backlog.mjs` warns on `todo` + fenced-by-field + no unresolved blocker; exit code unchanged |
| D5 | **The mechanism is proven on the real case:** [[BL-135]] is filed, BL-028 carries `blocked_by: [BL-135]`, and BL-028 is consequently **NOT** in the workable set — fenced for a stated, self-releasing reason |
| D6 | The workable set is exactly **`{BL-028, BL-134, BL-139, BL-140}`**, and every exclusion is legible from the backlog alone. **⬛ RECOMPUTED 2026-08-15 against the live API after BL-137 merged** — this row has now been wrong **twice**: it first asserted `{}` (never run — gate 1 F1), was corrected to `{BL-136}`, and that value went stale the moment BL-136 closed and three items were filed. **Re-run the predicate before trusting this row a third time; do not read it, run it.** |
| D7 | Mutation run recorded for §9 rows 3, 4, 5 — each turns its own bar red |
| D8 | §7's docs no longer describe `autonomy` as a gate or a fail-closed default |
| D9 | `AGENT.md`'s OPERATOR Visibility paragraph rests on Gate B (§5 wording, or the PO's) |
| D10 | `tsc -b` 0; suite green at baseline + only the new bars; `git diff --stat` entirely inside §7 |

## 11. Open questions for gate 1

1. **§8 — keep a commit-time pin as well** (pinning the *workable* set), or accept the harness as the only
   tripwire? Plan assumes the latter.
2. **§5 — is the replacement charter wording the PO's?** It is load-bearing governance prose; the planner
   proposes, the PO owns.
3. **Does `po-decision` survive as a tag?** The plan keeps the field advisory and changes nothing else. The
   cleaner end state is that a question is not `todo` at all — but that is a backlog-hygiene pass, not this task.
4. **Independence:** under the resource-scarcity fallback the plan reviewer *was* the planner (§13). Declared,
   not mitigated.
5. **§13 F4 — is the `?selectable=true` API param renamed?** `SKILL.md` curls it verbatim twice.
   Recommendation: **keep the param, rename only the internal concept** — a wire rename buys nothing and
   breaks Hermes's documented commands.

## 12. A question is `deferred`, not `todo` — the gap gate 1 found

The plan's first draft said *"`po-decision` becomes a tag, not a gate — a question isn't `todo`"* and left it
there. Gate 1 (§13 F2) established that this was not a detail but a hole: `eligible` and `human-only` are
**readiness levels** and collapse cleanly into "is it blocked", but **`po-decision` is not a readiness level at
all** — it asserts the item is *not a task*. That is a difference of **kind**, and the schema expresses kind
through `status`, whose five values are all task-lifecycle states. Removing the field without replacing that
expression makes every open PO question proposable to an agent.

**Resolution — zero new machinery.** A question is filed **`status: deferred`** with **`tags: [po-decision]`**.

- `isResolved` returns true only for `done`/`dropped` (`backlog.ts:255-259`), so a `deferred` blocker **still
  fences its dependents** — the mechanism this plan depends on is untouched.
- `deferred` is *honest* for [[BL-135]] specifically: the standing sequence is "let the instrument run, **then**
  ask what the data supports", so the question genuinely is parked pending evidence.
- The tag preserves the distinction between "parked" and "awaiting a decision" for the 25 existing `deferred`
  items, without adding a sixth status.
- **Rejected alternative:** adding a `question` status. It is more honest in isolation but touches
  `VALID_STATUS`, the API's active filter, the harness's duplicate parser and three docs — new machinery to
  express something two existing fields already express.

Consequently the workable set after this task is **`{BL-136}`**, not `{}` — and that is the correct target.
**An empty workable set was never the goal; an honest one was.**

## 13. Gate 1 findings (plan reviewer, 2026-08-15)

⚠️ **Independence NOT obtained**: the plan reviewer was the planner, under the resource-scarcity fallback.
Declared, not mitigated. Recorded here rather than in a closing note so a later reader meets it with the
findings, not after them.

| # | Class | Finding | Disposition |
|---|---|---|---|
| **F1** | **BLOCK** | **D6 asserted the workable set is `{}`. Running the proposed predicate against the real backlog returns `{BL-028, BL-135, BL-136}`** — `{BL-135, BL-136}` after D5. A DoD bar was written without ever being run. | **Fixed** — D6 now reads `{BL-136}`, with the correction visible in the row. |
| **F2** | **BLOCK** | The design had **no way to express "this is a question, not a task."** BL-135 — a PO decision — would have become *workable*, i.e. proposable to an agent. The plan had waved this off in one clause and then filed BL-135 as `todo` in the same session. | **Fixed** — §12. |
| **F3** | minor | §8 presents the tripwire move as a change of *location*. It is also a change of **frequency**: every-commit → only-when-an-operator-runs. Defensible (that is the risk moment) but must be stated. | Folded into §8's wording as an explicit trade. |
| **F4** | minor | The plan never states whether the `?selectable=true` **API param is renamed**. `design/operator-seat/SKILL.md` curls it verbatim in two places; a rename breaks Hermes's documented commands. | **Open — §11 q5.** Recommendation: keep the param name, rename only the internal concept. |
| **F5** | in favour | The D4 migration warning, exactly as specified, **would have caught F2**: BL-135 is `todo` + fenced-by-field + no unresolved blocker, which is precisely its trigger. | Recorded — the bar earned its place before its code existed. |

**Verdict: REFUTED at first pass, remedied, and the plan is re-submitted.** F1 and F2 were both real and both
would have shipped a wrong bar. The pattern is the one this project keeps re-learning and the planner
re-committed inside a single session: **F1 was one command away from being known** — the predicate was
runnable against the live API the whole time.

## 14. What this does NOT fix — stated so it cannot be inferred

**This change creates no work.** After D5 the workable set is `{}` — the same as today — because the one
`todo` item genuinely is blocked. The difference is that the backlog now *says why*, mechanically, instead of
asserting a bare `human-only`.

**The binding constraint is an empty backlog, not the predicate.** Whatever is decided here, the next act that
produces value is filing real work.
