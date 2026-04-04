import { EventEmitter } from 'events';
import { Agent } from './agents/agent.js';
import { ConversationStore } from './conversations/conversation-store.js';
import { HealthcheckManager } from './agents/healthcheck-manager.js';
import { ProcessOutputParser } from './agents/process-output-parser.js';
import type { ProcessAdapter, ProcessSpawnOptions } from './agents/process-adapter.js';
import {
  parseEventPayload,
  parseReadyPayload,
  parseRequestPayload,
  parseResponsePayload,
  type AckHealthcheckRequestPayload,
  type EventPayload,
  type RequestPayload,
  type ResponsePayload,
  type SendToAgentRequestPayload,
} from './protocol/protocol-payloads.js';
import { PROTOCOL_PREFIX, serializeProtocolLine, splitProtocolLine, type OutboundProtocolPacketType } from './protocol/protocol.js';
import type {
  AgentExecutionMode,
  AgentSessionStatus,
  AgentStatus,
  Conversation,
  ResolvedExecutionMode,
  Team,
  TeamMember,
  TeamRole,
  TeamTask,
  TranscriptEntry,
} from './shared/types.js';
import { ConversationCoordinator } from './registry/conversation-coordinator.js';
import { TeamCoordinator } from './registry/team-coordinator.js';
import { extractLaunchMetadata, resolveRegistryConfig, type RegistryConfig } from './registry/config.js';

export class Registry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private parsers: Map<string, ProcessOutputParser> = new Map();
  private readinessTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private idleCheckInterval: NodeJS.Timeout | undefined;
  private readonly conversations: ConversationStore;
  private readonly conversationCoordinator: ConversationCoordinator;
  private readonly teamCoordinator: TeamCoordinator;
  private readonly healthchecks = new HealthcheckManager();
  private readonly config: RegistryConfig;

  constructor(
    private readonly adapter: ProcessAdapter,
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
      emitTeam: (team) => this.emit('team', team),
      emitTeamTask: (task) => this.emit('team_task', task),
      emitPlanningComplete: (payload) => this.emit('team_planning_complete', payload),
      logError: (message, err) => console.error(message, err),
    });

    this.idleCheckInterval = setInterval(() => this.checkIdleAgents(), 30000);

    this.adapter.onExit((id, code) => {
      const agent = this.agents.get(id);
      const parser = this.parsers.get(id);
      parser?.flush();
      if (!agent || agent.status === 'terminated') return;
      console.log(`[Registry] Process exited for agent ${id} (code: ${code})`);
      this.parsers.delete(id);
      this.clearReadinessTimeout(id);
      try {
        this.setAgentStatus(agent, 'error');
      } catch {
        // already in terminal state
      }
    });
  }

  /**
   * Registers a new agent. No process is spawned yet — call startAgent for that.
   */
  async createAgent(id: string, options: { requestedExecutionMode?: AgentExecutionMode } = {}): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} already exists`);
    }

    console.log(`[Registry] Creating agent ${id}...`);
    const agent = new Agent(id);
    if (options.requestedExecutionMode) {
      agent.requestedExecutionMode = options.requestedExecutionMode;
    }
    this.agents.set(id, agent);
    return agent;
  }

  async startConversation(agentIds: string[], topic: string, maxRepliesPerAgent: number): Promise<Conversation> {
    return this.conversationCoordinator.startConversation(agentIds, topic, maxRepliesPerAgent);
  }

  private sendHello(agent: Agent): void {
    this.sendProtocol(agent.id, 'EVT', {
      type: 'message_received',
      from: 'user',
      payload: 'hello',
    }).catch((err) => {
      console.error(`[Registry] Failed to send hello to ${agent.id}:`, err);
    });
  }

  private async sendErrorResponse(agentId: string, reqId: string, error: string): Promise<void> {
    await this.sendProtocol(agentId, 'RES', { id: reqId, status: 'error', error });
  }

  private async sendSuccessResponse(agentId: string, reqId: string, data?: Record<string, unknown>): Promise<void> {
    await this.sendProtocol(agentId, 'RES', { id: reqId, status: 'success', ...(data && { data }) });
  }

  /**
   * Updates the agent status and logs the transition.
   * Also emits a status event for the UI.
   */
  private setAgentStatus(agent: Agent, newStatus: AgentStatus): void {
    agent.setStatus(newStatus);
    this.emit('status', { id: agent.id, status: newStatus });
  }

  /**
   * Spawns the agent process and starts the polling loop.
   */
  async startAgent(
    id: string,
    launchCommand: string,
    workingDirectory?: string,
    processOptions?: ProcessSpawnOptions,
    requestedExecutionMode?: AgentExecutionMode,
  ): Promise<void> {
    const agent = this.getAgent(id);
    console.log(`[Registry] Starting agent ${id} with command: ${launchCommand}`);
    this.parsers.delete(id);
    this.clearReadinessTimeout(id);

    this.setAgentStatus(agent, 'starting');
    agent.launchCommand = launchCommand;
    agent.workingDirectory = workingDirectory;
    agent.requestedExecutionMode = requestedExecutionMode ?? agent.requestedExecutionMode;
    agent.sessionStatus = 'starting';
    delete agent.resolvedExecutionMode;
    this.emit('execution_mode', {
      id: agent.id,
      requestedExecutionMode: agent.requestedExecutionMode,
      resolvedExecutionMode: agent.resolvedExecutionMode,
    });
    this.emit('session_status', {
      id: agent.id,
      sessionStatus: agent.sessionStatus,
    });

    const { provider, model } = extractLaunchMetadata(launchCommand);
    if (provider) {
      agent.provider = provider;
      this.emit('provider', { id: agent.id, provider: agent.provider });
    }

    if (model) {
      agent.model = model;
      this.emit('model', { id: agent.id, model: agent.model });
    }

    try {
      console.log(
        `[Registry] Spawning process for agent ${id}: ${launchCommand}${processOptions?.cwd ? ` (cwd: ${processOptions.cwd})` : ''}`,
      );
      this.adapter.spawn(id, launchCommand, processOptions);
      console.log(`[Registry] Process spawned for agent ${id}`);
    } catch (err) {
      console.error(`[Registry] Failed to spawn process for agent ${id}:`, err);
      this.setAgentStatus(agent, 'error');
      throw err;
    }

    /**
     * Wire up push-based output processing
     */
    const parser = new ProcessOutputParser({
      onProtocolLine: (line) => {
        this.handleProtocolLine(agent, line).catch(err =>
          console.error(`[Registry] Error handling protocol line from ${id}:`, err)
        );
      },
      onPlainText: (text) => {
        agent.lastProgressAt = Date.now();
        agent.appendToTranscript(text);
        const uiText = this.filterTextForUI(text);
        if (uiText) {
          this.emit('output', { id: agent.id, text: uiText });
        }
      },
    });
    this.parsers.set(id, parser);

    this.adapter.onData(id, (chunk) => {
      if (agent.status === 'terminated' || agent.status === 'error') return;
      parser.feed(chunk);
    });

    // Setup readiness timeout
    const timeout = setTimeout(() => {
      if (agent.status === 'starting') {
        console.error(`[Registry] Agent ${id} readiness timeout reached (${this.config.readinessTimeoutMs}ms)`);
        this.setAgentStatus(agent, 'error');
        this.parsers.delete(id);
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

    this.parsers.delete(id);
    this.clearReadinessTimeout(id);

    try {
      this.setAgentStatus(agent, 'terminated');
    } catch (err) {
      // If already terminated, this might throw, which is fine for removal.
    }

    this.agents.delete(id);
    await agent.destroy();

    try {
      this.adapter.kill(id);
      console.log(`[Registry] Agent ${id} process killed.`);
    } catch (err) {
      console.warn(`[Registry] Failed to kill process for agent ${id}:`, err);
    }
  }

  /**
   * Strips protocol lines and normalises newlines for xterm.js display.
   */
  private filterTextForUI(text: string): string {
    const lines = text.split(/(\r?\n)/);
    const filtered = lines.filter(line => !line.includes(PROTOCOL_PREFIX));
    return filtered.join('').replace(/\r?\n/g, '\r\n');
  }

  /**
   * Handles a single protocol line starting with [AgentTalk]:
   */
  private async handleProtocolLine(agent: Agent, line: string): Promise<void> {
    console.log(`[Registry] Protocol line from ${agent.id}: ${line}`);

    const parsed = splitProtocolLine(line);
    if (!parsed) {
      console.warn(`[Registry] Protocol line from ${agent.id} is malformed, ignoring: "${line}"`);
      return;
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(parsed.payloadJson);
    } catch (err) {
      console.warn(`[Registry] Malformed protocol payload from ${agent.id}: ${parsed.payloadJson}`, err);
      return;
    }

    switch (parsed.packetType) {
      case 'READY': {
        const payload = parseReadyPayload(rawPayload);
        if (!payload) {
          console.warn(`[Registry] Invalid READY payload from ${agent.id}:`, rawPayload);
          return;
        }

        console.log(`[Registry] Agent ${agent.id} ready (session: ${payload.session})`);
        this.clearReadinessTimeout(agent.id);
        this.updateAgentExecutionMode(agent, payload.requestedExecutionMode, payload.resolvedExecutionMode);
        this.updateAgentSessionStatus(agent, payload.sessionStatus ?? 'ready');

        if (agent.status === 'starting') {
          this.setAgentStatus(agent, 'ready');
          if (agent.resolvedExecutionMode === 'interactive') {
            this.sendHello(agent);
          }
          return;
        }

        if (agent.status === 'ready' || agent.status === 'busy') {
          return;
        }

        console.warn(`[Registry] Unexpected READY from ${agent.id} while in ${agent.status} state`);
        return;
      }
      case 'REQ': {
        const payload = parseRequestPayload(rawPayload);
        if (!payload) {
          console.warn(`[Registry] Invalid REQ from ${agent.id}:`, rawPayload);
          return;
        }

        if (!this.markRequestSeen(agent, payload.id)) {
          console.log(`[Registry] Skipping duplicate REQ from ${agent.id}: ${payload.id}`);
          return;
        }

        await this.handleRequest(agent, payload);
        return;
      }
      case 'RES': {
        const payload = parseResponsePayload(rawPayload);
        if (!payload) {
          console.warn(`[Registry] Invalid RES from ${agent.id}:`, rawPayload);
          return;
        }

        await this.handleResponse(agent, payload);
        return;
      }
      case 'EVT': {
        const payload = parseEventPayload(rawPayload);
        if (!payload) {
          console.warn(`[Registry] Invalid EVT from ${agent.id}:`, rawPayload);
          return;
        }

        await this.handleEvent(agent, payload);
        return;
      }
      default:
        console.warn(`[Registry] Unknown packet type from ${agent.id}: ${parsed.packetType}`);
    }
  }

  private async handleRequest(agent: Agent, payload: RequestPayload): Promise<void> {
    console.log(`[Registry] REQ from ${agent.id}:`, payload);

    switch (payload.call) {
      case 'list_agents':
        await this.handleListAgents(agent, payload.id);
        return;

      case 'send_to_agent':
        await this.handleSendToAgent(agent, payload);
        return;

      case 'ack_healthcheck':
        await this.handleHealthcheckAck(agent, payload);
        return;

      case 'submit_plan':
        try {
          this.teamCoordinator.handlePlanSubmitted(agent.id, payload.args.plan);
          await this.sendSuccessResponse(agent.id, payload.id);
        } catch (err) {
          await this.sendErrorResponse(agent.id, payload.id, err instanceof Error ? err.message : 'Failed to submit plan');
        }
        return;

      case 'submit_work_response':
        try {
          this.teamCoordinator.handleWorkResponse(agent.id, payload.args.accepted, payload.args.reason);
          await this.sendSuccessResponse(agent.id, payload.id);
        } catch (err) {
          await this.sendErrorResponse(agent.id, payload.id, err instanceof Error ? err.message : 'Failed to submit work response');
        }
        return;

      case 'submit_work_result':
        try {
          this.teamCoordinator.handleWorkResult(agent.id, payload.args.result);
          await this.sendSuccessResponse(agent.id, payload.id);
        } catch (err) {
          await this.sendErrorResponse(agent.id, payload.id, err instanceof Error ? err.message : 'Failed to submit work result');
        }
        return;

      case 'submit_usage_stats':
        agent.usageStats = {
          stats: payload.args.stats,
          timestamp: payload.args.timestamp,
        };
        this.emit('usage_stats', { id: agent.id, usageStats: agent.usageStats });
        await this.sendSuccessResponse(agent.id, payload.id);
        return;
    }
  }

  private async handleListAgents(agent: Agent, reqId: string): Promise<void> {
    const agentList = Array.from(this.agents.values()).map(a => ({
      id: a.id,
      status: a.status,
    }));
    await this.sendSuccessResponse(agent.id, reqId, { agents: agentList });
  }

  private async handleSendToAgent(agent: Agent, request: SendToAgentRequestPayload): Promise<void> {
    const { to, payload } = request.args;

    // Special target: "user" routes back to the web UI
    if (to === 'user') {
      this.setAgentBusyState(agent, false);
      this.emit('user_message', { from: agent.id, payload });
      await this.sendSuccessResponse(agent.id, request.id);
      return;
    }

    // Brainstorm routing: broadcast to all peers instead of single target
    try {
      const handled = await this.teamCoordinator.handleBrainstormMessage(agent.id, payload);
      if (handled) {
        await this.sendSuccessResponse(agent.id, request.id);
        return;
      }
    } catch (err) {
      await this.sendErrorResponse(agent.id, request.id, err instanceof Error ? err.message : 'Brainstorm message failed');
      return;
    }

    try {
      const targetAgent = this.getAgent(to);
      const conversation = this.findActiveConversationByAgents(agent.id, to);

      if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
        await this.sendErrorResponse(agent.id, request.id, `Target agent ${to} is in ${targetAgent.status} state`);
        return;
      }

      if (conversation) {
        const currentCount = conversation.replyCounts[agent.id] ?? 0;
        if (currentCount >= conversation.maxRepliesPerAgent) {
          this.conversationCoordinator.markConversationCompleted(conversation, `Reply cap reached by ${agent.id}`);
          await this.sendErrorResponse(agent.id, request.id, `Conversation ${conversation.id} reply cap reached for ${agent.id}`);
          return;
        }
      }

      // Delivery: write EVT to target process stdin
      await this.sendProtocol(targetAgent.id, 'EVT', {
        type: 'message_received',
        from: agent.id,
        payload: payload,
      });

      if (conversation) {
        this.conversationCoordinator.recordConversationMessage(conversation, {
          kind: 'message',
          timestamp: new Date().toISOString(),
          from: agent.id,
          to,
          payload: String(payload),
        });
      }

      await this.sendSuccessResponse(agent.id, request.id);
    } catch (err) {
      await this.sendErrorResponse(agent.id, request.id, err instanceof Error ? err.message : `Target agent ${to} not found`);
    }
  }

  private async handleHealthcheckAck(agent: Agent, request: AckHealthcheckRequestPayload): Promise<void> {
    const { token, message } = request.args;
    if (!this.healthchecks.resolve(token, agent.id, message)) {
      await this.sendErrorResponse(agent.id, request.id, `Unknown healthcheck token: ${token}`);
      return;
    }

    await this.sendSuccessResponse(agent.id, request.id);
  }

  private async handleResponse(agent: Agent, payload: ResponsePayload): Promise<void> {
    console.log(`[Registry] RES from ${agent.id}:`, payload);
  }

  private async handleEvent(agent: Agent, payload: EventPayload): Promise<void> {
    console.log(`[Registry] EVT from ${agent.id}:`, payload);

    switch (payload.type) {
      case 'busy_state':
        this.setAgentBusyState(agent, payload.busy);
        return;
      case 'session_update':
        this.updateAgentExecutionMode(agent, payload.requestedExecutionMode, payload.resolvedExecutionMode);
        this.updateAgentSessionStatus(agent, payload.sessionStatus);
        this.syncAgentStatusToSessionStatus(agent, payload.sessionStatus);
        return;
      default:
        return;
    }
  }

  /**
   * Sends a protocol packet to an agent's stdin.
   * V1 Protocol Rule: [AgentTalk]:TYPE:JSON\n
   */
  async sendProtocol(id: string, type: OutboundProtocolPacketType, payload: EventPayload | ResponsePayload): Promise<void> {
    const agent = this.getAgent(id);
    const line = serializeProtocolLine(type, payload);
    const parser = this.parsers.get(id);
    if (parser) parser.expectEcho(line);

    console.log(`[Registry] Sending ${type} to agent ${id}: ${JSON.stringify(payload)}`);
    this.adapter.sendText(id, line.endsWith('\n') ? line : line + '\n');
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

  private updateAgentExecutionMode(
    agent: Agent,
    requestedExecutionMode?: AgentExecutionMode,
    resolvedExecutionMode?: ResolvedExecutionMode,
  ): void {
    let changed = false;

    if (requestedExecutionMode && agent.requestedExecutionMode !== requestedExecutionMode) {
      agent.requestedExecutionMode = requestedExecutionMode;
      changed = true;
    }

    if (resolvedExecutionMode && agent.resolvedExecutionMode !== resolvedExecutionMode) {
      agent.resolvedExecutionMode = resolvedExecutionMode;
      changed = true;
    }

    if (changed) {
      this.emit('execution_mode', {
        id: agent.id,
        requestedExecutionMode: agent.requestedExecutionMode,
        resolvedExecutionMode: agent.resolvedExecutionMode,
      });
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

  private syncAgentStatusToSessionStatus(agent: Agent, sessionStatus: AgentSessionStatus): void {
    if (sessionStatus === 'busy' && agent.status === 'ready') {
      this.setAgentStatus(agent, 'busy');
      return;
    }

    if (sessionStatus === 'ready' && agent.status === 'busy') {
      this.setAgentStatus(agent, 'ready');
    }
  }

  private async requestHealthCheck(agentId: string): Promise<{ agentId: string; message: string }> {
    const { token, result } = this.healthchecks.create(agentId, this.config.healthcheckTimeoutMs);

    await this.sendProtocol(agentId, 'EVT', {
      type: 'healthcheck',
      token,
      prompt: 'Reply with a short greeting confirming you are responsive.',
    });

    const ack = await result;
    console.log(`[Registry] Healthcheck ack from ${agentId}: ${ack.message}`);
    return ack;
  }

  private hasAgentTimedOut(agent: Agent): boolean {
    if (agent.status !== 'busy') {
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
        this.parsers.delete(id);
        this.clearReadinessTimeout(id);
        this.setAgentStatus(agent, 'error');
      }
    }
  }

  private markRequestSeen(agent: Agent, requestId: unknown): boolean {
    if (typeof requestId !== 'string' || requestId.length === 0) {
      return true;
    }

    if (agent.processedRequestIds.includes(requestId)) {
      return false;
    }

    agent.processedRequestIds.push(requestId);
    if (agent.processedRequestIds.length > 100) {
      agent.processedRequestIds.shift();
    }

    return true;
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

  createTeam(members: TeamMember[]): Team {
    return this.teamCoordinator.createTeam(members);
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
      this.parsers.delete(id);
      this.clearReadinessTimeout(id);
      const agent = this.agents.get(id);
      if (agent) teardowns.push(agent.destroy());
    }
    this.parsers.clear();
    this.agents.clear();
    await Promise.all(teardowns);
  }
}
