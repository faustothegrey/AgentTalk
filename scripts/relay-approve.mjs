#!/usr/bin/env node

/**
 * Token-bound merge/push/launch authorization over the relay — [[BL-110]] step 3, [[BL-137]].
 *
 * USAGE:
 *   node scripts/relay-approve.mjs propose --action <merge|push> --branch <b> [--ttl <mins>]
 *   node scripts/relay-approve.mjs propose --action launch --run <id> [--ttl <mins>]
 *   node scripts/relay-approve.mjs approve <token>
 *   node scripts/relay-approve.mjs status <token>
 *   node scripts/relay-approve.mjs list
 *
 * `launch` ([[BL-137]]) is the PO's authorization for one operator run, and it is the ONLY action
 * whose approval writes the repo: it commits `design/po/<run>.authorized`. The PO's whole act is
 * `approve <token>` — they never touch the path. See `writeAuthorization` for why the commit is
 * verified rather than assumed, and the threat-model note in `hmp-commission.mjs` for why the
 * location buys DETECTION and not prevention.
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
// Named imports ONLY — both modules export `primaryRoot`, and a wildcard would shadow ours
// (re-gate F4). Importing is side-effect-free: that module's CLI sits behind an `isMainModule` guard.
import { authorizationLineFor, authorizationPathFor, RUN_ID, CHARTER } from './hmp-commission.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The actions a proposal may name. Adding one is a governance act, not a refactor.
 *
 * `launch` added by [[BL-137]]: approving one WRITES AND COMMITS the run's authorization file, so
 * unlike `merge`/`push` — which only ever hand a verdict back to the session — this action has a
 * side effect on the repo. That asymmetry is why `approve` verifies its own commit (see `approve`).
 */
export const ACTIONS = Object.freeze(['merge', 'push', 'launch']);

/** Actions whose approval writes the repo, and therefore require `run`. */
export const REPO_WRITING_ACTIONS = Object.freeze(['launch']);

export const REFUSAL = {
  UNKNOWN_TOKEN: 'unknown-token',
  EXPIRED: 'expired',
  ALREADY_USED: 'already-used',
  SHA_MOVED: 'sha-moved',
  BAD_TOKEN: 'bad-token',
  BAD_ACTION: 'bad-action',
  NO_BRANCH: 'no-branch',
  MISSING_FIELD: 'missing-field',
  /**
   * [[BL-137]] / bar B9. `git()` swallows every failure and returns null, so without a reason of
   * its own a failed authorize commit would return `ok: true` — the PO believing they authorized,
   * the token spent, and the commission later refusing `no-po-authorization` for reasons no one
   * could trace back to here. A missing NOTIFICATION is cosmetic and is deliberately swallowed
   * (see `announce`); a missing AUTHORIZATION is the act not having happened.
   */
  COMMIT_FAILED: 'commit-failed',
  /** A run id `propose` would accept but `hmp-commission.mjs` would later refuse. Bar B10. */
  BAD_RUN_ID: 'bad-run-id',
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
export function propose({ root, action, branch, run, ttlMin = DEFAULT_TTL_MIN, now = Date.now(), token }) {
  if (!action) return refuse(REFUSAL.MISSING_FIELD, 'action');

  // ORDER IS LOAD-BEARING (plan §5 / re-gate G2). `branch` may only be defaulted AFTER the action
  // is known to be valid. Defaulted before the `!branch` guard, an INVALID action with no branch
  // would start reporting `bad-action` where it reports `missing-field` today. No existing bar
  // breaks either way — `:82` supplies a branch — which is exactly why this is written down.
  const isRepoWriting = REPO_WRITING_ACTIONS.includes(action);
  if (!branch && !isRepoWriting) return refuse(REFUSAL.MISSING_FIELD, 'branch');
  if (!ACTIONS.includes(action)) return refuse(REFUSAL.BAD_ACTION, `'${action}'; allowed: ${ACTIONS.join(', ')}`);

  // A repo-writing action authorizes ONE named run. Validated against the commission's own RUN_ID,
  // imported rather than copied: a run id proposable here but refusable there is a defect.
  if (isRepoWriting) {
    if (!run) return refuse(REFUSAL.MISSING_FIELD, 'run');
    if (!RUN_ID.test(String(run))) return refuse(REFUSAL.BAD_RUN_ID, String(run).slice(0, 40));
  }

  const effectiveBranch = branch || (isRepoWriting ? CHARTER.authorizedRef : branch);
  const sha = shaOf(root, effectiveBranch);
  if (!sha) return refuse(REFUSAL.NO_BRANCH, effectiveBranch);

  const tok = token ?? crypto.randomBytes(4).toString('hex');
  const record = {
    token: tok,
    action,
    branch: effectiveBranch,
    // Present only for repo-writing actions, so a `merge`/`push` record is byte-identical to what
    // it was before [[BL-137]] (bar B8).
    ...(isRepoWriting ? { run: String(run) } : {}),
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

  // COMMIT BEFORE BURN ([[BL-137]] plan §4.4, gate-1 F3). The authorization must exist in the repo
  // before the token is spent. The other order returns `ok: true` on a silently failed commit —
  // `git()` swallows failures — leaving the PO believing they authorized, the token spent, and the
  // commission refusing `no-po-authorization` with nothing pointing back here.
  //
  // The crash window between the two is SAFE and fails closed: if the process dies after the commit
  // but before the burn, a retry re-resolves the branch — now one commit ahead — and refuses
  // `sha-moved`. The authorization exists but is unusable without a fresh proposal. Do not "fix"
  // that by burning first.
  let authorized = null;
  if (REPO_WRITING_ACTIONS.includes(rec.action)) {
    authorized = writeAuthorization(root, rec.run);
    if (!authorized.ok) return authorized;
  }

  const used = { ...rec, usedAt: new Date(now).toISOString(), ...(authorized ? { authorizedAt: authorized.sha } : {}) };
  fs.writeFileSync(path.join(storeDir(root), `${tok}.json`), `${JSON.stringify(used, null, 2)}\n`);
  announce(root, used);
  return { ok: true, record: used };
}

/**
 * Write and commit the run's authorization, then PROVE it landed before reporting success.
 *
 * Two things this must not do, both learned rather than assumed:
 *   1. Trust `git()`. It returns `null` on every failure and discards stderr, so "it didn't throw"
 *      is not evidence. The commit is verified by reading the blob back out of the new HEAD.
 *   2. Commit anything else. The PO approved a tree and is getting that tree plus THIS one line;
 *      a second file in this commit is work they never saw, which is what `sha-moved` exists to
 *      prevent. The path is pathspec-staged, and the commit's file list is asserted (bar B5).
 */
export function writeAuthorization(root, run) {
  const rel = authorizationPathFor(run);
  const abs = path.join(root, rel);
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${authorizationLineFor(run)}\n`);
  } catch (e) {
    return refuse(REFUSAL.COMMIT_FAILED, `could not write ${rel}: ${e.message}`);
  }

  if (git(['add', '--', rel], root) === null) return refuse(REFUSAL.COMMIT_FAILED, `git add ${rel}`);
  if (git(['commit', '-m', `authorize(${run}): ${authorizationLineFor(run)}`, '--', rel], root) === null) {
    return refuse(REFUSAL.COMMIT_FAILED, `git commit ${rel}`);
  }

  // Verification, not optimism: the blob must be readable at the new HEAD, and that commit must
  // have touched exactly one path.
  const head = git(['rev-parse', 'HEAD'], root);
  if (!head) return refuse(REFUSAL.COMMIT_FAILED, 'HEAD unreadable after commit');
  const blob = git(['show', `${head}:${rel}`], root);
  if (blob === null || blob.trim() !== authorizationLineFor(run)) {
    return refuse(REFUSAL.COMMIT_FAILED, `${rel} not committed at ${head.slice(0, 8)}`);
  }
  const touched = git(['show', '--name-only', '--format=', head], root);
  const files = (touched ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (files.length !== 1 || files[0] !== rel) {
    return refuse(REFUSAL.COMMIT_FAILED, `authorize commit touched ${files.length} path(s): ${files.join(', ')}`);
  }
  return { ok: true, sha: head, path: rel };
}

/** Where consumed approvals are announced. Deliberately NOT the request inbox — see `announce`. */
export const ANNOUNCE_REL = path.join('design', 'operator', 'approvals');

/**
 * Tell the session an approval landed. This note is a NOTIFICATION, not an authority: the session
 * must re-read the store before acting. A note under `design/operator/**` is courier-writable and
 * the store is not — which is the whole reason they are different places.
 *
 * ⚠️ THIS WRITES TO `design/operator/approvals/`, NOT THE REQUEST INBOX — a fix, not a preference.
 * The first version reused `design/operator/inbox/`, reasoning that the session already watched it.
 * The **first approval ever granted** (2026-07-31, TL-014 leg C) then crashed `relay-inbox.mjs
 * list`, which parses everything in that directory as a relayed request; an approval record carries
 * none of the fields a request has.
 *
 * The crash was the symptom. The design error was **putting a record and a request in one directory
 * because they happened to share a watcher.** They are different kinds of thing — a request is
 * inbound and pending, an approval is a consumed decision — and a reader forced to guess which it
 * holds will eventually guess wrong. A shared watch is not a reason to conflate two types: widening
 * the watch is the cheap part, untangling the types is not.
 *
 * So the session's watch must cover `design/operator/**`, not the inbox alone.
 */
function announce(root, rec) {
  try {
    const dir = path.join(root, ANNOUNCE_REL);
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
    const r = propose({
      root,
      action: f.action,
      branch: f.branch,
      run: f.run,
      ttlMin: f.ttl ? Number(f.ttl) : undefined,
    });
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
