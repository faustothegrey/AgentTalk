import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry, assertTeamStallOutlivesExecGuard } from '../registry.js';
import type { TeamNoProgressNotice, TeamProgressClockDefectNotice } from '@agenttalk/contracts/types';

/**
 * BL-133 — the team-level progress predicate.
 *
 * The wedge this exists for (BL-124 S3 → BL-129) had NO obligation anywhere: team `planning`, all
 * members `ready`, no `currentTurnId`. So `classifySilence` could not fire and M03 propagation could
 * not fire, and the team was permanently dead with every instrument reporting health.
 *
 * **B5 is the bar that matters most and it is the one a careless reader drops.** It asserts an
 * ABSENCE — nothing was killed — so it passes trivially against a detector that cannot fire at all.
 * It is only meaningful sitting beside B1, which proves the same machinery DOES fire. Neither bar is
 * worth anything alone; that is BL-127 B3's lesson, applied one level up.
 */

const SWEEP_MS = 30_000;      // the registry's own interval, not configurable
const STALL_MS = 900_000;     // must strictly outlive the 605s exec guard — see assertTeamStall…

describe('BL-133 — a team that has stopped making progress', () => {
  let registry: Registry;
  let notices: TeamNoProgressNotice[];
  let defects: TeamProgressClockDefectNotice[];

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new Registry({ teamNoProgressTimeoutMs: STALL_MS });
    notices = [];
    defects = [];
    registry.on('team_no_progress', (n: TeamNoProgressNotice) => notices.push(n));
    registry.on('team_progress_clock_defect', (d: TeamProgressClockDefectNotice) => defects.push(d));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await registry.destroy();
  });

  /**
   * Builds a team holding an active task, by hand rather than by driving the protocol: the protocol
   * path needs live agents and would make these bars a test of the coordinator instead of the
   * detector. The detector's whole contract is that it reads `getTeams()`/`getTask()` and the
   * `task.updatedAt` clock — so that is exactly what is set up here.
   */
  function seedTeamWithTask(teamId: string, taskId: string, status: string, updatedAt: unknown) {
    const coordinator = (registry as any).teamCoordinator;
    const team = {
      id: teamId,
      composition: 'planner_worker',
      members: [],
      status: 'active',
      currentTaskId: taskId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const task = {
      id: taskId,
      teamId,
      description: 'stall bar',
      status,
      transcript: [],
      createdAt: new Date().toISOString(),
      updatedAt,
    };
    coordinator.teams.set(teamId, team);
    coordinator.tasks.set(taskId, task);
    return { team, task };
  }

  // ── B1 — the capability. Mutation: delete the emit. ─────────────────────────────────────────
  it('B1 · an active task with no progress past the threshold produces EXACTLY ONE notice', async () => {
    const { task } = seedTeamWithTask('t1', 'task-1', 'planning', new Date(Date.now() - STALL_MS - 1000).toISOString());

    await vi.advanceTimersByTimeAsync(SWEEP_MS * 3);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ teamId: 't1', taskId: 'task-1', taskStatus: 'planning' });
    expect(notices[0]!.stalledForMs).toBeGreaterThan(STALL_MS);
    expect(task.status).toBe('planning'); // untouched
  });

  // ── B2′ — clear-on-PROGRESS, not clear-on-notice (gate-1 defect D2). ───────────────────────
  it('B2 · progress re-arms it: stall → notice → progress → stall produces a SECOND notice', async () => {
    const { task } = seedTeamWithTask('t2', 'task-2', 'in_progress', new Date(Date.now() - STALL_MS - 1000).toISOString());

    await vi.advanceTimersByTimeAsync(SWEEP_MS);
    expect(notices).toHaveLength(1);

    // Progress happens (what `recordTaskTranscript` does on every team event).
    task.updatedAt = new Date(Date.now()).toISOString();
    await vi.advanceTimersByTimeAsync(SWEEP_MS);
    expect(notices).toHaveLength(1); // still one — it re-armed rather than re-fired

    // ...and it goes quiet again.
    task.updatedAt = new Date(Date.now() - STALL_MS - 1000).toISOString();
    await vi.advanceTimersByTimeAsync(SWEEP_MS);
    expect(notices).toHaveLength(2);
  });

  // ── B3 — no active task is not a stall. ────────────────────────────────────────────────────
  it('B3 · a team with no current task produces NO notice', async () => {
    const { team } = seedTeamWithTask('t3', 'task-3', 'planning', new Date(Date.now() - STALL_MS - 1000).toISOString());
    delete (team as any).currentTaskId;

    await vi.advanceTimersByTimeAsync(SWEEP_MS * 3);

    expect(notices).toHaveLength(0);
  });

  // ── B4 — THE EXCLUSIONS. Mutation: add either status back to ACTIVE. ───────────────────────
  it('B4 · a task parked on a HUMAN (awaiting_confirmation / awaiting_operator) produces NO notice', async () => {
    seedTeamWithTask('t4a', 'task-4a', 'awaiting_confirmation', new Date(Date.now() - STALL_MS * 10).toISOString());
    seedTeamWithTask('t4b', 'task-4b', 'awaiting_operator', new Date(Date.now() - STALL_MS * 10).toISOString());

    await vi.advanceTimersByTimeAsync(SWEEP_MS * 3);

    // Ten times the threshold and still silent: a human being slow is not a system fault. Reporting
    // it would train the reader to ignore this notice, which is the failure mode that matters.
    expect(notices).toHaveLength(0);
  });

  // ── B5 — NOTHING DIES. Only meaningful next to B1. ─────────────────────────────────────────
  it('B5 · the detector is ADVISORY: no propagation, no status change, task untouched', async () => {
    const handleAgentFailure = vi.spyOn((registry as any).teamCoordinator, 'handleAgentFailure');
    const { team, task } = seedTeamWithTask('t5', 'task-5', 'delegated', new Date(Date.now() - STALL_MS - 1000).toISOString());

    await vi.advanceTimersByTimeAsync(SWEEP_MS * 3);

    expect(notices).toHaveLength(1);          // it DID fire — B5 is worthless without this line
    expect(handleAgentFailure).not.toHaveBeenCalled();
    expect(task.status).toBe('delegated');
    expect(team.status).toBe('active');
  });

  // ── B8 — fail CLOSED on a broken clock (gate-1 defect D1). ─────────────────────────────────
  it('B8 · an unparseable `updatedAt` is REPORTED as a defect, not silently treated as "no stall"', async () => {
    seedTeamWithTask('t6', 'task-6', 'planning', 'not-a-timestamp');

    await vi.advanceTimersByTimeAsync(SWEEP_MS);

    // `now - NaN > threshold` is false, so the naive detector would go permanently silent here and
    // read exactly like a healthy system. A broken progress clock is worse news than a stall.
    expect(defects).toHaveLength(1);
    expect(defects[0]).toMatchObject({ teamId: 't6', taskId: 'task-6', rawUpdatedAt: 'not-a-timestamp' });
    expect(notices).toHaveLength(0);
  });
});

/**
 * B6 — the cross-module invariant, the same family as BL-128's. A worker legitimately holds ONE exec
 * turn for the full 605s guard producing no transcript entry, so a stall threshold at or below the
 * guard reports every long worker turn as a stall.
 */
describe('BL-133 — the stall threshold must outlive the exec guard', () => {
  it('B6 · production’s own relationship holds', () => {
    expect(() => assertTeamStallOutlivesExecGuard(900_000)).not.toThrow();
  });

  it('B6 · a threshold below the guard is REJECTED, naming the fix', () => {
    expect(() => assertTeamStallOutlivesExecGuard(60_000)).toThrow(/BL-133/);
    expect(() => new Registry({ teamNoProgressTimeoutMs: 60_000 })).toThrow(/must strictly outlive the exec guard/);
  });

  it('B6 · the boundary is strict — equal is not enough', () => {
    // 605s exactly: the turn dies on the same tick the sweep would call it a stall.
    expect(() => assertTeamStallOutlivesExecGuard(605_000)).toThrow(/BL-133/);
  });
});
