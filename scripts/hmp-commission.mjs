#!/usr/bin/env node

/**
 * HMP commissioning — the single lawful entry point for an operator run.
 *
 * USAGE:
 *   node scripts/hmp-commission.mjs --text-file <path>   # or --text "<commission>", or - for stdin
 *   node scripts/hmp-commission.mjs --text-file <path> --dry-run
 *
 * Exit codes:
 *   0  every check passed; the run was launched (or, with --dry-run, would have been)
 *   1  refused. One line on stdout: `refused: <reason>` — relay it verbatim
 *   2  the verifier itself crashed. Kept distinct from 1 on purpose: a broken
 *      verifier must never be misread as a clean refusal
 *
 * WHY THIS FILE EXISTS
 *   `design/hmp-session-submission.md` §4 says the receiver of a launch-class HMP message
 *   MUST verify authorization "before doing anything else". That was written expecting a
 *   receiver with a dispatch table. The live receiver is an LLM with a shell (Hermes,
 *   `toolsets: [hermes-cli]`), so a rule of the form "you must verify first" is BEHAVIOURAL —
 *   precisely what BL-097 was filed to end for the operator write fence.
 *
 *   So the verification is not a step the operator performs. It is the ONLY command the
 *   operator is given. There is no separate launch step to skip, because the launcher's path
 *   is never handed over. Every check fails closed.
 *
 *   HONEST LIMIT, stated here so nobody has to infer it: this is a FENCE, NOT A SANDBOX.
 *   Hermes holds a shell and could find `launcher.mjs` on its own. What this buys is that the
 *   lawful path is the only documented one, that any bypass is visibly off-script, and that a
 *   lawful launch leaves a trail anchored in a commit. Do not describe it as containment.
 *
 * THE THREAT MODEL, AND WHAT ACTUALLY DEFENDS AGAINST IT
 *   HMP is unauthenticated and LAN-reachable on this host (BL-107). A `from` field is
 *   self-asserted; an `authorized-by: PO` string in a payload is a claim, not a control. So
 *   authorization is anchored in the repo instead: the brief must be COMMITTED, and reachable
 *   from `master`. A LAN forger can compose any message it likes and cannot make a commit be
 *   an ancestor of master. That is the check doing real work against the real adversary — and
 *   it makes the PO's merge the authorization act, which is where the charter already puts it.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const DISCRIMINATOR = 'AGENTTALK-RUN';

/**
 * Every refusal reason. These strings are the operator's reply, so they are part of the
 * contract: a grader reads them. Never collapse two causes into one reason — "we refused"
 * without saying which check tripped is how a real defect gets read as a config typo.
 */
export const REFUSAL = {
  MALFORMED: 'malformed-commission',
  BRIEF_OUTSIDE_REPO: 'brief-outside-repo',
  SHA_NOT_A_COMMIT: 'sha-not-a-commit',
  SHA_NOT_ON_MASTER: 'sha-not-on-master',
  BRIEF_NOT_COMMITTED: 'brief-not-committed',
  NO_PO_AUTHORIZATION: 'no-po-authorization',
  BAR_HASH_MISMATCH: 'bar-hash-mismatch',
  CHARTER_MISMATCH: 'charter-mismatch',
  RECURSIVE_COMMISSION: 'recursive-commission',
  CONFIG_NOT_COMMITTED: 'config-not-committed',
  MISSING_CAP_METER: 'missing-cap-meter',
  CRITICAL_OUTSTANDING: 'critical-outstanding',
  ALREADY_LAUNCHED: 'already-launched',
};

/** The OPERATOR charter's containment parameters, restated so a mismatch can be refused. */
export const CHARTER = {
  port: 3600,
  sandboxPattern: /^att-op-[a-z0-9][a-z0-9-]*$/,
  authorizedRef: 'master',
};

export const REQUIRED_FIELDS = ['run', 'brief', 'repo-sha', 'bar-sha256', 'port', 'sandbox'];
const RUN_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** Where a lawful launch is recorded, so the same run id can never launch twice. */
export const LAUNCH_LEDGER = 'design/operator/.hmp-launched.json';

class UsageError extends Error {}

/**
 * A refusal is a value, not an exception: the CLI and the tests read the same shape, and a
 * caller cannot accidentally swallow one with a bare catch.
 */
const refuse = (reason, detail) => ({ ok: false, reason, detail: detail ?? null });
const pass = (extra) => ({ ok: true, reason: null, detail: null, ...extra });

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * The commission is ONE line of ` | `-separated `key=value` pairs opening with the literal
 * discriminator. Lines after it are the operator's own instructions (the command to run) and
 * are deliberately IGNORED here: they steer Hermes, they are not part of what we verify.
 *
 * Unknown fields are refused rather than ignored. An ignored field is a field an attacker can
 * add meaning to later, and a typo'd `port` that silently reverts to a default is exactly the
 * kind of quiet pass this whole file exists to prevent.
 */
export function parseCommission(text) {
  if (typeof text !== 'string' || text.trim() === '') return refuse(REFUSAL.MALFORMED, 'empty');

  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(DISCRIMINATOR));
  if (!line) return refuse(REFUSAL.MALFORMED, `no line starts with ${DISCRIMINATOR}`);

  const parts = line.split('|').map((p) => p.trim()).filter((p) => p !== '');
  if (parts.shift() !== DISCRIMINATOR) return refuse(REFUSAL.MALFORMED, 'discriminator not first');

  const fields = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) return refuse(REFUSAL.MALFORMED, `not a key=value pair: ${part}`);
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!REQUIRED_FIELDS.includes(key)) return refuse(REFUSAL.MALFORMED, `unknown field: ${key}`);
    if (key in fields) return refuse(REFUSAL.MALFORMED, `duplicate field: ${key}`);
    if (value === '') return refuse(REFUSAL.MALFORMED, `empty value: ${key}`);
    fields[key] = value;
  }

  const missing = REQUIRED_FIELDS.filter((f) => !(f in fields));
  if (missing.length) return refuse(REFUSAL.MALFORMED, `missing field(s): ${missing.join(', ')}`);

  if (!RUN_ID.test(fields.run)) return refuse(REFUSAL.MALFORMED, `bad run id: ${fields.run}`);
  if (!SHA40.test(fields['repo-sha'])) return refuse(REFUSAL.MALFORMED, 'repo-sha is not 40 hex');
  if (!SHA256.test(fields['bar-sha256'])) return refuse(REFUSAL.MALFORMED, 'bar-sha256 is not 64 hex');
  if (!/^\d+$/.test(fields.port)) return refuse(REFUSAL.MALFORMED, `port is not numeric: ${fields.port}`);

  return pass({ commission: { ...fields, port: Number(fields.port) } });
}

// ---------------------------------------------------------------------------
// Authorization — an exact format, not a phrase
// ---------------------------------------------------------------------------

/**
 * Authorization is a DISCRETE FILE, not a phrase inside the brief — and it took two refutations
 * of the same shape to get here, both worth keeping in view.
 *
 * Draft 1 searched the brief for `[PO]` plus the run id. Gate 1 refuted it: a brief saying
 * "this run has NO [PO] authorization for hmp1" satisfies a substring search. Fixed by anchoring
 * the whole line.
 *
 * Draft 2 was refuted BY RUNNING IT. The anchored check accepted a brief whose entire point was
 * that it was NOT authorized — because that brief QUOTES the required line in a fenced code
 * block, to document what the PO must add. A line-anchored matcher cannot distinguish an example
 * from the real thing, and stripping code fences does not save it: a four-space-indented block,
 * or a blockquote, quotes the line just as well. The mechanism was wrong, not the regex.
 *
 * So authorization lives in `design/operator/<run>.authorized`, whose ENTIRE committed content
 * must be exactly the line. Quoting it inside any document is then harmless by construction, and
 * "the PO authorized run X" becomes a discrete, diffable, committed act rather than a sentence
 * buried in prose — which is what §4 wanted in the first place.
 */
export const authorizationLineFor = (runId) => `[PO] AUTHORIZED-RUN: ${runId}`;

export const authorizationPathFor = (runId) => path.posix.join('design/operator', `${runId}.authorized`);

/** Whole-content equality, whitespace-normalised. Anything ELSE in the file refuses. */
export function isAuthorizationFile(text, runId) {
  return text.trim().replace(/\s+/g, ' ') === authorizationLineFor(runId);
}

/**
 * Recursion fence. The charter states an operator's goal is never "launch a session"; over a
 * network that stops being theoretical.
 *
 * This is a HEURISTIC and therefore a fence with holes — a brief could describe a launch in
 * words none of these patterns match. It is kept because the failure it catches (a commission
 * that commissions) is severe and the false-positive cost is a reworded brief.
 */
const LAUNCH_PATTERNS = [
  /launcher\.mjs/i,
  /hmp-commission\.mjs/i,
  new RegExp(DISCRIMINATOR, 'i'),
  /\/hmp\/send/i,
  /\bstart_pair_chat\b/i,
  /\blaunch\s+(a|an|another|the)\s+(session|run|operator|worker)\b/i,
  /\bcommission\s+(a|an|another|the)\s+(session|run)\b/i,
];

export function findsLaunchInstruction(text) {
  return LAUNCH_PATTERNS.find((re) => re.test(text)) ?? null;
}

// ---------------------------------------------------------------------------
// git reads — the object store, never the working tree
// ---------------------------------------------------------------------------

const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

/**
 * §4 as first written said "confirm the file exists and is committed", which a dirty working
 * tree satisfies while the commission means something else entirely. Reading the blob AT the
 * sha makes the committed text the only text — and for the bar, it is the difference between
 * a pre-registered hash and one that can be retuned after results.
 */
export function makeGitIo(repoRoot = REPO_ROOT) {
  const run = (args) => git(args, { cwd: repoRoot });
  return {
    objectType(sha) {
      try {
        return run(['cat-file', '-t', sha]).trim();
      } catch {
        return null;
      }
    },
    isAncestorOf(sha, ref) {
      try {
        run(['merge-base', '--is-ancestor', sha, ref]);
        return true;
      } catch {
        return false;
      }
    },
    readBlob(sha, relPath) {
      try {
        return execFileSync('git', ['cat-file', 'blob', `${sha}:${relPath}`], {
          cwd: repoRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        return null;
      }
    },
  };
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Resolve symlinks without requiring the path to exist.
 *
 * Found by running the CLI, not by the unit bars: on macOS `/tmp` is a symlink to `/private/tmp`,
 * so `REPO_ROOT` (derived from `import.meta.url`, which Node gives as a real path) came back
 * `/private/tmp/att-hmp1` while the commissioned brief said `/tmp/att-hmp1/…`. `path.relative`
 * then produced `../../tmp/…` and a brief plainly inside the repo was refused
 * `brief-outside-repo`. **On Linux it would not reproduce at all** — there is no `/tmp` symlink —
 * which is the same platform-shaped trap as [[BL-098]] and [[BL-100]].
 *
 * The brief usually does NOT exist on disk (it is read from the object store, which is the whole
 * point), so `fs.realpathSync` cannot be applied to it directly. Walk up to the nearest existing
 * ancestor, resolve that, and re-attach the remainder.
 */
export function realpathish(p) {
  let cur = path.resolve(p);
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...tail);
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p); // hit the root, nothing resolvable
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Every dependency that touches the world is injected, so the bars can drive real refusals
 * without a live orchestrator — and so a test cannot accidentally launch anything.
 *
 * @param {object}   o
 * @param {string}   o.text        the raw HMP message
 * @param {string}   o.repoRoot    the governed repo
 * @param {object}   o.io          { objectType, isAncestorOf, readBlob }
 * @param {Function} o.preflight   () => { criticals: number, detail?: string }
 * @param {Function} o.launchedRuns() => string[]  run ids already launched
 */
export function verifyCommission({ text, repoRoot = REPO_ROOT, io, preflight, launchedRuns }) {
  const parsed = parseCommission(text);
  if (!parsed.ok) return parsed;
  const c = parsed.commission;

  // Charter first: it is the cheapest check and the one whose violation means the message was
  // never meant for us. Port and sandbox are the containment parameters (BL-087).
  if (c.port !== CHARTER.port) return refuse(REFUSAL.CHARTER_MISMATCH, `port ${c.port} !== ${CHARTER.port}`);
  if (!CHARTER.sandboxPattern.test(c.sandbox)) {
    return refuse(REFUSAL.CHARTER_MISMATCH, `sandbox ${c.sandbox} is not att-op-*`);
  }

  // A brief outside the governed repo cannot be authorized by it — there is no commit to
  // anchor to. Resolve SYMLINKS on both sides before relativizing (see `realpathish`: comparing
  // a symlinked path against a real one refused briefs that were plainly inside the repo), then
  // relativize; a `..` traversal must not escape.
  const briefAbs = realpathish(c.brief);
  const briefRel = path.relative(realpathish(repoRoot), briefAbs);
  if (briefRel.startsWith('..') || path.isAbsolute(briefRel)) {
    return refuse(REFUSAL.BRIEF_OUTSIDE_REPO, briefAbs);
  }

  if (io.objectType(c['repo-sha']) !== 'commit') {
    return refuse(REFUSAL.SHA_NOT_A_COMMIT, c['repo-sha']);
  }
  // The check that actually defends against a LAN forger: it cannot make a sha reachable from
  // master. This makes the PO's merge the authorization act.
  if (!io.isAncestorOf(c['repo-sha'], CHARTER.authorizedRef)) {
    return refuse(REFUSAL.SHA_NOT_ON_MASTER, `${c['repo-sha']} is not an ancestor of ${CHARTER.authorizedRef}`);
  }

  const briefBuf = io.readBlob(c['repo-sha'], briefRel);
  if (!briefBuf) return refuse(REFUSAL.BRIEF_NOT_COMMITTED, `${briefRel} @ ${c['repo-sha']}`);
  const brief = briefBuf.toString('utf-8');

  // Authorization: its own committed file, whose whole content is the line. See the note on
  // `isAuthorizationFile` — checking the BRIEF for the line accepted a brief that said it was
  // unauthorized, because the brief quoted the line as an example.
  const authRel = authorizationPathFor(c.run);
  const authBuf = io.readBlob(c['repo-sha'], authRel);
  if (!authBuf) {
    return refuse(REFUSAL.NO_PO_AUTHORIZATION, `no ${authRel} committed at ${c['repo-sha'].slice(0, 8)}`);
  }
  if (!isAuthorizationFile(authBuf.toString('utf-8'), c.run)) {
    return refuse(REFUSAL.NO_PO_AUTHORIZATION, `${authRel} must contain exactly: ${authorizationLineFor(c.run)}`);
  }

  const launchPattern = findsLaunchInstruction(brief);
  if (launchPattern) return refuse(REFUSAL.RECURSIVE_COMMISSION, `brief matches ${launchPattern}`);

  // The bar, hashed as committed. Its path is a convention, not a field: one less degree of
  // freedom for a forger to vary, and one less thing to keep consistent by hand.
  const barRel = path.posix.join('design/operator', `${c.run}-bar.md`);
  const barBuf = io.readBlob(c['repo-sha'], barRel);
  if (!barBuf) return refuse(REFUSAL.BAR_HASH_MISMATCH, `bar not committed: ${barRel}`);
  const actualBar = sha256(barBuf);
  if (actualBar !== c['bar-sha256']) {
    return refuse(REFUSAL.BAR_HASH_MISMATCH, `${barRel}: committed ${actualBar} !== commissioned ${c['bar-sha256']}`);
  }

  // The launcher config, also by convention and also read at the sha, so what gets launched is
  // pinned to reviewed content rather than to whatever is on disk at launch time.
  const configRel = path.posix.join('design/operator', `${c.run}.config.json`);
  const configBuf = io.readBlob(c['repo-sha'], configRel);
  if (!configBuf) return refuse(REFUSAL.CONFIG_NOT_COMMITTED, `${configRel} @ ${c['repo-sha']}`);
  let config;
  try {
    config = JSON.parse(configBuf.toString('utf-8'));
  } catch (e) {
    return refuse(REFUSAL.CONFIG_NOT_COMMITTED, `${configRel} is not valid JSON: ${e.message}`);
  }

  // `cap.meter` is MANDATORY per the charter, not advisory: the operator's worker draws on the
  // same provider pool as the supervising session, and a named-but-unmitigated budget risk
  // already took a session window to 100%.
  const meter = config?.caps?.meter ?? config?.cap?.meter;
  if (!meter || typeof meter.url !== 'string' || typeof meter.provider !== 'string') {
    return refuse(REFUSAL.MISSING_CAP_METER, `${configRel} has no usable caps.meter { url, provider }`);
  }

  // Bind the committed config to the commission, so the sandbox named in the message is the
  // directory actually launched into.
  const workdir = config?.agents?.[0]?.workdir ?? config?.workdir ?? null;
  if (typeof workdir !== 'string' || path.basename(workdir) !== c.sandbox) {
    return refuse(REFUSAL.CHARTER_MISMATCH, `config workdir ${workdir} does not end in ${c.sandbox}`);
  }

  // A `critical` gates the next operator run. BL-109 records that "uncleared" has nowhere to
  // live yet, so this is deliberately the fail-closed reading: any critical NOW refuses, even
  // one the PO has already dispositioned out of band.
  const pre = preflight();
  if (pre.criticals > 0) {
    return refuse(REFUSAL.CRITICAL_OUTSTANDING, pre.detail ?? `${pre.criticals} critical finding(s)`);
  }

  if (launchedRuns().includes(c.run)) return refuse(REFUSAL.ALREADY_LAUNCHED, c.run);

  return pass({ commission: c, brief, config, barSha256: actualBar, briefRel, barRel, configRel });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function readLaunchLedger(repoRoot = REPO_ROOT) {
  const p = path.join(repoRoot, LAUNCH_LEDGER);
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return Array.isArray(parsed?.launched) ? parsed.launched.map((r) => r.run) : [];
  } catch {
    // A corrupt ledger must not read as "nothing launched yet" — that would re-enable a
    // double launch. Throwing lands on exit 2, which is the honest signal.
    throw new Error(`launch ledger is unreadable: ${p}`);
  }
}

/**
 * The pre-flight sweep, and a correction worth keeping visible.
 *
 * The first version of this ran `infra-invariant.mjs snapshot` and counted the word "critical"
 * in its output. That was a NO-OP: `snapshot` records state and emits no findings at all, so
 * the count was always 0 and check 7 could never fire. The unit bars did not catch it because
 * they inject `preflight` — the seam that makes them clean is exactly what left the real
 * implementation unexercised. Caught by running the command and reading the output (grep
 * count: 0), which is the only reason it is not still there.
 *
 * `infra-invariant` is diff-based (`check --before <baseline>`) and there is no baseline at
 * commission time. The current-state question — "is the world dirty right now?" — is what
 * `check-orchestrator-ports.mjs` answers: exit 0 clean, exit 1 on a LEAKED or UNKNOWN
 * listener. That is the right instrument for this check.
 *
 * The runner is injected so the exit-code mapping itself is testable — one level below the
 * `preflight` seam, since that seam is what hid the original defect.
 */
export function realPreflight({ runner = defaultSweepRunner } = {}) {
  try {
    const { code, output } = runner();
    if (code === 0) return { criticals: 0, detail: null };
    const flagged = (output.match(/\[(LEAKED|UNKNOWN)\]/g) ?? []).length || 1;
    return { criticals: flagged, detail: `port/process sweep exit ${code}: ${flagged} listener(s) flagged` };
  } catch (e) {
    // "We could not look" must never outrank a clean read — the harness's own rule (`:181`).
    return { criticals: 1, detail: `pre-flight could not run: ${e.message}` };
  }
}

function defaultSweepRunner() {
  try {
    const output = execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts/check-orchestrator-ports.mjs')], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (e) {
    // A non-zero exit is a FINDING, not a crash — execFileSync throws on both, so they must be
    // told apart here or a dirty world reads as an unreadable one.
    if (typeof e.status === 'number') return { code: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    throw e;
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--text') opts.text = argv[++i];
    else if (a === '--text-file') opts.textFile = argv[++i];
    else throw new UsageError(`unknown option: ${a}`);
  }
  if (!opts.text && !opts.textFile) throw new UsageError('one of --text or --text-file is required');
  return opts;
}

export function main(argv) {
  const opts = parseArgs(argv);
  const text = opts.text ?? fs.readFileSync(opts.textFile === '-' ? 0 : opts.textFile, 'utf-8');

  const result = verifyCommission({
    text,
    io: makeGitIo(),
    preflight: () => realPreflight(),
    launchedRuns: () => readLaunchLedger(),
  });

  if (!result.ok) {
    console.log(`refused: ${result.reason}${result.detail ? ` (${result.detail})` : ''}`);
    return 1;
  }

  const { commission: c } = result;
  console.log(`accepted: run=${c.run} brief=${result.briefRel}@${c['repo-sha'].slice(0, 8)} bar=${result.barSha256.slice(0, 12)}`);
  if (opts.dryRun) {
    console.log('dry-run: verified only, nothing launched');
    return 0;
  }

  // Deliberately NOT implemented in this task. T1 is the fence; T2 is the first live launch,
  // and it needs its own [PO] go. Printing the plan and exiting 0 is the honest state — an
  // `accepted` that silently did nothing would be exactly the `completed` ≠ done trap.
  console.log('launch: NOT WIRED — T2 pending an explicit [PO] go (design/hmp-commission-plan.md §3)');
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    console.error(e instanceof UsageError ? `usage: ${e.message}` : `internal error: ${e.stack ?? e.message}`);
    console.error('\nnode scripts/hmp-commission.mjs --text-file <path> [--dry-run]');
    process.exit(2);
  }
}
