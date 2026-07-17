import { describe, it, expect, vi, afterEach } from 'vitest';
import { ScenarioScheduler } from '@agenttalk/runtime-scenarios/scheduler/scenario-scheduler';
import type { ScenarioDefinition } from '@agenttalk/runtime-scenarios/scenarios/types';

// BL-069: the scenario scheduler's per-run suffix must not derive its uniqueness
// from the clock. Two runs that land in the same millisecond used to mint the same
// suffix, and the suffix reaches registry agent-Map keys through cloneWithSuffix —
// the clock-collision class BL-066 removed elsewhere.
//
// The bar FREEZES the clock so a passing verdict cannot depend on machine speed
// (the property is "distinct even when the clock does not move", not "usually
// distinct"). Both assertions were confirmed RED against the pre-fix body
// (`return String(Date.now())`), so neither passes vacuously.
describe('ScenarioScheduler run-suffix uniqueness (BL-069)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const oneAgentDefinition: ScenarioDefinition = {
    name: 'runsuffix-fixture',
    agents: [{ id: 'worker', provider: 'gemini', executionMode: 'persistent' }],
  } as unknown as ScenarioDefinition;

  function newScheduler(): any {
    // nextRunSuffix / cloneWithSuffix touch no deps; a bare instance is enough.
    return new ScenarioScheduler(
      { scenarioDefinition: oneAgentDefinition } as any,
      {} as any,
    );
  }

  it('mints distinct suffixes for two runs at an unmoving clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const scheduler = newScheduler();

    const first = scheduler.nextRunSuffix();
    const second = scheduler.nextRunSuffix();

    // Clock never advanced between the two mints.
    expect(Date.now()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    expect(first).not.toBe(second);
  });

  it('produces distinct cloned agent ids across two runs at an unmoving clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const scheduler = newScheduler();

    const cloneA = scheduler.cloneWithSuffix(oneAgentDefinition, scheduler.nextRunSuffix());
    const cloneB = scheduler.cloneWithSuffix(oneAgentDefinition, scheduler.nextRunSuffix());

    const idA: string = cloneA.agents[0].id;
    const idB: string = cloneB.agents[0].id;

    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});
