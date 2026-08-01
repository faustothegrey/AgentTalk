import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { buildLinkPlan, formatFailure, runStreaming, WtSetupError } from '../wt-setup.mjs';

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

describe('wt-setup runStreaming (BL-115)', () => {
  // Direct unit cover for the exit-status conversion both `create` call sites share.
  // It is deliberately cheap: the `vitest run` site is the same code path as `tsc -b`,
  // and the end-to-end block below proves that path against a real build.
  it('converts a non-zero exit into a WtSetupError naming the label, exit code and cwd', () => {
    const cwd = realpathSync(os.tmpdir());
    expect(() => runStreaming('tsc -b', process.execPath, ['-e', 'process.exit(3)'], cwd)).toThrow(
      WtSetupError,
    );
    try {
      runStreaming('tsc -b', process.execPath, ['-e', 'process.exit(3)'], cwd);
    } catch (err) {
      expect(formatFailure(err)).toEqual([
        `[wt-setup] tsc -b failed (exit 3) in ${cwd} — see its output above`,
      ]);
    }
  });

  it('reports a child that never started as a WtSetupError, not a raw ENOENT', () => {
    let caught;
    try {
      runStreaming('vitest run', path.join(os.tmpdir(), 'no-such-binary-wt-115'), [], os.tmpdir());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WtSetupError);
    expect(formatFailure(caught)[0]).toMatch(/^\[wt-setup] vitest run: /);
  });

  it('returns quietly when the child succeeds', () => {
    expect(() =>
      runStreaming('tsc -b', process.execPath, ['-e', ''], realpathSync(os.tmpdir())),
    ).not.toThrow();
  });
});

describe('wt-setup create, end-to-end (BL-115)', () => {
  // A REAL `create` — real worktree, real branch, real `npx tsc -b` — against a throwaway
  // git repo under a temp dir, never the primary checkout. The compiler is the repo's own
  // installed TypeScript (linked in, so nothing is fetched); the failure is a genuine type
  // error, not a stubbed `npx`, or the test would prove nothing about the path it covers.
  const REAL_NODE_MODULES = fileURLToPath(new URL('../../node_modules/', import.meta.url));
  const GIT_ENV = {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'wt', GIT_AUTHOR_EMAIL: 'wt@example.com',
    GIT_COMMITTER_NAME: 'wt', GIT_COMMITTER_EMAIL: 'wt@example.com',
  };
  const TIMEOUT = 120_000; // a real tsc build, on a cold npx

  let root;
  let repo;

  const git = (...args) =>
    spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } });

  /** Commit the fixture project with `main` as its only source file. */
  const commitProject = (mainTs) => {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'wt-fixture', private: true }));
    writeFileSync(
      path.join(repo, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { composite: true, outDir: 'dist' }, include: ['src'] }),
    );
    mkdirSync(path.join(repo, 'src'), { recursive: true });
    writeFileSync(path.join(repo, 'src', 'main.ts'), mainTs);
    expect(git('add', 'package.json', 'tsconfig.json', 'src/main.ts').status).toBe(0);
    expect(git('commit', '-m', 'fixture').status).toBe(0);
  };

  const runCreate = (args) =>
    spawnSync(process.execPath, [SCRIPT, 'create', ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, ...GIT_ENV },
    });

  beforeEach(() => {
    // realpath: on macOS os.tmpdir() is a symlink, and git reports the resolved path.
    root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'wt-setup-create-')));
    repo = path.join(root, 'repo');
    mkdirSync(repo);
    expect(git('init').status).toBe(0);

    // The fixture's node_modules: real tools, linked (never downloaded), so `wireNodeModules`
    // has something to plan and the worktree's `npx` resolves offline.
    const nm = path.join(repo, 'node_modules');
    mkdirSync(nm);
    for (const dep of ['.bin', 'typescript', 'vitest']) {
      const target = path.join(REAL_NODE_MODULES, dep);
      expect(existsSync(target), `fixture needs ${target} — run npm install`).toBe(true);
      symlinkSync(target, path.join(nm, dep));
    }
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it(
    'reports a genuinely failing build as ONE [wt-setup] line with a non-zero exit and no Node stack',
    () => {
      commitProject('export const n: number = "not a number";\n');
      const res = runCreate(['buildfail', '--root', root]);
      const wt = path.join(root, 'att-buildfail');

      expect(res.status).not.toBe(0);
      // tsc's own diagnostics still reached the terminal: stdio stays INHERITED (BL-115).
      expect(res.stdout).toContain('error TS2322');
      expect(res.stdout).not.toContain('[wt-setup] ready');

      const lines = res.stderr.trim().split('\n').filter((l) => l.startsWith('[wt-setup]'));
      expect(lines).toEqual([`[wt-setup] tsc -b failed (exit 1) in ${wt} — see its output above`]);
      for (const marker of STACK_MARKERS) expect(res.stderr).not.toContain(marker);
    },
    TIMEOUT,
  );

  it(
    'reports a genuinely failing baseline suite the same way — one line, non-zero, output still streamed',
    () => {
      commitProject('export const n: number = 1;\n');
      // The build passes, so this reaches `--baseline`; the fixture has no test files, which
      // is a real non-zero exit from the real vitest binary.
      const res = runCreate(['baselinefail', '--root', root, '--baseline']);
      const wt = path.join(root, 'att-baselinefail');

      expect(res.status).not.toBe(0);
      expect(res.stdout + res.stderr).toContain('No test files found');
      const lines = res.stderr.trim().split('\n').filter((l) => l.startsWith('[wt-setup]'));
      expect(lines).toEqual([`[wt-setup] vitest run failed (exit 1) in ${wt} — see its output above`]);
      for (const marker of STACK_MARKERS) expect(res.stderr).not.toContain(marker);
    },
    TIMEOUT,
  );

  it(
    'still provisions a worktree, wires node_modules and builds on the SUCCESS path',
    () => {
      commitProject('export const n: number = 1;\n');
      const res = runCreate(['ok', '--root', root]);
      const wt = path.join(root, 'att-ok');

      expect(res.status).toBe(0);
      expect(res.stdout).toContain(`[wt-setup] ready: ${wt}  (branch task-ok)`);
      expect(res.stdout).toMatch(/wired node_modules: 3 top-level \+ 0 @agenttalk entries/);
      for (const marker of STACK_MARKERS) expect(res.stderr).not.toContain(marker);

      // The worktree, its branch, its links and the build's own output all really exist.
      expect(existsSync(path.join(wt, 'src', 'main.ts'))).toBe(true);
      expect(existsSync(path.join(wt, 'node_modules', '.bin'))).toBe(true);
      expect(existsSync(path.join(wt, 'dist', 'src', 'main.js'))).toBe(true);
      expect(git('branch', '--list', 'task-ok').stdout).toContain('task-ok');
    },
    TIMEOUT,
  );
});
