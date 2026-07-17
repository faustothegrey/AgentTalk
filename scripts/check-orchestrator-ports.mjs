#!/usr/bin/env node

/**
 * BL-023 — process/port hygiene check for the closure sweep.
 *
 * USAGE:
 *   node scripts/check-orchestrator-ports.mjs
 *   AGENTTALK_SWEEP_DECLARED=3100,5173 node scripts/check-orchestrator-ports.mjs
 *
 * The closure sweep checks worktrees and branches but never looked at PROCESSES
 * or PORTS, so a leaked orchestrator survived every sweep. The reverse also bit
 * us: a reviewer once saw a long-running node process, inferred "leak" from
 * `ppid 1` + a plausible cwd, and filed a defect against a service the PO runs
 * on purpose (IP-15). Both directions are real failures, so this check refuses
 * to guess in either.
 *
 * WHAT MAKES THIS HARD — read before changing the classifier:
 *   `ppid` CANNOT discriminate. The PO's launchd service runs at ppid 1, and an
 *   ORPHANED LEAK ALSO REPARENTS TO ppid 1. Calling ppid-1 "managed" makes every
 *   leak invisible; calling it "leaked" reproduces the false finding above. The
 *   only POSITIVE evidence that a process is managed is the service registry
 *   (`launchctl list`), which names the service and knows nothing about a
 *   hand-started process.
 *
 * CLASSIFICATION (PO, 2026-07-17) — there is deliberately NO "assume fine" branch:
 *   LEGITIMATE — positive evidence: the service registry knows this PID.
 *   DECLARED   — positive evidence: a human declared it via AGENTTALK_SWEEP_DECLARED.
 *   LEAKED     — positive evidence of a leak: cwd is a task worktree, or deleted.
 *   UNKNOWN    — no positive evidence either way ⇒ FAILS THE SWEEP (exit 1).
 *
 * UNKNOWN failing is the point: an "unclassifiable ⇒ report clean" branch is the
 * fail-open this item exists to remove (cf. BL-022; BL-052 refuses rather than
 * inherits; BL-061 fails closed).
 *
 * WHY THE ESCAPE VALVE IS PART OF THE CHECK, NOT A NICETY:
 *   Failing on UNKNOWN fires on the PO's OWN processes — the live-run recipe
 *   hand-starts an orchestrator, and a stray `npm run dev` is not managed either.
 *   That is correct AT CLOSURE (a live-run orchestrator left behind IS the leak),
 *   but a check that cries wolf gets disabled, and a disabled check is this item's
 *   own bonus lesson: false findings are worse than no check. So every refusal
 *   names the process and offers two ways out — stop it, or declare it. A
 *   declaration is positive evidence too.
 *
 * REPORTS, NEVER REAPS: only the actor that started a process may stop it. This
 * script never kills, signals, or unloads anything — inspection only.
 */

import { execSync } from 'child_process';

export const STATUS = {
  LEGITIMATE: 'LEGITIMATE',
  DECLARED: 'DECLARED',
  LEAKED: 'LEAKED',
  UNKNOWN: 'UNKNOWN',
};

/** Statuses that do NOT fail the sweep. Everything else does. */
const PASSING = new Set([STATUS.LEGITIMATE, STATUS.DECLARED]);

export function parseDeclared(raw) {
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
}

export function isOrchestratorIsh(proc) {
  const cmd = proc.cmd ?? '';
  const cwd = proc.cwd ?? '';
  return cmd.includes('index.js') || cmd.includes('orchestrator') || cwd.includes('orchestrator');
}

/**
 * Pure: given one process record and the evidence available, say what it is.
 * Kept free of I/O so the bars can drive it with synthetic input — the machine's
 * live process table is not a test fixture.
 */
export function classifyProcess(proc, { managedPids = new Set(), declared = new Set() } = {}) {
  const pid = String(proc.pid);
  const ports = (proc.ports ?? []).map(String);

  if (managedPids.has(pid)) {
    return { status: STATUS.LEGITIMATE, reason: `service registry knows PID ${pid} (${managedPids.get?.(pid) ?? 'managed'})` };
  }

  if (declared.has(pid) || ports.some(p => declared.has(p))) {
    return { status: STATUS.DECLARED, reason: 'declared via AGENTTALK_SWEEP_DECLARED' };
  }

  const cwd = proc.cwd ?? '';
  if (cwd.includes('(deleted)')) {
    return { status: STATUS.LEAKED, reason: 'working directory has been deleted — the task that owned it is gone' };
  }
  if (cwd.includes('agentalk-task-')) {
    return { status: STATUS.LEAKED, reason: 'running from a task worktree — the task that owned it has ended' };
  }

  // No positive evidence in EITHER direction. Do not guess: that guess is the
  // fail-open this check exists to remove.
  return {
    status: STATUS.UNKNOWN,
    reason: 'no positive evidence: the service registry does not know it, it is not declared, and nothing marks it as leaked',
  };
}

export function classifyAll(procs, evidence) {
  return procs
    .filter(isOrchestratorIsh)
    .map(proc => ({ ...proc, ...classifyProcess(proc, evidence) }));
}

/** Pure: the sweep fails unless every process carries positive evidence. */
export function sweepFails(classified) {
  return classified.some(p => !PASSING.has(p.status));
}

// ---------------------------------------------------------------------------
// I/O — everything below talks to the machine; everything above is testable.
// ---------------------------------------------------------------------------

function listeningNodeProcs() {
  let out = '';
  try {
    out = execSync('lsof -iTCP -sTCP:LISTEN -P -n', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    // lsof exits non-zero when nothing is listening.
    return [];
  }

  const byPid = new Map();
  for (const line of out.split('\n')) {
    if (!line.startsWith('node')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[1];
    const port = (parts[8] ?? '').match(/:(\d+)$/)?.[1];
    if (!pid || !port) continue;
    if (!byPid.has(pid)) byPid.set(pid, { pid, ports: new Set() });
    byPid.get(pid).ports.add(port);
  }

  return Array.from(byPid.values()).map(p => ({
    pid: p.pid,
    ports: Array.from(p.ports),
    cwd: processCwd(p.pid),
    cmd: processCmd(p.pid),
  }));
}

function processCwd(pid) {
  try {
    const out = execSync(`lsof -p ${pid} -a -d cwd -F n`, { encoding: 'utf-8', stdio: 'pipe' });
    return out.match(/\nn(.*)/)?.[1]?.trim() ?? '';
  } catch (e) {
    // Unreadable cwd yields '', which matches no leak marker and no registry
    // entry — so the process lands in UNKNOWN and FAILS the sweep. That is
    // deliberate: "we could not look" must never read as "it is fine".
    return '';
  }
}

function processCmd(pid) {
  try {
    return execSync(`ps -p ${pid} -o command=`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (e) {
    return '';
  }
}

/** PID -> service label, for every job the service registry currently knows. */
function managedPids() {
  const map = new Map();
  try {
    const out = execSync('launchctl list', { encoding: 'utf-8', stdio: 'pipe' });
    for (const line of out.split('\n').slice(1)) {
      const [pid, , label] = line.split('\t');
      if (pid && pid !== '-' && label) map.set(pid.trim(), label.trim());
    }
  } catch (e) {
    // No registry ⇒ no positive evidence for anything ⇒ everything unmanaged
    // lands in UNKNOWN and fails. Loud, not silent.
    console.error('WARNING: could not read the service registry (launchctl list).');
    console.error('         Nothing can be proven managed, so live processes will report UNKNOWN.');
  }
  return map;
}

function main() {
  const declared = parseDeclared(process.env.AGENTTALK_SWEEP_DECLARED);
  const classified = classifyAll(listeningNodeProcs(), { managedPids: managedPids(), declared });

  console.log('--- Orchestrator process/port sweep (BL-023) ---');

  if (classified.length === 0) {
    console.log('No orchestrator-ish node processes are listening.');
    process.exit(0);
  }

  for (const p of classified) {
    console.log(`[${p.status}] PID ${p.pid} | ports ${p.ports.join(', ') || '—'} | cwd ${p.cwd || '(unreadable)'}`);
    console.log(`    command: ${p.cmd || '(unreadable)'}`);
    console.log(`    why:     ${p.reason}`);
  }

  if (!sweepFails(classified)) {
    console.log('\nSweep clean: every listening orchestrator carries positive evidence.');
    process.exit(0);
  }

  const bad = classified.filter(p => !PASSING.has(p.status));
  console.error(`\nSWEEP FAILED: ${bad.length} process(es) without positive evidence of being legitimate.`);
  console.error('This check REPORTS; it does not stop anything. Only whoever started a process may stop it.');
  console.error('\nTwo ways to clear each one:');
  console.error('  1. Stop it — if it is a leftover from a task, that is the leak this check exists to catch.');
  console.error(`  2. Declare it — AGENTTALK_SWEEP_DECLARED=${bad.map(p => p.ports[0] ?? p.pid).join(',')}`);
  console.error('     (accepts PIDs or ports; a declaration is positive evidence that a human knows about it.)');
  console.error('\nUNKNOWN fails on purpose: "we could not tell" must never report as clean (BL-023).');
  process.exit(1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main();
}
