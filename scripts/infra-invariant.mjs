#!/usr/bin/env node

/**
 * BL-087 — the infrastructure invariant harness.
 *
 * USAGE:
 *   node scripts/infra-invariant.mjs snapshot --out <file>
 *   node scripts/infra-invariant.mjs check --before <file> [--expect <file>] [--json]
 *
 * Options (both verbs):
 *   --repo <name>=<path>   watch this repo instead of the defaults (repeatable)
 *   --client <path>        path to agentalk-mcp-client (default: ../agentalk-mcp-client, or
 *                          $AGENTTALK_CLIENT_REPO) — configurable, never hardcoded
 *   --ports <lo>-<hi>      TCP range to watch (default 3400-3700; 9899 is always included)
 *   --no-global            skip port/process inspection (repo state only)
 *
 * WHAT THIS IS FOR
 *   Session launching is moving to an external operator agent. Every autonomous run so far
 *   tested an IMPLEMENTER, structurally contained: its own worktree, its own branch, no merge
 *   rights. An OPERATOR is different in kind — it launches process trees, binds ports, and
 *   creates and removes worktrees and branches. That fence does not transfer. Damage would come
 *   from a bad `git worktree` call, a port collision, or an orphaned tree holding a port — not
 *   from a bad diff. So: snapshot before, snapshot after, and prove the infrastructure came back.
 *
 * ⛔ IT REPORTS AND NEVER REPAIRS.
 *   No git writes, no process signals, no writes inside either repo. A harness that "fixes" what
 *   it finds is itself capable of burning the hole it exists to prevent — and it runs unattended,
 *   on an operator agent's say-so. A bar in the test file scans this source for repair verbs, so
 *   a future "helpful" addition fails the suite rather than shipping.
 *
 * THE CENTRAL IDEA — the asymmetry that makes this tractable:
 *
 *     ADDITIONS CAN BE EXPECTED. REMOVALS AND MOVES NEVER ARE.
 *
 *   An operator doing its job ADDS a task branch and a worktree. An operator burning the
 *   infrastructure REMOVES a worktree, DELETES a branch, or MOVES `HEAD`. So additions are
 *   matched against an allowlist, and deletions / HEAD movement / upstream divergence are ALWAYS
 *   findings with no allowlist path at all — `applyAllowlist` is simply never called for them.
 *
 * WHY THE SEVERITY TIERS EXIST
 *   Both failure modes are real: flag everything and it gets ignored (cried wolf); flag nothing
 *   and it is theatre. `info` is the pressure valve that keeps `warn`/`critical` believable.
 *
 * PROCESS CLASSIFICATION IS BORROWED, DELIBERATELY (Gate 1 amendment, plan §4a)
 *   `check-orchestrator-ports.mjs` (BL-023) already solved this, and it encodes a trap this file
 *   would otherwise re-fall into: `ppid` CANNOT discriminate — the PO's launchd service runs at
 *   ppid 1 and an orphaned leak ALSO reparents to ppid 1. Guessing either way is a known bug
 *   (IP-15: a reviewer inferred "leak" and filed a defect against a service the PO runs on
 *   purpose). Reusing that classifier is the mitigation for this plan's own top risk.
 *
 *   The two tools ask different questions and both answers are correct:
 *     BL-023 is ABSOLUTE     — "is anything unaccounted-for listening RIGHT NOW?"  UNKNOWN fails.
 *     this is DIFFERENTIAL   — "did THIS RUN change the infrastructure?"
 *   So an UNKNOWN process that was already in the baseline is a `warn` (this run did not cause
 *   it, and the absolute check still fails on it independently), while an UNKNOWN process that
 *   APPEARED during the run is `critical` — that is the operator-burning-infrastructure signal.
 *   Declaring one via AGENTTALK_SWEEP_DECLARED clears it here too: the escape valve is inherited.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { classifyProcess, isOrchestratorIsh, parseDeclared, STATUS } from './check-orchestrator-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const SEVERITY = { CRITICAL: 'critical', WARN: 'warn', INFO: 'info' };

/** Collected-but-empty and deliberately-not-collected must never look alike. */
const SKIPPED = 'skipped';
const UNAVAILABLE = 'unavailable';

export const DEFAULT_EXPECT = {
  allowNewWorktrees: ['att-op-*', 'att-*/agentalk-task-*'],
  allowNewBranches: ['task-*'],
  allowPorts: [3600],
  allowProcesses: [],
  // BL-097 — repo-relative paths the OPERATOR seat may lawfully write (charter amendment `7948ea4`:
  // `design/backlog.md` + `design/operator/**`). Deliberately EMPTY by default, so it fails closed:
  // with no declaration, every write is judged exactly as it was before this field existed.
  allowWritePaths: [],
};

/** How far back `snapshotRepo` records commit paths. Overflow is `critical`, never silence. */
const COMMIT_WINDOW = 50;

export const DEFAULT_PORT_RANGE = { lo: 3400, hi: 3700 };
/** The resource meter. Always watched, whatever range is configured. */
const ALWAYS_WATCHED_PORTS = [9899];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Glob match where `*` never crosses a path separator, tested against the full
 * string, its basename, and each of its trailing path segments — so `att-op-*`
 * matches a worktree by name, while a two-segment pattern matches the nested
 * `agentalk-task-*` pair a run leaves inside its worktree.
 */
export function matchesAny(value, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const segments = String(value).split('/').filter(Boolean);
  const candidates = new Set([String(value)]);
  for (let i = 0; i < segments.length; i++) candidates.add(segments.slice(i).join('/'));

  return patterns.some((pattern) => {
    const rx = new RegExp(
      '^' + String(pattern).split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$'
    );
    return Array.from(candidates).some((c) => rx.test(c));
  });
}

const finding = (severity, kind, detail, extra = {}) => ({ severity, kind, detail, ...extra });

/** Additions get an allowlist. Removals and moves never call this. */
const applyAllowlist = (value, patterns) => (matchesAny(value, patterns) ? SEVERITY.INFO : SEVERITY.WARN);

export function exitCodeFor(findings) {
  return findings.some((f) => f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.WARN) ? 1 : 0;
}

/**
 * BL-097 — path matching for the operator WRITE fence. Deliberately NOT `matchesAny`.
 *
 * `matchesAny` also tests the basename and every trailing segment, which is right for naming a
 * worktree or a branch and wrong for a fence: it would accept `apps/vendor/design/backlog.md` on
 * the strength of its tail. This one is anchored at the repo root, and `**` crosses separators
 * while `*` does not — so `design/operator/**` covers the whole subtree, as the charter says.
 */
export function matchesWritePath(value, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const target = String(value).replace(/^\.\//, '');
  return patterns.some((pattern) => {
    const rx = new RegExp(
      '^' +
        String(pattern)
          .split('**')
          .map((seg) =>
            seg.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'),
          )
          .join('.*') +
        '$',
    );
    return rx.test(target);
  });
}

/**
 * BL-097 — union the paths of every commit newer than `beforeHead`, walking the window the
 * snapshot recorded. Pure, so the bars can drive it with synthetic state (see `diffSnapshots`).
 *
 * Two ways this reports "I could not see": `overflow` when `beforeHead` is not in the window at
 * all, and `emptyCommit` when a commit in the range touches NO files — an empty commit or, far
 * more importantly, a MERGE commit, for which `git log --name-only` prints nothing.
 */
export function commitRangePaths(commits, beforeHead) {
  if (!Array.isArray(commits)) return { status: 'overflow', paths: [], emptyCommit: null };
  const paths = [];
  let emptyCommit = null;
  for (const c of commits) {
    if (c.hash === beforeHead) return { status: 'ok', paths, emptyCommit };
    if (!c.paths || c.paths.length === 0) emptyCommit = emptyCommit ?? c.hash;
    else paths.push(...c.paths);
  }
  return { status: 'overflow', paths, emptyCommit };
}

/**
 * BL-097 — classify a HEAD move against the declared operator write allowlist.
 *
 * Before this existed a HEAD move was `critical` and "never allowlisted", which was correct while
 * the operator could not commit. The charter amendment lets it commit to the allowlisted paths, so
 * the *first lawful write* would otherwise fire three criticals and gate the next run.
 *
 * The softening is narrow on purpose:
 *   - no allowlist declared  → `foreign` (today's behaviour, unchanged)
 *   - range unreadable       → `undetermined` → `critical`. "We could not look" must never outrank
 *                              "we looked and it was fine" (the BL-023/BL-090 discipline).
 *   - ANY path outside       → `foreign`. One foreign path poisons the range; no partial credit.
 *   - every path inside      → `allowed` → `info`
 */
export function classifyHeadMove(before, after, allowWritePaths) {
  if (before.head === after.head) return { kind: 'none', paths: [] };
  if (!allowWritePaths || allowWritePaths.length === 0) {
    return { kind: 'foreign', paths: [], reason: 'no operator write allowlist is declared' };
  }
  const range = commitRangePaths(after.commits, before.head);
  if (range.status !== 'ok') {
    return {
      kind: 'undetermined',
      paths: [],
      reason: `the pre-run HEAD ${String(before.head).slice(0, 8)} is not within the last ${COMMIT_WINDOW} commits`,
    };
  }
  if (range.emptyCommit) {
    return {
      kind: 'undetermined',
      paths: [],
      reason: `commit ${range.emptyCommit.slice(0, 8)} touches no files — an empty or MERGE commit, whose effect cannot be seen (and a merge is precisely what the operator may never do)`,
    };
  }
  const foreign = Array.from(new Set(range.paths.filter((p) => !matchesWritePath(p, allowWritePaths))));
  if (foreign.length > 0) return { kind: 'foreign', paths: foreign };
  return { kind: 'allowed', paths: Array.from(new Set(range.paths)) };
}

/**
 * BL-097 — the effective agent-selectable set, re-implemented dependency-free.
 *
 * This duplicates `parseBacklog`/`selectableBacklogItems` (`apps/orchestrator/src/backlog.ts`) on
 * purpose: the harness is infrastructure safety and must run when the build is broken, so it may
 * not import from `dist`. The duplication is fenced by a test that pins this against the real
 * parser on the real `design/backlog.md` — if they ever drift, that test goes red.
 *
 * Mirrors the parser's semantics exactly, including the ones that look like details:
 *   - `@item` blocks inside ``` fences are examples, not items (the schema block at the top of the
 *     backlog declares `autonomy: eligible` and must not be counted)
 *   - unknown/absent `autonomy` → not eligible (BL-093 fails closed)
 *   - an unknown `blocked_by` id is UNRESOLVED, so a typo hides an item rather than releasing it
 */
export function parseSelectableIds(markdown) {
  const lines = String(markdown).split('\n');
  const items = [];
  let fence = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('```')) {
      fence = !fence;
      continue;
    }
    if (fence || !lines[i].trimStart().startsWith('<!-- @item')) continue;

    const header = {};
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim().includes('-->')) {
        i = j;
        break;
      }
      const kv = lines[j].match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
      if (kv) header[kv[1].toLowerCase()] = kv[2];
    }

    const id = (header.id ?? '').trim();
    if (!id) continue;
    items.push({
      id,
      status: (header.status ?? '').trim(),
      autonomy: (header.autonomy ?? '').trim(),
      blockedBy: String(header.blocked_by ?? '')
        .replace(/^\s*\[|\]\s*$/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  const byId = new Map(items.map((it) => [it.id, it]));
  const resolved = (bid) => {
    const b = byId.get(bid);
    return !!b && (b.status === 'done' || b.status === 'dropped');
  };

  return items
    .filter((it) => it.status === 'todo' && it.autonomy === 'eligible' && it.blockedBy.every(resolved))
    .map((it) => it.id)
    .sort();
}

/** Parse `git log --format=%H --name-only`: a hash line opens a commit, later lines are its paths. */
function parseCommitLog(raw) {
  const out = [];
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/^[0-9a-f]{40}$/.test(t)) out.push({ hash: t, paths: [] });
    else if (out.length > 0) out[out.length - 1].paths.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot — git side. Every command here is a read.
// ---------------------------------------------------------------------------

function git(args, cwd, env) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
    ...(env ? { env } : {}),
  }).trim();
}

function tryGit(args, cwd, env, fallback = null) {
  try {
    return git(args, cwd, env);
  } catch {
    return fallback;
  }
}

function parseWorktrees(porcelain) {
  const out = [];
  let current = null;
  for (const line of String(porcelain).split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) out.push(current);
      current = { path: line.slice('worktree '.length).trim(), sha: '', branch: '(detached)' };
    } else if (line.startsWith('HEAD ') && current) {
      current.sha = line.slice('HEAD '.length).trim();
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch '.length).trim().replace('refs/heads/', '');
    }
  }
  if (current) out.push(current);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function parseUpstream(raw) {
  if (raw == null) return null;
  const [ahead, behind] = raw.split(/\s+/).map((n) => Number(n));
  if (Number.isNaN(ahead) || Number.isNaN(behind)) return null;
  return { ahead, behind };
}

export function snapshotRepo(repoPath, env) {
  if (!fs.existsSync(repoPath)) {
    return { path: repoPath, unavailable: 'path does not exist' };
  }
  const head = tryGit(['rev-parse', 'HEAD'], repoPath, env);
  if (head == null) {
    return { path: repoPath, unavailable: 'not a git repository, or it has no commits' };
  }

  // BL-089 — `git()` trims the whole command output, which strips the leading space of the FIRST
  // porcelain line only. That line is then parsed one character short: ` M foo` reads as code
  // "M " (staged) and path "oo". Fixed HERE, at the parse site, and deliberately NOT in `git()` —
  // every other caller relies on that trim.
  // Porcelain is exactly two status chars, a space, then the path, so a line whose third
  // character is not a space is one the trim shortened; restore the space before parsing.
  const porcelainLines = (tryGit(['status', '--porcelain'], repoPath, env, '') || '')
    .split('\n')
    .filter(Boolean);
  if (porcelainLines.length > 0 && porcelainLines[0][2] !== ' ') {
    porcelainLines[0] = ` ${porcelainLines[0]}`;
  }
  const porcelain = porcelainLines
    .map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    path: repoPath,
    head,
    branch: tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath, env, '(unknown)'),
    upstream: parseUpstream(tryGit(['rev-list', '--count', '--left-right', 'HEAD...@{upstream}'], repoPath, env)),
    worktrees: parseWorktrees(tryGit(['worktree', 'list', '--porcelain'], repoPath, env, '')),
    branches: (tryGit(['branch', '--format=%(refname:short)'], repoPath, env, '') || '')
      .split('\n')
      .filter(Boolean)
      .sort(),
    tags: (tryGit(['tag'], repoPath, env, '') || '').split('\n').filter(Boolean).sort(),
    porcelain,
    stashCount: (tryGit(['stash', 'list'], repoPath, env, '') || '').split('\n').filter(Boolean).length,

    // BL-097 — captured HERE, at snapshot time, because `diffSnapshots` is pure: it may not shell
    // out to `git diff before..after`, so the *after* snapshot carries a window the diff can walk.
    commits: parseCommitLog(
      tryGit(['log', '--format=%H', '--name-only', '-n', String(COMMIT_WINDOW), 'HEAD'], repoPath, env, ''),
    ),

    // BL-097 — what an agent may be handed unattended. `SKIPPED` (not `[]`) when the repo has no
    // backlog: collected-but-empty and deliberately-not-collected must never look alike.
    selectable: fs.existsSync(path.join(repoPath, 'design', 'backlog.md'))
      ? parseSelectableIds(fs.readFileSync(path.join(repoPath, 'design', 'backlog.md'), 'utf-8'))
      : SKIPPED,
  };
}

// ---------------------------------------------------------------------------
// Snapshot — global side. Best-effort by design (LB-11): a harness that failed
// closed on a missing tool would block the very runs it exists to protect.
// ---------------------------------------------------------------------------

function inRange(port, range) {
  return (port >= range.lo && port <= range.hi) || ALWAYS_WATCHED_PORTS.includes(port);
}

function listeningEntries(env) {
  const raw = (() => {
    try {
      return execFileSync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], {
        encoding: 'utf-8',
        stdio: 'pipe',
        ...(env ? { env } : {}),
      });
    } catch (e) {
      // lsof exits non-zero both when nothing is listening and when it is absent.
      // ENOENT is the only one that means "we could not look".
      return e.code === 'ENOENT' ? null : '';
    }
  })();
  if (raw == null) return null;

  const rows = [];
  for (const line of raw.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const pid = parts[1];
    const port = Number((parts[8] ?? '').match(/:(\d+)$/)?.[1]);
    if (!pid || !Number.isFinite(port)) continue;
    rows.push({ pid, port, command: parts[0] });
  }
  return rows;
}

function processCwd(pid, env) {
  try {
    const out = execFileSync('lsof', ['-p', String(pid), '-a', '-d', 'cwd', '-F', 'n'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      ...(env ? { env } : {}),
    });
    return out.match(/\nn(.*)/)?.[1]?.trim() ?? '';
  } catch {
    // Unreadable cwd yields '' — which matches no leak marker and no registry
    // entry, so the process lands in UNKNOWN. "We could not look" must never
    // read as "it is fine" (BL-023).
    return '';
  }
}

function processCmd(pid, env) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf-8',
      stdio: 'pipe',
      ...(env ? { env } : {}),
    }).trim();
  } catch {
    return '';
  }
}

/** PID -> service label for every job the service registry knows. Positive evidence only. */
function managedPids(env) {
  const map = {};
  try {
    const out = execFileSync('launchctl', ['list'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      ...(env ? { env } : {}),
    });
    for (const line of out.split('\n').slice(1)) {
      const [pid, , label] = line.split('\t');
      if (pid && pid !== '-' && label) map[pid.trim()] = label.trim();
    }
  } catch {
    /* no registry ⇒ no positive evidence ⇒ things land in UNKNOWN. Loud, not silent. */
  }
  return map;
}

function snapshotGlobal(range, env) {
  const entries = listeningEntries(env);
  if (entries === null) {
    return { ports: UNAVAILABLE, processes: UNAVAILABLE, managed: {}, declared: [] };
  }

  const watched = entries.filter((e) => inRange(e.port, range));
  const ports = watched.map(({ port, pid }) => ({ port, pid })).sort((a, b) => a.port - b.port);

  const byPid = new Map();
  for (const e of watched) {
    if (!byPid.has(e.pid)) byPid.set(e.pid, { pid: e.pid, ports: [] });
    byPid.get(e.pid).ports.push(String(e.port));
  }
  const processes = Array.from(byPid.values())
    .map((p) => ({ ...p, cwd: processCwd(p.pid, env), cmd: processCmd(p.pid, env) }))
    .sort((a, b) => Number(a.pid) - Number(b.pid));

  return {
    ports,
    processes,
    managed: managedPids(env),
    declared: Array.from(parseDeclared((env ?? process.env).AGENTTALK_SWEEP_DECLARED)),
  };
}

export function takeSnapshot({ repos = {}, includeGlobal = true, portRange = DEFAULT_PORT_RANGE, env } = {}) {
  const snapshot = { takenAt: new Date().toISOString(), repos: {} };
  for (const [name, repoPath] of Object.entries(repos)) {
    snapshot.repos[name] = snapshotRepo(repoPath, env);
  }
  if (includeGlobal) {
    Object.assign(snapshot, snapshotGlobal(portRange, env));
  } else {
    Object.assign(snapshot, { ports: SKIPPED, processes: SKIPPED, managed: {}, declared: [] });
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// Diff — pure. This is the part the bars drive with synthetic state.
// ---------------------------------------------------------------------------

function diffRepo(name, before, after, expect, findings) {
  const at = (kind, severity, detail) => findings.push(finding(severity, kind, detail, { repo: name }));

  // BL-090 Defect B — the two sides must describe the SAME repository. `path` has always been
  // recorded by snapshotRepo and was simply never read: the caller matches on the KEY alone, so
  // two snapshots whose `agenttalk` key points at different directories used to diff silently
  // against each other (measured: three false criticals — head-moved, branch-changed,
  // upstream-diverged). Checked FIRST because it is the root cause: once the sides describe
  // different repositories, every comparison below is meaningless, including `unavailable`.
  if (before.path !== after.path) {
    at(
      'path-mismatch',
      SEVERITY.CRITICAL,
      `${name}: the two snapshots describe DIFFERENT paths — ${before.path} → ${after.path}. ` +
        `Nothing below can be compared; re-take both snapshots against the same repository.`,
    );
    return;
  }

  // BL-090 Defect A — "we could not look" must never outrank "we looked and it was fine" (the
  // BL-023 UNKNOWN discipline, one level up). This was WARN, and the PO's gate watches only
  // CRITICAL, so a mistyped or missing path produced NO gating AND no checking while the run
  // still read as inspected. Either side unavailable gates: a mistyped path is unavailable on
  // BOTH sides, so a one-sided-only rule would leave the defect standing.
  // The early `return` is NOT the defect and stays — at CRITICAL it gates loudly and skips
  // comparisons that are meaningless anyway.
  if (before.unavailable || after.unavailable) {
    at(
      'repo-unavailable',
      SEVERITY.CRITICAL,
      `${name}: ${after.unavailable ?? before.unavailable} (${after.path ?? before.path}) — ` +
        `nothing was checked for this repo. If the path is wrong, set it with --repo/--client or ` +
        `$AGENTTALK_CLIENT_REPO.`,
    );
    return;
  }

  // --- moves: allowlisted ONLY by an explicit operator write declaration (BL-097) ---
  // A branch change is still never allowlisted: the operator works on master and owns no branch.
  const move = classifyHeadMove(before, after, expect.allowWritePaths);
  const heads = `${String(before.head).slice(0, 8)} → ${String(after.head).slice(0, 8)}`;
  if (move.kind === 'allowed') {
    at(
      'head-moved-declared',
      SEVERITY.INFO,
      `${name}: HEAD moved ${heads}, and every path in the range is a declared operator write — ${move.paths.join(', ')}`,
    );
  } else if (move.kind === 'undetermined') {
    at(
      'head-moved-undetermined',
      SEVERITY.CRITICAL,
      `${name}: HEAD moved ${heads} and the range could not be read — ${move.reason}. ` +
        `"We could not look" never outranks "we looked and it was fine".`,
    );
  } else if (move.kind === 'foreign') {
    at(
      'head-moved',
      SEVERITY.CRITICAL,
      `${name}: HEAD moved ${heads}` +
        (move.paths.length > 0 ? ` — writes outside the allowlist: ${move.paths.join(', ')}` : ''),
    );
  }

  if (before.branch !== after.branch) {
    at('branch-changed', SEVERITY.CRITICAL, `${name}: current branch changed ${before.branch} → ${after.branch}`);
  }
  const ub = before.upstream;
  const ua = after.upstream;
  if (JSON.stringify(ub) !== JSON.stringify(ua)) {
    const fmt = (u) => (u ? `+${u.ahead}/-${u.behind}` : 'none');
    // A declared write leaves the repo one commit ahead — that divergence IS the write, already
    // reported above. It softens only when `behind` held still: a `behind` move is somebody's
    // fetch or reset, which no write allowlist speaks to.
    const behindHeld = (ub?.behind ?? null) === (ua?.behind ?? null);
    const declared = move.kind === 'allowed' && behindHeld;
    at(
      'upstream-diverged',
      declared ? SEVERITY.INFO : SEVERITY.CRITICAL,
      `${name}: divergence vs upstream changed ${fmt(ub)} → ${fmt(ua)}` +
        (declared ? ' (accounted for by the declared operator write above)' : ''),
    );
  }

  // --- worktrees ---
  const beforeWt = new Map(before.worktrees.map((w) => [w.path, w]));
  const afterWt = new Map(after.worktrees.map((w) => [w.path, w]));
  for (const p of beforeWt.keys()) {
    if (!afterWt.has(p)) at('worktree-removed', SEVERITY.CRITICAL, `${name}: worktree disappeared — ${p}`);
  }
  for (const p of afterWt.keys()) {
    if (!beforeWt.has(p)) {
      at('worktree-added', applyAllowlist(p, expect.allowNewWorktrees), `${name}: new worktree — ${p}`);
    }
  }

  // --- branches ---
  const beforeBr = new Set(before.branches);
  const afterBr = new Set(after.branches);
  for (const b of beforeBr) {
    if (!afterBr.has(b)) at('branch-removed', SEVERITY.CRITICAL, `${name}: branch deleted — ${b}`);
  }
  for (const b of afterBr) {
    if (!beforeBr.has(b)) {
      at('branch-added', applyAllowlist(b, expect.allowNewBranches), `${name}: new branch — ${b}`);
    }
  }

  // --- tags ---
  const beforeTags = new Set(before.tags ?? []);
  for (const t of beforeTags) {
    if (!(after.tags ?? []).includes(t)) at('tag-removed', SEVERITY.CRITICAL, `${name}: tag deleted — ${t}`);
  }
  for (const t of after.tags ?? []) {
    if (!beforeTags.has(t)) at('tag-added', SEVERITY.INFO, `${name}: new tag — ${t}`);
  }

  // --- working tree ---
  const beforeFiles = new Map((before.porcelain ?? []).map((e) => [e.path, e.code]));
  const afterFiles = new Map((after.porcelain ?? []).map((e) => [e.path, e.code]));
  for (const [p, code] of afterFiles) {
    if (beforeFiles.get(p) === code) continue;
    if (code.includes('?')) {
      at('untracked-file-added', SEVERITY.INFO, `${name}: new untracked file — ${p}`);
    } else {
      // BL-097 — an uncommitted edit inside the operator's declared paths is the seat working, not
      // residue. Per-path: one foreign edit stays critical even in a batch of lawful ones.
      const declared = matchesWritePath(p, expect.allowWritePaths);
      at(
        'tracked-file-modified',
        declared ? SEVERITY.INFO : SEVERITY.CRITICAL,
        `${name}: tracked file changed [${code.trim()}] — ${p}` + (declared ? ' (declared operator write)' : ''),
      );
    }
  }
  for (const p of beforeFiles.keys()) {
    if (!afterFiles.has(p)) at('working-tree-cleaned', SEVERITY.INFO, `${name}: working-tree entry gone — ${p}`);
  }

  if (before.stashCount !== after.stashCount) {
    at('stash-count-changed', SEVERITY.INFO, `${name}: stash count ${before.stashCount} → ${after.stashCount}`);
  }

  // --- the agent-selectable set (BL-097): NEVER allowlistable ---
  // `allowWritePaths` deliberately has no effect here. `design/backlog.md` is a path the operator
  // may write, but WHAT an agent may be handed unattended is not a write — it is authority, and
  // the charter reserves it to the PO. So a lawful write to a lawful path still gates if it moved
  // this set. The set is the *effective* one, because it also moves indirectly: by writing
  // `blocked_by`, or by flipping a blocker to `done`.
  const bSel = before.selectable;
  const aSel = after.selectable;
  if (Array.isArray(bSel) && Array.isArray(aSel)) {
    const added = aSel.filter((x) => !bSel.includes(x));
    const removed = bSel.filter((x) => !aSel.includes(x));
    if (added.length > 0 || removed.length > 0) {
      const parts = [];
      if (added.length > 0) parts.push(`now selectable: ${added.join(', ')}`);
      if (removed.length > 0) parts.push(`no longer selectable: ${removed.join(', ')}`);
      at(
        'selectable-set-changed',
        SEVERITY.CRITICAL,
        `${name}: the agent-selectable backlog set changed — ${parts.join('; ')}. ` +
          `Only the PO may change what an agent may be handed unattended ` +
          `(AGENT.md → 🔧 The OPERATOR seat → Visibility).`,
      );
    }
  } else if (bSel !== aSel) {
    at(
      'selectable-set-unreadable',
      SEVERITY.CRITICAL,
      `${name}: the backlog was ${Array.isArray(bSel) ? 'readable' : String(bSel)} before the run and ` +
        `${Array.isArray(aSel) ? 'readable' : String(aSel)} after — the selectable set could not be compared.`,
    );
  }
}

function isWatchedProcess(proc) {
  const cmd = proc.cmd ?? '';
  return isOrchestratorIsh(proc) || /launcher\.mjs|claude\s+-p|\bcodex\b|\bgoose\b|\bagy\b/.test(cmd);
}

function diffGlobal(before, after, expect, findings) {
  const pair = (key) => [before[key], after[key]];

  // --- ports ---
  const [pb, pa] = pair('ports');
  if (pb === SKIPPED || pa === SKIPPED) {
    /* deliberately not collected — say nothing */
  } else if (pb === UNAVAILABLE || pa === UNAVAILABLE) {
    findings.push(finding(SEVERITY.WARN, 'inspection-unavailable', 'port inspection unavailable on one side — the comparison was skipped, not passed'));
  } else {
    const beforePorts = new Set(pb.map((p) => p.port));
    for (const p of pa) {
      if (beforePorts.has(p.port)) continue;
      const severity = (expect.allowPorts ?? []).includes(p.port) ? SEVERITY.INFO : SEVERITY.WARN;
      findings.push(finding(severity, 'port-opened', `port ${p.port} is now listening (pid ${p.pid})`));
    }
    const afterPorts = new Set(pa.map((p) => p.port));
    for (const p of pb) {
      if (!afterPorts.has(p.port)) findings.push(finding(SEVERITY.INFO, 'port-closed', `port ${p.port} stopped listening`));
    }
  }

  // --- processes ---
  const [rb, ra] = pair('processes');
  if (rb === SKIPPED || ra === SKIPPED) return;
  if (rb === UNAVAILABLE || ra === UNAVAILABLE) {
    findings.push(finding(SEVERITY.WARN, 'inspection-unavailable', 'process inspection unavailable on one side — the comparison was skipped, not passed'));
    return;
  }

  const evidence = {
    managedPids: new Set(Object.keys(after.managed ?? {})),
    declared: new Set(after.declared ?? []),
  };
  const beforePids = new Set(rb.map((p) => String(p.pid)));

  for (const proc of ra) {
    if (!isWatchedProcess(proc)) continue;
    if (matchesAny(proc.cmd ?? '', expect.allowProcesses ?? [])) continue;

    const { status, reason } = classifyProcess(proc, evidence);
    const isNew = !beforePids.has(String(proc.pid));
    const accounted = status === STATUS.LEGITIMATE || status === STATUS.DECLARED;
    const where = `pid ${proc.pid} | ports ${(proc.ports ?? []).join(', ') || '—'} | ${reason}`;

    if (isNew) {
      findings.push(
        finding(accounted ? SEVERITY.INFO : SEVERITY.CRITICAL, 'process-appeared', `${status}: ${where}`)
      );
    } else if (!accounted) {
      // Pre-existing and unaccounted-for: this run did not cause it, so it is a
      // warn here. The ABSOLUTE check (BL-023) still fails on it independently.
      findings.push(finding(SEVERITY.WARN, 'process-unknown-preexisting', `${status}: ${where}`));
    }
  }

  const afterPids = new Set(ra.map((p) => String(p.pid)));
  for (const proc of rb) {
    if (isWatchedProcess(proc) && !afterPids.has(String(proc.pid))) {
      findings.push(finding(SEVERITY.INFO, 'process-exited', `pid ${proc.pid} is no longer listening`));
    }
  }
}

export function diffSnapshots(before, after, expect = DEFAULT_EXPECT) {
  const exp = { ...DEFAULT_EXPECT, ...(expect ?? {}) };
  const findings = [];

  const names = new Set([...Object.keys(before.repos ?? {}), ...Object.keys(after.repos ?? {})]);
  for (const name of Array.from(names).sort()) {
    const b = before.repos?.[name];
    const a = after.repos?.[name];
    if (b && !a) {
      findings.push(finding(SEVERITY.CRITICAL, 'repo-disappeared', `${name}: was watched before the run and is gone now`, { repo: name }));
      continue;
    }
    if (!b && a) {
      findings.push(finding(SEVERITY.INFO, 'repo-added', `${name}: newly watched`, { repo: name }));
      continue;
    }
    diffRepo(name, b, a, exp, findings);
  }

  diffGlobal(before, after, exp, findings);

  const rank = { [SEVERITY.CRITICAL]: 0, [SEVERITY.WARN]: 1, [SEVERITY.INFO]: 2 };
  return findings.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { repos: {}, includeGlobal: true, portRange: { ...DEFAULT_PORT_RANGE }, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      return v;
    };
    if (a === '--out') opts.out = next();
    else if (a === '--before') opts.before = next();
    else if (a === '--expect') opts.expect = next();
    else if (a === '--client') opts.client = next();
    else if (a === '--json') opts.json = true;
    else if (a === '--no-global') opts.includeGlobal = false;
    else if (a === '--repo') {
      const [name, ...rest] = next().split('=');
      if (!name || rest.length === 0) throw new UsageError('--repo expects <name>=<path>');
      opts.repos[name] = rest.join('=');
    } else if (a === '--ports') {
      const [lo, hi] = next().split('-').map(Number);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new UsageError('--ports expects <lo>-<hi>');
      opts.portRange = { lo, hi };
    } else throw new UsageError(`unknown option: ${a}`);
  }
  return opts;
}

function resolveRepos(opts) {
  if (Object.keys(opts.repos).length > 0) return opts.repos;
  const client = opts.client ?? process.env.AGENTTALK_CLIENT_REPO ?? path.resolve(REPO_ROOT, '../agentalk-mcp-client');
  return { agenttalk: REPO_ROOT, client };
}

function loadExpect(file) {
  if (!file) return DEFAULT_EXPECT;
  if (!fs.existsSync(file)) throw new UsageError(`expectation file not found: ${file}`);
  return { ...DEFAULT_EXPECT, ...JSON.parse(fs.readFileSync(file, 'utf-8')) };
}

function render(findings, before, after) {
  const lines = ['--- Infrastructure invariant check (BL-087) ---'];
  lines.push(`baseline taken ${before.takenAt} · compared against ${after.takenAt}`);
  if (findings.length === 0) {
    lines.push('\nNo differences at all. The infrastructure came back byte-identical.');
    return lines.join('\n');
  }
  for (const sev of [SEVERITY.CRITICAL, SEVERITY.WARN, SEVERITY.INFO]) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`\n[${sev.toUpperCase()}] ${group.length}`);
    for (const f of group) lines.push(`  · ${f.kind}: ${f.detail}`);
  }
  if (findings.some((f) => f.severity === SEVERITY.CRITICAL)) {
    lines.push('\nA `critical` finding GATES the next operator run until the PO clears it (plan §9.1).');
    lines.push('This harness REPORTS ONLY — it has changed nothing, and it will not.');
  }
  return lines.join('\n');
}

function main(argv) {
  const verb = argv[2];
  if (!verb) throw new UsageError('a verb is required: snapshot | check');
  const opts = parseArgs(argv.slice(3));
  const repos = resolveRepos(opts);

  if (verb === 'snapshot') {
    if (!opts.out) throw new UsageError('snapshot requires --out <file>');
    const snap = takeSnapshot({ repos, includeGlobal: opts.includeGlobal, portRange: opts.portRange });
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, JSON.stringify(snap, null, 2));
    console.log(`snapshot written: ${opts.out} (${snap.takenAt})`);
    return 0;
  }

  if (verb === 'check') {
    if (!opts.before) throw new UsageError('check requires --before <file>');
    if (!fs.existsSync(opts.before)) throw new UsageError(`baseline snapshot not found: ${opts.before}`);
    const before = JSON.parse(fs.readFileSync(opts.before, 'utf-8'));
    const after = takeSnapshot({ repos, includeGlobal: opts.includeGlobal, portRange: opts.portRange });
    const findings = diffSnapshots(before, after, loadExpect(opts.expect));
    const code = exitCodeFor(findings);

    if (opts.json) {
      console.log(JSON.stringify({ baselineTakenAt: before.takenAt, takenAt: after.takenAt, findings, exitCode: code }, null, 2));
    } else {
      console.log(render(findings, before, after));
    }
    return code;
  }

  throw new UsageError(`unknown verb: ${verb}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    process.exit(main(process.argv));
  } catch (e) {
    // Exit 2 is kept distinct from 1 on purpose: a CRASHING harness must never
    // be misread as a clean run.
    console.error(e instanceof UsageError ? `usage: ${e.message}` : `internal error: ${e.stack ?? e.message}`);
    console.error('\nnode scripts/infra-invariant.mjs snapshot --out <file>');
    console.error('node scripts/infra-invariant.mjs check --before <file> [--expect <file>] [--json]');
    process.exit(2);
  }
}
