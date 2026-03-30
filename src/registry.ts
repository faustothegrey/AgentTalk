import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { Agent } from './agent.js';
import { ProcessOutputParser } from './process-output-parser.js';
import type { ProcessAdapter } from './process-adapter.js';
import type { AgentStatus, Conversation, TranscriptEntry } from './types.js';
import { deriveConversationStatus, withDerivedConversationStatus } from './conversation-status.js';

interface RegistryConfig {
  readinessTimeoutMs: number;
  conversationStorePath: string;
  agentIdleTimeoutMs: number;
  healthcheckTimeoutMs: number;
}

export class Registry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private parsers: Map<string, ProcessOutputParser> = new Map();
  private readinessTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private idleCheckInterval: NodeJS.Timeout | undefined;
  private conversations: Map<string, Conversation> = new Map();
  private pendingHealthChecks: Map<string, {
    agentId: string;
    resolve: (value: { agentId: string; message: string }) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private readonly config: RegistryConfig;

  constructor(
    private readonly adapter: ProcessAdapter,
    config: Partial<RegistryConfig> = {}
  ) {
    super();
    this.config = {
      readinessTimeoutMs: 60000,
      conversationStorePath: './transcripts/conversations.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 20000,
      ...config,
    };
    this.loadConversations();

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
  async createAgent(id: string): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} already exists`);
    }

    console.log(`[Registry] Creating agent ${id}...`);
    const agent = new Agent(id);
    this.agents.set(id, agent);
    return agent;
  }

  async startConversation(agentIds: string[], topic: string, maxRepliesPerAgent: number): Promise<Conversation> {
    if (agentIds.length < 2) {
      throw new Error('Conversation requires at least two agents');
    }

    const uniqueAgentIds = [...new Set(agentIds)];
    if (uniqueAgentIds.length !== agentIds.length) {
      throw new Error('Conversation requires different agents');
    }

    const agents = agentIds.map(id => this.getAgent(id));

    for (const agent of agents) {
      if (agent.status !== 'ready' && agent.status !== 'busy') {
        throw new Error(`Agent ${agent.id} must be ready before starting a conversation`);
      }
    }

    await Promise.all(agentIds.map(id => this.requestHealthCheck(id)));

    const existingConversation = this.findActiveConversationByAgents(agentIds);
    if (existingConversation) {
      return existingConversation;
    }

    const now = new Date().toISOString();
    const replyCounts: Record<string, number> = {};
    agentIds.forEach(id => { replyCounts[id] = 0; });

    const conversation: Conversation = {
      id: `conversation-${Date.now()}`,
      agentIds,
      topic,
      maxRepliesPerAgent,
      replyCounts,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'system',
          to: agentIds.join(','),
          payload: `Conversation created with ${agentIds.length} agents: ${topic}`,
        },
      ],
    };

    this.conversations.set(conversation.id, conversation);
    this.persistConversations();
    this.emit('conversation', conversation);

    // Send conversation_start to all agents
    for (const [i, id] of agentIds.entries()) {
      const peerIds = agentIds.filter(pid => pid !== id);
      
      await this.sendProtocol(id, 'EVT', {
        type: 'conversation_start',
        conversationId: conversation.id,
        peerIds, // plural for multi-agent support
        peerId: peerIds[0], // backward compatibility for V1 agents
        topic,
        maxReplies: maxRepliesPerAgent,
        initiator: i === 0, // only the first agent is the initiator
      });
    }

    return conversation;
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
  async startAgent(id: string, launchCommand: string): Promise<void> {
    const agent = this.getAgent(id);
    console.log(`[Registry] Starting agent ${id} with command: ${launchCommand}`);
    this.parsers.delete(id);
    this.clearReadinessTimeout(id);

    this.setAgentStatus(agent, 'starting');
    agent.launchCommand = launchCommand;

    // Try to extract provider from command (e.g. node scripts/llm-agent.mjs gemini)
    const providerMatch = launchCommand.match(/llm-agent\.mjs\s+([^\s]+)/);
    if (providerMatch && providerMatch[1]) {
      agent.provider = providerMatch[1].toLowerCase();
      this.emit('provider', { id: agent.id, provider: agent.provider });
    }

    const modelMatch = launchCommand.match(/--model\s+([^\s]+)/);
    if (modelMatch && modelMatch[1]) {
      agent.model = modelMatch[1];
      this.emit('model', { id: agent.id, model: agent.model });
    }

    try {
      console.log(`[Registry] Spawning process for agent ${id}: ${launchCommand}`);
      this.adapter.spawn(id, launchCommand);
      console.log(`[Registry] Process spawned for agent ${id}`);
    } catch (err) {
      console.error(`[Registry] Failed to spawn process for agent ${id}:`, err);
      this.setAgentStatus(agent, 'error');
      throw err;
    }

    // Wire up push-based output processing
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
    const filtered = lines.filter(line => !line.includes('[AgentTalk]:'));
    return filtered.join('').replace(/\r?\n/g, '\r\n');
  }

  /**
   * Handles a single protocol line starting with [AgentTalk]:
   */
  private async handleProtocolLine(agent: Agent, line: string): Promise<void> {
    console.log(`[Registry] Protocol line from ${agent.id}: ${line}`);

    const body = line.slice('[AgentTalk]:'.length);
    const colonIdx = body.indexOf(':');
    if (colonIdx === -1) {
      console.warn(`[Registry] Protocol line from ${agent.id} has no colon after prefix, ignoring: "${body}"`);
      return;
    }

    const packetType = body.slice(0, colonIdx);
    const jsonStr = body.slice(colonIdx + 1);

    let payload: any;
    try {
      payload = JSON.parse(jsonStr);
    } catch (err) {
      console.warn(`[Registry] Malformed protocol payload from ${agent.id}: ${jsonStr}`, err);
      return;
    }

    if (packetType === 'REQ' && !this.markRequestSeen(agent, payload?.id)) {
      console.log(`[Registry] Skipping duplicate REQ from ${agent.id}: ${payload?.id}`);
      return;
    }

    switch (packetType) {
      case 'READY':
        console.log(`[Registry] Agent ${agent.id} ready (session: ${payload.session})`);
        this.clearReadinessTimeout(agent.id);

        if (agent.status === 'starting') {
          this.setAgentStatus(agent, 'ready');
          return;
        }

        if (agent.status === 'ready' || agent.status === 'busy') {
          return;
        }

        console.warn(`[Registry] Unexpected READY from ${agent.id} while in ${agent.status} state`);
        return;

      case 'REQ':
        await this.handleRequest(agent, payload);
        return;

      case 'RES':
        await this.handleResponse(agent, payload);
        return;

      case 'EVT':
        await this.handleEvent(agent, payload);
        return;

      default:
        console.warn(`[Registry] Unknown packet type from ${agent.id}: ${packetType}`);
    }
  }

  private async handleRequest(agent: Agent, payload: any): Promise<void> {
    console.log(`[Registry] REQ from ${agent.id}:`, payload);

    const { id: reqId, call, args } = payload;
    if (!reqId || !call) {
      console.warn(`[Registry] Invalid REQ from ${agent.id}: missing id or call`);
      return;
    }

    switch (call) {
      case 'list_agents':
        await this.handleListAgents(agent, reqId);
        return;

      case 'send_to_agent':
        await this.handleSendToAgent(agent, reqId, args);
        return;

      case 'ack_healthcheck':
        await this.handleHealthcheckAck(agent, reqId, args);
        return;

      default:
        await this.sendErrorResponse(agent.id, reqId, `Unknown tool call: ${call}`);
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

  private async handleSendToAgent(agent: Agent, reqId: string, args: any): Promise<void> {
    const { to, payload } = args || {};

    if (!to || payload === undefined) {
      await this.sendErrorResponse(agent.id, reqId, 'Missing "to" or "payload" in send_to_agent args');
      return;
    }

    // Special target: "user" routes back to the web UI
    if (to === 'user') {
      this.setAgentBusyState(agent, false);
      this.emit('user_message', { from: agent.id, payload });
      await this.sendSuccessResponse(agent.id, reqId);
      return;
    }

    try {
      const targetAgent = this.getAgent(to);
      const conversation = this.findActiveConversationByAgents(agent.id, to);

      if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
        await this.sendErrorResponse(agent.id, reqId, `Target agent ${to} is in ${targetAgent.status} state`);
        return;
      }

      if (conversation) {
        const currentCount = conversation.replyCounts[agent.id] ?? 0;
        if (currentCount >= conversation.maxRepliesPerAgent) {
          this.markConversationCompleted(conversation, `Reply cap reached by ${agent.id}`);
          await this.sendErrorResponse(agent.id, reqId, `Conversation ${conversation.id} reply cap reached for ${agent.id}`);
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
        this.recordConversationMessage(conversation, {
          kind: 'message',
          timestamp: new Date().toISOString(),
          from: agent.id,
          to,
          payload: String(payload),
        });
      }

      await this.sendSuccessResponse(agent.id, reqId);
    } catch (err) {
      await this.sendErrorResponse(agent.id, reqId, err instanceof Error ? err.message : `Target agent ${to} not found`);
    }
  }

  private async handleHealthcheckAck(agent: Agent, reqId: string, args: any): Promise<void> {
    const { token, message } = args || {};
    if (typeof token !== 'string' || typeof message !== 'string' || !message.trim()) {
      await this.sendErrorResponse(agent.id, reqId, 'Missing "token" or "message" in ack_healthcheck args');
      return;
    }

    const pending = this.pendingHealthChecks.get(token);
    if (!pending || pending.agentId !== agent.id) {
      await this.sendErrorResponse(agent.id, reqId, `Unknown healthcheck token: ${token}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingHealthChecks.delete(token);
    pending.resolve({ agentId: agent.id, message });

    await this.sendSuccessResponse(agent.id, reqId);
  }

  private async handleResponse(agent: Agent, payload: any): Promise<void> {
    console.log(`[Registry] RES from ${agent.id}:`, payload);
  }

  private async handleEvent(agent: Agent, payload: any): Promise<void> {
    console.log(`[Registry] EVT from ${agent.id}:`, payload);

    if (payload?.type === 'busy_state' && typeof payload.busy === 'boolean') {
      this.setAgentBusyState(agent, payload.busy);
    }

    if (payload?.type === 'usage_updated' && typeof payload.total === 'number' && typeof payload.limit === 'number') {
      agent.usage = { total: payload.total, limit: payload.limit };
      this.emit('usage', { id: agent.id, usage: agent.usage });
    }

    if (payload?.type === 'external_usage' && typeof payload.output === 'string') {
      agent.externalUsage = payload.output;
      this.emit('external_usage', { id: agent.id, externalUsage: agent.externalUsage });
    }
  }

  /**
   * Sends a protocol packet to an agent's stdin.
   * V1 Protocol Rule: [AgentTalk]:TYPE:JSON\n
   */
  async sendProtocol(id: string, type: 'RES' | 'EVT', payload: any): Promise<void> {
    const agent = this.getAgent(id);
    const jsonStr = JSON.stringify(payload);
    const line = `[AgentTalk]:${type}:${jsonStr}\n`;
    const parser = this.parsers.get(id);
    if (parser) parser.expectEcho(line);

    console.log(`[Registry] Sending ${type} to agent ${id}: ${jsonStr}`);
    this.adapter.sendText(id, line);
  }

  private setAgentBusyState(agent: Agent, busy: boolean): void {
    if (busy && agent.status === 'ready') {
      this.setAgentStatus(agent, 'busy');
      return;
    }

    if (!busy && agent.status === 'busy') {
      this.setAgentStatus(agent, 'ready');
    }
  }

  private async requestHealthCheck(agentId: string): Promise<{ agentId: string; message: string }> {
    const token = `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const resultPromise = new Promise<{ agentId: string; message: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingHealthChecks.delete(token);
        reject(new Error(`Agent ${agentId} did not respond to healthcheck within ${this.config.healthcheckTimeoutMs}ms`));
      }, this.config.healthcheckTimeoutMs);

      this.pendingHealthChecks.set(token, {
        agentId,
        resolve,
        reject,
        timeout,
      });
    });

    await this.sendProtocol(agentId, 'EVT', {
      type: 'healthcheck',
      token,
      prompt: 'Reply with a short greeting confirming you are responsive.',
    });

    const result = await resultPromise;
    console.log(`[Registry] Healthcheck ack from ${agentId}: ${result.message}`);
    return result;
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
    return Array.from(this.conversations.values())
      .map(withDerivedConversationStatus)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  removeConversation(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.persistConversations();
    }
    return deleted;
  }

  private loadConversations(): void {
    const storePath = this.getConversationStorePath();
    if (!existsSync(storePath)) {
      return;
    }

    try {
      const raw = readFileSync(storePath, 'utf8').trim();
      if (!raw) {
        return;
      }

      const conversations = JSON.parse(raw) as Conversation[];
      for (const conversation of conversations) {
        this.conversations.set(conversation.id, conversation);
      }
    } catch (err) {
      console.error('[Registry] Failed to load conversations:', err);
    }
  }

  private persistConversations(): void {
    const storePath = this.getConversationStorePath();
    mkdirSync(path.dirname(storePath), { recursive: true });
    writeFileSync(
      storePath,
      JSON.stringify(this.getConversations(), null, 2),
      'utf8',
    );
  }

  private getConversationStorePath(): string {
    return path.resolve(this.config.conversationStorePath);
  }

  private findActiveConversationByAgents(agentIds: string[] | string, maybeTo?: string): Conversation | undefined {
    let ids: string[];
    if (Array.isArray(agentIds)) {
      ids = agentIds;
    } else if (maybeTo) {
      ids = [agentIds, maybeTo];
    } else {
      return undefined;
    }

    return this.getConversations().find((conversation) =>
      deriveConversationStatus(conversation) === 'active' &&
      conversation.agentIds.length === ids.length &&
      ids.every(id => conversation.agentIds.includes(id))
    );
  }

  private recordConversationMessage(conversation: Conversation, entry: TranscriptEntry): void {
    conversation.transcript.push(entry);
    const nextCount = (conversation.replyCounts[entry.from] ?? 0) + 1;
    conversation.replyCounts[entry.from] = nextCount;
    conversation.updatedAt = entry.timestamp;

    const allFinished = conversation.agentIds.every(
      id => (conversation.replyCounts[id] ?? 0) >= conversation.maxRepliesPerAgent
    );

    if (allFinished) {
      this.markConversationCompleted(conversation, 'All agents reached reply limit');
      return;
    }

    this.persistConversations();
    this.emit('conversation', conversation);
  }

  private markConversationCompleted(conversation: Conversation, reason: string): void {
    if (conversation.status === 'completed') {
      return;
    }

    conversation.status = 'completed';
    conversation.updatedAt = new Date().toISOString();
    conversation.transcript.push({
      kind: 'system',
      timestamp: conversation.updatedAt,
      from: 'system',
      to: conversation.agentIds.join(','),
      payload: reason,
    });
    this.persistConversations();
    this.emit('conversation', conversation);

    // Notify all agents that the conversation has ended
    for (const id of conversation.agentIds) {
      this.sendProtocol(id, 'EVT', {
        type: 'conversation_end',
        conversationId: conversation.id,
        reason,
      }).catch(err => console.error(`[Registry] Failed to send conversation_end to ${id}:`, err));
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

  /**
   * Cleanup all agents and polling loops.
   */
  async destroy(): Promise<void> {
    this.persistConversations();
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = undefined;
    }
    for (const pending of this.pendingHealthChecks.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Registry destroyed before healthcheck completed'));
    }
    this.pendingHealthChecks.clear();
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
