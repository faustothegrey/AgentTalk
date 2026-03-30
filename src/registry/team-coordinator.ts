import type { EventPayload } from '../protocol/protocol-payloads.js';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { Team, TeamTask, TeamMember, TeamRole, TranscriptEntry } from '../shared/types.js';
import { Agent } from '../agents/agent.js';

interface TeamCoordinatorDeps {
  getAgent: (id: string) => Agent;
  sendProtocol: (
    id: string,
    type: OutboundProtocolPacketType,
    payload: EventPayload,
  ) => Promise<void>;
  emitTeam: (team: Team) => void;
  emitTeamTask: (task: TeamTask) => void;
  logError: (message: string, err: unknown) => void;
}

export class TeamCoordinator {
  private teams: Map<string, Team> = new Map();
  private tasks: Map<string, TeamTask> = new Map();
  private agentToTeam: Map<string, string> = new Map();

  constructor(private readonly deps: TeamCoordinatorDeps) {}

  createTeam(members: TeamMember[]): Team {
    if (members.length !== 2) {
      throw new Error('A team requires exactly 2 members (planner + worker)');
    }

    const roles = members.map((m) => m.role);
    if (!roles.includes('planner') || !roles.includes('worker')) {
      throw new Error('A team requires one planner and one worker');
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

    const now = new Date().toISOString();
    const team: Team = {
      id: `team-${Date.now()}`,
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

  async assignTask(teamId: string, description: string): Promise<TeamTask> {
    const team = this.getTeam(teamId);

    if (team.status !== 'idle' && team.status !== 'completed') {
      throw new Error('Team is already working on a task');
    }

    const planner = this.getMemberByRole(team, 'planner');

    const now = new Date().toISOString();
    const task: TeamTask = {
      id: `task-${Date.now()}`,
      teamId,
      description,
      status: 'planning',
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'user',
          to: planner.agentId,
          payload: description,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    team.currentTaskId = task.id;
    team.status = 'planning';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    await this.deps.sendProtocol(planner.agentId, 'EVT', {
      type: 'team_task_assign',
      teamId,
      taskId: task.id,
      role: 'planner',
      description,
    });

    return task;
  }

  handlePlanSubmitted(agentId: string, plan: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'planning') {
      throw new Error(`Cannot submit plan: task status is ${task.status}`);
    }

    const now = new Date().toISOString();
    task.plan = plan;
    task.status = 'awaiting_confirmation';
    task.updatedAt = now;
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
      plan: task.plan!,
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
    delete task.plan;
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
