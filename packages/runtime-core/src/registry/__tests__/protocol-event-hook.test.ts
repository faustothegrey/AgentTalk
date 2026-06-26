import { describe, it, expect, vi } from 'vitest';
import { TeamCoordinator } from '../team-coordinator.js';

// M10 / bridge v3 — the emitProtocolEvent helper + optional onProtocolEvent hook.
// Mirrors planning-phase-hook.test.ts: the hook fires with the event payload, is a
// STRICT no-op when unset (behaviour preserved), and a throwing hook is swallowed
// best-effort so visualisation can never perturb the protocol brain. Deliberately
// SEPARATE from onPhaseChange so these signals never touch the validation path.
describe('M10/bridge-v3 onProtocolEvent hook (off-spine observability)', () => {
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
    if (withHook) deps.onProtocolEvent = vi.fn();
    return new TeamCoordinator(deps);
  }

  it('fires onProtocolEvent with the event payload (kind + phase + agent)', () => {
    const c = build(true);
    c.emitProtocolEvent({ taskId: 'task-1', kind: 'endorsed', phase: 'proposal_pending_endorsement', agentId: 'a' });
    expect(deps.onProtocolEvent).toHaveBeenCalledWith({
      taskId: 'task-1',
      kind: 'endorsed',
      phase: 'proposal_pending_endorsement',
      agentId: 'a',
    });
  });

  it('is a strict no-op when the hook is unset (prior behaviour preserved)', () => {
    const c = build(false);
    expect(() => c.emitProtocolEvent({ taskId: 'task-2', kind: 'eject', phase: 'discussion' })).not.toThrow();
  });

  it('swallows a throwing hook (best-effort) and logs it', () => {
    const c = build(true);
    deps.onProtocolEvent.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => c.emitProtocolEvent({ taskId: 'task-3', kind: 'correction', phase: 'fact_collection' })).not.toThrow();
    expect(deps.logError).toHaveBeenCalled();
  });
});
