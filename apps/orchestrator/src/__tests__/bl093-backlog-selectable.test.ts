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
  it('offers nothing as selectable — BL-094 merged and no item is eligible', () => {
    const { items, warnings } = readBacklog();
    expect(warnings).toEqual([]);
    expect(selectableBacklogItems(items).map((i) => i.id)).toEqual([]);
  });

  it('holds BL-028 back behind BL-084, which is still open', () => {
    const { items } = readBacklog();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('BL-028')!.blockedBy).toEqual(['BL-084']);
    expect(byId.get('BL-084')!.status).toBe('todo');
  });

  it('marks BL-086 as the PO decision it is', () => {
    const { items } = readBacklog();
    expect(items.find((i) => i.id === 'BL-086')!.autonomy).toBe('po-decision');
  });
});
