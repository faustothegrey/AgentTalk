import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchedulerService } from '@agenttalk/runtime-scenarios/scheduler/scheduler';

describe('SchedulerService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates jobs and runs them on schedule when enabled', async () => {
    vi.useFakeTimers();
    const onRun = vi.fn(async () => {});
    const scheduler = new SchedulerService({ onRun });

    const job = scheduler.createJob({
      name: 'heartbeat',
      agentId: 'agent-a',
      prompt: 'ping',
      intervalSeconds: 5,
    });

    expect(job.enabled).toBe(true);
    expect(scheduler.getJob(job.id).nextRunAt).toBeDefined();

    await vi.advanceTimersByTimeAsync(5100);
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(scheduler.getJob(job.id).lastRunAt).toBeDefined();
    scheduler.destroy();
  });

  it('disables runtime when job is turned off', async () => {
    vi.useFakeTimers();
    const onRun = vi.fn(async () => {});
    const scheduler = new SchedulerService({ onRun });

    const job = scheduler.createJob({
      name: 'heartbeat',
      agentId: 'agent-a',
      prompt: 'ping',
      intervalSeconds: 1,
      enabled: false,
    });

    expect(scheduler.getJob(job.id).nextRunAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1500);
    expect(onRun).not.toHaveBeenCalled();
    scheduler.destroy();
  });

  it('records lastError when execution fails', async () => {
    vi.useFakeTimers();
    const onRun = vi.fn(async () => {
      throw new Error('boom');
    });
    const scheduler = new SchedulerService({ onRun });

    const job = scheduler.createJob({
      name: 'failing',
      agentId: 'agent-a',
      prompt: 'ping',
      intervalSeconds: 1,
    });

    await scheduler.runNow(job.id);
    const updated = scheduler.getJob(job.id);
    expect(updated.lastError).toBe('boom');
    expect(updated.lastRunAt).toBeDefined();
    scheduler.destroy();
  });

  it('deletes jobs and throws for missing job', () => {
    const scheduler = new SchedulerService({ onRun: async () => {} });
    const job = scheduler.createJob({
      name: 'delete-me',
      agentId: 'agent-a',
      prompt: 'ping',
      intervalSeconds: 60,
    });

    expect(scheduler.deleteJob(job.id)).toBe(true);
    expect(scheduler.deleteJob(job.id)).toBe(false);
    expect(() => scheduler.getJob(job.id)).toThrow(`Scheduler job ${job.id} not found`);
    scheduler.destroy();
  });
});
