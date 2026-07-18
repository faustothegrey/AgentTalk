#!/usr/bin/env node
// BL-036 — wt-setup: create/remove a per-task git worktree for AgentTalk with its
// node_modules correctly wired. Automates the hand-run dance (and its footguns):
//   - symlink every top-level node_modules entry INCLUDING `.bin` (readdir sees
//     dotfiles, so the shell `*`-skips-.bin footgun simply doesn't exist here);
//   - SKIP `@agenttalk`, then re-create `@agenttalk/*` with each link's RELATIVE
//     target so they resolve into the worktree's own packages, not the primary;
//   - symlink `apps/web/node_modules`;
//   - `tsc -b` (dist is gitignored) so tests can run.
//
// Usage:
//   node scripts/wt-setup.mjs create <id> [--base <ref>] [--baseline] [--root <dir>]
//   node scripts/wt-setup.mjs remove <id> [--delete-branch] [--root <dir>]
//
// The worktree lives at <root>/att-<id> (default root: /private/tmp) on branch task-<id>.

import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, symlinkSync, readlinkSync, existsSync } from 'node:fs';
import path from 'node:path';

const SCOPE = '@agenttalk';
const DEFAULT_ROOT = '/private/tmp';

function git(args, opts = {}) {
  // execFileSync returns null when stdout is inherited (side-effect calls) and a
  // string when captured; only trim the captured case.
  const out = execFileSync('git', args, { encoding: 'utf8', ...opts });
  return typeof out === 'string' ? out.trim() : out;
}

/** The main (primary) checkout, resolved even when invoked from inside a worktree. */
export function primaryCheckout() {
  // `git worktree list --porcelain` lists the main checkout first.
  const out = git(['worktree', 'list', '--porcelain']);
  const first = out.split('\n').find((l) => l.startsWith('worktree '));
  if (!first) throw new Error('could not resolve the primary checkout from `git worktree list`');
  return first.slice('worktree '.length);
}

/**
 * Pure-ish planner: read the primary's node_modules and decide what to link.
 * Returns { topLinks:[{name,target}], scopedLinks:[{name,relativeTarget}] }.
 * `target` is absolute (into the primary); `relativeTarget` is the SAME relative
 * string the primary's `@agenttalk/*` symlink uses, so it resolves into the worktree.
 */
export function buildLinkPlan(primaryNodeModules) {
  const entries = readdirSync(primaryNodeModules); // includes dotfiles like `.bin`
  const topLinks = entries
    .filter((name) => name !== SCOPE)
    .map((name) => ({ name, target: path.join(primaryNodeModules, name) }));

  const scopedLinks = [];
  const scopeDir = path.join(primaryNodeModules, SCOPE);
  if (existsSync(scopeDir)) {
    for (const name of readdirSync(scopeDir)) {
      scopedLinks.push({ name, relativeTarget: readlinkSync(path.join(scopeDir, name)) });
    }
  }
  return { topLinks, scopedLinks };
}

function wireNodeModules(primary, wt) {
  const primaryNm = path.join(primary, 'node_modules');
  const wtNm = path.join(wt, 'node_modules');
  const { topLinks, scopedLinks } = buildLinkPlan(primaryNm);

  mkdirSync(wtNm, { recursive: true });
  for (const { name, target } of topLinks) symlinkSync(target, path.join(wtNm, name));

  if (scopedLinks.length) {
    mkdirSync(path.join(wtNm, SCOPE), { recursive: true });
    for (const { name, relativeTarget } of scopedLinks) {
      symlinkSync(relativeTarget, path.join(wtNm, SCOPE, name));
    }
  }

  // apps/web has its own node_modules; the worktree's apps/web already exists (full checkout).
  const webNm = path.join(primary, 'apps', 'web', 'node_modules');
  if (existsSync(webNm)) symlinkSync(webNm, path.join(wt, 'apps', 'web', 'node_modules'));

  return { topCount: topLinks.length, scopedCount: scopedLinks.length };
}

function worktreePath(root, id) {
  return path.join(root, `att-${id}`);
}

function create(id, { base, baseline, root }) {
  const primary = primaryCheckout();
  const wt = worktreePath(root, id);
  if (existsSync(wt)) throw new Error(`worktree path already exists: ${wt}`);

  // `--no-track`: when <base> is a remote ref (e.g. `origin/master`, the recommended
  // base), git would otherwise set the new branch's upstream to it — and then
  // `remove --delete-branch`'s safe `git branch -d` compares against that unpushed
  // upstream instead of local `master`, refuses, and crashes (BL-074). No upstream
  // ⇒ `-d` checks local `master`, the actual merge target. Harmless when base is local.
  const addArgs = ['worktree', 'add', '--no-track', wt, '-b', `task-${id}`];
  if (base) addArgs.push(base);
  git(addArgs, { cwd: primary, stdio: ['ignore', 'inherit', 'inherit'] });

  const { topCount, scopedCount } = wireNodeModules(primary, wt);
  console.log(`[wt-setup] wired node_modules: ${topCount} top-level + ${scopedCount} @agenttalk entries`);

  console.log('[wt-setup] building (tsc -b)…');
  execFileSync('npx', ['tsc', '-b'], { cwd: wt, stdio: 'inherit' });

  if (baseline) {
    console.log('[wt-setup] baseline (vitest run)…');
    execFileSync('npx', ['vitest', 'run'], { cwd: wt, stdio: 'inherit' });
  }

  console.log(`\n[wt-setup] ready: ${wt}  (branch task-${id})`);
  console.log('[wt-setup] REMINDER: stage files EXPLICITLY — never `git add -A` (a symlinked node_modules slips past .gitignore).');
}

function remove(id, { deleteBranch, root }) {
  const primary = primaryCheckout();
  const wt = worktreePath(root, id);
  git(['worktree', 'remove', wt, '--force'], { cwd: primary, stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(`[wt-setup] removed worktree ${wt}`);
  if (deleteBranch) {
    // safe `-d`: refuses to delete an unmerged branch. Never `-D`.
    git(['branch', '-d', `task-${id}`], { cwd: primary, stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(`[wt-setup] deleted branch task-${id}`);
  }
}

function parseArgs(argv) {
  const [cmd, id, ...rest] = argv;
  const opts = { root: DEFAULT_ROOT };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--baseline') opts.baseline = true;
    else if (a === '--delete-branch') opts.deleteBranch = true;
    else if (a === '--base') opts.base = rest[++i];
    else if (a === '--root') opts.root = rest[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  return { cmd, id, opts };
}

function main() {
  const { cmd, id, opts } = parseArgs(process.argv.slice(2));
  if (!cmd || !id || (cmd !== 'create' && cmd !== 'remove')) {
    console.error('Usage:\n  node scripts/wt-setup.mjs create <id> [--base <ref>] [--baseline] [--root <dir>]\n  node scripts/wt-setup.mjs remove <id> [--delete-branch] [--root <dir>]');
    process.exit(2);
  }
  if (cmd === 'create') create(id, opts);
  else remove(id, opts);
}

// Only run when invoked directly (so the pure helpers can be imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
