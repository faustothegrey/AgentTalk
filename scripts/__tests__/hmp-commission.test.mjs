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
  hasAuthorization,
  findsLaunchInstruction,
  makeGitIo,
  sha256,
  verifyCommission,
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

const CONFIG = {
  agents: [{ id: 'worker-1', provider: 'claude', workdir: `/tmp/att-op-${RUN}` }],
  caps: { meter: { url: 'http://127.0.0.1:9899/usage', provider: 'claude', maxPercentDelta: 5 } },
};

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hmp-commission-'));
  git(['init', '-b', 'master']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);

  write('design/operator/hmp1-brief.md', BRIEF);
  write('design/operator/hmp1-bar.md', BAR);
  write(`design/operator/${RUN}.config.json`, JSON.stringify(CONFIG, null, 2));
  git(['add', 'design/operator/hmp1-brief.md', 'design/operator/hmp1-bar.md', `design/operator/${RUN}.config.json`]);
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

describe('hasAuthorization — the anchored format', () => {
  it('accepts the exact line', () => {
    expect(hasAuthorization(BRIEF, RUN)).toBe(true);
  });

  it('tolerates surrounding whitespace but not extra content', () => {
    expect(hasAuthorization(`   ${authorizationLineFor(RUN)}   `, RUN)).toBe(true);
    expect(hasAuthorization(`${authorizationLineFor(RUN)} — approved verbally`, RUN)).toBe(false);
  });

  it('THE VACUOUS PASS: prose containing [PO] and the run id does NOT authorize', () => {
    // This is the case Gate 1 caught. A substring check on `[PO]` + the run id would pass on a
    // brief that says the opposite — waving through the one act the fence exists to stop.
    const denial = `# Run ${RUN}\n\nNote: this run has no [PO] authorization for ${RUN} yet.\n`;
    expect(hasAuthorization(denial, RUN)).toBe(false);
  });

  it('does not accept authorization for a different run id', () => {
    expect(hasAuthorization(authorizationLineFor('hmp2'), RUN)).toBe(false);
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

  it('refuses when the committed brief lacks the authorization line', () => {
    // Commit a brief with no [PO] line, on master, and commission against it.
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
    write('design/operator/rec-bar.md', BAR);
    write('design/operator/rec.config.json', JSON.stringify(CONFIG, null, 2));
    git(['add', 'design/operator/rec-brief.md', 'design/operator/rec-bar.md', 'design/operator/rec.config.json']);
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
    write('design/operator/nometer-bar.md', BAR);
    write(
      'design/operator/nometer.config.json',
      JSON.stringify({ agents: [{ workdir: '/tmp/att-op-nometer' }] }, null, 2),
    );
    git(['add', 'design/operator/nometer-brief.md', 'design/operator/nometer-bar.md', 'design/operator/nometer.config.json']);
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
    write('design/operator/drift-bar.md', BAR);
    write(
      'design/operator/drift.config.json',
      JSON.stringify(
        { agents: [{ workdir: '/tmp/att-op-somewhere-else' }], caps: { meter: { url: 'u', provider: 'claude' } } },
        null,
        2,
      ),
    );
    git(['add', 'design/operator/drift-brief.md', 'design/operator/drift-bar.md', 'design/operator/drift.config.json']);
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
