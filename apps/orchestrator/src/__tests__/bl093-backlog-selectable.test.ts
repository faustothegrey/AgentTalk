import { describe, expect, it } from 'vitest';
import { parseBacklog, readBacklog, workableBacklogItems } from '../backlog.js';

/**
 * BL-093 — `blocked_by` + `autonomy`, and the selection they enable.
 *
 * The unit exists so an autonomous selector cannot pick work that is blocked, reserved to
 * the PO, or otherwise not handable. Every clause fails CLOSED, and these tests pin that
 * direction specifically: the interesting assertions are the ones proving an item stays
 * OUT of the workable set, because the failure that matters is an item wrongly let in.
 */

/** Build a minimal backlog document from `@item` header blocks. */
function md(...blocks: Array<{ id: string; status: string; extra?: string[]; title?: string }>): string {
  const out: string[] = [];
  for (const b of blocks) {
    out.push('<!-- @item', `id: ${b.id}`, `status: ${b.status}`, ...(b.extra ?? []), '-->');
    out.push(`- [${b.status}] — **${b.title ?? b.id}**.`, '');
  }
  out.push('*(add new items above this line)*');
  return out.join('\n');
}

describe('BL-093 header fields', () => {
  it('defaults to human-only / [] when neither field is present (fail closed)', () => {
    const { items, warnings } = parseBacklog(md({ id: 'BL-001', status: 'todo' }));
    expect(warnings).toEqual([]);
    expect(items[0]!.autonomy).toBe('human-only');
    expect(items[0]!.blockedBy).toEqual([]);
  });

  it('parses all three autonomy values', () => {
    const { items, warnings } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: eligible'] },
        { id: 'BL-002', status: 'todo', extra: ['autonomy: human-only'] },
        { id: 'BL-003', status: 'todo', extra: ['autonomy: po-decision'] },
      ),
    );
    expect(warnings).toEqual([]);
    expect(items.map((i) => i.autonomy)).toEqual(['eligible', 'human-only', 'po-decision']);
  });

  it('warns on an unknown autonomy value AND falls back to human-only', () => {
    const { items, warnings } = parseBacklog(
      md({ id: 'BL-001', status: 'todo', extra: ['autonomy: yes-please'] }),
    );
    // Both halves matter: a typo must be loud (the gate fails on any warning) *and* it must
    // not silently grant eligibility while nobody is looking.
    expect(warnings.join(' ')).toMatch(/unknown autonomy "yes-please"/);
    expect(items[0]!.autonomy).toBe('human-only');
  });

  it('parses blocked_by as a list, sharing the tags syntax', () => {
    const { items } = parseBacklog(
      md({ id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-084, BL-092]'] }),
    );
    expect(items[0]!.blockedBy).toEqual(['BL-084', 'BL-092']);
  });

  it('warns when an item lists itself in blocked_by', () => {
    const { warnings } = parseBacklog(
      md({ id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-001]'] }),
    );
    expect(warnings.join(' ')).toMatch(/lists itself in blocked_by/);
  });
});

describe('workableBacklogItems', () => {
  it('admits a todo + eligible item with no blockers', () => {
    const { items } = parseBacklog(md({ id: 'BL-001', status: 'todo', extra: ['autonomy: eligible'] }));
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual(['BL-001']);
  });

  // ⬛ CONTRACT INVERTED BY BL-134 (plan §9 rows 1-2). This previously asserted that `human-only`,
  // `po-decision` and a missing header were all EXCLUDED — `autonomy` failing closed. It no longer
  // participates in the predicate at all: it was a readiness field misread as an authorization one,
  // and what actually stops an agent being handed work is Gate B's PO-authorized
  // `design/po/<run>.authorized`, not this list. Do not "restore" this bar; read backlog.ts's
  // comment first.
  it('ignores autonomy entirely — every value, and its absence, is workable if unblocked', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: human-only'] },
        { id: 'BL-002', status: 'todo', extra: ['autonomy: po-decision'] },
        { id: 'BL-003', status: 'todo' },
        { id: 'BL-004', status: 'todo', extra: ['autonomy: nonsense-value'] },
      ),
    );
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual(['BL-001', 'BL-002', 'BL-003', 'BL-004']);
  });

  it('still fails closed on the things that DO gate — status and blockers', () => {
    // The two clauses that survive now carry the whole predicate (plan §9 rows 3-5), so they are
    // asserted together and mutation-tested.
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'doing' },
        { id: 'BL-002', status: 'todo', extra: ['blocked_by: [BL-999]'] },
        { id: 'BL-003', status: 'deferred' },
      ),
    );
    expect(workableBacklogItems(items)).toEqual([]);
  });

  it('excludes an eligible item whose blocker is still open, and admits it once done', () => {
    const open = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'todo' },
      ),
    );
    // BL-134 note: the BLOCKER itself (BL-002, todo and unblocked) is now workable in its own
    // right — `autonomy` no longer hides it. The property under test is that BL-001 is held back.
    expect(workableBacklogItems(open.items).map((i) => i.id)).toEqual(['BL-002']);

    const closed = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'done' },
      ),
    );
    expect(workableBacklogItems(closed.items).map((i) => i.id)).toEqual(['BL-001']);
    // and it was the blocker resolving that released it, not anything about autonomy.
  });

  it('treats a dropped blocker as resolved', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'dropped' },
      ),
    );
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual(['BL-001']);
  });

  it('keeps an item back when its blocker id does not exist (a typo must not release work)', () => {
    const { items } = parseBacklog(
      md({ id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-999]'] }),
    );
    expect(workableBacklogItems(items)).toEqual([]);
  });

  it('excludes a `doing` item — someone already has it', () => {
    const { items } = parseBacklog(md({ id: 'BL-001', status: 'doing' }));
    expect(workableBacklogItems(items)).toEqual([]);
  });

  it('requires EVERY blocker to be resolved, not just one', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['blocked_by: [BL-002, BL-003]'] },
        { id: 'BL-002', status: 'done' },
        { id: 'BL-003', status: 'todo' },
      ),
    );
    // BL-001 is held back by the ONE unresolved blocker. BL-003, itself todo and unblocked, is
    // workable — which is the point: partial resolution releases nothing.
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual(['BL-003']);
  });
});

describe('the real backlog (design/backlog/)', () => {
  // DoD row 3 — the whole unit expressed as one assertion. If this ever returns something
  // unexpected, either an item was marked `eligible` that should not have been, or a blocker
  // resolved; both deserve a human look, so pin it exactly and let the failure force the look.
  //
  // It has already earned its keep once: closing BL-092 and filing BL-094 flipped this red on
  // the same day it was written, which is exactly the intended behaviour rather than churn to
  // be engineered away. Updating this line is a deliberate act — do NOT loosen it to make the
  // red go away. If the new value is not what you expected, that is the finding.
  // 2026-07-28 — updated deliberately, not to silence a red. BL-094 was MERGED (`ef5be1d`, delivered
  // autonomously in the H-L2 operator run) and closing it dropped its `autonomy: eligible`, so the
  // workable set is now EMPTY. Per the note above, the new value being unexpected is the finding —
  // and here it is: NOTHING can currently be handed to an agent unattended. That is a PO call to make,
  // and this line is where it becomes visible again the moment an item is marked eligible.
  //
  // 2026-07-31 — and here is that moment. The set had been empty for THREE sessions; every item in
  // them was implemented by an agent working under direct human approval, which is a productive way
  // to work but is not the autonomous-development ladder this project exists to build. The PO marked
  // **BL-104** eligible to restart it, and this line went red exactly as designed — the red was shown
  // to the PO before it was updated, which is the whole ritual, not a formality.
  //
  // BL-104 was chosen as a first rung on the O-1 instinct: one function (`wt-setup.mjs` `git()` never
  // catches), an obvious bar (a clean message and a nonzero exit, no Node stack), and the item's own
  // words are "not urgent and explicitly not a blocker" — so a botched attempt is harmless. It also
  // bit this very session, twice, which is how it was verified as still-real rather than assumed.
  //
  // NOTE the first candidate was BL-108, and it was REJECTED at this gate: checking the runbook
  // showed it had already been fixed inline. Handing an agent a no-op would have produced a green
  // first run that proved nothing — the worst possible outcome for a pipeline's first exercise.
  // Verify the item is still real before marking it; a stale item is worse than no item.
  // 2026-07-31 (later the same day) — BL-104 was MERGED (`602db8f`) and closed, emptying the set; the
  // PO then marked **BL-115** eligible in the same session, so it is non-empty again. Both reds were
  // shown to the PO before this line moved, which is the ritual rather than a formality.
  //
  // Two things this transition demonstrated that are worth more than the value itself:
  //
  // 1. **The blocker chain works, and it was verified by the red rather than assumed.** BL-115 carries
  //    `blocked_by: [BL-104]`. It became workable the moment BL-104 flipped to `done` — nothing
  //    edited the dependency, and this assertion is what proved the *effective* set is computed
  //    rather than read off the `autonomy` flag alone.
  // 2. **A full cycle fits in one session.** BL-104 went eligible → commissioned over HMP → delivered
  //    by a launched worker → PASS on R1-R5 → merged → closed, and the queue refilled behind it.
  //
  // BL-115 is a HARDER rung than BL-104, deliberately: exercising it requires running `wt-setup
  // create`, which provisions a real worktree. Its brief must pin the throwaway-repo pattern BL-104's
  // own tests established, or the run will register worktrees against the PRIMARY checkout and read
  // as pollution. That is a brief obligation, not a reason to hold the item back.
  // 2026-08-01 — BL-115 was MERGED (`0868fd9`) and closed, so the set is EMPTY again. The red was
  // shown to the PO before this line moved; that is the third time the ritual has run and the second
  // time it has run twice in two sessions.
  //
  // What the hmp3 rung added, beyond the value: BL-115 was chosen *because* the obvious fix was the
  // wrong one — copying BL-104's piped-stderr mechanism would have passed a naive bar while regressing
  // a build's live output. A worker commissioned over HMP took the reasoning over the precedent. That
  // is the first evidence here that a fenced brief can carry a *negative* instruction ("not like that,
  // and here is why") and have it hold under pressure to be green.
  //
  // So the queue is empty for the fourth time, and the standing observation holds: NOTHING is
  // currently agent-workable, and refilling it is a PO act — `autonomy: eligible` is authority in
  // file form ([[BL-093]] made it fail closed). This line is where that becomes visible again.
  //
  // Do NOT loosen this to an emptiness check or a length assertion to stop it moving. Its whole value
  // is that a change to what an agent may be handed unattended forces a human look.
  // 2026-08-01 (later the same day) — the PO marked **BL-116** eligible, so the set is non-empty
  // again after the shortest gap yet: minutes rather than three sessions. The red was shown before
  // this line moved, as always.
  //
  // BL-116 was verified still-real before it was stocked, not assumed: `loadExpect` in
  // `scripts/infra-invariant.mjs` still merges the `--expect` file over the defaults without
  // inspecting it. It had bitten the hmp3 grading hours earlier.
  //
  // What makes it a harder rung than BL-115, and it is worth stating here because this line is where
  // someone decides what to hand out next: the worker would be changing **the instrument that grades
  // operator runs**. That is safe — the run's own bracket is computed by the PRIMARY checkout's copy,
  // and the worker edits its own inside its worktree — but the brief has to *argue* that rather than
  // assume it. The item also carries an explicit trap (loosening the matcher to treat a trailing `/`
  // as `/**` would quietly widen the operator write fence), which is the second time in a row the
  // available wrong answer is the tempting one.
  // 2026-08-01 (later still) — BL-116 was MERGED (`6231172`) and closed, so the set is EMPTY for the
  // fifth time. The red was shown to the PO before this line moved. Fourth full cycle in two sessions.
  //
  // What the hmp4 rung added, beyond the value: a worker repaired **this project's grading harness**
  // and the separation held by construction — the primary checkout's `infra-invariant.mjs` was
  // byte-identical throughout the run (`46f28def…`) while the worktree's differed (`fa6949e5…`),
  // confirmed by git object hash rather than argued. It also navigated a task with more than one
  // plausible SHAPE: the declaration/merge split nobody specified, and three named wrong answers of
  // which two produce a green-looking result. The bracket came back with no `critical` for the first
  // time in four runs — because the grader tested its own `--expect` against a path it must permit
  // AND one it must refuse before trusting it, which is the very defect BL-116 fixed.
  //
  // So the standing observation holds, unchanged and unsoftened: refilling the queue is a PO act —
  // `autonomy: eligible` is authority in file form ([[BL-093]] made it fail closed). This line is where
  // that becomes visible.
  //
  // 2026-08-02 — and here is that moment, the SIXTH time this line has moved. The PO marked **BL-105**
  // eligible as the fifth rung, and this assertion went red the instant it did. The red was shown to the
  // PO before this line was touched, which is the whole ritual rather than a formality.
  //
  // BL-105 was verified still real BEFORE marking, not assumed: `agentalk-mcp-client` has no `wt-setup`
  // equivalent, so the gap is exactly as filed. That check is what caught BL-108 as an eligible no-op
  // once, and a green run that proves nothing is worse than no run.
  //
  // Why this rung: every previous one was a two-file task inside a single repo. BL-105 spans BOTH repos,
  // and its two fix directions are genuinely different engineering — a client-side helper, or teaching
  // `wt-setup` a `--repo` argument, which the item itself warns is how BL-101's sibling-path fragility
  // began. It also leaves a scope-adjacent paragraph (`taskId: null`) deliberately unassigned, because
  // hmp3 and hmp4 both reported nothing out of scope and two silences in a row are worth designing for.
  //
  // NOTE this is the first eligible item ever to point a worker OUTSIDE this repo. BL-086 (done
  // 2026-07-30) is what decided the governance a client-repo worker inherits; AGENT.md:316 still calls
  // it "open" and is stale on exactly that point.
  //
  // Do NOT loosen this to an emptiness check or a length assertion to stop it moving. Its whole value
  // is that a change to what an agent may be handed unattended forces a human look.
  //
  // 2026-08-02, later the same day — the SEVENTH move, and the queue is empty again. BL-105 closed
  // (merged `236b30a` in the client), so the set it named is gone and the assertion returns to `[]`.
  // Refilling it is the PO's act alone; nothing here may do it.
  //
  // TWO THINGS THIS MOVE CAUGHT, both worth more than the line change itself:
  //
  // 1. The `warnings` assertion fired FIRST, not the workable one — and it was a real defect in the
  //    closing edit, not in the backlog's meaning: the item's header said `status: done` while its prose
  //    still opened `[todo · …]`, which the parser reports as header/prose drift. It was briefly misread
  //    as "the queue emptied" because a failing `toEqual([])` looks the same at a glance either way.
  //    Read WHICH assertion failed before concluding what the guard is telling you.
  //
  // 2. This is the first close of an eligible item whose run did NOT end cleanly: hmp5 was killed by
  //    `cap-resource` 14s after the worker committed complete work (see BL-117). The delivery was still
  //    graded on the artifact, by running it on the merge commit. A cap kill says nothing about whether
  //    the work was done — `completed` was never the verdict here, and neither is `failed`.
  // 2026-08-07 — REFILLED, and the red was shown to the PO before this line moved. The PO marked
  // **BL-120** eligible to reach a specific goal: the operator listing open work, the PO authorizing
  // one item, and a session launched and reported back — the loop end to end, with a real subject.
  //
  // BL-120 was chosen on the same O-1 instinct that picked BL-104: one function
  // (`setAgentBusyState`'s `true` branch is unreachable), an obvious bar (a reader inventory, per
  // reader, or an honest "could not determine"), and it is scoped as an INVESTIGATION that changes
  // no code — so a botched attempt is harmless by construction, not by hope. It is also on the
  // critical path rather than makework: BL-028 T3b cannot name `awaiting-input` against a status
  // nobody has established the readers of.
  //
  // Exactly ONE item is workable, and that is deliberate. A queue of one cannot be mis-picked,
  // and the point of this rung is the loop, not throughput.
  // 2026-08-07, later the same day — EMPTY AGAIN, and this one closed a full loop rather than a
  // task. BL-120 was delivered by run `hmp6`, graded PASS against its pre-registered bar, merged
  // (`fcbc5a1`); closing it dropped its `autonomy: eligible` exactly as BL-105's close did.
  //
  // Closing it was not bookkeeping. An item whose deliverable is already merged, left `todo` and
  // eligible, is a no-op waiting to be handed to an agent — the BL-108 trap named in the comment
  // above, which was caught at this gate once before. The queue must empty when the work lands.
  //
  // Worth recording what that run produced, because it is the strongest evidence this mechanism
  // has generated: the worker REFUTED the finding of the item that commissioned it, with a live
  // probe, and the refutation held on independent reproduction. An autonomous rung correcting the
  // supervising agent's own error is the outcome this ladder exists to reach.
  // 2026-08-08 — refilled with **BL-121**, PO-approved at Gate 1, and the red was shown first.
  // This one is a step up rather than a repeat: hmp6 was a read-only investigation, and BL-121
  // is the first rung where an agent CHANGES ENGINE CODE. The containment is unchanged (its own
  // worktree, its own branch, no merge rights, PO-gated), and what makes it a safe first of its
  // kind is the bar rather than the size: B1 is observable-event parity on the one path the
  // helper serves, so a botched edit fails loudly instead of silently.
  //
  // Chosen deliberately for that property. The change itself is provably zero-behaviour — the
  // branch being deleted is unreachable, and unreachable code cannot be observed disappearing —
  // so if B1 ever shows a difference, the finding is that the premise was wrong, which the item
  // names as a show-stopper worth reporting rather than a failure to avoid.
  // 2026-08-08 — empty again on BL-121's close (run `hmp7`, PASS, merged). Two rungs in two days,
  // and the queue emptying is the loop completing rather than stalling.
  //
  // Worth recording what hmp7 was, because it is the furthest this ladder has gone: the first rung
  // where an agent changed ENGINE code. It deleted an unreachable branch in the registry and proved
  // the deletion unobservable at the event level — a parity test whose expected sequences were
  // captured against the PRE-change tree and frozen, then run unmodified against both. The grader
  // re-derived that rather than accepting it (6 parity rows green on the old code, 5 source rows
  // red), because "unreachable" was precisely the claim a reader had got wrong two days earlier.
  //
  // One row, R4, could not be met by ANY delivery: it pinned the suite at 722/722 while another row
  // required a new test file. PO-disposed as a bar defect. The lesson is in the grading doc and is
  // worth carrying here too: never pin a fixed suite total on a rung that also demands a new test.
  // 2026-08-09 — the PO marked **BL-122** eligible, so the set is non-empty for the sixth time. The
  // red was shown to the PO before this line moved, as always, and the observed value was exactly
  // the expected one (`["BL-122"]`) — so per the standing note above there is no finding here.
  //
  // What makes this refill different from the five before it: BL-122 is NOT stocked to be
  // implemented next. It is the subject of a brief-authoring rung (`design/brief-authoring-rung-plan.md`),
  // where the worker writes the operator brief FOR this item and does not do the item's work. The
  // eligibility bit is needed for the later rung that implements it, not for the authoring one.
  //
  // Read that as a caution rather than a detail: eligibility says an item MAY be handed to an agent
  // unattended, and BL-122's own fix direction is still undecided (jsdom harness vs. record the
  // verified-by-eye position as the standing one). Handing it out is still gated by a committed
  // brief, a committed bar and a PO-signed authorization, so the undecided fork cannot reach a
  // worker by accident — but the bit is set earlier here than in any prior refill.
  // 2026-08-10 — EMPTY for the seventh time. BL-122 closed on a PO DECISION rather than on a
  // delivery, which is the first time this line has moved for that reason: the item asked for a
  // choice between standing up a UI test harness and recording "verified by eye" as the standing
  // position, and the PO chose the latter. Nothing was built; the defect the item named — that
  // nobody had decided — is gone because someone decided.
  //
  // The full cycle behind it: BL-122 was the SUBJECT of run `hmp8`, the first brief-authoring rung,
  // where a commissioned worker wrote the operator brief for the item and refused to resolve the
  // fork because the choice is product scope. That refusal was the row the rung was graded on, and
  // the decision it routed to the PO is what closes the item here.
  //
  // Worth carrying: hmp8 also proved BY EXECUTION that the item's own stated fix was a no-op —
  // deleting `apps/web/**` from the vitest `exclude` collects zero new files, because the `include`
  // allowlist is the operative gate. The standing position and that finding live in BL-122's
  // closing block; `vitest.config.ts` points there.
  // 2026-08-13 — REFILLED, and the red was shown to the PO before this line moved. The PO marked
  // **BL-125** eligible; the assertion returned exactly `["BL-125"]` and nothing else, so per the
  // standing note above the new value was the expected one and there is no finding in it.
  //
  // BL-125 is a docs-only fix to `design/archive/bl124-s2-deploy.md` §5, and it was chosen on the same O-1
  // instinct as BL-104: one file, an unambiguous bar, and a botched attempt is harmless because
  // nothing executable depends on the prose. It is fenced hard in its own entry — the sink's lazy
  // open is intended, bar-covered behaviour, so a worker concluding the CODE is wrong must stop and
  // report rather than change it.
  //
  // The caution worth carrying, in the same spirit as BL-122's refill note: half the paragraph
  // BL-125 targets is CORRECT (the per-boot reduction rule, load-bearing for S3), so this item can
  // be delivered wrongly by over-deleting rather than by under-delivering. That is a real failure
  // mode for an unattended run, it is named in the item's DoD, and it is the thing to grade.
  // 2026-08-13 (later the same day) — EMPTY for the eighth time, and this one emptied the way the mechanism
  // is supposed to work: BL-125 was filed, marked eligible, briefed, barred, DELIVERED by a commissioned
  // worker (run hmp9, graded PASS, merged `f037ab8`) and closed — all inside one session. The set is empty
  // because the work is done, not because nobody chose anything.
  //
  // Dropping `autonomy: eligible` at close is the part that needed doing deliberately: an item left `eligible`
  // after its delivery merges stays agent-workable while pointing at finished work, and THIS GUARD WOULD NOT
  // HAVE CAUGHT IT — the assertion `['BL-125']` was still true. That exact miss has happened here before:
  // `1706500 fix(BL-105): drop the stale eligible flag left behind at close`.
  //
  // Worth recording next to the row it protects: the guard pins WHAT is workable, never WHETHER the thing is
  // still worth selecting. A green here is not evidence the queue is sane.
  it('offers nothing — the queue emptied when BL-125 was delivered and closed', () => {
    const { items, warnings } = readBacklog();
    expect(warnings).toEqual([]);
    // ⬛ 2026-08-15 — BL-134 RE-AIMED THIS PIN, and the PO chose to keep it rather than let the
    // invariant harness be the only tripwire (q1). The reasoning is worth keeping: the harness runs
    // only AROUND OPERATOR RUNS, so harness-only would have left every ordinary commit unguarded.
    //
    // What it pins changed with it. It used to pin the SELECTABLE set — `todo` + `autonomy:
    // eligible` + blockers resolved — where marking an item eligible was the governance event this
    // line existed to surface. `autonomy` no longer gates anything, so it now pins the WORKABLE set:
    // `todo` + every blocker resolved.
    //
    // The value below was DERIVED by running the predicate against the real backlog, never typed to
    // match a red. That distinction is this row's history: it has been wrong twice in the plan that
    // produced it, both times because someone wrote down a set instead of computing one.
    //
    // Everything above still applies, and applies MORE: the set now moves on ordinary backlog
    // motion, so a red here means "something changed about what an agent could be handed" and
    // deserves the same look it always did. Do NOT loosen it to a length check or an emptiness
    // check to stop it moving.
    // ⬛ 2026-08-15, later — BL-134's migration commit. The set moved twice more, both DERIVED by
    // running the predicate after each edit, never typed to match a red:
    //   · BL-139 and BL-140 → `deferred`. `po-decision` retired as an autonomy value; a question is
    //     not a task, so it belongs in `status` where it keeps them out of the set for a stated
    //     reason.
    //   · BL-028 → `blocked_by: [BL-084, BL-135]`. This is the whole argument of BL-134 made
    //     concrete: it was held back by `autonomy: human-only`, a field that named no reason and
    //     expired never; it is now held by a filed item that releases itself when BL-135 closes.
    // Leaving BL-134 itself, which is `todo`, unblocked, and — since the PO answered its four open
    // questions — no longer a question but a specified task.
    //
    // 2026-08-15 (later, at BL-134's own closure) — deliberately updated, and THE RED WAS SHOWN
    // BEFORE THIS LINE MOVED, which is the whole ritual. BL-134 merged (`5f8f068`) and closed, so
    // it left the set and took the set with it: the value is now **empty**.
    //
    // Per the note at the head of this describe: an unexpected value IS the finding. Here it is,
    // and it is not a formality —
    //
    //   NOTHING IN A 140-ITEM BACKLOG CAN BE HANDED TO AN AGENT UNATTENDED.
    //
    // 2 todo, 28 deferred, 110 closed. Of the two `todo`, BL-134 is now done and BL-028 is held by
    // `blocked_by: [BL-084, BL-135]` — correctly, for a stated reason. So the queue is not blocked
    // by accident or by a stale fence; it is genuinely empty, and refilling it is a PO act.
    //
    // This matters more than the usual empty-set note because the project's stated goal is
    // AUTOMATED DEVELOPMENT, and this line is the measure of whether any is currently possible.
    // It is the ONE place that says so out loud, which is why it is pinned exactly.
    //
    // 2026-08-15 (later still) — deliberately updated, red shown first, as always. The set is no
    // longer empty: the Wave 0/1 overhaul surfaced four follow-ups and FILING THEM REFILLED THE
    // QUEUE — [[BL-141]] the doc-citation linter, [[BL-142]] its 16 findings, [[BL-143]] the
    // validator's missing warn tier, [[BL-144]] Wave 2.
    //
    // Read what that does and does not mean, because it is exactly the distinction BL-134 drew:
    // these four are WORKABLE — todo, unblocked, ready to be picked up. They are NOT LAUNCHABLE.
    // A launch still needs `design/po/<run>.authorized`, committed by the PO at the sha the
    // commission names. Filing put four proposals in front of the PO; it handed nothing to anyone.
    //
    // ORDER IS FILE ORDER, not id order: `40-backlog.md` is read before `85-governance.md`, which
    // is why BL-143 leads. Since Wave 1 the backlog is a directory read in FILENAME order, so this
    // list moves when a file is renamed as well as when an item changes. Derive it, never type it.
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual([
      'BL-143',
      'BL-141',
      'BL-142',
      'BL-144',
    ]);
  });

  // 2026-08-07 — deliberately updated, and the red was shown to the PO first. BL-084 CLOSED (PO
  // took option (a): T1 + T2 were its deliverables, T3 was always BL-028), so the assertion that
  // it is `todo` is false by decision, not by drift.
  //
  // The dependency itself was never wrong and is unchanged. What this now pins is the RELEASE
  // mechanism: closing a blocker resolves it with no edit to the blocked item, because isResolved
  // counts only done/dropped. That is a stronger bar than the one it replaces.
  //
  // And the distinction that matters: BL-028 is now UNBLOCKED but still NOT workable — because
  // it is `human-only`, not because anything holds it. Those are different reasons and a future
  // reader must not confuse them.
  it('BL-028: BL-084 resolved, but BL-135 now holds it — fenced by a reason, not by a field', () => {
    const { items } = readBacklog();
    const byId = new Map(items.map((i) => [i.id, i]));
    // ⬛ BL-134 — this is the item's whole argument, made concrete on the case that motivated it.
    // BL-028 used to be held back by `autonomy: human-only`: a field that named NO reason, could not
    // be second-guessed, and would never expire. It is now held by a filed, readable item that
    // RELEASES ITSELF the moment that item closes.
    expect(byId.get('BL-028')!.blockedBy).toEqual(['BL-084', 'BL-135']);
    expect(byId.get('BL-084')!.status).toBe('done');              // the old blocker, resolved
    expect(byId.get('BL-135')!.status).toBe('deferred');          // the real one: an undecided PO question
    expect(byId.get('BL-028')!.autonomy).toBe('human-only');      // still present — advisory, not a gate
    // Consequently NOT workable, and now for a reason anyone can walk to.
    expect(workableBacklogItems(items).map((i) => i.id)).not.toContain('BL-028');
    // 2026-08-09 — this comment previously read "No item's arrival or close has ever changed
    // BL-028's standing", and BL-122 going eligible falsified its LETTER: an item's arrival has
    // now changed the set. Corrected rather than merely revalued, because a confidently wrong
    // comment is how the next reader gets misled.
    //
    // The INTENT is untouched and is why the whole set is still asserted here: BL-028's own
    // standing has never moved, and pinning the entire set is what proves that — a weaker
    // "BL-028 is absent from it" would keep passing even if BL-028's own bit flipped and
    // something else masked it. Do not weaken it to an absence check when this next goes red.
    //
    // 2026-08-10 — and it went red exactly there, on BL-122's close. Revalued to `[]`, and the
    // instruction above held: still the whole set, still not an absence check. BL-028's standing
    // is untouched for the second time in two days, which is the point of asserting it this way.
    //
    // 2026-08-13 — red again, this time on an ARRIVAL rather than a close: the PO marked BL-125
    // eligible. Revalued to `["BL-125"]`, and the instruction holds for the third time — still the
    // whole set, still not an absence check. BL-028 is untouched once more, and note WHY that is
    // worth re-proving here: a refill is exactly the situation where a weaker "BL-028 is absent"
    // check would keep passing while a new item masked a flip of BL-028's own bit.
    //
    // 2026-08-13 (later) — and back to `[]` within the same session, on BL-125's close after run
    // hmp9 delivered it. Two revaluations in one day is not churn to engineer away: it is the
    // full arrival→delivery→close cycle finally running end to end, and this line moved once for
    // each transition, exactly as intended. BL-028's standing is untouched for the fourth time.
    //
    // ⬛ 2026-08-15, BL-134 — and here BL-028's standing MOVES for the first time, which is exactly
    // what this bar was built to make impossible to miss. `autonomy` no longer gates, so BL-028 is
    // WORKABLE. The title above ("still not agent-workable") is now false and is corrected below.
    //
    // Read what did and did not change: BL-028 is workable, meaning "todo and nothing blocks it".
    // It is NOT launchable — that needs a PO-authorized `design/po/<run>.authorized` (BL-137). And
    // it is still not *ready*: its T3c carries an undecided PO question, which the migration commit
    // fences properly as `blocked_by: [BL-135]` — a stated, self-releasing reason instead of a field
    // that named nothing and expired never. THAT is the whole argument of BL-134, and this line is
    // where it becomes visible.
    //
    // Still the whole set, still not an absence check, for the same reason as every entry above.
    // 2026-08-15 — BL-134 closed and four follow-ups were filed. BL-028's fence is what this bar
    // is about and it is UNCHANGED: it stays out because BL-135 is unresolved — note it is absent
    // from a NON-empty set now, which is a strictly stronger statement than being absent from an
    // empty one. The earlier empty pin could not tell "fenced" from "nothing here at all".
    expect(workableBacklogItems(items).map((i) => i.id)).toEqual([
      'BL-143',
      'BL-141',
      'BL-142',
      'BL-144',
    ]);
  });

  it('marks BL-086 as the PO decision it is', () => {
    const { items } = readBacklog();
    expect(items.find((i) => i.id === 'BL-086')!.autonomy).toBe('po-decision');
  });
});
