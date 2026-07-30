import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// BL-101 — `verifyClientAlignment` resolved the client contract as a sibling of its own
// script directory. That is correct only in the primary checkout. Under the worktree MANDATE
// all development happens in a task worktree, where it resolved to a path that does not
// exist — and the fail-open branch then turned "I could not look" into "everything is fine".
// So the check was off wherever anyone works and on only where nobody does.
//
// This is an INTEGRATION test on purpose. The defect is about path resolution *from inside a
// worktree*, so a test that does not actually run in one proves nothing: the old code passes
// every unit-level assertion by not looking.
//
// Writing it caught the bug in itself, which is worth recording: the first draft located the
// client with `git rev-parse --show-toplevel`, which answers the WORKTREE root — the exact
// mistake under test — and silently skipped instead of failing.

const SCRIPT_REL = 'packages/contracts/scripts/verify-contract.js';

/** The primary checkout, correct from inside a worktree — the same primitive the fix uses. */
const primaryRoot = path.dirname(
    execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim(),
);
/** The checkout these tests are running from (a worktree during development). */
const hereRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const clientContract = path.resolve(primaryRoot, '../agentalk-mcp-client/wire-contract.json');

function runScript(scriptPath, cwd, env = {}) {
    try {
        // process.execPath, not 'node': one test deliberately empties PATH, and resolving the
        // node binary through PATH would make that test fail for the wrong reason.
        const stdout = execFileSync(process.execPath, [scriptPath], {
            cwd, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, out: stdout };
    } catch (err) {
        return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
}

describe('BL-101 — contract alignment resolves from the primary checkout', () => {
    let worktree;

    beforeAll(() => {
        worktree = mkdtempSync(path.join(os.tmpdir(), 'bl101-wt-'));
        rmSync(worktree, { recursive: true, force: true });
        // --detach leaves no branch behind: a worktree that leaks a branch per run is its own
        // filed defect ([[BL-103]]), and a test must not add to that pile.
        execFileSync('git', ['worktree', 'add', '--detach', '-q', worktree, 'HEAD'], { cwd: primaryRoot });
        // The worktree is checked out at HEAD, which does not yet contain uncommitted work.
        // Copy the script AS IT CURRENTLY EXISTS so the test exercises the version under
        // development rather than whatever was last committed.
        copyFileSync(path.join(hereRoot, SCRIPT_REL), path.join(worktree, SCRIPT_REL));
    });

    afterAll(() => {
        if (!worktree) return;
        try { execFileSync('git', ['worktree', 'remove', worktree, '--force'], { cwd: primaryRoot }); } catch { /* already gone */ }
        try { execFileSync('git', ['worktree', 'prune'], { cwd: primaryRoot }); } catch { /* best effort */ }
        rmSync(worktree, { recursive: true, force: true });
    });

    it.runIf(existsSync(clientContract))(
        'RUNS the alignment check from inside a worktree — the regression this fixes',
        () => {
            const { code, out } = runScript(path.join(worktree, SCRIPT_REL), worktree);
            // The exact string the old code printed instead. If resolution ever reverts to
            // being relative to the script's own directory, this assertion goes red.
            expect(out).not.toMatch(/skipped sibling contract-alignment check/);
            expect(out).toMatch(/Client contract alignment verified successfully/);
            expect(code).toBe(0);
        },
    );

    it('still succeeds when run in place — no regression where it already worked', () => {
        const { code, out } = runScript(path.join(hereRoot, SCRIPT_REL), hereRoot);
        expect(out).toMatch(/Contract hash verified successfully/);
        expect(code).toBe(0);
    });

    it.runIf(existsSync(clientContract))(
        'FAILS on a diverged client contract instead of passing quietly',
        () => {
            // The bar with teeth. A fail-open is exactly the class where a green proves
            // nothing, so this check is only worth having once it has been watched to fail.
            const real = JSON.parse(readFileSync(clientContract, 'utf8'));
            const doctored = { ...real, version: real.version + 1 };
            // Recompute the self-hash so we reach the DIVERGENCE branch rather than tripping
            // the hash check first — otherwise this would pass for the wrong reason.
            doctored.hash = createHash('sha256').update(JSON.stringify(doctored.data, null, 2)).digest('hex');
            const doctoredPath = path.join(worktree, 'doctored-contract.json');
            writeFileSync(doctoredPath, JSON.stringify(doctored, null, 2));

            const { code, out } = runScript(path.join(worktree, SCRIPT_REL), worktree, {
                AGENTTALK_MCP_CLIENT_CONTRACT_PATH: doctoredPath,
            });
            expect(out).toMatch(/diverged/);
            expect(code).not.toBe(0);
        },
    );

    it('falls back without throwing when git is unavailable', () => {
        // The original code could not crash resolving this path, and neither may the fix.
        // An empty PATH means `git` cannot be found, so primaryCheckoutRoot()'s catch must
        // return null and the directory-relative fallback must take over silently.
        const { code, out } = runScript(path.join(hereRoot, SCRIPT_REL), hereRoot, { PATH: '' });
        expect(out).not.toMatch(/Error:|ENOENT|Command failed/);
        expect(out).toMatch(/Contract hash verified successfully/);
        expect(code).toBe(0);
    });
});
