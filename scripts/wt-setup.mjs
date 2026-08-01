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
// The worktree lives at <root>/att-<id> (default root: the platform temp dir) on branch task-<id>.

import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, symlinkSync, readlinkSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMainModule } from './lib/is-main.mjs';

const SCOPE = '@agenttalk';
// BL-100: was hardcoded '/private/tmp' (macOS), which made `--root` MANDATORY on Linux for
// BOTH verbs — and omitting it on `remove` died with an unhandled execFileSync stack trace.
// NOTE this is not a no-op on macOS: os.tmpdir() there is /var/folders/..., not /private/tmp.
// Deliberate and PO-disclosed — the default is a scratch location with no persistent state and
// an explicit --root override. os.tmpdir() honours $TMPDIR, so the root is environment-derived.
const DEFAULT_ROOT = os.tmpdir();

/**
 * An expected, user-facing failure — reported as one `[wt-setup]` line, never as a
 * Node stack (BL-104). Anything NOT of this class is a genuine code defect and keeps
 * its stack, which is the whole point of having a class at all.
 */
export class WtSetupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WtSetupError';
  }
}

/** Non-empty stderr lines, each prefixed — git's own words, no wrapper stack. */
export function formatFailure(err) {
  const text = String(err?.message ?? err).trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.length ? lines : ['failed']).map((l) => `[wt-setup] ${l}`);
}

function git(args, opts = {}) {
  // BL-104: stderr is PIPED rather than inherited so a failing git can be reported as
  // its own one-line message instead of an unhandled execFileSync stack. On SUCCESS the
  // captured stderr is forwarded verbatim, which is what execFileSync's default did, so
  // `worktree add`'s progress lines still reach the terminal.
  const stdio = Array.isArray(opts.stdio) ? [opts.stdio[0], opts.stdio[1], 'pipe'] : opts.stdio;
  const res = spawnSync('git', args, { encoding: 'utf8', ...opts, stdio });

  // The process never started (git missing, bad cwd) — no exit code to read.
  if (res.error) throw new WtSetupError(`git ${args[0]}: ${res.error.message}`);

  const stderr = typeof res.stderr === 'string' ? res.stderr : '';
  if (res.status !== 0) {
    // Deliberately NOT swallowed and NOT made idempotent: a genuinely missing worktree
    // must still fail, because that is the one case this message exists for.
    throw new WtSetupError(stderr.trim() || `git ${args.join(' ')} exited ${res.status}`);
  }
  if (stderr) process.stderr.write(stderr);

  // spawnSync returns null for stdout when it is inherited (side-effect calls) and a
  // string when captured; only trim the captured case.
  return typeof res.stdout === 'string' ? res.stdout.trim() : res.stdout;
}

/**
 * Run a long child (build / test suite) with its output STREAMING, and convert only a
 * non-zero exit into a `WtSetupError`.
 *
 * BL-115: deliberately NOT the BL-104 `git()` shape. There, stderr is piped so the child's
 * own words can be reformatted; here `stdio: 'inherit'` is load-bearing — a build's and a
 * test run's live output *is* the point of running them, and buffering a whole `vitest run`
 * until it exits would be a worse regression than the stack trace this replaces. The price
 * is that nothing is captured, so there is no child stderr to quote: the message is
 * synthesised from the label, the cwd and the exit status, and the child's real diagnostics
 * are already on the terminal above it.
 */
export function runStreaming(label, file, args, cwd) {
  const res = spawnSync(file, args, { cwd, stdio: 'inherit' });

  // The process never started (binary missing, bad cwd) — no exit code to read.
  if (res.error) throw new WtSetupError(`${label}: ${res.error.message}`);

  // `status` is null when the child was killed by a signal, so this covers both.
  if (res.status !== 0) {
    const how = res.signal ? `was killed by ${res.signal}` : `failed (exit ${res.status})`;
    throw new WtSetupError(`${label} ${how} in ${cwd} — see its output above`);
  }
}

/** The main (primary) checkout, resolved even when invoked from inside a worktree. */
export function primaryCheckout() {
  // `git worktree list --porcelain` lists the main checkout first.
  const out = git(['worktree', 'list', '--porcelain']);
  const first = out.split('\n').find((l) => l.startsWith('worktree '));
  if (!first) throw new WtSetupError('could not resolve the primary checkout from `git worktree list`');
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
  if (existsSync(wt)) throw new WtSetupError(`worktree path already exists: ${wt}`);

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
  runStreaming('tsc -b', 'npx', ['tsc', '-b'], wt);

  if (baseline) {
    console.log('[wt-setup] baseline (vitest run)…');
    runStreaming('vitest run', 'npx', ['vitest', 'run'], wt);
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
    else throw new WtSetupError(`unknown argument: ${a}`);
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
if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (err) {
    // BL-104: expected failures report as `[wt-setup] <git's own message>` with a NON-ZERO
    // exit. An unexpected error is a code defect and keeps its stack — rethrown, not hidden.
    if (!(err instanceof WtSetupError)) throw err;
    for (const line of formatFailure(err)) console.error(line);
    process.exit(1);
  }
}
