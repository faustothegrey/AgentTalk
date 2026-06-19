import type { AgentExecutionMode, TeamMember, TeamRole } from '@agenttalk/contracts/types';

export function getNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function isTeamRole(value: unknown): value is TeamRole {
  return value === 'planner' || value === 'worker' || value === 'brainstormer';
}

export function isExecutionMode(value: unknown): value is AgentExecutionMode {
  // 'interactive' accepted as a deprecated alias for 'persistent'.
  return value === 'persistent' || value === 'interactive' || value === 'one_shot' || value === 'auto';
}

export function getIntervalSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.floor(parsed);
  }

  return undefined;
}

export function normalizeCreateTeamMembers(body: unknown): TeamMember[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const payload = body as Record<string, unknown>;
  const members = Array.isArray(payload.members)
    ? payload.members.flatMap((member): TeamMember[] => {
        if (!member || typeof member !== 'object') {
          return [];
        }

        const candidate = member as Record<string, unknown>;
        const agentId = getNonEmptyString(candidate.agentId);
        const role = candidate.role;
        if (!agentId || !isTeamRole(role)) {
          return [];
        }

        return [{ agentId, role }];
      })
    : [];

  if (members.length > 0) {
    return members;
  }

  const composition = getNonEmptyString(payload.teamComposition);

  // Brainstorm composition: array of agent IDs
  if (composition === 'brainstorm') {
    const brainstormAgents = Array.isArray(payload.brainstormAgents) ? payload.brainstormAgents : [];
    const result: TeamMember[] = [];
    for (const id of brainstormAgents) {
      const agentId = getNonEmptyString(id);
      if (agentId) {
        result.push({ agentId, role: 'brainstormer' });
      }
    }
    return result;
  }

  // Multi-planner composition
  if (composition === 'multi-planner' || composition === 'planner-planner-worker') {
    const planners = Array.isArray(payload.planners)
      ? payload.planners
      : [
          payload.teamPlannerAgent,
          payload.teamPlannerAgentB,
          payload.plannerAgentId,
          payload.plannerAgentIdB,
          payload.plannerId,
          payload.plannerIdB,
        ];
    const workerId = getNonEmptyString(payload.workerId ?? payload.teamWorkerAgent);
    const result: TeamMember[] = [];
    for (const id of planners) {
      const agentId = getNonEmptyString(id);
      if (agentId) {
        result.push({ agentId, role: 'planner' });
      }
    }
    if (workerId) {
      result.push({ agentId: workerId, role: 'worker' });
    }
    return result;
  }

  const plannerAgentId = getNonEmptyString(
    payload.teamPlannerAgent ?? payload.plannerAgentId ?? payload.plannerId,
  );
  const workerAgentId = getNonEmptyString(
    payload.teamWorkerAgent ?? payload.workerAgentId ?? payload.workerId,
  );

  if (!workerAgentId) {
    return [];
  }

  if (composition === 'worker-only' || !plannerAgentId) {
    return [{ agentId: workerAgentId, role: 'worker' }];
  }

  return [
    { agentId: plannerAgentId, role: 'planner' },
    { agentId: workerAgentId, role: 'worker' },
  ];
}
