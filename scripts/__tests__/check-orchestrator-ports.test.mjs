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
