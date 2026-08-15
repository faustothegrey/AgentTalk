import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import {
  collectCitations,
  evaluate,
  readBaseline,
  isFixtureFile,
  NEVER_EXISTS,
} from '../check-doc-citations.mjs';

/**
 * BL-141 — the doc-citation gate.
 *
 * Every bar runs against a REAL throwaway git repo, because the collector's file list comes from
 * `git ls-files`: a mocked lister would prove nothing about the thing under test. Same idiom as
 * `infra-invariant.test.mjs`.
 */

const containers = [];

afterEach(() => {
  while (containers.length) {
    const dir = containers.pop();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leaked temp dir must never fail a bar */
    }
  }
});

/** A real git repo containing `files` (relative path -> contents), all tracked. */
function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-cite-'));
  containers.push(dir);
  execSync(`git init -q -b master "${dir}"`, { stdio: 'pipe' });
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
  return dir;
}

const baselineIn = (dir, known) => {
  const p = path.join(dir, 'baseline.json');
  fs.writeFileSync(p, JSON.stringify({ known }));
  return p;
};

describe('BL-141 — resolving citations', () => {
  it('accepts a citation whose target exists', () => {
    const dir = makeRepo({
      'design/a.md': 'see design/b.md for the rest',
      'design/b.md': '# b',
    });
    const { total, unresolved } = collectCitations(dir);
    expect(total).toBe(1);
    expect(unresolved).toEqual([]);
  });

  it('flags a citation whose target does not exist, naming BOTH ends', () => {
    const dir = makeRepo({ 'design/a.md': 'see design/ghost.md' });
    expect(collectCitations(dir).unresolved).toEqual(['design/a.md -> design/ghost.md']);
  });

  it('keys a finding by citer AND target, so fixing one document retires only its own entry', () => {
    const dir = makeRepo({
      'design/a.md': 'design/ghost.md',
      'design/b.md': 'design/ghost.md',
    });
    // The same missing target cited twice is TWO findings, not one — otherwise repairing `a.md`
    // would silently clear `b.md`'s identical, still-broken reference.
    expect(collectCitations(dir).unresolved).toEqual([
      'design/a.md -> design/ghost.md',
      'design/b.md -> design/ghost.md',
    ]);
  });

  it('reads citations out of code as well as prose — a stale path in a comment is still stale', () => {
    const dir = makeRepo({ 'scripts/x.mjs': '// see design/ghost.md\n' });
    expect(collectCitations(dir).unresolved).toEqual(['scripts/x.mjs -> design/ghost.md']);
  });

  it('does not guess at bare filenames — only unambiguous repo-relative paths count', () => {
    const dir = makeRepo({ 'design/a.md': 'see registry.ts and backlog.md and README' });
    // A checker that resolved bare names would produce findings nobody trusts.
    expect(collectCitations(dir).total).toBe(0);
  });

  it('does NOT match a path rooted in ANOTHER repository', () => {
    const dir = makeRepo({
      'design/runbook.md':
        'node /abs/path/to/agentalk-mcp-client/scripts/launcher.mjs config.json\n' +
        'and see ../other-repo/design/whatever.md too',
    });
    // This is the bug that shipped and produced BL-142's most alarming (and false) line: a
    // substring match reported the CLIENT repo's launcher as missing from THIS repo. It is
    // missing from this repo, and entirely present where it is cited from.
    expect(collectCitations(dir).unresolved).toEqual([]);
    expect(collectCitations(dir).total).toBe(0);
  });

  it('still matches a genuine repo-relative path at a line start, in prose, and in backticks', () => {
    const dir = makeRepo({
      'design/a.md': 'design/ghost.md\nsee design/ghost2.md here\nand `design/ghost3.md`\n',
    });
    // The boundary rule must not be so strict that it stops seeing real citations.
    expect(collectCitations(dir).unresolved).toEqual([
      'design/a.md -> design/ghost.md',
      'design/a.md -> design/ghost2.md',
      'design/a.md -> design/ghost3.md',
    ]);
  });
});

describe('BL-141 — where the gate agrees to be blind, and why', () => {
  it('ignores __tests__ files: their paths are fixtures for pure matchers', () => {
    const dir = makeRepo({ 'scripts/__tests__/a.test.mjs': "matches('design/x.md', pats)" });
    expect(collectCitations(dir).unresolved).toEqual([]);
    expect(isFixtureFile('scripts/__tests__/a.test.mjs')).toBe(true);
  });

  it('ignores design/archive/**: a stale pointer in an immutable record is TRUE as history', () => {
    const dir = makeRepo({ 'design/archive/old-plan.md': 'ran scripts/gone.mjs' });
    expect(collectCitations(dir).unresolved).toEqual([]);
  });

  it('ignores design/backlog/**: filing a dangling-reference finding must not itself dangle', () => {
    const dir = makeRepo({ 'design/backlog/85-governance.md': 'BL-142: design/ghost.md is broken' });
    expect(collectCitations(dir).unresolved).toEqual([]);
  });

  it('does NOT exempt operator briefs or session primers — those are read as instructions', () => {
    const dir = makeRepo({
      'design/operator/h1-brief.md': 'invoke scripts/launcher.mjs',
      'design/session-primers/planner-primer.md': 'see design/ghost.md',
    });
    // They look historical and are not: a stale pointer in either misleads a live actor. This bar
    // exists so a future "tidy the noise" pass cannot quietly add them to the exempt list.
    expect(collectCitations(dir).unresolved).toEqual([
      'design/operator/h1-brief.md -> scripts/launcher.mjs',
      'design/session-primers/planner-primer.md -> design/ghost.md',
    ]);
  });

  it('exempts paths that are cited BECAUSE they must never exist (LB-12)', () => {
    const dir = makeRepo({ 'modules/governance/docs/logbook.md': `never create ${NEVER_EXISTS[0]}` });
    expect(collectCitations(dir).unresolved).toEqual([]);
  });
});

describe('BL-141 — the ratchet', () => {
  it('a known-broken citation is carried, not failed', () => {
    const dir = makeRepo({ 'design/a.md': 'design/ghost.md' });
    const bp = baselineIn(dir, ['design/a.md -> design/ghost.md']);
    const r = evaluate(dir, bp);
    expect(r.fresh).toEqual([]);
    expect(r.baselineSize).toBe(1);
  });

  it('a NEWLY broken citation fails, even while known ones are carried', () => {
    const dir = makeRepo({ 'design/a.md': 'design/ghost.md', 'design/b.md': 'design/new-ghost.md' });
    const bp = baselineIn(dir, ['design/a.md -> design/ghost.md']);
    expect(evaluate(dir, bp).fresh).toEqual(['design/b.md -> design/new-ghost.md']);
  });

  it('reports a repaired citation as `fixed`, so the register visibly shrinks', () => {
    const dir = makeRepo({ 'design/a.md': 'design/b.md', 'design/b.md': '# b' });
    const bp = baselineIn(dir, ['design/a.md -> design/b.md']);
    const r = evaluate(dir, bp);
    expect(r.fixed).toEqual(['design/a.md -> design/b.md']);
    expect(r.fresh).toEqual([]);
  });

  it('a CORRUPT baseline fails closed — every known entry becomes a fresh failure', () => {
    const dir = makeRepo({ 'design/a.md': 'design/ghost.md' });
    const bp = path.join(dir, 'corrupt.json');
    fs.writeFileSync(bp, '{ not json');
    // The dangerous direction would be reading a corrupt file as "everything is allowed". Loud is
    // the correct failure mode for a gate whose whole job is noticing.
    expect(readBaseline(bp)).toEqual([]);
    expect(evaluate(dir, bp).fresh).toEqual(['design/a.md -> design/ghost.md']);
  });

  it('a missing baseline is treated as empty, not as a pass', () => {
    const dir = makeRepo({ 'design/a.md': 'design/ghost.md' });
    expect(evaluate(dir, path.join(dir, 'nope.json')).fresh).toHaveLength(1);
  });
});

describe('BL-141 — the gate runs against THIS repo', () => {
  // A gate nothing runs is not a gate. This one shipped red for exactly one commit because the
  // baseline was generated while its own source was still untracked, so `git ls-files` did not
  // list it — and nothing in the suite would have said so. That is the gap this bar closes.
  //
  // Yes, this couples a unit test to real repo state. That is deliberate and is the house idiom:
  // `bl093-backlog-selectable.test.ts` pins the real backlog for the same reason — some properties
  // are only true of the actual tree, and pinning them is how a human is forced to look.
  it('has no NEWLY broken citations — fix the reference, do not re-baseline', () => {
    const { fresh, total, baselineSize } = evaluate();
    expect(total).toBeGreaterThan(0); // not passing by having scanned nothing
    expect(baselineSize).toBeGreaterThan(0); // …nor by having lost the register
    expect(fresh).toEqual([]);
  });
});

/**
 * BL-144 (Wave 2) — the gate must follow docs into `modules/`.
 *
 * Wave 2 moves durable documents out of `design/` and into the module that owns them. Before this
 * pattern existed the checker resolved only `design/**.md` and `scripts/**.mjs`, so every moved doc
 * would have left its coverage silently — and the reported total would have FALLEN, which reads as
 * an improvement rather than as blindness. These bars pin the third pattern, and pin that it is
 * boundary-anchored like the other two: the [[BL-142]] substring trap applies here identically.
 */
describe('BL-144 — modules/**.md is a citation target', () => {
  it('a citation into a module resolves when the file is there', () => {
    const dir = makeRepo({
      'design/a.md': 'see modules/backlog/docs/thing.md for detail',
      'modules/backlog/docs/thing.md': '# thing',
    });
    expect(collectCitations(dir).unresolved).toEqual([]);
  });

  it('a citation into a module that is NOT there is caught', () => {
    const dir = makeRepo({ 'design/a.md': 'see modules/backlog/docs/ghost.md' });
    expect(collectCitations(dir).unresolved).toEqual(['design/a.md -> modules/backlog/docs/ghost.md']);
  });

  it('a module README is a citer like any other file', () => {
    const dir = makeRepo({ 'modules/backlog/README.md': 'the slice is design/backlog/40-backlog.md' });
    expect(collectCitations(dir).unresolved).toEqual(['modules/backlog/README.md -> design/backlog/40-backlog.md']);
  });

  /** The cross-repo case, planted: a `modules/` path rooted in ANOTHER checkout is not ours. */
  it('does not match a modules path embedded in a longer foreign path', () => {
    const dir = makeRepo({ 'design/a.md': 'run /abs/other-repo/modules/x/docs/y.md' });
    expect(collectCitations(dir).unresolved).toEqual([]);
  });
});
