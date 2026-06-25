import { describe, it, expect, vi } from 'vitest';
import { TeamCoordinator } from '../team-coordinator.js';

// M10 / LB-21 — the setPlanningPhase funnel + optional onPhaseChange observability hook.
// Pins the new contract: the hook fires on every transition (carrying phase + previous),
// is a STRICT no-op when unset (prior bare planningPhases.set behaviour preserved), and a
// throwing hook is swallowed best-effort so visualisation can never perturb the brain.
describe('M10/LB-21 onPhaseChange hook (planning-phase funnel)', () => {
  let deps: any;

  function build(withHook: boolean): any {
    deps = {
      getAgent: vi.fn((id: string) => ({ id, status: 'ready' })),
      sendProtocol: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(undefined),
      emitTeam: vi.fn(),
      emitTeamTask: vi.fn(),
      emitPlanningComplete: vi.fn(),
      logError: vi.fn(),
    };
    if (withHook) deps.onPhaseChange = vi.fn();
    return new TeamCoordinator(deps);
  }

  it('fires onPhaseChange with phase + previous on each transition, and still records the phase', () => {
    const c = build(true);
    c.setPlanningPhase('task-1', 'protocol_ack_pending');
    c.setPlanningPhase('task-1', 'fact_collection');

    expect(deps.onPhaseChange).toHaveBeenNthCalledWith(1, {
      taskId: 'task-1',
      phase: 'protocol_ack_pending',
      previous: undefined,
    });
    expect(deps.onPhaseChange).toHaveBeenNthCalledWith(2, {
      taskId: 'task-1',
      phase: 'fact_collection',
      previous: 'protocol_ack_pending',
    });
    expect(c.getPlanningPhase('task-1')).toBe('fact_collection');
  });

  it('is a strict no-op when the hook is unset (prior behaviour preserved)', () => {
    const c = build(false);
    expect(() => c.setPlanningPhase('task-2', 'discussion')).not.toThrow();
    expect(c.getPlanningPhase('task-2')).toBe('discussion');
  });

  it('swallows a throwing hook (best-effort) and still records the phase', () => {
    const c = build(true);
    deps.onPhaseChange.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => c.setPlanningPhase('task-3', 'submittal_pending')).not.toThrow();
    expect(c.getPlanningPhase('task-3')).toBe('submittal_pending');
    expect(deps.logError).toHaveBeenCalled();
  });
});
