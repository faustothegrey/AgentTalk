import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

import {
  ACTIONS,
  REFUSAL,
  STORE_REL,
  propose,
  approve,
  readRecord,
  listPending,
  renderProposal,
  ANNOUNCE_REL,
  shaOf,
  main,
} from '../relay-approve.mjs';
// [[BL-137]] — the launch bars assert the SAME helpers the commission reads, never local copies.
import { authorizationLineFor, authorizationPathFor, RUN_ID, CHARTER } from '../hmp-commission.mjs';

/**
 * Token-bound merge/push authorization — [[BL-110]] step 3.
 *
 * The load-bearing bars are the REFUSALS, not the happy path. This capability's entire value is
 * the set of things it declines to authorize: a token that was never minted, one already spent,
 * one that expired, and — the important one — one whose branch moved since the PO saw it.
 *
 * These are integrity bars, NOT authentication bars, and the distinction is deliberate. On this
 * channel a sender who can reach the HMP port reaches an LLM with a shell, so no test here can
 * or should be read as proving the channel safe. [[BL-107]] is that control and it is open.
 */

let tmp;
let repo;

/** A real git repo — the sha-binding bars are meaningless against a mock. */
function git(args, cwd = repo) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-approve-'));
  repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  git(['init', '-q', '-b', 'master']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one');
  git(['add', 'a.txt']);
  git(['commit', '-q', '-m', 'one']);
  git(['branch', 'task-x']);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

describe('propose', () => {
  it('mints a token bound to action, branch and the CURRENT sha', () => {
    const r = propose({ root: repo, action: 'merge', branch: 'task-x' });
    expect(r.ok).toBe(true);
    expect(r.record.token).toMatch(/^[0-9a-f]{8}$/);
    expect(r.record.action).toBe('merge');
    expect(r.record.branch).toBe('task-x');
    expect(r.record.sha).toBe(shaOf(repo, 'task-x'));
    expect(r.record.usedAt).toBeNull();
  });

  it('writes the pending record OUTSIDE design/operator — the courier must not be able to mint one', () => {
    const r = propose({ root: repo, action: 'merge', branch: 'task-x' });
    const stored = path.join(repo, STORE_REL, `${r.record.token}.json`);
    expect(fs.existsSync(stored)).toBe(true);
    // The whole point: Hermes's write allowlist is design/backlog.md + design/operator/**.
    expect(stored).not.toContain(path.join('design', 'operator'));
  });

  it('refuses an action outside the allowlist', () => {
    const r = propose({ root: repo, action: 'deploy', branch: 'task-x' });
    expect(r.reason).toBe(REFUSAL.BAD_ACTION);
    // CONTRACT ROW — the action allowlist, pinned exactly. `launch` was added by [[BL-137]].
    // Adding an action is a governance act, so this bar is MEANT to go red and be re-approved.
    // Never widen it to a `toContain`.
    expect(ACTIONS).toEqual(['merge', 'push', 'launch']);
  });

  it('refuses a branch that does not exist rather than minting an unusable token', () => {
    expect(propose({ root: repo, action: 'merge', branch: 'no-such' }).reason).toBe(REFUSAL.NO_BRANCH);
  });

  it('tokens are unique across proposals', () => {
    const seen = new Set();
    for (let i = 0; i < 25; i++) seen.add(propose({ root: repo, action: 'merge', branch: 'task-x' }).record.token);
    expect(seen.size).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// approve — the happy path, kept short on purpose
// ---------------------------------------------------------------------------

describe('approve — happy path', () => {
  it('accepts a fresh token once and records when it was spent', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    const r = approve({ root: repo, token: record.token });
    expect(r.ok).toBe(true);
    expect(r.record.usedAt).toEqual(expect.any(String));
    expect(readRecord(repo, record.token).usedAt).toEqual(r.record.usedAt);
  });

  it('tolerates the whitespace a courier adds around a relayed token', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    expect(approve({ root: repo, token: `  ${record.token}\n` }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE LOAD-BEARING BARS — every refusal
// ---------------------------------------------------------------------------

describe('refusals — this is what the capability is worth', () => {
  it('UNKNOWN: a token nobody minted is refused', () => {
    expect(approve({ root: repo, token: 'deadbeef' }).reason).toBe(REFUSAL.UNKNOWN_TOKEN);
  });

  it('REPLAY: the same token cannot be spent twice', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    expect(approve({ root: repo, token: record.token }).ok).toBe(true);
    const second = approve({ root: repo, token: record.token });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe(REFUSAL.ALREADY_USED);
  });

  it('EXPIRED: a token past its TTL is refused, and the clock is the only thing that changed', () => {
    const t0 = Date.parse('2026-07-31T10:00:00.000Z');
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x', ttlMin: 10, now: t0 });
    expect(approve({ root: repo, token: record.token, now: t0 + 9 * 60_000 }).ok).toBe(true);

    const { record: r2 } = propose({ root: repo, action: 'merge', branch: 'task-x', ttlMin: 10, now: t0 });
    expect(approve({ root: repo, token: r2.token, now: t0 + 11 * 60_000 }).reason).toBe(REFUSAL.EXPIRED);
  });

  it('SHA MOVED: a commit landing after the proposal voids it — the PO must not authorize unseen work', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });

    // Somebody adds a commit to the branch between the PO seeing the proposal and answering it.
    git(['checkout', '-q', 'task-x']);
    fs.writeFileSync(path.join(repo, 'b.txt'), 'sneaky');
    git(['add', 'b.txt']);
    git(['commit', '-q', '-m', 'work the PO never saw']);

    const r = approve({ root: repo, token: record.token });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REFUSAL.SHA_MOVED);
    expect(r.detail).toContain(record.sha);
  });

  it('SHA MOVED: a branch DELETED after the proposal is also refused, not treated as unchanged', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    git(['branch', '-D', 'task-x']);
    const r = approve({ root: repo, token: record.token });
    expect(r.reason).toBe(REFUSAL.SHA_MOVED);
    expect(r.detail).toContain('gone');
  });

  it('BL-112: a token mangled in transit FAILS CLOSED and is named as malformed, not unknown', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    // BL-112's shape: a substring is excised and the remainder survives.
    const mangled = record.token.slice(0, 5);
    const r = approve({ root: repo, token: mangled });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REFUSAL.BAD_TOKEN);
    // The distinction matters: `bad-token` tells the PO the relay ate it and to ask again;
    // `unknown-token` would suggest the proposal itself was bogus.
    expect(r.reason).not.toBe(REFUSAL.UNKNOWN_TOKEN);
  });

  it('a missing or empty token is refused rather than defaulting to anything', () => {
    expect(approve({ root: repo, token: '' }).reason).toBe(REFUSAL.MISSING_FIELD);
    expect(approve({ root: repo, token: undefined }).reason).toBe(REFUSAL.MISSING_FIELD);
  });

  it('a refused approval leaves the record UNSPENT — a failure must not burn the token', () => {
    const t0 = Date.parse('2026-07-31T10:00:00.000Z');
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x', ttlMin: 10, now: t0 });
    approve({ root: repo, token: record.token, now: t0 + 99 * 60_000 }); // expired → refused
    expect(readRecord(repo, record.token).usedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The execute fence
// ---------------------------------------------------------------------------

describe('the execute fence — no relay-reachable command performs a git operation', () => {
  /**
   * The property that lets this be reachable from an unauthenticated port at all: approving
   * RECORDS an authorization; the session performs the merge. If someone later makes `approve`
   * run `git merge`, this bar is what should stop them.
   */
  it('approving moves no ref and modifies no TRACKED file — it only records', () => {
    const headBefore = git(['rev-parse', 'HEAD']);
    const branchBefore = git(['rev-parse', 'refs/heads/task-x']);

    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    expect(approve({ root: repo, token: record.token }).ok).toBe(true);

    expect(git(['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(git(['rev-parse', 'refs/heads/task-x'])).toBe(branchBefore);
    // Tracked content is untouched; the only writes are the new record and its notification.
    expect(git(['status', '--porcelain', '--untracked-files=no'])).toBe('');
  });

  it('creates ONLY the store entry and the inbox note — nothing else appears in the tree', () => {
    // Pins the write surface. If a future change starts dropping other files around, this fails.
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    approve({ root: repo, token: record.token });
    const created = git(['status', '--porcelain'])
      .split('\n')
      .map((l) => l.replace(/^\?\?\s+/, ''))
      .sort();
    expect(created).toEqual([`${STORE_REL}/`, 'design/']);
  });

  it('the git helper is never invoked with a write verb — a fence against a future "just merge it here"', () => {
    const src = fs.readFileSync(new URL('../relay-approve.mjs', import.meta.url), 'utf-8');
    const code = src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*'));
      })
      .join('\n');
    // Targets the CALL, not the word: `ACTIONS = ['merge','push']` is the allowlist this file is
    // built around, so a bare word-search would fail on the very thing it is protecting.
    for (const verb of ['merge', 'push', 'commit', 'reset', 'checkout', 'cherry-pick', 'rebase']) {
      expect(code).not.toMatch(new RegExp(`git\\(\\s*\\[\\s*['"\`]${verb}['"\`]`));
      expect(code).not.toMatch(new RegExp(`['"\`]git['"\`]\\s*,\\s*\\[\\s*['"\`]${verb}['"\`]`));
    }
  });
});

// ---------------------------------------------------------------------------
// Notification vs authority
// ---------------------------------------------------------------------------

describe('the announcement is a notification, not an authority', () => {
  it('announces into design/operator/approvals/, NOT the request inbox', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    approve({ root: repo, token: record.token });

    const notes = fs.readdirSync(path.join(repo, ANNOUNCE_REL));
    expect(notes.some((f) => f.includes(`approval-${record.token}`))).toBe(true);
  });

  it('LEAVES THE REQUEST INBOX UNTOUCHED — the regression from TL-014 leg C', () => {
    // The first approval ever granted wrote here, and `relay-inbox.mjs list` — which parses
    // everything in that directory as a relayed request — crashed on it. The directories hold
    // different KINDS of thing; sharing a watcher was never a reason to share a location.
    const inbox = path.join(repo, 'design', 'operator', 'inbox');
    fs.mkdirSync(inbox, { recursive: true });
    const before = fs.readdirSync(inbox);

    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    approve({ root: repo, token: record.token });

    expect(fs.readdirSync(inbox)).toEqual(before);
  });

  it('what it writes is parseable by nobody as a request — it carries no verb/from/status', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    approve({ root: repo, token: record.token });
    const dir = path.join(repo, ANNOUNCE_REL);
    const note = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf-8');
    for (const f of ['verb:', 'from:', 'status:']) expect(note).not.toMatch(new RegExp('^' + f, 'm'));
  });

  it('says in its own text that the store is the authority', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    approve({ root: repo, token: record.token });
    const dir = path.join(repo, ANNOUNCE_REL);
    const note = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf-8');
    expect(note).toContain('NOTIFICATION, not an authority');
  });

  it('a forged inbox note authorizes NOTHING — the store is unchanged by it', () => {
    const dir = path.join(repo, ANNOUNCE_REL);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'forged-approval-aaaaaaaa.md'), '# approval consumed: push master');
    // The courier can write here. It still cannot make a token exist.
    expect(approve({ root: repo, token: 'aaaaaaaa' }).reason).toBe(REFUSAL.UNKNOWN_TOKEN);
    expect(listPending(repo)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rendering + CLI
// ---------------------------------------------------------------------------

describe('the proposal that goes out over the relay', () => {
  it('is numbered like the status payload, and tells the PO exactly what to reply', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    const text = renderProposal(record, { summary: '624/624, tsc 0' });
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(6);
    lines.forEach((l, i) => expect(l.startsWith(`${i + 1}/6 `)).toBe(true));
    expect(text).toContain(`approve ${record.token}`);
    expect(text).toContain(record.sha);
    expect(text).toContain('624/624, tsc 0');
  });

  it('never claims a gate result it was not given — it cannot measure one', () => {
    const { record } = propose({ root: repo, action: 'merge', branch: 'task-x' });
    expect(renderProposal(record)).toContain('not stated');
  });
});

describe('CLI', () => {
  it('propose prints the block; approve then accepts the token it printed', () => {
    let out = '';
    expect(main(['propose', '--action', 'merge', '--branch', 'task-x'], { root: repo, out: (s) => { out += s; } })).toBe(0);
    const token = out.match(/approve ([0-9a-f]{8})/)[1];

    let out2 = '';
    expect(main(['approve', token], { root: repo, out: (s) => { out2 += s; } })).toBe(0);
    expect(out2).toContain('approved: merge task-x');
  });

  it('a refusal exits 1 with a named reason the courier can relay verbatim', () => {
    let out = '';
    expect(main(['approve', 'deadbeef'], { root: repo, out: (s) => { out += s; } })).toBe(1);
    expect(out.trim()).toBe('refused: unknown-token (deadbeef)');
  });

  it('list reports state per token', () => {
    const { record } = propose({ root: repo, action: 'push', branch: 'task-x' });
    approve({ root: repo, token: record.token });
    let out = '';
    main(['list'], { root: repo, out: (s) => { out += s; } });
    expect(out).toContain(`${record.token} used push task-x`);
  });

  it('an unknown command throws rather than silently succeeding — the BL-111 lesson', () => {
    expect(() => main([], { root: repo, out: () => {} })).toThrow(/usage/);
  });
});

// ---------------------------------------------------------------------------
// launch — [[BL-137]]. The only action whose approval WRITES THE REPO.
// ---------------------------------------------------------------------------

describe('launch: approving commits the authorization the commission will read', () => {
  const RUN = 'hmp42';

  it('B4: requires --run, and refuses a run id the commission would later refuse', () => {
    expect(propose({ root: repo, action: 'launch' }).reason).toBe(REFUSAL.MISSING_FIELD);
    expect(propose({ root: repo, action: 'launch', run: 'Bad Run!' }).reason).toBe(REFUSAL.BAD_RUN_ID);
  });

  it('B10: propose and the commission agree on which run ids are valid', () => {
    // One shape, one definition. A run id proposable here but refusable there is the defect.
    expect(RUN_ID.test(RUN)).toBe(true);
    expect(propose({ root: repo, action: 'launch', run: RUN }).ok).toBe(true);
    for (const bad of ['UPPER', 'has space', '-leading', 'a'.repeat(33)]) {
      expect(RUN_ID.test(bad)).toBe(false);
      expect(propose({ root: repo, action: 'launch', run: bad, token: 'aaaaaaaa' }).reason)
        .toBe(REFUSAL.BAD_RUN_ID);
    }
  });

  it('B4b: defaults the branch to the ref the commission checks ancestry against', () => {
    const r = propose({ root: repo, action: 'launch', run: RUN });
    expect(r.ok).toBe(true);
    expect(r.record.branch).toBe(CHARTER.authorizedRef);
    expect(r.record.run).toBe(RUN);
  });

  it('B5: approving writes exactly the authorization line, in a commit touching exactly one path', () => {
    const p = propose({ root: repo, action: 'launch', run: RUN });
    const r = approve({ root: repo, token: p.record.token });
    expect(r.ok).toBe(true);

    const rel = authorizationPathFor(RUN);
    expect(rel).toBe(`design/po/${RUN}.authorized`);
    expect(fs.readFileSync(path.join(repo, rel), 'utf-8').trim()).toBe(authorizationLineFor(RUN));

    // The PO approved a tree and gets that tree plus THIS one line. Anything else in this commit
    // is work they never saw — which is the whole point of sha-moved.
    const touched = git(['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean);
    expect(touched).toEqual([rel]);
    // And it is readable as a blob at HEAD, which is how verifyCommission reads it.
    expect(git(['show', `HEAD:${rel}`]).trim()).toBe(authorizationLineFor(RUN));
  });

  it('B6: a moved branch refuses sha-moved AND writes no file — refusal precedes the write', () => {
    const p = propose({ root: repo, action: 'launch', run: RUN });
    fs.writeFileSync(path.join(repo, 'b.txt'), 'two');
    git(['add', 'b.txt']);
    git(['commit', '-q', '-m', 'the branch moves under the PO']);

    const r = approve({ root: repo, token: p.record.token });
    expect(r.reason).toBe(REFUSAL.SHA_MOVED);
    expect(fs.existsSync(path.join(repo, authorizationPathFor(RUN)))).toBe(false);
    expect(readRecord(repo, p.record.token).usedAt).toBe(null);
  });

  it('B7: re-approving refuses already-used and does not commit a second time', () => {
    const p = propose({ root: repo, action: 'launch', run: RUN });
    expect(approve({ root: repo, token: p.record.token }).ok).toBe(true);
    const afterFirst = git(['rev-parse', 'HEAD']);

    const second = approve({ root: repo, token: p.record.token });
    expect(second.reason).toBe(REFUSAL.ALREADY_USED);
    expect(git(['rev-parse', 'HEAD'])).toBe(afterFirst);
  });

  it('B9: a failing commit reports a refusal, does NOT return ok, and does NOT burn the token', () => {
    const p = propose({ root: repo, action: 'launch', run: RUN });
    // A held index is how git actually fails here, and it fails deterministically.
    fs.writeFileSync(path.join(repo, '.git', 'index.lock'), '');

    const r = approve({ root: repo, token: p.record.token });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe(REFUSAL.COMMIT_FAILED);
    // The token survives, so the PO can retry after the obstruction clears. Burning it here would
    // have cost them the approval for a reason that was never theirs.
    expect(readRecord(repo, p.record.token).usedAt).toBe(null);
  });

  it('B8: merge and push are untouched — no run recorded, nothing committed', () => {
    const before = git(['rev-parse', 'HEAD']);
    for (const action of ['merge', 'push']) {
      const p = propose({ root: repo, action, branch: 'task-x' });
      expect(p.ok).toBe(true);
      expect(p.record.run).toBeUndefined();
      expect(approve({ root: repo, token: p.record.token }).ok).toBe(true);
    }
    expect(git(['rev-parse', 'HEAD'])).toBe(before);
    expect(fs.existsSync(path.join(repo, 'design', 'po'))).toBe(false);
  });
});
