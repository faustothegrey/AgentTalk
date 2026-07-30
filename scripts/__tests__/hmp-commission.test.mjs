import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

import {
  DISCRIMINATOR,
  REFUSAL,
  CHARTER,
  authorizationLineFor,
  parseCommission,
  isAuthorizationFile,
  authorizationPathFor,
  findsLaunchInstruction,
  makeGitIo,
  sha256,
  verifyCommission,
  realPreflight,
  launch,
  recordLaunch,
  defaultClientRoot,
  primaryRoot,
  LAUNCH_LEDGER,
} from '../hmp-commission.mjs';

/**
 * These bars drive REAL git. The load-bearing property of the verifier is that it reads the
 * brief, bar and config out of the OBJECT STORE at a given sha rather than off disk — a
 * stubbed git would leave exactly that untested while looking thorough.
 *
 * BL-101's lesson is also in force here: no `runIf` guard on the condition under test. A skip
 * in a test that exists to prove a path resolves is a failure, not a neutral outcome.
 */

const RUN = 'hmp1';
let repo;
let sha;
let sideSha;
let sandboxDir;

const git = (args, cwd = repo) =>
  execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function write(rel, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

const BRIEF = `# Run ${RUN} — channel proof

Goal: report the current HEAD sha and the suite's pass/skip counts. Change no files.

${authorizationLineFor(RUN)}
`;

const BAR = '# Bar for hmp1\n\n1. worktree clean and HEAD unmoved\n';

let CONFIG;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hmp-commission-'));
  // A real sandbox that exists and carries governance — the happy path now requires both.
  sandboxDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hmp-sandbox-')), `att-op-${RUN}`);
  fs.mkdirSync(sandboxDir, { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, 'CLAUDE.md'), '# governance inherits here\n');
  CONFIG = {
    agents: [{ id: 'worker-1', provider: 'claude', workdir: sandboxDir }],
    caps: { meter: { url: 'http://127.0.0.1:9899/usage', provider: 'claude', maxPercentDelta: 5 } },
  };
  git(['init', '-b', 'master']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);

  write('design/operator/hmp1.authorized', `${authorizationLineFor(RUN)}\n`);
  write('design/operator/hmp1-brief.md', BRIEF);
  write('design/operator/hmp1-bar.md', BAR);
  write(`design/operator/${RUN}.config.json`, JSON.stringify(CONFIG, null, 2));
  git(['add', 'design/operator/hmp1.authorized', 'design/operator/hmp1-brief.md', 'design/operator/hmp1-bar.md', `design/operator/${RUN}.config.json`]);
  git(['commit', '-m', 'commission fixtures']);
  sha = git(['rev-parse', 'HEAD']);

  // A commit that exists but is NOT reachable from master — the shape a LAN forger with local
  // read access would have, and the case `sha-not-on-master` exists for.
  git(['checkout', '-q', '-b', 'side']);
  write('design/operator/hmp1-brief.md', BRIEF + '\nside-branch edit\n');
  git(['add', 'design/operator/hmp1-brief.md']);
  git(['commit', '-m', 'side']);
  sideSha = git(['rev-parse', 'HEAD']);
  git(['checkout', '-q', 'master']);
});

afterAll(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true });
});

const barHash = () => sha256(Buffer.from(BAR));

function commission(overrides = {}) {
  const f = {
    run: RUN,
    brief: path.join(repo, 'design/operator/hmp1-brief.md'),
    'repo-sha': sha,
    'bar-sha256': barHash(),
    port: String(CHARTER.port),
    sandbox: `att-op-${RUN}`,
    ...overrides,
  };
  const pairs = Object.entries(f)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return `${DISCRIMINATOR} | ${pairs.join(' | ')}`;
}

/** No critical, nothing launched yet — the neutral world, so a refusal is about the message. */
const clean = () => ({
  repoRoot: repo,
  io: makeGitIo(repo),
  preflight: () => ({ criticals: 0 }),
  launchedRuns: () => [],
});

const verify = (text, world = {}) => verifyCommission({ text, ...clean(), ...world });

describe('parseCommission', () => {
  it('accepts a well-formed commission', () => {
    const r = parseCommission(commission());
    expect(r.ok).toBe(true);
    expect(r.commission.run).toBe(RUN);
    expect(r.commission.port).toBe(3600);
  });

  it('refuses text with no discriminator', () => {
    expect(parseCommission('please launch hmp1 for me').reason).toBe(REFUSAL.MALFORMED);
  });

  it('refuses an unknown field rather than ignoring it', () => {
    const r = parseCommission(`${commission()} | authorized-by=PO`);
    expect(r.reason).toBe(REFUSAL.MALFORMED);
    expect(r.detail).toMatch(/unknown field: authorized-by/);
  });

  it('refuses a missing field', () => {
    const r = parseCommission(commission({ sandbox: undefined }));
    expect(r.reason).toBe(REFUSAL.MALFORMED);
    expect(r.detail).toMatch(/missing field/);
  });

  it('refuses a duplicated field', () => {
    const r = parseCommission(`${commission()} | port=3500`);
    expect(r.reason).toBe(REFUSAL.MALFORMED);
    expect(r.detail).toMatch(/duplicate field: port/);
  });

  it('refuses a non-hex repo-sha', () => {
    expect(parseCommission(commission({ 'repo-sha': 'HEAD' })).reason).toBe(REFUSAL.MALFORMED);
  });

  it('ignores trailing operator instructions — they steer Hermes, they are not verified', () => {
    const text = `${commission()}\nRUN EXACTLY THIS: node scripts/hmp-commission.mjs --text-file -\n`;
    expect(parseCommission(text).ok).toBe(true);
  });
});

describe('isAuthorizationFile — a discrete artifact, not a phrase', () => {
  it('accepts a file whose entire content is the line', () => {
    expect(isAuthorizationFile(`${authorizationLineFor(RUN)}\n`, RUN)).toBe(true);
    expect(isAuthorizationFile(`  ${authorizationLineFor(RUN)}  `, RUN)).toBe(true);
  });

  it('THE QUOTED-EXAMPLE BAR: a document that quotes the line does NOT authorize', () => {
    // This is the refutation that killed the previous mechanism, and it was found by RUNNING the
    // CLI, not by reading the code. The hmp1 brief's whole point is that it is NOT authorized —
    // and it quotes the required line in a fenced block to say what the PO must add. A
    // line-anchored matcher accepted it. Stripping code fences would not have saved it either:
    // an indented block or a blockquote quotes the line just as well.
    const doc = [
      '# Run hmp1 — NOT YET AUTHORIZED',
      '',
      'The PO must add exactly this line:',
      '',
      '```',
      authorizationLineFor(RUN),
      '```',
      '',
      'Until then this run refuses.',
    ].join('\n');
    expect(isAuthorizationFile(doc, RUN)).toBe(false);
  });

  it('refuses anything else in the file, however innocuous', () => {
    expect(isAuthorizationFile(`${authorizationLineFor(RUN)}\n# note: approved by phone\n`, RUN)).toBe(false);
  });

  it('does not accept authorization for a different run id', () => {
    expect(isAuthorizationFile(authorizationLineFor('hmp2'), RUN)).toBe(false);
  });

  it('names the file by convention, per run', () => {
    expect(authorizationPathFor(RUN)).toBe('design/operator/hmp1.authorized');
  });
});

describe('findsLaunchInstruction — the recursion fence', () => {
  it('catches a brief that commissions another run', () => {
    expect(findsLaunchInstruction('then launch another session on port 3600')).toBeTruthy();
    expect(findsLaunchInstruction('run node scripts/launcher.mjs cfg.json')).toBeTruthy();
    expect(findsLaunchInstruction(`send an ${DISCRIMINATOR} message`)).toBeTruthy();
  });

  it('leaves an ordinary read-only goal alone', () => {
    expect(findsLaunchInstruction('report HEAD and the suite counts; change no files')).toBeNull();
  });
});

describe('realPreflight — the mapping that the injected seam hid', () => {
  /**
   * These exist because the first implementation was a NO-OP and every bar above still passed:
   * `verifyCommission` takes `preflight` as a parameter, so the stub was tested and the real
   * function never ran. The lesson generalises past this file — an injected seam moves the
   * untested surface, it does not remove it. So the runner is injected one level lower and the
   * exit-code mapping is pinned directly.
   */
  it('a clean sweep is zero criticals', () => {
    expect(realPreflight({ runner: () => ({ code: 0, output: 'Sweep clean' }) })).toEqual({
      criticals: 0,
      detail: null,
    });
  });

  it('a non-zero sweep is a critical, and counts the flagged listeners', () => {
    const r = realPreflight({
      runner: () => ({ code: 1, output: '[LEAKED] PID 1 ...\n[UNKNOWN] PID 2 ...\n' }),
    });
    expect(r.criticals).toBe(2);
    expect(r.detail).toMatch(/sweep exit 1/);
  });

  it('a non-zero sweep with no parseable tags still counts as one critical, never zero', () => {
    expect(realPreflight({ runner: () => ({ code: 1, output: 'something went sideways' }) }).criticals).toBe(1);
  });

  it('FAILS CLOSED when the sweep cannot run at all', () => {
    const r = realPreflight({
      runner: () => {
        throw new Error('ENOENT');
      },
    });
    expect(r.criticals).toBe(1);
    expect(r.detail).toMatch(/could not run/);
  });
});


describe('the sandbox must exist and be governed', () => {
  it('refuses when the workdir does not exist', () => {
    const r = verify(commission(), { existsSync: () => false });
    expect(r.reason).toBe(REFUSAL.WORKDIR_MISSING);
  });

  it('THE GOVERNANCE BAR: refuses a sandbox with no CLAUDE.md', () => {
    // Runbook precondition 3 and the whole thesis of the worktree MANDATE: without it the worker
    // has no rules. Launching an UNGOVERNED worker is the one thing the sandbox exists to prevent,
    // so this refuses rather than warns.
    const r = verify(commission(), { existsSync: (p) => !String(p).endsWith('CLAUDE.md') });
    expect(r.reason).toBe(REFUSAL.GOVERNANCE_MISSING);
    expect(r.detail).toMatch(/no rules/);
  });

  it('accepts when both are present, and reports the workdir', () => {
    const r = verify(commission());
    expect(r.ok).toBe(true);
    expect(r.workdir).toBe(sandboxDir);
  });
});

describe('launch — the acknowledgement, not the result', () => {
  const okResult = () => verify(commission());

  it('records the launch BEFORE spawning — a crash between the two must not permit a replay', () => {
    const order = [];
    launch(okResult(), {
      repoRoot: repo,
      clientRoot: defaultClientRoot(),
      record: () => order.push('record'),
      spawn: () => { order.push('spawn'); return 4242; },
    });
    expect(order).toEqual(['record', 'spawn']);
  });

  it('launches the CLIENT launcher, detached, with a config written from the git blob', () => {
    let seen;
    const r = launch(okResult(), {
      repoRoot: repo,
      clientRoot: defaultClientRoot(),
      record: () => {},
      spawn: (launcher, configPath) => { seen = { launcher, configPath }; return 99; },
    });
    expect(seen.launcher).toMatch(/agentalk-mcp-client\/scripts\/launcher\.mjs$/);
    // The config handed to the launcher is a TEMP file written from the committed blob — never
    // the on-disk path, so what runs is the reviewed content.
    expect(seen.configPath).not.toContain(repo);
    expect(JSON.parse(fs.readFileSync(seen.configPath, 'utf-8')).agents[0].workdir).toBe(sandboxDir);
    expect(r.pid).toBe(99);
    fs.rmSync(seen.configPath, { force: true });
  });

  it('hands the spawner a LOG PATH — a detached launch that discards output is undiagnosable', () => {
    // The first live launch used stdio ['ignore','ignore','ignore'] and died leaving nothing but an
    // absent artifact; the cause had to be reproduced by hand to be seen. "Detached" is the reason
    // to KEEP the log, not to drop it — nobody is watching the terminal.
    let seenLog;
    const r = launch(verify(commission()), {
      repoRoot: repo,
      clientRoot: defaultClientRoot(),
      record: () => {},
      spawn: (_l, _c, _cr, logPath) => { seenLog = logPath; return 7; },
    });
    expect(seenLog).toBeTruthy();
    expect(seenLog).toMatch(/hmp1-launch\.log$/);
    expect(r.logPath).toBe(seenLog);
  });

  it('the ledger lives in the PRIMARY checkout — replay protection must survive worktree cleanup', () => {
    // A ledger under /tmp/att-<id> vanishes with `wt-setup remove`, and `already-launched` then
    // reads as "never launched". Protection that evaporates on cleanup is not protection.
    const primary = primaryRoot();
    expect(primary).toBeTruthy();
    // These bars run from a linked worktree during development, so this is a real distinction
    // here rather than an incidentally-true one.
    expect(primary).not.toMatch(/att-hmp2/);
    expect(fs.statSync(path.join(primary, '.git')).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(primary, 'AGENT.md'))).toBe(true);
    expect(LAUNCH_LEDGER).toBe('design/operator/.hmp-launched.json');
  });

  it('the ledger is append-only and refuses to overwrite an unreadable one', () => {
    const ledgerPath = path.join(repo, LAUNCH_LEDGER);
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    recordLaunch(repo, { run: 'a' });
    recordLaunch(repo, { run: 'b' });
    expect(JSON.parse(fs.readFileSync(ledgerPath, 'utf-8')).launched.map((e) => e.run)).toEqual(['a', 'b']);
    fs.writeFileSync(ledgerPath, 'not json');
    // Silently resetting would re-open `already-launched` and permit a replay.
    expect(() => recordLaunch(repo, { run: 'c' })).toThrow(/unreadable/);
    fs.rmSync(ledgerPath, { force: true });
  });
});

describe('verifyCommission', () => {
  it('accepts a fully lawful commission', () => {
    const r = verify(commission());
    expect(r.reason).toBe(null);
    expect(r.ok).toBe(true);
    expect(r.barSha256).toBe(barHash());
    expect(r.config.caps.meter.provider).toBe('claude');
  });

  it('refuses a port that is not the charter port', () => {
    const r = verify(commission({ port: '3500' }));
    expect(r.reason).toBe(REFUSAL.CHARTER_MISMATCH);
    expect(r.detail).toMatch(/3500/);
  });

  it('refuses a sandbox outside att-op-*', () => {
    expect(verify(commission({ sandbox: 'att-hmp1' })).reason).toBe(REFUSAL.CHARTER_MISMATCH);
    expect(verify(commission({ sandbox: 'att-op-hmp1/../../etc' })).reason).toBe(REFUSAL.CHARTER_MISMATCH);
  });

  it('refuses a brief outside the governed repo', () => {
    const r = verify(commission({ brief: '/etc/passwd' }));
    expect(r.reason).toBe(REFUSAL.BRIEF_OUTSIDE_REPO);
  });

  it('THE SYMLINK BAR: a brief reached through a symlinked repo path is still inside the repo', () => {
    // The defect this pins was found by running the CLI, never by these bars: on macOS `/tmp` is
    // a symlink to `/private/tmp`, so the repo root resolved real while the commissioned brief
    // stayed symlinked, and `path.relative` produced `../../tmp/…` — refusing a brief plainly
    // inside the repo. It does not reproduce on Linux, so only an explicit symlink can catch it.
    const link = path.join(os.tmpdir(), `hmp-link-${process.pid}`);
    fs.rmSync(link, { force: true });
    fs.symlinkSync(repo, link);
    try {
      const viaLink = verify(commission({ brief: path.join(link, 'design/operator/hmp1-brief.md') }));
      expect(viaLink.reason).toBe(null);
      expect(viaLink.ok).toBe(true);

      // And the mirror: a real brief path against a symlinked repoRoot.
      const mirrored = verifyCommission({
        text: commission(),
        ...clean(),
        repoRoot: link,
      });
      expect(mirrored.ok).toBe(true);
    } finally {
      fs.rmSync(link, { force: true });
    }
  });

  it('refuses a traversal that climbs out of the repo', () => {
    const r = verify(commission({ brief: path.join(repo, 'design/../../elsewhere/brief.md') }));
    expect(r.reason).toBe(REFUSAL.BRIEF_OUTSIDE_REPO);
  });

  it('refuses a sha that is not a commit', () => {
    const blobSha = git(['rev-parse', `${sha}:design/operator/hmp1-bar.md`]);
    expect(verify(commission({ 'repo-sha': blobSha })).reason).toBe(REFUSAL.SHA_NOT_A_COMMIT);
  });

  it('refuses a sha that does not exist at all', () => {
    expect(verify(commission({ 'repo-sha': 'f'.repeat(40) })).reason).toBe(REFUSAL.SHA_NOT_A_COMMIT);
  });

  it('THE FORGER BAR: refuses a real commit that is not reachable from master', () => {
    // The check that does real work against the actual adversary. A LAN forger can compose any
    // message; it cannot make a commit an ancestor of master. This makes the PO's merge the
    // authorization act.
    const r = verify(commission({ 'repo-sha': sideSha }));
    expect(r.reason).toBe(REFUSAL.SHA_NOT_ON_MASTER);
  });

  it('refuses a brief that is not committed at that sha', () => {
    const r = verify(commission({ brief: path.join(repo, 'design/operator/never-committed.md') }));
    expect(r.reason).toBe(REFUSAL.BRIEF_NOT_COMMITTED);
  });

  it('reads the brief from git, NOT from the working tree', () => {
    // The distinction §4 as written would have missed. Strip the authorization from disk; the
    // commission must still verify, because the committed text is the only text that counts.
    const abs = path.join(repo, 'design/operator/hmp1-brief.md');
    const onDisk = fs.readFileSync(abs, 'utf-8');
    fs.writeFileSync(abs, '# gutted — no authorization here\n');
    try {
      expect(verify(commission()).ok).toBe(true);
    } finally {
      fs.writeFileSync(abs, onDisk);
    }
  });

  it('refuses when no .authorized file is committed', () => {
    // The brief may say whatever it likes; without the discrete artifact there is no authorization.
    write('design/operator/unauth-brief.md', '# no authorization\n\nGoal: report HEAD.\n');
    write('design/operator/unauth-bar.md', BAR);
    write('design/operator/unauth.config.json', JSON.stringify(CONFIG, null, 2));
    git(['add', 'design/operator/unauth-brief.md', 'design/operator/unauth-bar.md', 'design/operator/unauth.config.json']);
    git(['commit', '-m', 'unauthorized fixture']);
    const s = git(['rev-parse', 'HEAD']);
    const r = verify(
      commission({
        run: 'unauth',
        brief: path.join(repo, 'design/operator/unauth-brief.md'),
        'repo-sha': s,
        sandbox: 'att-op-unauth',
      }),
    );
    expect(r.reason).toBe(REFUSAL.NO_PO_AUTHORIZATION);
  });

  it('refuses a bar hash that does not match the committed bar', () => {
    const r = verify(commission({ 'bar-sha256': '0'.repeat(64) }));
    expect(r.reason).toBe(REFUSAL.BAR_HASH_MISMATCH);
    expect(r.detail).toMatch(/committed .* !== commissioned/);
  });

  it('refuses a recursive brief', () => {
    write('design/operator/rec-brief.md', `# rec\n\nGoal: launch a session on 3600.\n\n${authorizationLineFor('rec')}\n`);
    write('design/operator/rec.authorized', `${authorizationLineFor('rec')}\n`);
    write('design/operator/rec-bar.md', BAR);
    write('design/operator/rec.config.json', JSON.stringify(CONFIG, null, 2));
    git(['add', 'design/operator/rec.authorized', 'design/operator/rec-brief.md', 'design/operator/rec-bar.md', 'design/operator/rec.config.json']);
    git(['commit', '-m', 'recursive fixture']);
    const s = git(['rev-parse', 'HEAD']);
    const r = verify(
      commission({
        run: 'rec',
        brief: path.join(repo, 'design/operator/rec-brief.md'),
        'repo-sha': s,
        sandbox: 'att-op-rec',
      }),
    );
    expect(r.reason).toBe(REFUSAL.RECURSIVE_COMMISSION);
  });

  it('refuses a config with no cap.meter — the charter calls it mandatory', () => {
    write('design/operator/nometer-brief.md', `# nometer\n\nGoal: report HEAD.\n\n${authorizationLineFor('nometer')}\n`);
    write('design/operator/nometer.authorized', `${authorizationLineFor('nometer')}\n`);
    write('design/operator/nometer-bar.md', BAR);
    write(
      'design/operator/nometer.config.json',
      JSON.stringify({ agents: [{ workdir: '/tmp/att-op-nometer' }] }, null, 2),
    );
    git(['add', 'design/operator/nometer.authorized', 'design/operator/nometer-brief.md', 'design/operator/nometer-bar.md', 'design/operator/nometer.config.json']);
    git(['commit', '-m', 'no-meter fixture']);
    const s = git(['rev-parse', 'HEAD']);
    const r = verify(
      commission({
        run: 'nometer',
        brief: path.join(repo, 'design/operator/nometer-brief.md'),
        'repo-sha': s,
        sandbox: 'att-op-nometer',
      }),
    );
    expect(r.reason).toBe(REFUSAL.MISSING_CAP_METER);
  });

  it('refuses when the committed config launches into a different sandbox than commissioned', () => {
    write('design/operator/drift-brief.md', `# drift\n\nGoal: report HEAD.\n\n${authorizationLineFor('drift')}\n`);
    write('design/operator/drift.authorized', `${authorizationLineFor('drift')}\n`);
    write('design/operator/drift-bar.md', BAR);
    write(
      'design/operator/drift.config.json',
      JSON.stringify(
        { agents: [{ workdir: '/tmp/att-op-somewhere-else' }], caps: { meter: { url: 'u', provider: 'claude' } } },
        null,
        2,
      ),
    );
    git(['add', 'design/operator/drift.authorized', 'design/operator/drift-brief.md', 'design/operator/drift-bar.md', 'design/operator/drift.config.json']);
    git(['commit', '-m', 'drift fixture']);
    const s = git(['rev-parse', 'HEAD']);
    const r = verify(
      commission({
        run: 'drift',
        brief: path.join(repo, 'design/operator/drift-brief.md'),
        'repo-sha': s,
        sandbox: 'att-op-drift',
      }),
    );
    expect(r.reason).toBe(REFUSAL.CHARTER_MISMATCH);
    expect(r.detail).toMatch(/somewhere-else/);
  });

  it('refuses while a critical finding stands', () => {
    const r = verify(commission(), { preflight: () => ({ criticals: 1, detail: 'leaked worktree' }) });
    expect(r.reason).toBe(REFUSAL.CRITICAL_OUTSTANDING);
    expect(r.detail).toBe('leaked worktree');
  });

  it('refuses when the pre-flight could not run at all', () => {
    // "We could not look" must never outrank a clean read — the harness's own rule.
    const r = verify(commission(), { preflight: () => ({ criticals: 1, detail: 'pre-flight could not run' }) });
    expect(r.reason).toBe(REFUSAL.CRITICAL_OUTSTANDING);
  });

  it('refuses a second launch of the same run id', () => {
    const r = verify(commission(), { launchedRuns: () => [RUN] });
    expect(r.reason).toBe(REFUSAL.ALREADY_LAUNCHED);
  });

  it('never launches on any refusal — verification is pure', () => {
    // Structural, not incidental: `verifyCommission` is handed no launcher at all, so a
    // refusal path cannot start anything. Guard the property so a future edit cannot quietly
    // move a side effect in here.
    const before = fs.readdirSync(repo);
    for (const bad of [
      commission({ port: '3500' }),
      commission({ 'repo-sha': sideSha }),
      commission({ 'bar-sha256': '0'.repeat(64) }),
      'not a commission at all',
    ]) {
      expect(verify(bad).ok).toBe(false);
    }
    expect(fs.readdirSync(repo)).toEqual(before);
  });
});
