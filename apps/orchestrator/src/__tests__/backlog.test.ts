import { describe, expect, it } from 'vitest';
import { parseBacklog, readBacklog } from '../backlog.js';

describe('parseBacklog', () => {
  it('parses a well-formed item with all header fields', () => {
    const md = [
      '<!-- @item',
      'id: BL-001',
      'status: open',
      'date: 2026-06-20',
      'epic: M07',
      'tags: [live-smoke, quota-blocked]',
      '-->',
      '- [open] 2026-06-20 — **Re-run the live smoke** — the deferred T2.4.',
      '',
      '*(add new items above this line)*',
    ].join('\n');

    const { items, warnings } = parseBacklog(md);
    expect(warnings).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: 'BL-001',
      status: 'open',
      date: '2026-06-20',
      epic: 'M07',
      promotedTo: null,
      tags: ['live-smoke', 'quota-blocked'],
      title: 'Re-run the live smoke',
      bodyMarkdown: '- [open] 2026-06-20 — **Re-run the live smoke** — the deferred T2.4.',
    });
  });

  it('captures promoted_to and empty tags, and nulls "null"/missing fields', () => {
    const md = [
      '<!-- @item',
      'id: BL-002',
      'status: promoted',
      'promoted_to: M11',
      'epic: null',
      'tags: []',
      '-->',
      '- [promoted→M11] — **Consensus robustness** — moved to its own epic.',
    ].join('\n');

    const { items } = parseBacklog(md);
    expect(items[0].promotedTo).toBe('M11');
    expect(items[0].epic).toBeNull();
    expect(items[0].date).toBeNull();
    expect(items[0].tags).toEqual([]);
  });

  it('skips content with no @item header (intro, tables, DONE archives)', () => {
    const md = [
      '# Backlog',
      'Some intro prose.',
      '### ✅ DONE — an archived section',
      '- [done] 2026-06-25 — **Something finished** — no header, must be skipped.',
    ].join('\n');

    const { items, warnings } = parseBacklog(md);
    expect(items).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('warns and skips an item missing an id', () => {
    const md = ['<!-- @item', 'status: open', '-->', '- **No id here**'].join('\n');
    const { items, warnings } = parseBacklog(md);
    expect(items).toEqual([]);
    expect(warnings.some((w) => w.includes('no "id"'))).toBe(true);
  });

  it('warns on an unknown status but keeps the item', () => {
    const md = ['<!-- @item', 'id: BL-003', 'status: wibble', '-->', '- **x**'].join('\n');
    const { items, warnings } = parseBacklog(md);
    expect(items).toHaveLength(1);
    expect(warnings.some((w) => w.includes('unknown status'))).toBe(true);
  });

  it('warns on a duplicate id', () => {
    const md = [
      '<!-- @item', 'id: BL-004', 'status: open', '-->', '- **first**',
      '<!-- @item', 'id: BL-004', 'status: open', '-->', '- **second**',
    ].join('\n');
    const { warnings } = parseBacklog(md);
    expect(warnings.some((w) => w.includes('Duplicate backlog id "BL-004"'))).toBe(true);
  });

  it('warns when the header status drifts from the prose [STATUS] tag', () => {
    const md = [
      '<!-- @item', 'id: BL-005', 'status: open', '-->',
      '- [done] 2026-06-01 — **Stale prose** — header says open, prose says done.',
    ].join('\n');
    const { warnings } = parseBacklog(md);
    expect(warnings.some((w) => w.includes('drift'))).toBe(true);
  });

  it('does NOT warn when header status matches a promoted→X prose tag', () => {
    const md = [
      '<!-- @item', 'id: BL-006', 'status: promoted', 'promoted_to: M11', '-->',
      '- [promoted→M11] — **matches** — no drift expected.',
    ].join('\n');
    const { warnings } = parseBacklog(md);
    expect(warnings.filter((w) => w.includes('drift'))).toEqual([]);
  });

  it('ends an item body at the next @item boundary', () => {
    const md = [
      '<!-- @item', 'id: BL-007', 'status: open', '-->',
      '- **first** body line one',
      '  continued body line two',
      '<!-- @item', 'id: BL-008', 'status: open', '-->',
      '- **second**',
    ].join('\n');
    const { items } = parseBacklog(md);
    expect(items).toHaveLength(2);
    expect(items[0].bodyMarkdown).toContain('continued body line two');
    expect(items[0].bodyMarkdown).not.toContain('second');
  });

  it('warns on an unterminated header', () => {
    const md = ['<!-- @item', 'id: BL-009', 'status: open', '- **oops no close**'].join('\n');
    const { warnings } = parseBacklog(md);
    expect(warnings.some((w) => w.includes('Unterminated'))).toBe(true);
  });
});

describe('readBacklog (real file)', () => {
  it('parses the checked-in backlog: every item has a BL- id and clean-ish warnings', () => {
    const { items } = readBacklog();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.id).toMatch(/^BL-\d+$/);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });
});
