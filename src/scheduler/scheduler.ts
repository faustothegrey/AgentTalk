export interface SchedulerJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  intervalSeconds: number;
  enabled: boolean;
  lastRunAt?: string | undefined;
  nextRunAt?: string | undefined;
  lastError?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

interface SchedulerRuntime {
  timer: NodeJS.Timeout;
}

interface SchedulerDeps {
  onRun: (job: SchedulerJob) => Promise<void>;
}

interface CreateSchedulerJobInput {
  name: string;
  agentId: string;
  prompt: string;
  intervalSeconds: number;
  enabled?: boolean;
}

interface UpdateSchedulerJobInput {
  name?: string;
  agentId?: string;
  prompt?: string;
  intervalSeconds?: number;
  enabled?: boolean;
}

export class SchedulerService {
  private readonly jobs = new Map<string, SchedulerJob>();
  private readonly runtimes = new Map<string, SchedulerRuntime>();

  constructor(private readonly deps: SchedulerDeps) {}

  listJobs(): SchedulerJob[] {
    return [...this.jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getJob(id: string): SchedulerJob {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Scheduler job ${id} not found`);
    }
    return job;
  }

  createJob(input: CreateSchedulerJobInput): SchedulerJob {
    const now = new Date().toISOString();
    const job: SchedulerJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      agentId: input.agentId,
      prompt: input.prompt,
      intervalSeconds: input.intervalSeconds,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.id, job);
    this.refreshRuntime(job.id);
    return job;
  }

  updateJob(id: string, input: UpdateSchedulerJobInput): SchedulerJob {
    const job = this.getJob(id);
    const updated: SchedulerJob = {
      ...job,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
      ...(input.intervalSeconds !== undefined ? { intervalSeconds: input.intervalSeconds } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(id, updated);
    this.refreshRuntime(id);
    return updated;
  }

  deleteJob(id: string): boolean {
    const exists = this.jobs.delete(id);
    this.stopRuntime(id);
    return exists;
  }

  async runNow(id: string): Promise<SchedulerJob> {
    const job = this.getJob(id);
    await this.execute(job);
    return this.getJob(id);
  }

  destroy(): void {
    for (const runtime of this.runtimes.values()) {
      clearInterval(runtime.timer);
    }
    this.runtimes.clear();
  }

  private refreshRuntime(id: string): void {
    this.stopRuntime(id);
    const job = this.getJob(id);
    if (!job.enabled) {
      this.persistJob({
        ...job,
        nextRunAt: undefined,
      });
      return;
    }

    const nextRunAt = new Date(Date.now() + job.intervalSeconds * 1000).toISOString();
    this.persistJob({
      ...job,
      nextRunAt,
    });

    const timer = setInterval(() => {
      const current = this.jobs.get(id);
      if (!current || !current.enabled) {
        return;
      }

      void this.execute(current);
    }, job.intervalSeconds * 1000);

    this.runtimes.set(id, { timer });
  }

  private stopRuntime(id: string): void {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      return;
    }

    clearInterval(runtime.timer);
    this.runtimes.delete(id);
  }

  private persistJob(job: SchedulerJob): void {
    this.jobs.set(job.id, job);
  }

  private async execute(job: SchedulerJob): Promise<void> {
    const runAt = new Date().toISOString();
    try {
      await this.deps.onRun(job);
      const nextRunAt = job.enabled
        ? new Date(Date.now() + job.intervalSeconds * 1000).toISOString()
        : undefined;
      this.persistJob({
        ...job,
        lastRunAt: runAt,
        nextRunAt,
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const nextRunAt = job.enabled
        ? new Date(Date.now() + job.intervalSeconds * 1000).toISOString()
        : undefined;
      this.persistJob({
        ...job,
        lastRunAt: runAt,
        nextRunAt,
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
