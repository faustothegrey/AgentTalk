#!/usr/bin/env node

/**
 * The session→PO outbound pointer relay — [[BL-110]] step 2, the return leg.
 *
 * USAGE (the courier runs exactly one of these; nothing else is offered):
 *   node scripts/relay-status.mjs emit
 *   node scripts/relay-status.mjs verify < relayed-payload.txt
 *
 * Exit codes:
 *   0  emitted / intact
 *   1  ALTERED — the relayed payload does not match its own digest, or a field is missing
 *   2  the handler itself crashed. Distinct from 1 on purpose (the [[BL-111]] lesson: a
 *      crashing tool must never be readable as a clean result).
 *
 * WHY THIS EXISTS
 *   [[BL-110]] step 1 gave the PO a doorbell: a message can reach a session
 *   (`relay-inbox.mjs`). Nothing came back. `receive` writes a note and stops, so both
 *   read-only verbs produce a *receipt*, not an answer. This is the other half.
 *
 * WHY IT IS BUILDABLE WHILE THE REST OF BL-110 IS BLOCKED
 *   [[BL-107]] (HMP is unauthenticated) and the `[PO-RELAY]` authority decision both gate what a
 *   forged *inbound* message can make a session DO. **An outbound message carries no authority**,
 *   so there is nothing in this direction to forge. Same instinct as step 1: prove the leg with
 *   traffic that cannot hurt you.
 *
 * THE DESIGN IS DICTATED BY [[BL-112]] — READ THIS BEFORE ADDING A FIELD
 *   The courier silently excises a specific literal substring from replies, deterministically,
 *   by a mechanism inside the PO's Hermes install that we cannot see. BL-112's own fix direction
 *   is the rule this file obeys:
 *
 *       no datum you need may depend on surviving the courier.
 *
 *   So this relay sends NO PROSE IT AUTHORED. Every field is a number, a path, a timestamp, or
 *   *committed* text recoverable from the repo by its own sha. The inbound direction survived
 *   BL-112 because the lost datum was derivable from committed config; transcript prose is
 *   derivable from nowhere, which is exactly why none is sent.
 *
 *   **A "just a one-line summary of what the session is doing" field would break this.** It is
 *   the obvious next request and it is the thing the fence exists to refuse. Row 6 of the DoD is
 *   a sentinel test precisely so that addition fails loudly instead of passing review.
 *
 * TWO TELLS, BECAUSE BL-112 FAILS *SILENTLY*
 *   - **Line numbering `1/7 … 7/7`** catches a whole field vanishing, and it is the only tell a
 *     human on a phone can read — which is the actual use case. A PO away from the desk cannot
 *     run a verifier.
 *   - **`digest:`** catches excision *within* a line, which is the shape BL-112 actually exhibits
 *     (`…recording.json.NOPE` relayed as `.NOPE`: the substring was cut, the remainder survived).
 *
 *   The digest is NOT a security mechanism and must not be described as one — an excising courier
 *   could excise the digest too. It converts *silent* corruption into *detectable* corruption,
 *   which is the precise thing BL-112 says is missing. It is computed over NORMALISED lines
 *   (trailing whitespace stripped) so an LLM courier's benign reformatting does not false-positive.
 *
 * READ-ONLY BY CONSTRUCTION
 *   `emit` runs `git` read commands and reads one JSONL's metadata. It opens no file for writing
 *   and creates nothing. DoD row 5 proves that mechanically by byte-comparing the tree around a
 *   call rather than taking this comment's word for it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isMainModule } from './lib/is-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Field count is part of the payload contract — the `n/N` numbering the PO counts by eye. */
export const FIELD_COUNT = 7;

/** A commit subject is committed prose, recoverable from its sha. Truncated for a phone screen. */
const SUBJECT_MAX = 60;

class HandlerError extends Error {}

// ---------------------------------------------------------------------------
// Collection — every reader below fails to a truthful `unknown`, never a guess
// ---------------------------------------------------------------------------

/**
 * Run a git command, or return null. NEVER throws: a missing git, a detached HEAD or an absent
 * remote must degrade the field, not kill the report. `unknown` is a true statement; a fabricated
 * value is not, and this project's standing rule is that an honest gap beats a confident guess.
 */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * The primary checkout, resolved even from inside a linked worktree — the same reasoning as
 * `relay-inbox.mjs`: one durable location the PO can look at, independent of whichever worktree
 * happens to be running. `--path-format=absolute` is load-bearing ([[BL-101]]/[[BL-106]]).
 */
export function primaryRoot(cwd = __dirname) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return common ? path.dirname(common) : null;
}

/**
 * Claude Code's per-project transcript directory. The slug is the absolute project path with the
 * path separators replaced by `-`, which is why it is derived from the PRIMARY checkout: a
 * worktree would name a different, empty directory.
 */
export function projectsDirFor(root, home = os.homedir()) {
  if (!root) return null;
  return path.join(home, '.claude', 'projects', root.replace(/\//g, '-'));
}

/**
 * The live session's transcript: the most recently modified JSONL in the project directory.
 *
 * This IS a heuristic, and it is a safe one only because of how its output is used. It never
 * asserts "a session is running" — it reports the timestamp of the last assistant entry, and the
 * caller renders an AGE alongside it. A stale pick therefore tells the truth by itself: a `spoke`
 * of `3h ago` says nothing is happening just as clearly as a correct pick would. The field is
 * honest by construction rather than by the selection being right.
 */
export function newestTranscript(projectsDir) {
  try {
    const files = fs
      .readdirSync(projectsDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const abs = path.join(projectsDir, f);
        return { abs, id: f.replace(/\.jsonl$/, ''), mtime: fs.statSync(abs).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The timestamp of the last assistant entry — and NOTHING ELSE FROM THE TRANSCRIPT.
 *
 * This function is the fence. It reads `type` and `timestamp` and never touches `message`, so no
 * word the session or the PO ever wrote can reach the wire through it. Keep it that way: the
 * transcript is the one input here that contains prose, and this is the only code that opens it.
 *
 * A malformed line is skipped rather than fatal — a transcript is appended live and the last line
 * can legitimately be half-written at the moment we read it.
 */
export function lastSpokeAt(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const raw = lines[i].trim();
      if (!raw) continue;
      let o;
      try {
        o = JSON.parse(raw);
      } catch {
        continue;
      }
      if (o && o.type === 'assistant' && typeof o.timestamp === 'string') return o.timestamp;
    }
    return null;
  } catch {
    return null;
  }
}

/** Coarse, phone-readable age. Deliberately not precise — nobody acts on seconds. */
export function humanAge(iso, now) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 90) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 90) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Un-acked inbox notes — the count only. Filenames and contents stay off the wire. */
export function pendingInbox(root) {
  try {
    const dir = path.join(root, 'design', 'operator', 'inbox');
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

/**
 * Assemble the seven fields. Injectable inputs (`root`, `projectsDir`, `now`) exist so the bars
 * can drive it against fixtures — including the no-transcript case, which must degrade rather
 * than crash.
 */
export function collect({ root, projectsDir, now = Date.now() } = {}) {
  const repoRoot = root ?? primaryRoot();
  const projDir = projectsDir ?? projectsDirFor(repoRoot);

  const branch = (repoRoot && git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot)) || 'unknown';
  const sha = (repoRoot && git(['rev-parse', '--short=7', 'HEAD'], repoRoot)) || 'unknown';
  const subjectRaw = (repoRoot && git(['log', '-1', '--format=%s'], repoRoot)) || '';
  const subject = subjectRaw.length > SUBJECT_MAX ? `${subjectRaw.slice(0, SUBJECT_MAX - 1)}…` : subjectRaw;

  const porcelain = repoRoot ? git(['status', '--porcelain'], repoRoot) : null;
  const statusLines = porcelain ? porcelain.split('\n').filter(Boolean) : [];
  const untracked = statusLines.filter((l) => l.startsWith('??')).length;
  const modified = statusLines.length - untracked;

  // `@{u}` fails with no upstream; the null then renders as `unknown` rather than a false `0`.
  const counts = repoRoot ? git(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], repoRoot) : null;
  const [ahead, behind] = counts ? counts.split(/\s+/) : [null, null];

  const tx = projDir ? newestTranscript(projDir) : null;
  const spokeIso = tx ? lastSpokeAt(tx.abs) : null;

  return [
    { key: 'session', value: tx ? tx.id.slice(0, 8) : 'unknown' },
    { key: 'branch', value: branch },
    { key: 'head', value: sha === 'unknown' ? 'unknown' : `${sha} ${subject}`.trim() },
    { key: 'tree', value: porcelain === null ? 'unknown' : `${modified} modified, ${untracked} untracked` },
    { key: 'sync', value: counts ? `ahead ${ahead}, behind ${behind}` : 'unknown' },
    { key: 'spoke', value: spokeIso ? `${spokeIso} (${humanAge(spokeIso, now)})` : 'unknown' },
    { key: 'inbox', value: `${repoRoot ? pendingInbox(repoRoot) : 0} pending` },
  ];
}

// ---------------------------------------------------------------------------
// Rendering, digesting, verifying
// ---------------------------------------------------------------------------

/**
 * Normalisation before digesting. Trailing whitespace is stripped per line and lines are joined
 * with `\n`, so a courier that re-wraps or pads does not trip a false ALTERED — while any change
 * to the CHARACTERS of a field still does. This is the deliberate seam between "the courier
 * reformatted" (benign, common with an LLM relay) and "the courier ate part of a value" (BL-112).
 */
export function normalise(lines) {
  return lines.map((l) => l.replace(/\s+$/, '')).join('\n');
}

export function digestOf(lines) {
  return crypto.createHash('sha256').update(normalise(lines), 'utf-8').digest('hex').slice(0, 8);
}

/** `1/7 key:    value` — the number first, so a dropped line is visible without reading further. */
export function renderFieldLines(fields) {
  const width = Math.max(...fields.map((f) => f.key.length)) + 1;
  return fields.map((f, i) => `${i + 1}/${fields.length} ${(`${f.key}:`).padEnd(width)} ${f.value}`);
}

export function renderPayload(fields) {
  const lines = renderFieldLines(fields);
  return `${lines.join('\n')}\ndigest: ${digestOf(lines)}\n`;
}

const FIELD_RE = /^(\d+)\/(\d+)\s/;

/**
 * Recompute the digest over what actually arrived and compare it with the digest that arrived.
 *
 * Two failure shapes, reported separately because they mean different things to the reader:
 * a MISSING field says a whole line was dropped (the numbering caught it); a digest MISMATCH says
 * a value was altered in place — the BL-112 shape, and the one no amount of eyeballing catches.
 */
export function verifyPayload(text) {
  const lines = String(text).split('\n');
  const fieldLines = lines.filter((l) => FIELD_RE.test(l));
  const digestLine = lines.find((l) => l.trim().startsWith('digest:'));

  if (!fieldLines.length) return { ok: false, reason: 'no-payload', detail: 'no numbered fields found' };
  if (!digestLine) return { ok: false, reason: 'no-digest', detail: 'the digest line did not arrive' };

  const declared = Number(fieldLines[0].match(FIELD_RE)[2]);
  const seen = new Set(fieldLines.map((l) => Number(l.match(FIELD_RE)[1])));
  const missing = [];
  for (let i = 1; i <= declared; i++) if (!seen.has(i)) missing.push(`${i}/${declared}`);
  if (missing.length) return { ok: false, reason: 'missing-field', detail: missing.join(', ') };

  const expected = digestLine.trim().slice('digest:'.length).trim();
  const actual = digestOf(fieldLines);
  if (expected !== actual) {
    return { ok: false, reason: 'digest-mismatch', detail: `expected ${expected}, recomputed ${actual}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function main(argv = process.argv.slice(2), io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s));
  const cmd = argv[0];

  if (cmd === 'emit') {
    out(renderPayload(collect()));
    return 0;
  }

  if (cmd === 'verify') {
    const text = io.stdin ?? fs.readFileSync(0, 'utf-8');
    const r = verifyPayload(text);
    if (r.ok) {
      out('intact\n');
      return 0;
    }
    out(`ALTERED: ${r.reason} (${r.detail})\n`);
    return 1;
  }

  throw new HandlerError(`usage: relay-status.mjs <emit|verify>; got ${cmd ? `'${cmd}'` : 'nothing'}`);
}

if (isMainModule(import.meta.url)) {
  try {
    process.exit(main());
  } catch (e) {
    // Exit 2, never 1: a crashed handler must be distinguishable from a clean ALTERED verdict.
    process.stderr.write(`[relay-status] ${e instanceof HandlerError ? e.message : `FATAL ${e.stack ?? e}`}\n`);
    process.exit(2);
  }
}
