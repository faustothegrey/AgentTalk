import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';
import { Agent } from './agent.js';
import type { CmuxAdapter } from './cmux-adapter.js';

export class Registry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readinessTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private pollsInFlight: Set<string> = new Set();
  private pollCount: Map<string, number> = new Map();

  constructor(
    private readonly adapter: CmuxAdapter,
    private readonly config = {
      pollIntervalMs: 250,
      readinessTimeoutMs: 60000,
      maxConsecutiveFailures: 3,
    }
  ) {
    super();
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
    agent.lineBuffer = '';
    agent.lastSeenText = '';
    agent.lastSeenClean = '';
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

    this.pollsInFlight.add(id);
    agent.lastPollAt = Date.now();
    const count = (this.pollCount.get(id) ?? 0) + 1;
    this.pollCount.set(id, count);

    try {
      const result = await this.adapter.readSurface(agent.surface.surfaceRef);
      this.consecutiveFailures.set(id, 0);

      // Log raw surface read periodically (every 20 polls) or always while starting
      if (agent.status === 'starting' || count % 20 === 1) {
        const preview = result.text.slice(-300).replace(/\n/g, '\\n');
        console.log(`[Registry] Poll #${count} for ${id} (status: ${agent.status}), surface tail: "${preview}"`);
      }

      const newText = this.deduplicate(agent, result.text);

      if (newText) {
        console.log(`[Registry] New text from agent ${id} (${newText.length} chars, status: ${agent.status}): "${newText.slice(0, 200).replace(/\n/g, '\\n')}"`);
        agent.lastProgressAt = Date.now();
        // newText is already ANSI-stripped (dedup now compares clean text)
        agent.appendToTranscript(newText);
        await this.processNewText(agent, newText);

        // Filter protocol lines for the UI display
        const lines = newText.split(/(\r?\n)/);
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
      return unseenText;
    }

    // Terminal wrapped or cleared — we can't reliably derive the unseen suffix.
    // Reset to the current snapshot and skip this poll so future reads can progress again.
    console.log(`[Registry] Dedup reset for agent ${agent.id}: surface text diverged (old: ${oldClean.length} chars, new: ${newClean.length} chars)`);
    agent.lastSeenText = newText;
    agent.lastSeenClean = newClean;
    return '';
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
      this.emit('user_message', { from: agent.id, payload });
      await this.sendProtocol(agent.id, 'RES', {
        id: reqId,
        status: 'success',
      });
      return;
    }

    try {
      const targetAgent = this.getAgent(to);

      if (targetAgent.status !== 'ready' && targetAgent.status !== 'busy') {
        await this.sendProtocol(agent.id, 'RES', {
          id: reqId,
          status: 'error',
          error: `Target agent ${to} is in ${targetAgent.status} state`,
        });
        return;
      }

      // V1 Delivery: write EVT to target terminal
      await this.sendProtocol(targetAgent.id, 'EVT', {
        type: 'message_received',
        from: agent.id,
        payload: payload,
      });

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

  private async handleResponse(agent: Agent, payload: any): Promise<void> {
    console.log(`[Registry] RES from ${agent.id}:`, payload);
  }

  private async handleEvent(agent: Agent, payload: any): Promise<void> {
    console.log(`[Registry] EVT from ${agent.id}:`, payload);
  }

  /**
   * Sends a protocol packet back to an agent's terminal stdin.
   * V1 Protocol Rule: [NodePTY]:TYPE:JSON\n
   */
  async sendProtocol(id: string, type: 'RES' | 'EVT', payload: any): Promise<void> {
    const agent = this.getAgent(id);
    const jsonStr = JSON.stringify(payload);
    const line = `[NodePTY]:${type}:${jsonStr}\n`;

    console.log(`[Registry] Sending ${type} to agent ${id}: ${jsonStr}`);
    await this.adapter.sendText(agent.surface.surfaceRef, line);
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
