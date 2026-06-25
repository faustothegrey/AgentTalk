import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

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

interface PersistedSchedulerStore {
  jobs: SchedulerJob[];
  globalEnabled: boolean;
}

export class SchedulerService {
  private readonly jobs = new Map<string, SchedulerJob>();
  private readonly runtimes = new Map<string, SchedulerRuntime>();
  private globalEnabled = true;

  constructor(
    private readonly deps: SchedulerDeps,
    private readonly filePath?: string
  ) {
    if (this.filePath) {
      this.load();
    }
  }

  isGlobalEnabled(): boolean {
    return this.globalEnabled;
  }

  setGlobalEnabled(enabled: boolean): void {
    this.globalEnabled = enabled;
    this.persist();
    
    // Restart/Stop all runtimes based on global state
    for (const jobId of this.jobs.keys()) {
      this.refreshRuntime(jobId);
    }
  }

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
    this.persist();
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
    this.persist();
    return updated;
  }

  deleteJob(id: string): boolean {
    const exists = this.jobs.delete(id);
    this.stopRuntime(id);
    this.persist();
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

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedSchedulerStore;
      this.globalEnabled = typeof parsed.globalEnabled === 'boolean' ? parsed.globalEnabled : true;
      
      if (Array.isArray(parsed.jobs)) {
        for (const job of parsed.jobs) {
          this.jobs.set(job.id, job);
          this.refreshRuntime(job.id);
        }
      }
    } catch (err) {
      console.error('[SchedulerService] Failed to load persisted state:', err);
    }
  }

  private persist(): void {
    if (!this.filePath) {
      return;
    }

    try {
      const directory = path.dirname(this.filePath);
      if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
      }

      const payload: PersistedSchedulerStore = {
        jobs: Array.from(this.jobs.values()),
        globalEnabled: this.globalEnabled,
      };

      writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('[SchedulerService] Failed to persist state:', err);
    }
  }

  private refreshRuntime(id: string): void {
    this.stopRuntime(id);
    const job = this.getJob(id);
    
    // Do not start runtime if job is disabled OR global scheduler is disabled
    if (!job.enabled || !this.globalEnabled) {
      this.jobs.set(id, {
        ...job,
        nextRunAt: undefined,
      });
      return;
    }

    const nextRunAt = new Date(Date.now() + job.intervalSeconds * 1000).toISOString();
    this.jobs.set(id, {
      ...job,
      nextRunAt,
    });

    const timer = setInterval(() => {
      const current = this.jobs.get(id);
      // Extra safety checks inside the interval
      if (!current || !current.enabled || !this.globalEnabled) {
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

  private async execute(job: SchedulerJob): Promise<void> {
    const runAt = new Date().toISOString();
    try {
      await this.deps.onRun(job);
      const nextRunAt = (job.enabled && this.globalEnabled)
        ? new Date(Date.now() + job.intervalSeconds * 1000).toISOString()
        : undefined;
      
      const updated: SchedulerJob = {
        ...job,
        lastRunAt: runAt,
        nextRunAt,
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(job.id, updated);
      this.persist();
    } catch (err) {
      const nextRunAt = (job.enabled && this.globalEnabled)
        ? new Date(Date.now() + job.intervalSeconds * 1000).toISOString()
        : undefined;
      
      const updated: SchedulerJob = {
        ...job,
        lastRunAt: runAt,
        nextRunAt,
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(job.id, updated);
      this.persist();
    }
  }
}
