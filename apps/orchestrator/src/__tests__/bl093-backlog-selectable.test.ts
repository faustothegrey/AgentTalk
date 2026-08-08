import { describe, expect, it } from 'vitest';
import { parseBacklog, readBacklog, selectableBacklogItems } from '../backlog.js';

/**
 * BL-093 — `blocked_by` + `autonomy`, and the selection they enable.
 *
 * The unit exists so an autonomous selector cannot pick work that is blocked, reserved to
 * the PO, or otherwise not handable. Every clause fails CLOSED, and these tests pin that
 * direction specifically: the interesting assertions are the ones proving an item stays
 * OUT of the selectable set, because the failure that matters is an item wrongly let in.
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

describe('selectableBacklogItems', () => {
  it('admits a todo + eligible item with no blockers', () => {
    const { items } = parseBacklog(md({ id: 'BL-001', status: 'todo', extra: ['autonomy: eligible'] }));
    expect(selectableBacklogItems(items).map((i) => i.id)).toEqual(['BL-001']);
  });

  it('excludes human-only and po-decision, and anything with no autonomy at all', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: human-only'] },
        { id: 'BL-002', status: 'todo', extra: ['autonomy: po-decision'] },
        { id: 'BL-003', status: 'todo' },
      ),
    );
    expect(selectableBacklogItems(items)).toEqual([]);
  });

  it('excludes an eligible item whose blocker is still open, and admits it once done', () => {
    const open = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: eligible', 'blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'todo' },
      ),
    );
    expect(selectableBacklogItems(open.items)).toEqual([]);

    const closed = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: eligible', 'blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'done' },
      ),
    );
    expect(selectableBacklogItems(closed.items).map((i) => i.id)).toEqual(['BL-001']);
  });

  it('treats a dropped blocker as resolved', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: eligible', 'blocked_by: [BL-002]'] },
        { id: 'BL-002', status: 'dropped' },
      ),
    );
    expect(selectableBacklogItems(items).map((i) => i.id)).toEqual(['BL-001']);
  });

  it('keeps an item back when its blocker id does not exist (a typo must not release work)', () => {
    const { items } = parseBacklog(
      md({ id: 'BL-001', status: 'todo', extra: ['autonomy: eligible', 'blocked_by: [BL-999]'] }),
    );
    expect(selectableBacklogItems(items)).toEqual([]);
  });

  it('excludes a `doing` item even when eligible — someone already has it', () => {
    const { items } = parseBacklog(md({ id: 'BL-001', status: 'doing', extra: ['autonomy: eligible'] }));
    expect(selectableBacklogItems(items)).toEqual([]);
  });

  it('requires EVERY blocker to be resolved, not just one', () => {
    const { items } = parseBacklog(
      md(
        { id: 'BL-001', status: 'todo', extra: ['autonomy: eligible', 'blocked_by: [BL-002, BL-003]'] },
        { id: 'BL-002', status: 'done' },
        { id: 'BL-003', status: 'todo' },
      ),
    );
    expect(selectableBacklogItems(items)).toEqual([]);
  });
});

describe('the real backlog (design/backlog.md)', () => {
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
  // selectable set is now EMPTY. Per the note above, the new value being unexpected is the finding —
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
  //    `blocked_by: [BL-104]`. It became selectable the moment BL-104 flipped to `done` — nothing
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
  // currently agent-selectable, and refilling it is a PO act — `autonomy: eligible` is authority in
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
  // 1. The `warnings` assertion fired FIRST, not the selectable one — and it was a real defect in the
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
  // Exactly ONE item is selectable, and that is deliberate. A queue of one cannot be mis-picked,
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
  it('offers exactly BL-121 — the O2 rung, first agent change to engine code', () => {
    const { items, warnings } = readBacklog();
    expect(warnings).toEqual([]);
    expect(selectableBacklogItems(items).map((i) => i.id)).toEqual(['BL-121']);
  });

  // 2026-08-07 — deliberately updated, and the red was shown to the PO first. BL-084 CLOSED (PO
  // took option (a): T1 + T2 were its deliverables, T3 was always BL-028), so the assertion that
  // it is `todo` is false by decision, not by drift.
  //
  // The dependency itself was never wrong and is unchanged. What this now pins is the RELEASE
  // mechanism: closing a blocker resolves it with no edit to the blocked item, because isResolved
  // counts only done/dropped. That is a stronger bar than the one it replaces.
  //
  // And the distinction that matters: BL-028 is now UNBLOCKED but still NOT selectable — because
  // it is `human-only`, not because anything holds it. Those are different reasons and a future
  // reader must not confuse them.
  it('releases BL-028 now that BL-084 is closed — unblocked, but still not agent-selectable', () => {
    const { items } = readBacklog();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('BL-028')!.blockedBy).toEqual(['BL-084']);   // dependency unchanged
    expect(byId.get('BL-084')!.status).toBe('done');              // …and now resolved
    expect(byId.get('BL-028')!.autonomy).toBe('human-only');      // what still holds it back
    // No item's arrival or close has ever changed BL-028's standing — which is the point of
    // asserting the whole set here rather than just "BL-028 is absent from it".
    expect(selectableBacklogItems(items).map((i) => i.id)).toEqual(['BL-121']);
  });

  it('marks BL-086 as the PO decision it is', () => {
    const { items } = readBacklog();
    expect(items.find((i) => i.id === 'BL-086')!.autonomy).toBe('po-decision');
  });
});
