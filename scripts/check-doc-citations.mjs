#!/usr/bin/env node

/**
 * BL-141 — the doc-citation gate.
 *
 * USAGE:
 *   node scripts/check-doc-citations.mjs            # gate: fail on NEW breakage
 *   node scripts/check-doc-citations.mjs --list     # every unresolved citation, baseline included
 *   node scripts/check-doc-citations.mjs --json
 *   node scripts/check-doc-citations.mjs --update-baseline
 *
 * WHY THIS EXISTS
 *   In this project the docs ARE the primary artifact — 56k lines of them against ~9.7k lines of
 *   product — and they were the one artifact with no toolchain. Code here has modules, a dependency
 *   graph, dead-code elimination and CI. Docs had none of the four. This is the third.
 *
 *   It was written as a throwaway check to prove the Wave 0 archive move broke no references, and
 *   immediately found something no one could have known: 1,727 citations across the repo, 131 of
 *   them unresolved — including the operator seat's own launch runbook citing `scripts/launcher.mjs`,
 *   which is not in the repo. Every correction marker in `AGENT.md` is a citation that silently
 *   stopped resolving. This is the class, mechanised.
 *
 * IT IS A RATCHET, AND THAT IS THE LOAD-BEARING DESIGN DECISION
 *   131 citations are already broken. A gate that fails on all of them is red on day one, and a gate
 *   that is red on day one is a gate everybody learns to ignore — which is worse than no gate,
 *   because it also teaches people to ignore the real one. So the known-broken set is COMMITTED as a
 *   baseline and the gate fails only on citations broken AFTER this point.
 *
 *   The baseline is a debt register, not an amnesty: every run prints how many entries remain, and
 *   `--update-baseline` refuses to ADD entries. Fixing one and re-baselining shrinks it permanently.
 *   The worklist it represents is [[BL-142]].
 *
 * WHAT IS DELIBERATELY NOT A CITATION — both learned by getting it wrong
 *   1. Anything under `__tests__`. Their "paths" (`design/x.md`, `design/operator/unauth-brief.md`)
 *      are FIXTURES fed to pure matchers, not references to real files. Counting them turned a real
 *      signal into noise — it is why an early count said 36 and a later one 131 for the same repo.
 *   2. Paths on the NEVER_EXISTS list. `design/session-primers/claude.md` and `CLAUDE.md` are named
 *      by `logbook.md` precisely as files that must NEVER exist (LB-12: on a case-insensitive
 *      filesystem they would be auto-slurped as instructions, bypassing the primer gate). A linter
 *      that flags a deliberate absence teaches its readers to distrust it.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isMainModule } from './lib/is-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');
export const BASELINE_PATH = path.join(REPO_ROOT, 'design', 'doc-citations-baseline.json');

/**
 * Paths that are cited BECAUSE they must not exist. Flagging one is a false positive with a cost:
 * it trains the reader to skim past real findings.
 */
export const NEVER_EXISTS = ['design/session-primers/claude.md', 'design/session-primers/CLAUDE.md'];

/**
 * Files whose path-shaped strings are NOT live pointers, and so are not read for citations.
 *
 * Three kinds, each excluded for its own reason — and the reasons matter, because every exclusion
 * is a place the gate agrees to be blind:
 *
 *   `__tests__/**`        fixtures fed to pure matchers (`design/x.md`, `unauth-brief.md`). They
 *                         describe no file and never did.
 *   `design/archive/**`   immutable episodic records. Wave 0's rule is that an archived plan is
 *   `scripts/archive/**`  never edited again, so a reference that has gone stale is CORRECT AS
 *                         HISTORY — "the plan cited the file that existed then" is a true sentence.
 *                         Repairing those would falsify the record, which is the one thing Wave 0
 *                         was careful not to do.
 *   `design/backlog/**`   the backlog quotes broken paths when FILING them (see [[BL-142]], which
 *                         lists all sixteen). A bug report about dangling references must not read
 *                         as dangling references, or filing a finding becomes self-defeating.
 *
 * Note what is deliberately NOT excluded: `design/operator/**` briefs and `design/session-primers/**`.
 * Those look historical but are read as instructions, and a stale pointer in them misleads an actor.
 */
export const CITER_EXEMPT = [/__tests__/, /^design\/archive\//, /^scripts\/archive\//, /^design\/backlog\//];
export const isFixtureFile = (rel) => CITER_EXEMPT.some((rx) => rx.test(rel));

/** File kinds we read citations OUT of. */
const SCANNED = /\.(md|ts|tsx|mjs)$/;

/**
 * Citation shapes we resolve. Deliberately only two, and both are unambiguous repo-relative paths:
 * `design/**.md` and `scripts/**.mjs`. Bare filenames (`registry.ts`) are NOT matched — they are
 * ambiguous, and a checker that guesses produces findings nobody trusts.
 */
const PATTERNS = [/design\/[A-Za-z0-9._/-]+\.md/g, /scripts\/[A-Za-z0-9._/-]+\.mjs/g];

const key = (citer, target) => `${citer} -> ${target}`;

export function trackedFiles(repoRoot = REPO_ROOT) {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => SCANNED.test(f) && !f.includes('node_modules'));
}

/**
 * Every citation in the repo, resolved. Returns `{ total, unresolved }` where `unresolved` is a
 * sorted array of `"<citer> -> <target>"` — the citer is part of the identity on purpose, so fixing
 * one document's reference retires exactly that entry and not another file's identical mistake.
 */
export function collectCitations(repoRoot = REPO_ROOT) {
  const unresolved = new Set();
  let total = 0;

  for (const rel of trackedFiles(repoRoot)) {
    if (isFixtureFile(rel)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
    } catch {
      continue; // a listed-but-unreadable file is git's problem, not this gate's
    }
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(text))) {
        const target = m[0];
        total++;
        if (NEVER_EXISTS.includes(target)) continue;
        if (!fs.existsSync(path.join(repoRoot, target))) unresolved.add(key(rel, target));
      }
    }
  }
  return { total, unresolved: [...unresolved].sort() };
}

export function readBaseline(baselinePath = BASELINE_PATH) {
  if (!fs.existsSync(baselinePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    return Array.isArray(parsed.known) ? parsed.known : [];
  } catch {
    // A corrupt baseline must FAIL CLOSED — an empty list would silently turn every known-broken
    // citation into a fresh failure, which at least is loud; the dangerous direction would be
    // treating a corrupt file as "everything is allowed".
    return [];
  }
}

/**
 * The gate's verdict. `fresh` is what fails a run: unresolved citations absent from the baseline.
 * `fixed` is the good news — baseline entries that now resolve, i.e. debt actually repaid.
 */
export function evaluate(repoRoot = REPO_ROOT, baselinePath = BASELINE_PATH) {
  const { total, unresolved } = collectCitations(repoRoot);
  const baseline = new Set(readBaseline(baselinePath));
  const current = new Set(unresolved);
  return {
    total,
    unresolved,
    fresh: unresolved.filter((u) => !baseline.has(u)),
    fixed: [...baseline].filter((b) => !current.has(b)).sort(),
    baselineSize: baseline.size,
  };
}

function main(argv) {
  const flag = (n) => argv.includes(n);
  const result = evaluate();

  if (flag('--update-baseline') || flag('--init')) {
    const baseline = new Set(readBaseline());
    // Refuse to GROW. The ratchet only turns one way; otherwise "update the baseline" becomes the
    // standard way to make a real finding go away, and the register stops meaning anything.
    //
    // `--init` is the ONE exception, and it exists because the rule above made creation impossible:
    // with no baseline every entry is growth, so the first run could never write one. It is the
    // deliberate act of declaring today's debt, not a way around the ratchet — running it against
    // an EXISTING baseline is refused below, so it cannot be used to launder a new finding.
    if (flag('--init') && fs.existsSync(BASELINE_PATH)) {
      console.error('✗ --init refused: a baseline already exists. Fix the citation, or use');
      console.error('  --update-baseline (which shrinks the register but will not grow it).');
      return 1;
    }
    const growth = flag('--init') ? [] : result.unresolved.filter((u) => !baseline.has(u));
    if (growth.length) {
      console.error(`✗ refusing to grow the baseline by ${growth.length} entr(y|ies):\n`);
      growth.forEach((g) => console.error(`    ${g}`));
      console.error('\n  Fix the citation, or state why it is legitimate and add it to NEVER_EXISTS.');
      return 1;
    }
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          _comment:
            'BL-141 — known-broken citations at the time this gate was introduced. A DEBT REGISTER, not an amnesty: the gate fails on anything NOT in here, and --update-baseline refuses to grow it. Shrinking it is BL-142.',
          generated: new Date().toISOString().slice(0, 10),
          known: result.unresolved,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`✓ baseline rewritten: ${result.unresolved.length} known-broken (was ${baseline.size})`);
    return 0;
  }

  if (flag('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result.fresh.length ? 1 : 0;
  }

  if (flag('--list')) {
    console.log(`All ${result.unresolved.length} unresolved citation(s):\n`);
    result.unresolved.forEach((u) => console.log(`  ${u}`));
    console.log('');
  }

  if (result.fresh.length) {
    console.error(`✗ ${result.fresh.length} NEWLY broken citation(s):\n`);
    result.fresh.forEach((f) => console.error(`    ${f}`));
    console.error(
      '\n  A cited path must resolve. Fix the reference, or — if the file is meant never to' +
        '\n  exist — add it to NEVER_EXISTS in scripts/check-doc-citations.mjs and say why.\n',
    );
    return 1;
  }

  const fixedNote = result.fixed.length
    ? `, ${result.fixed.length} baseline entr${result.fixed.length === 1 ? 'y' : 'ies'} now RESOLVE (run --update-baseline to bank it)`
    : '';
  console.log(
    `✓ citations OK — ${result.total} checked, 0 newly broken; ${result.baselineSize} known-broken carried (BL-142)${fixedNote}.`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) process.exit(main(process.argv.slice(2)));
