import { EventEmitter } from 'events';
import { Agent } from '../agents/agent.js';
import { ConversationStore } from '../conversations/conversation-store.js';
import { HealthcheckManager } from '../agents/healthcheck-manager.js';
import { InProcessAgentDriver } from '../agents/in-process-driver.js';
import type { ApiProvider } from '../agents/api-client.js';
import { type Completer, ApiCompleter, CliExecCompleter } from '../agents/completer.js';
import type {
  EventPayload,
  ResponsePayload,
} from '@agenttalk/contracts/protocol-payloads';
import { serializeProtocolLine, type OutboundProtocolPacketType } from '../protocol/protocol.js';
import type {
  AgentExecutionMode,
  AgentStatus,
  Conversation,
  AgentSessionStatus,
  Team,
  TeamMember,
  TeamRole,
  TeamTask,
} from '@agenttalk/contracts/types';
import { ConversationCoordinator } from './conversation-coordinator.js';
import { TeamCoordinator } from './team-coordinator.js';
import { resolveRegistryConfig, type RegistryConfig } from './config.js';
import type { StructuredMessageType } from '../agents/response-schema.js';

function getExpectedResponseTypes(args: unknown): StructuredMessageType[] | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }

  const candidate = (args as Record<string, unknown>).expected_response_types;
  if (!Array.isArray(candidate)) {
    return undefined;
  }

  const allowed = new Set<StructuredMessageType>([
    'opinion',
    'agreement_proposal',
    'agreement_acceptance',
    'submit_plan',
    'fact_collection_end',
    'work_accept',
    'work_refuse',
    'healthcheck_ack',
  ]);

  if (!candidate.every((value) => typeof value === 'string' && allowed.has(value as StructuredMessageType))) {
    return undefined;
  }

  return candidate as StructuredMessageType[];
}

function includesPlanningExpectedResponseType(
  expectedResponseTypes: StructuredMessageType[] | undefined,
): boolean {
  if (!expectedResponseTypes || expectedResponseTypes.length === 0) {
    return false;
  }

  return expectedResponseTypes.some((value) =>
    value === 'opinion' ||
    value === 'agreement_proposal' ||
    value === 'agreement_acceptance' ||
    value === 'submit_plan',
  );
}

function getProposalText(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }
  const proposal = (args as Record<string, unknown>).proposal;
  return typeof proposal === 'string' ? proposal : undefined;
}

function getPlanningText(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }
  const text = (args as Record<string, unknown>).text;
  return typeof text === 'string' ? text : undefined;
}

export class Registry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private apiDrivers: Map<string, InProcessAgentDriver> = new Map();
  private readinessTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private idleCheckInterval: NodeJS.Timeout | undefined;
  private readonly conversations: ConversationStore;
  private readonly conversationCoordinator: ConversationCoordinator;
  private readonly teamCoordinator: TeamCoordinator;
  private readonly healthchecks = new HealthcheckManager();
  private readonly config: RegistryConfig;
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private outboundMessageSeq = 0;

  constructor(
    config: Partial<RegistryConfig> = {}
  ) {
    super();
    this.config = resolveRegistryConfig(config);
    this.conversations = new ConversationStore(this.config.conversationStorePath);
    this.conversations.load();
    this.conversationCoordinator = new ConversationCoordinator({
      conversations: this.conversations,
      getAgent: (id) => this.getAgent(id),
      requestHealthCheck: (agentId) => this.requestHealthCheck(agentId),
      sendProtocol: (id, type, payload) => this.sendProtocol(id, type, payload),
      emitConversation: (conversation) => this.emit('conversation', conversation),
      logError: (message, err) => console.error(message, err),
    });

    this.teamCoordinator = new TeamCoordinator({
      getAgent: (id) => this.getAgent(id),
      sendProtocol: (id, type, payload) => this.sendProtocol(id, type, payload),
      removeAgent: (id) => this.removeAgent(id),
      emitTeam: (team) => this.emit('team', team),
      emitTeamTask: (task) => this.emit('team_task', task),
      emitPlanningComplete: (payload) => this.emit('team_planning_complete', payload),
      logError: (message, err) => console.error(message, err),
    });

    this.idleCheckInterval = setInterval(() => this.checkIdleAgents(), 30000);

  }

  /**
   * Registers a new agent. Call activateAgent to mark it ready for an inbound MCP connection.
   */
  async createAgent(
    id: string,
    options: {
      requestedExecutionMode?: AgentExecutionMode;
      provider?: string;
      providerName?: string;
      model?: string;
    } = {}
  ): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} already exists`);
    }

    console.log(`[Registry] Creating agent ${id}...`);
    const agent = new Agent(id);
    if (options.requestedExecutionMode) {
      agent.requestedExecutionMode = options.requestedExecutionMode;
    }
    if (options.provider) agent.provider = options.provider;
    if (options.providerName) agent.providerName = options.providerName;
    if (options.model) agent.model = options.model;
    
    this.agents.set(id, agent);
    return agent;
  }

  async startConversation(agentIds: string[], topic: string, maxRepliesPerAgent: number): Promise<Conversation> {
    return this.conversationCoordinator.startConversation(agentIds, topic, maxRepliesPerAgent);
  }

  /**
   * Updates the agent status and logs the transition.
   * Also emits a status event for the UI.
   */
  private setAgentStatus(agent: Agent, newStatus: AgentStatus): void {
    const oldStatus = agent.status;
    agent.setStatus(newStatus);
    this.emit('status', { id: agent.id, status: newStatus });

    if (newStatus === 'error' && oldStatus !== 'error') {
      void this.teamCoordinator.handleAgentFailure(agent.id);
    }
  }

  /**
   * Activates the agent and waits for an MCP connection.
   */
  async activateAgent(
    id: string,
    provider?: string,
    model?: string,
    requestedExecutionMode?: AgentExecutionMode,
  ): Promise<void> {
    const agent = this.getAgent(id);
    console.log(`[Registry] Activating agent ${id} (waiting for MCP connection)`);
    this.clearReadinessTimeout(id);

    this.setAgentStatus(agent, 'starting');
    agent.requestedExecutionMode = requestedExecutionMode ?? agent.requestedExecutionMode;
    agent.sessionStatus = 'starting';
    delete agent.resolvedExecutionMode;

    if (provider) agent.provider = provider;
    if (model) agent.model = model;

    this.emit('execution_mode', {
      id: agent.id,
      requestedExecutionMode: agent.requestedExecutionMode,
      resolvedExecutionMode: agent.resolvedExecutionMode,
    });
    this.emit('session_status', {
      id: agent.id,
      sessionStatus: agent.sessionStatus,
    });
    if (provider) this.emit('provider', { id: agent.id, provider });
    if (model) this.emit('model', { id: agent.id, model });

    if (agent.provider === 'api' || agent.provider === 'cli-exec') {
      console.log(`[Registry] Starting InProcessAgentDriver for ${agent.provider}-backed agent ${id}`);
      let completer: Completer;
      if (agent.provider === 'api') {
        const apiProvider = (agent.providerName || 'google') as ApiProvider;
        completer = new ApiCompleter(apiProvider, agent.model);
      } else {
        completer = new CliExecCompleter(agent, this);
      }
      
      const driver = new InProcessAgentDriver(agent, this, {
        completer
      });
      this.apiDrivers.set(agent.id, driver);
      driver.start();
      return;
    }

    // Setup readiness timeout
    const timeout = setTimeout(() => {
      if (agent.status === 'starting') {
        console.error(`[Registry] Agent ${id} readiness timeout reached (${this.config.readinessTimeoutMs}ms)`);
        this.setAgentStatus(agent, 'error');
      }
      this.readinessTimeouts.delete(id);
    }, this.config.readinessTimeoutMs);
    this.readinessTimeouts.set(id, timeout);
  }

  /**
   * Requests detailed usage statistics from a Gemini agent.
   */
  async requestUsageStats(id: string): Promise<void> {
    const agent = this.getAgent(id);
    if (agent.status !== 'ready' && agent.status !== 'busy') {
      throw new Error(`Agent ${id} is not in a state to provide usage stats (status: ${agent.status})`);
    }

    console.log(`[Registry] Requesting detailed usage stats from agent ${id}`);
    await this.sendProtocol(agent.id, 'EVT', {
      id: `usage-${Date.now()}`,
      type: 'get_usage_stats',
    } as any);
  }

  /**
   * Removes an agent from the registry and kills its process.
   */
  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;

    console.log(`[Registry] Removing agent ${id}...`);

    this.clearReadinessTimeout(id);

    try {
      this.setAgentStatus(agent, 'terminated');
    } catch (err) {
      // If already terminated, this might throw, which is fine for removal.
    }

    this.agents.delete(id);
    const driver = this.apiDrivers.get(id);
    if (driver) {
      driver.stop();
      this.apiDrivers.delete(id);
    }
    await agent.destroy();
  }

  private isDuplicateTerminalAction(agent: Agent): boolean {
    if (agent.currentTurnId && agent.processedTurnIds.has(agent.currentTurnId)) {
      console.log(`[Registry] Deduplicating terminal action for turn ${agent.currentTurnId}`);
      this.markTerminalActionComplete(agent);
      agent.activeTurn = undefined;
      return true;
    }
    return false;
  }

  private markTerminalActionComplete(agent: Agent): void {
    if (agent.currentTurnId) {
      agent.processedTurnIds.add(agent.currentTurnId);
    }
    agent.currentTurnId = undefined;
    agent.activeTurn = undefined;
  }

  async handleMcpToolCall(agentId: string, name: string, args: any): Promise<any> {
    console.log(`[Registry] MCP tool call from ${agentId}: ${name}`, args);
    this.emit('mcp_tool_call', { agentId, name, args });
    const agent = this.getAgent(agentId);

    switch (name) {
      case 'list_agents': {
        const agentList = this.getAgents().map(a => ({
          id: a.id,
          status: a.status,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify({ agents: agentList }, null, 2) }]
        };
      }

      case 'await_turn': {
        const turn = agent.provider === 'cli-exec' ? await agent.awaitExecTurn() : await agent.awaitTurn();
        if (turn.turnId) {
          agent.currentTurnId = turn.turnId as string;
        } else if (turn.messageId) {
          agent.currentTurnId = turn.messageId as string;
        }
        return { content: [{ type: 'text', text: JSON.stringify(turn) }] };
      }

      case 'send_to_agent': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const { to, payload, replyToMessageId } = args;
        const expectedResponseTypes = getExpectedResponseTypes(args);

        if (to === 'user') {
          this.setAgentBusyState(agent, false);
          this.emit('user_message', { from: agent.id, payload });
          this.markTerminalActionComplete(agent);
          return { content: [{ type: 'text', text: 'Message sent to user successfully' }] };
        }

        // Brainstorm/Planning routing
        const brainstormHandled = await this.teamCoordinator.handleBrainstormMessage(agent.id, payload, replyToMessageId);
        if (brainstormHandled) {
          this.markTerminalActionComplete(agent);
          return { content: [{ type: 'text', text: 'Brainstorm message routed successfully' }] };
        }

        const planningHandled = await this.teamCoordinator.handlePlanningMessage(
          agent.id,
          payload,
          replyToMessageId,
          expectedResponseTypes,
        );
        if (planningHandled) {
          this.markTerminalActionComplete(agent);
          return { content: [{ type: 'text', text: 'Planning message routed successfully' }] };
        }

        const senderTeam = this.teamCoordinator.findTeamByAgent(agent.id);
        if (
          senderTeam &&
          senderTeam.composition === 'planner-planner-worker' &&
          !senderTeam.currentTaskId &&
          includesPlanningExpectedResponseType(expectedResponseTypes)
        ) {
          throw new Error(`Planning task is not active for team ${senderTeam.id}; cannot route planning messages.`);
        }

        const targetAgent = this.getAgent(to);
        const conversation = this.findActiveConversationByAgents(agent.id, to);

        if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
          throw new Error(`Target agent ${to} is in ${targetAgent.status} state`);
        }

        if (conversation) {
          const currentCount = conversation.replyCounts[agent.id] ?? 0;
          if (currentCount >= conversation.maxRepliesPerAgent) {
            this.conversationCoordinator.markConversationCompleted(conversation, `Reply cap reached by ${agent.id}`);
            throw new Error(`Conversation ${conversation.id} reply cap reached for ${agent.id}`);
          }
        }

        // Delivery: write EVT to target process stdin
        await this.sendProtocol(targetAgent.id, 'EVT', {
          type: 'message_received',
          from: agent.id,
          payload: payload,
          ...(replyToMessageId ? { replyToMessageId } : {}),
        });

        if (conversation) {
          this.conversationCoordinator.recordConversationMessage(conversation, {
            kind: 'message',
            from: agent.id,
            to,
            payload: String(payload),
            timestamp: new Date().toISOString(),
          });
        }

        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Message sent successfully' }] };
      }

      case 'agreement_proposal': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const expectedResponseTypes = getExpectedResponseTypes(args);
        const proposal = getProposalText(args) || args.proposal;
        await this.teamCoordinator.handleAgreementProposal(
          agent.id,
          expectedResponseTypes,
          proposal,
        );
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Agreement proposal submitted successfully' }] };
      }

      case 'agreement_acceptance': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const expectedResponseTypes = getExpectedResponseTypes(args);
        const proposal = getProposalText(args) || args.proposal;
        await this.teamCoordinator.handleAgreementReached(
          agent.id,
          expectedResponseTypes,
          proposal,
        );
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Agreement acceptance submitted successfully' }] };
      }

      case 'ack_planning_protocol': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        await this.teamCoordinator.handlePlanningProtocolAck(agent.id);
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Planning protocol acknowledged' }] };
      }

      case 'fact_collection_end': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        await this.teamCoordinator.handleFactCollectionEnd(agent.id, args.summary);
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Fact collection ended successfully' }] };
      }

      case 'submit_plan': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        this.teamCoordinator.handlePlanSubmitted(agent.id, args.plan, getProposalText(args) || args.proposal, getPlanningText(args) || args.text);
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Plan submitted successfully' }] };
      }

      case 'submit_work_response': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        this.teamCoordinator.handleWorkResponse(agent.id, args.accepted, args.reason);
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Work response submitted successfully' }] };
      }

      case 'submit_work_result': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        this.teamCoordinator.handleWorkResult(agent.id, args.result);
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Work result submitted successfully' }] };
      }

      case 'submit_exec_result': {
        this.emit('exec_result', { agentId: agent.id, text: args.text, usage: args.usage });
        return { content: [{ type: 'text', text: 'Exec result submitted successfully' }] };
      }

      case 'submit_usage_stats': {
        agent.usageStats = {
          stats: args.stats,
          timestamp: args.timestamp,
        };
        this.emit('usage_stats', { id: agent.id, usageStats: agent.usageStats });
        return { content: [{ type: 'text', text: 'Usage stats updated successfully' }] };
      }

      default:
        throw new Error(`Unknown MCP tool call: ${name}`);
    }
  }

  /**
   * Sends a protocol packet to an agent's stdin.
   * V1 Protocol Rule: [AgentTalk]:TYPE:JSON\n
   */
  async sendProtocol(id: string, type: OutboundProtocolPacketType, payload: EventPayload | ResponsePayload): Promise<void> {
    this.getAgent(id); // validates agent exists
    const normalizedPayload = this.normalizeOutboundPayload(type, payload);
    const line = serializeProtocolLine(type, normalizedPayload);
    
    const agent = this.getAgent(id);
    agent.appendToTranscript(`> ${line}\n`);
    console.log(`[Registry] Sending ${type} to agent ${id}: ${JSON.stringify(normalizedPayload)}`);

    if (type === 'EVT') {
      const evtPayload = normalizedPayload as EventPayload;
      
      // Enqueue the full event payload into the agent's turn queue.
      // For legacy client compat (attach-harness.mjs), we alias payload -> message and messageId -> turnId
      // However, the new client llm-agent.mjs expects the exact evtPayload fields.
      const turnPayload: Record<string, unknown> = { ...evtPayload };
      
      if ('payload' in evtPayload && typeof evtPayload.payload === 'string') {
        turnPayload.message = evtPayload.payload;
      } else if ('prompt' in evtPayload && typeof evtPayload.prompt === 'string') {
        turnPayload.message = evtPayload.prompt;
      }
      
      if ('messageId' in evtPayload) {
        turnPayload.turnId = evtPayload.messageId;
      }
      
      agent.queueTurn(turnPayload);
    }
  }

  private normalizeOutboundPayload(
    type: OutboundProtocolPacketType,
    payload: EventPayload | ResponsePayload,
  ): EventPayload | ResponsePayload {
    if (type !== 'EVT' || !('type' in payload) || payload.type !== 'message_received') {
      return payload;
    }

    if (typeof payload.messageId === 'string' && payload.messageId.length > 0) {
      return payload;
    }

    return {
      ...payload,
      messageId: this.createOutboundMessageId(),
    };
  }

  private createOutboundMessageId(): string {
    this.outboundMessageSeq = (this.outboundMessageSeq + 1) % Number.MAX_SAFE_INTEGER;
    return `msg-${Date.now()}-${this.outboundMessageSeq}`;
  }

  private setAgentBusyState(agent: Agent, busy: boolean): void {
    this.updateAgentSessionStatus(agent, busy ? 'busy' : 'ready');

    if (busy && agent.status === 'ready') {
      this.setAgentStatus(agent, 'busy');
      return;
    }

    if (!busy && agent.status === 'busy') {
      this.setAgentStatus(agent, 'ready');
    }
  }

  private updateAgentSessionStatus(agent: Agent, sessionStatus: AgentSessionStatus): void {
    if (agent.sessionStatus === sessionStatus) {
      return;
    }

    agent.sessionStatus = sessionStatus;
    this.emit('session_status', {
      id: agent.id,
      sessionStatus,
    });
  }

  private async requestHealthCheck(agentId: string): Promise<{ agentId: string; message: unknown }> {
    const { token, result } = this.healthchecks.create(agentId, this.config.healthcheckTimeoutMs);

    await this.sendProtocol(agentId, 'EVT', {
      type: 'healthcheck',
      token,
      prompt: 'Reply with a short greeting confirming you are responsive.',
    });

    const ack = await result;
    console.log(`[Registry] Healthcheck ack from ${agentId}: ${JSON.stringify(ack.message)}`);
    return ack;
  }

  private hasAgentTimedOut(agent: Agent): boolean {
    if (agent.status !== 'busy') {
      return false;
    }

    // Disable idle timeout while fact checking
    if (this.teamCoordinator.isAgentFactCollecting(agent.id)) {
      return false;
    }

    if (!agent.lastProgressAt) {
      return false;
    }

    return Date.now() - agent.lastProgressAt > this.config.agentIdleTimeoutMs;
  }

  private checkIdleAgents(): void {
    for (const [id, agent] of this.agents) {
      if (this.hasAgentTimedOut(agent)) {
        console.error(`[Registry] Agent ${id} exceeded idle timeout (${this.config.agentIdleTimeoutMs}ms) while ${agent.status}`);
        this.clearReadinessTimeout(id);
        this.setAgentStatus(agent, 'error');
      }
    }
  }

  getConversations(): Conversation[] {
    return this.conversationCoordinator.getConversations();
  }

  removeConversation(id: string): boolean {
    return this.conversationCoordinator.removeConversation(id);
  }

  private findActiveConversationByAgents(agentIds: string[] | string, maybeTo?: string): Conversation | undefined {
    return this.conversationCoordinator.findActiveConversationByAgents(agentIds, maybeTo);
  }

  private clearReadinessTimeout(id: string): void {
    const timeout = this.readinessTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.readinessTimeouts.delete(id);
    }
  }

  /**
   * Returns all active agents.
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(id: string): Agent {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    return agent;
  }

  // ── Team methods ──────────────────────────────────────────────

  createTeam(members: TeamMember[], provider?: string): Team {
    return this.teamCoordinator.createTeam(members, provider);
  }

  async assignTeamTask(teamId: string, description: string, maxRepliesPerAgent?: number): Promise<TeamTask> {
    return this.teamCoordinator.assignTask(teamId, description, maxRepliesPerAgent);
  }

  async confirmTeamPlan(taskId: string): Promise<void> {
    return this.teamCoordinator.confirmPlan(taskId);
  }

  async rejectTeamPlan(taskId: string, feedback: string): Promise<void> {
    return this.teamCoordinator.rejectPlan(taskId, feedback);
  }

  async sendTeamMessage(taskId: string, targetRole: TeamRole, message: string): Promise<void> {
    return this.teamCoordinator.sendUserMessage(taskId, targetRole, message);
  }

  async sendScheduledMessage(agentId: string, prompt: string): Promise<void> {
    const agent = this.getAgent(agentId);
    if (agent.status !== 'ready' && agent.status !== 'busy') {
      throw new Error(`Agent ${agentId} is not ready for scheduled execution (status: ${agent.status})`);
    }

    await this.sendProtocol(agentId, 'EVT', {
      type: 'message_received',
      from: 'scheduler',
      payload: prompt,
    });
  }

  handleMcpDisconnect(agentId: string, code?: number, reason?: string): void {
    const agent = this.agents.get(agentId);
    if (agent && agent.status !== 'terminated') {
      this.clearReadinessTimeout(agentId);

      // Drop await_turn waiters bound to this dead socket so a stale resolver can't eat
      // the first turn delivered after a reconnect.
      const droppedWaiters = agent.clearTurnWaiters();
      if (droppedWaiters > 0) {
        console.log(`[Registry] Cleared ${droppedWaiters} stale await_turn waiter(s) for agent ${agentId}`);
      }

        // If the harness exited cleanly (e.g. SIGINT), it sends 1000.
        // If it exited due to a CLI error, we will configure it to send 1011.
        if (code === 1000 || code === 1001 || code === 1005) {
          console.log(`[Registry] MCP connection closed cleanly for agent ${agentId} (code ${code}) -> terminated`);
          try { this.setAgentStatus(agent, 'terminated'); } catch {}
          return;
        }

        if (code === 1011) {
          console.warn(`[Registry] MCP connection closed with internal error for agent ${agentId} -> error. Reason: ${reason}`);
          try { this.setAgentStatus(agent, 'error'); } catch {}
          return;
        }

        // For other abnormal closures (e.g. 1006 transport drop), give it a grace period to reconnect
        console.warn(`[Registry] MCP connection dropped for agent ${agentId} (code ${code}). Allowing 30s reconnect...`);
        
        if (agent.activeTurn) {
          console.log(`[Registry] Requeuing interrupted turn ${agent.currentTurnId} for agent ${agentId}`);
          agent.queueTurn(agent.activeTurn, true);
          agent.activeTurn = undefined;
        }

        try { this.setAgentStatus(agent, 'reconnecting'); } catch {}

        const timer = setTimeout(() => {
          this.reconnectTimeouts.delete(agentId);
          const target = agent.currentTurnId ? 'error' : 'terminated';
          console.warn(`[Registry] Reconnect timeout expired for agent ${agentId} (in-flight turn: ${agent.currentTurnId ?? 'none'}) -> ${target}`);
          try {
            this.setAgentStatus(agent, target);
          } catch {}
        }, 30000);
        this.reconnectTimeouts.set(agentId, timer);
    }
  }

  handleMcpConnect(agentId: string): void {
    const timer = this.reconnectTimeouts.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimeouts.delete(agentId);
      console.log(`[Registry] Agent ${agentId} reconnected, cleared reconnect timeout.`);
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      // In attach mode, the UI might not have pre-created it if it was fully headless,
      // but usually the UI creates the agent. For now, enforce that it must exist.
      throw new Error(`Agent ${agentId} is not registered`);
    }

    if (agent.status === 'terminated' || agent.status === 'error') {
      throw new Error(`Agent ${agentId} is in terminal state: ${agent.status}`);
    }

    if (agent.status === 'starting' || agent.status === 'reconnecting') {
      this.setAgentStatus(agent, agent.currentTurnId ? 'busy' : 'ready');
      this.clearReadinessTimeout(agentId);
    }
  }

  getTeams(): Team[] {
    return this.teamCoordinator.getTeams();
  }

  /**
   * Cleanup all agents and polling loops.
   */
  async destroy(): Promise<void> {
    this.conversations.persist();
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = undefined;
    }
    this.healthchecks.destroy('Registry destroyed before healthcheck completed');
    const teardowns: Promise<void>[] = [];
    for (const id of this.agents.keys()) {
      this.clearReadinessTimeout(id);
      const driver = this.apiDrivers.get(id);
      if (driver) {
        driver.stop();
        this.apiDrivers.delete(id);
      }
      const agent = this.agents.get(id);
      if (agent) teardowns.push(agent.destroy());
    }
    this.agents.clear();
    await Promise.all(teardowns);
  }
}
