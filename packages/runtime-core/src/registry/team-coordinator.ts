import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { EventPayload } from '@agenttalk/contracts/protocol-payloads';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { AgentProvider, Team, TeamComposition, TeamTask, TeamMember, TeamRole, TranscriptEntry } from '@agenttalk/contracts/types';
import { Agent } from '../agents/agent.js';
import type { StructuredMessageType } from '../agents/response-schema.js';

const GIT_WORKTREE_REQUIREMENT = [
  'Execution requirement: use strictly `git worktree` for this task.',
  'If you cannot or will not use a git worktree, refuse the assignment and abort the task.',
].join(' ');

const PLANNER_NO_CODE_TOUCH_REQUIREMENT = [
  'Planner role restriction: DO NOT modify code for any reason.',
  'Do not edit files and do not create commits.',
  'You MUST examine the codebase using your search and read tools to identify specific files, functions, and line numbers for your plan.',
  'Only discuss options and submit the final plan via submit_plan.',
].join(' ');

const MESSAGE_TYPE_MOTIVATION_REQUIREMENT = [
  'At every planning reply, explicitly motivate why your selected message_type matches the current protocol step.',
  'Be very coherent: do not decide on one message_type and then send another.',
].join(' ');
const AGREEMENT_PROPOSAL_HINT_INSTRUCTION =
  'Agreement proposals should only be emitted once you have concrete hints that your peer is aligned on a specific action for the worker to implement; the discussion phase exists to surface and confirm those hints before moving to the proposal phase.';

interface TeamCoordinatorDeps {
  getAgent: (id: string) => Agent;
  sendProtocol: (
    id: string,
    type: OutboundProtocolPacketType,
    payload: EventPayload,
  ) => Promise<void>;
  removeAgent: (id: string) => Promise<void>;
  emitTeam: (team: Team) => void;
  emitTeamTask: (task: TeamTask) => void;
  emitPlanningComplete: (payload: { team: Team; task: TeamTask; plannerAgentId: string }) => void;
  logError: (message: string, err: unknown) => void;
}

interface TeamCoordinatorOptions {
  planningEventTimeoutMs?: number;
  submitPlanUrgencyTimeoutMs?: number;
  planningRunsDir?: string;
  agentShutdownTimeoutMs?: number;
  factCollectionTimeoutMs?: number;
}

const DEFAULT_PLANNING_EVENT_TIMEOUT_MS = 900_000;
const DEFAULT_SUBMIT_PLAN_URGENCY_TIMEOUT_MS = 120_000;
const DEFAULT_AGENT_SHUTDOWN_TIMEOUT_MS = 60_000;
const MAX_URGENCY_IGNORES = 2;
const AGREEMENT_COMPLIANCE_TIMEOUT_MS = 60_000;
const MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS = 2;
const DEFAULT_FACT_COLLECTION_TIMEOUT_MS = 480_000;
const DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS = 720_000;
const MAX_AGREEMENT_ASKS = 2;
// M10-T2 (D2): bounded correction budget for ANY illegal protocol move — a
// regression OR a forward/lateral move out of the legal set. After this many
// corrections the offender is ejected (peer-safe), not dual-killed. (Name kept
// for low-churn continuity; meaning is now "protocol correction retries".)
const MAX_REGRESSION_RETRIES = 2;

interface AgreementState {
  phase: 'awaiting_proposal' | 'awaiting_endorsement';
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

interface FactCollectionState {
  plannerIds: string[];
  pendingPlannerIds: Set<string>;
  maxRepliesPerAgent: number;
  description: string;
  timer: NodeJS.Timeout;
}

type PlanningPhase =
  | 'protocol_ack_pending'
  | 'fact_collection'
  | 'discussion'
  | 'proposal_pending_endorsement'
  | 'submittal_pending';

const ADVANCEMENT_RANK: Record<string, number> = {
  opinion: 0,
  agreement_proposal: 1,
  agreement_acceptance: 2,
  submit_plan: 3,
};

export class TeamCoordinator {
  private teams: Map<string, Team> = new Map();
  private tasks: Map<string, TeamTask> = new Map();
  private agentToTeam: Map<string, string> = new Map();
  private readonly planningEventTimeoutMs: number;
  private readonly submitPlanUrgencyTimeoutMs: number;
  private readonly agentShutdownTimeoutMs: number;
  private readonly planningRunsDir: string;
  private readonly planningWatchdogs: Map<string, NodeJS.Timeout> = new Map();
  private readonly submitPlanUrgencyWatchdogs: Map<string, NodeJS.Timeout> = new Map();
  private readonly agentShutdownTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly urgencyIgnoreCounts: Map<string, number> = new Map();
  private readonly agreementStates: Map<string, AgreementState> = new Map();
  private readonly agreementReachedDiscussionFallbackCounts: Map<string, number> = new Map();
  private readonly planningProtocolStates: Map<string, PlanningProtocolState> = new Map();
  private readonly taskExpectedResponses: Map<string, StructuredMessageType[]> = new Map();
  private readonly taskMaxAdvancement: Map<string, number> = new Map();
  private readonly taskAgreementReachedAgent: Map<string, string> = new Map();
  private readonly taskPendingProposal: Map<string, string> = new Map();
  private readonly taskAcceptedProposal: Map<string, string> = new Map();
  private readonly regressionRetryCounts: Map<string, number> = new Map();
  private readonly factCollectionStates: Map<string, FactCollectionState> = new Map();
  private readonly planningPhases: Map<string, PlanningPhase> = new Map();
  private readonly factCollectionTimeoutMs: number;

  constructor(
    private readonly deps: TeamCoordinatorDeps,
    options: TeamCoordinatorOptions = {},
  ) {
    this.planningEventTimeoutMs = options.planningEventTimeoutMs ?? DEFAULT_PLANNING_EVENT_TIMEOUT_MS;
    this.submitPlanUrgencyTimeoutMs =
      options.submitPlanUrgencyTimeoutMs ?? DEFAULT_SUBMIT_PLAN_URGENCY_TIMEOUT_MS;
    this.agentShutdownTimeoutMs = options.agentShutdownTimeoutMs ?? DEFAULT_AGENT_SHUTDOWN_TIMEOUT_MS;
    this.factCollectionTimeoutMs = options.factCollectionTimeoutMs ?? DEFAULT_FACT_COLLECTION_TIMEOUT_MS;
    this.planningRunsDir = options.planningRunsDir ?? './planning_runs';
  }

  createTeam(members: TeamMember[], provider?: AgentProvider): Team {
    const composition = this.inferComposition(members);
    this.validateMembers(members, composition);

    const now = new Date().toISOString();
    const team: Team = {
      id: `team-${Date.now()}`,
      composition,
      provider,
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
    const plannerCount = roles.filter((r) => r === 'planner').length;
    const workerCount = roles.filter((r) => r === 'worker').length;
    if (plannerCount === 2 && workerCount === 1) return 'planner-planner-worker';
    if (roles.includes('planner')) return 'planner-worker';
    return 'worker-only';
  }

  private validateMembers(members: TeamMember[], composition: TeamComposition): void {
    if (composition === 'planner-planner-worker') {
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
    console.log(`[TeamCoordinator] Starting task on team ${teamId} (Provider: ${team.provider ?? 'unknown'})`);

    if (team.status !== 'idle' && team.status !== 'completed') {
      throw new Error('Team is already working on a task');
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
      this.recordTaskTranscript(task, {
        kind: 'system',
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
    this.planningPhases.set(task.id, 'protocol_ack_pending');
    this.planningProtocolStates.set(task.id, {
      plannerIds,
      pendingAckPlannerIds: new Set(plannerIds),
      maxRepliesPerAgent,
      description,
    });

    const protocolPrompt = [
      'Planning protocol for this task:',
      '',
      '1) Acknowledge this protocol now via ack_planning_protocol.',
      '2) After all planners acknowledge, the orchestrator will send a fact_collection_begin event.',
      '3) During fact collection, investigate the codebase to gather relevant context for the task. When done, respond with message_type "fact_collection_end" and a summary of your findings.',
      '4) After all planners complete fact collection, the discussion phase opens.',
      '',
      '## Agreement Protocol',
      '',
      'Your goal is reaching a formal agreement with your peer planner using the structured protocol described below.',
      'Shared opinions or informal consensus are NOT sufficient — the agreement MUST be reached by observing the protocol steps exactly.',
      'Most importantly, the message_type in your JSON response is what the orchestrator enforces. The orchestrator does NOT read your message text to determine protocol state.',
      'If your message_type does not match the required protocol step, your activity is discarded regardless of what your message payload says.',
      '',
      'The protocol progresses through these phases in strict forward order:',
      '',
      'Phase 0 — fact_collection: After acknowledging the protocol, you receive fact_collection_begin. Investigate the codebase, then send message_type "fact_collection_end" with a summary of your findings.',
      'Phase 1 — discussion: Exchange ideas and opinions using message_type "opinion".',
      AGREEMENT_PROPOSAL_HINT_INSTRUCTION,
      'Phase 2 — proposal: When you believe both planners are aligned, one planner sends message_type "agreement_proposal" to formally propose that the discussion has converged.',
      'Phase 3 — endorsement: The OTHER planner (not the proposer) must confirm by sending message_type "agreement_acceptance". If you disagree, send "opinion" instead to continue the debate.',
      'Proposal Priority: If the orchestrator formally requests your endorsement for a specific proposal (Phase 3), you must respond specifically to that proposal. Accept it or reject it (via opinion) and discard your own alternative proposals for that turn.',
      'Phase 4 — submittal: After endorsement, the planner who did NOT send agreement_acceptance must submit the final plan using message_type "submit_plan".',
      '',
      'Critical enforcement rules:',
      '- The orchestrator tracks which protocol step the task is at based solely on message_type values.',
      '- Sending a message_type that regresses (e.g. "opinion" after "agreement_acceptance") will trigger a regression warning. If confirmed, planning is terminated.',
      '- Sending a message_type that is not in the expected set for the current step will immediately interrupt planning.',
      '- The content of message_payload never overrides the protocol step indicated by message_type.',
      `- ${MESSAGE_TYPE_MOTIVATION_REQUIREMENT}`,
      '- Shared Fate: If any agent in this team enters an ERROR state (including idle timeout), the entire task is immediately terminated. Stay active.',
      '',
      PLANNER_NO_CODE_TOUCH_REQUIREMENT,
    ].join('\n');

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



  /**
   * Handles a message between planners in a multi-planner-worker team.
   */
  async handlePlanningMessage(
    senderAgentId: string,
    payload: unknown,
    replyToMessageId?: string,
    expectedResponseTypes?: StructuredMessageType[],
  ): Promise<boolean> {
    const team = this.findTeamByAgent(senderAgentId);
    if (!team || team.composition !== 'planner-planner-worker' || !team.currentTaskId) {
      return false;
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      return false;
    }

    // Block messages during fact collection phase
    const factCollectionState = this.factCollectionStates.get(task.id);
    if (factCollectionState) {
      return true;
    }

    const planningProtocolState = this.planningProtocolStates.get(task.id);
    if (planningProtocolState && planningProtocolState.pendingAckPlannerIds.size > 0) {
      if (planningProtocolState.pendingAckPlannerIds.has(senderAgentId)) {
        try {
          await this.deps.sendProtocol(senderAgentId, 'EVT', {
            type: 'custom_event_request',
            event: 'ack_planning_protocol',
          args: { taskId: task.id },
            prompt: `Acknowledge planning protocol before discussing task content. ${MESSAGE_TYPE_MOTIVATION_REQUIREMENT}`,
          });
        } catch (err) {
          this.deps.logError(`[TeamCoordinator] Failed to re-request planning protocol ack from ${senderAgentId}:`, err);
        }
      }
      return true;
    }

    if (!this.validateProtocolStep(task.id, 'opinion', senderAgentId, expectedResponseTypes)) {
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

    const messageText = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const messageType = (payload && typeof payload === 'object') ? (payload as any).message_type : undefined;

    const peerIds = team.members
      .filter((m) => m.role === 'planner' && m.agentId !== senderAgentId)
      .map((m) => m.agentId);

    this.recordTaskTranscript(task, {
      kind: 'message',
      from: senderAgentId,
      to: peerIds.join(','),
      payload: messageText,
      messageType,
    });

    for (const peerId of peerIds) {
      try {
        await this.deps.sendProtocol(peerId, 'EVT', {
          type: 'message_received',
          from: senderAgentId,
          payload,
          ...(replyToMessageId ? { replyToMessageId } : {}),
          ...(expectedResponseTypes ? { expected_response_types: expectedResponseTypes } : {}),
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to broadcast planning message to ${peerId}:`, err);
      }
    }

    this.deps.emitTeamTask(task);

    // Check agreement non-compliance: target agent sent a regular message instead of the expected event
    const agreeState = this.agreementStates.get(task.id);
    if (agreeState && senderAgentId === agreeState.targetAgentId) {
      if (agreeState.phase === 'awaiting_endorsement') {
        await this.handleAgreementReachedFallbackToDiscussion(team, task, senderAgentId);
        return true;
      }
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

  async handleAgreementProposal(
    agentId: string,
    expectedResponseTypes?: StructuredMessageType[],
    proposalText?: string,
  ): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task) {
      throw new Error('Cannot submit agreement_proposal: no active task');
    }
    if (task.status !== 'planning') {
      // M08 (late-message race tolerance): planning already completed → benign straggler, no-op.
      console.warn(`[TeamCoordinator] Ignoring late agreement_proposal from ${agentId}: planning already completed (status: ${task.status}).`);
      return;
    }
    const currentPhase = this.getPlanningPhase(task.id);
    if (currentPhase === 'protocol_ack_pending' || currentPhase === 'fact_collection') {
      throw new Error(`Unexpected agreement_proposal: planning phase is ${currentPhase}`);
    }
    const normalizedProposal = this.normalizeProposal(proposalText);
    if (!normalizedProposal) {
      throw new Error('Invalid agreement_proposal: proposal text is required');
    }

    const agreeState = this.agreementStates.get(task.id);

    // Race condition: another proposal is already in flight — silently absorb the duplicate.
    // The second proposer will receive the "your peer has proposed agreement" notification
    // and can then confirm or reject that specific proposal.
    if (agreeState && agreeState.phase === 'awaiting_endorsement') {
      const pendingProposal = this.taskPendingProposal.get(task.id);
      if (pendingProposal && pendingProposal !== normalizedProposal) {
        throw new Error('Unexpected agreement_proposal: a different proposal is already pending endorsement');
      }
      console.log(`[TeamCoordinator] Ignoring concurrent agreement_proposal from ${agentId} — already awaiting agreement_acceptance`);
      return;
    }

    if (!this.validateProtocolStep(task.id, 'agreement_proposal', agentId, expectedResponseTypes)) {
      return;
    }

    this.advanceMaxRank(task.id, 'agreement_proposal');

    // If orchestrator pre-armed the state, validate the target matches
    if (agreeState && agreeState.phase === 'awaiting_proposal' && agreeState.targetAgentId !== agentId) {
      throw new Error('Unexpected agreement_proposal: not awaiting proposal from this agent');
    }

    // Clear any existing timer (orchestrator-initiated or previous attempt)
    if (agreeState) {
      clearTimeout(agreeState.timer);
      this.agreementStates.delete(task.id);
    }

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: agentId,
      to: 'system',
      payload: `Agreement proposed: ${proposalText}`,
    });
    this.deps.emitTeamTask(task);
    this.taskAcceptedProposal.delete(task.id);
    this.taskPendingProposal.set(task.id, normalizedProposal);

    // Ask the other planner for agreement_acceptance
    const otherPlanner = team.members.find((m) => m.role === 'planner' && m.agentId !== agentId);
    if (!otherPlanner) {
      throw new Error('No other planner found in team');
    }

    await this.requestAgreementReached(team, task, otherPlanner.agentId);
  }

  async handleAgreementReached(
    agentId: string,
    expectedResponseTypes?: StructuredMessageType[],
    proposalText?: string,
  ): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task) {
      throw new Error('Cannot submit agreement_acceptance: no active task');
    }
    if (task.status !== 'planning') {
      // M08 (late-message race tolerance): planning already completed → benign straggler, no-op.
      console.warn(`[TeamCoordinator] Ignoring late agreement_acceptance from ${agentId}: planning already completed (status: ${task.status}).`);
      return;
    }
    const currentPhase = this.getPlanningPhase(task.id);
    if (currentPhase === 'protocol_ack_pending' || currentPhase === 'fact_collection') {
      throw new Error(`Unexpected agreement_acceptance: planning phase is ${currentPhase}`);
    }
    const normalizedProposal = this.normalizeProposal(proposalText);
    if (!normalizedProposal) {
      throw new Error('Invalid agreement_acceptance: proposal text is required');
    }

    const agreeState = this.agreementStates.get(task.id);

    // Stale agreement_acceptance arriving after a fallback-to-discussion cleared the state.
    // The agent was still processing the original "please call agreement_acceptance" event.
    // Silently absorb it — the protocol has moved on to a new discussion cycle.
    if (
      (!agreeState || agreeState.phase !== 'awaiting_endorsement') &&
      this.isExpectingDiscussionPhase(task.id) &&
      (this.agreementReachedDiscussionFallbackCounts.get(task.id) ?? 0) > 0
    ) {
      console.log(`[TeamCoordinator] Ignoring stale agreement_acceptance from ${agentId} — protocol reset to discussion`);
      return;
    }

    if (!agreeState && this.getPlanningPhase(task.id) === 'discussion') {
      throw new Error('Unexpected agreement_acceptance: no pending agreement proposal to confirm');
    }

    if (!this.validateProtocolStep(task.id, 'agreement_acceptance', agentId, expectedResponseTypes)) {
      return;
    }

    this.advanceMaxRank(task.id, 'agreement_acceptance');

    if (!agreeState || agreeState.phase !== 'awaiting_endorsement') {
      throw new Error('Unexpected agreement_acceptance: no pending agreement proposal to confirm');
    }

    if (agreeState.targetAgentId !== agentId) {
      throw new Error('Unexpected agreement_acceptance: not awaiting confirmation from this agent');
    }
    const pendingProposal = this.taskPendingProposal.get(task.id);
    if (!pendingProposal || pendingProposal !== normalizedProposal) {
      throw new Error('Unexpected agreement_acceptance: proposal does not match pending proposal');
    }

    clearTimeout(agreeState.timer);
    this.agreementStates.delete(task.id);
    this.agreementReachedDiscussionFallbackCounts.delete(task.id);
    this.taskPendingProposal.delete(task.id);
    this.taskAcceptedProposal.set(task.id, normalizedProposal);

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: agentId,
      to: 'system',
      payload: `Agreement reached for proposal: ${proposalText}`,
    });
    this.deps.emitTeamTask(task);

    // Agreement complete — record who confirmed and arm submit_plan urgency
    this.taskAgreementReachedAgent.set(task.id, agentId);
    this.planningPhases.set(task.id, 'submittal_pending');
    this.taskExpectedResponses.set(task.id, ['submit_plan']);
    await this.armSubmitPlanUrgencyWatchdog(team, task, ['submit_plan']);
  }

  private async requestAgreementProposal(team: Team, task: TeamTask, agentId: string): Promise<void> {
    const message =
      'You are 1 message away from the reply limit. Please call agreement_proposal now to signal that you are ready to finalize the plan. ' +
      MESSAGE_TYPE_MOTIVATION_REQUIREMENT;

    try {
      await this.deps.sendProtocol(agentId, 'EVT', {
        type: 'custom_event_request',
        event: 'agreement_proposal',
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to request agreement_proposal from ${agentId}:`, err);
    }

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: agentId,
      payload: message,
    });
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
    this.taskExpectedResponses.set(task.id, ['agreement_proposal', 'opinion']);
  }

  private async requestAgreementReached(team: Team, task: TeamTask, agentId: string): Promise<void> {
    const message =
      'Your peer has proposed agreement. Please call agreement_acceptance to confirm, or continue discussing if you disagree. ' +
      MESSAGE_TYPE_MOTIVATION_REQUIREMENT;

    try {
      await this.deps.sendProtocol(agentId, 'EVT', {
        type: 'custom_event_request',
        event: 'agreement_acceptance',
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to request agreement_acceptance from ${agentId}:`, err);
    }

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: agentId,
      payload: message,
    });
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
      phase: 'awaiting_endorsement',
      targetAgentId: agentId,
      asksIssued: 1,
      timer,
    });
    this.planningPhases.set(task.id, 'proposal_pending_endorsement');
    this.taskExpectedResponses.set(task.id, ['agreement_acceptance', 'opinion']);
  }

  private async handleAgreementNonCompliance(team: Team, task: TeamTask): Promise<void> {
    const agreeState = this.agreementStates.get(task.id);
    if (!agreeState) return;

    clearTimeout(agreeState.timer);

    if (agreeState.asksIssued >= MAX_AGREEMENT_ASKS) {
      // Asked twice, no compliance — fail planning
      this.agreementStates.delete(task.id);
      const eventName = agreeState.phase === 'awaiting_proposal' ? 'agreement_proposal' : 'agreement_acceptance';
      await this.interruptPlanningForMissingEvents(team, task, [eventName]);
      return;
    }

    // Re-ask
    agreeState.asksIssued++;
    const eventName = agreeState.phase === 'awaiting_proposal' ? 'agreement_proposal' : 'agreement_acceptance';
    const message =
      `Reminder (${agreeState.asksIssued}/${MAX_AGREEMENT_ASKS}): please call ${eventName} now. ` +
      `Planning will be interrupted if you do not comply. ${MESSAGE_TYPE_MOTIVATION_REQUIREMENT}`;

    try {
      await this.deps.sendProtocol(agreeState.targetAgentId, 'EVT', {
        type: 'custom_event_request',
        event: eventName,
        prompt: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to re-request ${eventName} from ${agreeState.targetAgentId}:`, err);
    }

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: agreeState.targetAgentId,
      payload: message,
    });
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

  private async handleAgreementReachedFallbackToDiscussion(
    team: Team,
    task: TeamTask,
    senderAgentId: string,
  ): Promise<void> {
    const agreeState = this.agreementStates.get(task.id);
    if (!agreeState || agreeState.phase !== 'awaiting_endorsement' || agreeState.targetAgentId !== senderAgentId) {
      await this.handleAgreementNonCompliance(team, task);
      return;
    }

    clearTimeout(agreeState.timer);
    this.agreementStates.delete(task.id);

    const nextFallbackCount = (this.agreementReachedDiscussionFallbackCounts.get(task.id) ?? 0) + 1;
    this.agreementReachedDiscussionFallbackCounts.set(task.id, nextFallbackCount);

    if (nextFallbackCount > MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS) {
      await this.interruptPlanningForMissingEvents(team, task, ['agreement_acceptance']);
      return;
    }

    this.taskExpectedResponses.set(task.id, ['opinion', 'agreement_proposal']);
    this.taskMaxAdvancement.delete(task.id);
    this.clearRegressionRetries(task.id);
    this.planningPhases.set(task.id, 'discussion');
    this.taskPendingProposal.delete(task.id);

    const message =
      `agreement_acceptance was not provided; returning to discussion phase ` +
      `(${nextFallbackCount}/${MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS} allowed fallback(s)). ` +
      'Continue with opinions, then send agreement_proposal when aligned.';

    const planners = team.members.filter((m) => m.role === 'planner');
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: planners.map((m) => m.agentId).join(','),
      payload: message,
    });
    this.deps.emitTeamTask(task);

    for (const planner of planners) {
      try {
        await this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: message,
        });
      } catch (err) {
        this.deps.logError(
          `[TeamCoordinator] Failed to notify ${planner.agentId} about agreement_acceptance fallback:`,
          err,
        );
      }
    }
  }

  private clearAgreementState(taskId: string): void {
    const state = this.agreementStates.get(taskId);
    if (state) {
      clearTimeout(state.timer);
      this.agreementStates.delete(taskId);
    }
  }

  private clearFactCollectionState(taskId: string): void {
    const state = this.factCollectionStates.get(taskId);
    if (state) {
      clearTimeout(state.timer);
      this.factCollectionStates.delete(taskId);
    }
  }

  private getPlanningPhase(taskId: string): PlanningPhase | undefined {
    const phase = this.planningPhases.get(taskId);
    if (phase) {
      return phase;
    }

    // Fallback inference for safety if phase state was not persisted.
    if (this.planningProtocolStates.has(taskId)) {
      return 'protocol_ack_pending';
    }
    if (this.factCollectionStates.has(taskId)) {
      return 'fact_collection';
    }
    const agreementState = this.agreementStates.get(taskId);
    if (agreementState?.phase === 'awaiting_endorsement') {
      return 'proposal_pending_endorsement';
    }
    const expected = this.taskExpectedResponses.get(taskId);
    if (expected?.length === 1 && expected[0] === 'submit_plan') {
      return 'submittal_pending';
    }
    if (expected?.includes('opinion') && expected.includes('agreement_proposal')) {
      return 'discussion';
    }
    return undefined;
  }

  private normalizeProposal(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : undefined;
  }

  private interruptPlanning(team: Team, task: TeamTask, reason: string): void {
    void this.interruptPlanningForMissingEvents(team, task, [reason]);
  }

  async handlePlanningProtocolAck(agentId: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task) {
      throw new Error('Cannot acknowledge planning protocol: no active task');
    }
    if (task.status !== 'planning') {
      // M08 (late-message race tolerance): planning already completed → benign straggler, no-op.
      console.warn(`[TeamCoordinator] Ignoring late ack_planning_protocol from ${agentId}: planning already completed (status: ${task.status}).`);
      return;
    }

    const state = this.planningProtocolStates.get(task.id);
    if (!state) {
      throw new Error('Unexpected ack_planning_protocol: no pending planning protocol acknowledgement');
    }

    if (!state.pendingAckPlannerIds.has(agentId)) {
      throw new Error('Unexpected ack_planning_protocol: protocol already acknowledged by this agent');
    }

    state.pendingAckPlannerIds.delete(agentId);
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: agentId,
      to: 'system',
      payload: 'Planning protocol acknowledged.',
    });
    this.deps.emitTeamTask(task);

    if (state.pendingAckPlannerIds.size > 0) {
      return;
    }

    this.planningProtocolStates.delete(task.id);

    // Start fact collection phase — planners investigate the codebase before discussion opens
    const timeoutMs = team.provider === 'gemini'
      ? Math.max(this.factCollectionTimeoutMs, DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS)
      : this.factCollectionTimeoutMs;
    const factCollectionTimer = setTimeout(() => {
      this.handleFactCollectionTimeout(task.id);
    }, timeoutMs);

    this.factCollectionStates.set(task.id, {
      plannerIds: state.plannerIds,
      pendingPlannerIds: new Set(state.plannerIds),
      maxRepliesPerAgent: state.maxRepliesPerAgent,
      description: state.description,
      timer: factCollectionTimer,
    });
    this.planningPhases.set(task.id, 'fact_collection');

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: state.plannerIds.join(','),
      payload: 'Fact collection phase started.',
    });
    this.deps.emitTeamTask(task);

    for (const id of state.plannerIds) {
      const peerIds = state.plannerIds.filter((pid) => pid !== id);
      try {
        await this.deps.sendProtocol(id, 'EVT', {
          type: 'fact_collection_begin',
          taskId: task.id,
          description: state.description,
          peerIds,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send fact_collection_begin to ${id}:`, err);
      }
    }
  }

  async handleFactCollectionEnd(agentId: string, summary: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) {
      throw new Error(`Agent ${agentId} is not part of any active team`);
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task) {
      throw new Error('Cannot end fact collection: no active task');
    }
    if (task.status !== 'planning') {
      // M08 (late-message race tolerance): planning already completed → benign straggler, no-op.
      console.warn(`[TeamCoordinator] Ignoring late fact_collection_end from ${agentId}: planning already completed (status: ${task.status}).`);
      return;
    }

    const state = this.factCollectionStates.get(task.id);
    if (!state) {
      throw new Error('Unexpected fact_collection_end: no active fact collection phase');
    }

    if (!state.pendingPlannerIds.has(agentId)) {
      throw new Error('Unexpected fact_collection_end: fact collection already completed by this agent');
    }

    state.pendingPlannerIds.delete(agentId);
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: agentId,
      to: 'system',
      payload: `Fact collection completed. Summary: ${summary}`,
    });
    this.deps.emitTeamTask(task);

    if (state.pendingPlannerIds.size > 0) {
      return;
    }

    // All planners done — clear state and open discussion phase
    clearTimeout(state.timer);
    this.factCollectionStates.delete(task.id);

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: state.plannerIds.join(','),
      payload: 'All planners completed fact collection. Discussion phase starting.',
    });
    this.deps.emitTeamTask(task);

    this.planningPhases.set(task.id, 'discussion');
    this.taskExpectedResponses.set(task.id, ['opinion', 'agreement_proposal']);
    this.armPlanningWatchdog(team, task, ['submit_plan']);

    for (const [i, id] of state.plannerIds.entries()) {
      const peerIds = state.plannerIds.filter((pid) => pid !== id);
      try {
        await this.deps.sendProtocol(id, 'EVT', {
          type: 'conversation_start',
          conversationId: task.id,
          mode: 'planning',
          topic:
            `Your goal is reaching a formal agreement for: ${state.description}. ` +
            `Shared opinions are NOT enough — you must advance through the protocol phases: discussion → proposal → endorsement → submittal. ` +
            `The orchestrator enforces protocol compliance based on your message_type, not your message text. ` +
            `If your message_type does not match the expected protocol step, your message is discarded regardless of its content. ` +
            `Proposal Priority: If the orchestrator formally requests your endorsement for a specific proposal (Phase 3), you must respond specifically to that proposal. Accept it or reject it (via opinion) and discard your own alternative proposals for that turn. ` +
            `Regression & Fallback: If a proposal is rejected, the protocol returns to Discussion. You may then revive previous proposals or explore new ones. ` +
            `Shared Fate: If any agent in this team enters an ERROR state (including idle timeout), the entire task is immediately terminated. Stay active. ` +
            `${MESSAGE_TYPE_MOTIVATION_REQUIREMENT} ` +
            `${PLANNER_NO_CODE_TOUCH_REQUIREMENT} ` +
            (i === 0 
              ? 'Initiator: You MUST open the discussion now with an opinion.' 
              : 'Peer: Wait for the initiator, then respond with an opinion.'),
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

  private handleFactCollectionTimeout(taskId: string): void {
    const state = this.factCollectionStates.get(taskId);
    if (!state) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.factCollectionStates.delete(taskId);
      return;
    }

    const team = this.findTeamByTaskId(taskId);
    if (!team) {
      this.factCollectionStates.delete(taskId);
      return;
    }

    const pending = [...state.pendingPlannerIds];
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: pending.join(','),
      payload: `Fact collection timed out. Agents that did not complete: ${pending.join(', ')}. Planning interrupted.`,
    });

    this.factCollectionStates.delete(taskId);
    this.interruptPlanning(team, task, `Fact collection timed out waiting for: ${pending.join(', ')}`);
  }



  handlePlanSubmitted(agentId: string, plan: string, proposalText?: string, planningText?: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'planning') {
      // M08 (late-message race tolerance): planning already completed → a straggler submit_plan
      // is benign. Ignore it (no-op) instead of throwing, which would mark the agent `error` and
      // trip M03 failure propagation to kill the already-successful team task.
      console.warn(`[TeamCoordinator] Ignoring late submit_plan from ${agentId}: planning already completed (status: ${task.status}).`);
      return;
    }

    if (!this.validateProtocolStep(task.id, 'submit_plan', agentId, [])) {
      return;
    }

    const agreementReachedAgent = this.taskAgreementReachedAgent.get(task.id);
    if (agreementReachedAgent && agreementReachedAgent === agentId) {
      throw new Error('The agent that confirmed agreement_acceptance cannot submit the plan — the other planner must submit it');
    }

    if (team.composition === 'planner-planner-worker') {
      const normalizedProposal = this.normalizeProposal(proposalText);
      if (!normalizedProposal) {
        throw new Error('Invalid submit_plan: proposal text is required');
      }
      const acceptedProposal = this.taskAcceptedProposal.get(task.id);
      if (!acceptedProposal || acceptedProposal !== normalizedProposal) {
        throw new Error('Invalid submit_plan: proposal does not match the accepted proposal');
      }
      if (typeof planningText !== 'string') {
        throw new Error('Invalid submit_plan: text field is required');
      }
    }

    assertPlanIsImplementationReady(plan);

    const now = new Date().toISOString();
    this.clearPlanningWatchdog(task.id);
    this.clearSubmitPlanUrgencyWatchdog(task.id);
    this.clearAgreementState(task.id);
    this.planningPhases.delete(task.id);
    this.agreementReachedDiscussionFallbackCounts.delete(task.id);
    this.taskAgreementReachedAgent.delete(task.id);
    this.taskPendingProposal.delete(task.id);
    this.taskAcceptedProposal.delete(task.id);
    task.plan = plan;
    task.planningComplete = true;
    task.planSubmittedAt = now;
    task.status = 'awaiting_confirmation';
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: agentId,
      to: 'user',
      payload: 'Planner finished and submitted the final plan.',
    });
    this.recordTaskTranscript(task, {
      kind: 'message',
      from: agentId,
      to: 'user',
      payload: plan,
    });

    team.status = 'awaiting_confirmation';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
    this.deps.emitPlanningComplete({ team, task, plannerAgentId: agentId });
    this.persistPlanningRun(team, task);

    // End the planning conversation so planners stop discussing
    const planners = team.members.filter((m) => m.role === 'planner');
    for (const planner of planners) {
      try {
        void this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'conversation_end',
          conversationId: task.id,
          reason: 'Plan submitted — planning complete.',
        });
        // Request shutdown and setup watchdog
        this.requestAgentShutdown(planner.agentId);
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to send conversation_end to ${planner.agentId}:`, err);
      }
    }
  }

  async confirmPlan(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    const team = this.getTeam(task.teamId);

    if (task.status !== 'awaiting_confirmation') {
      throw new Error(`Cannot confirm plan: task status is ${task.status}`);
    }

    const worker = this.getMemberByRole(team, 'worker');

    task.planConfirmed = true;
    task.status = 'delegated';
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'user',
      to: worker.agentId,
      payload: 'Plan confirmed. Delegating to worker.',
    });

    team.status = 'working';
    team.updatedAt = new Date().toISOString();

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

    task.status = 'planning';
    task.planningComplete = false;
    delete task.plan;
    delete task.planSubmittedAt;
    this.recordTaskTranscript(task, {
      kind: 'message',
      from: 'user',
      to: planner.agentId,
      payload: `Plan rejected: ${feedback}`,
    });

    team.status = 'planning';
    team.updatedAt = new Date().toISOString();

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
    this.clearSubmitPlanUrgencyWatchdog(task.id);
    this.clearAgreementState(task.id);
    this.agreementReachedDiscussionFallbackCounts.delete(task.id);
    this.taskPendingProposal.delete(task.id);
    this.taskAcceptedProposal.delete(task.id);
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

    task.workerAccepted = accepted;

    if (accepted) {
      task.status = 'in_progress';
      this.recordTaskTranscript(task, {
        kind: 'message',
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
      this.recordTaskTranscript(task, {
        kind: 'message',
        from: agentId,
        to: 'user',
        payload: `Worker refused: ${reason ?? 'No reason given'}`,
      });
      team.status = 'error';
    }

    team.updatedAt = new Date().toISOString();
    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  handleWorkResult(agentId: string, result: string): void {
    const { team, task } = this.getTeamContextByAgent(agentId);

    if (task.status !== 'in_progress') {
      throw new Error(`Cannot submit result: task status is ${task.status}`);
    }

    task.status = 'completed';
    this.recordTaskTranscript(task, {
      kind: 'message',
      from: agentId,
      to: 'user',
      payload: result,
    });

    team.status = 'completed';
    delete team.currentTaskId;
    team.updatedAt = new Date().toISOString();

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  async sendUserMessage(taskId: string, targetRole: TeamRole, message: string): Promise<void> {
    const task = this.getTask(taskId);
    const team = this.getTeam(task.teamId);
    const member = this.getMemberByRole(team, targetRole);

    this.recordTaskTranscript(task, {
      kind: 'message',
      from: 'user',
      to: member.agentId,
      payload: message,
    });

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

  private persistPlanningRun(team: Team, task: TeamTask): void {
    if (!this.planningRunsDir) return;
    try {
      if (!existsSync(this.planningRunsDir)) {
        mkdirSync(this.planningRunsDir, { recursive: true });
      }

      const members = team.members.map((member) => {
        try {
          const agent = this.deps.getAgent(member.agentId);
          return {
            ...member,
            model: agent.model,
            provider: agent.provider,
          };
        } catch (err) {
          return member;
        }
      });

      const payload = {
        taskId: task.id,
        teamId: team.id,
        composition: team.composition,
        description: task.description,
        status: task.status,
        plan: task.plan ?? null,
        plannerAgentId: task.plannerAgentId ?? null,
        members,
        transcript: task.transcript,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        persistedAt: new Date().toISOString(),
      };

      const filePath = path.join(this.planningRunsDir, `${task.id}.json`);
      writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[TeamCoordinator] Planning run persisted to ${filePath}`);
    } catch (err) {
      this.deps.logError('[TeamCoordinator] Failed to persist planning run:', err);
    }
  }

  private buildWorkerPlan(plan: string): string {
    return `${plan}\n\n${GIT_WORKTREE_REQUIREMENT}`;
  }

  private recordTaskTranscript(
    task: TeamTask,
    entry: Omit<TranscriptEntry, 'timestamp'>,
  ): void {
    const now = new Date().toISOString();
    const fullEntry: TranscriptEntry = {
      ...entry,
      timestamp: now,
    };

    if (entry.messageType) {
      fullEntry.messageType = entry.messageType;
    }

    if (entry.from !== 'system' && entry.from !== 'user') {
      try {
        const agent = this.deps.getAgent(entry.from);
        if (agent.model) fullEntry.model = agent.model;
        if (agent.provider) fullEntry.provider = agent.provider;
      } catch (err) {
        // Agent not found or error, just continue
      }
    }

    task.transcript.push(fullEntry);
    task.updatedAt = now;
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

  private findTeamByTaskId(taskId: string): Team | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    return this.teams.get(task.teamId);
  }

  isAgentFactCollecting(agentId: string): boolean {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) return false;
    const state = this.factCollectionStates.get(team.currentTaskId);
    return !!state && state.pendingPlannerIds.has(agentId);
  }

  /**
   * M08-T3: true while the agent's current task is paused awaiting the operator
   * (worker effect-fence). Mirrors isAgentFactCollecting; used by the registry
   * idle-timeout guard so a paused-but-alive worker is never flagged as errored
   * (D3 "kill nobody", 3rd safety layer — LB-16 Finding 3.3).
   */
  isTaskAwaitingOperator(agentId: string): boolean {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) return false;
    const task = this.tasks.get(team.currentTaskId);
    return !!task && task.status === 'awaiting_operator';
  }

  async handleAgentFailure(agentId: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) return;

    const task = this.tasks.get(team.currentTaskId);
    if (!task) return;

    console.log(`[TeamCoordinator] Handling failure for agent ${agentId} on team ${team.id} (task: ${task.id}, status: ${task.status})`);


    if (task.status === 'planning') {
      await this.interruptPlanningForMissingEvents(team, task, [`Agent ${agentId} error`]);
    } else if (['delegated', 'in_progress', 'awaiting_confirmation'].includes(task.status)) {
      task.status = 'interrupted';
      this.recordTaskTranscript(task, {
        kind: 'system',
        from: 'system',
        to: team.members.map((m) => m.agentId).join(','),
        payload: `Task interrupted: Agent ${agentId} entered error state.`,
      });

      team.status = 'error';
      delete team.currentTaskId;
      team.updatedAt = new Date().toISOString();

      this.deps.emitTeam(team);
      this.deps.emitTeamTask(task);
      this.persistPlanningRun(team, task);

      // Notify other agents
      for (const member of team.members) {
        if (member.agentId === agentId) continue;
        try {
          await this.deps.sendProtocol(member.agentId, 'EVT', {
            type: 'message_received',
            from: 'system',
            payload: `Task interrupted because agent ${agentId} entered error state.`,
          });
          this.requestAgentShutdown(member.agentId);
        } catch (err) {
          this.deps.logError(`[TeamCoordinator] Failed to notify ${member.agentId} about agent failure:`, err);
          this.requestAgentShutdown(member.agentId);
        }
      }
    }
  }

  /**
   * M08-T3 worker effect-fence (D4 stop-and-ask, FENCE ONLY).
   * Diverts a worker-exec crash into a paused, recoverable state instead of the
   * M03 Shared-Fate kill. Deliberately a SEPARATE method from handleAgentFailure
   * (which stays byte-for-byte): it sets task.status='awaiting_operator', records
   * + surfaces the failure, and **terminates nobody / deletes nothing** — the task
   * stays attached so the operator can inspect it. The freeze is implicit (a task
   * in 'awaiting_operator' gets no scheduled turns; LB-16 Findings 1–3).
   * NOTE: no abort/recovery path here — that is deferred to its own milestone
   * (LB-16 ratification 2026-06-23). v1 recovery is manual cleanup + restart.
   */
  async pauseTaskForOperator(agentId: string, reason: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) return;

    const task = this.tasks.get(team.currentTaskId);
    if (!task) return;

    console.log(`[TeamCoordinator] Pausing task ${task.id} for operator (agent ${agentId} worker-exec failed; status was ${task.status})`);

    task.status = 'awaiting_operator';
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Task paused awaiting operator: worker exec for agent ${agentId} failed (${reason}). Effects may be partial; the team is left alive and the task frozen for inspection.`,
    });

    this.deps.emitTeamTask(task);
  }

  /**
   * M10-T1 peer-safe planner eject (D1 fail-soft).
   *
   * The graded-loop terminal action for a planner that stays non-compliant past
   * its correction budget. Deliberately a SEPARATE method from
   * interruptPlanningForMissingEvents (the M03 dual-kill, which shuts down BOTH
   * planners on any violation — the LB-7/8 bug): ejectPlanner quiesces ONLY the
   * offender, keeps the surviving planner(s) alive, and ends the round fail-soft
   * by freezing the task in 'awaiting_operator' (mirrors pauseTaskForOperator /
   * M08-T3) — terminates nobody but the offender, surfaces to the operator, and
   * leaves the task attached for inspection.
   *
   * Why freeze rather than continue: with <2 planners consensus cannot proceed
   * (D1 — no continue-solo in v1), so the round is over; recovery is
   * operator-driven (manual, like the M08-T3 fence).
   *
   * Additive in T1: this has NO callers yet. T2 rewires the validation site to
   * call this (after a bounded correct/retry) instead of the dual-kill.
   */
  async ejectPlanner(agentId: string, reason: string): Promise<void> {
    const team = this.findTeamByAgent(agentId);
    if (!team || !team.currentTaskId) return;

    const task = this.tasks.get(team.currentTaskId);
    if (!task) return;

    console.log(`[TeamCoordinator] Ejecting planner ${agentId} from task ${task.id} (${reason}); surviving planner(s) kept alive, round frozen for operator.`);

    // Stop this task's planning watchdogs so a stray timer can't fire the
    // dual-kill after the eject. (The timers also self-guard on task.status,
    // but clearing is cleaner and is bounded to this task only.)
    this.clearPlanningWatchdog(task.id);
    this.clearSubmitPlanUrgencyWatchdog(task.id);

    // Fail-soft terminal state: freeze the task for the operator. Team stays
    // alive (NOT 'interrupted'/'error'); currentTaskId stays set so the task is
    // attached for inspection — exactly as pauseTaskForOperator does.
    task.status = 'awaiting_operator';
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Planner ${agentId} ejected: ${reason}. Surviving planner(s) kept alive; consensus needs 2 planners, so the round is frozen awaiting operator (no continue-solo in v1).`,
    });

    this.deps.emitTeamTask(task);

    // Notify the surviving planner(s) — they remain active and are NOT shut down.
    const survivingPlanners = team.members.filter(
      (m) => m.role === 'planner' && m.agentId !== agentId,
    );
    for (const planner of survivingPlanners) {
      try {
        await this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: `Planning paused: planner ${agentId} was ejected (${reason}). You remain active; the operator will decide how to proceed.`,
        });
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to notify ${planner.agentId} about planner eject:`, err);
      }
    }

    // Quiesce ONLY the offender (the surviving planner is left running).
    this.requestAgentShutdown(agentId);
  }

  removeAgentFromTeams(agentId: string): void {
    const teamId = this.agentToTeam.get(agentId);
    
    // Always clear shutdown timer if it exists
    const timer = this.agentShutdownTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.agentShutdownTimers.delete(agentId);
    }

    if (!teamId) return;

    this.agentToTeam.delete(agentId);
    const team = this.teams.get(teamId);
    if (!team) return;


    if (team.currentTaskId) {
      this.clearPlanningWatchdog(team.currentTaskId);
      this.clearSubmitPlanUrgencyWatchdog(team.currentTaskId);
      this.clearAgreementState(team.currentTaskId);
      this.planningPhases.delete(team.currentTaskId);
      this.taskPendingProposal.delete(team.currentTaskId);
      this.taskAcceptedProposal.delete(team.currentTaskId);
    }

    team.status = 'error';
    team.updatedAt = new Date().toISOString();
    this.deps.emitTeam(team);
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

    const timeoutSeconds = Math.max(1, Math.floor(this.submitPlanUrgencyTimeoutMs / 1000));
    const missing = missingEvents.join(', ');
    const ignoreCount = this.urgencyIgnoreCounts.get(task.id) ?? 0;
    const planners = team.members.filter((m) => m.role === 'planner');

    const reminderText = ignoreCount === 0
      ? `Reply limit reached. One planner must call ${missing} within ${timeoutSeconds}s. Planning is interrupted after ${MAX_URGENCY_IGNORES} ignored urgency checks. ${MESSAGE_TYPE_MOTIVATION_REQUIREMENT}`
      : `Urgency reminder ignored (${ignoreCount}/${MAX_URGENCY_IGNORES}). One planner must call ${missing} within ${timeoutSeconds}s. Planning is interrupted after ${MAX_URGENCY_IGNORES} ignored urgency checks. ${MESSAGE_TYPE_MOTIVATION_REQUIREMENT}`;

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

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: planners.map((p) => p.agentId).join(','),
      payload: reminderText,
    });
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
    this.clearFactCollectionState(task.id);
    this.agreementReachedDiscussionFallbackCounts.delete(task.id);
    this.planningProtocolStates.delete(task.id);
    this.planningPhases.delete(task.id);
    this.taskExpectedResponses.delete(task.id);
    this.taskMaxAdvancement.delete(task.id);
    this.taskAgreementReachedAgent.delete(task.id);
    this.taskPendingProposal.delete(task.id);
    this.taskAcceptedProposal.delete(task.id);

    const missing = missingEvents.join(', ');
    task.status = 'interrupted';
    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: team.members.map((m) => m.agentId).join(','),
      payload: `Planning stopped: missing required event(s): ${missing}.`,
    });

    team.status = 'interrupted';
    delete team.currentTaskId;
    team.updatedAt = new Date().toISOString();

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
    this.persistPlanningRun(team, task);

    const planners = team.members.filter((m) => m.role === 'planner');
    for (const planner of planners) {
      try {
        await this.deps.sendProtocol(planner.agentId, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: `Planning interrupted because required event(s) were not received: ${missing}.`,
        });
        // Request shutdown and setup watchdog
        this.requestAgentShutdown(planner.agentId);
      } catch (err) {
        this.deps.logError(`[TeamCoordinator] Failed to notify ${planner.agentId} about missing planning events:`, err);
      }
    }
  }

  private requestAgentShutdown(agentId: string): void {
    if (this.agentShutdownTimers.has(agentId)) {
      return;
    }

    const timer = setTimeout(() => {
      console.log(`[TeamCoordinator] Forced shutdown for agent ${agentId} after ${this.agentShutdownTimeoutMs}ms`);
      this.deps.removeAgent(agentId).catch((err) => {
        this.deps.logError(`[TeamCoordinator] Failed to remove agent ${agentId} after timeout:`, err);
      });
      this.agentShutdownTimers.delete(agentId);
    }, this.agentShutdownTimeoutMs);

    this.agentShutdownTimers.set(agentId, timer);
  }

  private validateProtocolStep(
    taskId: string,
    actualType: StructuredMessageType,
    senderAgentId: string,
    _declaredExpected?: StructuredMessageType[],
  ): boolean {
    const expected = this.taskExpectedResponses.get(taskId);
    const currentMax = this.taskMaxAdvancement.get(taskId) ?? 0;
    const actualRank = ADVANCEMENT_RANK[actualType] ?? 0;

    // Server-side expected state is authoritative; agent-declared next states are advisory only.
    if (expected && !expected.includes(actualType)) {
      // M10-T2 graded loop: ANY illegal move (regression OR forward/lateral) gets
      // a bounded correction before the offender is removed (D2, N=2). The two
      // flavours share one budget (regressionRetryCounts) and differ only in the
      // correction message: a regression asks the agent to confirm/resend; a
      // forward/lateral illegal move restates the legal set. On budget exhaustion
      // we call the peer-safe ejectPlanner (T1) — NOT the M03 dual-kill: the
      // surviving planner stays alive and the round ends fail-soft (D1).
      const isRegression = actualRank < currentMax;
      const retryKey = `${taskId}:${senderAgentId}`;
      const retryCount = this.regressionRetryCounts.get(retryKey) ?? 0;

      if (retryCount < MAX_REGRESSION_RETRIES) {
        this.regressionRetryCounts.set(retryKey, retryCount + 1);
        if (isRegression) {
          void this.askRegressionConfirmation(taskId, senderAgentId, actualType, currentMax, retryCount + 1);
        } else {
          void this.askProtocolCorrection(taskId, senderAgentId, actualType, expected, retryCount + 1);
        }
        return false;
      }

      // Budget exhausted — eject the offender (peer + round survive, fail-soft).
      this.regressionRetryCounts.delete(retryKey);
      const rankNames = Object.entries(ADVANCEMENT_RANK).find(([_, r]) => r === currentMax);
      const maxRankName = rankNames ? rankNames[0] : 'unknown';
      const reason = isRegression
        ? `Protocol regression: confirmed "${actualType}" after planning advanced to "${maxRankName}" (expected one of [${expected.join(', ')}]).`
        : `Illegal protocol move: repeated "${actualType}" not in the expected set [${expected.join(', ')}].`;
      void this.ejectPlanner(senderAgentId, reason);
      return false;
    }

    // If moving forward past a rank that had pending regression retries, clear them.
    if (actualRank > currentMax) {
      this.taskMaxAdvancement.set(taskId, actualRank);
      this.clearRegressionRetries(taskId);
    }

    return true;
  }

  /**
   * Ensures taskMaxAdvancement is at least the rank of the given message type.
   * Called unconditionally after the validateProtocolStep gate so that max
   * advancement is updated even when validateProtocolStep is skipped (e.g.
   * when expectedResponseTypes is undefined from a custom_event_request
   * compliance path).
   */
  private advanceMaxRank(taskId: string, messageType: StructuredMessageType): void {
    const currentMax = this.taskMaxAdvancement.get(taskId) ?? 0;
    const rank = ADVANCEMENT_RANK[messageType] ?? 0;
    if (rank > currentMax) {
      this.taskMaxAdvancement.set(taskId, rank);
      this.clearRegressionRetries(taskId);
    }
  }

  private async askRegressionConfirmation(
    taskId: string,
    senderAgentId: string,
    actual: string,
    currentMaxRank: number,
    attempt: number,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const team = this.teams.get(task.teamId);
    if (!team) return;

    const rankNames = Object.entries(ADVANCEMENT_RANK).find(([_, r]) => r === currentMaxRank);
    const maxRankName = rankNames ? rankNames[0] : 'unknown';

    const message =
      `You sent "${actual}", but planning has already advanced to "${maxRankName}". ` +
      `Did you really intend to go back to "${actual}", or did you misstep the message type? ` +
      `If this was a mistake, please resend with the correct message type. ` +
      `If you genuinely want to regress, send "${actual}" again — but note that confirming a regression will end the planning session. ` +
      `${MESSAGE_TYPE_MOTIVATION_REQUIREMENT} ` +
      `(confirmation attempt ${attempt}/${MAX_REGRESSION_RETRIES})`;

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: senderAgentId,
      payload: message,
    });
    this.deps.emitTeamTask(task);

    try {
      await this.deps.sendProtocol(senderAgentId, 'EVT', {
        type: 'message_received',
        from: 'system',
        payload: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to ask ${senderAgentId} for regression confirmation:`, err);
    }
  }

  /**
   * M10-T2: correction prompt for a forward/lateral illegal move (a message_type
   * that is not in the current legal set but is NOT a regression). Mirrors
   * askRegressionConfirmation but restates the legal set instead of asking the
   * agent to confirm a regression. Bounded by the same budget — on exhaustion the
   * caller (validateProtocolStep) ejects the offender.
   */
  private async askProtocolCorrection(
    taskId: string,
    senderAgentId: string,
    actual: string,
    expected: string[],
    attempt: number,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const message =
      `You sent "${actual}", which is not a valid move at the current protocol step. ` +
      `The expected message_type is one of [${expected.join(', ')}]. ` +
      `Please resend with a correct message_type. ` +
      `${MESSAGE_TYPE_MOTIVATION_REQUIREMENT} ` +
      `(correction attempt ${attempt}/${MAX_REGRESSION_RETRIES})`;

    this.recordTaskTranscript(task, {
      kind: 'system',
      from: 'system',
      to: senderAgentId,
      payload: message,
    });
    this.deps.emitTeamTask(task);

    try {
      await this.deps.sendProtocol(senderAgentId, 'EVT', {
        type: 'message_received',
        from: 'system',
        payload: message,
      });
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to ask ${senderAgentId} for protocol correction:`, err);
    }
  }

  private clearRegressionRetries(taskId: string): void {
    for (const key of this.regressionRetryCounts.keys()) {
      if (key.startsWith(`${taskId}:`)) {
        this.regressionRetryCounts.delete(key);
      }
    }
  }

  private isExpectingDiscussionPhase(taskId: string): boolean {
    const expected = this.taskExpectedResponses.get(taskId);
    return !!expected && expected.includes('opinion') && expected.includes('agreement_proposal');
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
