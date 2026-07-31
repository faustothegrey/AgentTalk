import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  READ_ONLY_VERBS,
  WRITE_VERBS,
  REFUSAL,
  INBOX_REL,
  validate,
  writeMessage,
  formatRow,
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

describe('the CLI entry guard — a silent no-op that exits 0 is the worst failure mode', () => {
  /**
   * This bar exists because the live relay run came back `completed` with an empty reply, and the
   * courier turned out to have executed the command faithfully — the fault was the `invokedDirectly`
   * guard comparing `path.resolve(argv[1])` (symlinks intact) against `import.meta.url` (already
   * real). On macOS `/tmp` → `/private/tmp` made them differ, so `main` never ran: **no output,
   * exit 0.**
   *
   * The invocation style that triggers it is the one the runbook mandates ("invoke by absolute
   * path") and the only one a remote courier can use — so a unit test of the exported functions
   * could never have caught it. This one actually spawns the script through a symlink.
   */
  const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'relay-inbox.mjs');

  it('produces output when invoked through a SYMLINKED absolute path', () => {
    const link = path.join(os.tmpdir(), `relay-guard-${process.pid}`);
    fs.rmSync(link, { force: true });
    fs.symlinkSync(path.dirname(path.dirname(scriptPath)), link);
    try {
      const viaLink = path.join(link, 'scripts', 'relay-inbox.mjs');
      // Sanity: the symlinked path must genuinely differ from its realpath, or this proves nothing.
      expect(path.resolve(viaLink)).not.toBe(fs.realpathSync(viaLink));

      const out = execFileSync(process.execPath, [viaLink, 'list'], { encoding: 'utf-8' });
      expect(out.trim(), 'main() did not run — the entry guard rejected a symlinked argv[1]').not.toBe('');
    } finally {
      fs.rmSync(link, { force: true });
    }
  });

  it('still produces output by its real path', () => {
    const out = execFileSync(process.execPath, [scriptPath, 'list'], { encoding: 'utf-8' });
    expect(out.trim()).not.toBe('');
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

// ---------------------------------------------------------------------------
// A foreign file in the inbox must not take `list` down — found live 2026-07-31
// ---------------------------------------------------------------------------

describe('a file that is not a relayed request', () => {
  /**
   * Found by the FIRST approval ever granted (TL-014 leg C): `relay-approve.mjs` wrote its record
   * into this directory, `listMessages` parsed it to a row of nulls, and the CLI printer crashed on
   * `.padEnd` of null. A fail-open parser feeding a fail-hard printer.
   *
   * The trigger has been moved out of this directory, but the hole was never about approvals — a
   * README, an editor backup, or a hand-dropped note reproduces it identically. These bars pin the
   * directory as *shared and writable by others*, which is what it has always been.
   */
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-foreign-'));
    fs.mkdirSync(path.join(root, INBOX_REL), { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const put = (name, body) => fs.writeFileSync(path.join(root, INBOX_REL, name), body);

  it('is skipped by listMessages — it is not a malformed message, it is not a message', () => {
    put('README.md', '# just a readme\n\nnothing structured here.\n');
    expect(listMessages(root)).toEqual([]);
  });

  it('does not hide real requests sitting beside it', () => {
    put('README.md', '# readme\n');
    writeMessage(root, { from: 'peer70', verb: 'status', note: 'hello' });
    const msgs = listMessages(root);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].verb).toBe('status');
  });

  it('a PARTIALLY damaged request is still listed, gaps and all — that is diagnostic', () => {
    // Only `from:` survives. This IS a message, so hiding it would be the worse failure.
    put('2026-07-31T00-00-00-000Z-broken.md', '# damaged\n\nfrom: peer84\n');
    const msgs = listMessages(root);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].from).toBe('peer84');
    expect(msgs[0].verb).toBeNull();
  });

  it('the printer renders a damaged request instead of crashing on it', () => {
    // formatRow is what the CLI calls, so this is the production path, not a stand-in.
    const row = formatRow({ id: 'broken', verb: null, from: 'peer84', status: null });
    expect(row).toContain('peer84');
    expect(row).toContain('\u2014'); // the missing fields render as a dash
    expect(() => formatRow({ id: 'x', verb: null, from: null, status: null })).not.toThrow();
  });
});
