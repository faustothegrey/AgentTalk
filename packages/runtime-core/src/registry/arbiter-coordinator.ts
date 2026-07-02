import type { EventPayload } from '@agenttalk/contracts/protocol-payloads';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { Team, TeamTask } from '@agenttalk/contracts/types';
import { Agent } from '../agents/agent.js';
import { callApi } from '@agenttalk/llm-client/api-client.js';

export interface ArbiterCoordinatorDeps {
  getAgent: (id: string) => Agent;
  getTeam: (id: string) => Team | undefined;
  sendProtocol: (
    id: string,
    type: OutboundProtocolPacketType,
    payload: EventPayload,
  ) => Promise<void>;
  emitTeam: (team: Team) => void;
  emitTeamTask: (task: TeamTask) => void;
  logError: (message: string, err: unknown) => void;
  emitEvent?: (evt: any) => void;
}

const JUDGE_PROMPT = `You are the Arbiter Judge. Your goal is to evaluate if the planners have reached a formal agreement on the planning process.
The consensus-process-only frame (AS-T3b): Do not judge based on whether a downstream worker would accept it or whether the code is perfect, only whether the planners have fully agreed on a plan.

Output ONLY a JSON object matching this schema:
{
  "verdict": "advance-to:fact_collection" | "advance-to:discussion" | "advance-to:proposal" | "hold" | "fail-soft:<agent>" | "converged" | "not-converged",
  "rationale": "Explanation for why this verdict was chosen."
}

Verdict semantics:
- advance-to:*: Treat as a progress hint, continue debate.
- hold: Keep debating, not yet converged.
- fail-soft:<agent>: End debate with failure, blame <agent>.
- converged: Planners have reached consensus.
- not-converged: End debate with failure, no consensus.`;

const SYNTHESIS_PROMPT = `You are the Arbiter Synthesizer. The planners have reached a consensus.
Based on the transcript, author the final candidate plan that they agreed upon.
Output ONLY the plan in clear Markdown format, no JSON, no wrappers.`;

export class ArbiterCoordinator {
  private tasks: Map<string, TeamTask> = new Map();
  private turnCounts: Map<string, number> = new Map();
  private evaluatingTasks: Set<string> = new Set();

  constructor(private readonly deps: ArbiterCoordinatorDeps) {}

  async assignTask(team: Team, description: string, maxRepliesPerAgent: number): Promise<TeamTask> {
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
          payload: `Collaborative planning task (Arbiter Mode): ${description}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    this.turnCounts.set(task.id, 0);

    team.currentTaskId = task.id;
    team.status = 'planning';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    const prompt = [
      'You are in Arbiter Consensus Mode.',
      `Task: ${description}`,
      '',
      'Discuss the task with your peer planner using free-form natural language.',
      'There is no strict message_type protocol. Just communicate clearly.',
      'A judge will periodically evaluate your debate and finalize it when converged.',
    ].join('\n');

    for (const id of plannerIds) {
      try {
        await this.deps.sendProtocol(id, 'EVT', {
          type: 'message_received',
          from: 'system',
          payload: prompt,
        });
      } catch (err) {
        this.deps.logError(`[ArbiterCoordinator] Failed to send prompt to ${id}:`, err);
      }
    }

    return task;
  }

  getTask(taskId: string): TeamTask | undefined {
    return this.tasks.get(taskId);
  }

  async handlePlanningMessage(
    senderAgentId: string,
    team: Team,
    payload: unknown,
    replyToMessageId?: string,
  ): Promise<boolean> {
    if (team.composition !== 'planner-planner-worker' || !team.currentTaskId || team.consensusMode !== 'arbiter') {
      return false;
    }

    const task = this.tasks.get(team.currentTaskId);
    if (!task || task.status !== 'planning') {
      return false;
    }

    let currentTurns = this.turnCounts.get(task.id) ?? 0;
    const maxRepliesTotal = (task.maxRepliesPerAgent ?? 10) * 2;
    if (currentTurns >= maxRepliesTotal) {
       this.evaluateConvergence(team, task).catch(err => {
         this.deps.logError(`[ArbiterCoordinator] Evaluation failed for task ${task.id}:`, err);
       });
       return true;
    }

    this.turnCounts.set(task.id, currentTurns + 1);

    if (task.replyCounts) {
      task.replyCounts[senderAgentId] = (task.replyCounts[senderAgentId] ?? 0) + 1;
    }

    const messageText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const peerIds = team.members
      .filter((m) => m.role === 'planner' && m.agentId !== senderAgentId)
      .map((m) => m.agentId);

    const now = new Date().toISOString();
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
        this.deps.logError(`[ArbiterCoordinator] Failed to route msg to ${peerId}:`, err);
      }
    }

    this.deps.emitTeamTask(task);

    return true;
  }

  async handleAgentStatus(agentId: string, status: string) {
    if (status !== 'ready') return;

    for (const task of this.tasks.values()) {
      if (task.status !== 'planning') continue;

      const team = this.deps.getTeam(task.teamId);
      if (!team || team.consensusMode !== 'arbiter') continue;

      const planners = team.members.filter(m => m.role === 'planner');
      if (!planners.some(p => p.agentId === agentId)) continue;

      const allReady = planners.every(p => {
        const agent = this.deps.getAgent(p.agentId);
        return agent?.status === 'ready';
      });

      if (allReady) {
        this.evaluateConvergence(team, task).catch(err => {
            this.deps.logError(`[ArbiterCoordinator] Evaluation failed for task ${task.id}:`, err);
        });
      }
    }
  }

  private async evaluateConvergence(team: Team, task: TeamTask) {
    if (this.evaluatingTasks.has(task.id)) {
      return;
    }
    this.evaluatingTasks.add(task.id);

    try {
       const messages = task.transcript.map(t => ({
           role: (t.from === 'user' || t.from === 'system') ? 'system' : 'user',
           content: `[${t.from}]: ${t.payload}`
       }));

       messages.push({
           role: 'system',
           content: JUDGE_PROMPT
       });

       const res = await callApi({
           provider: 'openrouter',
           model: 'openai/gpt-4o-mini',
           messages,
           response_format: { type: 'json_object' }
       });

       task.arbiterJudgeUsage = {
           prompt_tokens: (task.arbiterJudgeUsage?.prompt_tokens ?? 0) + (res.usage?.prompt_tokens ?? 0),
           completion_tokens: (task.arbiterJudgeUsage?.completion_tokens ?? 0) + (res.usage?.completion_tokens ?? 0),
       };

       const response = JSON.parse(res.text);
       const verdict = response.verdict;
       const rationale = response.rationale;

       const now = new Date().toISOString();
       task.transcript.push({
         kind: 'system',
         timestamp: now,
         from: 'system',
         to: 'system',
         payload: `Arbiter verdict: ${verdict} (Rationale: ${rationale})`,
       });
       task.updatedAt = now;
       this.deps.emitTeamTask(task);

       if (verdict === 'converged') {
          await this.runSynthesis(team, task);
       } else if (verdict === 'not-converged' || String(verdict).startsWith('fail-soft:')) {
          this.failSoft(team, task, `Judge declared ${verdict}: ${rationale}`);
       } else {
          // hold or advance-to:*
          let currentTurns = this.turnCounts.get(task.id) ?? 0;
          const maxRepliesTotal = (task.maxRepliesPerAgent ?? 10) * 2;
          if (currentTurns >= maxRepliesTotal) {
             this.failSoft(team, task, 'Turn budget exhausted, no convergence');
          }
       }
    } catch (err) {
       this.deps.logError(`[ArbiterCoordinator] Error in judge call:`, err);
    } finally {
       this.evaluatingTasks.delete(task.id);
    }
  }

  private async runSynthesis(team: Team, task: TeamTask) {
       const messages = task.transcript.map(t => ({
           role: (t.from === 'user' || t.from === 'system') ? 'system' : 'user',
           content: `[${t.from}]: ${t.payload}`
       }));

       messages.push({
           role: 'system',
           content: SYNTHESIS_PROMPT
       });

       const res = await callApi({
           provider: 'openrouter',
           model: 'openai/gpt-4o-mini',
           messages
       });

       task.arbiterSynthesisUsage = {
           prompt_tokens: (task.arbiterSynthesisUsage?.prompt_tokens ?? 0) + (res.usage?.prompt_tokens ?? 0),
           completion_tokens: (task.arbiterSynthesisUsage?.completion_tokens ?? 0) + (res.usage?.completion_tokens ?? 0),
       };

       task.plan = res.text;

       const now = new Date().toISOString();
       task.transcript.push({
         kind: 'system',
         timestamp: now,
         from: 'system',
         to: 'system',
         payload: 'Arbiter synthesis completed. Plan generated.',
       });
       task.planningComplete = true;
       task.status = 'awaiting_confirmation';
       task.updatedAt = now;

       team.status = 'awaiting_confirmation';
       team.updatedAt = now;

       this.deps.emitTeam(team);
       this.deps.emitTeamTask(task);
  }

  private failSoft(team: Team, task: TeamTask, reason: string) {
    const now = new Date().toISOString();
    task.status = 'interrupted';
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'system',
      to: 'system',
      payload: `Arbiter failed-soft (not-converged): ${reason}`,
    });
    task.updatedAt = now;

    team.status = 'interrupted';
    team.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    if (this.deps.emitEvent) {
       this.deps.emitEvent({
         type: 'arbiter_fail_soft',
         taskId: task.id,
         reason,
       });
    }
  }

  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  async confirmPlan(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Arbiter task ${taskId} not found`);
    const team = this.deps.getTeam(task.teamId);
    if (!team) throw new Error(`Team ${task.teamId} not found`);

    if (task.status !== 'awaiting_confirmation') {
      throw new Error(`Cannot confirm plan: task status is ${task.status}`);
    }

    const worker = team.members.find(m => m.role === 'worker');
    if (!worker) throw new Error('Worker not found');

    task.planConfirmed = true;
    task.status = 'delegated';

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'user',
      to: worker.agentId,
      payload: 'Plan confirmed. Delegating to worker.',
    });

    team.status = 'working';
    team.updatedAt = now;
    task.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    const GIT_WORKTREE_REQUIREMENT = [
      'Execution requirement: use strictly `git worktree` for this task.',
      'If you cannot or will not use a git worktree, refuse the assignment and abort the task.',
    ].join(' ');

    await this.deps.sendProtocol(worker.agentId, 'EVT', {
      type: 'team_work_assign',
      teamId: team.id,
      taskId: task.id,
      role: 'worker',
      plan: `${task.plan!}\n\n${GIT_WORKTREE_REQUIREMENT}`,
      description: task.description,
    });
  }

  async rejectPlan(taskId: string, feedback: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Arbiter task ${taskId} not found`);
    const team = this.deps.getTeam(task.teamId);
    if (!team) throw new Error(`Team ${task.teamId} not found`);

    if (task.status !== 'awaiting_confirmation') {
      throw new Error(`Cannot reject plan: task status is ${task.status}`);
    }

    task.status = 'planning';
    task.planningComplete = false;
    delete task.plan;

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'system',
      timestamp: now,
      from: 'user',
      to: 'system',
      payload: `Plan rejected by operator: ${feedback}`,
    });

    team.status = 'planning';
    team.updatedAt = now;
    task.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);

    const planners = team.members.filter(m => m.role === 'planner');
    for (const planner of planners) {
      await this.deps.sendProtocol(planner.agentId, 'EVT', {
        type: 'message_received',
        from: 'user',
        payload: `Your plan was rejected. Feedback: ${feedback}\n\nPlease revise your plan and discuss further.`,
      });
    }
  }

  async sendUserMessage(taskId: string, targetRole: 'planner' | 'worker', message: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Arbiter task ${taskId} not found`);
    const team = this.deps.getTeam(task.teamId);
    if (!team) throw new Error(`Team ${task.teamId} not found`);
    const member = team.members.find(m => m.role === targetRole);
    if (!member) throw new Error(`Member with role ${targetRole} not found`);

    const now = new Date().toISOString();
    task.transcript.push({
      kind: 'message',
      timestamp: now,
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

  handleWorkResponse(agentId: string, team: Team, accepted: boolean, reason?: string): void {
    const task = this.getActiveTaskForWorker(agentId, team);

    if (task.status !== 'delegated') {
      throw new Error(`Cannot respond to work: task status is ${task.status}`);
    }

    task.workerAccepted = accepted;

    const now = new Date().toISOString();
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
    task.updatedAt = now;
    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  handleWorkResult(agentId: string, team: Team, result: string): void {
    const task = this.getActiveTaskForWorker(agentId, team);

    if (task.status !== 'in_progress') {
      throw new Error(`Cannot submit result: task status is ${task.status}`);
    }

    const now = new Date().toISOString();
    task.status = 'completed';
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
    task.updatedAt = now;

    this.deps.emitTeam(team);
    this.deps.emitTeamTask(task);
  }

  private getActiveTaskForWorker(agentId: string, team: Team): TeamTask {
    const worker = team.members.find((m) => m.role === 'worker');
    if (!worker || worker.agentId !== agentId) {
      throw new Error(`Agent ${agentId} is not the worker for team ${team.id}`);
    }

    if (!team.currentTaskId) {
      throw new Error(`Team ${team.id} has no active task`);
    }

    const task = this.getTask(team.currentTaskId);
    if (!task) {
      throw new Error(`Arbiter task ${team.currentTaskId} not found`);
    }

    return task;
  }
}
