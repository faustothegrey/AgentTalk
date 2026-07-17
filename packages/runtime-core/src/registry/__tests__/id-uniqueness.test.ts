import { describe, it, expect, afterEach, vi } from 'vitest';
import { Registry } from '../registry.js';

// BL-066 — ids must not collide.
//
// Every bar here FREEZES THE CLOCK. That is the point, not a convenience: the
// defect was found through a bar that failed 5-of-6 in isolation and passed
// 354/354 under full-suite load, because load happened to space two mints into
// different milliseconds. Timing decided the verdict, so the bar was evidence
// about the machine, not about the code. Pinning `Date.now()` to a constant
// makes the collision certain instead of likely: these bars are red on the
// unfixed code every single run, and they cannot be quieted by a faster laptop.
//
// It also states the real guarantee. "Ids are usually unique" is not a
// property. "Ids are unique even when the clock does not move" is — and it is
// what the timestamp alone can never deliver.
describe('BL-066: id uniqueness does not depend on the clock', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function freezeClock(atMs = 1_784_286_771_163): void {
    vi.spyOn(Date, 'now').mockReturnValue(atMs);
  }

  async function readyAgent(registry: Registry, id: string) {
    const agent = await registry.createAgent(id);
    agent.setStatus('starting');
    agent.setStatus('ready');
    return agent;
  }

  it('mints distinct team ids within a single millisecond', async () => {
    const registry = new Registry({ readinessTimeoutMs: 500 });
    await readyAgent(registry, 'w1');
    await readyAgent(registry, 'w2');
    freezeClock();

    const a = registry.createTeam([{ agentId: 'w1', role: 'worker' }]);
    const b = registry.createTeam([{ agentId: 'w2', role: 'worker' }]);

    expect(a.id).not.toBe(b.id);
    await registry.destroy();
  });

  // The consequence, asserted separately from the cause: a colliding id does not
  // merely look wrong, it DESTROYS the earlier object. `teams` is a Map keyed by
  // id, so the second `set` evicts the first silently — no error, no warning.
  // A team ceases to exist. This bar fails even if someone "fixes" uniqueness in
  // a way that still overwrites.
  it('keeps both teams: a colliding id would silently evict the first', async () => {
    const registry = new Registry({ readinessTimeoutMs: 500 });
    await readyAgent(registry, 'w1');
    await readyAgent(registry, 'w2');
    freezeClock();

    registry.createTeam([{ agentId: 'w1', role: 'worker' }]);
    registry.createTeam([{ agentId: 'w2', role: 'worker' }]);

    expect(registry.getTeams()).toHaveLength(2);
    await registry.destroy();
  });

  it('mints distinct task ids within a single millisecond', async () => {
    const registry = new Registry({ readinessTimeoutMs: 500 });
    await readyAgent(registry, 'w1');
    await readyAgent(registry, 'w2');
    const teamA = registry.createTeam([{ agentId: 'w1', role: 'worker' }]);
    const teamB = registry.createTeam([{ agentId: 'w2', role: 'worker' }]);
    freezeClock();

    const taskA = await registry.assignTeamTask(teamA.id, 'task for A');
    const taskB = await registry.assignTeamTask(teamB.id, 'task for B');

    expect(taskA.id).not.toBe(taskB.id);
    await registry.destroy();
  });

  // Deliberately NOT asserted here: that both tasks survive in the `tasks` map.
  // It needs a read accessor the facade does not have, and adding one belongs to
  // BL-056, not to this branch. With distinct ids (the bar above) a Map keyed by
  // id cannot evict — the eviction bar for teams exists only because teams had a
  // reachable accessor. Recorded rather than left as a silent gap.
});
