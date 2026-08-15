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


*(add new items above this line)*
