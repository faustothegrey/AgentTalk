import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  READ_ONLY_VERBS,
  WRITE_VERBS,
  REFUSAL,
  INBOX_REL,
  validate,
  writeMessage,
  listMessages,
  ackMessage,
  inboxDir,
  primaryRoot,
} from '../relay-inbox.mjs';

/**
 * The safety argument for this whole channel is one sentence: **a forged message cannot do harm,
 * because every verb it can carry is read-only.** These bars exist to keep that sentence true —
 * so the load-bearing ones are the refusals, not the happy path.
 */

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-inbox-'));
});

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('the verb fence', () => {
  it('accepts the read-only verbs, and only those', () => {
    for (const v of READ_ONLY_VERBS) {
      expect(validate({ from: 'peer70', verb: v }).ok).toBe(true);
    }
    expect(READ_ONLY_VERBS).toEqual(['status', 'report']);
  });

  it('THE FENCE: every write-class verb is refused, with a reason that says why', () => {
    // If this bar ever goes green on a new verb, the channel's safety argument has changed and
    // that is a governance question, not a test to update.
    for (const v of WRITE_VERBS) {
      const r = validate({ from: 'peer70', verb: v });
      expect(r.ok, `verb '${v}' must be refused`).toBe(false);
      expect(r.reason).toBe(REFUSAL.VERB_NOT_READ_ONLY);
      expect(r.detail).toMatch(/BL-107|PO-RELAY/);
    }
  });

  it('refuses merge and push specifically — the two the PO reserves absolutely', () => {
    for (const v of ['merge', 'push']) {
      expect(validate({ from: 'peer70', verb: v }).reason).toBe(REFUSAL.VERB_NOT_READ_ONLY);
    }
  });

  it('refuses an unknown verb distinctly from a write verb', () => {
    // A courier relaying these tells the PO two different true things: "you asked for something
    // out of scope" versus "you typo'd".
    expect(validate({ from: 'peer70', verb: 'frobnicate' }).reason).toBe(REFUSAL.UNKNOWN_VERB);
    expect(validate({ from: 'peer70', verb: 'merge' }).reason).toBe(REFUSAL.VERB_NOT_READ_ONLY);
  });

  it('is case- and whitespace-insensitive on the verb, so a courier cannot bypass by casing', () => {
    expect(validate({ from: 'peer70', verb: '  STATUS ' }).ok).toBe(true);
    expect(validate({ from: 'peer70', verb: 'MERGE' }).reason).toBe(REFUSAL.VERB_NOT_READ_ONLY);
  });

  it('requires from and verb', () => {
    expect(validate({ verb: 'status' }).reason).toBe(REFUSAL.MISSING_FIELD);
    expect(validate({ from: 'peer70' }).reason).toBe(REFUSAL.MISSING_FIELD);
  });

  it('refuses a peer id that is not a plain identifier', () => {
    expect(validate({ from: 'peer70; rm -rf /', verb: 'status' }).reason).toBe(REFUSAL.BAD_PEER);
    expect(validate({ from: '../../etc', verb: 'status' }).reason).toBe(REFUSAL.BAD_PEER);
  });

  it('caps the note — a relayed instruction is a pointer, not a transcript', () => {
    expect(validate({ from: 'peer70', verb: 'status', note: 'x'.repeat(401) }).reason).toBe(REFUSAL.NOTE_TOO_LONG);
    expect(validate({ from: 'peer70', verb: 'status', note: 'x'.repeat(400) }).ok).toBe(true);
  });

  it('the allowlist is frozen — a verb cannot be added at runtime', () => {
    expect(Object.isFrozen(READ_ONLY_VERBS)).toBe(true);
    expect(() => READ_ONLY_VERBS.push('merge')).toThrow();
  });
});

describe('the inbox', () => {
  it('writes a message the PO can read, tagged PO-RELAY and never PO', () => {
    const { id, file } = writeMessage(root, { from: 'peer70', verb: 'status', note: 'how goes it' });
    const text = fs.readFileSync(path.join(root, file), 'utf-8');
    expect(file.startsWith(INBOX_REL)).toBe(true);
    expect(text).toMatch(/^tag: PO-RELAY$/m);
    expect(text).not.toMatch(/^tag: PO$/m);
    expect(text).toMatch(/how goes it/);
    expect(id).toMatch(/status-peer70$/);
  });

  it('spells out in the message itself what it may NOT authorise', () => {
    // The artifact has to carry its own limits: whoever reads it months from now may not have
    // the proposal to hand, and an instruction that looks binding is the hazard.
    const { file } = writeMessage(root, { from: 'peer70', verb: 'report' });
    const text = fs.readFileSync(path.join(root, file), 'utf-8');
    for (const banned of ['merge', 'push', 'scope', 'eligible', 'critical']) {
      expect(text.toLowerCase()).toContain(banned);
    }
    expect(text).toMatch(/not `\[PO\]`|is not `\[PO\]`/);
  });

  it('lists messages with their state, oldest first', () => {
    writeMessage(root, { from: 'peer70', verb: 'status' }, new Date('2026-07-30T10:00:00Z'));
    writeMessage(root, { from: 'peer84', verb: 'report' }, new Date('2026-07-30T11:00:00Z'));
    const msgs = listMessages(root);
    expect(msgs.map((m) => m.from)).toEqual(['peer70', 'peer84']);
    expect(msgs.every((m) => m.status === 'pending')).toBe(true);
  });

  it('an empty or absent inbox lists as empty rather than throwing', () => {
    expect(listMessages(root)).toEqual([]);
    fs.mkdirSync(inboxDir(root), { recursive: true });
    expect(listMessages(root)).toEqual([]);
  });

  it('ack flips pending → acked, once', () => {
    const { id } = writeMessage(root, { from: 'peer70', verb: 'status' });
    expect(ackMessage(root, id).ok).toBe(true);
    expect(listMessages(root)[0].status).toBe('acked');
    // Twice is a refusal, not a silent no-op: a double ack means two readers think they own it.
    expect(ackMessage(root, id).ok).toBe(false);
  });

  it('acking something that does not exist refuses', () => {
    expect(ackMessage(root, 'nope').reason).toBe('no-such-message');
  });
});

describe('primaryRoot — one inbox, whichever worktree reads it', () => {
  it('resolves the primary checkout, not the worktree these tests run in', () => {
    // BL-101/BL-106 were both this bug: `--show-toplevel` answers the WORKTREE root. During
    // development this file runs from a linked worktree, so the two genuinely differ here and
    // the bar is meaningful rather than incidentally true. No `runIf` guard — a skip in a test
    // that exists to prove a path resolves is a failure, not a neutral outcome.
    const resolved = primaryRoot();
    expect(resolved).toBeTruthy();
    expect(fs.existsSync(path.join(resolved, 'AGENT.md'))).toBe(true);
    expect(fs.existsSync(path.join(resolved, '.git'))).toBe(true);
    // The primary's .git is a directory; a linked worktree's is a file.
    expect(fs.statSync(path.join(resolved, '.git')).isDirectory()).toBe(true);
  });
});
