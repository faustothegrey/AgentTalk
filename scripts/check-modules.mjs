#!/usr/bin/env node

/**
 * BL-144 (Wave 2) — the module-ownership gate.
 *
 * USAGE:
 *   node scripts/check-modules.mjs           # gate: exit 1 on any error
 *   node scripts/check-modules.mjs --list     # every owned path, grouped by module
 *   node scripts/check-modules.mjs --json
 *
 * WHY THIS EXISTS
 *   Wave 0 evicted episodic records, Wave 1 split the backlog by concern, and [[BL-141]] gave the
 *   citation graph a linter. The one thing still missing from the artifacts is the thing the CODE
 *   has had all along: a declared boundary. Nothing said which module a file belongs to, so nothing
 *   could say that a document and the code it describes had drifted apart.
 *
 *   `modules/<name>/module.json` is that declaration. This gate proves it TOTAL and DISJOINT: every
 *   source file in the universe is claimed by exactly one module, or is on a commented UNOWNED
 *   register. That is the forcing function BL-144 actually asked for — "nothing forces a reader
 *   touching the code to touch the claim." A directory layout only *invites* that. A gate that goes
 *   red on an unclaimed file *forces* it, and does so without rewriting a build graph that works.
 *
 * WHY OWNERSHIP IS DECLARED AND NOT PHYSICAL — the two refusals, so a later reader does not
 * "finish the job" and undo them (both argued in `design/bl144-plan.md` §2):
 *
 *   1. THE BACKLOG DOES NOT MOVE. `design/backlog/**` is a path in the OPERATOR SEAT's write
 *      allowlist — the fenced surface on which a seat holding no authority may file items. It is
 *      named at six sites (`AGENT.md` ×3, `design/operator-seat/SKILL.md`, this repo's
 *      `infra-invariant.mjs` ×2). Moving the backlog under `modules/` would force that fence to
 *      widen across the module tree — where durable law lives — or to remove the seat's ability to
 *      file at all. A module OWNS its slice by naming it here; ownership was the goal, adjacency
 *      was only ever one means to it, and here it is the means that costs a safety property.
 *
 *   2. CODE DOES NOT MOVE. The build is a project-references graph: root `tsconfig.json` declares 9
 *      references, 6 packages declare their own, `tsconfig.base.json` carries `paths` aliases, and
 *      `package.json` workspaces is `["apps/*", "packages/*"]` — under which `modules/*` is not a
 *      workspace at all. Relocation rewrites four coupled things Wave 2 does not need rewritten.
 *
 * ⚠️ GLOB MATCHING IS BOUNDARY-ANCHORED, AND THAT IS THE CORRECTNESS OF THIS GATE.
 *   `packages/mcp-transport/**` must NOT match `packages/mcp-transport-legacy/x.ts`, and
 *   `scripts/relay-*.mjs` must not reach into a subdirectory. This is the same trap that
 *   `infra-invariant.mjs` documents against itself ("it would accept `apps/vendor/design/backlog.md`")
 *   and that [[BL-141]]'s checker fell into anyway, manufacturing [[BL-142]]'s most alarming line —
 *   a finding that was simply false. A checker with a false-positive rate is worse than no checker:
 *   it spends the reader's trust, and the one real finding gets discarded with the noise.
 *
 * PURITY NOTE, learned by getting it wrong in this same overhaul: the analysis core below takes its
 * whole world as arguments and reads NOTHING from disk. An earlier refactor kept a "pure" collector
 * that still reached for the live repo, so every fixture silently picked up real data and its tests
 * only looked meaningful. `analyze()` is honestly pure; `main()` is honestly impure.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isMainModule } from './lib/is-main.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');
export const MODULES_DIR = path.join(REPO_ROOT, 'modules');
export const BACKLOG_DIR = path.join(REPO_ROOT, 'design', 'backlog');

/**
 * The universe this gate claims total coverage over. Every exclusion is a place the gate agrees to
 * be blind, so each carries its reason — an unexplained exclusion is how a fence quietly stops
 * fencing.
 *
 *   `**\/__tests__/**`     tests follow their subject; owning them separately would double every
 *                          entry and say nothing new.
 *   `**\/dist/**`          build output, gitignored — never tracked, listed for the reader.
 *   `scripts/archive/**`   Wave 0's dead provers. Archived precisely because nothing owns them.
 *   `node_modules`         not ours.
 */
export const UNIVERSE_ROOTS = ['apps', 'packages', 'scripts'];
export const UNIVERSE_EXT = /\.(ts|tsx|mjs|js)$/;
export const UNIVERSE_EXEMPT = [/(^|\/)__tests__\//, /(^|\/)dist\//, /^scripts\/archive\//, /node_modules/];
export const inUniverse = (rel) =>
  UNIVERSE_ROOTS.some((r) => rel === r || rel.startsWith(`${r}/`)) &&
  UNIVERSE_EXT.test(rel) &&
  !UNIVERSE_EXEMPT.some((rx) => rx.test(rel));

/**
 * Match one glob against one repo-relative path.
 *
 * A deliberately SMALL grammar — three forms, each anchored at a path boundary. A larger one would
 * need a glob library and would make the matcher the thing you have to trust; this one fits in a
 * reader's head, which is the point for a file whose whole job is to be believed.
 *
 *   `a/b/c.ts`     exact match, nothing else
 *   `a/b/**`       everything BENEATH `a/b/` — and the trailing slash is what stops
 *                  `a/b-legacy/x.ts` matching. `a/b` itself is not a file, so it is not matched.
 *   `a/*.mjs`      exactly one segment under `a/`, with that extension — never `a/sub/x.mjs`
 */
export function matchesGlob(glob, rel) {
  if (glob.endsWith('/**')) {
    const prefix = glob.slice(0, -2); // keep the trailing slash: the boundary IS the fence
    return rel.startsWith(prefix);
  }
  const star = glob.indexOf('*');
  if (star !== -1) {
    const dir = glob.slice(0, glob.lastIndexOf('/') + 1);
    const pattern = glob.slice(dir.length);
    if (!rel.startsWith(dir)) return false;
    const tail = rel.slice(dir.length);
    if (tail.includes('/')) return false; // single-segment only
    const rx = new RegExp(`^${pattern.split('*').map(escapeRe).join('[^/]*')}$`);
    return rx.test(tail);
  }
  return rel === glob;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which modules claim this path. Zero = unowned; two or more = a disputed boundary.
 *
 * Reads `m.raw.code`, not `m.code` — the manifest wrapper is `{name, dir, raw}` throughout. The
 * first draft read `m.code`, which is `undefined` for every module, so the gate reported all 115
 * source files unowned and looked like a catastrophic ownership hole. One hand-check of a path it
 * definitely owned (`scripts/validate-backlog.mjs`) found it in seconds. Volume is not evidence.
 */
export function ownersOf(rel, manifests) {
  return manifests.filter((m) => (m.raw?.code ?? []).some((g) => matchesGlob(g, rel))).map((m) => m.name);
}

/**
 * The whole check, as a pure function of its inputs.
 *
 * @param {object} world
 * @param {Array<{name:string, dir:string, raw:object}>} world.manifests
 * @param {string[]} world.universe      repo-relative source paths this gate must account for
 * @param {string[]} world.backlogFiles  filenames present under design/backlog/
 * @param {string[]} world.docFiles      repo-relative doc paths that exist
 * @param {string[]} world.unowned       the commented debt register
 */
export function analyze({ manifests, universe, backlogFiles, docFiles, unowned = [] }) {
  const errors = [];
  const warns = [];

  // 1 — shape, and name === directory. A manifest whose name disagrees with its location is a file
  // that will be cited by two different identities, which is how the docs got here in the first place.
  const seen = new Set();
  for (const m of manifests) {
    if (!m.raw || typeof m.raw !== 'object') errors.push(`${m.dir}: module.json did not parse to an object`);
    if (m.raw?.name !== m.name) errors.push(`${m.dir}: name "${m.raw?.name}" !== directory "${m.name}"`);
    if (seen.has(m.name)) errors.push(`${m.name}: duplicate module name`);
    seen.add(m.name);
    if (typeof m.raw?.summary !== 'string' || !m.raw.summary.trim())
      errors.push(`${m.name}: missing summary — a module nobody can describe in one line is not a module`);
    for (const f of ['code', 'docs', 'deps']) {
      if (!Array.isArray(m.raw?.[f])) errors.push(`${m.name}: "${f}" must be an array (use [] for none)`);
    }
    if (!('backlog' in (m.raw ?? {}))) errors.push(`${m.name}: "backlog" must be present (use null for none)`);
  }

  // 2 — deps resolve, and the graph is acyclic. A cycle here would mean the citation rule BL-141
  // deferred ("a module may cite its own module and its declared deps") could never be decided.
  const names = new Set(manifests.map((m) => m.name));
  for (const m of manifests) {
    for (const d of m.raw?.deps ?? []) {
      if (!names.has(d)) errors.push(`${m.name}: dep "${d}" is not a module`);
      if (d === m.name) errors.push(`${m.name}: depends on itself`);
    }
  }
  for (const cycle of findCycles(manifests)) errors.push(`dependency cycle: ${cycle.join(' -> ')}`);

  // 3 — backlog slices: resolve, and claimed at most once.
  const claimedSlices = new Map();
  for (const m of manifests) {
    const slice = m.raw?.backlog;
    if (slice == null) continue;
    if (!backlogFiles.includes(slice)) errors.push(`${m.name}: backlog slice "${slice}" not found under design/backlog/`);
    if (claimedSlices.has(slice)) errors.push(`backlog slice "${slice}" claimed by both ${claimedSlices.get(slice)} and ${m.name}`);
    claimedSlices.set(slice, m.name);
  }

  // 4 + 5 — TOTAL and DISJOINT over the universe. This pair is the gate.
  const unownedSet = new Set(unowned);
  const orphans = [];
  const disputed = [];
  for (const rel of universe) {
    const owners = ownersOf(rel, manifests);
    if (owners.length === 0) {
      if (!unownedSet.has(rel)) orphans.push(rel);
    } else if (owners.length > 1) {
      disputed.push({ rel, owners });
    }
  }
  for (const rel of orphans) errors.push(`unowned: ${rel} — claim it in a module's "code", or register it in UNOWNED with a reason`);
  for (const d of disputed) errors.push(`owned twice: ${d.rel} — claimed by ${d.owners.join(', ')}`);

  // A register entry that no longer describes a real file is stale, and a stale fence is worse than
  // none: it reads as a considered decision about something that is not there.
  const universeSet = new Set(universe);
  for (const rel of unowned) {
    if (!universeSet.has(rel)) warns.push(`UNOWNED register names "${rel}", which is not in the universe — drop it`);
    else if (ownersOf(rel, manifests).length > 0) warns.push(`UNOWNED register names "${rel}", but a module now claims it — drop it`);
  }

  // 6 — docs exist and are claimed once. Same shape as code: a doc owned twice has no owner.
  const docSet = new Set(docFiles);
  const claimedDocs = new Map();
  for (const m of manifests) {
    for (const d of m.raw?.docs ?? []) {
      if (!docSet.has(d)) errors.push(`${m.name}: doc "${d}" does not exist`);
      if (claimedDocs.has(d)) errors.push(`doc "${d}" claimed by both ${claimedDocs.get(d)} and ${m.name}`);
      claimedDocs.set(d, m.name);
    }
  }

  return {
    errors,
    warns,
    stats: {
      modules: manifests.length,
      universe: universe.length,
      owned: universe.length - orphans.length - unowned.filter((u) => universeSet.has(u)).length,
      unowned: unowned.length,
      docs: claimedDocs.size,
      slices: claimedSlices.size,
    },
  };
}

/** Depth-first cycle detection over `deps`. Returns each cycle once, as a readable path. */
export function findCycles(manifests) {
  const graph = new Map(manifests.map((m) => [m.name, m.raw?.deps ?? []]));
  const cycles = [];
  const state = new Map();
  const stack = [];
  const visit = (n) => {
    if (state.get(n) === 'done') return;
    if (state.get(n) === 'open') {
      cycles.push([...stack.slice(stack.indexOf(n)), n]);
      return;
    }
    state.set(n, 'open');
    stack.push(n);
    for (const d of graph.get(n) ?? []) if (graph.has(d)) visit(d);
    stack.pop();
    state.set(n, 'done');
  };
  for (const m of manifests) visit(m.name);
  return cycles;
}

// ────────────────────────────── impure edge ──────────────────────────────

export function readManifests(modulesDir = MODULES_DIR) {
  if (!fs.existsSync(modulesDir)) return [];
  return fs
    .readdirSync(modulesDir)
    .filter((d) => fs.statSync(path.join(modulesDir, d)).isDirectory())
    .sort()
    .map((name) => {
      const file = path.join(modulesDir, name, 'module.json');
      let raw = null;
      try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        raw = { __parseError: String(e.message) };
      }
      return { name, dir: `modules/${name}`, raw };
    });
}

export function trackedFiles(repoRoot = REPO_ROOT) {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
}

/**
 * The UNOWNED register — the visible debt, in the ratchet style [[BL-141]] established.
 * Every entry names why nothing owns it. An empty register is the goal, not the assumption.
 */
export const UNOWNED = [
  // `scripts/lib/is-main.mjs` is shared by every script in every module; giving it to one would be
  // a lie about who depends on it, and giving it to all of them breaks disjointness. It is the one
  // genuine cross-module leaf.
  'scripts/lib/is-main.mjs',
];

export function main(argv = process.argv.slice(2)) {
  const tracked = trackedFiles();
  const manifests = readManifests();
  const world = {
    manifests,
    universe: tracked.filter(inUniverse).sort(),
    backlogFiles: fs.existsSync(BACKLOG_DIR) ? fs.readdirSync(BACKLOG_DIR).filter((f) => f.endsWith('.md')) : [],
    docFiles: tracked.filter((f) => f.endsWith('.md')),
    unowned: UNOWNED,
  };
  const result = analyze(world);

  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return result.errors.length ? 1 : 0;
  }

  if (argv.includes('--list')) {
    for (const m of manifests) {
      const owned = world.universe.filter((rel) => ownersOf(rel, manifests).includes(m.name));
      console.log(`\n${m.name}  (${owned.length} files, ${(m.raw?.docs ?? []).length} docs, backlog: ${m.raw?.backlog ?? '—'})`);
      for (const f of owned) console.log(`    ${f}`);
    }
    console.log('');
  }

  for (const w of result.warns) console.log(`  warn   ${w}`);
  for (const e of result.errors) console.log(`  ERROR  ${e}`);

  const s = result.stats;
  if (result.errors.length) {
    console.log(`\n✗ modules: ${result.errors.length} error(s) — ${s.owned}/${s.universe} source files owned by ${s.modules} modules.`);
    return 1;
  }
  console.log(
    `✓ modules OK — ${s.modules} modules own ${s.owned}/${s.universe} source files ` +
      `(${s.unowned} on the UNOWNED register), ${s.docs} docs, ${s.slices} backlog slices.`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) process.exit(main());
