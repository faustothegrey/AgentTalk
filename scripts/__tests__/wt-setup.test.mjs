import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLinkPlan } from '../wt-setup.mjs';

describe('wt-setup buildLinkPlan (BL-036)', () => {
  let tmp;
  let nm;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'wt-setup-test-'));
    nm = path.join(tmp, 'node_modules');
    mkdirSync(nm, { recursive: true });
    // regular deps
    mkdirSync(path.join(nm, 'vitest'));
    mkdirSync(path.join(nm, 'express'));
    // the dotfile that a shell `*` glob would miss — readdir must catch it
    mkdirSync(path.join(nm, '.bin'));
    // the workspace scope, with RELATIVE symlinks like the real repo
    mkdirSync(path.join(nm, '@agenttalk'));
    symlinkSync('../../packages/contracts', path.join(nm, '@agenttalk', 'contracts'));
    symlinkSync('../../packages/runtime-core', path.join(nm, '@agenttalk', 'runtime-core'));
    symlinkSync('../../apps/web', path.join(nm, '@agenttalk', 'web'));
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('links every top-level entry INCLUDING .bin, and skips @agenttalk', () => {
    const { topLinks } = buildLinkPlan(nm);
    const names = topLinks.map((l) => l.name).sort();
    expect(names).toEqual(['.bin', 'express', 'vitest']);
    expect(names).toContain('.bin'); // the load-bearing gotcha
    expect(names).not.toContain('@agenttalk');
  });

  it('points top-level links at the primary node_modules (absolute)', () => {
    const { topLinks } = buildLinkPlan(nm);
    const vitest = topLinks.find((l) => l.name === 'vitest');
    expect(vitest.target).toBe(path.join(nm, 'vitest'));
  });

  it('re-creates @agenttalk/* preserving the RELATIVE target (so it resolves into the worktree)', () => {
    const { scopedLinks } = buildLinkPlan(nm);
    const byName = Object.fromEntries(scopedLinks.map((l) => [l.name, l.relativeTarget]));
    expect(byName).toEqual({
      contracts: '../../packages/contracts',
      'runtime-core': '../../packages/runtime-core',
      web: '../../apps/web',
    });
  });

  it('returns no scopedLinks when there is no @agenttalk scope', () => {
    rmSync(path.join(nm, '@agenttalk'), { recursive: true, force: true });
    const { scopedLinks, topLinks } = buildLinkPlan(nm);
    expect(scopedLinks).toEqual([]);
    expect(topLinks.map((l) => l.name).sort()).toEqual(['.bin', 'express', 'vitest']);
  });
});
