// BL-109 — a PO disposition of a `critical` finding needs somewhere to live that a CHECK can read.
//
// The charter says a `critical` GATES the next operator run until the PO clears it, and that only
// the PO may dispose of one. Severity was computed per run and nothing persisted, so "uncleared"
// was a concept the charter used and the harness could not represent. It bit twice for real — hmp1
// (`head-moved-undetermined`, "it was my session merging") and hmp5 — and both dispositions became
// prose in a grading doc, where no check can see them and nothing stops a re-raise.
//
// Every git bar here runs against a REAL throwaway repo, matching this suite's existing convention:
// the mechanism under test is "read the committed file, not the working tree", and a mocked git
// would prove nothing about exactly that.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  SEVERITY,
  DISPOSITIONS_PATH,
  fingerprintFinding,
  loadDispositions,
  applyDispositions,
  exitCodeFor,
} from '../infra-invariant.mjs';

const tmpDirs = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

/** A real repo with a real commit — the only way to test "reads from HEAD" honestly. */
function makeRepo({ committed, onDisk } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl109-'));
  tmpDirs.push(dir);
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  fs.mkdirSync(path.join(dir, 'design'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), 'base\n', 'utf8');
  git(dir, 'add', 'README.md');

  if (committed !== undefined) {
    fs.writeFileSync(path.join(dir, DISPOSITIONS_PATH), committed, 'utf8');
    git(dir, 'add', DISPOSITIONS_PATH);
  }
  git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'base');

  // Written AFTER the commit → present on disk, absent from HEAD. The forgery case.
  if (onDisk !== undefined) fs.writeFileSync(path.join(dir, DISPOSITIONS_PATH), onDisk, 'utf8');
  return dir;
}

const critical = (kind = 'head-moved-undetermined', detail = 'range unreadable a1b2c3..d4e5f6') =>
  ({ severity: SEVERITY.CRITICAL, kind, detail, repo: 'agenttalk' });

const dispositionsFor = (f, extra = {}) => JSON.stringify({
  dispositions: [{
    fingerprint: fingerprintFinding(f),
    kind: f.kind,
    disposedBy: 'PO',
    date: '2026-08-06',
    reason: 'it was my session merging',
    commit: '9cb0218',
    ...extra,
  }],
});

describe('BL-109 — fingerprints', () => {
  it('is stable for the same finding and differs on any field', () => {
    const f = critical();
    expect(fingerprintFinding(f)).toBe(fingerprintFinding({ ...f }));
    expect(fingerprintFinding(f)).not.toBe(fingerprintFinding({ ...f, kind: 'other' }));
    expect(fingerprintFinding(f)).not.toBe(fingerprintFinding({ ...f, repo: 'client' }));
    expect(fingerprintFinding(f)).not.toBe(fingerprintFinding({ ...f, severity: SEVERITY.WARN }));
  });

  // ⭐ The design decision, pinned. A clearance must NOT survive a change of specifics: hmp1's
  // head move was cleared because THAT merge was the PO's own. A later head move over a different
  // range is a different event and must gate again. Fingerprinting on `kind` alone would have
  // cleared the class forever and turned the mechanism into a blindfold.
  it('changes when the DETAIL changes — a clearance never generalises to the next occurrence', () => {
    const first = critical('head-moved-undetermined', 'range unreadable a1b2c3..d4e5f6');
    const second = critical('head-moved-undetermined', 'range unreadable 999888..777666');
    expect(fingerprintFinding(first)).not.toBe(fingerprintFinding(second));

    const cleared = applyDispositions([second], JSON.parse(dispositionsFor(first)).dispositions);
    expect(cleared[0].severity).toBe(SEVERITY.CRITICAL);   // still gates
    expect(exitCodeFor(cleared)).toBe(1);
  });
});

describe('BL-109 — dispositions are read from HEAD, never the working tree', () => {
  it('a committed disposition is loaded', () => {
    const repo = makeRepo({ committed: dispositionsFor(critical()) });
    const { dispositions, findings } = loadDispositions(repo, process.env);
    expect(dispositions).toHaveLength(1);
    expect(findings).toHaveLength(0);
  });

  // ⭐ THE FORGERY BAR. Anyone can write a JSON file; committing it is a recorded, attributable
  // act — the same reasoning that makes hmp authorization repo-anchored. An uncommitted file must
  // clear NOTHING, and must not do so quietly.
  it('an UNCOMMITTED disposition file clears nothing, and says so', () => {
    const repo = makeRepo({ onDisk: dispositionsFor(critical()) });
    const { dispositions, findings } = loadDispositions(repo, process.env);
    expect(dispositions).toHaveLength(0);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: SEVERITY.WARN, kind: 'dispositions-uncommitted' });
  });

  it('no file at all is the normal case: no dispositions, no noise', () => {
    const repo = makeRepo();
    const { dispositions, findings } = loadDispositions(repo, process.env);
    expect(dispositions).toHaveLength(0);
    expect(findings).toHaveLength(0);
  });

  it('committed but unparseable FAILS CLOSED — clears nothing, and warns', () => {
    const repo = makeRepo({ committed: '{ this is not json' });
    const { dispositions, findings } = loadDispositions(repo, process.env);
    expect(dispositions).toHaveLength(0);
    expect(findings[0]).toMatchObject({ severity: SEVERITY.WARN, kind: 'dispositions-unreadable' });
  });

  it('committed but missing the `dispositions` array fails closed too', () => {
    const repo = makeRepo({ committed: JSON.stringify({ cleared: ['whatever'] }) });
    const { dispositions, findings } = loadDispositions(repo, process.env);
    expect(dispositions).toHaveLength(0);
    expect(findings[0]).toMatchObject({ kind: 'dispositions-unreadable' });
  });
});

describe('BL-109 — applying a disposition', () => {
  it('downgrades a matched critical to info and un-gates the run', () => {
    const f = critical();
    expect(exitCodeFor([f])).toBe(1);
    const out = applyDispositions([f], JSON.parse(dispositionsFor(f)).dispositions);
    expect(out[0].severity).toBe(SEVERITY.INFO);
    expect(exitCodeFor(out)).toBe(0);
  });

  // ⭐ "The finding is recorded, not suppressed" — how hmp5's own critical was closed. A mechanism
  // that made dispositions invisible would be worse than the prose it replaces.
  it('KEEPS the finding visible, carrying who cleared it, why, and what it was', () => {
    const f = critical();
    const [out] = applyDispositions([f], JSON.parse(dispositionsFor(f)).dispositions);
    expect(out.kind).toBe(f.kind);
    expect(out.detail).toBe(f.detail);
    expect(out.clearedFrom).toBe(SEVERITY.CRITICAL);
    expect(out.cleared).toMatchObject({ by: 'PO', date: '2026-08-06', reason: 'it was my session merging' });
  });

  it('clears only what it names — other findings are untouched', () => {
    const cleared = critical();
    const other = { severity: SEVERITY.CRITICAL, kind: 'tracked-file-modified', detail: 'design/x.md', repo: 'agenttalk' };
    const out = applyDispositions([cleared, other], JSON.parse(dispositionsFor(cleared)).dispositions);
    expect(out.find((f) => f.kind === cleared.kind).severity).toBe(SEVERITY.INFO);
    expect(out.find((f) => f.kind === 'tracked-file-modified').severity).toBe(SEVERITY.CRITICAL);
    expect(exitCodeFor(out)).toBe(1);
  });

  it('every finding carries its fingerprint even when nothing is cleared — you cannot write a disposition without one', () => {
    const out = applyDispositions([critical()], []);
    expect(out[0].fingerprint).toBe(fingerprintFinding(critical()));
    expect(out[0].severity).toBe(SEVERITY.CRITICAL);
  });
});
