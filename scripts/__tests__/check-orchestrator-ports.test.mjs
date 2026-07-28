import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  classifyProcess,
  classifyAll,
  sweepFails,
  parseDeclared,
  isOrchestratorIsh,
  parseListeningLines,
  STATUS,
} from '../check-orchestrator-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// The classifier is pure, so these bars drive it with synthetic records. The
// machine's live process table is not a fixture: a bar that depends on what
// happens to be running today proves nothing tomorrow.
const proc = (over = {}) => ({
  pid: '1234',
  ports: ['3100'],
  cwd: '/Users/someone/Software/AgentTalk',
  cmd: 'node apps/orchestrator/dist/index.js',
  ...over,
});

describe('check-orchestrator-ports (BL-023)', () => {
  describe('classification', () => {
    it('LEGITIMATE only on positive evidence from the service registry', () => {
      const managed = new Map([['1234', 'com.fausto.agenttalk-orchestrator']]);
      expect(classifyProcess(proc(), { managedPids: managed }).status).toBe(STATUS.LEGITIMATE);
    });

    it('an unmanaged process is NOT legitimate just because it looks ordinary', () => {
      // The BL-023 defect: a proof-run orchestrator left behind in the repo root
      // looks exactly like the real service. Without registry evidence it must
      // NOT pass.
      const r = classifyProcess(proc(), { managedPids: new Map() });
      expect(r.status).toBe(STATUS.UNKNOWN);
      expect(r.status).not.toBe(STATUS.LEGITIMATE);
    });

    it('ppid is not evidence: a leak reparents to ppid 1 exactly like the service', () => {
      // Both records are ppid 1. Only the registry separates them — which is why
      // the classifier never looks at ppid at all.
      const service = classifyProcess(proc({ pid: '4064', ppid: '1' }), {
        managedPids: new Map([['4064', 'com.fausto.agenttalk-orchestrator']]),
      });
      const orphan = classifyProcess(proc({ pid: '9999', ppid: '1' }), { managedPids: new Map() });
      expect(service.status).toBe(STATUS.LEGITIMATE);
      expect(orphan.status).toBe(STATUS.UNKNOWN);
    });

    it('LEAKED on positive evidence of a leak: a task worktree cwd', () => {
      const r = classifyProcess(proc({ cwd: '/tmp/sandbox/agentalk-task-task-123' }), {});
      expect(r.status).toBe(STATUS.LEAKED);
    });

    it('LEAKED when the cwd has been deleted out from under it', () => {
      expect(classifyProcess(proc({ cwd: '/tmp/gone (deleted)' }), {}).status).toBe(STATUS.LEAKED);
    });

    it('an unreadable cwd is UNKNOWN, never clean — "could not look" is not "fine"', () => {
      // This is the exact fail-open agy shipped and named: unresolvable cwd
      // defaulting to legitimate. It must fail.
      const r = classifyProcess(proc({ cwd: '' }), { managedPids: new Map() });
      expect(r.status).toBe(STATUS.UNKNOWN);
      expect(sweepFails([{ ...proc({ cwd: '' }), ...r }])).toBe(true);
    });
  });

  describe('the escape valve', () => {
    it('DECLARED by port, and by pid', () => {
      expect(classifyProcess(proc(), { declared: parseDeclared('3100') }).status).toBe(STATUS.DECLARED);
      expect(classifyProcess(proc(), { declared: parseDeclared('1234') }).status).toBe(STATUS.DECLARED);
    });

    it('a declaration for something else does not clear this process', () => {
      const r = classifyProcess(proc(), { declared: parseDeclared('9999,5173') });
      expect(r.status).toBe(STATUS.UNKNOWN);
    });

    it('parseDeclared tolerates spacing and empties', () => {
      expect(parseDeclared(' 3100 , 5173 ,')).toEqual(new Set(['3100', '5173']));
      expect(parseDeclared(undefined)).toEqual(new Set());
    });
  });

  describe('the sweep verdict', () => {
    it('UNKNOWN fails the sweep — there is no assume-fine branch', () => {
      const classified = classifyAll([proc()], { managedPids: new Map() });
      expect(classified[0].status).toBe(STATUS.UNKNOWN);
      expect(sweepFails(classified)).toBe(true);
    });

    it('LEAKED fails the sweep', () => {
      const classified = classifyAll([proc({ cwd: '/x/agentalk-task-1' })], {});
      expect(sweepFails(classified)).toBe(true);
    });

    it('only positive evidence passes', () => {
      const classified = classifyAll([proc()], {
        managedPids: new Map([['1234', 'svc']]),
      });
      expect(sweepFails(classified)).toBe(false);
    });

    it('one unknown among legitimates still fails the whole sweep', () => {
      const classified = classifyAll([proc({ pid: '1' }), proc({ pid: '2' })], {
        managedPids: new Map([['1', 'svc']]),
      });
      expect(classified.map(c => c.status)).toEqual([STATUS.LEGITIMATE, STATUS.UNKNOWN]);
      expect(sweepFails(classified)).toBe(true);
    });

    it('non-orchestrator processes are ignored entirely', () => {
      const vite = proc({ cmd: 'node /x/node_modules/.bin/vite', cwd: '/x' });
      expect(isOrchestratorIsh(vite)).toBe(false);
      expect(classifyAll([vite], {})).toEqual([]);
    });
  });

  // BL-099. The defect that made this whole check blind on Linux lived in the ONE
  // function these bars never touched — the lsof parser — because everything above
  // drives the pure classifier with synthetic records. So the parser gets its own
  // pure bars, driven by VERBATIM lsof output captured on each platform. Hand-typed
  // input would only re-encode whatever the author already believed.
  describe('lsof parsing (BL-099)', () => {
    // Captured on Linux (lsof 4.93.2) from a real orchestrator on :3500. Note the
    // COMMAND column: `MainThrea` — lsof reports the name of the THREAD owning the
    // socket, and Node's is `MainThread`, truncated to 9 chars. THIS is the line
    // that `startsWith('node')` silently discarded.
    const LINUX = [
      'COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
      'MainThrea 95016 fausto   21u  IPv6 650225      0t0  TCP *:38093 (LISTEN)',
      'MainThrea 95016 fausto   22u  IPv6 650226      0t0  TCP *:3500 (LISTEN)',
      'python3    1452 fausto    3u  IPv4  34062      0t0  TCP *:9899 (LISTEN)',
    ].join('\n');

    // macOS reports the process name, `node`. Kept so the fix is pinned as
    // cross-platform rather than "Linux now works and macOS is assumed to".
    const MACOS = [
      'COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      'node    52178 fausto   22u  IPv6 0x9f3c1d2e4a5b6c7d      0t0  TCP *:3500 (LISTEN)',
    ].join('\n');

    it('finds a Node listener on LINUX, where COMMAND is the thread name', () => {
      // The regression bar proper: before the fix this returned [].
      const rows = parseListeningLines(LINUX);
      const orch = rows.find(r => r.pid === '95016');
      expect(orch).toBeDefined();
      expect(orch.ports.sort()).toEqual(['3500', '38093']);
    });

    it('finds a Node listener on MACOS, where COMMAND is the process name', () => {
      expect(parseListeningLines(MACOS)).toEqual([{ pid: '52178', ports: ['3500'] }]);
    });

    it('groups one PID listening on several ports into a single record', () => {
      // Guards the byPid grouping the fix inherited: two rows, one process.
      expect(parseListeningLines(LINUX).filter(r => r.pid === '95016')).toHaveLength(1);
    });

    it('does NOT filter on the command name — that filter WAS the bug', () => {
      // Enumeration must stay indiscriminate; `isOrchestratorIsh` decides later,
      // from `ps` output and cwd. A process dropped here can never be classified,
      // so it can never be UNKNOWN, so it can never fail the sweep.
      const pids = parseListeningLines(LINUX).map(r => r.pid);
      expect(pids).toContain('95016'); // MainThrea
      expect(pids).toContain('1452'); // python3
    });

    it('drops the header row and blank lines rather than parsing them as PIDs', () => {
      expect(parseListeningLines(LINUX).map(r => r.pid)).not.toContain('PID');
      expect(parseListeningLines('')).toEqual([]);
      expect(parseListeningLines('\n\n')).toEqual([]);
      expect(parseListeningLines(null)).toEqual([]);
    });

    it('reads the port off IPv4, IPv6 and loopback NAME forms alike', () => {
      const mixed = [
        'MainThrea 111 u 21u IPv4 1 0t0 TCP 127.0.0.1:3100 (LISTEN)',
        'MainThrea 222 u 21u IPv6 2 0t0 TCP [::1]:5173 (LISTEN)',
        'MainThrea 333 u 21u IPv6 3 0t0 TCP *:3600 (LISTEN)',
      ].join('\n');
      expect(parseListeningLines(mixed)).toEqual([
        { pid: '111', ports: ['3100'] },
        { pid: '222', ports: ['5173'] },
        { pid: '333', ports: ['3600'] },
      ]);
    });
  });

  describe('e2e', () => {
    let dummy;
    let tempDir;

    afterEach(() => {
      // We started it, so we reap it. Nothing else is ever signalled.
      if (dummy) { dummy.kill(); dummy = undefined; }
      if (tempDir) { fs.rmSync(tempDir, { recursive: true, force: true }); tempDir = undefined; }
    });

    it('flags a real process running from a task worktree, wherever this repo lives', async () => {
      // Decoupled from the ambient path on purpose: the test MAKES a directory
      // that looks like a task worktree rather than depending on being run from
      // inside one. (agy's rung-3 bar only passed when the repo itself sat under
      // a path containing `agentalk-task-`, so it went red on master.)
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl023-'));
      const fakeWorktree = path.join(tempDir, 'agentalk-task-task-999');
      fs.mkdirSync(fakeWorktree);

      const script = path.join(fakeWorktree, 'orchestrator-stub.mjs');
      fs.writeFileSync(script, `
        import http from 'http';
        const s = http.createServer((_, r) => r.end());
        s.listen(0, '127.0.0.1', () => console.log('listening ' + s.address().port));
        setInterval(() => {}, 1000);
      `);

      dummy = spawn('node', [script], { cwd: fakeWorktree });
      await new Promise((resolve, reject) => {
        dummy.stdout.on('data', d => String(d).includes('listening') && resolve());
        dummy.on('error', reject);
        setTimeout(() => reject(new Error('dummy never listened')), 10000);
      });
      await new Promise(r => setTimeout(r, 500)); // let lsof see it

      let output = '';
      try {
        output = execSync(`node ${path.join(repoRoot, 'scripts/check-orchestrator-ports.mjs')}`, {
          encoding: 'utf-8', stdio: 'pipe',
        });
      } catch (err) {
        // Expected: the sweep fails because our dummy is a "leak".
        output = (err.stdout ?? '') + (err.stderr ?? '');
      }

      expect(output).toContain(`[${STATUS.LEAKED}] PID ${dummy.pid}`);
      expect(output).toContain('SWEEP FAILED');
      expect(output).not.toContain('Sweep clean');
    });
  });
});
