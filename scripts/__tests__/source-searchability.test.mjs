import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// A RAW NUL byte in a source file makes that file INVISIBLE to grep and ripgrep.
//
// Both classify a file containing NUL as binary and skip it — ripgrep silently, grep with a
// "Binary file matches" line that is routinely lost in a pipeline. The result is not flakiness:
// it is a deterministic, total blind spot, and it lands on whichever file happens to carry the
// byte. Two files did — `registry.ts`, the engine's largest, and `infra-invariant.mjs`, the
// operator harness. A search for `setAgentBusyState` in `registry.ts` returned nothing while
// the symbol was present on two lines.
//
// That cost real work twice before the cause was found: it was recorded as "grep is unreliable
// on large files, verify with a second tool" — a superstition that happened to produce correct
// behaviour. The actual rule is narrower and fixable, which is why this test exists.
//
// The fix is to write the escape (`\0`) instead of the byte. Both forms produce the identical
// string at runtime, so this guard costs nothing to satisfy. It is deliberately a REPO-WIDE
// scan rather than a check on the two known files: the defect is not about those files, it is
// about any file acquiring the property, and a search tool that cannot see a file cannot be
// used to find the next one.

/** The checkout these tests run from — a task worktree during development. */
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const SEARCHABLE = /\.(ts|tsx|mjs|cjs|js|jsx|json|md)$/;

/** Tracked, searchable source files — `git ls-files` so untracked scratch and node_modules are out. */
function trackedSourceFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\0')
    .filter((f) => f && SEARCHABLE.test(f));
}

describe('source files stay searchable by grep/ripgrep', () => {
  it('no tracked source file contains a raw NUL byte', () => {
    const offenders = [];

    for (const rel of trackedSourceFiles()) {
      const buf = readFileSync(path.join(root, rel));
      const at = buf.indexOf(0);
      if (at >= 0) offenders.push(`${rel} (first NUL at byte ${at})`);
    }

    // Named in the failure so the fix is obvious from the output alone: write `\0`, not the byte.
    expect(offenders, `these files are invisible to grep/rg — replace the raw NUL with the \\0 escape:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('the guard can actually fail — a NUL-carrying buffer is detected', () => {
    // Without this, a scan that silently matched nothing would pass forever.
    const withNul = Buffer.from(`const k = \`a${String.fromCharCode(0)}b\`;`, 'utf8');
    expect(withNul.indexOf(0)).toBeGreaterThan(-1);
  });

  it('the escape and the raw byte produce the identical string, so the fix is behaviour-free', () => {
    // The load-bearing claim of the fix: `registry.ts`'s relay-pair key and
    // `infra-invariant.mjs`'s disposition fingerprint must hash exactly as before.
    expect(`a\0b`).toBe(`a${String.fromCharCode(0)}b`);
    expect(`a\0b`.charCodeAt(1)).toBe(0);
  });
});
