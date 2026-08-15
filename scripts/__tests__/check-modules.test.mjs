import { describe, it, expect } from 'vitest';
import { analyze, matchesGlob, ownersOf, inUniverse, findCycles, main, UNOWNED } from '../check-modules.mjs';

/**
 * BL-144 (Wave 2) — the module-ownership gate.
 *
 * `analyze` is pure over its whole world, so almost everything here runs without a repo. The one
 * deliberate exception is the last block, which runs the gate against the REAL repo — because a
 * gate proven only against fixtures is a gate that has never met its subject. That lesson is the
 * overhaul's own: [[BL-141]] shipped red against the real corpus while every fixture passed, and
 * nothing in the suite noticed.
 */

const mod = (name, over = {}) => ({
  name,
  dir: `modules/${name}`,
  raw: { name, summary: `the ${name} module`, code: [], docs: [], backlog: null, deps: [], ...over },
});

const world = (over = {}) => ({
  manifests: [],
  universe: [],
  backlogFiles: [],
  docFiles: [],
  unowned: [],
  ...over,
});

describe('matchesGlob — the boundary is the whole correctness of the gate', () => {
  it('`dir/**` matches beneath the directory', () => {
    expect(matchesGlob('packages/mcp-transport/**', 'packages/mcp-transport/src/a.ts')).toBe(true);
    expect(matchesGlob('packages/mcp-transport/**', 'packages/mcp-transport/x.ts')).toBe(true);
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR. A prefix match without the trailing slash accepts a
   * SIBLING directory whose name merely starts the same way — the exact trap `infra-invariant.mjs`
   * documents against itself, and the one [[BL-141]]'s checker fell into anyway, manufacturing
   * [[BL-142]]'s most alarming (and false) finding.
   */
  it('`dir/**` does NOT match a sibling directory sharing the prefix', () => {
    expect(matchesGlob('packages/mcp-transport/**', 'packages/mcp-transport-legacy/x.ts')).toBe(false);
    expect(matchesGlob('apps/web/**', 'apps/web-legacy/index.ts')).toBe(false);
  });

  /** The vendored-path case, planted explicitly: a nested copy must not be claimed. */
  it('`dir/**` does NOT match a vendored path that merely contains it', () => {
    expect(matchesGlob('packages/contracts/**', 'apps/vendor/packages/contracts/index.ts')).toBe(false);
    expect(matchesGlob('scripts/relay-*.mjs', 'apps/vendor/scripts/relay-approve.mjs')).toBe(false);
  });

  it('`dir/*.ext` is single-segment only, and respects the extension', () => {
    expect(matchesGlob('scripts/relay-*.mjs', 'scripts/relay-approve.mjs')).toBe(true);
    expect(matchesGlob('scripts/relay-*.mjs', 'scripts/sub/relay-approve.mjs')).toBe(false);
    expect(matchesGlob('scripts/relay-*.mjs', 'scripts/relay-approve.ts')).toBe(false);
    expect(matchesGlob('scripts/arbiter-*.mjs', 'scripts/arbiter.mjs')).toBe(false);
  });

  it('a bare path is an exact match, never a prefix', () => {
    expect(matchesGlob('apps/orchestrator/src/backlog.ts', 'apps/orchestrator/src/backlog.ts')).toBe(true);
    expect(matchesGlob('apps/orchestrator/src/backlog.ts', 'apps/orchestrator/src/backlog.ts.bak')).toBe(false);
  });
});

describe('coverage is TOTAL and DISJOINT — the pair that IS the gate', () => {
  it('an unclaimed source file is an error naming the file', () => {
    const r = analyze(world({ manifests: [mod('a')], universe: ['packages/x/y.ts'] }));
    expect(r.errors.some((e) => e.includes('unowned: packages/x/y.ts'))).toBe(true);
  });

  it('a file claimed by two modules is an error naming both', () => {
    const r = analyze(
      world({
        manifests: [mod('a', { code: ['packages/x/**'] }), mod('b', { code: ['packages/x/y.ts'] })],
        universe: ['packages/x/y.ts'],
      }),
    );
    expect(r.errors.some((e) => e.includes('owned twice') && e.includes('a, b'))).toBe(true);
  });

  it('the UNOWNED register silences an orphan, and only that orphan', () => {
    const w = world({ manifests: [mod('a')], universe: ['scripts/lib/x.mjs', 'scripts/lib/z.mjs'], unowned: ['scripts/lib/x.mjs'] });
    const r = analyze(w);
    expect(r.errors.filter((e) => e.startsWith('unowned:'))).toEqual([
      expect.stringContaining('scripts/lib/z.mjs'),
    ]);
  });

  /** A register entry describing nothing reads as a considered decision about a file that is gone. */
  it('a stale UNOWNED entry warns rather than passing silently', () => {
    const r = analyze(world({ manifests: [mod('a')], universe: [], unowned: ['scripts/gone.mjs'] }));
    expect(r.warns.some((w) => w.includes('scripts/gone.mjs') && w.includes('not in the universe'))).toBe(true);
  });

  it('an UNOWNED entry a module has since claimed warns too', () => {
    const r = analyze(
      world({ manifests: [mod('a', { code: ['scripts/x.mjs'] })], universe: ['scripts/x.mjs'], unowned: ['scripts/x.mjs'] }),
    );
    expect(r.warns.some((w) => w.includes('but a module now claims it'))).toBe(true);
  });
});

describe('manifest shape', () => {
  it('name must equal the directory it sits in', () => {
    const m = mod('a');
    m.raw.name = 'b';
    expect(analyze(world({ manifests: [m] })).errors.some((e) => e.includes('!== directory'))).toBe(true);
  });

  it('a module with no one-line summary is rejected', () => {
    const r = analyze(world({ manifests: [mod('a', { summary: '  ' })] }));
    expect(r.errors.some((e) => e.includes('missing summary'))).toBe(true);
  });

  it('`backlog` must be present even when null — absence and "none" are different claims', () => {
    const m = mod('a');
    delete m.raw.backlog;
    expect(analyze(world({ manifests: [m] })).errors.some((e) => e.includes('"backlog" must be present'))).toBe(true);
  });

  it('null backlog is accepted — a module with nothing filed against it is a true statement', () => {
    expect(analyze(world({ manifests: [mod('a')] })).errors).toEqual([]);
  });
});

describe('the dependency graph', () => {
  it('an unresolvable dep is an error', () => {
    const r = analyze(world({ manifests: [mod('a', { deps: ['ghost'] })] }));
    expect(r.errors.some((e) => e.includes('dep "ghost" is not a module'))).toBe(true);
  });

  it('self-dependency is an error', () => {
    expect(analyze(world({ manifests: [mod('a', { deps: ['a'] })] })).errors.some((e) => e.includes('depends on itself'))).toBe(true);
  });

  it('a cycle is detected and printed as a path', () => {
    const ms = [mod('a', { deps: ['b'] }), mod('b', { deps: ['c'] }), mod('c', { deps: ['a'] })];
    expect(findCycles(ms).length).toBeGreaterThan(0);
    expect(analyze(world({ manifests: ms })).errors.some((e) => e.startsWith('dependency cycle'))).toBe(true);
  });

  it('a diamond is NOT a cycle', () => {
    const ms = [mod('a', { deps: ['b', 'c'] }), mod('b', { deps: ['d'] }), mod('c', { deps: ['d'] }), mod('d')];
    expect(findCycles(ms)).toEqual([]);
  });
});

describe('backlog slices are claimed, not moved', () => {
  it('a slice that does not exist under design/backlog/ is an error', () => {
    const r = analyze(world({ manifests: [mod('a', { backlog: '99-ghost.md' })], backlogFiles: ['10-x.md'] }));
    expect(r.errors.some((e) => e.includes('not found under design/backlog/'))).toBe(true);
  });

  it('two modules cannot claim the same slice', () => {
    const r = analyze(
      world({ manifests: [mod('a', { backlog: '10-x.md' }), mod('b', { backlog: '10-x.md' })], backlogFiles: ['10-x.md'] }),
    );
    expect(r.errors.some((e) => e.includes('claimed by both a and b'))).toBe(true);
  });
});

describe('docs are owned exactly once', () => {
  it('a doc claimed twice has no owner, and that is an error', () => {
    const r = analyze(
      world({ manifests: [mod('a', { docs: ['design/x.md'] }), mod('b', { docs: ['design/x.md'] })], docFiles: ['design/x.md'] }),
    );
    expect(r.errors.some((e) => e.includes('doc "design/x.md" claimed by both'))).toBe(true);
  });

  it('a doc that does not exist is an error', () => {
    const r = analyze(world({ manifests: [mod('a', { docs: ['design/gone.md'] })], docFiles: [] }));
    expect(r.errors.some((e) => e.includes('does not exist'))).toBe(true);
  });
});

describe('the universe definition', () => {
  it('includes source under the three roots', () => {
    expect(inUniverse('packages/runtime-core/src/registry/registry.ts')).toBe(true);
    expect(inUniverse('apps/web/src/App.tsx')).toBe(true);
    expect(inUniverse('scripts/usage.mjs')).toBe(true);
  });

  it('excludes tests, dist, archived provers and node_modules — each for its stated reason', () => {
    expect(inUniverse('scripts/__tests__/x.test.mjs')).toBe(false);
    expect(inUniverse('packages/runtime-core/dist/x.js')).toBe(false);
    expect(inUniverse('scripts/archive/split-backlog.mjs')).toBe(false);
    expect(inUniverse('node_modules/x/index.js')).toBe(false);
  });

  it('excludes docs and config — this gate owns source, `docs:check` owns citations', () => {
    expect(inUniverse('design/backlog/40-backlog.md')).toBe(false);
    expect(inUniverse('AGENT.md')).toBe(false);
    expect(inUniverse('package.json')).toBe(false);
  });

  it('does not reach outside the three roots', () => {
    expect(inUniverse('dist/x.js')).toBe(false);
    expect(inUniverse('appsfoo/x.ts')).toBe(false);
  });
});

/**
 * THE REAL REPO. Everything above proves the analyzer behaves; this proves the analyzer is pointed
 * at something true. [[BL-141]] shipped a gate that was red against the real corpus while its own
 * fixtures were green, and it survived only because an unrelated command happened to run it.
 */
describe('against the real repository', () => {
  it('the gate is GREEN on this repo — every source file owned or registered', () => {
    expect(main(['--json'])).toBe(0);
  });

  it('the UNOWNED register is small and every entry carries a reason in the source', () => {
    expect(UNOWNED.length).toBeLessThanOrEqual(5);
  });
});
