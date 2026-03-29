import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import stripAnsi from 'strip-ansi';
import { Agent } from './agent.js';
import type { CmuxAdapter } from './cmux-adapter.js';
import type { ConversationScenario, ScenarioTranscriptEntry } from './types.js';

interface RegistryConfig {
  pollIntervalMs: number;
  readinessTimeoutMs: number;
  maxConsecutiveFailures: number;
  scenarioStorePath: string;
  agentIdleTimeoutMs: number;
  healthcheckTimeoutMs: number;
}

export class Registry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readinessTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private pollsInFlight: Set<string> = new Set();
  private pollCount: Map<string, number> = new Map();
  private scenarios: Map<string, ConversationScenario> = new Map();
  private pendingHealthChecks: Map<string, {
    agentId: string;
    resolve: (value: { agentId: string; message: string }) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private readonly config: RegistryConfig;

  constructor(
    private readonly adapter: CmuxAdapter,
    config: Partial<RegistryConfig> = {}
  ) {
    super();
    this.config = {
      pollIntervalMs: 250,
      readinessTimeoutMs: 60000,
      maxConsecutiveFailures: 3,
      scenarioStorePath: './transcripts/scenarios.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 20000,
      ...config,
    };
    this.loadScenarios();
  }

  /**
   * Creates a new agent and its corresponding cmux pane.
   */
  async createAgent(id: string, splitDirection: 'right' | 'down'): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} already exists`);
    }

    console.log(`[Registry] Creating agent ${id} (split: ${splitDirection})...`);
    const surface = await this.adapter.createPane(splitDirection);
    console.log(`[Registry] Agent ${id} pane created: workspace=${surface.workspaceRef} pane=${surface.paneRef} surface=${surface.surfaceRef}`);
    const agent = new Agent(id, surface);
    this.agents.set(id, agent);
    return agent;
  }

  async startScenario(agentAId: string, agentBId: string, topic: string, maxRepliesPerAgent: number): Promise<ConversationScenario> {
    const agentA = this.getAgent(agentAId);
    const agentB = this.getAgent(agentBId);

    if (agentAId === agentBId) {
      throw new Error('Scenario requires two different agents');
    }

    if ((agentA.status !== 'ready' && agentA.status !== 'busy') || (agentB.status !== 'ready' && agentB.status !== 'busy')) {
      throw new Error('Both agents must be ready before starting a conversation');
    }

    await Promise.all([
      this.requestHealthCheck(agentAId),
      this.requestHealthCheck(agentBId),
    ]);

    const existingScenario = this.findActiveScenarioByAgents(agentAId, agentBId);
    if (existingScenario) {
      return existingScenario;
    }

    const now = new Date().toISOString();
    const scenario: ConversationScenario = {
      id: `scenario-${Date.now()}`,
      agentAId,
      agentBId,
      topic,
      maxRepliesPerAgent,
      replyCounts: {
        [agentAId]: 0,
        [agentBId]: 0,
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'system',
          to: `${agentAId},${agentBId}`,
          payload: `Scenario created: ${topic}`,
        },
      ],
    };

    this.scenarios.set(scenario.id, scenario);
    this.persistScenarios();
    this.emit('scenario', scenario);

    await this.sendProtocol(agentAId, 'EVT', {
      type: 'scenario_start',
      scenarioId: scenario.id,
      peerId: agentBId,
      topic,
      maxReplies: maxRepliesPerAgent,
      initiator: true,
    });

    await this.sendProtocol(agentBId, 'EVT', {
      type: 'scenario_start',
      scenarioId: scenario.id,
      peerId: agentAId,
      topic,
      maxReplies: maxRepliesPerAgent,
      initiator: false,
    });

    return scenario;
  }

  /**
   * Updates the agent status and logs the transition.
   * Also emits a status event for the UI.
   */
  private setAgentStatus(agent: Agent, newStatus: any): void {
    agent.setStatus(newStatus);
    this.emit('status', { id: agent.id, status: newStatus });
  }

  /**
   * Sends the launch command to the agent's pane and starts the polling loop.
   */
  async startAgent(id: string, launchCommand: string): Promise<void> {
    const agent = this.getAgent(id);
    console.log(`[Registry] Starting agent ${id} with command: ${launchCommand}`);
    this.stopPolling(id);
    this.clearReadinessTimeout(id);
    this.pollsInFlight.delete(id);

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

    agent.lineBuffer = '';
    agent.lastSeenText = '';
    agent.lastSeenClean = '';
    agent.pendingOutboundProtocolEchoes = [];
    this.consecutiveFailures.set(id, 0);

    try {
      // Send launch command followed by newline
      console.log(`[Registry] Sending launch command to ${agent.surface.surfaceRef}: ${launchCommand}`);
      await this.adapter.sendText(agent.surface.surfaceRef, `${launchCommand}\n`);
      console.log(`[Registry] Launch command sent to agent ${id}`);
    } catch (err) {
      console.error(`[Registry] Failed to send launch command to agent ${id}:`, err);
      this.setAgentStatus(agent, 'error');
      throw err;
    }

    // Start polling
    console.log(`[Registry] Starting poll loop for agent ${id} (interval: ${this.config.pollIntervalMs}ms, readiness timeout: ${this.config.readinessTimeoutMs}ms)`);
    const interval = setInterval(
      () => this.pollAgent(id),
      this.config.pollIntervalMs
    );
    this.pollIntervals.set(id, interval);

    // Setup readiness timeout
    const timeout = setTimeout(() => {
      if (agent.status === 'starting') {
        console.error(`[Registry] Agent ${id} readiness timeout reached (${this.config.readinessTimeoutMs}ms)`);
        this.setAgentStatus(agent, 'error');
        this.stopPolling(id);
        void this.adapter.notify(
          'Readiness Timeout',
          `Agent ${id} failed to signal READY within ${this.config.readinessTimeoutMs}ms`,
          agent.surface.surfaceRef,
        );
      }
      this.readinessTimeouts.delete(id);
    }, this.config.readinessTimeoutMs);
    this.readinessTimeouts.set(id, timeout);
  }

  /**
   * Removes an agent from the registry and closes its cmux surface.
   */
  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;

    console.log(`[Registry] Removing agent ${id}...`);
    
    this.stopPolling(id);
    this.clearReadinessTimeout(id);
    this.pollsInFlight.delete(id);
    this.consecutiveFailures.delete(id);

    try {
      this.setAgentStatus(agent, 'terminated');
    } catch (err) {
      // If already terminated, this might throw, which is fine to ignore for removal.
    }

    this.agents.delete(id);
    await agent.destroy();

    try {
      await this.adapter.closeSurface(agent.surface.surfaceRef);
      console.log(`[Registry] Agent ${id} surface ${agent.surface.surfaceRef} closed.`);
    } catch (err) {
      console.warn(`[Registry] Failed to close surface for agent ${id}:`, err);
    }
  }

  /**
   * Main polling loop for an agent.
   */
  private async pollAgent(id: string): Promise<void> {
    if (this.pollsInFlight.has(id)) {
      return;
    }

    const agent = this.getAgent(id);
    if (agent.status === 'terminated' || agent.status === 'error') {
      this.stopPolling(id);
      return;
    }

    if (this.hasAgentTimedOut(agent)) {
      console.error(`[Registry] Agent ${id} exceeded idle timeout (${this.config.agentIdleTimeoutMs}ms) while ${agent.status}`);
      this.stopPolling(id);
      this.clearReadinessTimeout(id);
      this.setAgentStatus(agent, 'error');
      return;
    }

    this.pollsInFlight.add(id);
    agent.lastPollAt = Date.now();
    const count = (this.pollCount.get(id) ?? 0) + 1;
    this.pollCount.set(id, count);

    try {
      const result = await this.adapter.readSurface(agent.surface.surfaceRef);
      this.consecutiveFailures.set(id, 0);

      // Log raw surface read while starting or occasionally while busy.
      if (agent.status === 'starting' || (agent.status === 'busy' && count % 120 === 1)) {
        const preview = result.text.slice(-300).replace(/\n/g, '\\n');
        console.log(`[Registry] Poll #${count} for ${id} (status: ${agent.status}), surface tail: "${preview}"`);
      }

      const newText = this.deduplicate(agent, result.text);
      const visibleText = this.suppressOutboundProtocolEchoes(agent, newText);

      if (agent.lastDedupDiverged) {
        await this.processProtocolSnapshot(agent, agent.lastSeenClean);
      }

      if (visibleText) {
        console.log(`[Registry] New text from agent ${id} (${visibleText.length} chars, status: ${agent.status}): "${visibleText.slice(0, 200).replace(/\n/g, '\\n')}"`);
        agent.lastProgressAt = Date.now();
        agent.appendToTranscript(visibleText);
        await this.processNewText(agent, visibleText);

        // Filter protocol lines for the UI display
        const lines = visibleText.split(/(\r?\n)/);
        const filteredLines = lines.filter(line => !line.includes('[NodePTY]:'));
        // Convert bare \n to \r\n for xterm.js (it needs \r to move cursor to column 0)
        const uiText = filteredLines.join('').replace(/\r?\n/g, '\r\n');
        
        if (uiText) {
          // Emit output for UI
          this.emit('output', { id: agent.id, text: uiText });
        }
      }
    } catch (err) {
      const failures = (this.consecutiveFailures.get(id) ?? 0) + 1;
      this.consecutiveFailures.set(id, failures);
      console.error(`[Registry] Poll failure ${failures}/${this.config.maxConsecutiveFailures} for agent ${id}:`, err);

      if (failures >= this.config.maxConsecutiveFailures) {
        this.clearReadinessTimeout(id);
        this.stopPolling(id);
        this.setAgentStatus(agent, 'error');
      }
    } finally {
      this.pollsInFlight.delete(id);
    }
  }

  /**
   * Deduplicates newly read surface text against previously seen text.
   * V1: simple suffix-based approach.
   */
  private deduplicate(agent: Agent, newText: string): string {
    // Compare ANSI-stripped text to avoid false divergence from cursor/color changes
    const newClean = stripAnsi(newText);
    const oldClean = agent.lastSeenClean ?? '';

    if (!oldClean) {
      console.log(`[Registry] Dedup first read for ${agent.id}: ${newClean.length} chars`);
      agent.lastSeenText = newText;
      agent.lastSeenClean = newClean;
      agent.lastDedupDiverged = false;
      return newClean;
    }

    if (newClean.startsWith(oldClean)) {
      const unseenText = newClean.slice(oldClean.length);
      if (unseenText.length === 0) {
        // No new text — completely silent, don't log every poll
      } else {
        console.log(`[Registry] Dedup for ${agent.id}: ${unseenText.length} new chars (total surface: ${newClean.length})`);
      }
      agent.lastSeenText = newText;
      agent.lastSeenClean = newClean;
      agent.lastDedupDiverged = false;
      return unseenText;
    }

    // Terminal wrapped or cleared — we can't reliably derive the unseen suffix.
    // Reset to the current snapshot and skip this poll so future reads can progress again.
    console.log(`[Registry] Dedup reset for agent ${agent.id}: surface text diverged (old: ${oldClean.length} chars, new: ${newClean.length} chars)`);
    agent.lastSeenText = newText;
    agent.lastSeenClean = newClean;
    agent.lastDedupDiverged = true;
    return '';
  }

  private async processProtocolSnapshot(agent: Agent, snapshot: string): Promise<void> {
    agent.lastDedupDiverged = false;

    const lines = snapshot.split(/\r?\n/);
    let recovered = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('[NodePTY]:')) {
        continue;
      }

      recovered += 1;
      await this.handleProtocolLine(agent, line);
    }

    if (recovered > 0) {
      console.log(`[Registry] Recovered ${recovered} protocol line(s) from divergent snapshot for ${agent.id}`);
    }
  }

  /**
   * Cmux writes injected protocol lines back into the terminal surface.
   * Suppress those exact echoes so they don't get parsed as if they came
   * from the agent and don't pollute the UI.
   */
  private suppressOutboundProtocolEchoes(agent: Agent, newText: string): string {
    if (!newText || agent.pendingOutboundProtocolEchoes.length === 0) {
      return newText;
    }

    let remaining = newText;

    while (agent.pendingOutboundProtocolEchoes.length > 0) {
      const nextEcho = agent.pendingOutboundProtocolEchoes[0];
      if (nextEcho === undefined) {
        break;
      }

      if (!remaining.startsWith(nextEcho)) {
        break;
      }

      console.log(`[Registry] Suppressed echoed outbound protocol for ${agent.id}: "${nextEcho.replace(/\n/g, '\\n')}"`);
      remaining = remaining.slice(nextEcho.length);
      agent.pendingOutboundProtocolEchoes.shift();
    }

    return remaining;
  }

  /**
   * Processes newly observed text and scans for protocol lines.
   */
  private async processNewText(agent: Agent, newText: string): Promise<void> {
    agent.lineBuffer += newText;
    console.log(`[Registry] processNewText for ${agent.id}: buffer now ${agent.lineBuffer.length} chars, has newline: ${agent.lineBuffer.includes('\n')}`);

    let newlineIndex: number;
    let lineCount = 0;
    while ((newlineIndex = agent.lineBuffer.indexOf('\n')) !== -1) {
      const line = agent.lineBuffer.slice(0, newlineIndex).trim();
      agent.lineBuffer = agent.lineBuffer.slice(newlineIndex + 1);
      lineCount++;

      if (line.length === 0) continue;

      const isProtocol = line.startsWith('[NodePTY]:');
      console.log(`[Registry] Line ${lineCount} from ${agent.id} (protocol: ${isProtocol}): "${line.slice(0, 200)}"`);

      if (isProtocol) {
        await this.handleProtocolLine(agent, line);
      }
    }

    // Handle protocol lines at end of surface that lack a trailing newline
    const remaining = agent.lineBuffer.trim();
    if (remaining.startsWith('[NodePTY]:')) {
      console.log(`[Registry] Protocol line from ${agent.id} (no trailing newline): "${remaining.slice(0, 200)}"`);
      agent.lineBuffer = '';
      await this.handleProtocolLine(agent, remaining);
    } else if (agent.lineBuffer.length > 0) {
      console.log(`[Registry] Remaining line buffer for ${agent.id} (${agent.lineBuffer.length} chars, no trailing newline): "${agent.lineBuffer.slice(0, 200).replace(/\n/g, '\\n')}"`);
    }
  }

  /**
   * Handles a single protocol line starting with [NodePTY]:
   */
  private async handleProtocolLine(agent: Agent, line: string): Promise<void> {
    console.log(`[Registry] Protocol line from ${agent.id}: ${line}`);

    // Strip prefix to get e.g. "READY:{...}" or "REQ:{...}"
    const body = line.slice('[NodePTY]:'.length);
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
        await this.sendProtocol(agent.id, 'RES', {
          id: reqId,
          status: 'error',
          error: `Unknown tool call: ${call}`,
        });
        return;
    }
  }

  private async handleListAgents(agent: Agent, reqId: string): Promise<void> {
    const agentList = Array.from(this.agents.values()).map(a => ({
      id: a.id,
      status: a.status,
      surface: a.surface,
    }));

    await this.sendProtocol(agent.id, 'RES', {
      id: reqId,
      status: 'success',
      data: { agents: agentList },
    });
  }

  private async handleSendToAgent(agent: Agent, reqId: string, args: any): Promise<void> {
    const { to, payload } = args || {};

    if (!to || payload === undefined) {
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'error',
        error: 'Missing "to" or "payload" in send_to_agent args',
      });
      return;
    }

    // Special target: "user" routes back to the web UI
    if (to === 'user') {
      this.setAgentBusyState(agent, false);
      this.emit('user_message', { from: agent.id, payload });
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'success',
      });
      return;
    }

    try {
      const targetAgent = this.getAgent(to);
      const scenario = this.findActiveScenarioByAgents(agent.id, to);

      if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
        await this.sendProtocol(agent.id, 'RES', {
          id: reqId,
          status: 'error',
          error: `Target agent ${to} is in ${targetAgent.status} state`,
        });
        return;
      }

      if (scenario) {
        const currentCount = scenario.replyCounts[agent.id] ?? 0;
        if (currentCount >= scenario.maxRepliesPerAgent) {
          this.markScenarioCompleted(scenario, `Reply cap reached by ${agent.id}`);
          await this.sendProtocol(agent.id, 'RES', {
            id: reqId,
            status: 'error',
            error: `Scenario ${scenario.id} reply cap reached for ${agent.id}`,
          });
          return;
        }
      }

      // V1 Delivery: write EVT to target terminal
      await this.sendProtocol(targetAgent.id, 'EVT', {
        type: 'message_received',
        from: agent.id,
        payload: payload,
      });

      if (scenario) {
        this.recordScenarioMessage(scenario, {
          kind: 'message',
          timestamp: new Date().toISOString(),
          from: agent.id,
          to,
          payload: String(payload),
        });
      }

      // Confirm to requester
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'success',
      });
    } catch (err) {
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'error',
        error: err instanceof Error ? err.message : `Target agent ${to} not found`,
      });
    }
  }

  private async handleHealthcheckAck(agent: Agent, reqId: string, args: any): Promise<void> {
    const { token, message } = args || {};
    if (typeof token !== 'string' || typeof message !== 'string' || !message.trim()) {
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'error',
        error: 'Missing "token" or "message" in ack_healthcheck args',
      });
      return;
    }

    const pending = this.pendingHealthChecks.get(token);
    if (!pending || pending.agentId !== agent.id) {
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'error',
        error: `Unknown healthcheck token: ${token}`,
      });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingHealthChecks.delete(token);
    pending.resolve({ agentId: agent.id, message });

    await this.sendProtocol(agent.id, 'RES', {
      id: reqId,
      status: 'success',
    });
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
   * Sends a protocol packet back to an agent's terminal stdin.
   * V1 Protocol Rule: [NodePTY]:TYPE:JSON\n
   */
  async sendProtocol(id: string, type: 'RES' | 'EVT', payload: any): Promise<void> {
    const agent = this.getAgent(id);
    const jsonStr = JSON.stringify(payload);
    const line = `[NodePTY]:${type}:${jsonStr}\n`;
    agent.pendingOutboundProtocolEchoes.push(line);

    console.log(`[Registry] Sending ${type} to agent ${id}: ${jsonStr}`);
    await this.adapter.sendText(agent.surface.surfaceRef, line);
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

    const since = agent.lastProgressAt ?? agent.lastPollAt;
    if (!since) {
      return false;
    }

    return Date.now() - since > this.config.agentIdleTimeoutMs;
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

  getScenarios(): ConversationScenario[] {
    return Array.from(this.scenarios.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private loadScenarios(): void {
    const storePath = this.getScenarioStorePath();
    if (!existsSync(storePath)) {
      return;
    }

    try {
      const raw = readFileSync(storePath, 'utf8').trim();
      if (!raw) {
        return;
      }

      const scenarios = JSON.parse(raw) as ConversationScenario[];
      for (const scenario of scenarios) {
        this.scenarios.set(scenario.id, scenario);
      }
    } catch (err) {
      console.error('[Registry] Failed to load scenarios:', err);
    }
  }

  private persistScenarios(): void {
    const storePath = this.getScenarioStorePath();
    mkdirSync(path.dirname(storePath), { recursive: true });
    writeFileSync(
      storePath,
      JSON.stringify(this.getScenarios(), null, 2),
      'utf8',
    );
  }

  private getScenarioStorePath(): string {
    return path.resolve(this.config.scenarioStorePath);
  }

  private findActiveScenarioByAgents(agentAId: string, agentBId: string): ConversationScenario | undefined {
    return this.getScenarios().find((scenario) =>
      scenario.status === 'active' &&
      (
        (scenario.agentAId === agentAId && scenario.agentBId === agentBId) ||
        (scenario.agentAId === agentBId && scenario.agentBId === agentAId)
      )
    );
  }

  private recordScenarioMessage(scenario: ConversationScenario, entry: ScenarioTranscriptEntry): void {
    scenario.transcript.push(entry);
    const nextCount = (scenario.replyCounts[entry.from] ?? 0) + 1;
    scenario.replyCounts[entry.from] = nextCount;
    scenario.updatedAt = entry.timestamp;

    if (nextCount >= scenario.maxRepliesPerAgent) {
      this.markScenarioCompleted(scenario, `Reply cap reached by ${entry.from}`);
      return;
    }

    this.persistScenarios();
    this.emit('scenario', scenario);
  }

  private markScenarioCompleted(scenario: ConversationScenario, reason: string): void {
    if (scenario.status === 'completed') {
      return;
    }

    scenario.status = 'completed';
    scenario.updatedAt = new Date().toISOString();
    scenario.transcript.push({
      kind: 'system',
      timestamp: scenario.updatedAt,
      from: 'system',
      to: `${scenario.agentAId},${scenario.agentBId}`,
      payload: reason,
    });
    this.persistScenarios();
    this.emit('scenario', scenario);
  }

  private stopPolling(id: string): void {
    const interval = this.pollIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(id);
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
    this.persistScenarios();
    for (const pending of this.pendingHealthChecks.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Registry destroyed before healthcheck completed'));
    }
    this.pendingHealthChecks.clear();
    const teardowns: Promise<void>[] = [];
    for (const id of this.agents.keys()) {
      this.stopPolling(id);
      this.clearReadinessTimeout(id);
      this.pollsInFlight.delete(id);
      const agent = this.agents.get(id);
      if (agent) teardowns.push(agent.destroy());
    }
    this.agents.clear();
    await Promise.all(teardowns);
  }
}
