# BL-134 — `workable` replaces `selectable`; `autonomy` stops being a gate

**Draft 2** — rewritten 2026-08-15 after [[BL-137]] merged and the PO answered q1/q2/q3/q5.
**Status:** awaiting re-gate · **Planner:** Claude
**Blocker:** [[BL-137]] — **RESOLVED** (merged `fb7c45e`). Verified against the live API: nothing blocks this item.

> **Draft 1 is superseded in full.** Its history is compressed into §1; the three assumptions the PO overturned
> are marked ⚠️ where they appear. **Do not implement from draft 1.**

---

## 0. The change in one sentence

**Two levels replace three states:**

| Term | Means | Computed from | Who decides |
|---|---|---|---|
| **workable** | there is real work here and nothing is holding it | `status === 'todo' && blockedBy.every(isResolved)` | the backlog, mechanically |
| **launchable** | an agent may actually be started on it | a committed `design/po/<run>.authorized` containing exactly `[PO] AUTHORIZED-RUN: <run>` | the PO, per run, at a sha |

`autonomy` disappears from the predicate. What it really encoded becomes `blocked_by` (readiness) or lives at
the launch gate (recursion). **And the word `selectable` retires with it** — the concept is renamed to
`workable` everywhere, wire param included (PO, q5).

## 1. How this plan got here — compressed

1. PO: *"the way backlog items are eligible is too complicated; any workable backlog item must also be eligible
   for Hermes launching externally."*
2. Planner offered four options, recommended (a); **PO chose (b)**. The planner's argument against (b) was then
   found **factually wrong**, and a plan for (b) was written.
3. A second pass found **(b) does not satisfy the requirement at all** — flipping the default yields *"any
   workable item that nobody marked"*, and the only workable item was marked. **PO directed a rewrite.**
4. Gate 1 approved draft 1 after finding a DoD row asserting a set the planner had never run.
5. **PO re-blocked on [[BL-137]]** rather than ship a charter sentence known to overstate its fence.
6. BL-137 merged; **PO answered four open questions (§11), two of which changed this plan's shape.**

**The through-line worth keeping:** at every step the error was a claim made without running the thing that
would have settled it. §12's mutation discipline exists because of that pattern, not as ceremony.

## 2. The diagnosis (unchanged from draft 1, and still the core of the item)

| Value | Documented as | What it actually asserts |
|---|---|---|
| `eligible` | "work bounded, DoD legible" | **the item is specified** |
| `human-only` | "judgement the item doesn't encode" | **the item is under-specified** |
| `po-decision` | "the resolution IS a PO call" | **it is a question, not a task** |

All three describe *how ready an item is*. **None describes who may touch it.** The one
authorization-shaped clause hidden inside `human-only` — *"execution would itself mean launching a session"* —
is a property of the **brief and goal**, not of the item, and lives at Gate B ([[BL-136]], merged).

**That mis-typing is the complexity the PO reported.** Because the field reads as fail-closed governance,
typing `eligible` feels like *granting a privilege*, so it is done one at a time with a pin-test ritual — when
all it asserts is *"this one is ready."*

**Why `blocked_by` is strictly better at the real job:**

| | `autonomy: human-only` | `blocked_by: [BL-135]` |
|---|---|---|
| states a reason | no — it says only "no" | **yes — a filed, readable item** |
| releases itself | never; a human must remember | **automatically, when the blocker closes** |
| can dangle | n/a | **no — a dangling id fails `backlog:check`** |
| auditable | a field nobody can second-guess | a chain anyone can walk |

## 3. PO decisions, 2026-08-15 — the four that shape this draft

| # | Question | Decision | Effect |
|---|---|---|---|
| q1 | keep a commit-time pin? | **Re-pin the WORKABLE set** | ⚠️ **§5 rewritten** — draft 1 assumed harness-only |
| q2 | §4 charter wording | **Take the planner's rewrite** | §4 is now settled prose |
| q3 | does `po-decision` survive? | **Retire it — a question is not a task** | ⚠️ **§6 is new** — draft 1 kept it advisory |
| q5 | rename `?selectable=true`? | **Rename it properly** | ⚠️ **§7 is new, and it is the largest single piece** |

**q1 is a correction to the plan, not just a preference, and it deserves saying:** draft 1 argued the harness
was "the better home and always was." **The harness only runs around operator runs.** Harness-only would have
left every ordinary commit unguarded — a gap draft 1 never named. The PO's answer keeps a commit-time bar and
re-aims it. **The plan was wrong; the answer fixed it.**

## 4. The OPERATOR charter paragraph (q2 — settled)

`AGENT.md` → OPERATOR → **Visibility** currently rests its safety argument on `autonomy` failing closed and on
`bl093-backlog-selectable.test.ts:147`. That paragraph **credits Gate A with a containment Gate B provides**:
`selectableBacklogItems` populates an API view and two reports. **It launches nothing.**

**Replacement wording (PO-approved):**

> An item Hermes files may become **workable** — but *workable is not launchable*. A launch requires
> `design/po/<run>.authorized`, containing exactly `[PO] AUTHORIZED-RUN: <run>`, **committed at the repo-sha
> the commission names**, single-use via the launch ledger, and written by the PO's `approve <token>` alone.
> It lives in a directory **nothing else writes**, so an operator write there is conspicuous — and a foreign
> path in a bracketed run ([[BL-138]]). **This is detection, not prevention:** nothing mechanically stops a
> process holding a shell from writing it. The fence is the seat observing its instructions, and the
> instruments that make a breach visible.

**Deliberately weaker than draft 1's version**, which still implied *"it cannot hand any of it to an agent."*
[[BL-137]] proved that false. Shipping it would replace one overstated fence with another — the exact defect
BL-136 corrected in `SKILL.md` and BL-137 in `AGENT.md`. **The honest sentence is the deliverable.**

## 5. The tripwire moves — and stays at commit time (q1)

`bl093-backlog-selectable.test.ts:147` pins the real backlog's **selectable** set exactly. Under the new
predicate that set changes whenever any item is filed or any blocker resolves — ordinary motion, not a
governance event. Kept as-is it becomes churn, and the first person to "fix the red" would loosen it.

**So it is re-aimed, not retired:** it pins the **workable** set instead. Same mechanical forcing-function —
any change to what an agent could be handed goes red and demands a human look — against a set that only moves
for real reasons.

**Both must land in the same commit.** A window where neither pin exists is a window where the fence is
absent, and this project has been bitten by exactly that shape.

The harness (`scripts/infra-invariant.mjs`) **also** reports the workable set at launch time. That is
additive: commit-time pin **and** run-time report, catching different things at different moments.

## 6. Retiring `po-decision` (q3) — measured, with one wrinkle

**Blast radius, measured against the live API: 9 items carry `po-decision`; only 3 are `todo`.**

| Item | Status | Disposition |
|---|---|---|
| BL-123 · BL-086 · BL-110 · BL-119 | `done` | **untouched — history.** Rewriting closed items' metadata to match a new vocabulary falsifies the record |
| BL-107 · BL-135 | `deferred` | **untouched** — already parked, already correct |
| [[BL-139]] · [[BL-140]] | `todo` | → **`deferred`.** Both genuinely *are* PO decisions with no work specified. Correct outcome: they leave the workable set |
| **BL-134 (this item)** | `todo` | → **`human-only`.** See the wrinkle |

**⚠️ The wrinkle: BL-134 is itself tagged `po-decision`, so a literal migration defers the item doing the
work.** Not a paradox — a state change that must be explicit. **With the four answers in §3, BL-134 is no
longer an open question; it is a specified task.** It is re-tagged in the same commit that retires the value.
**An item may not defer itself out of its own delivery.**

**Consequence, stated so nobody discovers it in a diff:** the workable set contracts from
`{BL-028, BL-134, BL-139, BL-140}` to **`{BL-028, BL-134}`**.

**The value retires from the vocabulary, not from history.** `validate-backlog.mjs` accepts `po-decision` on
`done`/`deferred` items (they are records) and **warns** on a `todo` item carrying it.

## 7. The rename (q5) — costed, and the largest piece

The planner recommended against this; **the PO overruled it and it proceeds in full.** But draft 1 never
measured it, and it is not the one-line concept change §13 F4 implied:

**⬛ CORRECTED AT RE-GATE (H1): the table below was a FILTERED SAMPLE presented as a cost inventory.** It
understated two files and **missed two entirely**, one of which was outside the declared scope. This is the
full code inventory, re-run unfiltered:

| Site | Hits | Kind |
|---|---|---|
| `apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts` | 22 | test |
| `scripts/__tests__/infra-invariant.test.mjs` | **17** *(said 9)* | test |
| `scripts/infra-invariant.mjs` | **14** *(said 12)* | **production** |
| `apps/orchestrator/src/server.ts` | 5 | **production — the wire param** |
| `scripts/validate-backlog.mjs` | **2** *(missed)* | **production** — incl. the message *"only todo is selectable"* |
| `apps/orchestrator/src/backlog.ts` | **2** *(missed from this table)* | **production** |
| `scripts/test-mcp-gate.mjs` | **1** *(missed, and OUTSIDE §8 scope — now added)* | script |
| `design/operator-seat/SKILL.md` | 5 | docs, incl. **two verbatim `curl` commands** |
| `design/backlog.md` | 3 | **MIXED — see constraint 5** |

**The renames:** `selectableBacklogItems` → `workableBacklogItems` · `parseSelectableIds` → `parseWorkableIds`
· `?selectable=true` → **`?workable=true`**.

**Four constraints, none optional:**

1. **Wire param and internal concept move together**, or the API and its docs disagree — the drift this
   project keeps paying for.
2. **SKILL.md's two `curl` lines change in the same commit.** A stale documented command is one Hermes will
   run and get a wrong answer from.
3. **Historical run logs (`hmp7-run-log.md`, `o3-brief.md`) and closed plans (`bl093-plan.md`,
   `bl097-plan.md`) are RECORDS — do NOT rewrite them.** They say what was true then. Rewriting history to
   match a rename is the same error as re-dating a closing block.
4. **The test FILE keeps its `bl093-` name.** The prefix anchors provenance to the item that created the bar;
   renaming it severs that link for no gain. The *contents* rename.
5. **⚠️ `design/backlog.md` is MIXED, and a global `sed` on it would falsify the record (re-gate, H2).**
   Line **46** is the **live schema block** — `Selector view: GET /api/backlog?selectable=true` — and it
   **must** be renamed. Lines **5790** and **5803** sit inside **[[BL-093]]'s closed item prose**, recording
   what the API returned at the time (*"1 of 93, 0 warnings"*). Those are **records: do not touch them.**
   §8 lists `design/backlog.md` as touchable, which is exactly the invitation to run a blanket replace.
   **Rename by line, not by file.**

**Land it as its own commit**, separate from the autonomy mechanics, so reverting one does not drag the other.

## 8. Scope

**MAY touch:**

| File | Change |
|---|---|
| `apps/orchestrator/src/backlog.ts` | predicate drops `autonomy`; function renamed; `autonomy` still parsed + exposed, redocumented **advisory** |
| `apps/orchestrator/src/server.ts` | `?selectable=true` → `?workable=true` |
| `scripts/infra-invariant.mjs` | mirror predicate + rename; workable set still reported at run time |
| `scripts/validate-backlog.mjs` | migration warning (§6) + warn on `todo` carrying `po-decision` |
| `apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts` | contracts in §9; **file name unchanged** |
| `scripts/__tests__/infra-invariant.test.mjs` | rename only |
| `scripts/test-mcp-gate.mjs` | rename only — **added at re-gate (H1); it was missing from draft 2's scope entirely** |
| `design/backlog.md` | schema block; BL-028's `blocked_by`; BL-134 re-tag; BL-139/BL-140 → `deferred` |
| `AGENT.md` | OPERATOR Visibility paragraph (§4) |
| `design/operator-seat/SKILL.md` · `references/backlog-semantics.md` | the ladder, the fail-closed claim, the two curls |

**MAY NOT touch:** `scripts/hmp-commission.mjs` · `scripts/operator-run.expect.json` ([[BL-138]], just merged)
· `team-coordinator.ts` · the registry · anything on the exec/turn path · **historical run logs and closed
plans** (§7 constraint 3) · the `autonomy` values on `done`/`deferred` items (§6).

**Deliberately NOT done: stripping `autonomy` from the 54 items carrying it.** A 54-item mechanical diff inside
a simplification task is a bad trade. The field stays, demoted to advisory; the migration warning surfaces each
case that still needs converting.

## 9. Test contracts that change

| # | Assertion | Disposition |
|---|---|---|
| 1 | "an item with no `autonomy` header is not selectable" | **inverts** — selectable if workable |
| 2 | "an unknown `autonomy` value is not selectable" | **inverts** — `autonomy` no longer participates |
| 3 | "`doing` is excluded" | **unchanged** |
| 4 | "requires EVERY blocker resolved, not just one" | **unchanged — now load-bearing**, the only fence left |
| 5 | "an unknown blocker id keeps the item back" | **unchanged — now load-bearing** |
| 6 | the real-backlog exact pin at `:147` | ⚠️ **re-aimed at the workable set** (q1), **not retired** |

## 10. Definition of Done

| # | Bar |
|---|---|
| D1 | the predicate is `status === 'todo' && blockedBy.every(isResolved)`; `autonomy` appears nowhere in it |
| D2 | `autonomy` still parsed, still in the API projection, documented **advisory** — no silent field removal |
| D3 | `parseWorkableIds` agrees with the real parser; the drift test is green |
| D4 | `validate-backlog.mjs` warns on `todo` + fenced-by-field + no unresolved blocker, **and** on `todo` + `po-decision`; exit code unchanged |
| D5 | **proven on the real case:** [[BL-135]] filed, BL-028 carries `blocked_by: [BL-135]`, BL-028 consequently **not** workable — fenced for a stated, self-releasing reason |
| D6 | **the workable-set pin exists and is green, and the old selectable pin is gone — in ONE commit** (q1) |
| D7 | **RUN the predicate; do not read a number from this plan.** This row has been wrong twice: `{}` (never run), then `{BL-136}` (stale within a day). Expected after §6: **`{BL-028, BL-134}`** — *verify it* |
| D8 | mutation run recorded for §9 rows 3, 4, 5 — each turns its own bar red |
| D9 | rename complete: no `selectable` identifier or wire param remains in **production or live docs**; historical records untouched |
| D10 | `AGENT.md`'s Visibility paragraph is §4's wording |
| D11 | `tsc -b` 0; suite green at baseline + new bars; `git diff --stat` entirely inside §8 |

## 11. Sequencing — three commits, in this order

1. **The rename** (§7). Mechanical, no behaviour change, easiest to review and revert alone.
2. **The predicate + pin** (§5, §9, D1–D3, D6). The actual behaviour change.
3. **The backlog + docs migration** (§4, §6, D5, D10).

**Rationale:** commit 2 is the only one that changes behaviour, so it should be small and isolated. Doing the
rename first means commit 2's diff is about the predicate and nothing else.

**⚠️ Honest sizing:** this is materially larger than draft 1 — two production files, four test files, a
cross-cutting rename, and a backlog migration. At ~57% session budget when draft 2 was written, **commits 1
and 2 are realistic this session; commit 3 may not be.** If budget runs short, **stop after commit 2 with the
branch green** — the rename and predicate are coherent without the migration, and the migration is the easiest
piece to resume cold.

## 12. Mutation discipline — mandatory, and this is why

**§9 rows 3, 4 and 5 carry the entire predicate once `autonomy` is out of it.** Rows 4 and 5 are
absence-asserting bars — the shape that most easily passes for the wrong reason, and the shape this project
has now been bitten by three times in two days ([[BL-136]]'s insertion point, BL-137's uncovered checks,
BL-138's `_comment` key). **Each must be shown to turn its own bar red**, and the run recorded in the ledger.

## 13. What this does NOT do

- **It does not change who may launch anything.** Gate B is untouched. `workable` is a readiness fact; the
  launch authorization is a separate, PO-written artifact ([[BL-137]]).
- **It does not make anything agent-eligible by itself.** After this the workable set is `{BL-028, BL-134}`,
  and both still require a PO-authorized commission to reach a worker.
- **It does not remove `autonomy`.** The field survives as advisory metadata; only its role as a *gate* ends.
- **It does not fix `autonomy`'s 54 existing values.** Guided migration by warning, not a blind rewrite.

## 14. Gate 1 history (draft 1) — findings carried forward

| # | Finding | Status in draft 2 |
|---|---|---|
| F1 | **BLOCK** — D6 asserted a workable set the planner had never run | fixed twice, and D7 now forbids reading a number from the plan at all |
| F3 | §8 changed the tripwire's **frequency**, not just its location | **resolved by q1** — commit-time pin retained |
| F4 | `?selectable=true` is curled verbatim in SKILL.md | **resolved by q5** — renamed, with the curls in the same commit |
| — | Independence: plan reviewer *was* the planner | **still true.** Declared, not mitigated |

---

## 15. Re-gate on draft 2 (plan reviewer, 2026-08-15) — **APPROVED ✅, two corrections applied**

**Independence absent** (same actor as planner) — declared. Both findings came from **running an unfiltered
grep**, not from re-reading the plan, which is the only reviewing that works when the reviewer is the author.

### H1 — [BLOCK-class] §7's cost table was a FILTERED SAMPLE presented as an inventory

Draft 2's table came from a `grep | awk | sort | uniq -c | head -10` — a *top-10 of a filtered set*. It was
then used to justify a scope list and to underwrite **D9** (*"no `selectable` identifier remains in production
or live docs"*). Re-running it unfiltered:

- **understated** two files (`infra-invariant.test.mjs` 9→**17**, `infra-invariant.mjs` 12→**14**)
- **missed** `scripts/validate-backlog.mjs` (2, including the user-facing message *"only todo is selectable"*)
  and `apps/orchestrator/src/backlog.ts` (2)
- **missed `scripts/test-mcp-gate.mjs` entirely — a file §8 did not permit touching**, so **D9 was
  unsatisfiable within the declared scope.**

**Fixed:** the true inventory replaces the sample, and `test-mcp-gate.mjs` is added to §8.

**The lesson is the same one this session keeps re-learning:** a `head -10` is a *sample*. Presenting it as a
cost table is the same error class as reading a guard and not the branch it returns ([[BL-138]]), or reading
`:86`'s `export` and assuming it applied to `:87` ([[BL-137]] gate 1).

### H2 — [substantive] `design/backlog.md` is MIXED, and §8 invited a blanket replace

Three hits, and they are **not** the same kind:

| Line | Content | Disposition |
|---|---|---|
| **46** | the **live schema block** — `Selector view: GET /api/backlog?selectable=true` | **rename** |
| **5790**, **5803** | inside **[[BL-093]]'s closed item prose**, recording what the API returned then (*"1 of 93, 0 warnings"*) | **DO NOT TOUCH — records** |

§7's constraint 3 protected "run logs and closed plans" but said nothing about **closed item prose inside
`design/backlog.md`**, while §8 listed the file as touchable. A blanket `sed` would have rewritten BL-093's
closing record to describe an API that did not exist when it closed. **New constraint 5: rename by line, not
by file.**

### Verified and cleared

| Check | Result |
|---|---|
| new names free of collisions (`workableBacklogItems`, `parseWorkableIds`, `?workable=true`) | ✅ zero existing hits |
| the pin at `:147` is what §5 says it is | ✅ and its comment is emphatic — *"Updating this line is a deliberate act — do NOT loosen it… If the new value is not what you expected, that is the finding"* |
| `validate-backlog.mjs` enforces no `autonomy` enum | ✅ only a targeted rule (`eligible` on non-`todo`), so retiring `po-decision` breaks no existing validation |
| §6's "leave `done`/`deferred` values alone" is safe | ✅ follows from the above |

**The pin's own comment vindicates q1.** It records that an unexpected value *is the finding* — and that the
last update surfaced "NOTHING can currently be handed to an agent unattended" as a PO call. That is precisely
the forcing-function the PO chose to keep, and precisely what harness-only would have discarded.

**Cleared for implementation** in the §11 order, with H1 and H2 applied.
