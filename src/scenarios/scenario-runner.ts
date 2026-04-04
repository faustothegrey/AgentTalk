import type { Registry } from '../registry/registry.js';
import type { AgentStatus } from '../shared/types.js';
import { buildAgentCommand, buildProcessOptions } from './command-builder.js';
import type { ScenarioDefinition, ScenarioResult } from './types.js';

const DEFAULT_READINESS_TIMEOUT_MS = 120_000;

export class ScenarioRunner {
  private readonly readinessTimeoutMs: number;

  constructor(options: { readinessTimeoutMs?: number } = {}) {
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  }

  async run(definition: ScenarioDefinition, registry: Registry): Promise<ScenarioResult> {
    const result: ScenarioResult = {
      scenarioName: definition.name ?? '',
      status: 'creating_agents',
      agentIds: [],
      conversationIds: [],
      teamIds: [],
    };

    try {
      this.validate(definition);
      // 1. Create all agents
      for (const agentDef of definition.agents) {
        await registry.createAgent(agentDef.id, {
          ...(agentDef.executionMode ? { requestedExecutionMode: agentDef.executionMode } : {}),
        });
        result.agentIds.push(agentDef.id);
      }

      // 2. Start all agents
      result.status = 'starting_agents';
      const startPromises = definition.agents.map(agentDef => {
        const command = buildAgentCommand(agentDef.provider, agentDef.model);
        const processOptions = buildProcessOptions(command, agentDef.workingDirectory, agentDef.executionMode);
        return registry.startAgent(
          agentDef.id,
          command,
          agentDef.workingDirectory,
          processOptions,
          agentDef.executionMode,
        ).catch(err => {
          console.error(`[ScenarioRunner] Failed to start agent ${agentDef.id}:`, err);
          throw err;
        });
      });
      // We use allSettled to allow some agents to fail startup
      await Promise.allSettled(startPromises);

      // 3. Wait for all agents to be ready
      result.status = 'waiting_ready';
      const readyPromises = definition.agents.map(agentDef =>
        this.waitForAgentReady(registry, agentDef.id),
      );
      // Wait for all agents to settle (ready or error)
      const readinessResults = await Promise.allSettled(readyPromises);
      
      const readyAgentIds = new Set<string>();
      readinessResults.forEach((res, index) => {
        const agentId = definition.agents[index]?.id;
        if (!agentId) return;

        if (res.status === 'fulfilled') {
          readyAgentIds.add(agentId);
        } else {
          console.warn(`[ScenarioRunner] Agent ${agentId} failed to become ready: ${res.reason}`);
        }
      });

      if (readyAgentIds.size === 0) {
        throw new Error('No agents became ready for the scenario');
      }

      // 4. Execute conversations and teams
      result.status = 'executing';
      const executionErrors: string[] = [];

      if (definition.conversations) {
        for (const conv of definition.conversations) {
          // Partial completion: only include agents that are actually ready
          const activeAgentIds = conv.agentIds.filter((id) => readyAgentIds.has(id));

          if (activeAgentIds.length > 1) {
            try {
              const conversation = await this.startConversationWithFallback(
                registry,
                activeAgentIds,
                conv.topic,
                conv.maxRepliesPerAgent,
              );
              result.conversationIds.push(conversation.id);
            } catch (err) {
              const reason = err instanceof Error ? err.message : String(err);
              executionErrors.push(`Conversation "${conv.topic}" failed: ${reason}`);
              console.warn(`[ScenarioRunner] Failed to start conversation "${conv.topic}": ${reason}`);
            }
          } else {
            console.warn(`[ScenarioRunner] Skipping conversation because no requested agents are ready: ${conv.topic}`);
          }
        }
      }

      if (definition.teams) {
        for (const teamDef of definition.teams) {
          const activeMembers = teamDef.members.filter(m => readyAgentIds.has(m.agentId));
          
          if (activeMembers.length > 0) {
            try {
              const team = registry.createTeam(
                activeMembers.map((m) => ({ agentId: m.agentId, role: m.role })),
              );
              result.teamIds.push(team.id);

              for (const task of teamDef.tasks) {
                await registry.assignTeamTask(team.id, task.description);
              }
            } catch (err) {
              const reason = err instanceof Error ? err.message : String(err);
              executionErrors.push(`Team execution failed: ${reason}`);
              console.warn(`[ScenarioRunner] Team execution failed: ${reason}`);
            }
          } else {
            console.warn(`[ScenarioRunner] Skipping team because no requested members are ready`);
          }
        }
      }

      result.status = 'completed';
      if (executionErrors.length > 0 || readyAgentIds.size < definition.agents.length) {
        result.status = 'partially_completed';
        const details = [`${readyAgentIds.size}/${definition.agents.length} agents ready`];
        details.push(...executionErrors);
        result.error = `Partial completion: ${details.join(' | ')}`;
      }
    } catch (err) {
      result.status = 'error';
      result.error = err instanceof Error ? err.message : String(err);
    }

    return result;
  }

  private async startConversationWithFallback(
    registry: Registry,
    initialAgentIds: string[],
    topic: string,
    maxRepliesPerAgent: number,
  ) {
    let candidateAgentIds = [...initialAgentIds];
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await registry.startConversation(candidateAgentIds, topic, maxRepliesPerAgent);
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const match = message.match(/Agent ([^\s]+) did not respond to healthcheck/i);
        const failedAgentId = match?.[1];
        if (!failedAgentId) {
          break;
        }

        const reduced = candidateAgentIds.filter((id) => id !== failedAgentId);
        if (reduced.length < 2 || reduced.length === candidateAgentIds.length) {
          break;
        }

        console.warn(
          `[ScenarioRunner] Healthcheck fallback: retrying conversation "${topic}" without ${failedAgentId}`,
        );
        candidateAgentIds = reduced;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private validate(definition: ScenarioDefinition): void {
    if (!definition.name) {
      throw new Error('Scenario requires a name');
    }

    if (!Array.isArray(definition.agents) || definition.agents.length === 0) {
      throw new Error('Scenario requires at least one agent');
    }

    const agentIds = new Set<string>();
    for (const agent of definition.agents) {
      if (!agent.id) {
        throw new Error('Each agent requires an id');
      }
      if (!agent.provider) {
        throw new Error(`Agent "${agent.id}" requires a provider`);
      }
      if (!agent.model) {
        throw new Error(`Agent "${agent.id}" requires a model`);
      }
      if (agentIds.has(agent.id)) {
        throw new Error(`Duplicate agent id: "${agent.id}"`);
      }
      agentIds.add(agent.id);
    }

    if (definition.conversations) {
      for (const conv of definition.conversations) {
        if (conv.agentIds.length < 1) {
          throw new Error('Conversations require at least 1 agent');
        }
        for (const id of conv.agentIds) {
          if (!agentIds.has(id)) {
            throw new Error(`Conversation references unknown agent: "${id}"`);
          }
        }
      }
    }

    if (definition.teams) {
      for (const team of definition.teams) {
        if (team.members.length === 0) {
          throw new Error('Teams require at least one member');
        }
        for (const member of team.members) {
          if (!agentIds.has(member.agentId)) {
            throw new Error(`Team references unknown agent: "${member.agentId}"`);
          }
        }
      }
    }
  }

  private waitForAgentReady(registry: Registry, agentId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const agent = registry.getAgent(agentId);
      if (agent.status === 'ready' || agent.status === 'busy') {
        resolve();
        return;
      }
      if (agent.status === 'error' || agent.status === 'terminated') {
        reject(new Error(`Agent ${agentId} is in ${agent.status} state`));
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Agent ${agentId} readiness timeout after ${this.readinessTimeoutMs}ms`));
      }, this.readinessTimeoutMs);

      const onStatus = ({ id, status }: { id: string; status: AgentStatus }) => {
        if (id !== agentId) return;
        if (status === 'ready' || status === 'busy') {
          cleanup();
          resolve();
        } else if (status === 'error' || status === 'terminated') {
          cleanup();
          reject(new Error(`Agent ${agentId} entered ${status} state`));
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        registry.removeListener('status', onStatus);
      };

      registry.on('status', onStatus);
    });
  }
}
