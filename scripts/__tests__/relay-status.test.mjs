import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  FIELD_COUNT,
  collect,
  renderPayload,
  renderFieldLines,
  digestOf,
  normalise,
  verifyPayload,
  humanAge,
  lastSpokeAt,
  newestTranscript,
  projectsDirFor,
  main,
} from '../relay-status.mjs';

/**
 * The outbound pointer relay — [[BL-110]] step 2.
 *
 * The safety argument for this direction is one sentence: **it emits facts the PO can verify
 * elsewhere, and no prose it authored.** The load-bearing bars are therefore the excision
 * detector (the [[BL-112]] shape), the write-nothing proof, and the no-prose sentinel — NOT the
 * happy path, which proves only that the thing runs.
 */

const SENTINEL = 'ZZQX-SECRET-TRANSCRIPT-PROSE-ZZQX';

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-status-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A transcript whose message bodies are full of a sentinel that must never reach the wire. */
function seedTranscript(dir, { id = 'aaaabbbb-1111-2222-3333-444455556666', ts = '2026-07-31T07:00:00.000Z' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const rows = [
    { type: 'user', timestamp: ts, message: { role: 'user', content: `please ${SENTINEL} do the thing` } },
    { type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text: SENTINEL }] } },
    '{ this line is deliberately malformed JSON',
  ];
  fs.writeFileSync(
    path.join(dir, `${id}.jsonl`),
    rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n'),
  );
  return id;
}

// ---------------------------------------------------------------------------
// DoD row 1 — shape
// ---------------------------------------------------------------------------

describe('row 1 — emit prints all seven numbered fields and a digest', () => {
  it('renders n/N numbering, in order, plus a digest line', () => {
    const fields = collect({ root: tmp, projectsDir: path.join(tmp, 'nope') });
    expect(fields).toHaveLength(FIELD_COUNT);

    const payload = renderPayload(fields);
    const lines = payload.trim().split('\n');
    expect(lines).toHaveLength(FIELD_COUNT + 1);
    for (let i = 1; i <= FIELD_COUNT; i++) {
      expect(lines[i - 1].startsWith(`${i}/${FIELD_COUNT} `)).toBe(true);
    }
    expect(lines[FIELD_COUNT]).toMatch(/^digest: [0-9a-f]{8}$/);
  });

  it('names exactly the seven agreed keys — a new field is a governance change, not a tweak', () => {
    const keys = collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }).map((f) => f.key);
    expect(keys).toEqual(['session', 'branch', 'head', 'tree', 'sync', 'spoke', 'inbox']);
  });
});

// ---------------------------------------------------------------------------
// DoD row 2 — round trip
// ---------------------------------------------------------------------------

describe('row 2 — verify accepts emit’s own output', () => {
  it('round-trips', () => {
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    expect(verifyPayload(payload)).toEqual({ ok: true });
  });

  it('tolerates the benign reformatting an LLM courier does — trailing whitespace', () => {
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const padded = payload
      .split('\n')
      .map((l) => (l ? `${l}   ` : l))
      .join('\n');
    // If this failed, every relay would cry ALTERED and the tell would be worthless noise.
    expect(verifyPayload(padded)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// DoD row 3 — THE LOAD-BEARING BAR: the BL-112 shape
// ---------------------------------------------------------------------------

describe('row 3 — a WITHIN-LINE excision is detected', () => {
  /**
   * This is the bar that justifies the digest existing. BL-112's courier does not drop a line —
   * it cuts a substring out of the middle and relays the remainder, which is why the reply
   * "looked complete both times". Reproduce exactly that.
   */
  it('reports digest-mismatch when a substring is cut out of a value, remainder intact', () => {
    const fields = [
      { key: 'session', value: '5a0e75d4' },
      { key: 'branch', value: 'master' },
      { key: 'head', value: '3084702 fix(infra): pin the MCP port' },
      { key: 'tree', value: '0 modified, 0 untracked' },
      { key: 'sync', value: 'ahead 0, behind 0' },
      { key: 'spoke', value: '2026-07-31T07:22:47Z (4m ago)' },
      { key: 'inbox', value: '0 pending' },
    ];
    const payload = renderPayload(fields);
    expect(verifyPayload(payload).ok).toBe(true);

    // Precisely BL-112's observed behaviour: the substring vanishes, the rest of the line survives.
    const excised = payload.replace('3084702 fix(infra): pin the ', '');
    expect(excised).toContain('MCP port'); // the remainder DID survive — same as `.NOPE` did
    expect(excised.split('\n')).toHaveLength(payload.split('\n').length); // no line was lost

    const v = verifyPayload(excised);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('digest-mismatch');
  });

  it('detects a single-character change — the smallest excision still fails closed', () => {
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const tampered = payload.replace('pending', 'pendinq');
    expect(verifyPayload(tampered).reason).toBe('digest-mismatch');
  });

  it('notices when the digest line itself is excised, rather than passing', () => {
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const noDigest = payload.split('\n').filter((l) => !l.startsWith('digest:')).join('\n');
    expect(verifyPayload(noDigest).reason).toBe('no-digest');
  });
});

// ---------------------------------------------------------------------------
// DoD row 4 — numbering
// ---------------------------------------------------------------------------

describe('row 4 — a dropped whole line is caught by the numbering', () => {
  it('names which field is missing, so the PO knows what to ask for again', () => {
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const dropped = payload.split('\n').filter((l) => !l.startsWith('4/7 ')).join('\n');
    const v = verifyPayload(dropped);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('missing-field');
    expect(v.detail).toBe('4/7');
  });

  it('a payload with no fields at all does not pass vacuously', () => {
    expect(verifyPayload('digest: deadbeef').reason).toBe('no-payload');
    expect(verifyPayload('').reason).toBe('no-payload');
  });
});

// ---------------------------------------------------------------------------
// DoD row 5 — LOAD-BEARING: read-only, proven mechanically
// ---------------------------------------------------------------------------

describe('row 5 — emit writes nothing', () => {
  /**
   * The whole safety case for running this unauthenticated is that the command cannot act. That
   * claim is worth exactly as much as its proof, so byte-compare the tree around a real call
   * rather than trusting the source comment.
   */
  function snapshot(dir) {
    const acc = [];
    const walk = (d, rel) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const abs = path.join(d, e.name);
        const r = path.join(rel, e.name);
        if (e.isDirectory()) walk(abs, r);
        else acc.push(`${r}:${fs.readFileSync(abs).toString('base64')}`);
      }
    };
    walk(dir, '');
    return acc.join('\n');
  }

  it('leaves the repo and the inbox byte-identical', () => {
    const root = path.join(tmp, 'repo');
    fs.mkdirSync(path.join(root, 'design', 'operator', 'inbox'), { recursive: true });
    fs.writeFileSync(path.join(root, 'design', 'operator', 'inbox', 'a.md'), 'note');
    const projectsDir = path.join(tmp, 'projects');
    seedTranscript(projectsDir);

    const before = snapshot(tmp);
    renderPayload(collect({ root, projectsDir }));
    const after = snapshot(tmp);

    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// DoD row 6 — LOAD-BEARING: the no-prose fence
// ---------------------------------------------------------------------------

describe('row 6 — no transcript message body reaches the output', () => {
  /**
   * THE FENCE. If someone later adds "just a one-line summary of what the session is doing" —
   * the obvious next request — this bar must be what stops them, not a reviewer's memory.
   */
  it('a sentinel planted in the transcript appears nowhere in the payload', () => {
    const projectsDir = path.join(tmp, 'projects');
    seedTranscript(projectsDir);

    const payload = renderPayload(collect({ root: tmp, projectsDir }));

    expect(payload).not.toContain(SENTINEL);
    // And prove the fixture was actually read, so this cannot pass by reading nothing at all.
    expect(payload).toMatch(/2026-07-31T07:00:00\.000Z/);
  });

  it('reads only type and timestamp — the transcript reader never returns content', () => {
    const projectsDir = path.join(tmp, 'projects');
    const id = seedTranscript(projectsDir);
    const ts = lastSpokeAt(path.join(projectsDir, `${id}.jsonl`));
    expect(ts).toBe('2026-07-31T07:00:00.000Z');
    expect(JSON.stringify(ts)).not.toContain(SENTINEL);
  });
});

// ---------------------------------------------------------------------------
// DoD row 7 — truthful degradation
// ---------------------------------------------------------------------------

describe('row 7 — absent or corrupt input degrades truthfully, never invents', () => {
  it('no transcript directory at all → spoke: unknown, no crash', () => {
    const fields = collect({ root: tmp, projectsDir: path.join(tmp, 'does-not-exist') });
    const spoke = fields.find((f) => f.key === 'spoke');
    expect(spoke.value).toBe('unknown');
    expect(fields.find((f) => f.key === 'session').value).toBe('unknown');
  });

  it('a transcript with no assistant entry → unknown rather than a borrowed timestamp', () => {
    const dir = path.join(tmp, 'projects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'x.jsonl'),
      JSON.stringify({ type: 'user', timestamp: '2026-07-31T06:00:00.000Z', message: { content: 'hi' } }),
    );
    expect(collect({ root: tmp, projectsDir: dir }).find((f) => f.key === 'spoke').value).toBe('unknown');
  });

  it('a half-written final line is skipped, not fatal — transcripts are appended live', () => {
    const dir = path.join(tmp, 'projects');
    const id = seedTranscript(dir);
    // seedTranscript ends with a deliberately malformed line; the good entry above it must win.
    expect(lastSpokeAt(path.join(dir, `${id}.jsonl`))).toBe('2026-07-31T07:00:00.000Z');
  });

  it('a directory that is not a git repo → unknown fields, still seven of them', () => {
    const fields = collect({ root: path.join(tmp, 'not-a-repo'), projectsDir: path.join(tmp, 'nope') });
    expect(fields).toHaveLength(FIELD_COUNT);
    expect(fields.find((f) => f.key === 'branch').value).toBe('unknown');
  });

  it('picks the most recently modified transcript when several exist', () => {
    const dir = path.join(tmp, 'projects');
    seedTranscript(dir, { id: 'old-one', ts: '2026-07-01T00:00:00.000Z' });
    seedTranscript(dir, { id: 'new-one', ts: '2026-07-31T07:00:00.000Z' });
    fs.utimesSync(path.join(dir, 'old-one.jsonl'), new Date(0), new Date(0));
    expect(newestTranscript(dir).id).toBe('new-one');
  });
});

// ---------------------------------------------------------------------------
// Supporting units
// ---------------------------------------------------------------------------

describe('supporting units', () => {
  it('humanAge is coarse and never negative', () => {
    const now = Date.parse('2026-07-31T12:00:00.000Z');
    expect(humanAge('2026-07-31T11:59:30.000Z', now)).toBe('30s ago');
    expect(humanAge('2026-07-31T11:30:00.000Z', now)).toBe('30m ago');
    expect(humanAge('2026-07-31T08:00:00.000Z', now)).toBe('4h ago');
    expect(humanAge('2026-07-25T12:00:00.000Z', now)).toBe('6d ago');
    expect(humanAge('2026-08-01T12:00:00.000Z', now)).toBe('0s ago'); // clock skew, not a negative age
    expect(humanAge('not-a-date', now)).toBe('unknown');
  });

  it('projectsDirFor turns the absolute project path into Claude Code’s slug', () => {
    expect(projectsDirFor('/Users/fausto/Software/AgentTalk', '/Users/fausto')).toBe(
      '/Users/fausto/.claude/projects/-Users-fausto-Software-AgentTalk',
    );
  });

  it('normalise strips trailing whitespace but not internal spacing', () => {
    expect(normalise(['a:  b   ', 'c: d'])).toBe('a:  b\nc: d');
  });

  it('digestOf is stable and 8 hex chars', () => {
    expect(digestOf(['x'])).toMatch(/^[0-9a-f]{8}$/);
    expect(digestOf(['x'])).toBe(digestOf(['x   ']));
    expect(digestOf(['x'])).not.toBe(digestOf(['y']));
  });

  it('renderFieldLines aligns the keys so the values line up on a narrow screen', () => {
    const lines = renderFieldLines([{ key: 'a', value: '1' }, { key: 'bbbb', value: '2' }]);
    expect(lines[0]).toBe('1/2 a:    1');
    expect(lines[1]).toBe('2/2 bbbb: 2');
  });
});

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

describe('CLI', () => {
  it('verify returns 0 and prints intact on a good payload', () => {
    let out = '';
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const code = main(['verify'], { stdin: payload, out: (s) => { out += s; } });
    expect(code).toBe(0);
    expect(out.trim()).toBe('intact');
  });

  it('verify returns 1 and says WHY on a tampered payload', () => {
    let out = '';
    const payload = renderPayload(collect({ root: tmp, projectsDir: path.join(tmp, 'nope') }));
    const code = main(['verify'], { stdin: payload.replace('pending', 'pendinq'), out: (s) => { out += s; } });
    expect(code).toBe(1);
    expect(out).toContain('ALTERED: digest-mismatch');
  });

  it('an unknown command throws rather than silently succeeding — the BL-111 lesson', () => {
    expect(() => main([], { out: () => {} })).toThrow(/usage/);
    expect(() => main(['emitt'], { out: () => {} })).toThrow(/emitt/);
  });
});
