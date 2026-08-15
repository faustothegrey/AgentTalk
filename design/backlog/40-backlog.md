# Backlog — backlog

Open items owned by the **backlog** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-134
status: done
date: 2026-08-15
epic: null
tags: [backlog, autonomy, governance, operator, bl-093, simplification]
blocked_by: [BL-137]
autonomy: human-only
-->
- [done 2026-08-15 · merged `5f8f068` · gate 2 + gate 3 VERIFIED · **PO-DIRECTED REWRITE 2026-08-15 — supersedes this item's own first shape (option (b), "flip the
  default"), which did not satisfy the requirement. Plan: `design/bl134-plan.md`, awaiting gate 1** · filed by
  the planner at the PO's direction: *"the way backlog items are eligible is too complicated; any workable
  backlog item must also be eligible for Hermes launching externally"*] —
  **⛔ RE-BLOCKED 2026-08-15 by PO decision — `blocked_by` moved [[BL-136]] → [[BL-137]].** The first blocker
  is **resolved** (BL-136 merged `05325c0`, closing the goal-scan seam this item's containment argument leans
  on). The new one is worse, and it is aimed straight at **§5** of `design/bl134-plan.md`: this item proposes
  to retire the `autonomy` fail-closed paragraph and rest the OPERATOR charter's safety argument on Gate B,
  describing it as *per-run, sha-bound, single-use*. All three adjectives are true. **The implied fourth —
  "and only the PO can produce it" — is not**, because `design/operator/<run>.authorized` sits inside the
  operator's own write allowlist and no committer identity is checked ([[BL-137]]).
  **Shipping §5 unchanged would replace one overstated fence with another** — precisely the defect class
  [[BL-136]] had just corrected in `SKILL.md`, and [[BL-101]] before it. The PO was offered the cheaper path
  (implement this item, drop §5's rewording from scope, leave the charter paragraph alone) and **chose to
  block instead**, which re-empties the workable set on purpose rather than write a governance sentence
  already known to overstate its fence.

  **`autonomy` is a READINESS field wearing an AUTHORIZATION field's clothes, and it gates a door nobody walks
  through.** Read its three values as they are actually defined: `eligible` = "work bounded, DoD legible" (*the
  item is specified*); `human-only` = "judgement the item doesn't encode" (*under-specified*); `po-decision` =
  "the resolution IS a PO call" (*a question, not a task*). **All three describe how ready an item is. None
  describes who may touch it.** That mis-typing is the reported complexity: because the field is documented as
  fail-closed governance, typing `eligible` reads as granting a privilege — so it is done once at a time with a
  pin-test ritual, when what it asserts is only *"this one is ready."*
  **And it gates nothing that matters.** There are **two independent authorization systems for one act**, which
  never reference each other: **Gate A** (`status === 'todo' && autonomy === 'eligible' && blockers resolved`,
  `backlog.ts:274`) and **Gate B** (`hmp-commission.mjs` — a committed brief at a sha on master, a
  `design/operator/<run>.authorized` file containing exactly `[PO] AUTHORIZED-RUN: <run>`, a hashed bar, the
  charter checks, replay-guarded by the launch ledger). **The string `autonomy` does not appear anywhere in
  `hmp-commission.mjs`'s 626 lines**; Gate A's only consumers are `server.ts:260`, `bl093-backlog-selectable.test.ts`
  and `infra-invariant.mjs:439` — **none in the launch path.** BL-093 built Gate A for an autonomous *selector*
  that proposes items unattended; **that selector does not exist.**
  **The shape adopted — two levels replace three states.** **workable** = `status === 'todo' &&
  blockedBy.every(isResolved)`, computed mechanically, and anything workable may be *proposed*. **launchable** =
  a PO-committed per-run authorization, which is what actually starts an agent. `autonomy` leaves both:
  readiness becomes **`blocked_by`**, recursion moves to the launch gate ([[BL-136]]).
  **Why `blocked_by` beats `human-only` at the job it was really doing:** it **states a reason** (a filed,
  readable item, where `human-only` says only "no"); it **self-releases** when the blocker closes, so nobody has
  to remember; it **cannot dangle** (`backlog:check` fails on a dangling id, and `isResolved` treats an unknown
  id as unresolved); and it is a chain anyone can walk. **[[BL-028]] is the live proof:** it is not dangerous,
  it is *unspecified* — its T3c phase contains an undecided PO question (§9 q2, *"should the sweep ever kill at
  all?"*), now filed as **[[BL-135]]**. A spec with a hole where a decision belongs is a dependency, not an
  authorization fact.
  **⛔ TWO PLANNER ERRORS ARE RECORDED IN THE PLAN, because the reasoning moved twice and the record is worth
  more than the conclusion.** (1) The argument put to the PO *against* flipping the default — *"79 never-judged
  items become selectable silently"* — was **false**: 99 items carry no header (79 came from counting
  *occurrences*, including the schema example inside a code fence), and of those **74 are `done`, 22 `deferred`,
  3 `dropped`, ZERO `todo`**. (2) Worse, the plan then written for option (b) **did not satisfy the requirement
  at all**: flipping the default yields *"any workable item **that nobody marked** is eligible"*, and the only
  workable item is marked — BL-028 carries an explicit `human-only`, so the selectable set under (b) is `{}`,
  identical to today. The first plan noted "it unlocks no work" as a closing footnote; **that was the
  headline.** [[BL-130]]'s rule generalises: a claim about a predicate is checked by *running the predicate*.
  **What this does NOT do, stated so it cannot be inferred: it creates no work.** After the plan's D5 the
  workable set is still `{}`, because the one `todo` item genuinely is blocked. The difference is that the
  backlog then *says why*, mechanically and self-releasingly, instead of asserting a bare `human-only`. **The
  binding constraint is an empty backlog, not the predicate.**


<!-- @item
id: BL-143
status: done
date: 2026-08-15
epic: null
tags: [backlog, validator, warning-tier, bl-134, gate]
-->
- [done 2026-08-15 · warn tier shipped, D4's second half now works, 12 tests where there were none · **filed at BL-134's gate 2 · the reviewer ACCEPTED BL-134's D4 as an honest
  PARTIAL on condition this was filed**] —
  **`validate-backlog.mjs` has no warning tier — every finding is fatal, so it cannot advise.**

  Parser warnings are folded into `errors` (`validate-backlog.mjs:33`) and any finding fails the
  run. That made one of BL-134's DoD rows unimplementable: a `human-only` migration aid would have
  had to fail the backlog on **BL-134 itself** — `human-only`, `todo`, blockers resolved — i.e. the
  item would have invalidated the backlog on its own delivery.

  The underlying rule is worth stating because it will recur: **a field that is allowed to be
  present cannot make the document invalid by being present.** BL-134's D2 deliberately keeps
  `autonomy` alive as advisory metadata, so any check that fails on its presence contradicts it.

  **DELIVERED 2026-08-15.** `errors` fail the run; `warns` are reported and do not. `--strict` promotes
  them, opt-in — a warning that always fails the build is an error wearing a different word, so the
  default had to stay advisory for the tier to mean anything. D4's second half now works.

  **⛔ CORRECTION — this item's stated blast radius was FALSE, and I wrote it.** It said the change
  "changes `exitCodeFor` semantics that other callers depend on", quoting BL-134's own deferral
  reasoning. **`exitCodeFor` lives in `infra-invariant.mjs`, a different tool.** `validate-backlog.mjs`
  never imported or called it — it calls `process.exit(1)` directly — and has exactly **one** caller,
  `npm run backlog:check`. **The PARTIAL was still correct, but for its OTHER reason** (D4 and D2
  genuinely conflict: a field allowed to be present cannot invalidate the document by being present).
  A right conclusion resting on a citation that named the wrong file — the [[BL-130]] pattern again.

  **Two real bugs, both caught by RUNNING it, neither by review:**

  1. **The advisory keyed on a DERIVED value.** `DEFAULT_AUTONOMY` is `human-only`, so a parsed item
     cannot distinguish an authored fence from an absent field — and since BL-134, *absent is the
     correct way to file an item*. The first run warned on BL-143 and BL-144, which declare no
     `autonomy` at all: **the check fired on doing the right thing**, and would have on every future
     item forever. Now scans the raw header for an explicit declaration (`explicitlyHumanOnly`).
  2. **The "pure" collector reached for global state.** It took `text` but the coverage check still
     called `backlogText()`, reading the real repo — so every fixture picked up the live backlog's
     bullets and produced 20 phantom errors. Caught by its own first test run. **A pure function that
     reaches for globals is worse than an honestly impure one: its tests look meaningful and are not.**

  Also: the success line hardcoded `0 warnings` — true only while every finding was fatal, and a
  sentence that would have gone on saying "0" once it stopped being true. The count is derived now.

  **Behaviour-preserving refactor, proven by diff against pre-refactor output** (identical modulo the
  derived count). Mutation-tested: collapsing `warns` into `errors` kills 3 bars. **12 tests where the
  validator previously had none** — it was a top-level script with no export surface.



*(add new items above this line)*
