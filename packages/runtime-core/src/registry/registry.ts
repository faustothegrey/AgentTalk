import { EventEmitter } from 'events';
import { Agent } from '../agents/agent.js';
import { ConversationStore } from '../conversations/conversation-store.js';
import { HealthcheckManager } from '../agents/healthcheck-manager.js';
import { InProcessAgentDriver } from '../agents/in-process-driver.js';
import { type Completer, type ApiProvider, ApiCompleter } from '@agenttalk/llm-client';
import { McpCompleter } from '../agents/completer.js';
import type {
  EventPayload,
  ResponsePayload,
} from '@agenttalk/contracts/protocol-payloads';
import { serializeProtocolLine, type OutboundProtocolPacketType } from '../protocol/protocol.js';
import type {
  AgentExecutionMode,
  AgentProvider,
  AgentStatus,
  Conversation,
  AgentSessionStatus,
  Team,
  TeamMember,
  TeamRole,
  TeamTask,
  WorkflowRole,
  RelayApprovalMode,
  PendingRelay,
  WorkflowBatonMetadata,
  WorkflowGateEvent,
} from '@agenttalk/contracts/types';
import { ConversationCoordinator } from './conversation-coordinator.js';
import { TeamCoordinator } from './team-coordinator.js';
import { ArbiterCoordinator } from './arbiter-coordinator.js';
import { resolveRegistryConfig, type RegistryConfig } from './config.js';
import { type StructuredMessageType, buildProtocolToolSchema } from '../agents/response-schema.js';

function getExpectedResponseTypes(args: unknown): StructuredMessageType[] | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }

  let candidate = (args as Record<string, unknown>).expected_response_types;
  if (!candidate && (args as Record<string, unknown>).payload && typeof (args as Record<string, unknown>).payload === 'object') {
    candidate = ((args as Record<string, unknown>).payload as Record<string, unknown>).expected_response_types;
  }
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
  let proposal = (args as Record<string, unknown>).proposal;
  if (!proposal && (args as Record<string, unknown>).payload && typeof (args as Record<string, unknown>).payload === 'object') {
    proposal = ((args as Record<string, unknown>).payload as Record<string, unknown>).proposal;
  }
  return typeof proposal === 'string' ? proposal : undefined;
}

function getPlanningText(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }
  let text = (args as Record<string, unknown>).text;
  if (!text && (args as Record<string, unknown>).payload && typeof (args as Record<string, unknown>).payload === 'object') {
    text = ((args as Record<string, unknown>).payload as Record<string, unknown>).text;
  }
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
  private readonly arbiterCoordinator: ArbiterCoordinator;
  private readonly healthchecks = new HealthcheckManager();
  private readonly config: RegistryConfig;
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private outboundMessageSeq = 0;
  private relayApprovalMode: RelayApprovalMode = 'off';
  private pendingRelays = new Map<string, PendingRelay>();
  private pendingRelaySeq = 0;

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
      onPhaseChange: (evt) => this.emit('team_planning_phase', evt),
      onProtocolEvent: (evt) => this.emit('team_protocol_event', evt),
      logError: (message, err) => console.error(message, err),
    });

    this.arbiterCoordinator = new ArbiterCoordinator({
      getAgent: (id) => this.getAgent(id),
      getTeam: (id) => this.getTeams().find(t => t.id === id),
      sendProtocol: (id, type, payload) => this.sendProtocol(id, type, payload),
      emitTeam: (team) => this.emit('team', team),
      emitTeamTask: (task) => this.emit('team_task', task),
      logError: (message, err) => console.error(message, err),
      emitEvent: (evt) => this.emit('arbiter_event', evt),
    });

    this.on('status', (evt) => {
      this.arbiterCoordinator?.handleAgentStatus(evt.id, evt.status);
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
      provider?: AgentProvider;
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
    provider?: AgentProvider,
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

    if (agent.provider === 'api' || agent.provider === 'mcp' || agent.provider === 'gemini' || agent.provider === 'claude' || agent.provider === 'codex') {
      console.log(`[Registry] Starting InProcessAgentDriver for ${agent.provider}-backed agent ${id}`);
      let completer: Completer;
      if (agent.provider === 'api') {
        const apiProvider = (agent.providerName || 'google') as ApiProvider;
        // Inject the consensus protocol tool builder so structured turns are constrained exactly as
        // before the llm-client extraction (the package itself stays consensus-agnostic).
        completer = new ApiCompleter(apiProvider, agent.model, undefined, buildProtocolToolSchema);
      } else {
        completer = new McpCompleter(agent, this);
      }
      
      const driver = new InProcessAgentDriver(agent, this, {
        completer
      });
      this.apiDrivers.set(agent.id, driver);
      driver.start();
      return;
    }

    throw new Error(`Provider-less or unknown agents are no longer supported: ${agent.provider}`);
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

  /**
   * M08 fault-tolerance: a consensus protocol violation (a model sent a wrong/late planning
   * message) must be REJECTED softly — not allowed to throw, which would propagate to the
   * InProcessAgentDriver, mark the agent `error`, and trip M03 Shared Fate to kill the whole
   * (often already-successful) team task. The action is discarded; the agent stays alive.
   * (Richer handling — re-prompting the model to produce a valid transition — is deferred to the
   * M08 failure-modes milestone; this is the tactical "don't crash the team" unblocker.)
   */
  private softProtocolReject(toolName: string, agentId: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Registry] Protocol violation from ${agentId} on ${toolName} — action rejected, agent kept alive: ${msg}`);
    return { content: [{ type: 'text', text: `Protocol violation (rejected, discarded): ${msg}` }], isError: true };
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
        const turn = (agent.provider === 'mcp' || agent.provider === 'gemini' || agent.provider === 'claude' || agent.provider === 'codex') ? await agent.awaitExecTurn() : await agent.awaitTurn();
        if (turn.turnId) {
          agent.currentTurnId = turn.turnId as string;
        } else if (turn.messageId) {
          agent.currentTurnId = turn.messageId as string;
        }
        return { content: [{ type: 'text', text: JSON.stringify(turn) }] };
      }

      case 'healthcheck_ack': {
        const { token, message } = args;
        if (typeof token !== 'string') {
          throw new Error('Missing or invalid token in healthcheck_ack');
        }
        const resolved = this.healthchecks.resolve(token, agent.id, message);
        if (!resolved) {
          throw new Error(`Invalid or stale healthcheck token for agent ${agent.id}`);
        }
        return { content: [{ type: 'text', text: 'Healthcheck acknowledged successfully' }] };
      }

      case 'send_to_agent': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const { to, payload, replyToMessageId, baton, workflowEvent } = args;
        const expectedResponseTypes = getExpectedResponseTypes(args);

        if (workflowEvent && workflowEvent.kind === 'workflow_gate_event') {
          try {
            if (workflowEvent.action === 'po-act' || workflowEvent.originTag === '[PO]' || workflowEvent.originTag === '[Human]') {
              throw new Error(`Unauthorized: PO-level workflow events can only originate from trusted human/API paths`);
            }
            if (workflowEvent.originTag === '[SM]' && agent.workflowRole !== 'scrum-master') {
              throw new Error(`Unauthorized: Agent ${agent.id} is not assigned the scrum-master workflow role`);
            }
            if (workflowEvent.fromRole && agent.workflowRole !== workflowEvent.fromRole) {
               throw new Error(`Unauthorized: Agent ${agent.id} is assigned role ${agent.workflowRole || 'none'}, cannot act as ${workflowEvent.fromRole}`);
            }
          } catch (err: any) {
            this.emit('workflow_gate_attempt', { agentId: agent.id, event: workflowEvent, result: 'refused', reason: err.message, payload });
            throw err;
          }
          this.emit('workflow_gate_attempt', { agentId: agent.id, event: workflowEvent, result: 'accepted', payload });
        }

        if (to === 'user') {
          this.setAgentBusyState(agent, false);
          this.emit('user_message', { from: agent.id, payload });
          this.markTerminalActionComplete(agent);
          return { content: [{ type: 'text', text: 'Message sent to user successfully' }] };
        }



        const senderTeam = this.teamCoordinator.findTeamByAgent(agent.id);
        if (senderTeam && senderTeam.consensusMode === 'arbiter' && senderTeam.composition === 'planner-planner-worker') {
             await this.arbiterCoordinator.handlePlanningMessage(agent.id, senderTeam, payload, replyToMessageId);
             this.markTerminalActionComplete(agent);
             return { content: [{ type: 'text', text: 'Message sent successfully' }] };
        }

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

        this.assertRelayDeliverable(agent.id, targetAgent, conversation);

        if (this.relayApprovalMode === 'approve_each') {
          const relay = this.createPendingRelay({
            fromAgentId: agent.id,
            toAgentId: to,
            payload,
            replyToMessageId,
            baton,
            workflowEvent,
          });
          this.markTerminalActionComplete(agent);
          return { content: [{ type: 'text', text: `Message pending PO approval (${relay.id})` }] };
        }

        await this.deliverRelayMessage({
          fromAgentId: agent.id,
          toAgentId: to,
          payload,
          replyToMessageId,
          baton,
          workflowEvent,
          targetAgent,
          conversation,
        });

        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Message sent successfully' }] };
      }

      case 'consensus_respond': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const { action, payload } = args;
        const expectedResponseTypes = getExpectedResponseTypes(args);
        
        const team = this.teamCoordinator.findTeamByAgent(agent.id);
        if (team && team.consensusMode === 'arbiter' && team.composition === 'planner-planner-worker') {
            await this.arbiterCoordinator.handlePlanningMessage(agent.id, team, payload || args, payload?.replyToMessageId);
            this.markTerminalActionComplete(agent);
            return { content: [{ type: 'text', text: `Action ${action} submitted successfully` }] };
        }

        try {
          switch (action) {
            case 'opinion':
              await this.teamCoordinator.handlePlanningMessage(agent.id, getPlanningText(args) || payload?.text, payload?.replyToMessageId, expectedResponseTypes);
              break;
            case 'agreement_proposal':
              await this.teamCoordinator.handleAgreementProposal(agent.id, expectedResponseTypes, getProposalText(args) || payload?.proposal);
              break;
            case 'agreement_acceptance':
              await this.teamCoordinator.handleAgreementReached(agent.id, expectedResponseTypes, getProposalText(args) || payload?.proposal);
              break;
            case 'ack_planning_protocol':
              await this.teamCoordinator.handlePlanningProtocolAck(agent.id);
              break;
            case 'fact_collection_end':
              await this.teamCoordinator.handleFactCollectionEnd(agent.id, payload?.summary);
              break;
            case 'submit_plan':
              this.teamCoordinator.handlePlanSubmitted(agent.id, payload?.plan, getProposalText(args) || payload?.proposal, getPlanningText(args) || payload?.text);
              break;
            default:
              return this.softProtocolReject('consensus_respond', agent.id, new Error(`Illegal action: ${action}`));
          }
        } catch (err) {
          return this.softProtocolReject(action || 'consensus_respond', agent.id, err);
        }
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: `Action ${action} submitted successfully` }] };
      }

      case 'submit_work_response': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const team = this.teamCoordinator.findTeamByAgent(agent.id);
        if (team && team.consensusMode === 'arbiter' && team.composition === 'planner-planner-worker') {
          this.arbiterCoordinator.handleWorkResponse(agent.id, team, args.accepted, args.reason);
        } else {
          this.teamCoordinator.handleWorkResponse(agent.id, args.accepted, args.reason);
        }
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Work response submitted successfully' }] };
      }

      case 'submit_work_result': {
        if (this.isDuplicateTerminalAction(agent)) return { content: [{ type: 'text', text: 'Action accepted (deduplicated)' }] };
        const team = this.teamCoordinator.findTeamByAgent(agent.id);
        if (team && team.consensusMode === 'arbiter' && team.composition === 'planner-planner-worker') {
          this.arbiterCoordinator.handleWorkResult(agent.id, team, args.result);
        } else {
          this.teamCoordinator.handleWorkResult(agent.id, args.result);
        }
        this.markTerminalActionComplete(agent);
        return { content: [{ type: 'text', text: 'Work result submitted successfully' }] };
      }

      case 'submit_exec_result': {
        // M08-T2: the in-flight exec turn completed normally — clear it so a later disconnect
        // doesn't spuriously re-deliver an already-finished turn.
        agent.activeExecTurn = undefined;
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
      if (evtPayload.type === 'conversation_end' && this.agentUsesExecTurns(agent)) {
        agent.queueExecTurn(turnPayload);
      }
    }
  }

  private agentUsesExecTurns(agent: Agent): boolean {
    return agent.provider === 'mcp' || agent.provider === 'gemini' || agent.provider === 'claude' || agent.provider === 'codex';
  }

  private isConversationEndTurn(turn: Record<string, unknown> | undefined): boolean {
    return turn?.type === 'conversation_end';
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
      timeoutMs: this.config.healthcheckTimeoutMs,
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

    // M08-T3: disable idle timeout for a worker whose task is paused awaiting the
    // operator (effect-fence). A paused-but-alive worker must not be flagged as
    // errored — that would trip the M03 kill, the opposite of "kill nobody".
    if (this.teamCoordinator.isTaskAwaitingOperator(agent.id)) {
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

  getRelayApprovalMode(): RelayApprovalMode {
    return this.relayApprovalMode;
  }

  setRelayApprovalMode(mode: RelayApprovalMode): void {
    this.relayApprovalMode = mode;
    this.emit('relay_approval_mode', { mode });
  }

  listPendingRelays(): PendingRelay[] {
    return Array.from(this.pendingRelays.values())
      .map((relay) => ({ ...relay }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getPendingRelay(id: string): PendingRelay {
    const relay = this.pendingRelays.get(id);
    if (!relay) {
      throw new Error(`Pending relay ${id} not found`);
    }
    return relay;
  }

  async approvePendingRelay(id: string): Promise<PendingRelay> {
    const relay = this.getPendingRelay(id);
    if (relay.status !== 'pending') {
      throw new Error(`Pending relay ${id} is already ${relay.status}`);
    }

    const decidedAt = new Date().toISOString();
    try {
      const targetAgent = this.getAgent(relay.toAgentId);
      const conversation = this.findActiveConversationByAgents(relay.fromAgentId, relay.toAgentId);
      this.assertRelayDeliverable(relay.fromAgentId, targetAgent, conversation);
      await this.deliverRelayMessage({
        ...relay,
        targetAgent,
        conversation,
      });
      relay.status = 'approved_delivered';
      relay.decidedAt = decidedAt;
      relay.deliveredAt = new Date().toISOString();
      delete relay.deliveryError;
    } catch (err) {
      relay.status = 'delivery_failed';
      relay.decidedAt = decidedAt;
      relay.deliveryError = err instanceof Error ? err.message : String(err);
    }

    this.emitPendingRelay(relay);
    return relay;
  }

  denyPendingRelay(id: string): PendingRelay {
    const relay = this.getPendingRelay(id);
    if (relay.status !== 'pending') {
      throw new Error(`Pending relay ${id} is already ${relay.status}`);
    }

    relay.status = 'denied';
    relay.decidedAt = new Date().toISOString();

    const conversation = this.findActiveConversationByAgents(relay.fromAgentId, relay.toAgentId);
    if (conversation) {
      this.conversationCoordinator.markConversationCompleted(
        conversation,
        `Conversation stopped by operator before delivering ${relay.fromAgentId}'s proposed turn to ${relay.toAgentId}.`,
      );
    }

    this.emitPendingRelay(relay);
    return relay;
  }

  private assertRelayDeliverable(fromAgentId: string, targetAgent: Agent, conversation?: Conversation | undefined): void {
    if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
      throw new Error(`Target agent ${targetAgent.id} is in ${targetAgent.status} state`);
    }

    if (conversation) {
      const currentCount = conversation.replyCounts[fromAgentId] ?? 0;
      if (currentCount >= conversation.maxRepliesPerAgent) {
        this.conversationCoordinator.markConversationCompleted(conversation, `Reply cap reached by ${fromAgentId}`);
        throw new Error(`Conversation ${conversation.id} reply cap reached for ${fromAgentId}`);
      }
    }
  }

  private createPendingRelay(input: {
    fromAgentId: string;
    toAgentId: string;
    payload: unknown;
    replyToMessageId?: string;
    baton?: WorkflowBatonMetadata;
    workflowEvent?: WorkflowGateEvent;
  }): PendingRelay {
    const relay: PendingRelay = {
      id: `pending-relay-${Date.now()}-${++this.pendingRelaySeq}`,
      status: 'pending',
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      payload: input.payload,
      createdAt: new Date().toISOString(),
      ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
      ...(input.baton ? { baton: input.baton } : {}),
      ...(input.workflowEvent ? { workflowEvent: input.workflowEvent } : {}),
    };
    this.pendingRelays.set(relay.id, relay);
    this.emitPendingRelay(relay);
    return relay;
  }

  private emitPendingRelay(relay: PendingRelay): void {
    this.emit('pending_relay_updated', { relay: { ...relay } });
  }

  private async deliverRelayMessage(input: {
    fromAgentId: string;
    toAgentId: string;
    payload: unknown;
    replyToMessageId?: string;
    baton?: WorkflowBatonMetadata;
    workflowEvent?: WorkflowGateEvent;
    targetAgent: Agent;
    conversation?: Conversation | undefined;
  }): Promise<void> {
    await this.sendProtocol(input.targetAgent.id, 'EVT', {
      type: 'message_received',
      from: input.fromAgentId,
      payload: input.payload,
      ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
    });

    if (input.conversation) {
      this.conversationCoordinator.recordConversationMessage(input.conversation, {
        kind: 'message',
        from: input.fromAgentId,
        to: input.toAgentId,
        payload: String(input.payload),
        timestamp: new Date().toISOString(),
        ...(input.baton ? { baton: input.baton } : {}),
        ...(input.workflowEvent ? { workflowEvent: input.workflowEvent } : {}),
      });
    }
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

  setWorkflowRole(agentId: string, role: WorkflowRole): void {
    const agent = this.getAgent(agentId);
    if (role === 'product-owner') {
      throw new Error('Cannot assign product-owner role to any agent in the registry');
    }
    agent.workflowRole = role;
  }

  // ── Team methods ──────────────────────────────────────────────

  createTeam(members: TeamMember[], provider?: AgentProvider, consensusMode?: 'protocol' | 'arbiter'): Team {
    const team = this.teamCoordinator.createTeam(members, provider);
    team.consensusMode = consensusMode ?? 'protocol';
    return team;
  }

  async assignTeamTask(teamId: string, description: string, maxRepliesPerAgent?: number): Promise<TeamTask> {
    const team = this.getTeams().find(t => t.id === teamId);
    if (team?.consensusMode === 'arbiter' && team.composition === 'planner-planner-worker') {
      const task = await this.arbiterCoordinator.assignTask(team, description, maxRepliesPerAgent ?? 10);
      return task;
    }
    return this.teamCoordinator.assignTask(teamId, description, maxRepliesPerAgent);
  }

  async confirmTeamPlan(taskId: string): Promise<void> {
    if (this.arbiterCoordinator.hasTask(taskId)) {
      return this.arbiterCoordinator.confirmPlan(taskId);
    }
    return this.teamCoordinator.confirmPlan(taskId);
  }

  async rejectTeamPlan(taskId: string, feedback: string): Promise<void> {
    if (this.arbiterCoordinator.hasTask(taskId)) {
      return this.arbiterCoordinator.rejectPlan(taskId, feedback);
    }
    return this.teamCoordinator.rejectPlan(taskId, feedback);
  }

  async sendTeamMessage(taskId: string, targetRole: TeamRole, message: string): Promise<void> {
    if (this.arbiterCoordinator.hasTask(taskId)) {
      return this.arbiterCoordinator.sendUserMessage(taskId, targetRole, message);
    }
    return this.teamCoordinator.sendUserMessage(taskId, targetRole, message);
  }

  /**
   * M08-T3 worker effect-fence: the in-process driver calls this when a worker
   * exec crashes mid-exec (McpError). Pure delegation to the coordinator's
   * pauseTaskForOperator (mirrors the handleAgentFailure delegation at :173) —
   * no MCP tool, no wire-contract surface.
   */
  async pauseTaskForOperator(agentId: string, reason: string): Promise<void> {
    return this.teamCoordinator.pauseTaskForOperator(agentId, reason);
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

      // M08-T2: same hazard for the exec-turn path — a resolver left over from the dead socket
      // would eat the exec turn re-delivered after a reconnect. Pending exec turns are preserved.
      const droppedExecWaiters = agent.clearExecTurnWaiters();
      if (droppedExecWaiters > 0) {
        console.log(`[Registry] Cleared ${droppedExecWaiters} stale exec-turn waiter(s) for agent ${agentId}`);
      }

        // If the harness exited cleanly (e.g. SIGINT), it sends 1000.
        // If it exited due to a MCP error, we will configure it to send 1011.
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

        if (this.isConversationEndTurn(agent.activeExecTurn)) {
          console.log(`[Registry] MCP connection closed after conversation_end for agent ${agentId} -> terminated`);
          agent.activeTurn = undefined;
          agent.activeExecTurn = undefined;
          agent.currentTurnId = undefined;
          try { this.setAgentStatus(agent, 'terminated'); } catch {}
          return;
        }

        // For other abnormal closures (e.g. 1006 transport drop), give it a grace period to reconnect
        console.warn(`[Registry] MCP connection dropped for agent ${agentId} (code ${code}). Allowing 30s reconnect...`);
        
        if (agent.activeTurn) {
          console.log(`[Registry] Requeuing interrupted turn ${agent.currentTurnId} for agent ${agentId}`);
          agent.queueTurn(agent.activeTurn, true);
          agent.activeTurn = undefined;
        }

        // M08-T2 (IMP-T3b-1): re-deliver the in-flight exec turn to the relaunched harness. Without
        // this the exec turn pulled before the drop is lost and the completer hangs until its T1
        // timeout. Requeued at head; the reconnected harness picks it up via `awaitExecTurn`. The
        // re-delivered turn carries the same prompt (the brain's full resend; `markSessionStale`
        // already fires on reconnect). Window-expiry rejection is handled by T1 (status -> error).
        if (agent.activeExecTurn) {
          console.log(`[Registry] Requeuing interrupted exec turn for agent ${agentId}`);
          agent.queueExecTurn(agent.activeExecTurn, true);
          agent.activeExecTurn = undefined;
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
      const driver = this.apiDrivers.get(agentId);
      if (driver && agent.status === 'reconnecting') {
        driver.markSessionStale();
      }
      this.setAgentStatus(agent, agent.currentTurnId ? 'busy' : 'ready');
      this.clearReadinessTimeout(agentId);
    }
  }

  getTeams(): Team[] {
    return this.teamCoordinator.getTeams();
  }

  // BL-056: `currentTaskId` answers "what is this team doing NOW", and completion
  // correctly clears it. Nothing answered "what did this team DO", so a finished
  // run became unreachable even though its task never left `tasks`. This is that
  // second question — and the only reason a completed run can be rendered at all.
  getTeamTasks(teamId: string): TeamTask[] {
    return this.teamCoordinator.getTeamTasks(teamId);
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
