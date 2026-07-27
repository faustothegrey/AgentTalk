import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  SEVERITY,
  matchesAny,
  diffSnapshots,
  exitCodeFor,
  snapshotRepo,
  takeSnapshot,
  DEFAULT_EXPECT,
} from '../infra-invariant.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../infra-invariant.mjs');

// ---------------------------------------------------------------------------
// Fixtures. Every git bar runs against a REAL throwaway repo: this harness's
// whole job is reading git state, so a mocked `git` would prove nothing about
// the thing under test. The pure-diff bars use synthetic snapshots, because the
// machine's live state is not a fixture (the BL-023 idiom).
// ---------------------------------------------------------------------------

const containers = [];

function makeContainer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-inv-'));
  containers.push(dir);
  return dir;
}

afterEach(() => {
  while (containers.length) {
    const dir = containers.pop();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup; a leaked temp dir must never fail a bar */
    }
  }
});

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

/** A real repo with one commit, plus a fake `origin` so ahead/behind is meaningful. */
function makeRepo() {
  const container = makeContainer();
  const origin = path.join(container, 'origin.git');
  const dir = path.join(container, 'repo');

  execSync(`git init -q --bare "${origin}"`, { stdio: 'pipe' });
  execSync(`git init -q -b master "${dir}"`, { stdio: 'pipe' });
  git('config user.email test@example.com', dir);
  git('config user.name Test', dir);
  git('config commit.gpgsign false', dir);
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'one\n');
  git('add tracked.txt', dir);
  git('commit -q -m initial', dir);
  git(`remote add origin "${origin}"`, dir);
  git('push -q -u origin master', dir);

  return { container, dir, origin };
}

const snapOf = (dir) => takeSnapshot({ repos: { main: dir }, includeGlobal: false });

// ---------------------------------------------------------------------------

describe('BL-087 — glob matching for the additions allowlist', () => {
  it('matches a basename pattern', () => {
    expect(matchesAny('/private/tmp/att-op-7', ['att-op-*'])).toBe(true);
    expect(matchesAny('/private/tmp/att-BL-087', ['att-op-*'])).toBe(false);
  });

  it('matches a multi-segment pattern against the path tail', () => {
    expect(matchesAny('/private/tmp/att-op-7/agentalk-task-abc', ['att-*/agentalk-task-*'])).toBe(true);
  });

  it('does not let `*` leak across a path separator', () => {
    expect(matchesAny('/private/tmp/att-op-7/nested/evil', ['att-*'])).toBe(false);
  });

  it('is false for an empty allowlist', () => {
    expect(matchesAny('anything', [])).toBe(false);
  });
});

describe('BL-087 DoD row 1 — a planted stray worktree is caught', () => {
  it('flags a worktree that does not match the allowlist as warn', () => {
    const { dir, container } = makeRepo();
    const before = snapOf(dir);

    git(`worktree add -q -b stray-branch "${path.join(container, 'stray-wt')}"`, dir);
    const findings = diffSnapshots(before, snapOf(dir), { allowNewWorktrees: [], allowNewBranches: [] });

    const wt = findings.find((f) => f.kind === 'worktree-added');
    expect(wt).toBeDefined();
    expect(wt.severity).toBe(SEVERITY.WARN);
    expect(wt.detail).toContain('stray-wt');
  });

  it('demotes an ALLOWED new worktree to info', () => {
    const { dir, container } = makeRepo();
    const before = snapOf(dir);

    git(`worktree add -q -b task-ok "${path.join(container, 'att-op-1')}"`, dir);
    const findings = diffSnapshots(before, snapOf(dir), {
      allowNewWorktrees: ['att-op-*'],
      allowNewBranches: ['task-*'],
    });

    expect(findings.find((f) => f.kind === 'worktree-added').severity).toBe(SEVERITY.INFO);
    expect(exitCodeFor(findings)).toBe(0);
  });
});

describe('BL-087 DoD row 2 — a planted stray branch is caught', () => {
  it('flags a new branch outside the allowlist as warn', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    git('branch rogue', dir);
    const findings = diffSnapshots(before, snapOf(dir), { allowNewBranches: ['task-*'] });

    const b = findings.find((f) => f.kind === 'branch-added');
    expect(b).toBeDefined();
    expect(b.severity).toBe(SEVERITY.WARN);
    expect(b.detail).toContain('rogue');
  });

  it('demotes an allowed new branch to info', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    git('branch task-BL-999', dir);
    const findings = diffSnapshots(before, snapOf(dir), { allowNewBranches: ['task-*'] });

    expect(findings.find((f) => f.kind === 'branch-added').severity).toBe(SEVERITY.INFO);
  });
});

describe('BL-087 DoD row 3 — REMOVALS are critical, and no allowlist reaches them', () => {
  it('a deleted branch is critical even under a wide-open allowlist', () => {
    const { dir } = makeRepo();
    git('branch doomed', dir);
    const before = snapOf(dir);

    git('branch -D doomed', dir);
    // The most permissive expectation possible. Removals must ignore it entirely.
    const findings = diffSnapshots(before, snapOf(dir), {
      allowNewWorktrees: ['*'],
      allowNewBranches: ['*'],
      allowPorts: [],
      allowProcesses: ['*'],
    });

    const f = findings.find((x) => x.kind === 'branch-removed');
    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.CRITICAL);
    expect(f.detail).toContain('doomed');
    expect(exitCodeFor(findings)).toBe(1);
  });

  it('a removed worktree is critical even under a wide-open allowlist', () => {
    const { dir, container } = makeRepo();
    git(`worktree add -q -b wt-branch "${path.join(container, 'gone-wt')}"`, dir);
    const before = snapOf(dir);

    git(`worktree remove "${path.join(container, 'gone-wt')}"`, dir);
    const findings = diffSnapshots(before, snapOf(dir), {
      allowNewWorktrees: ['*'],
      allowNewBranches: ['*'],
    });

    const f = findings.find((x) => x.kind === 'worktree-removed');
    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.CRITICAL);
  });
});

describe('BL-087 DoD row 4 — a moved HEAD is critical', () => {
  it('flags a new commit on the mainline', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'two\n');
    git('add tracked.txt', dir);
    git('commit -q -m second', dir);
    const findings = diffSnapshots(before, snapOf(dir), DEFAULT_EXPECT);

    const f = findings.find((x) => x.kind === 'head-moved');
    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.CRITICAL);
    expect(exitCodeFor(findings)).toBe(1);
  });

  it('flags upstream divergence (ahead of origin) as critical', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'two\n');
    git('add tracked.txt', dir);
    git('commit -q -m second', dir);
    const findings = diffSnapshots(before, snapOf(dir), DEFAULT_EXPECT);

    expect(findings.find((x) => x.kind === 'upstream-diverged')?.severity).toBe(SEVERITY.CRITICAL);
  });

  it('flags a checkout of a different branch as critical', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    git('checkout -q -b elsewhere', dir);
    const findings = diffSnapshots(before, snapOf(dir), { allowNewBranches: ['*'] });

    expect(findings.find((x) => x.kind === 'branch-changed')?.severity).toBe(SEVERITY.CRITICAL);
  });

  it('flags an unexpectedly modified TRACKED file as critical, but a new untracked file only as info', () => {
    const { dir } = makeRepo();
    const before = snapOf(dir);

    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'dirty\n');
    fs.writeFileSync(path.join(dir, 'brand-new.txt'), 'scratch\n');
    const findings = diffSnapshots(before, snapOf(dir), DEFAULT_EXPECT);

    expect(findings.find((x) => x.kind === 'tracked-file-modified')?.severity).toBe(SEVERITY.CRITICAL);
    expect(findings.find((x) => x.kind === 'untracked-file-added')?.severity).toBe(SEVERITY.INFO);
  });
});

describe('BL-087 DoD row 5 — process/port findings reuse the BL-023 classifier and degrade gracefully', () => {
  const base = { takenAt: 'T0', repos: {}, ports: [], processes: [] };

  it('a NEW unclassifiable listening process is critical', () => {
    const after = {
      ...base,
      takenAt: 'T1',
      processes: [{ pid: '999', ports: ['3600'], cwd: '/somewhere', cmd: 'node orchestrator/index.js' }],
    };
    const findings = diffSnapshots(base, after, DEFAULT_EXPECT);

    const f = findings.find((x) => x.kind === 'process-appeared');
    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.CRITICAL);
  });

  it('a PRE-EXISTING unclassifiable process is only a warn — this run did not cause it', () => {
    const proc = { pid: '999', ports: ['3600'], cwd: '/somewhere', cmd: 'node orchestrator/index.js' };
    const findings = diffSnapshots(
      { ...base, processes: [proc] },
      { ...base, takenAt: 'T1', processes: [proc] },
      DEFAULT_EXPECT
    );

    const f = findings.find((x) => x.kind === 'process-unknown-preexisting');
    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.WARN);
    expect(findings.some((x) => x.severity === SEVERITY.CRITICAL)).toBe(false);
  });

  it('a NEW process running from a task worktree is critical (BL-023 calls it LEAKED)', () => {
    const after = {
      ...base,
      takenAt: 'T1',
      processes: [
        { pid: '42', ports: ['3600'], cwd: '/private/tmp/att-op-1/agentalk-task-x', cmd: 'node orchestrator/index.js' },
      ],
    };
    const f = diffSnapshots(base, after, DEFAULT_EXPECT).find((x) => x.kind === 'process-appeared');
    expect(f.severity).toBe(SEVERITY.CRITICAL);
    expect(f.detail).toMatch(/task worktree/i);
  });

  it('a new listening port outside allowPorts is a warn; an allowed one is info', () => {
    const after = { ...base, takenAt: 'T1', ports: [{ port: 3599, pid: '7' }] };
    expect(diffSnapshots(base, after, { allowPorts: [] }).find((x) => x.kind === 'port-opened').severity).toBe(
      SEVERITY.WARN
    );
    expect(diffSnapshots(base, after, { allowPorts: [3599] }).find((x) => x.kind === 'port-opened').severity).toBe(
      SEVERITY.INFO
    );
  });

  it('records `unavailable` rather than throwing when the inspection tool is missing', () => {
    // Shadow lsof/ps with an empty PATH: the harness must degrade, not fail closed.
    const snap = takeSnapshot({ repos: {}, includeGlobal: true, env: { ...process.env, PATH: '/nonexistent' } });
    expect(snap.ports === 'unavailable' || Array.isArray(snap.ports)).toBe(true);
    expect(snap.processes === 'unavailable' || Array.isArray(snap.processes)).toBe(true);
  });

  it('an unavailable side is never silently compared as if it were empty', () => {
    const findings = diffSnapshots(
      { ...base, processes: 'unavailable' },
      { ...base, takenAt: 'T1', processes: [] },
      DEFAULT_EXPECT
    );
    expect(findings.some((x) => x.kind === 'process-appeared')).toBe(false);
    expect(findings.find((x) => x.kind === 'inspection-unavailable')?.severity).toBe(SEVERITY.WARN);
  });

  it('a repo that cannot be read is a finding, not a crash', () => {
    const snap = takeSnapshot({ repos: { ghost: '/nonexistent/path/xyz' }, includeGlobal: false });
    expect(snap.repos.ghost.unavailable).toBeTruthy();
  });
});

describe('BL-087 DoD row 6 — a clean run is clean', () => {
  it('yields nothing above info and exit 0 when nothing changed', () => {
    const { dir } = makeRepo();
    const findings = diffSnapshots(snapOf(dir), snapOf(dir), DEFAULT_EXPECT);

    expect(findings.filter((f) => f.severity !== SEVERITY.INFO)).toEqual([]);
    expect(exitCodeFor(findings)).toBe(0);
  });
});

describe('BL-087 DoD row 7 — the harness MUTATES NOTHING (the load-bearing safety claim)', () => {
  it('leaves the repo byte-identical across repeated snapshots', () => {
    const { dir } = makeRepo();

    const fingerprint = () => ({
      status: git('status --porcelain', dir),
      branches: git("branch -a '--format=%(refname)'", dir),
      worktrees: git('worktree list --porcelain', dir),
      head: git('rev-parse HEAD', dir),
      reflog: git("reflog '--format=%H|%gs'", dir),
      stash: git('stash list', dir),
      files: fs.readdirSync(dir).sort().join(','),
    });

    const before = fingerprint();
    snapshotRepo(dir);
    snapshotRepo(dir);
    diffSnapshots(snapOf(dir), snapOf(dir), DEFAULT_EXPECT);

    expect(fingerprint()).toEqual(before);
  });

  it('exposes no repair verb — the module must not export anything that writes', () => {
    // A guard against a future "helpful" addition. The whole safety case is that
    // this tool cannot burn the hole it exists to detect.
    const src = fs.readFileSync(scriptPath, 'utf-8');
    for (const forbidden of [
      'worktree prune',
      'worktree remove',
      'branch -D',
      'branch -d',
      'reset --hard',
      'process.kill',
      'checkout',
      'git add',
    ]) {
      expect(src.includes(forbidden), `harness must never contain \`${forbidden}\``).toBe(false);
    }
  });
});

describe('BL-087 DoD row 8 — exit codes are distinct', () => {
  const run = (args, opts = {}) => {
    try {
      const stdout = execFileSync('node', [scriptPath, ...args], {
        encoding: 'utf-8',
        stdio: 'pipe',
        ...opts,
      });
      return { code: 0, stdout };
    } catch (e) {
      return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
    }
  };

  it('exit 0 on a clean check', () => {
    const { dir } = makeRepo();
    const out = path.join(makeContainer(), 'snap.json');
    expect(run(['snapshot', '--out', out, '--repo', `main=${dir}`, '--no-global']).code).toBe(0);
    expect(run(['check', '--before', out, '--repo', `main=${dir}`, '--no-global']).code).toBe(0);
  });

  it('exit 1 when there are findings', () => {
    const { dir } = makeRepo();
    const out = path.join(makeContainer(), 'snap.json');
    run(['snapshot', '--out', out, '--repo', `main=${dir}`, '--no-global']);
    git('branch rogue', dir);

    expect(run(['check', '--before', out, '--repo', `main=${dir}`, '--no-global']).code).toBe(1);
  });

  it('exit 2 on usage/internal error — a crashing harness must never read as clean', () => {
    expect(run(['check', '--before', '/nonexistent/snapshot.json']).code).toBe(2);
    expect(run(['bogus-verb']).code).toBe(2);
    expect(run([]).code).toBe(2);
  });

  it('writes its snapshot outside the repo it measures', () => {
    const { dir } = makeRepo();
    const out = path.join(makeContainer(), 'snap.json');
    run(['snapshot', '--out', out, '--repo', `main=${dir}`, '--no-global']);

    expect(fs.existsSync(out)).toBe(true);
    expect(git('status --porcelain', dir)).toBe('');
  });
});

describe('BL-087 DoD row 9 — --json is parseable and complete', () => {
  it('lists every finding with a severity, and reports the baseline timestamp', () => {
    const { dir } = makeRepo();
    const out = path.join(makeContainer(), 'snap.json');
    execFileSync('node', [scriptPath, 'snapshot', '--out', out, '--repo', `main=${dir}`, '--no-global'], {
      stdio: 'pipe',
    });
    git('branch rogue', dir);

    let raw;
    try {
      raw = execFileSync('node', [scriptPath, 'check', '--before', out, '--repo', `main=${dir}`, '--no-global', '--json'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (e) {
      raw = e.stdout; // exit 1 is expected here — findings exist
    }

    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.findings.length).toBeGreaterThan(0);
    for (const f of parsed.findings) {
      expect(Object.values(SEVERITY)).toContain(f.severity);
      expect(typeof f.kind).toBe('string');
      expect(typeof f.detail).toBe('string');
    }
    // §7 "snapshot drift": a late baseline must be visible in the output.
    expect(typeof parsed.baselineTakenAt).toBe('string');
    expect(parsed.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// BL-090 — the harness must go LOUD, not quiet.
//
// Neither defect was caught by the original 29 bars, because every one of them
// supplies well-formed snapshots of the same repo. These bars supply the two
// shapes that were never exercised: an unreadable repo, and two sides that
// describe DIFFERENT repositories.
// ---------------------------------------------------------------------------

describe('BL-090 Defect A — "we could not look" gates', () => {
  /** Same path string on both sides, so path-mismatch cannot mask the result. */
  function liveAndGone() {
    const { dir } = makeRepo();
    const live = snapOf(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    const gone = snapOf(dir);
    return { live, gone };
  }

  it('D1 — an unavailable BEFORE side is critical, not warn', () => {
    const { live, gone } = liveAndGone();
    const f = diffSnapshots(gone, live, DEFAULT_EXPECT).find((x) => x.kind === 'repo-unavailable');
    expect(f.severity).toBe(SEVERITY.CRITICAL);
  });

  it('D2 — an unavailable AFTER side is critical, not warn', () => {
    const { live, gone } = liveAndGone();
    const f = diffSnapshots(live, gone, DEFAULT_EXPECT).find((x) => x.kind === 'repo-unavailable');
    expect(f.severity).toBe(SEVERITY.CRITICAL);
  });

  it('D3 — BOTH sides unavailable still gates: this is the mistyped-path case', () => {
    // The reported defect. A one-sided-only rule would leave it standing, because a path
    // that was always wrong is unavailable in both snapshots.
    const { gone } = liveAndGone();
    const f = diffSnapshots(gone, gone, DEFAULT_EXPECT).find((x) => x.kind === 'repo-unavailable');
    expect(f.severity).toBe(SEVERITY.CRITICAL);
    expect(f.detail).toMatch(/nothing was checked/i);
  });

  it('D3b — exit stays non-zero for an unavailable repo (contract guard, NOT a test of this fix)', () => {
    // HONEST LABEL: this bar passes against the unfixed source too, because `exitCodeFor`
    // returns 1 for WARN as well as CRITICAL. It therefore proves nothing about the severity
    // change — D3 is what discriminates. Kept only as a guard on the exit contract, and named
    // so no later reader mistakes it for evidence that BL-090 was fixed.
    const { gone } = liveAndGone();
    expect(exitCodeFor(diffSnapshots(gone, gone, DEFAULT_EXPECT))).not.toBe(0);
  });
});

describe('BL-090 Defect B — two snapshots of different repos never diff silently', () => {
  /** Two real repos that differ in HEAD, branch AND upstream — the false trio's ingredients. */
  function twoRepos() {
    const a = makeRepo();
    const b = makeRepo();
    git('checkout -q -b other', b.dir);
    fs.writeFileSync(path.join(b.dir, 'tracked.txt'), 'two\n');
    git('add tracked.txt', b.dir);
    git('commit -q -m second', b.dir);
    return { before: snapOf(a.dir), after: snapOf(b.dir) };
  }

  it('D4 — a path mismatch is exactly one critical finding', () => {
    const { before, after } = twoRepos();
    const hits = diffSnapshots(before, after, DEFAULT_EXPECT).filter((x) => x.kind === 'path-mismatch');
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe(SEVERITY.CRITICAL);
  });

  it('D5 — and it REPLACES the three false criticals rather than adding to them', () => {
    // The measured regression: /Users/fausto/Software/AgentTalk vs /private/tmp/att-op-2 used to
    // yield head-moved + branch-changed + upstream-diverged, all of them fiction.
    const { before, after } = twoRepos();
    const findings = diffSnapshots(before, after, DEFAULT_EXPECT);
    const fiction = findings.filter((x) =>
      ['head-moved', 'branch-changed', 'upstream-diverged'].includes(x.kind)
    );
    expect(fiction).toEqual([]);
  });

  it('D6 — matching paths are unaffected: a real HEAD move is still caught', () => {
    // Parity. The fix must not buy its silence by suppressing genuine findings.
    const { dir } = makeRepo();
    const before = snapOf(dir);
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'changed\n');
    git('add tracked.txt', dir);
    git('commit -q -m second', dir);
    const findings = diffSnapshots(before, snapOf(dir), DEFAULT_EXPECT);
    expect(findings.find((x) => x.kind === 'head-moved')?.severity).toBe(SEVERITY.CRITICAL);
    expect(findings.some((x) => x.kind === 'path-mismatch')).toBe(false);
  });
});

describe('BL-089 — the first porcelain entry keeps its filename', () => {
  it('an unstaged-only first entry is parsed whole, and as unstaged', () => {
    // `git()` trims the whole output, stripping the leading space of line 1 only. Reproduced
    // against the main checkout, whose porcelain is exactly ` M com.fausto…plist`:
    // the name lost its first character and the code " M" (unstaged) read as "M " (staged).
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'modified\n'); // modified, NOT staged
    const entry = snapshotRepo(dir).porcelain[0];
    expect(entry.path).toBe('tracked.txt');
    expect(entry.code).toBe(' M');
  });

  it('a well-formed first entry is left alone', () => {
    // The guard keys on "third character is not a space", so a staged entry must not be shifted.
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'modified\n');
    git('add tracked.txt', dir);
    const entry = snapshotRepo(dir).porcelain[0];
    expect(entry.path).toBe('tracked.txt');
    expect(entry.code).toBe('M ');
  });
});
