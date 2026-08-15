#!/usr/bin/env node

/**
 * The PO→session relay inbox — READ-ONLY verbs only (BL-110, step 1).
 *
 * USAGE (the courier runs exactly one of these; nothing else is offered):
 *   node scripts/relay-inbox.mjs receive --from <peer> --verb <status|report> [--note "<text>"]
 *   node scripts/relay-inbox.mjs list [--json]
 *   node scripts/relay-inbox.mjs ack <id>
 *
 * Exit codes:
 *   0  accepted / listed / acked
 *   1  refused. One line: `refused: <reason>` — the courier relays it verbatim
 *   2  the handler itself crashed. Distinct from 1 on purpose.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 *   `modules/relay/docs/hmp-bidirectional-relay.md` proposes a bidirectional channel so the PO can steer a
 *   session from away from the desk. That proposal needs a PO decision on an authority model
 *   (`[PO-RELAY]`) and it is BLOCKED on authenticating HMP (BL-107). This is the one slice that
 *   needs neither: **verbs that cannot do harm even if forged.**
 *
 *   A forged `report status` costs nothing — so no authentication is required for this subset to
 *   be safe, and every leg of the transport still gets exercised end to end. That is the O-1
 *   instinct applied to a channel instead of a worker: prove it with a message that cannot hurt
 *   you, and find out whether your predictions about it were right.
 *
 *   The verb fence here is therefore NOT behavioural. The proposal noted that a general
 *   `[PO-RELAY]` fence would start out behavioural; for this subset it is mechanical by
 *   construction, because the allowlist IS the implementation. There is no code path from an
 *   inbox message to an action. `receive` writes a file and returns; that is all it can do.
 *
 * WHY A FILE, NOT A SOCKET
 *   Auditability by default. Every instruction ever relayed is a timestamped artifact, diffable
 *   and readable months later. Given that the whole authority question turns on "can we prove
 *   who said this", an append-only paper trail is the point rather than overhead.
 *
 * WHY THE COURIER NEEDS NO CONFIGURING
 *   Hermes is an LLM with a shell. Rather than teaching it a protocol, the message carries the
 *   single command to run — the same pattern as `hmp-commission.mjs`, and for the same reason:
 *   a rule the courier must remember is behavioural, a command it is handed is not.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isMainModule } from './lib/is-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The READ-ONLY verb allowlist. This is the fence. Adding a verb here is a governance act, not a
 * refactor: the safety argument for this whole channel is that a forged message cannot do harm,
 * and that argument survives exactly as long as every verb in this set is read-only.
 *
 * `[PO-RELAY]` may NEVER express: merge · push · scope/direction/epics · role reassignment ·
 * `autonomy: eligible` · disposing of a `critical`. Those are the PO's, and they are reserved
 * to a human at a terminal. See `modules/relay/docs/hmp-bidirectional-relay.md` §3a.
 */
export const READ_ONLY_VERBS = Object.freeze(['status', 'report']);

export const REFUSAL = {
  UNKNOWN_VERB: 'unknown-verb',
  VERB_NOT_READ_ONLY: 'verb-not-read-only',
  MISSING_FIELD: 'missing-field',
  NOTE_TOO_LONG: 'note-too-long',
  BAD_PEER: 'bad-peer',
};

/**
 * Verbs a reader might plausibly try that are explicitly OUT of scope for this step. Named
 * individually so the refusal says *why* rather than "unknown" — a courier relaying
 * `verb-not-read-only` tells the PO something true; `unknown-verb` would imply a typo.
 */
export const WRITE_VERBS = Object.freeze([
  'stop', 'halt', 'merge', 'push', 'prioritise', 'priority', 'answer',
  'approve', 'assign', 'eligible', 'dispose', 'launch', 'commission',
]);

/** HMP's own text ceiling is 2048; a note is a pointer, not a transcript. */
const NOTE_MAX = 400;
const PEER = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export const INBOX_REL = 'design/operator/inbox';

class UsageError extends Error {}

const refuse = (reason, detail) => ({ ok: false, reason, detail: detail ?? null });

/**
 * The inbox lives in the PRIMARY checkout, always — one durable location the PO can look at,
 * independent of whichever worktree happens to be reading it.
 *
 * `--git-common-dir` is the worktree-aware pointer to the shared `.git`, so from a linked
 * worktree it still names the primary. `--path-format=absolute` is load-bearing: without it git
 * answers a bare relative `.git` when run in the primary, which resolves against the wrong cwd —
 * the exact path-bug family BL-101/BL-106 were filed for.
 */
export function primaryRoot(cwd = __dirname) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return common ? path.dirname(common) : null;
  } catch {
    return null;
  }
}

export const inboxDir = (root) => path.join(root, INBOX_REL);

// ---------------------------------------------------------------------------
// The fence
// ---------------------------------------------------------------------------

/**
 * Validate a relayed instruction. Pure — it decides, it does not act. Nothing downstream of a
 * `pass` here performs an action either; `receive` writes a note to disk and stops.
 */
export function validate({ from, verb, note }) {
  if (!from) return refuse(REFUSAL.MISSING_FIELD, 'from');
  if (!verb) return refuse(REFUSAL.MISSING_FIELD, 'verb');
  if (!PEER.test(from)) return refuse(REFUSAL.BAD_PEER, from);

  const v = String(verb).trim().toLowerCase();
  if (WRITE_VERBS.includes(v)) {
    return refuse(
      REFUSAL.VERB_NOT_READ_ONLY,
      `'${v}' is out of scope for the read-only relay; it needs the [PO-RELAY] decision and BL-107`,
    );
  }
  if (!READ_ONLY_VERBS.includes(v)) {
    return refuse(REFUSAL.UNKNOWN_VERB, `'${v}'; allowed: ${READ_ONLY_VERBS.join(', ')}`);
  }

  if (note != null && String(note).length > NOTE_MAX) {
    return refuse(REFUSAL.NOTE_TOO_LONG, `${String(note).length} > ${NOTE_MAX}`);
  }

  return { ok: true, reason: null, detail: null, verb: v, from, note: note ? String(note) : null };
}

// ---------------------------------------------------------------------------
// The inbox
// ---------------------------------------------------------------------------

const stamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-');

export function writeMessage(root, { from, verb, note }, now = new Date()) {
  const dir = inboxDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const id = `${stamp(now)}-${verb}-${from}`;
  const body = [
    '---',
    'tag: PO-RELAY',
    `from: ${from}`,
    `verb: ${verb}`,
    `received: ${now.toISOString()}`,
    'status: pending',
    '---',
    '',
    note ?? '(no note)',
    '',
    '> Relayed over HMP. **`[PO-RELAY]` is not `[PO]`** — it is binding only within the read-only',
    '> verb fence (`modules/relay/docs/hmp-bidirectional-relay.md` §3a). This channel is unauthenticated',
    '> ([[BL-107]]), which is safe here precisely because a forged read-only request costs nothing.',
    '> It may NOT authorise a merge, a push, a scope change, a role reassignment, `autonomy:',
    '> eligible`, or the disposition of a `critical`. Those need a human at a terminal.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, `${id}.md`), body);
  return { id, file: path.join(INBOX_REL, `${id}.md`) };
}

/**
 * Every relayed request in the inbox. **Files that are not relayed requests are skipped.**
 *
 * WHY THE SKIP EXISTS (found live 2026-07-31, the first time an approval was ever granted):
 *   This directory is a shared, writable location — Hermes's allowlist covers `design/operator/**`,
 *   a human may drop a note in it, and [[BL-110]] step 3 briefly wrote approval records here. Any
 *   `.md` that is not a request used to parse to a row of `null`s, which the CLI printer then
 *   crashed on (`.padEnd` of null). A **fail-open parser feeding a fail-hard printer**: the parse
 *   politely returned nothing while the print insisted on something.
 *
 *   A file carrying NONE of the three fields is not a malformed message, it is **not a message** —
 *   so it is not listed. A file carrying SOME of them IS a message, possibly damaged, and stays in
 *   the list with its gaps visible: that is diagnostic information, and silently hiding a
 *   half-written request would be the worse failure.
 */
export function listMessages(root) {
  const dir = inboxDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      const field = (k) => (text.match(new RegExp(`^${k}: (.*)$`, 'm')) ?? [])[1] ?? null;
      return { id: f.replace(/\.md$/, ''), file: f, verb: field('verb'), from: field('from'), status: field('status') };
    })
    .filter((m) => m.verb !== null || m.from !== null || m.status !== null);
}

/**
 * One `list` row. Exported so the null-guard below is testable directly — the CLI calls THIS
 * function, so there is no stub standing in for production ([[BL-111]]: an injected seam moves the
 * untested surface, it does not remove it).
 *
 * Defence in depth behind `listMessages`' skip: a request carrying SOME fields still reaches here,
 * and a damaged one must render its gaps rather than take the whole listing down. `list` is a
 * diagnostic, and the moment it is most needed is exactly the moment the inbox holds something odd.
 */
export function formatRow(m) {
  const cell = (v, w) => String(v ?? '—').padEnd(w);
  return `${cell(m.status, 7)} ${cell(m.verb, 7)} ${cell(m.from, 10)} ${m.id}`;
}

export function ackMessage(root, id) {
  const p = path.join(inboxDir(root), `${id}.md`);
  if (!fs.existsSync(p)) return refuse('no-such-message', id);
  const text = fs.readFileSync(p, 'utf-8');
  if (!/^status: pending$/m.test(text)) return refuse('not-pending', id);
  fs.writeFileSync(p, text.replace(/^status: pending$/m, `status: acked\nacked: ${new Date().toISOString()}`));
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const [verb, ...rest] = argv.slice(2);
  const opts = { cmd: verb };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--from') opts.from = rest[++i];
    else if (a === '--verb') opts.verb = rest[++i];
    else if (a === '--note') opts.note = rest[++i];
    else if (a === '--json') opts.json = true;
    else if (!a.startsWith('--') && !opts.id) opts.id = a;
    else throw new UsageError(`unknown option: ${a}`);
  }
  return opts;
}

export function main(argv) {
  const opts = parseArgs(argv);
  const root = primaryRoot();
  if (!root) throw new Error('could not resolve the primary checkout — is this a git repository?');

  if (opts.cmd === 'receive') {
    const checked = validate(opts);
    if (!checked.ok) {
      console.log(`refused: ${checked.reason}${checked.detail ? ` (${checked.detail})` : ''}`);
      return 1;
    }
    const { id, file } = writeMessage(root, checked);
    console.log(`accepted: ${checked.verb} from ${checked.from} → ${file}`);
    console.log('note: this is a REQUEST, queued for the session. It grants no authority.');
    return 0;
  }

  if (opts.cmd === 'list') {
    const msgs = listMessages(root);
    if (opts.json) console.log(JSON.stringify(msgs, null, 2));
    else if (!msgs.length) console.log('inbox empty');
    else for (const m of msgs) console.log(formatRow(m));
    return 0;
  }

  if (opts.cmd === 'ack') {
    if (!opts.id) throw new UsageError('ack requires a message id');
    const r = ackMessage(root, opts.id);
    if (!r.ok) {
      console.log(`refused: ${r.reason} (${r.detail})`);
      return 1;
    }
    console.log(`acked: ${r.id}`);
    return 0;
  }

  throw new UsageError(`unknown command: ${opts.cmd ?? '(none)'}`);
}

/**
 * Whether this file was run as a script rather than imported.
 *
 * `path.resolve` does NOT resolve symlinks, but `import.meta.url` is already a real path. On
 * macOS `/tmp` is a symlink to `/private/tmp`, so invoking this by absolute path —
 * `node /tmp/att-relay1/scripts/relay-inbox.mjs …` — made the two sides differ, the guard read
 * false, and **`main` never ran: no output, exit 0.** A silent no-op that reports success is the
 * worst failure mode available, and it is the one this had.
 *
 * Found live: a relayed message came back `completed` with an empty reply, and the courier turned
 * out to have executed the command faithfully — the fault was here. Note the invocation style
 * that triggers it is the one the runbook mandates ("invoke by absolute path") and the only one
 * a remote courier can use.
 *
 * `realpathSync` throws on a missing path, so it is guarded; a failure to resolve must fall back
 * to "not invoked directly" rather than crash an import.
 */
const invokedDirectly = isMainModule(import.meta.url);
if (invokedDirectly) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    console.error(e instanceof UsageError ? `usage: ${e.message}` : `internal error: ${e.stack ?? e.message}`);
    console.error('\nnode scripts/relay-inbox.mjs receive --from <peer> --verb <status|report> [--note "<text>"]');
    console.error('node scripts/relay-inbox.mjs list [--json]');
    process.exit(2);
  }
}
