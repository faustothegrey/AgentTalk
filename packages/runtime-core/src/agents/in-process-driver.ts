import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { Agent } from './agent.js';
import { parseWithRetry, translateStructuredResponse } from './translation.js';
import { WORKER_RESPONSE_INSTRUCTIONS, buildProtocolToolSchema } from './response-schema.js';
import { createConversationRuntime, type ConversationEvent } from '../conversations/runtime.js';
import type { Registry } from '../registry/registry.js';
import { McpError } from './completer.js';
import { type Completer, type ApiProvider, ApiCompleter } from '@agenttalk/llm-client';

export interface InProcessDriverOptions {
  provider?: ApiProvider;
  model?: string;
  fetchFn?: typeof fetch;
  completer?: Completer;
}

export class InProcessAgentDriver {
  private runtime = createConversationRuntime();
  private isRunning = false;
  private completer: Completer;
  private isSessionStale = false;

  constructor(
    private agent: Agent,
    private registry: Registry,
    options: InProcessDriverOptions = {}
  ) {
    if (options.completer) {
      this.completer = options.completer;
    } else {
      const provider = options.provider || 'google';
      // Inject the consensus protocol tool builder (llm-client stays consensus-agnostic; the
      // structured-turn behaviour is identical to before the extraction).
      this.completer = new ApiCompleter(provider, options.model, options.fetchFn, buildProtocolToolSchema);
    }
  }

  markSessionStale(): void {
    this.isSessionStale = true;
  }

  start(): void {
    this.isRunning = true;
    if (this.agent.status === 'creating') {
      this.agent.setStatus('starting');
    }
    this.agent.setStatus('ready');
    // Fire and forget the loop
    void this.loop();
  }

  stop(): void {
    this.isRunning = false;
    // We can inject a dummy turn to unblock awaitTurn if needed,
    // or just let it hang until destroy.
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      try {
        const turn = await this.agent.awaitTurn();
        if (!this.isRunning) break;
        
        if (turn.turnId) {
          this.agent.currentTurnId = turn.turnId as string;
        } else if (turn.messageId) {
          this.agent.currentTurnId = turn.messageId as string;
        }
        
        this.agent.setStatus('busy');
        await this.handleTurn(turn as unknown as ConversationEvent);
        if (this.isRunning && this.agent.status === 'busy') {
          this.agent.setStatus('ready');
        }
      } catch (err) {
        console.error(`[InProcessAgentDriver ${this.agent.id}] error:`, err);
        if (this.isRunning) {
          this.agent.setStatus('error');
          break; // Stop the loop on error to avoid infinite crash loops
        }
      }
    }
  }

  private async handleTurn(evt: ConversationEvent): Promise<void> {
    if (evt.type === 'conversation_start') {
      const res = this.runtime.startConversation(evt, (msg) => this.agent.queueTurn(msg as Record<string, unknown>, true));
      if (!res.ok) {
        throw new Error(`Failed to start conversation: ${res.error}`);
      }
      return;
    }
    
    if (evt.type === 'conversation_end') {
      this.runtime.endConversation();
      this.stop();
      return;
    }

    if (evt.type === 'fact_collection_begin') {
      await this.handleFactCollectionBegin(evt);
      return;
    }

    if (evt.type === 'team_work_assign') {
      await this.handleTeamWorkAssign(evt);
      return;
    }

    let prompt: string | null = null;
    let expectsStructured = false;

    if (evt.type === 'custom_event_request' && (evt as any).event === 'ack_planning_protocol') {
      prompt = (evt as any).prompt || null;
      expectsStructured = true;
    } else {
      if (this.isSessionStale) {
        this.isSessionStale = false;
        prompt = this.runtime.buildPrompt(evt);
      } else if (this.completer.maintainsSession) {
        prompt = this.runtime.buildLatestTurnPrompt(evt);
      } else {
        prompt = this.runtime.buildPrompt(evt);
      }
      expectsStructured = this.runtime.expectsStructuredResponse(evt);
    }

    if (!prompt) return;

    const executePrompt = async (p: string) => {
      const text = await this.executeApiPrompt(p, expectsStructured);
      if (text) {
        this.runtime.recordAssistantReply(text);
      }
      return text;
    };

    const text = await executePrompt(prompt);
    if (!text) return;

    let request;

    if (expectsStructured) {
      const { structured, error } = await parseWithRetry(text, executePrompt);
      if (error) {
        this.agent.queueTurn({
          type: 'message_received',
          from: 'system',
          payload: error
        }, true);
        return;
      }

      this.runtime.recordStructuredMessageType(structured!.message_type);

      if (structured!.message_type === 'opinion' && this.runtime.shouldAutoPropose()) {
        const opinionReq = {
          call: 'consensus_respond',
          args: { action: 'opinion', payload: structured!.message_payload }
        };
        await this.registry.handleMcpToolCall(this.agent.id, opinionReq.call, opinionReq.args);
        
        request = {
          call: 'consensus_respond',
          args: { action: 'agreement_proposal', payload: { proposal: (structured!.message_payload as any).text } }
        };
      } else {
        request = translateStructuredResponse(evt, structured!, (e, reply) => this.runtime.buildProtocolRequest(e, reply));
      }
    } else {
      // Graceful degrade on non-planning turn
      request = this.runtime.buildProtocolRequest(evt, text);
    }

    if (request) {
      await this.registry.handleMcpToolCall(this.agent.id, request.call, request.args);
    }
  }

  private async executeApiPrompt(prompt: string, expectsStructured: boolean, opts?: { cwd?: string; timeoutMs?: number; throwOnExecError?: boolean }): Promise<string | null> {
    const completerOpts: any = { expectsStructured };
    if (opts?.cwd !== undefined) completerOpts.cwd = opts.cwd;
    if (opts?.timeoutMs !== undefined) completerOpts.timeoutMs = opts.timeoutMs;
    try {
      const res = await this.completer.complete(prompt, completerOpts);
      return res.text;
    } catch (err) {
      // M08-T3: the WORKER path opts in with throwOnExecError so a genuine exec crash
      // (McpError from T1) is rethrown and caught by handleTeamWorkAssign, which fences
      // the task to awaiting_operator. Every OTHER caller (planner paths) omits the opt and
      // keeps the M08-T1 behaviour below byte-for-byte. Only McpError rethrows — a normal
      // empty/`null` response is never mistaken for a crash (LB-15/LB-16 ②).
      if (opts?.throwOnExecError && err instanceof McpError) {
        throw err;
      }
      // M08-T1: a rejected exec (timeout / mid-exec disconnect) must not hang the turn or crash
      // the loop. Report it (no silent swallow) and end the turn via the existing `null` "no text"
      // contract. We deliberately do NOT throw here: throwing would reach the loop's catch, set the
      // agent to `error`, and trip M03 Shared-Fate — a lifecycle decision reserved for M08-T2/T3.
      console.warn(`[InProcessAgentDriver ${this.agent.id}] exec failed, ending turn: ${(err as Error).message}`);
      return null;
    }
  }

  private async handleFactCollectionBegin(evt: ConversationEvent): Promise<void> {
    const prompt = [
      'You are the PLANNER in a two-agent team. Before discussion begins, you must collect facts about the codebase relevant to the task.',
      '',
      `Task: ${(evt as any).description}`,
      '',
      'Your job now is to investigate the codebase: read files, search for patterns, identify relevant code areas, and build your understanding of the current state.',
      'Focus on gathering concrete facts — file paths, function signatures, existing patterns, dependencies — that will inform your planning discussion.',
      'Do NOT propose solutions yet. Just collect and organize the relevant facts.',
      '',
      'When you are done investigating, respond with a summary of what you found.',
      '',
      '## Response format',
      '',
      'You MUST respond with a single JSON object:',
      '',
      '```json',
      '{',
      '  "message_type": "fact_collection_end",',
      '  "message_payload": { "summary": "your findings summary here" }',
      '}',
      '```',
      '',
      'Put your complete findings summary inside the "summary" field. No preamble.',
    ].join('\\n');

    const text = await this.executeApiPrompt(prompt, true);
    if (!text) {
      await this.registry.handleMcpToolCall(this.agent.id, 'consensus_respond', { action: 'fact_collection_end', payload: { summary: 'No facts collected.' } });
      return;
    }

    const { structured } = await parseWithRetry(text, async (p) => this.executeApiPrompt(p, true));
    
    if (structured && structured.message_type === 'fact_collection_end') {
      await this.registry.handleMcpToolCall(this.agent.id, 'consensus_respond', { action: 'fact_collection_end', payload: { summary: structured.message_payload.summary } });
    } else {
      await this.registry.handleMcpToolCall(this.agent.id, 'consensus_respond', { action: 'fact_collection_end', payload: { summary: text } });
    }
  }

  private async handleTeamWorkAssign(evt: ConversationEvent): Promise<void> {
    const prompt = [
      'You are the WORKER in a two-agent team. The planner has created a plan for you to review.',
      'Critically evaluate the plan. Consider:',
      '- Is the approach sound?',
      '- Are there risks or missing steps?',
      '- Can you realistically execute this?',
      '- Can you execute it strictly inside a `git worktree`?',
      '',
      'You must use strictly `git worktree` for this task.',
      'If you cannot or will not use a git worktree, you must refuse and abort the task.',
      '',
      `Original task: ${(evt as any).description}`,
      '',
      `## Final Plan`,
      `${(evt as any).plan}`,
      WORKER_RESPONSE_INSTRUCTIONS,
    ].join('\\n');

    // M08-T3: the worker opts in to throwOnExecError so a genuine exec crash (McpError)
    // is rethrown and fenced below, rather than swallowed to `null` (the G3 hang). Planner
    // paths never pass this opt, so their null-swallow stays byte-for-byte.
    const execOpts: { cwd?: string; timeoutMs?: number; throwOnExecError?: boolean } = { throwOnExecError: true };
    if (this.completer.maintainsSession) {
      const taskId = (evt as any).taskId || 'unknown';
      const cwd = `/tmp/agentalk-task-${taskId}`;
      if (!existsSync(cwd)) {
        try {
          execSync(`git worktree add ${cwd} -b task-${taskId}`, { stdio: 'ignore' });
        } catch (e) {
          // best effort
        }
      }
      execOpts.cwd = cwd;
      execOpts.timeoutMs = 600_000;
    }

    // M08-T3 worker effect-fence: a genuine worker-exec crash (McpError, rethrown via
    // throwOnExecError) is caught at the end of this method and diverts the task to
    // awaiting_operator (stop-and-ask) — instead of hanging (G3) or bubbling to a generic
    // agent error. Every other outcome, including a normal empty `null` response, is unchanged.
    try {
    const text = await this.executeApiPrompt(prompt, true, execOpts);
    if (!text) return;

    const { structured } = await parseWithRetry(text, async (p) => this.executeApiPrompt(p, true, execOpts));
    
    if (!structured) {
      const firstLine = (text.split('\\n')[0] || '').trim();
      if (firstLine.startsWith('REFUSE:') || firstLine === 'REFUSE') {
        const reason = firstLine.replace(/^REFUSE:?\\s*/, '') || 'No specific reason given';
        await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: false, reason });
        return;
      }

      const workOutput = text.replace(/^ACCEPT\\s*\\n?/, '').trim();
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: true });
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_result', { result: workOutput || 'Task completed.' });
      return;
    }

    if (structured.message_type === 'work_refuse') {
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: false, reason: (structured.message_payload as any).reason });
      return;
    }

    if (structured.message_type === 'work_accept') {
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: true });
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_result', { result: (structured.message_payload as any).text || 'Task completed.' });
      return;
    }

    const payloadText = (structured.message_payload as any).text || (structured.message_payload as any).plan || (structured.message_payload as any).reason || '';
    await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: true });
    await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_result', { result: payloadText || 'Task completed.' });
    } catch (err) {
      if (err instanceof McpError) {
        await this.registry.pauseTaskForOperator(this.agent.id, (err as Error).message);
        return;
      }
      throw err;
    }
  }
}
