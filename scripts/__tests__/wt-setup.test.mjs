import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { buildLinkPlan, formatFailure, WtSetupError } from '../wt-setup.mjs';

describe('wt-setup buildLinkPlan (BL-036)', () => {
  let tmp;
  let nm;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'wt-setup-test-'));
    nm = path.join(tmp, 'node_modules');
    mkdirSync(nm, { recursive: true });
    // regular deps
    mkdirSync(path.join(nm, 'vitest'));
    mkdirSync(path.join(nm, 'express'));
    // the dotfile that a shell `*` glob would miss — readdir must catch it
    mkdirSync(path.join(nm, '.bin'));
    // the workspace scope, with RELATIVE symlinks like the real repo
    mkdirSync(path.join(nm, '@agenttalk'));
    symlinkSync('../../packages/contracts', path.join(nm, '@agenttalk', 'contracts'));
    symlinkSync('../../packages/runtime-core', path.join(nm, '@agenttalk', 'runtime-core'));
    symlinkSync('../../apps/web', path.join(nm, '@agenttalk', 'web'));
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('links every top-level entry INCLUDING .bin, and skips @agenttalk', () => {
    const { topLinks } = buildLinkPlan(nm);
    const names = topLinks.map((l) => l.name).sort();
    expect(names).toEqual(['.bin', 'express', 'vitest']);
    expect(names).toContain('.bin'); // the load-bearing gotcha
    expect(names).not.toContain('@agenttalk');
  });

  it('points top-level links at the primary node_modules (absolute)', () => {
    const { topLinks } = buildLinkPlan(nm);
    const vitest = topLinks.find((l) => l.name === 'vitest');
    expect(vitest.target).toBe(path.join(nm, 'vitest'));
  });

  it('re-creates @agenttalk/* preserving the RELATIVE target (so it resolves into the worktree)', () => {
    const { scopedLinks } = buildLinkPlan(nm);
    const byName = Object.fromEntries(scopedLinks.map((l) => [l.name, l.relativeTarget]));
    expect(byName).toEqual({
      contracts: '../../packages/contracts',
      'runtime-core': '../../packages/runtime-core',
      web: '../../apps/web',
    });
  });

  it('returns no scopedLinks when there is no @agenttalk scope', () => {
    rmSync(path.join(nm, '@agenttalk'), { recursive: true, force: true });
    const { scopedLinks, topLinks } = buildLinkPlan(nm);
    expect(scopedLinks).toEqual([]);
    expect(topLinks.map((l) => l.name).sort()).toEqual(['.bin', 'express', 'vitest']);
  });
});

const SCRIPT = fileURLToPath(new URL('../wt-setup.mjs', import.meta.url));

/** Markers of an unhandled Node throw — the thing BL-104 is about. */
const STACK_MARKERS = ['Error: Command failed', 'node:internal', '    at ', 'execFileSync'];

describe('wt-setup formatFailure (BL-104)', () => {
  it('prefixes the message with [wt-setup]', () => {
    expect(formatFailure(new WtSetupError("fatal: '/tmp/att-x' is not a working tree"))).toEqual([
      "[wt-setup] fatal: '/tmp/att-x' is not a working tree",
    ]);
  });

  it('keeps a multi-line git stderr readable — one prefixed line each, no stack', () => {
    const err = new WtSetupError(
      "error: the branch 'task-x' is not fully merged\n\nhint: run 'git branch -D task-x'.\n",
    );
    expect(formatFailure(err)).toEqual([
      "[wt-setup] error: the branch 'task-x' is not fully merged",
      "[wt-setup] hint: run 'git branch -D task-x'.",
    ]);
  });

  it('never yields an empty report', () => {
    expect(formatFailure(new WtSetupError(''))).toEqual(['[wt-setup] failed']);
  });
});

describe('wt-setup remove failure reporting, end-to-end (BL-104)', () => {
  let repo;
  let root;

  const runRemove = (args) =>
    spawnSync(process.execPath, [SCRIPT, 'remove', ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });

  beforeEach(() => {
    // realpath: on macOS os.tmpdir() is a symlink, and git reports the resolved path.
    root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'wt-setup-e2e-')));
    repo = path.join(root, 'repo');
    mkdirSync(repo);
    const git = (...args) =>
      spawnSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_SYSTEM: '/dev/null',
          GIT_AUTHOR_NAME: 'wt', GIT_AUTHOR_EMAIL: 'wt@example.com',
          GIT_COMMITTER_NAME: 'wt', GIT_COMMITTER_EMAIL: 'wt@example.com',
        },
      });
    git('init');
    git('commit', '--allow-empty', '-m', 'init');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reports a missing worktree as ONE [wt-setup] line with no Node stack trace', () => {
    const res = runRemove(['ghost', '--root', root]);
    const lines = res.stderr.trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[wt-setup] /);
    expect(lines[0]).toContain('is not a working tree'); // git's own words, not ours
    for (const marker of STACK_MARKERS) expect(res.stderr).not.toContain(marker);
  });

  it('STILL FAILS on a genuinely missing worktree — non-zero exit, no success claim', () => {
    const res = runRemove(['ghost', '--root', root]);
    // The load-bearing half of BL-104: the error must NOT be swallowed and `remove`
    // must NOT become idempotent. A missing worktree is exactly what the message is for.
    expect(res.status).not.toBe(0);
    expect(res.stdout).not.toContain('removed worktree');
  });

  it('still removes a worktree that IS there (success path unchanged)', () => {
    const wt = path.join(root, 'att-real');
    const add = spawnSync('git', ['worktree', 'add', wt, '-b', 'task-real'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(add.status).toBe(0);

    const res = runRemove(['real', '--root', root]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(`[wt-setup] removed worktree ${wt}`);
  });

  it('reports a bad argument the same way — one line, no stack', () => {
    const res = runRemove(['ghost', '--root', root, '--nope']);
    expect(res.status).not.toBe(0);
    expect(res.stderr.trim()).toBe('[wt-setup] unknown argument: --nope');
    for (const marker of STACK_MARKERS) expect(res.stderr).not.toContain(marker);
  });
});
