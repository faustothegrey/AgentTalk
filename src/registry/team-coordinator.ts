import type { EventPayload } from '../protocol/protocol-payloads.js';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { Team, TeamComposition, TeamTask, TeamMember, TeamRole, TranscriptEntry } from '../shared/types.js';
import { Agent } from '../agents/agent.js';

const GIT_WORKTREE_REQUIREMENT = [
  'Execution requirement: use strictly `git worktree` for this task.',
  'If you cannot or will not use a git worktree, refuse the assignment and abort the task.',
].join(' ');

interface TeamCoordinatorDeps {
  getAgent: (id: string) => Agent;
  sendProtocol: (
    id: string,
    type: OutboundProtocolPacketType,
    payload: EventPayload,
  ) => Promise<void>;
  emitTeam: (team: Team) => void;
  emitTeamTask: (task: TeamTask) => void;
  emitPlanningComplete: (payload: { team: Team; task: TeamTask; plannerAgentId: string }) => void;
  logError: (message: string, err: unknown) => void;
}

export class TeamCoordinator {
  private teams: Map<string, Team> = new Map();
  private tasks: Map<string, TeamTask> = new Map();
  private agentToTeam: Map<string, string> = new Map();

  constructor(private readonly deps: TeamCoordinatorDeps) {}

  createTeam(members: TeamMember[]): Team {
    const composition = this.inferComposition(members);
    this.validateMembers(members, composition);

    const now = new Date().toISOString();
    const team: Team = {
      id: `team-${Date.now()}`,
      composition,
      members,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };

    this.teams.set(team.id, team);
    for (const member of members) {
      this.agentToTeam.set(member.agentId, team.id);
    }

    this.deps.emitTeam(team);
    return team;
  }

  private inferComposition(members: TeamMember[]): TeamComposition {
    const roles = members.map((m) => m.role);
    if (roles.every((r) => r === 'brainstormer')) return 'brainstorm';
    if (roles.includes('planner')) return 'planner-worker';
    return 'worker-only';
  }

  private validateMembers(members: TeamMember[], composition: TeamComposition): void {
    if (composition === 'brainstorm') {
      if (members.length < 2 || members.length > 5) {
        throw new Error('A brainstorm team requires 2–5 brainstormer agents');
      }
    } else {
      if (members.length < 1 || members.length > 2) {
        throw new Error('A team requires either one worker or one planner plus one worker');
      }
      const roles = members.map((m) => m.role);
      if (!roles.includes('worker')) {
        throw new Error('A team requires a worker');
      }
      if (roles.includes('planner') && members.length !== 2) {
        throw new Error('A planner can only be used in a planner + worker team');
      }
      if (!roles.includes('planner') && members.length !== 1) {
        throw new Error('A worker-only team must contain exactly one worker');
      }
    }

    for (const member of members) {
      const agent = this.deps.getAgent(member.agentId);
      if (agent.status !== 'ready' && agent.status !== 'busy') {
        throw new Error(`Agent ${member.agentId} must be ready before joining a team`);
      }
      if (this.agentToTeam.has(member.agentId)) {
        throw new Error(`Agent ${member.agentId} is already assigned to a team`);
      }
    }

    const uniqueIds = new Set(members.map((m) => m.agentId));
    if (uniqueIds.size !== members.length) {
      throw new Error('A team requires different agents for each role');
    }
  }

  async assignTask(teamId: string, description: string, maxRepliesPerAgent?: number): Promise<TeamTask> {
    const team = this.getTeam(teamId);

    if (team.status !== 'idle' && team.status !== 'completed') {
      throw new Error('Team is already working on a task');
    }

    if (team.composition === 'brainstorm') {
      return this.assignBrainstormTask(team, description, maxRepliesPerAgent ?? 3);
    }

    const planner = team.members.find((member) => member.role === 'planner');
    const worker = this.getMemberByRole(team, 'worker');

    const now = new Date().toISOString();
    const task: TeamTask = {
      id: `task-${Date.now()}`,
      teamId,
      description,
      planningComplete: false,
      status: planner ? 'planning' : 'delegated',
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'user',
          to: planner?.agentId ?? worker.agentId,
          payload: description,
        },
      ],
      createdAt: now,
      updatedAt: now,
      ...(planner ? { plannerAgentId: planner.agentId } : {}),
    };

    this.tasks.set(task.id, task);
    team.currentTaskId = task.id;
    team.status = planner ? 'planning' : 'working';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    if (planner) {
      await this.deps.sendProtocol(planner.agentId, 'EVT', {
        type: 'team_task_assign',
        teamId,
        taskId: task.id,
        role: 'planner',
        description,
      });
    } else {
      task.transcript.push({
        kind: 'system',
        timestamp: now,
        from: 'user',
        to: worker.agentId,
        payload: 'Task assigned directly to worker.',
      });
      this.deps.emitTeamTask(task);

      await this.deps.sendProtocol(worker.agentId, 'EVT', {
        type: 'team_work_assign',
        teamId,
        taskId: task.id,
        role: 'worker',
        plan: this.buildWorkerPlan(description),
        description,
      });
    }

    return task;
  }

  private async assignBrainstormTask(team: Team, topic: string, maxRepliesPerAgent: number): Promise<TeamTask> {
    const now = new Date().toISOString();
    const replyCounts: Record<string, number> = {};
    for (const member of team.members) {
      replyCounts[member.agentId] = 0;
    }

    const task: TeamTask = {
      id: `task-${Date.now()}`,
      teamId: team.id,
      description: topic,
      maxRepliesPerAgent,
      replyCounts,
      status: 'brainstorming',
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'user',
          to: team.members.map((m) => m.agentId).join(','),
          payload: `Brainstorm topic: ${topic}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    team.currentTaskId = task.id;
    team.status = 'brainstorming';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    const agentIds = team.members.map((m) => m.agentId);
    for (const [i, member] of team.members.entries()) {
      const peerIds = agentIds.filter((id) => id !== member.agentId);
      await this.deps.sendProtocol(member.agentId, 'EVT', {
        type: 'brainstorm_start',
        teamId: team.id,
        taskId: task.id,
        topic,
        peerIds,
        maxReplies: maxRepliesPerAgent,
        initiator: i === 0,
      });
    }

    return task;
  }

  /**
   * Handles a brainstorm message from an agent: broadcasts to all other
   * brainstorm peers and tracks reply counts.
   * Returns true if the message was handled (caller should not do default routing).
   */
  async handleBrainstormMessage(senderAgentId: string, payload: unknown): Promise<boolean> {
    const team = this.findTeamByAgent(senderAgentId);
    if (!team || team.composition !== 'brainstorm' || !team.currentTaskId) {
      return false;
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'brainstorming') {
      return false;
    }

    // Check reply cap
    const currentCount = task.replyCounts![senderAgentId] ?? 0;
    if (currentCount >= task.maxRepliesPerAgent!) {
      return true; // silently drop — agent already at cap
    }

    // Increment reply count
    task.replyCounts![senderAgentId] = currentCount + 1;

    const now = new Date().toISOString();
    const messageText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Record in transcript
    const peerIds = team.members
      .map((m) => m.agentId)
      .filter((id) => id !== senderAgentId);

    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: senderAgentId,
      to: peerIds.join(','),
      payload: messageText,
    });
    task.updatedAt = now;

    // Broadcast to all other brainstorm members
    for (const peerId of peerIds) {
      try {
        await this.deps.sendProtocol(peerId, 'EVT', {
          type: 'message_received',
          from: senderAgentId,
          payload,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to broadcast brainstorm message to ${peerId}:`, err);
      }
    }

    this.deps.emitTeamTask(task);

    // Check if all agents have reached their reply cap
    const allDone = team.members.every(
      (m) => (task.replyCounts![m.agentId] ?? 0) >= task.maxRepliesPerAgent!,
    );

    if (allDone) {
      await this.completeBrainstorm(team, task, 'All agents reached reply limit');
    }

    return true;
  }

  private async completeBrainstorm(team: Team, task: TeamTask, reason: string): Promise<void> {
    const now = new Date().toISOString();
    task.status = 'completed';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Brainstorm ended: ${reason}`,
    });

    team.status = 'completed';
    delete team.currentTaskId;
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    for (const member of team.members) {
      try {
        await this.deps.sendProtocol(member.agentId, 'EVT', {
          type: 'brainstorm_end',
          teamId: team.id,
          taskId: task.id,
          reason,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send brainstorm_end to ${member.agentId}:`, err);
      }
    }
  }

  handlePlanSubmitted(agentId: string, plan: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'planning') {
      throw new Error(`Cannot submit plan: task status is ${task.status}`);
    }

    assertPlanIsImplementationReady(plan);

    const now = new Date().toISOString();
    task.plan = plan;
    task.planningComplete = true;
    task.planSubmittedAt = now;
    task.status = 'awaiting_confirmation';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: agentId,
      to: 'user',
      payload: 'Planner finished and submitted the final plan.',
    });
    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: agentId,
      to: 'user',
      payload: plan,
    });

    team.status = 'awaiting_confirmation';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
    this.deps.emitPlanningComplete({ team, task, plannerAgentId: agentId });
  }

  async confirmPlan(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    const team = this.getTeam(task.teamId);

    if (task.status !== 'awaiting_confirmation') {
      throw new Error(`Cannot confirm plan: task status is ${task.status}`);
    }

    const worker = this.getMemberByRole(team, 'worker');

    const now = new Date().toISOString();
    task.planConfirmed = true;
    task.status = 'delegated';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'user',
      to: worker.agentId,
      payload: 'Plan confirmed. Delegating to worker.',
    });

    team.status = 'working';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    await this.deps.sendProtocol(worker.agentId, 'EVT', {
      type: 'team_work_assign',
      teamId: team.id,
      taskId: task.id,
      role: 'worker',
      plan: this.buildWorkerPlan(task.plan!),
      description: task.description,
    });
  }

  async rejectPlan(taskId: string, feedback: string): Promise<void> {
    const task = this.getTask(taskId);
    const team = this.getTeam(task.teamId);

    if (task.status !== 'awaiting_confirmation') {
      throw new Error(`Cannot reject plan: task status is ${task.status}`);
    }

    const planner = this.getMemberByRole(team, 'planner');

    const now = new Date().toISOString();
    task.status = 'planning';
    task.planningComplete = false;
    delete task.plan;
    delete task.planSubmittedAt;
    task.updatedAt = now;
    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: 'user',
      to: planner.agentId,
      payload: `Plan rejected: ${feedback}`,
    });

    team.status = 'planning';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    await this.deps.sendProtocol(planner.agentId, 'EVT', {
      type: 'message_received',
      from: 'user',
      payload: `Your plan was rejected. Feedback: ${feedback}\n\nPlease revise your plan and submit it again using submit_plan.`,
    });
  }

  handleWorkResponse(agentId: string, accepted: boolean, reason?: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'delegated') {
      throw new Error(`Cannot respond to work: task status is ${task.status}`);
    }

    const now = new Date().toISOString();
    task.workerAccepted = accepted;
    task.updatedAt = now;

    if (accepted) {
      task.status = 'in_progress';
      task.transcript.push({
        kind: 'message',
        timestamp: now,
        from: agentId,
        to: 'user',
        payload: 'Worker accepted the task.',
      });
      team.status = 'working';
    } else {
      task.status = 'refused';
      if (reason) {
        task.workerRefusalReason = reason;
      }
      task.transcript.push({
        kind: 'message',
        timestamp: now,
        from: agentId,
        to: 'user',
        payload: `Worker refused: ${reason ?? 'No reason given'}`,
      });
      team.status = 'error';
    }

    team.updatedAt = now;
    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  handleWorkResult(agentId: string, result: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'in_progress') {
      throw new Error(`Cannot submit result: task status is ${task.status}`);
    }

    const now = new Date().toISOString();
    task.status = 'completed';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: agentId,
      to: 'user',
      payload: result,
    });

    team.status = 'completed';
    delete team.currentTaskId;
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  async sendUserMessage(taskId: string, targetRole: TeamRole, message: string): Promise<void> {
    const task = this.getTask(taskId);
    const team = this.getTeam(task.teamId);
    const member = this.getMemberByRole(team, targetRole);

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: 'user',
      to: member.agentId,
      payload: message,
    });
    task.updatedAt = now;

    this.deps.emitTeamTask(task);

    await this.deps.sendProtocol(member.agentId, 'EVT', {
      type: 'message_received',
      from: 'user',
      payload: message,
    });
  }

  getTeams(): Team[] {
    return [...this.teams.values()];
  }

  getTeam(teamId: string): Team {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    return team;
  }

  private buildWorkerPlan(plan: string): string {
    return `${plan}\n\n${GIT_WORKTREE_REQUIREMENT}`;
  }

  getTask(taskId: string): TeamTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task;
  }

  getTeamTasks(teamId: string): TeamTask[] {
    return [...this.tasks.values()].filter((t) => t.teamId === teamId);
  }

  findTeamByAgent(agentId: string): Team | undefined {
    const teamId = this.agentToTeam.get(agentId);
    return teamId ? this.teams.get(teamId) : undefined;
  }

  removeAgentFromTeams(agentId: string): void {
    const teamId = this.agentToTeam.get(agentId);
    if (teamId) {
      this.agentToTeam.delete(agentId);
      const team = this.teams.get(teamId);
      if (team) {
        team.status = 'error';
        team.updatedAt = new Date().toISOString();
        this.deps.emitTeam(team);
      }
    }
  }

  private getMemberByRole(team: Team, role: TeamRole): TeamMember {
    const member = team.members.find((m) => m.role === role);
    if (!member) {
      throw new Error(`No ${role} found in team ${team.id}`);
    }
    return member;
  }

  private getTeamContextByAgent(agentId: string): { team: Team; task: TeamTask } {
    const team = this.findTeamByAgent(agentId);
    if (!team) {
      throw new Error(`Agent ${agentId} is not part of any team`);
    }

    if (!team.currentTaskId) {
      throw new Error(`Team ${team.id} has no active task`);
    }

    const task = this.getTask(team.currentTaskId);
    return { team, task };
  }
}

function assertPlanIsImplementationReady(plan: string): void {
  const normalized = plan.trim();
  if (!normalized) {
    throw new Error('Plan is empty');
  }

  const lower = normalized.toLowerCase();
  const stepLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line) || /^[-*]\s+/.test(line));

  const hasConcreteChangeVerb = /(implement|refactor|extract|rename|replace|update|remove|simplify|split|move|delete|add|introduce|consolidate)/i.test(normalized);
  const hasConcreteTarget = /[`'"][^`'"\n]+[`'"]|(?:^|\s)(?:src|web|scripts)\/[^\s:]+|[A-Za-z0-9_-]+\.[a-z]{2,}/.test(normalized);
  const exploratoryStepCount = stepLines.filter((line) =>
    /^\d+\.\s*(?:\*\*)?(analyze|identify|find|look for|explore|review|inspect|examine|investigate)\b/i.test(line)
  ).length;

  if (!hasConcreteChangeVerb || !hasConcreteTarget) {
    throw new Error('Plan is not implementation-ready. It must name a concrete target and a concrete code change.');
  }

  if (stepLines.length > 0 && exploratoryStepCount >= Math.ceil(stepLines.length / 2)) {
    throw new Error('Plan is still exploratory. Submit the final implementation plan only after choosing the concrete refactoring.');
  }

  if (
    /(i will find and implement|look for code that can be|identify refactoring target|analyze .* for .* opportunities)/i.test(lower)
  ) {
    throw new Error('Plan is still describing future analysis instead of the chosen change.');
  }
}
