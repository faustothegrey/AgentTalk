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
  AgentErrorReason,
  AgentExecutionMode,
  AgentNonReplyNotice,
  AgentProvider,
  AgentStatus,
  AgentTransport,
  AgentVendor,
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
import { normalizeAgentKind } from '@agenttalk/contracts/types';
import { ConversationCoordinator } from './conversation-coordinator.js';
import { TeamCoordinator } from './team-coordinator.js';
import { ArbiterCoordinator } from './arbiter-coordinator.js';
import { resolveRegistryConfig, type RegistryConfig } from './config.js';
import { type StructuredMessageType, buildProtocolToolSchema } from '../agents/response-schema.js';

/**
 * BL-084 T1 — the classification table, and the single decision point for M03 propagation.
 *
 * Ratified in `design/bl084-plan.md` §4; each row is a behaviour call, not an implementation
 * detail, so the table is written out one reason per line rather than derived. Typing it as an
 * exhaustive `Record` over the union is deliberate: adding a reason to
 * `AgentErrorReason` without deciding its class is a COMPILE error, not a silent default.
 */
const FAULT_CLASS_BY_REASON: Record<AgentErrorReason, boolean> = {
  // ── fault-class: the agent broke something; the team dies with it (M03 Shared-Fate) ──
  'conversation-start-failed': true,
  'mcp-internal-error': true,
  'reconnect-timeout-inflight-turn': true,
  'idle-timeout': true, // T1 parity only — BL-028 (T3) revisits this row. See types.ts.

  // ── non-fault: a normal ending, a rail firing, or a deliberate refusal ──
  'unknown-mcp-tool': false, // PO-ratified 2026-07-27 (was `true` in T1). See types.ts.
  'conversation-reply-cap': false,
  'relay-budget-exhausted': false,
  'target-agent-unavailable': false,
  'workflow-gate-refusal': false,
  'planning-task-inactive': false,
  'healthcheck-token-invalid': false,
  // BL-084 T2 — an error reached the in-process catch-all carrying no reason of its own.
  //
  // ⚠️ NOTE THE TWO DIFFERENT "UNKNOWNS", because they point opposite ways ON PURPOSE:
  //   · `isFaultClass(undefined)` is TRUE  — the guard below, protecting call sites not yet
  //     migrated to a typed reason. Migration can only ever REMOVE propagation, never add it.
  //   · `driver-error-unclassified`  is FALSE — the in-process driver passes this EXPLICITLY.
  // That path propagated nothing before T2, so defaulting its surprises to fault would newly kill
  // teams for unanticipated throws. Unlabelled by omission ⇒ keep today's behaviour; unlabelled
  // BY NAME at a site we deliberately migrated ⇒ keep THAT site's today-behaviour, which is
  // non-propagating. Both rules say the same thing: a surprise never changes what happens.
  'driver-error-unclassified': false,
};

/**
 * Does this error reason warrant killing the rest of the team?
 *
 * The default is the SAFE direction: an **unlabelled** error is fault-class, which preserves
 * today's behaviour for any call site not yet migrated. Migration can therefore only ever
 * *remove* propagation, never silently add it.
 */
export function isFaultClass(reason?: AgentErrorReason): boolean {
  if (reason === undefined) {
    return true;
  }
  return FAULT_CLASS_BY_REASON[reason] ?? true;
}

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
  /** BL-083 — relays delivered per ordered agent pair while NO conversation was active. */
  private uncappedRelayCounts = new Map<string, number>();
  /** BL-028 T3a — agentId → the turn already reported `quiet`, so the 30s sweep says it once. */
  private quietReported = new Map<string, string>();
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
      transport?: AgentTransport;
      vendor?: AgentVendor;
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
    // BL-024 — normalize legacy `provider` OR new `{transport, vendor}` into both axes,
    // keeping `provider`/`providerName` populated so the (frozen) engine is unchanged.
    const kind = normalizeAgentKind({
      provider: options.provider,
      providerName: options.providerName,
      transport: options.transport,
      vendor: options.vendor,
    });
    if (kind.legacyProvider) agent.provider = kind.legacyProvider;
    if (kind.providerName) agent.providerName = kind.providerName;
    if (kind.transport) agent.transport = kind.transport;
    if (kind.vendor) agent.vendor = kind.vendor;
    if (kind.capabilities) agent.capabilities = kind.capabilities;
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
   *
   * BL-084 T1 — a transition into `error` MUST carry a typed reason, and M03 propagation
   * fires only when that reason is fault-class (`isFaultClass`). The overloads below are
   * what make the reason non-optional at the type level: a new `error` call site cannot
   * compile without classifying itself, so an unclassified site can never drift in and
   * silently propagate.
   *
   * Behaviour in T1 is unchanged by construction: every existing `error` site is labelled
   * fault-class, so `handleAgentFailure` fires for exactly the same set of transitions as
   * before. T2 (BL-078) is what changes behaviour, on the in-process path.
   */
  private setAgentStatus(agent: Agent, newStatus: 'error', reason: AgentErrorReason): void;
  private setAgentStatus(agent: Agent, newStatus: Exclude<AgentStatus, 'error'>): void;
  private setAgentStatus(agent: Agent, newStatus: AgentStatus, reason?: AgentErrorReason): void {
    const oldStatus = agent.status;
    agent.setStatus(newStatus);
    this.emit('status', { id: agent.id, status: newStatus });

    if (newStatus === 'error' && oldStatus !== 'error' && isFaultClass(reason)) {
      void this.teamCoordinator.handleAgentFailure(agent.id);
    }
  }

  /**
   * Sets the agent status and emits the status event for the UI, WITHOUT the
   * failure-propagation side effect of `setAgentStatus` (BL-077).
   *
   * For transitions owned by a driver (`InProcessAgentDriver`), which previously
   * called `agent.setStatus()` directly and were therefore invisible to connected
   * clients — the UI froze at `starting` for a whole run. This only makes those
   * transitions visible; their semantics are deliberately unchanged. Routing them
   * through `setAgentStatus` instead would newly fire `handleAgentFailure()` on a
   * driver-path error, which is a behaviour change and out of scope here.
   */
  notifyAgentStatus(agent: Agent, newStatus: AgentStatus): void {
    agent.setStatus(newStatus);
    this.emit('status', { id: agent.id, status: newStatus });
  }

  /**
   * BL-084 T2 — the error-transition sibling of `notifyAgentStatus`, and the fix for [[BL-078]].
   *
   * A driver reporting an error goes through here rather than `notifyAgentStatus`, so the
   * transition is judged by `isFaultClass` at the SAME single decision point every other error
   * uses (`setAgentStatus`). Before this, an in-process agent that errored never interrupted its
   * team — for ANY cause, including a genuine fault.
   *
   * Why a new method instead of widening `notifyAgentStatus`: that method's side-effect-free
   * contract is exactly right for `starting`/`ready`/`busy`, which must never propagate, and
   * those are most of its call sites. This adds a door; it does not move a wall.
   *
   * The reason is REQUIRED — the caller must have classified. The in-process catch-all cannot know
   * its cause, so it passes `driver-error-unclassified` explicitly (non-fault). See the note in
   * FAULT_CLASS_BY_REASON on why that default points the opposite way to `isFaultClass(undefined)`.
   */
  reportAgentError(agent: Agent, reason: AgentErrorReason): void {
    this.setAgentStatus(agent, 'error', reason);
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

    // BL-024 — derive transport/vendor/capabilities from the resolved provider so the
    // driver selection below is transport-keyed. Legacy `provider` stays the source of
    // truth in T1 (client still sends it); the engine is untouched.
    const kind = normalizeAgentKind({ provider: agent.provider, providerName: agent.providerName });
    if (kind.transport) agent.transport = kind.transport;
    if (kind.vendor) agent.vendor = kind.vendor;
    if (kind.capabilities) agent.capabilities = kind.capabilities;

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

    // BL-024 — driver selection keyed on TRANSPORT, not the conflated provider union.
    // 'in-process' (was 'api') runs an ApiCompleter here; 'attached' (was mcp/gemini/
    // claude/codex — all treated identically) runs an McpCompleter. Behaviour-identical.
    if (agent.transport === 'in-process' || agent.transport === 'attached') {
      console.log(`[Registry] Starting InProcessAgentDriver for ${agent.transport} agent ${id} (provider=${agent.provider})`);
      let completer: Completer;
      if (agent.transport === 'in-process') {
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

    // BL-028 T3a — the single liveness chokepoint. Any tool call is evidence the agent is alive,
    // and EVERY agent action arrives here on BOTH transports: attached clients over the socket,
    // and the in-process driver, which calls this method for its own actions too
    // (`in-process-driver.ts` submit_work_result / consensus_respond / send_to_agent). One write,
    // total coverage — which is why the sweep does not need a per-transport notion of progress.
    agent.lastProgressAt = Date.now();

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
        const turn = this.agentUsesExecTurns(agent) ? await agent.awaitExecTurn() : await agent.awaitTurn();
        if (turn.turnId) {
          agent.currentTurnId = turn.turnId as string;
        } else if (turn.messageId) {
          agent.currentTurnId = turn.messageId as string;
        }
        // BL-028 T3a — re-stamp AFTER the await resolves. This call blocks until a turn exists,
        // so the stamp taken at entry is the moment the agent STARTED WAITING, which can be
        // arbitrarily long before the obligation was created. Without this line an agent handed a
        // turn after four idle minutes would be reported quiet the instant it began working.
        agent.lastProgressAt = Date.now();
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

      case 'report_environment': {
        // BL-071 P2 — store the host the agent reported about itself. Self-observed
        // ground truth (no trust model — that is BL-072). Surfaced via GET /api/agents.
        agent.host = args.environment;
        this.emit('agent_environment', { id: agent.id, host: agent.host });
        return { content: [{ type: 'text', text: 'Environment reported successfully' }] };
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
      
      // BL-047: an in-process agent whose driver stopped at `conversation_end` is still
      // `ready`, but its loop is gone — so this turn would be queued and never pulled, and
      // the caller would sit on it until timeout (TL-007 saw this as a second conversation
      // failing its startup healthcheck). Revive the loop before enqueuing, but ONLY for
      // events that constitute a NEW assignment. `message_received` is deliberately excluded:
      // a relay still in flight when the conversation ended must stay ignored, exactly as it
      // is today. Reviving on it instead lets two idle agents relay to each other without
      // bound — once no conversation is active, `assertRelayDeliverable` has no reply cap to
      // apply. That uncapped-relay path is pre-existing and NOT touched here; see the note
      // filed with BL-047.
      // `apiDrivers` holds drivers for the attached transport too, so the transport guard is
      // load-bearing: an attached agent's `conversation_end` stop is correct and final (its
      // client is gone), and reviving that loop would drive a dead client. In-process only.
      if (agent.transport === 'in-process' && this.isNewAssignmentEvent(evtPayload.type)) {
        this.apiDrivers.get(agent.id)?.resume();
      }
      // BL-083 — a new conversation or task assignment is a fresh start for this agent's
      // out-of-conversation relay budget. Every transport, since the budget is registry-side.
      if (this.isRelayBudgetResetEvent(evtPayload.type)) {
        this.resetRelayBudgetFrom(agent.id);
      }
      agent.queueTurn(turnPayload);
      if (evtPayload.type === 'conversation_end' && this.agentUsesExecTurns(agent)) {
        agent.queueExecTurn(turnPayload);
      }
    }
  }

  /**
   * BL-047 — events that pull an agent into new work (as opposed to continuing, or trailing
   * off, an existing conversation). These are the points at which a stopped in-process
   * driver must be revived.
   */
  private isNewAssignmentEvent(type: EventPayload['type']): boolean {
    return (
      type === 'healthcheck' ||
      type === 'conversation_start' ||
      type === 'team_task_assign' ||
      type === 'team_work_assign' ||
      type === 'fact_collection_begin'
    );
  }

  /**
   * BL-083 — events that begin a fresh unit of work and therefore reset the relay budget.
   * `healthcheck` is deliberately EXCLUDED (unlike `isNewAssignmentEvent`): it is routine
   * liveness traffic, and resetting on it would let a periodic healthcheck top the budget up
   * underneath a runaway.
   */
  private isRelayBudgetResetEvent(type: EventPayload['type']): boolean {
    return (
      type === 'conversation_start' ||
      type === 'team_task_assign' ||
      type === 'team_work_assign' ||
      type === 'fact_collection_begin'
    );
  }

  private agentUsesExecTurns(agent: Agent): boolean {
    // BL-024 — the exec/attached transport (was the mcp/gemini/claude/codex union).
    return agent.transport === 'attached';
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

  /**
   * BL-028 T3a — how long this agent has been silent while somebody is waiting on it, or
   * `undefined` if it is not a candidate at all.
   *
   * Renamed from `hasAgentTimedOut`, because the old name asserted the thing this change
   * disproves: nothing here times out, and nothing here kills. It measures silence and says how
   * much. The judgement of what silence MEANS is deliberately not made in this method.
   */
  private quietForMs(agent: Agent): number | undefined {
    // ── The obligation gate (replaces `status === 'busy'`) ────────────────────────────────────
    // `currentTurnId` is set when an assignment is DELIVERED — attached at `await_turn`,
    // in-process in the driver loop — and cleared when the terminal action completes. So it means
    // "somebody is waiting for this agent", which is the only condition under which silence is
    // even interesting (LB-67 Finding 2: you are told a peer went quiet only if you were waiting).
    //
    // The old `status === 'busy'` gate was not merely narrow, it was UNREACHABLE on the attached
    // transport: `setAgentBusyState`'s sole call site passes `false`, so an attached agent reaches
    // `busy` only via the reconnect restore. The sweep could therefore never have seen the very
    // transport whose hangs motivated BL-028, even after `lastProgressAt` started being written.
    if (!agent.currentTurnId) {
      return undefined;
    }

    // A terminal agent is not quiet, it is finished. Load-bearing rather than defensive: the clean
    // -close (code 1000/1001/1005) and 1011 paths both return WITHOUT clearing `currentTurnId`, so
    // without this a terminated agent would be reported silent forever.
    if (agent.status === 'error' || agent.status === 'terminated') {
      return undefined;
    }

    // Disable idle timeout while fact checking
    if (this.teamCoordinator.isAgentFactCollecting(agent.id)) {
      return undefined;
    }

    // M08-T3: disable idle timeout for a worker whose task is paused awaiting the
    // operator (effect-fence). A paused-but-alive worker must not be flagged as
    // errored — that would trip the M03 kill, the opposite of "kill nobody".
    //
    // BL-028 T3a: both exemptions above are the `awaiting-input` case in all but name — an agent
    // blocked on a human, which LB-67 Finding 1 records as "not a failure at all". T3b is what
    // gives them that name; here they keep working exactly as they do today.
    if (this.teamCoordinator.isTaskAwaitingOperator(agent.id)) {
      return undefined;
    }

    if (!agent.lastProgressAt) {
      return undefined;
    }

    const silentForMs = Date.now() - agent.lastProgressAt;
    return silentForMs > this.config.agentIdleTimeoutMs ? silentForMs : undefined;
  }

  /**
   * BL-028 T3a — the sweep, live for the first time, and ADVISORY.
   *
   * It emits `agent_non_reply` and does nothing else. It does not set status, does not touch the
   * readiness timeouts, and cannot reach `handleAgentFailure` — there is no path from here to
   * `setAgentStatus` at all. That is the whole design: `quiet` means "we have heard nothing",
   * which is also what a working agent mid-turn looks like, and a real coding CLI routinely
   * exceeds the 180s default on one honest turn. Escalation needs a POSITIVE test (an
   * unanswered healthcheck) and is T3c, gated separately.
   *
   * `idle-timeout` survives in the fault taxonomy with no caller — exactly as
   * `conversation-start-failed` did between T1 and T2. T3c is what gives it one.
   *
   * Reported ONCE per obligation: the sweep runs every 30s, and re-emitting for the same silent
   * turn would bury the signal in its own repetition. A fresh turn, or any progress, re-arms it.
   */
  private checkIdleAgents(): void {
    for (const [id, agent] of this.agents) {
      const silentForMs = this.quietForMs(agent);

      if (silentForMs === undefined) {
        this.quietReported.delete(id);
        continue;
      }

      // `has` before comparing, deliberately. `get` returns `undefined` for an absent key, so a
      // bare `get(id) === turnId` ALSO swallows the notice whenever `turnId` is itself undefined —
      // and it silently suppressed the whole emission when the obligation gate above was mutated
      // away. A dedup that hides the bug in the check it depends on is IP-15's shape, which is the
      // defect this very item exists to retire. Caught by running the mutation, not by reading it.
      const turnId = agent.currentTurnId!;
      if (this.quietReported.has(id) && this.quietReported.get(id) === turnId) {
        continue;
      }
      this.quietReported.set(id, turnId);

      const notice: AgentNonReplyNotice = {
        agentId: id,
        reason: 'quiet',
        silentForMs,
        turnId,
        observedAt: new Date().toISOString(),
      };
      console.warn(`[Registry] Agent ${id} has been silent for ${silentForMs}ms on turn ${turnId} (advisory; nothing is interrupted)`);
      this.emit('agent_non_reply', notice);
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
      return;
    }

    // BL-083 — with no conversation there was previously NO bound at all: the reply cap above
    // and its counter (in `recordConversationMessage`) are both conversation-scoped, so two
    // agents relayed to each other forever, and live every iteration is a billed provider call.
    // That path is not an edge case — NO team task creates a conversation, so this is also the
    // normal team/baton relay path. Hence a pair-scoped budget that does not depend on
    // conversations existing. Conversation-backed relays return above, untouched.
    const budget = this.config.maxUncappedRelaysPerPair;
    const used = this.uncappedRelayCounts.get(this.relayPairKey(fromAgentId, targetAgent.id)) ?? 0;
    if (used >= budget) {
      throw new Error(
        `Relay budget exhausted for ${fromAgentId} → ${targetAgent.id}: ${used}/${budget} relays with no active conversation. ` +
          `Start a conversation or assign new work to reset it (see BL-083).`,
      );
    }
  }

  /** BL-083 — ordered pair: A→B and B→A are budgeted separately. */
  private relayPairKey(fromAgentId: string, toAgentId: string): string {
    return `${fromAgentId}\0${toAgentId}`;
  }

  /**
   * BL-083 — a fresh assignment ends the runaway window, so the sender's budgets are cleared
   * when it is pulled into new work. Without a reset the budget would be per-process and a
   * long-lived orchestrator would eventually start refusing legitimate relays — turning a
   * runaway into a silent stall, which is worse than the defect. Deliberately a SEPARATE list
   * from `isNewAssignmentEvent` (which includes `healthcheck`): coupling the reset to BL-047's
   * driver-revival list would let a change there silently move this ceiling's semantics.
   */
  private resetRelayBudgetFrom(agentId: string): void {
    const prefix = `${agentId}\0`;
    for (const key of this.uncappedRelayCounts.keys()) {
      if (key.startsWith(prefix)) this.uncappedRelayCounts.delete(key);
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
      return;
    }

    // BL-083 — the conversation-scoped reply counter above is the only one that existed, so an
    // out-of-conversation relay was never counted anywhere. Count it here, at the same point in
    // the same method, so the budget checked in `assertRelayDeliverable` has something to read.
    const key = this.relayPairKey(input.fromAgentId, input.toAgentId);
    this.uncappedRelayCounts.set(key, (this.uncappedRelayCounts.get(key) ?? 0) + 1);
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
    // BL-024 T2: derive the team-level capability from the (legacy) provider via the single-source
    // mapping, so the frozen coordinator reads `team.capabilities` instead of sniffing the vendor
    // name. `provider:'gemini'` ⇒ {factCollectionTimeoutMs:720_000}; everything else ⇒ undefined.
    const teamCaps = normalizeAgentKind({ provider }).capabilities;
    if (teamCaps) team.capabilities = teamCaps;
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
          try { this.setAgentStatus(agent, 'error', 'mcp-internal-error'); } catch {}
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
            // BL-084 T1: split from the single `target` call so the `error` branch can carry its
            // reason (the overload takes a literal, not the `'error' | 'terminated'` union). Same
            // two outcomes, same log line, same order — only the reason label is new.
            if (target === 'error') {
              this.setAgentStatus(agent, 'error', 'reconnect-timeout-inflight-turn');
            } else {
              this.setAgentStatus(agent, target);
            }
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
