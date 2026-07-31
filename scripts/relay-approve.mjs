#!/usr/bin/env node

/**
 * Token-bound merge/push authorization over the relay — [[BL-110]] step 3.
 *
 * USAGE:
 *   node scripts/relay-approve.mjs propose --action <merge|push> --branch <b> [--ttl <mins>]
 *   node scripts/relay-approve.mjs approve <token>
 *   node scripts/relay-approve.mjs status <token>
 *   node scripts/relay-approve.mjs list
 *
 * Exit codes:
 *   0  proposed / approved / listed
 *   1  refused. One line: `refused: <reason>` — the courier relays it verbatim
 *   2  the handler itself crashed. Distinct from 1 on purpose ([[BL-111]]).
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT PROBLEM THIS ACTUALLY SOLVES — read before changing anything here
 *
 * The PO asked to authorize merges and pushes from Telegram (2026-07-31). Checking the config
 * rather than the docs turned up something the backlog does not say: **Telegram and HMP are
 * different channels with different security postures.** Telegram authenticates by account plus
 * `TELEGRAM_ALLOWED_USERS` (a single entry — the PO's DM); HMP runs `host: 0.0.0.0` with
 * `allow_all_peers: true` and no secret ([[BL-107]]). BL-107's "hard precondition" was written
 * about HMP and does not describe the Telegram path.
 *
 * **But the capability cannot tell them apart.** Both land in the same Hermes agent with the same
 * shell. A `merge` verb reachable from Telegram is reachable from the unauthenticated HMP port
 * the moment it exists. **Authenticating the channel you intend to use does not authenticate the
 * capability you just built** — so this file authenticates neither, and instead makes the
 * capability safe no matter who calls it.
 *
 * THE PRIMITIVE (BL-110's own best idea, applied)
 *   *"A relayed answer to a question the session already asked is capability-bounded by
 *   construction — a forger can only choose among options the session itself offered."*
 *
 *   So: the session PROPOSES a specific merge, and the relay carries only an ANSWER.
 *
 * ⚠️ AND HERE IS THE LIMIT OF THAT ARGUMENT — IT IS NOT A SECURITY CONTROL ON THIS CHANNEL
 *   The obvious claim is "a forger cannot mint a proposal, so the worst they can do is approve a
 *   merge the session already prepared." **On this channel that claim is FALSE, and it was written
 *   down as true in the first draft of this file before being caught.**
 *
 *   An HMP message does not arrive at a fenced handler. It arrives at **Hermes — an LLM holding
 *   `toolsets: [hermes-cli]`, i.e. a shell** — which decides what to run, and which has already
 *   executed 107 messages including one that downloaded and installed a ZIP over plain HTTP. A
 *   sender who can reach that port can therefore ask it to run `propose` *and then* `approve`. Or,
 *   far more simply, to run `git push` directly and ignore this file entirely.
 *
 *   **So against a deliberate attacker on the LAN, this design buys nothing, and neither would any
 *   other design in this repo. [[BL-107]] is the only control, and it is OPEN.** Nothing here may
 *   be cited as having reduced that exposure.
 *
 * WHAT IT DOES BUY — which is real, and is why it still exists
 *   ✅ **Integrity of the thing being authorized.** The approval is bound to one action, one
 *      branch, one sha. If the branch moves between proposal and approval the token is void, so a
 *      slow human round trip cannot authorize something the PO never saw.
 *   ✅ **Replay and accident.** Single-use and expiring. A message resent by a retry, an
 *      idempotency quirk, or a scrolled-back chat cannot merge twice.
 *   ✅ **Courier corruption — the failure mode that is LIVE here.** [[BL-112]] silently excises
 *      substrings from replies. A mangled token does not match and is refused: **fails closed**,
 *      the only acceptable direction for a merge gate riding an unreliable courier.
 *   ✅ **No relay-reachable command performs a git operation** (see below), so the fenced surface
 *      gains no execute path even as this capability is added.
 *
 *   Read that list as what it is: **integrity and safety properties, not authentication.** The
 *   channel is authenticated only when it is Telegram, and this file cannot tell.
 *
 * WHY `approve` DOES NOT ITSELF MERGE
 *   It validates and records; the session performs the merge. Keeping execution out of the
 *   relay-invoked surface preserves the property that made step 1 safe — **no relay-reachable
 *   command performs a git operation.** The session that proposed is the one that just ran the
 *   closure sweep, and that is where the merge discipline lives. Splitting authorization from
 *   execution is the whole reason this can be reached from an unauthenticated port at all.
 *
 * WHERE STATE LIVES, AND WHY NOT IN THE OPERATOR DIRECTORY
 *   Pending tokens live in `.approvals/` at the repo root — **deliberately outside
 *   `design/operator/**`**, which is Hermes's write allowlist. A courier that could write its own
 *   pending proposal could mint the very capability this file exists to bound. The consumed record
 *   is a different matter and is announced into the inbox, where the session's watch sees it; the
 *   STORE is the authority and the inbox note is only a notification. Verify against the store —
 *   "grade the artifact", not the message that claims something happened.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isMainModule } from './lib/is-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The actions a proposal may name. Adding one is a governance act, not a refactor. */
export const ACTIONS = Object.freeze(['merge', 'push']);

export const REFUSAL = {
  UNKNOWN_TOKEN: 'unknown-token',
  EXPIRED: 'expired',
  ALREADY_USED: 'already-used',
  SHA_MOVED: 'sha-moved',
  BAD_TOKEN: 'bad-token',
  BAD_ACTION: 'bad-action',
  NO_BRANCH: 'no-branch',
  MISSING_FIELD: 'missing-field',
};

export const STORE_REL = '.approvals';
const DEFAULT_TTL_MIN = 10;
const TOKEN_RE = /^[0-9a-f]{8}$/;

class HandlerError extends Error {}

const refuse = (reason, detail) => ({ ok: false, reason, detail: detail ?? null });

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** Primary checkout — `--git-common-dir`, never `--show-toplevel` ([[BL-101]]/[[BL-106]]). */
export function primaryRoot(cwd = __dirname) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return common ? path.dirname(common) : null;
}

export const storeDir = (root) => path.join(root, STORE_REL);

/** The sha a branch points at right now. `null` if the branch does not exist. */
export function shaOf(root, branch) {
  return git(['rev-parse', '--verify', '--short=7', `refs/heads/${branch}`], root);
}

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

/**
 * Mint a proposal. The sha is captured NOW, and `approve` re-resolves it — so a branch that gains
 * a commit between proposal and approval voids the token rather than silently authorizing
 * something the PO never saw. That is the property that makes a slow human round trip safe.
 */
export function propose({ root, action, branch, ttlMin = DEFAULT_TTL_MIN, now = Date.now(), token }) {
  if (!action) return refuse(REFUSAL.MISSING_FIELD, 'action');
  if (!branch) return refuse(REFUSAL.MISSING_FIELD, 'branch');
  if (!ACTIONS.includes(action)) return refuse(REFUSAL.BAD_ACTION, `'${action}'; allowed: ${ACTIONS.join(', ')}`);

  const sha = shaOf(root, branch);
  if (!sha) return refuse(REFUSAL.NO_BRANCH, branch);

  const tok = token ?? crypto.randomBytes(4).toString('hex');
  const record = {
    token: tok,
    action,
    branch,
    sha,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMin * 60_000).toISOString(),
    usedAt: null,
  };

  const dir = storeDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${tok}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return { ok: true, record };
}

// ---------------------------------------------------------------------------
// approve
// ---------------------------------------------------------------------------

export function readRecord(root, token) {
  try {
    return JSON.parse(fs.readFileSync(path.join(storeDir(root), `${token}.json`), 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Validate an approval. Every refusal path returns a NAMED reason, because a courier relaying
 * `refused: sha-moved` tells the PO something true and actionable, while a generic failure tells
 * them to try again — which is exactly the wrong instinct when the branch moved under them.
 *
 * Order matters: the token is checked for *shape* first, so a mangled relay ([[BL-112]]) is
 * reported as `bad-token` rather than as a mysterious `unknown-token`.
 */
export function approve({ root, token, now = Date.now() }) {
  if (!token) return refuse(REFUSAL.MISSING_FIELD, 'token');
  if (!TOKEN_RE.test(String(token).trim())) return refuse(REFUSAL.BAD_TOKEN, String(token).slice(0, 32));

  const tok = String(token).trim();
  const rec = readRecord(root, tok);
  if (!rec) return refuse(REFUSAL.UNKNOWN_TOKEN, tok);
  if (rec.usedAt) return refuse(REFUSAL.ALREADY_USED, `at ${rec.usedAt}`);
  if (now > Date.parse(rec.expiresAt)) return refuse(REFUSAL.EXPIRED, `expired ${rec.expiresAt}`);

  const current = shaOf(root, rec.branch);
  if (current !== rec.sha) {
    return refuse(REFUSAL.SHA_MOVED, `proposed ${rec.sha}, now ${current ?? 'gone'}`);
  }

  const used = { ...rec, usedAt: new Date(now).toISOString() };
  fs.writeFileSync(path.join(storeDir(root), `${tok}.json`), `${JSON.stringify(used, null, 2)}\n`);
  announce(root, used);
  return { ok: true, record: used };
}

/**
 * Tell the session an approval landed, via the inbox its watch already covers (step 1's
 * machinery, reused rather than duplicated). This note is a NOTIFICATION, not an authority: the
 * session must re-read the store before acting. A note in `design/operator/**` is writable by the
 * courier, and the store is not — which is the whole reason they are different places.
 */
function announce(root, rec) {
  try {
    const dir = path.join(root, 'design', 'operator', 'inbox');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = rec.usedAt.replace(/[:.]/g, '-');
    fs.writeFileSync(
      path.join(dir, `${stamp}-approval-${rec.token}.md`),
      [
        `# approval consumed: ${rec.action} ${rec.branch}`,
        '',
        `- token:  ${rec.token}`,
        `- action: ${rec.action}`,
        `- branch: ${rec.branch}`,
        `- sha:    ${rec.sha}`,
        `- usedAt: ${rec.usedAt}`,
        '',
        'This note is a NOTIFICATION, not an authority. Re-read `.approvals/` before acting —',
        'this directory is courier-writable and the store is not.',
        '',
      ].join('\n'),
    );
  } catch {
    /* the approval itself already succeeded; a failed notification must not undo it */
  }
}

export function listPending(root, now = Date.now()) {
  try {
    return fs
      .readdirSync(storeDir(root))
      .filter((f) => f.endsWith('.json'))
      .map((f) => readRecord(root, f.replace(/\.json$/, '')))
      .filter(Boolean)
      .map((r) => ({
        token: r.token,
        action: r.action,
        branch: r.branch,
        sha: r.sha,
        state: r.usedAt ? 'used' : now > Date.parse(r.expiresAt) ? 'expired' : 'pending',
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Rendering — the proposal block that goes OUT over the relay
// ---------------------------------------------------------------------------

/**
 * Deliberately shaped like `relay-status.mjs`'s payload: numbered lines a phone reader can count.
 * The gate values (`suite`, `tsc`) are passed in by the caller rather than measured here — this
 * file must not be able to claim a suite it did not run.
 */
export function renderProposal(rec, gates = {}) {
  const rows = [
    ['proposal', rec.action],
    ['branch', rec.branch],
    ['sha', rec.sha],
    ['gates', gates.summary ?? 'not stated'],
    ['expires', rec.expiresAt],
    ['reply', `approve ${rec.token}`],
  ];
  const width = Math.max(...rows.map(([k]) => k.length)) + 1;
  return `${rows.map(([k, v], i) => `${i + 1}/${rows.length} ${(`${k}:`).padEnd(width)} ${v}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}

export function main(argv = process.argv.slice(2), io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s));
  const root = io.root ?? primaryRoot();
  const cmd = argv[0];

  if (!root) throw new HandlerError('could not resolve the primary checkout');

  if (cmd === 'propose') {
    const f = parseFlags(argv.slice(1));
    const r = propose({ root, action: f.action, branch: f.branch, ttlMin: f.ttl ? Number(f.ttl) : undefined });
    if (!r.ok) {
      out(`refused: ${r.reason}${r.detail ? ` (${r.detail})` : ''}\n`);
      return 1;
    }
    out(renderProposal(r.record, { summary: f.gates }));
    return 0;
  }

  if (cmd === 'approve') {
    const r = approve({ root, token: argv[1] });
    if (!r.ok) {
      out(`refused: ${r.reason}${r.detail ? ` (${r.detail})` : ''}\n`);
      return 1;
    }
    out(`approved: ${r.record.action} ${r.record.branch} @ ${r.record.sha}\n`);
    return 0;
  }

  if (cmd === 'status') {
    const rec = readRecord(root, String(argv[1] ?? '').trim());
    if (!rec) {
      out(`refused: ${REFUSAL.UNKNOWN_TOKEN}\n`);
      return 1;
    }
    out(`${JSON.stringify(rec, null, 2)}\n`);
    return 0;
  }

  if (cmd === 'list') {
    const rows = listPending(root);
    out(rows.length ? `${rows.map((r) => `${r.token} ${r.state} ${r.action} ${r.branch} ${r.sha}`).join('\n')}\n` : 'none\n');
    return 0;
  }

  throw new HandlerError(`usage: relay-approve.mjs <propose|approve|status|list>; got ${cmd ? `'${cmd}'` : 'nothing'}`);
}

if (isMainModule(import.meta.url)) {
  try {
    process.exit(main());
  } catch (e) {
    process.stderr.write(`[relay-approve] ${e instanceof HandlerError ? e.message : `FATAL ${e.stack ?? e}`}\n`);
    process.exit(2);
  }
}
