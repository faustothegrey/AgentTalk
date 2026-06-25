import { EventEmitter } from 'events';
import { ScenarioRunner } from '../scenarios/scenario-runner.js';
import type { ScenarioDefinition } from '../scenarios/types.js';
import type { ScenarioResult } from '../scenarios/types.js';
import type { Team } from '@agenttalk/contracts/types';

export interface ScenarioSchedulerConfig {
  scenarioDefinition: ScenarioDefinition;
  defaultTaskOverride?: string;
}

interface ScenarioSchedulerDeps {
  registry: EventEmitter & {
    removeAgent(id: string): Promise<void>;
  };
  onComplete?: (result: ScenarioResult) => void;
}

const TEAM_COMPLETION_TIMEOUT_MS = 60 * 60_000; // 60 minutes

const TERMINAL_TEAM_STATUSES = new Set(['completed', 'error', 'interrupted']);

export class ScenarioScheduler {
  private running = false;
  private lastResult: ScenarioResult | null = null;
  private lastRunAt: string | null = null;
  private currentTaskOverride: string | undefined;

  constructor(
    private readonly config: ScenarioSchedulerConfig,
    private readonly deps: ScenarioSchedulerDeps,
  ) {
    this.currentTaskOverride = config.defaultTaskOverride;
  }

  destroy(): void {
    this.running = false;
  }

  async runNow(taskOverride?: string): Promise<ScenarioResult | null> {
    if (taskOverride !== undefined) {
      this.currentTaskOverride = taskOverride;
    }
    return this.tick();
  }

  getStatus(): {
    running: boolean;
    lastRunAt: string | null;
    lastResult: ScenarioResult | null;
    taskOverride: string | undefined;
  } {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      taskOverride: this.currentTaskOverride,
    };
  }

  private async tick(): Promise<ScenarioResult | null> {
    if (this.running) {
      console.log('[ScenarioScheduler] Skipping run — previous run still in progress');
      return null;
    }

    this.running = true;
    let result: ScenarioResult | null = null;

    try {
      const runSuffix = Date.now();
      const cloned = this.cloneWithSuffix(this.config.scenarioDefinition, runSuffix);

      console.log(`[ScenarioScheduler] Starting run (suffix: ${runSuffix})`);

      const runner = new ScenarioRunner();
      result = await runner.run(cloned, this.deps.registry as any);

      console.log(
        `[ScenarioScheduler] Scenario "${result.scenarioName}" phase: ${result.status}` +
        (result.error ? ` — ${result.error}` : ''),
      );

      // Wait for teams to reach terminal status before cleanup
      if (result.teamIds.length > 0) {
        try {
          await this.waitForTeamsComplete(result.teamIds, TEAM_COMPLETION_TIMEOUT_MS);
          console.log('[ScenarioScheduler] All teams reached terminal status');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[ScenarioScheduler] Team completion wait ended: ${msg}`);
        }
      }

      // Cleanup agents
      for (const agentId of result.agentIds) {
        try {
          await this.deps.registry.removeAgent(agentId);
        } catch (err) {
          console.warn(`[ScenarioScheduler] Failed to remove agent ${agentId}:`, err);
        }
      }

      this.lastResult = result;
      this.lastRunAt = new Date().toISOString();
      this.deps.onComplete?.(result);
    } catch (err) {
      console.error('[ScenarioScheduler] Run failed:', err);
    } finally {
      this.running = false;
    }

    return result;
  }

  private cloneWithSuffix(definition: ScenarioDefinition, suffix: number): ScenarioDefinition {
    const idMap = new Map<string, string>();
    const agents = definition.agents.map((agent) => {
      const newId = `${agent.id}-${suffix}`;
      idMap.set(agent.id, newId);
      return { ...agent, id: newId };
    });

    const conversations = definition.conversations?.map((conv) => ({
      ...conv,
      agentIds: conv.agentIds.map((id) => idMap.get(id) ?? id),
    }));

    const teams = definition.teams?.map((team) => ({
      ...team,
      members: team.members.map((m) => ({
        ...m,
        agentId: idMap.get(m.agentId) ?? m.agentId,
      })),
      tasks: this.currentTaskOverride
        ? team.tasks.map((t) => ({ ...t, description: this.currentTaskOverride! }))
        : team.tasks.map((t) => ({ ...t })),
    }));

    return {
      ...definition,
      name: `${definition.name} (autorun-${suffix})`,
      agents,
      ...(conversations ? { conversations } : {}),
      ...(teams ? { teams } : {}),
    };
  }

  private waitForTeamsComplete(teamIds: string[], timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const pending = new Set(teamIds);

      const onTeam = (team: Team) => {
        if (pending.has(team.id) && TERMINAL_TEAM_STATUSES.has(team.status)) {
          pending.delete(team.id);
          if (pending.size === 0) {
            cleanup();
            resolve();
          }
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Team completion timeout after ${timeoutMs}ms — pending: ${[...pending].join(', ')}`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        this.deps.registry.removeListener('team', onTeam);
      };

      this.deps.registry.on('team', onTeam);
    });
  }
}
