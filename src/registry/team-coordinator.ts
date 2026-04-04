import type { EventPayload } from '../protocol/protocol-payloads.js';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { Team, TeamComposition, TeamTask, TeamMember, TeamRole } from '../shared/types.js';
import { Agent } from '../agents/agent.js';

const GIT_WORKTREE_REQUIREMENT = [
  'Execution requirement: use strictly `git worktree` for this task.',
  'If you cannot or will not use a git worktree, refuse the assignment and abort the task.',
].join(' ');

const PLANNER_NO_CODE_TOUCH_REQUIREMENT = [
  'Planner role restriction: DO NOT touch code for any reason.',
  'Do not run shell commands, do not edit files, and do not create commits.',
  'Only discuss options and submit the final plan via submit_plan.',
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

interface TeamCoordinatorOptions {
  planningEventTimeoutMs?: number;
  submitPlanUrgencyTimeoutMs?: number;
}

const DEFAULT_PLANNING_EVENT_TIMEOUT_MS = 900_000;
const DEFAULT_SUBMIT_PLAN_URGENCY_TIMEOUT_MS = 120_000;
const MAX_URGENCY_IGNORES = 2;
const AGREEMENT_COMPLIANCE_TIMEOUT_MS = 60_000;
const MAX_AGREEMENT_ASKS = 2;

interface AgreementState {
  phase: 'awaiting_proposal' | 'awaiting_reached';
  targetAgentId: string;
  asksIssued: number;
  timer: NodeJS.Timeout;
}

interface PlanningProtocolState {
  plannerIds: string[];
  pendingAckPlannerIds: Set<string>;
  maxRepliesPerAgent: number;
  description: string;
}

export class TeamCoordinator {
  private teams: Map<string, Team> = new Map();
  private tasks: Map<string, TeamTask> = new Map();
  private agentToTeam: Map<string, string> = new Map();
  private readonly planningEventTimeoutMs: number;
  private readonly submitPlanUrgencyTimeoutMs: number;
  private readonly planningWatchdogs: Map<string, NodeJS.Timeout> = new Map();
  private readonly submitPlanUrgencyWatchdogs: Map<string, NodeJS.Timeout> = new Map();
  private readonly urgencyIgnoreCounts: Map<string, number> = new Map();
  private readonly agreementStates: Map<string, AgreementState> = new Map();
  private readonly planningProtocolStates: Map<string, PlanningProtocolState> = new Map();

  constructor(
    private readonly deps: TeamCoordinatorDeps,
    options: TeamCoordinatorOptions = {},
  ) {
    this.planningEventTimeoutMs = options.planningEventTimeoutMs ?? DEFAULT_PLANNING_EVENT_TIMEOUT_MS;
    this.submitPlanUrgencyTimeoutMs =
      options.submitPlanUrgencyTimeoutMs ?? DEFAULT_SUBMIT_PLAN_URGENCY_TIMEOUT_MS;
  }

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
    const plannerCount = roles.filter((r) => r === 'planner').length;
    const workerCount = roles.filter((r) => r === 'worker').length;
    if (plannerCount === 2 && workerCount === 1) return 'planner-planner-worker';
    if (roles.includes('planner')) return 'planner-worker';
    return 'worker-only';
  }

  private validateMembers(members: TeamMember[], composition: TeamComposition): void {
    if (composition === 'brainstorm') {
      if (members.length < 2 || members.length > 5) {
        throw new Error('A brainstorm team requires 2–5 brainstormer agents');
      }
    } else if (composition === 'planner-planner-worker') {
      if (members.length !== 3) {
        throw new Error('A multi-planner team requires exactly two planners and one worker');
      }
      const roles = members.map((m) => m.role);
      if (roles.filter((r) => r === 'planner').length !== 2 || roles.filter((r) => r === 'worker').length !== 1) {
        throw new Error('A multi-planner team requires exactly two planners and one worker');
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

    if (team.composition === 'planner-planner-worker') {
      return this.assignMultiPlannerTask(team, description, maxRepliesPerAgent ?? 10);
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
      this.armPlanningWatchdog(team, task, ['submit_plan']);
      await this.deps.sendProtocol(planner.agentId, 'EVT', {
        type: 'team_task_assign',
        teamId,
        taskId: task.id,
        role: 'planner',
        description: `${description}\n\n${PLANNER_NO_CODE_TOUCH_REQUIREMENT}`,
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

  private async assignMultiPlannerTask(team: Team, description: string, maxRepliesPerAgent: number): Promise<TeamTask> {
    const now = new Date().toISOString();
    const planners = team.members.filter((m) => m.role === 'planner');
    const plannerIds = planners.map((m) => m.agentId);

    const replyCounts: Record<string, number> = {};
    for (const id of plannerIds) {
      replyCounts[id] = 0;
    }

    const task: TeamTask = {
      id: `task-${Date.now()}`,
      teamId: team.id,
      description,
      maxRepliesPerAgent,
      replyCounts,
      planningComplete: false,
      status: 'planning',
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'user',
          to: plannerIds.join(','),
          payload: `Collaborative planning task: ${description}`,
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
    this.armPlanningWatchdog(team, task, ['ack_planning_protocol']);
    this.planningProtocolStates.set(task.id, {
      plannerIds,
      pendingAckPlannerIds: new Set(plannerIds),
      maxRepliesPerAgent,
      description,
    });

    const protocolPrompt = [
      'Planning protocol for this task:',
      '1) Acknowledge this protocol now via ack_planning_protocol.',
      '2) Start discussing only after both planners acknowledged.',
      '3) During the discussion, use [CALL:...] markers as described in your conversation instructions to signal agreement and submit the plan.',
      PLANNER_NO_CODE_TOUCH_REQUIREMENT,
    ].join(' ');

    for (const id of plannerIds) {
      try {
        await this.deps.sendProtocol(id, 'EVT', {
          type: 'custom_event_request',
          event: 'ack_planning_protocol',
          args: { taskId: task.id },
          prompt: protocolPrompt,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to request planning protocol ack from ${id}:`, err);
      }
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
      try {
        await this.deps.sendProtocol(member.agentId, 'EVT', {
          type: 'brainstorm_start',
          teamId: team.id,
          taskId: task.id,
          topic,
          peerIds,
          maxReplies: maxRepliesPerAgent,
          initiator: i === 0,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send brainstorm_start to ${member.agentId}:`, err);
      }
    }

    return task;
  }

  /**
   * Handles a message between planners in a multi-planner-worker team.
   */
  async handlePlanningMessage(
    senderAgentId: string,
    payload: unknown,
    replyToMessageId?: string,
  ): Promise<boolean> {
    const team = this.findTeamByAgent(senderAgentId);
    if (!team || team.composition !== 'planner-planner-worker' || !team.currentTaskId) {
      return false;
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      return false;
    }

    const planningProtocolState = this.planningProtocolStates.get(task.id);
    if (planningProtocolState && planningProtocolState.pendingAckPlannerIds.size > 0) {
      if (planningProtocolState.pendingAckPlannerIds.has(senderAgentId)) {
        try {
          await this.deps.sendProtocol(senderAgentId, 'EVT', {
            type: 'custom_event_request',
            event: 'ack_planning_protocol',
            args: { taskId: task.id },
            prompt: 'Acknowledge planning protocol before discussing task content.',
          });
        } catch (err) {
          this.deps.logError(`[TeamCoordinator] Failed to re-request planning protocol ack from ${senderAgentId}:`, err);
        }
      }
      return true;
    }

    // Check reply cap
    const currentCount = task.replyCounts?.[senderAgentId] ?? 0;
    if (task.maxRepliesPerAgent && currentCount >= task.maxRepliesPerAgent) {
      return true; // drop
    }

    if (task.replyCounts) {
      task.replyCounts[senderAgentId] = currentCount + 1;
    }

    const now = new Date().toISOString();
    const messageText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const peerIds = team.members
      .filter((m) => m.role === 'planner' && m.agentId !== senderAgentId)
      .map((m) => m.agentId);

    task.transcript.push({
      kind: 'message',
      timestamp: now,
      from: senderAgentId,
      to: peerIds.join(','),
      payload: messageText,
    });
    task.updatedAt = now;

    for (const peerId of peerIds) {
      try {
        await this.deps.sendProtocol(peerId, 'EVT', {
          type: 'message_received',
          from: senderAgentId,
          payload,
          ...(replyToMessageId ? { replyToMessageId } : {}),
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to broadcast planning message to ${peerId}:`, err);
      }
    }

    this.deps.emitTeamTask(task);

    // Check agreement non-compliance: target agent sent a regular message instead of the expected event
    const agreeState = this.agreementStates.get(task.id);
    if (agreeState && senderAgentId === agreeState.targetAgentId) {
      await this.handleAgreementNonCompliance(team, task);
      return true;
    }

    // Start agreement flow when a planner reaches maxReplies - 1 (1 message away from max)
    if (!agreeState && task.maxRepliesPerAgent) {
      const newCount = currentCount + 1;
      if (newCount === task.maxRepliesPerAgent - 1) {
        await this.requestAgreementProposal(team, task, senderAgentId);
      }
    }

    return true;
  }

  async handleAgreementProposal(agentId: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      throw new Error('Cannot submit agreement_proposal: task is not in planning status');
    }

    const agreeState = this.agreementStates.get(task.id);
    if (!agreeState || agreeState.phase !== 'awaiting_proposal' || agreeState.targetAgentId !== agentId) {
      throw new Error('Unexpected agreement_proposal: not awaiting proposal from this agent');
    }

    clearTimeout(agreeState.timer);
    this.agreementStates.delete(task.id);

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: agentId,
      to: 'system',
      payload: 'Agreement proposed.',
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    // Ask the other planner for agreement_reached
    const otherPlanner = team.members.find((m) => m.role === 'planner' && m.agentId !== agentId);
    if (!otherPlanner) {
      throw new Error('No other planner found in team');
    }

    await this.requestAgreementReached(team, task, otherPlanner.agentId);
  }

  async handleAgreementReached(agentId: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      throw new Error('Cannot submit agreement_reached: task is not in planning status');
    }

    const agreeState = this.agreementStates.get(task.id);
    if (!agreeState || agreeState.phase !== 'awaiting_reached' || agreeState.targetAgentId !== agentId) {
      throw new Error('Unexpected agreement_reached: not awaiting confirmation from this agent');
    }

    clearTimeout(agreeState.timer);
    this.agreementStates.delete(task.id);

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: agentId,
      to: 'system',
      payload: 'Agreement reached.',
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    // Agreement complete — arm submit_plan urgency
    await this.armSubmitPlanUrgencyWatchdog(team, task, ['submit_plan']);
  }

  private async requestAgreementProposal(team: Team, task: TeamTask, agentId: string): Promise<void> {
    const now = new Date().toISOString();
    const message = 'You are 1 message away from the reply limit. Please call agreement_proposal now to signal that you are ready to finalize the plan.';

    try {
      await this.deps.sendProtocol(agentId, 'EVT', {
        type: 'custom_event_request',
        event: 'agreement_proposal',
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to request agreement_proposal from ${agentId}:`, err);
    }

    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: agentId,
      payload: message,
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    const timer = setTimeout(() => {
      const currentTask = this.tasks.get(task.id);
      const currentTeam = this.teams.get(team.id);
      if (!currentTask || !currentTeam || currentTask.status !== 'planning') {
        return;
      }
      void this.handleAgreementNonCompliance(currentTeam, currentTask);
    }, AGREEMENT_COMPLIANCE_TIMEOUT_MS);

    this.agreementStates.set(task.id, {
      phase: 'awaiting_proposal',
      targetAgentId: agentId,
      asksIssued: 1,
      timer,
    });
  }

  private async requestAgreementReached(team: Team, task: TeamTask, agentId: string): Promise<void> {
    const now = new Date().toISOString();
    const message = 'Your peer has proposed agreement. Please call agreement_reached to confirm, or continue discussing if you disagree.';

    try {
      await this.deps.sendProtocol(agentId, 'EVT', {
        type: 'custom_event_request',
        event: 'agreement_reached',
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to request agreement_reached from ${agentId}:`, err);
    }

    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: agentId,
      payload: message,
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    const timer = setTimeout(() => {
      const currentTask = this.tasks.get(task.id);
      const currentTeam = this.teams.get(team.id);
      if (!currentTask || !currentTeam || currentTask.status !== 'planning') {
        return;
      }
      void this.handleAgreementNonCompliance(currentTeam, currentTask);
    }, AGREEMENT_COMPLIANCE_TIMEOUT_MS);

    this.agreementStates.set(task.id, {
      phase: 'awaiting_reached',
      targetAgentId: agentId,
      asksIssued: 1,
      timer,
    });
  }

  private async handleAgreementNonCompliance(team: Team, task: TeamTask): Promise<void> {
    const agreeState = this.agreementStates.get(task.id);
    if (!agreeState) return;

    clearTimeout(agreeState.timer);

    if (agreeState.asksIssued >= MAX_AGREEMENT_ASKS) {
      // Asked twice, no compliance — fail planning
      this.agreementStates.delete(task.id);
      const eventName = agreeState.phase === 'awaiting_proposal' ? 'agreement_proposal' : 'agreement_reached';
      await this.interruptPlanningForMissingEvents(team, task, [eventName]);
      return;
    }

    // Re-ask
    agreeState.asksIssued++;
    const eventName = agreeState.phase === 'awaiting_proposal' ? 'agreement_proposal' : 'agreement_reached';
    const now = new Date().toISOString();
    const message = `Reminder (${agreeState.asksIssued}/${MAX_AGREEMENT_ASKS}): please call ${eventName} now. Planning will be interrupted if you do not comply.`;

    try {
      await this.deps.sendProtocol(agreeState.targetAgentId, 'EVT', {
        type: 'custom_event_request',
        event: eventName,
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to re-request ${eventName} from ${agreeState.targetAgentId}:`, err);
    }

    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: agreeState.targetAgentId,
      payload: message,
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    agreeState.timer = setTimeout(() => {
      const currentTask = this.tasks.get(task.id);
      const currentTeam = this.teams.get(team.id);
      if (!currentTask || !currentTeam || currentTask.status !== 'planning') {
        return;
      }
      void this.handleAgreementNonCompliance(currentTeam, currentTask);
    }, AGREEMENT_COMPLIANCE_TIMEOUT_MS);
  }

  private clearAgreementState(taskId: string): void {
    const state = this.agreementStates.get(taskId);
    if (state) {
      clearTimeout(state.timer);
      this.agreementStates.delete(taskId);
    }
  }

  async handlePlanningProtocolAck(agentId: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      throw new Error('Cannot acknowledge planning protocol: task is not in planning status');
    }

    const state = this.planningProtocolStates.get(task.id);
    if (!state) {
      throw new Error('Unexpected ack_planning_protocol: no pending planning protocol acknowledgement');
    }

    if (!state.pendingAckPlannerIds.has(agentId)) {
      throw new Error('Unexpected ack_planning_protocol: protocol already acknowledged by this agent');
    }

    state.pendingAckPlannerIds.delete(agentId);
    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: agentId,
      to: 'system',
      payload: 'Planning protocol acknowledged.',
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    if (state.pendingAckPlannerIds.size > 0) {
      return;
    }

    this.planningProtocolStates.delete(task.id);
    this.armPlanningWatchdog(team, task, ['submit_plan']);

    for (const [i, id] of state.plannerIds.entries()) {
      const peerIds = state.plannerIds.filter((pid) => pid !== id);
      try {
        await this.deps.sendProtocol(id, 'EVT', {
          type: 'conversation_start',
          conversationId: task.id,
          topic:
            `Collaboratively draft an execution plan for: ${state.description}. ` +
            `Once you reach a resolution, use the protocol markers described in your instructions to signal agreement and submit the final plan. ` +
            `${PLANNER_NO_CODE_TOUCH_REQUIREMENT}`,
          peerIds,
          peerId: peerIds[0] as string,
          maxReplies: state.maxRepliesPerAgent,
          initiator: i === 0,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send conversation_start to ${id}:`, err);
      }
    }
  }

  /**
   * Handles a brainstorm message from an agent: broadcasts to all other
   * brainstorm peers and tracks reply counts.
   * Returns true if the message was handled (caller should not do default routing).
   */
  async handleBrainstormMessage(
    senderAgentId: string,
    payload: unknown,
    replyToMessageId?: string,
  ): Promise<boolean> {
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
          ...(replyToMessageId ? { replyToMessageId } : {}),
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
    this.clearPlanningWatchdog(task.id);
    this.clearSubmitPlanUrgencyWatchdog(task.id);
    this.clearAgreementState(task.id);
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
    this.clearSubmitPlanUrgencyWatchdog(task.id);
    this.clearAgreementState(task.id);
    this.armPlanningWatchdog(team, task, ['submit_plan']);

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
    if (!teamId) return;

    this.agentToTeam.delete(agentId);
    const team = this.teams.get(teamId);
    if (!team) return;

    if (team.composition === 'brainstorm' && team.currentTaskId) {
      this.handleBrainstormAgentRemoval(team, agentId);
      return;
    }

    if (team.currentTaskId) {
      this.clearPlanningWatchdog(team.currentTaskId);
      this.clearSubmitPlanUrgencyWatchdog(team.currentTaskId);
      this.clearAgreementState(team.currentTaskId);
    }

    team.status = 'error';
    team.updatedAt = new Date().toISOString();
    this.deps.emitTeam(team);
  }

  private handleBrainstormAgentRemoval(team: Team, removedAgentId: string): void {
    const now = new Date().toISOString();
    team.members = team.members.filter((m) => m.agentId !== removedAgentId);
    team.updatedAt = now;

    const task = team.currentTaskId ? this.tasks.get(team.currentTaskId) : undefined;

    if (task && task.status === 'brainstorming') {
      // Remove from reply counts
      if (task.replyCounts) {
        delete task.replyCounts[removedAgentId];
      }

      task.transcript.push({
        kind: 'system',
        timestamp: now,
        from: 'system',
        to: team.members.map((m) => m.agentId).join(','),
        payload: `Agent ${removedAgentId} dropped out of the brainstorm.`,
      });
      task.updatedAt = now;

      if (team.members.length >= 2) {
        // Continue with remaining agents; check if all remaining hit the cap
        const allDone = team.members.every(
          (m) => (task.replyCounts![m.agentId] ?? 0) >= task.maxRepliesPerAgent!,
        );
        if (allDone) {
          this.completeBrainstorm(team, task, 'All remaining agents reached reply limit');
        } else {
          this.deps.emitTeam(team);
          this.deps.emitTeamTask(task);
        }
      } else {
        // 0 or 1 agents left — interrupt
        this.interruptBrainstorm(team, task, `Not enough agents remaining after ${removedAgentId} dropped out`);
      }
    } else {
      // No active brainstorm task — just mark error
      team.status = 'error';
      this.deps.emitTeam(team);
    }
  }

  private async interruptBrainstorm(team: Team, task: TeamTask, reason: string): Promise<void> {
    const now = new Date().toISOString();
    task.status = 'interrupted';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Brainstorm interrupted: ${reason}`,
    });

    team.status = 'interrupted';
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

  private armPlanningWatchdog(team: Team, task: TeamTask, missingEvents: string[]): void {
    if (task.status !== 'planning') {
      return;
    }

    this.clearPlanningWatchdog(task.id);

    const timer = setTimeout(() => {
      const currentTask = this.tasks.get(task.id);
      const currentTeam = this.teams.get(team.id);
      if (!currentTask || !currentTeam || currentTask.status !== 'planning') {
        return;
      }

      void this.interruptPlanningForMissingEvents(currentTeam, currentTask, missingEvents);
    }, this.planningEventTimeoutMs);

    this.planningWatchdogs.set(task.id, timer);
  }

  private clearPlanningWatchdog(taskId: string): void {
    const timer = this.planningWatchdogs.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.planningWatchdogs.delete(taskId);
    }
  }

  private async armSubmitPlanUrgencyWatchdog(team: Team, task: TeamTask, missingEvents: string[]): Promise<void> {
    if (task.status !== 'planning') {
      return;
    }

    // Don't re-arm if already armed — re-issue is handled by the timeout handler
    if (this.submitPlanUrgencyWatchdogs.has(task.id)) {
      return;
    }

    const now = new Date().toISOString();
    const timeoutSeconds = Math.max(1, Math.floor(this.submitPlanUrgencyTimeoutMs / 1000));
    const missing = missingEvents.join(', ');
    const ignoreCount = this.urgencyIgnoreCounts.get(task.id) ?? 0;
    const planners = team.members.filter((m) => m.role === 'planner');

    const reminderText = ignoreCount === 0
      ? `Reply limit reached. One planner must call ${missing} within ${timeoutSeconds}s or planning will be interrupted.`
      : `Urgency reminder ignored (${ignoreCount}/${MAX_URGENCY_IGNORES}). One planner must call ${missing} within ${timeoutSeconds}s or planning will be interrupted.`;

    for (const planner of planners) {
      try {
        await this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: reminderText,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send submit_plan reminder to ${planner.agentId}:`, err);
      }
    }

    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: planners.map((p) => p.agentId).join(','),
      payload: reminderText,
    });
    task.updatedAt = now;
    this.deps.emitTeamTask(task);

    const timer = setTimeout(() => {
      const currentTask = this.tasks.get(task.id);
      const currentTeam = this.teams.get(team.id);
      if (!currentTask || !currentTeam || currentTask.status !== 'planning') {
        return;
      }

      this.submitPlanUrgencyWatchdogs.delete(task.id);
      const currentIgnores = (this.urgencyIgnoreCounts.get(task.id) ?? 0) + 1;
      this.urgencyIgnoreCounts.set(task.id, currentIgnores);

      if (currentIgnores >= MAX_URGENCY_IGNORES) {
        void this.interruptPlanningForMissingEvents(currentTeam, currentTask, missingEvents);
      } else {
        // Re-issue urgency
        void this.armSubmitPlanUrgencyWatchdog(currentTeam, currentTask, missingEvents);
      }
    }, this.submitPlanUrgencyTimeoutMs);

    this.submitPlanUrgencyWatchdogs.set(task.id, timer);
  }

  private clearSubmitPlanUrgencyWatchdog(taskId: string): void {
    const timer = this.submitPlanUrgencyWatchdogs.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.submitPlanUrgencyWatchdogs.delete(taskId);
    }
    this.urgencyIgnoreCounts.delete(taskId);
  }

  private async interruptPlanningForMissingEvents(team: Team, task: TeamTask, missingEvents: string[]): Promise<void> {
    this.clearPlanningWatchdog(task.id);
    this.clearSubmitPlanUrgencyWatchdog(task.id);
    this.clearAgreementState(task.id);
    this.planningProtocolStates.delete(task.id);

    const now = new Date().toISOString();
    const missing = missingEvents.join(', ');
    task.status = 'interrupted';
    task.updatedAt = now;
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Planning stopped: missing required event(s): ${missing}.`,
    });

    team.status = 'interrupted';
    delete team.currentTaskId;
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    const planners = team.members.filter((m) => m.role === 'planner');
    for (const planner of planners) {
      try {
        await this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: `Planning interrupted because required event(s) were not received: ${missing}.`,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to notify ${planner.agentId} about missing planning events:`, err);
      }
    }
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
