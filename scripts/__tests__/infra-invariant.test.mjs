import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  SEVERITY,
  matchesAny,
  matchesWritePath,
  parseWorkableIds,
  diffSnapshots,
  exitCodeFor,
  snapshotRepo,
  takeSnapshot,
  unmatchedDeclarations,
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

// ---------------------------------------------------------------------------
// BL-097 — the OPERATOR write fence.
//
// The charter amendment (`7948ea4`) lets the operator COMMIT to `design/backlog.md` and
// `design/operator/**`. Before this, a HEAD move was critical and "never allowlisted", so the
// seat's first lawful write fired three criticals and gated the next run. These bars pin the
// softening as NARROW: declared paths only, never on an unreadable range, and never over the
// one thing that is authority rather than a write — the agent-workable set.
// ---------------------------------------------------------------------------

const OPERATOR_EXPECT = {
  ...DEFAULT_EXPECT,
  allowWritePaths: ['design/backlog.md', 'design/operator/**'],
};

const criticalsOf = (findings) => findings.filter((f) => f.severity === SEVERITY.CRITICAL);
const kindsOf = (findings) => findings.map((f) => f.kind);

/** A repo with a `design/` tree already committed, so the fixture's own setup is not the delta. */
function makeRepoWithDesign(backlog = '') {
  const repo = makeRepo();
  fs.mkdirSync(path.join(repo.dir, 'design', 'operator'), { recursive: true });
  fs.writeFileSync(path.join(repo.dir, 'design', 'backlog.md'), backlog);
  fs.writeFileSync(path.join(repo.dir, 'design', 'operator', 'notes.md'), 'base\n');
  git('add design', repo.dir);
  git('commit -q -m "design tree"', repo.dir);
  return repo;
}

const item = (id, status, autonomy, blockedBy) =>
  ['<!-- @item', `id: ${id}`, `status: ${status}`]
    .concat(autonomy ? [`autonomy: ${autonomy}`] : [])
    .concat(blockedBy ? [`blocked_by: [${blockedBy}]`] : [])
    .concat(['-->', `- [${status}] ${id} body`, ''])
    .join('\n');

describe('BL-097 DoD row 1 — with no allowlist declared, NOTHING changes', () => {
  // The regression guard for the whole feature: `allowWritePaths` fails closed, so every run that
  // does not declare one is judged exactly as it was before the field existed.
  it('a HEAD move is still critical when allowWritePaths is empty', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'x\n');
    git('add design/backlog.md', dir);
    git('commit -q -m obs', dir);

    const findings = diffSnapshots(before, snapOf(dir), DEFAULT_EXPECT);
    expect(kindsOf(criticalsOf(findings))).toContain('head-moved');
  });
});

describe('BL-097 DoD row 2 — a lawful operator write produces NO critical', () => {
  it('a commit touching only design/backlog.md is info, not critical', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'observed something\n');
    git('add design/backlog.md', dir);
    git('commit -q -m "operator: file an observation"', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    expect(criticalsOf(findings)).toEqual([]);
    expect(kindsOf(findings)).toContain('head-moved-declared');
  });

  it('covers the design/operator/** subtree, including nested paths', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.mkdirSync(path.join(dir, 'design', 'operator', 'runs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'design', 'operator', 'runs', 'o5.md'), 'run log\n');
    git('add design/operator', dir);
    git('commit -q -m "operator: run log"', dir);

    expect(criticalsOf(diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT))).toEqual([]);
  });
});

describe('BL-097 DoD row 3 — one foreign path poisons the range', () => {
  it('a commit touching the backlog AND production code is critical', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.mkdirSync(path.join(dir, 'apps', 'orchestrator', 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'apps', 'orchestrator', 'src', 'server.ts'), 'export const x = 1;\n');
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'cover\n');
    git('add design/backlog.md apps', dir);
    git('commit -q -m "operator: sneak in a code change"', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    const head = findings.find((f) => f.kind === 'head-moved');
    expect(head?.severity).toBe(SEVERITY.CRITICAL);
    expect(head?.detail).toContain('apps/orchestrator/src/server.ts');
    // and it names the offender rather than just saying "HEAD moved"
    expect(head?.detail).not.toContain('design/backlog.md, apps');
  });

  it('the fence is anchored at the repo root — a lookalike tail is NOT allowed', () => {
    expect(matchesWritePath('design/backlog.md', ['design/backlog.md'])).toBe(true);
    expect(matchesWritePath('apps/vendor/design/backlog.md', ['design/backlog.md'])).toBe(false);
    expect(matchesWritePath('design/operator/runs/deep/o5.md', ['design/operator/**'])).toBe(true);
    expect(matchesWritePath('design/bl097-plan.md', ['design/backlog.md'])).toBe(false);
  });
});

describe('BL-097 DoD rows 4 + 11 — an unreadable range is CRITICAL, never vacuously allowed', () => {
  it('a pre-run HEAD outside the captured window gates', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'x\n');
    git('add design/backlog.md', dir);
    git('commit -q -m obs', dir);
    const after = snapOf(dir);
    // Simulate the window overflowing: the baseline commit has scrolled off the end.
    after.repos.main.commits = after.repos.main.commits.slice(0, 1).map((c) => ({ ...c, hash: 'f'.repeat(40) }));

    const findings = diffSnapshots(before, after, OPERATOR_EXPECT);
    const f = findings.find((x) => x.kind === 'head-moved-undetermined');
    expect(f?.severity).toBe(SEVERITY.CRITICAL);
    expect(f?.detail).toContain('not within the last');
  });

  it('a MERGE commit touches no files and must NOT satisfy "every path matches" vacuously', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    git('checkout -q -b side', dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'side\n');
    git('add design/backlog.md', dir);
    git('commit -q -m side', dir);
    git('checkout -q master', dir);
    fs.writeFileSync(path.join(dir, 'design', 'operator', 'notes.md'), 'master\n');
    git('add design/operator/notes.md', dir);
    git('commit -q -m master-side', dir);
    git('merge --no-ff -q -m "merge side" side', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    const f = findings.find((x) => x.kind === 'head-moved-undetermined');
    // Every underlying path here IS allowlisted — only the merge itself is unreadable, and a merge
    // is exactly what the operator may never do. This is the bar that would have been waved past.
    expect(f?.severity).toBe(SEVERITY.CRITICAL);
    expect(f?.detail).toContain('MERGE');
  });
});

describe('BL-097 DoD row 5 — uncommitted edits are fenced per-path', () => {
  it('an edit inside the allowlist is info; one outside it stays critical, in the same run', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'lawful\n');
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'tampered\n');

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    const byPath = (p) => findings.find((f) => f.kind === 'tracked-file-modified' && f.detail.includes(p));
    expect(byPath('design/backlog.md')?.severity).toBe(SEVERITY.INFO);
    expect(byPath('tracked.txt')?.severity).toBe(SEVERITY.CRITICAL);
  });
});

describe('BL-097 DoD row 6 — divergence softens only when the write explains it', () => {
  it('softens on an allowed head move with `behind` unchanged', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'x\n');
    git('add design/backlog.md', dir);
    git('commit -q -m obs', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    expect(findings.find((f) => f.kind === 'upstream-diverged')?.severity).toBe(SEVERITY.INFO);
  });

  it('stays critical when `behind` moved — that is somebody else fetching, not our write', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'x\n');
    git('add design/backlog.md', dir);
    git('commit -q -m obs', dir);
    const after = snapOf(dir);
    after.repos.main.upstream = { ahead: after.repos.main.upstream.ahead, behind: 3 };

    const findings = diffSnapshots(before, after, OPERATOR_EXPECT);
    expect(findings.find((f) => f.kind === 'upstream-diverged')?.severity).toBe(SEVERITY.CRITICAL);
  });
});

describe('BL-097 DoD row 7 — the workable set is NEVER allowlistable', () => {
  it('granting eligibility gates, even though design/backlog.md is a permitted path', () => {
    const { dir } = makeRepoWithDesign(item('BL-001', 'todo', 'eligible'));
    const before = snapOf(dir);
    fs.writeFileSync(
      path.join(dir, 'design', 'backlog.md'),
      item('BL-001', 'todo', 'eligible') + item('BL-002', 'todo', 'eligible'),
    );
    git('add design/backlog.md', dir);
    git('commit -q -m "operator: grant itself a task"', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    const crits = criticalsOf(findings);
    expect(kindsOf(crits)).toEqual(['workable-set-changed']);
    expect(crits[0].detail).toContain('BL-002');
  });

  it('catches the INDIRECT grant too — un-blocking by closing a blocker', () => {
    const base = item('BL-001', 'todo', 'eligible', 'BL-002') + item('BL-002', 'todo');
    const { dir } = makeRepoWithDesign(base);
    const before = snapOf(dir);
    expect(before.repos.main.workable).toEqual([]);

    fs.writeFileSync(
      path.join(dir, 'design', 'backlog.md'),
      item('BL-001', 'todo', 'eligible', 'BL-002') + item('BL-002', 'done'),
    );
    git('add design/backlog.md', dir);
    git('commit -q -m "operator: close the blocker"', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    expect(kindsOf(criticalsOf(findings))).toEqual(['workable-set-changed']);
  });

  it('an unchanged set is silent — the check does not cry wolf on ordinary edits', () => {
    const { dir } = makeRepoWithDesign(item('BL-001', 'todo', 'eligible'));
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), '\nprose only, no header change\n');
    git('add design/backlog.md', dir);
    git('commit -q -m "operator: append an observation"', dir);

    const findings = diffSnapshots(before, snapOf(dir), OPERATOR_EXPECT);
    expect(criticalsOf(findings)).toEqual([]);
  });

  it('a backlog that appears or vanishes mid-run cannot be compared, and gates', () => {
    const { dir } = makeRepoWithDesign(item('BL-001', 'todo', 'eligible'));
    const before = snapOf(dir);
    const after = snapOf(dir);
    after.repos.main.workable = 'skipped';

    expect(kindsOf(criticalsOf(diffSnapshots(before, after, OPERATOR_EXPECT)))).toContain(
      'workable-set-unreadable',
    );
  });
});

describe('BL-097 DoD row 8 — the duplicated parser may not drift', () => {
  it('agrees with parseBacklog/workableBacklogItems on the REAL design/backlog.md', async () => {
    const { parseBacklog, workableBacklogItems } = await import(
      '../../apps/orchestrator/src/backlog.ts'
    );
    const real = fs.readFileSync(path.resolve(__dirname, '../../design/backlog.md'), 'utf-8');

    const viaParser = workableBacklogItems(parseBacklog(real).items).map((i) => i.id).sort();
    expect(parseWorkableIds(real)).toEqual(viaParser);
  });

  it('ignores the @item EXAMPLE inside the schema fence — it declares autonomy: eligible', () => {
    const fenced = ['```', item('BL-NNN', 'todo', 'eligible'), '```', item('BL-001', 'todo', 'eligible')].join('\n');
    expect(parseWorkableIds(fenced)).toEqual(['BL-001']);
  });

  it('fails closed exactly as BL-093 does: unknown autonomy and dangling blockers hide an item', () => {
    expect(parseWorkableIds(item('BL-001', 'todo', 'yes-please'))).toEqual([]);
    expect(parseWorkableIds(item('BL-001', 'todo'))).toEqual([]);
    expect(parseWorkableIds(item('BL-001', 'done', 'eligible'))).toEqual([]);
    expect(parseWorkableIds(item('BL-001', 'todo', 'eligible', 'BL-999'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BL-116 — a declaration that cannot have had any effect must SAY SO.
//
// `loadExpect` merged `--expect` over the defaults and NOTHING ever inspected the result, so a
// mistyped key or a pattern matching nothing was accepted in silence — indistinguishable from the
// legitimate "you declared nothing" state, which fails closed. Two consecutive operator runs then
// reported a `critical` the run had not caused.
//
// These bars pin the fix as NARROW in three directions at once:
//   - the matcher is NOT loosened (a trailing `/` stays end-to-end anchored);
//   - only the DECLARATION is inspected, never the merged object (the defaults ship patterns of
//     their own, so inspecting the merge would fire on a byte-identical run — the same defect one
//     level up, and DoD row 6 above is its untouched contract);
//   - `warn` is the ceiling, because a `critical` gates the next operator run.
// ---------------------------------------------------------------------------

/** How the CLI calls it: the merged object judges the run, the raw declaration is judged itself. */
const withDeclaration = (before, after, declaration) =>
  diffSnapshots(before, after, { ...DEFAULT_EXPECT, ...declaration }, declaration);

const unmatchedOf = (findings) =>
  findings.filter((f) => f.kind === 'expect-key-unknown' || f.kind === 'expect-pattern-unmatched');

describe('BL-116 DoD row 1 — the matcher is NOT loosened', () => {
  it('a trailing slash is still not an implicit /** — the fence keeps its end-to-end anchoring', () => {
    // The tempting shortcut, and the one thing this item forbids: guessing the author's intent
    // here would quietly WIDEN the operator write fence, which is what the fence exists to hold.
    expect(matchesWritePath('design/operator/.hmp-launched.json', ['design/operator/'])).toBe(false);
    expect(matchesWritePath('design/operator/.hmp-launched.json', ['design/operator/**'])).toBe(true);
  });
});

describe('BL-116 DoD row 2 — the live hmp2 case warns', () => {
  /** The ledger file exists and is TRACKED before the run, exactly as it was on hmp2. */
  function repoWithLedger() {
    const { dir } = makeRepoWithDesign();
    fs.writeFileSync(path.join(dir, 'design', 'operator', '.hmp-launched.json'), '{"pid":1}\n');
    git('add design/operator', dir);
    git('commit -q -m "launch ledger"', dir);
    return dir;
  }

  it('allowWritePaths ["design/operator/"] against a write to design/operator/.hmp-launched.json', () => {
    const dir = repoWithLedger();
    const before = snapOf(dir);
    fs.writeFileSync(path.join(dir, 'design', 'operator', '.hmp-launched.json'), '{"pid":2}\n');

    const findings = withDeclaration(before, snapOf(dir), { allowWritePaths: ['design/operator/'] });
    const f = findings.find((x) => x.kind === 'expect-pattern-unmatched');

    expect(f).toBeDefined();
    expect(f.severity).toBe(SEVERITY.WARN);
    expect(f.detail).toContain('declared but never matched');
    expect(f.detail).toContain('design/operator/');
    // "declared but never matched", never "invalid": a legitimately unused allowance is a real
    // case this check cannot tell apart from a typo, and it must not pretend it can.
    expect(f.detail).not.toMatch(/invalid/i);
    // It names what it DID see, which is the whole diagnosis hmp2 had to reverse-engineer.
    expect(f.detail).toContain('.hmp-launched.json');
  });

  it('explains the run\'s critical rather than replacing or suppressing it', () => {
    const dir = repoWithLedger();
    const before = snapOf(dir);
    fs.writeFileSync(path.join(dir, 'design', 'operator', '.hmp-launched.json'), '{"pid":2}\n');

    const findings = withDeclaration(before, snapOf(dir), { allowWritePaths: ['design/operator/'] });
    expect(kindsOf(criticalsOf(findings))).toContain('tracked-file-modified');
  });

  it('and the CORRECTED declaration is silent — no cry-wolf on a declaration that worked', () => {
    const dir = repoWithLedger();
    const before = snapOf(dir);
    fs.writeFileSync(path.join(dir, 'design', 'operator', '.hmp-launched.json'), '{"pid":2}\n');

    const findings = withDeclaration(before, snapOf(dir), { allowWritePaths: ['design/operator/**'] });
    expect(unmatchedOf(findings)).toEqual([]);
    expect(criticalsOf(findings)).toEqual([]);
    expect(exitCodeFor(findings)).toBe(0);
  });
});

describe('BL-116 DoD row 3 — a mistyped KEY warns (the same bug one level up)', () => {
  const clean = () => {
    const { dir } = makeRepoWithDesign();
    return [snapOf(dir), snapOf(dir)];
  };

  for (const key of ['allowWritePath', 'allowedWritePaths', 'allow_write_paths']) {
    it(`\`${key}\` merges cleanly, contributes nothing, and now says so`, () => {
      const [before, after] = clean();
      const findings = withDeclaration(before, after, { [key]: ['design/operator/**'] });
      const f = findings.find((x) => x.kind === 'expect-key-unknown');

      expect(f).toBeDefined();
      expect(f.severity).toBe(SEVERITY.WARN);
      expect(f.detail).toContain(key);
      expect(f.detail).toContain('declared but never matched');
      expect(f.detail).not.toMatch(/invalid/i);
    });
  }

  it('names the keys that DO exist, so the fix does not need a source read', () => {
    const [before, after] = clean();
    const f = withDeclaration(before, after, { allowWritePath: [] }).find(
      (x) => x.kind === 'expect-key-unknown',
    );
    for (const known of Object.keys(DEFAULT_EXPECT)) expect(f.detail).toContain(known);
  });

  it('a correctly spelled key is never reported as unknown', () => {
    const [before, after] = clean();
    const findings = withDeclaration(before, after, { allowPorts: [3600] });
    expect(findings.some((x) => x.kind === 'expect-key-unknown')).toBe(false);
  });
});

describe('BL-116 DoD row 4 — `warn` is the CEILING: this check never gates a run', () => {
  it('every finding it produces is a warn, even when the whole declaration is wrong', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    const findings = withDeclaration(before, snapOf(dir), {
      allowWritePath: ['design/operator/**'],
      allowWritePaths: ['design/operator/'],
      allowNewWorktrees: ['nope-*'],
      allowNewBranches: ['nope-*'],
      allowProcesses: ['nope-*'],
    });

    const mine = unmatchedOf(findings);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((f) => f.severity === SEVERITY.WARN)).toBe(true);
    expect(criticalsOf(findings)).toEqual([]);
  });

  it('a legitimately UNUSED allowance is tolerated as a warn — the accepted false positive', () => {
    // You declared a path the run happened not to write. The harness cannot distinguish this from
    // a typo, which is precisely why it is a warn and why the wording is "never matched".
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'operator', 'notes.md'), 'ran\n');

    const findings = withDeclaration(before, snapOf(dir), {
      allowWritePaths: ['design/operator/**', 'design/backlog.md'],
    });
    const mine = unmatchedOf(findings);
    expect(mine).toHaveLength(1);
    expect(mine[0].severity).toBe(SEVERITY.WARN);
    expect(mine[0].detail).toContain('design/backlog.md');
    expect(criticalsOf(findings)).toEqual([]);
  });
});

describe('BL-116 DoD row 5 — only the DECLARATION is inspected, never the merged defaults', () => {
  it('a byte-identical run with no declaration stays clean (DoD row 6, from the other side)', () => {
    const { dir } = makeRepoWithDesign();
    const findings = diffSnapshots(snapOf(dir), snapOf(dir), DEFAULT_EXPECT);

    expect(unmatchedOf(findings)).toEqual([]);
    expect(findings.filter((f) => f.severity !== SEVERITY.INFO)).toEqual([]);
    expect(exitCodeFor(findings)).toBe(0);
  });

  it('DEFAULT_EXPECT itself carries patterns that match nothing on a clean run — and is exempt', () => {
    // The trap this bar exists to hold: the defaults are NOT a declaration. Inspecting the merged
    // object would fire on a run where nothing whatsoever happened.
    expect(DEFAULT_EXPECT.allowNewWorktrees.length).toBeGreaterThan(0);
    expect(DEFAULT_EXPECT.allowNewBranches.length).toBeGreaterThan(0);

    const { dir } = makeRepoWithDesign();
    expect(unmatchedOf(diffSnapshots(snapOf(dir), snapOf(dir), DEFAULT_EXPECT, null))).toEqual([]);
  });

  it('an empty declaration says nothing — "you declared nothing" is a legitimate state', () => {
    const { dir } = makeRepoWithDesign();
    expect(unmatchedOf(withDeclaration(snapOf(dir), snapOf(dir), {}))).toEqual([]);
  });
});

describe('BL-116 DoD row 6 — every pattern field is covered, with its own matcher', () => {
  it('allowNewWorktrees / allowNewBranches: the pattern that matched is silent, the other warns', () => {
    const { dir, container } = makeRepo();
    const before = snapOf(dir);
    git(`worktree add -q -b task-ok "${path.join(container, 'att-op-1')}"`, dir);

    const findings = withDeclaration(before, snapOf(dir), {
      allowNewWorktrees: ['att-op-*', 'att-typo-*'],
      allowNewBranches: ['task-*'],
    });
    const mine = unmatchedOf(findings);

    expect(mine).toHaveLength(1);
    expect(mine[0].detail).toContain('att-typo-*');
    expect(mine[0].severity).toBe(SEVERITY.WARN);
  });

  it('allowProcesses is judged against the commands this run actually watched', () => {
    const base = { takenAt: 'T0', repos: {}, ports: [], processes: [] };
    const after = {
      ...base,
      takenAt: 'T1',
      processes: [{ pid: '999', ports: ['3600'], cwd: '/somewhere', cmd: 'node orchestrator/index.js' }],
    };

    // The check re-tests each pattern with the SAME matcher the diff used, so the two verdicts
    // cannot drift: a pattern is "matched" here exactly when it silenced a finding there.
    const hit = withDeclaration(base, after, { allowProcesses: ['node orchestrator/*'] });
    expect(unmatchedOf(hit)).toEqual([]);
    expect(hit.some((x) => x.kind === 'process-appeared')).toBe(false);

    // `*` never crosses a path separator, so this one silences nothing — and now says so.
    const miss = withDeclaration(base, after, { allowProcesses: ['*orchestrator*'] });
    expect(unmatchedOf(miss)).toHaveLength(1);
    expect(unmatchedOf(miss)[0].severity).toBe(SEVERITY.WARN);
    expect(miss.some((x) => x.kind === 'process-appeared')).toBe(true);
  });

  it('a commit range is a write candidate too, not just an uncommitted edit', () => {
    const { dir } = makeRepoWithDesign();
    const before = snapOf(dir);
    fs.appendFileSync(path.join(dir, 'design', 'backlog.md'), 'observed\n');
    git('add design/backlog.md', dir);
    git('commit -q -m "operator: file an observation"', dir);

    const findings = withDeclaration(before, snapOf(dir), { allowWritePaths: ['design/backlog.md'] });
    expect(unmatchedOf(findings)).toEqual([]);
    expect(criticalsOf(findings)).toEqual([]);
  });
});

describe('BL-116 DoD row 7 — the checker is pure and degrades quietly', () => {
  it('says nothing for a missing, null or non-object declaration', () => {
    expect(unmatchedDeclarations(null, {})).toEqual([]);
    expect(unmatchedDeclarations(undefined, {})).toEqual([]);
    expect(unmatchedDeclarations('not-an-object', {})).toEqual([]);
    expect(unmatchedDeclarations({})).toEqual([]);
  });

  it('tolerates a non-array pattern value rather than throwing', () => {
    expect(() => unmatchedDeclarations({ allowWritePaths: 'design/operator/**' }, {})).not.toThrow();
  });
});

describe('BL-116 DoD row 8 — end to end through the CLI', () => {
  const runCheck = (args) => {
    try {
      return { code: 0, stdout: execFileSync('node', [scriptPath, ...args], { encoding: 'utf-8', stdio: 'pipe' }) };
    } catch (e) {
      return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
    }
  };

  const expectFile = (declaration) => {
    const file = path.join(makeContainer(), 'expect.json');
    fs.writeFileSync(file, JSON.stringify(declaration));
    return file;
  };

  it('a mistyped key surfaces in --json as a warn, and exit 1 (exitCodeFor is unchanged)', () => {
    const { dir } = makeRepoWithDesign();
    const snap = path.join(makeContainer(), 'snap.json');
    execFileSync('node', [scriptPath, 'snapshot', '--out', snap, '--repo', `main=${dir}`, '--no-global'], {
      stdio: 'pipe',
    });

    const res = runCheck([
      'check', '--before', snap, '--repo', `main=${dir}`, '--no-global', '--json',
      '--expect', expectFile({ allowWritePath: ['design/operator/**'] }),
    ]);
    const parsed = JSON.parse(res.stdout);
    const f = parsed.findings.find((x) => x.kind === 'expect-key-unknown');

    expect(f?.severity).toBe(SEVERITY.WARN);
    expect(f.detail).toContain('declared but never matched');
    expect(parsed.findings.some((x) => x.severity === SEVERITY.CRITICAL)).toBe(false);
    // The accepted consequence: `exitCodeFor` already returns 1 for a warn, so an otherwise clean
    // bracket now exits 1 instead of 0. It is OUT OF SCOPE here and deliberately not softened.
    expect(res.code).toBe(1);
    expect(parsed.exitCode).toBe(1);
  });

  it('a well-formed --expect file on a clean run still exits 0', () => {
    const { dir } = makeRepoWithDesign();
    const snap = path.join(makeContainer(), 'snap.json');
    execFileSync('node', [scriptPath, 'snapshot', '--out', snap, '--repo', `main=${dir}`, '--no-global'], {
      stdio: 'pipe',
    });

    const res = runCheck([
      'check', '--before', snap, '--repo', `main=${dir}`, '--no-global',
      '--expect', expectFile({ allowPorts: [3600] }),
    ]);
    expect(res.code).toBe(0);
  });
});
