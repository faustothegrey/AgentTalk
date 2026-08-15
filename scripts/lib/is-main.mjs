import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Was this module run as a script, or imported? — [[BL-111]]
 *
 * ONE implementation, deliberately, because the bug this replaces was a copy-paste that had spread
 * to six sites in two repos with four different spellings, three of them wrong in three different
 * ways. A shared helper is not tidiness here: it is the only way "fix the idiom" can stay fixed.
 *
 * THE DEFECT IT REPLACES
 *   `path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`
 *
 *   `path.resolve` normalises a path but does NOT resolve symlinks. `import.meta.url` is already a
 *   real path. On macOS `/tmp` is a symlink to `/private/tmp`, so invoking a script by an absolute
 *   path under `/tmp` compared two different strings, the guard read false, and **`main` never ran:
 *   no output, exit 0.**
 *
 *   A silent no-op that reports success is the worst failure mode available. It is strictly worse
 *   than a crash, because every caller that checks an exit code reads it as "did the work". For
 *   `infra-invariant.mjs` — which GATES operator runs — it meant the sweep could report clean
 *   without ever looking.
 *
 *   It does not reproduce on Linux, where `/tmp` is a real directory. Same platform-shaped trap as
 *   [[BL-098]] and [[BL-100]].
 *
 * WHY THIS IS NOT AN EDGE CASE
 *   The broken invocation is the MANDATED one. `modules/containment/docs/launch-and-monitor-runbook.md` requires
 *   tooling to be invoked by absolute path, worktrees live under `os.tmpdir()` since [[BL-100]],
 *   and a remote courier ([[BL-110]]) has no other option. The failure was reachable by exactly the
 *   intended caller, which is why a green suite never saw it — every test and every hand-run used a
 *   relative path from inside the directory.
 *
 * BOTH SIDES ARE RESOLVED, not just `argv[1]`. `import.meta.url` is normally already real, but
 * resolving it too costs nothing and removes a whole class of "which side was canonical" reasoning
 * from every future reader.
 *
 * FAILS TO `false`, never throws: `realpathSync` throws on a missing path, and an import must not
 * be able to crash on a guard. False is also the safe direction — a module that declines to run as
 * a script is inert, while one that wrongly runs as a script has side effects.
 *
 * @param {string} importMetaUrl - pass `import.meta.url` from the calling module
 * @returns {boolean}
 */
export function isMainModule(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
