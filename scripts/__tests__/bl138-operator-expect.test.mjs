import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { matchesWritePath, DEFAULT_EXPECT, unmatchedDeclarations } from '../infra-invariant.mjs';

/**
 * BL-138 — bars on the committed operator `--expect` declaration.
 *
 * WHAT THE DECLARATION IS, because it is easy to read backwards (and was, in this item's own first
 * filing): `allowWritePaths` is a **softening**, not a detector. With NO declaration,
 * `classifyHeadMove` returns `foreign` for any head move (`infra-invariant.mjs:413-415`) and that
 * is emitted as `critical` (`:793-799`) — the empty state is the STRICTEST one. Declaring paths
 * makes the harness report LESS, so that lawful operator commits stop firing criticals a reviewer
 * would otherwise learn to ignore.
 *
 * WHY THESE BARS EXIST AT ALL: the harness will not check the declaration for you. An over-wide or
 * mistyped one produces at most a `warn`, and `warn` is the deliberate ceiling (BL-116) precisely
 * because the harness cannot tell a typo from a legitimately unused allowance. So the fence on this
 * file is HERE, in the suite, and nowhere else.
 *
 * The file lives in `scripts/`, NOT `design/operator/`, on purpose (gate 1, G1): `design/operator/**`
 * is the seat's own write allowlist, and a seat able to edit its own declaration could widen what
 * its own run reports, then revert. Keep it where the seat cannot write.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECL_REL = 'scripts/operator-run.expect.json';
const declPath = path.resolve(__dirname, '..', 'operator-run.expect.json');
const declaration = JSON.parse(fs.readFileSync(declPath, 'utf-8'));
const patterns = declaration.allowWritePaths;

describe('BL-138 — the committed operator write declaration', () => {
  it('B6: is valid JSON at a stable path', () => {
    expect(fs.existsSync(declPath)).toBe(true);
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('B1: declares only keys the harness actually reads', () => {
    // The BL-116 typo class — `allowWritePath`, `allowedWritePaths`, or a stray `_comment`, each of
    // which merges cleanly, contributes nothing, and (since BL-116) costs a `warn`. A warn makes an
    // otherwise clean bracket exit 1, so an unknown key here would fail EVERY operator run.
    for (const key of Object.keys(declaration)) {
      expect(Object.keys(DEFAULT_EXPECT)).toContain(key);
    }
  });

  it('B1b: produces no BL-116 findings against a representative lawful diff', () => {
    // The end-to-end version of B1 and B5 together, driven through the harness's own checker rather
    // than re-implementing its judgement here.
    const candidates = {
      allowWritePaths: ['design/backlog.md', 'design/operator/hmp9-brief.md', 'design/operator-seat/SKILL.md'],
    };
    expect(unmatchedDeclarations(declaration, candidates)).toEqual([]);
  });

  it('B2: matches a real lawful write in every root the charter grants', () => {
    expect(matchesWritePath('design/backlog.md', patterns)).toBe(true);
    expect(matchesWritePath('design/operator/hmp9-brief.md', patterns)).toBe(true);
    expect(matchesWritePath('design/operator/.hmp-launched.json', patterns)).toBe(true);
    expect(matchesWritePath('design/operator-seat/SKILL.md', patterns)).toBe(true);
  });

  it('B3 ⭐: does NOT match design/po/ — the authorization must stay FOREIGN', () => {
    // THE LOAD-BEARING BAR. BL-137 moved the launch authorization to design/po/ so that a write
    // there is conspicuous. This declaration softens what the harness reports; if it ever covered
    // design/po/, the operator's own authorization write would report `allowed` instead of
    // `foreign` — silently undoing BL-137 while every other bar stayed green.
    expect(matchesWritePath('design/po/hmp1.authorized', patterns)).toBe(false);
    expect(matchesWritePath('design/po/anything-at-all', patterns)).toBe(false);
    // Stated as a property, not just two examples: no declared pattern may reach design/po/ at all.
    for (const p of patterns) {
      expect(matchesWritePath('design/po/x.authorized', [p])).toBe(false);
    }
  });

  it('B4: does not reach code, governance, or anything else outside the charter grant', () => {
    for (const outside of ['src/index.ts', 'AGENT.md', 'scripts/infra-invariant.mjs', 'package.json']) {
      expect(matchesWritePath(outside, patterns)).toBe(false);
    }
  });

  it('B5: every declared pattern matches something — the hmp2 defect, directly', () => {
    // hmp2 declared `design/operator/` instead of `design/operator/**`. It matched nothing,
    // contributed nothing, and the resulting `critical` was blamed on the run rather than on the
    // declaration. That misfire is the whole origin of BL-116.
    const representative = [
      'design/backlog.md',
      'design/operator/hmp9-brief.md',
      'design/operator/.hmp-launched.json',
      'design/operator-seat/SKILL.md',
      'design/operator-seat/references/backlog-semantics.md',
    ];
    for (const p of patterns) {
      expect(
        representative.some((c) => matchesWritePath(c, [p])),
        `pattern ${p} (declared in ${DECL_REL}) matches none of the representative paths — ` +
          `a bare directory needs /** , since matching is end to end`,
      ).toBe(true);
    }
  });
});
