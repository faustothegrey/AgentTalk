import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { isMainModule } from '../lib/is-main.mjs';

/**
 * [[BL-111]] — the entry guard that silently did nothing.
 *
 * `path.resolve(argv[1]) === fileURLToPath(import.meta.url)` compares a path with its symlinks
 * intact against one already resolved. On macOS `/tmp` → `/private/tmp`, so an absolute-path
 * invocation made `main` never run: **no output, exit 0.**
 *
 * Two bars, because either alone is insufficient:
 *   A — every guarded script actually runs when invoked through a symlink. The behaviour.
 *   B — the raw idiom appears nowhere. The regression fence, because this bug's defining feature
 *       is that it SPREAD: six sites, two repos, four spellings, three of them wrong differently.
 *
 * Bar A discovers its own subjects rather than listing them, so a script added tomorrow is covered
 * without anyone remembering to add it here.
 */

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');

/** Every script that declares itself runnable. The registry is the code, not a list in this file. */
function guardedScripts() {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.mjs'))
    .filter((f) => fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf-8').includes('isMainModule(import.meta.url)'));
}

describe('isMainModule', () => {
  it('is false when this module is IMPORTED, not run', () => {
    // These bars are run by vitest, so argv[1] is vitest's entry, never this file.
    expect(isMainModule(import.meta.url)).toBe(false);
  });

  it('is false rather than throwing when argv[1] does not exist', () => {
    const saved = process.argv[1];
    try {
      process.argv[1] = '/definitely/not/here/xyz.mjs';
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = saved;
    }
  });

  it('is false rather than throwing when argv[1] is absent entirely', () => {
    const saved = process.argv[1];
    try {
      process.argv[1] = undefined;
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = saved;
    }
  });
});

describe('BAR A — every guarded script runs when invoked by a SYMLINKED absolute path', () => {
  const link = path.join(os.tmpdir(), `bl111-guard-${process.pid}`);

  it('finds scripts to test at all — an empty subject list would pass vacuously', () => {
    // Without this, a refactor that renames the helper turns the whole suite below into a no-op
    // that reports green. That is the same vacuous-pass shape BL-097 and BL-110 both hit.
    expect(guardedScripts().length).toBeGreaterThanOrEqual(4);
  });

  it.each(guardedScripts())('%s produces output through a symlink', (script) => {
    fs.rmSync(link, { force: true });
    fs.symlinkSync(REPO_ROOT, link);
    try {
      const viaLink = path.join(link, 'scripts', script);
      // If these were equal the bar would prove nothing — it would just be a normal invocation.
      expect(path.resolve(viaLink)).not.toBe(fs.realpathSync(viaLink));

      let out;
      try {
        out = execFileSync(process.execPath, [viaLink], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        // A non-zero exit is fine — usage errors are output. Silence is the failure.
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
      expect(out.trim(), `${script}: main() did not run — the entry guard rejected a symlinked argv[1]`).not.toBe('');
    } finally {
      fs.rmSync(link, { force: true });
    }
  });
});

describe('BAR B — the raw idiom appears nowhere', () => {
  it('no script compares argv[1] to import.meta.url directly', () => {
    // The regression fence. This bug's defining property is that it spread by copy-paste, so
    // catching the NEXT copy matters more than having fixed the current six.
    const offenders = [];
    for (const f of fs.readdirSync(SCRIPTS_DIR).filter((x) => x.endsWith('.mjs'))) {
      const lines = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf-8').split('\n');
      lines.forEach((line, i) => {
        const t = line.trim();
        // Prose describing the bug is not the bug. Skip comments.
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
        if (/process\.argv\[1\]/.test(line) && /import\.meta\.url/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(offenders, `use isMainModule() from scripts/lib/is-main.mjs instead`).toEqual([]);
  });
});
