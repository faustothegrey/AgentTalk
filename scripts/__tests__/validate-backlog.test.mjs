import { describe, it, expect } from 'vitest';
import { collectFindings, explicitlyHumanOnly } from '../validate-backlog.mjs';

/**
 * BL-143 — the backlog gate's severity tier.
 *
 * `collectFindings` is pure over (items, parserWarnings, text), so these run without a repo. That
 * purity is the reason the function exists: before BL-143 the whole validator was a top-level
 * script with no export surface and no tests at all.
 */

const item = (id, over = {}) => ({
  id,
  status: 'todo',
  blockedBy: [],
  autonomy: 'human-only', // the parser's DEFAULT — deliberately the same for authored and absent
  bodyMarkdown: `- [${over.status ?? 'todo'}] — **${id}**.`,
  title: id,
  ...over,
});

/** A document whose bullets match `bodyMarkdown`, so the coverage check stays quiet. */
const doc = (...blocks) =>
  blocks
    .map(({ id, status = 'todo', extra = [] }) =>
      ['<!-- @item', `id: ${id}`, `status: ${status}`, ...extra, '-->', `- [${status}] — **${id}**.`, ''].join('\n'),
    )
    .join('\n') + '\n*(add new items above this line)*';

describe('BL-143 — authored vs defaulted `autonomy`', () => {
  it('sees a header that DECLARES human-only', () => {
    const text = doc({ id: 'BL-001', extra: ['autonomy: human-only'] });
    expect([...explicitlyHumanOnly(text)]).toEqual(['BL-001']);
  });

  it('does NOT see an item with no autonomy field, even though it PARSES as human-only', () => {
    // This is the whole point. `DEFAULT_AUTONOMY` is `human-only`, and since BL-134 retired the
    // fence, omitting the field is the CORRECT way to file an item. Keying the advisory on the
    // parsed value warned on every properly-filed item — it fired on doing the right thing.
    const text = doc({ id: 'BL-001' });
    expect([...explicitlyHumanOnly(text)]).toEqual([]);
  });

  it('does not confuse a different autonomy value for human-only', () => {
    const text = doc({ id: 'BL-001', extra: ['autonomy: eligible'] });
    expect([...explicitlyHumanOnly(text)]).toEqual([]);
  });
});

describe('BL-143 — what WARNS (advisory, never fatal)', () => {
  it('an authored human-only fence on an unblocked todo item warns, and is not an error', () => {
    const text = doc({ id: 'BL-001', extra: ['autonomy: human-only'] });
    const { errors, warns } = collectFindings([item('BL-001')], [], text);
    expect(errors).toEqual([]);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toMatch(/human-only.*unblocked todo/);
  });

  it('stays silent when a real blocker holds the item — the fence is then a REASON, not a leftover', () => {
    const text = doc(
      { id: 'BL-001', extra: ['autonomy: human-only', 'blocked_by: [BL-002]'] },
      { id: 'BL-002' },
    );
    const items = [item('BL-001', { blockedBy: ['BL-002'] }), item('BL-002')];
    expect(collectFindings(items, [], text).warns).toEqual([]);
  });

  it('`eligible` on a non-todo item warns rather than failing (demoted by BL-143)', () => {
    const text = doc({ id: 'BL-001', status: 'done', extra: ['autonomy: eligible'] });
    const { errors, warns } = collectFindings([item('BL-001', { status: 'done', autonomy: 'eligible' })], [], text);
    expect(errors).toEqual([]);
    expect(warns[0]).toMatch(/eligible.*done/);
  });
});

describe('BL-143 — what stays an ERROR, and why the line is where it is', () => {
  it('`po-decision` on a todo item is an ERROR — retired vocabulary, not a stale fence', () => {
    const text = doc({ id: 'BL-001', extra: ['autonomy: po-decision'] });
    const { errors, warns } = collectFindings([item('BL-001', { autonomy: 'po-decision' })], [], text);
    expect(warns).toEqual([]);
    expect(errors[0]).toMatch(/po-decision/);
  });

  it('a dangling blocked_by is an ERROR — it silently UNBLOCKS work', () => {
    const text = doc({ id: 'BL-001', extra: ['blocked_by: [BL-999]'] });
    const { errors } = collectFindings([item('BL-001', { blockedBy: ['BL-999'] })], [], text);
    expect(errors[0]).toMatch(/unknown id "BL-999"/);
  });

  it('a parser warning is an ERROR — a header we could not read is not advisory', () => {
    const { errors, warns } = collectFindings([], ['unterminated @item header at line 4'], '');
    expect(warns).toEqual([]);
    expect(errors).toEqual(['parser: unterminated @item header at line 4']);
  });

  it('a blocked_by cycle is an ERROR', () => {
    const text = doc(
      { id: 'BL-001', extra: ['blocked_by: [BL-002]'] },
      { id: 'BL-002', extra: ['blocked_by: [BL-001]'] },
    );
    const items = [item('BL-001', { blockedBy: ['BL-002'] }), item('BL-002', { blockedBy: ['BL-001'] })];
    expect(collectFindings(items, [], text).errors.some((e) => /cycle/.test(e))).toBe(true);
  });
});

describe('BL-143 — the tier is a real split, not a rename', () => {
  it('errors and warnings coexist without either swallowing the other', () => {
    const text = doc(
      { id: 'BL-001', extra: ['autonomy: human-only'] }, // warns
      { id: 'BL-002', extra: ['autonomy: po-decision'] }, // errors
    );
    const { errors, warns } = collectFindings(
      [item('BL-001'), item('BL-002', { autonomy: 'po-decision' })],
      [],
      text,
    );
    expect(warns).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it('a clean backlog produces neither', () => {
    const text = doc({ id: 'BL-001' }, { id: 'BL-002', status: 'done' });
    const { errors, warns } = collectFindings([item('BL-001'), item('BL-002', { status: 'done' })], [], text);
    expect(errors).toEqual([]);
    expect(warns).toEqual([]);
  });
});
