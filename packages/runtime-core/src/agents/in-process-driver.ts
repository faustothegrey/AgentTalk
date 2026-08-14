import { Agent } from './agent.js';
import { parseWithRetry, translateStructuredResponse } from './translation.js';
import { WORKER_RESPONSE_INSTRUCTIONS, WORKTREE_CONTEXT, buildProtocolToolSchema } from './response-schema.js';
import { createConversationRuntime, type ConversationEvent } from '../conversations/runtime.js';
import type { Registry } from '../registry/registry.js';
import { McpError } from './completer.js';
import { AgentReasonedError, reasonOf } from '@agenttalk/contracts/types';
import { type Completer, type ApiProvider, ApiCompleter } from '@agenttalk/llm-client';

export const DEFAULT_WORKER_TURN_TIMEOUT_MS = 600_000;

/**
 * Per-turn deadline for a worker's exec turn, overridable via
 * `AGENTTALK_WORKER_TURN_TIMEOUT_MS`. Only a finite positive integer overrides; anything else
 * (absent, empty, `0`, negative, `NaN`) falls back to the default, so a malformed value can never
 * remove the deadline — an unbounded worker turn would defeat the only anti-hang rail we have while
 * [[BL-028]] is dead.
 */
export function resolveWorkerTurnTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.AGENTTALK_WORKER_TURN_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_WORKER_TURN_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WORKER_TURN_TIMEOUT_MS;
  return Math.floor(parsed);
}

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
      this.registry.notifyAgentStatus(this.agent, 'starting');
    }
    this.registry.notifyAgentStatus(this.agent, 'ready');
    // Fire and forget the loop
    void this.loop();
  }

  stop(): void {
    this.isRunning = false;
    // We can inject a dummy turn to unblock awaitTurn if needed,
    // or just let it hang until destroy.
  }

  /**
   * BL-047 — bring a stopped loop back for a NEW assignment.
   *
   * `conversation_end` stops the loop (see handleTurn). For an attached agent that is the
   * end of the road: the external client shut down with the conversation. For an in-process
   * agent there is no client — this loop IS the agent — so the agent went on advertising
   * `ready` with nothing behind it, and the next conversation's startup healthcheck was
   * queued and never pulled (TL-007: `did not respond to healthcheck within 30000ms`).
   *
   * Reviving here rather than never stopping is the deliberate choice: it keeps the
   * post-conversation window exactly as it is today. Turns queued while the loop is stopped
   * are NOT lost — `awaitTurn` drains `pendingTurns` first, so the healthcheck that arrived
   * just before this call is the first thing the restarted loop picks up.
   *
   * No-op when already running, so it is safe to call on every inbound assignment.
   */
  resume(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    // The conversation runtime was already reset by `endConversation()`, and the completer
    // is stateless for the API path — so this is the same idle state `start()` leaves behind,
    // minus the status transitions (the agent is already `ready`).
    void this.loop();
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

        // BL-028 T3a — the obligation clock starts when the turn is DELIVERED. The attached path
        // stamps this at its own `await_turn`; this is the in-process sibling. Subsequent progress
        // is stamped for both transports at the `handleMcpToolCall` chokepoint, which this driver
        // also calls for its own actions.
        this.agent.lastProgressAt = Date.now();

        this.registry.notifyAgentStatus(this.agent, 'busy');
        await this.handleTurn(turn as unknown as ConversationEvent);
        if (this.isRunning && this.agent.status === 'busy') {
          this.registry.notifyAgentStatus(this.agent, 'ready');
        }
      } catch (err) {
        console.error(`[InProcessAgentDriver ${this.agent.id}] error:`, err);
        if (this.isRunning) {
          if (this.agent.status !== 'error' && this.agent.status !== 'terminated') {
            // BL-084 T2 (was BL-077: notifyAgentStatus, deliberately non-propagating).
            // The transition is now CLASSIFIED and judged by isFaultClass at the single
            // decision point. This site is a catch-all and cannot know its cause, so
            // `reasonOf` yields `driver-error-unclassified` (NON-fault) unless the throw
            // carried a reason of its own — which makes T2 strictly additive: propagation
            // switches on only where a fault was positively identified.
            this.registry.reportAgentError(this.agent, reasonOf(err));
          }
          break; // Stop the loop on error to avoid infinite crash loops
        }
      }
    }
  }

  private async handleTurn(evt: ConversationEvent): Promise<void> {
    if (evt.type === 'conversation_start') {
      const res = this.runtime.startConversation(evt, (msg) => this.agent.queueTurn(msg as Record<string, unknown>, true));
      if (!res.ok) {
        // BL-084 T2: the one fault this path can positively identify. The name has been in the
        // taxonomy since T1 (contracts/types.ts) with nothing setting it — this is that site.
        throw new AgentReasonedError(
          "conversation-start-failed",
          `Failed to start conversation: ${res.error}`,
        );
      }
      return;
    }
    
    if (evt.type === 'conversation_end') {
      this.runtime.endConversation();
      if (this.agent.status === 'busy') {
        this.registry.notifyAgentStatus(this.agent, 'ready');
      }
      this.agent.currentTurnId = undefined;
      // BL-047: the loop still stops here, for EVERY transport — deliberately. Leaving it
      // running instead lets the ended conversation's in-flight relays keep ping-ponging
      // (see `resume()` and the note in registry.sendProtocol). An in-process agent is
      // brought back by `resume()` when it is pulled into NEW work.
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

    const healthcheckExecOpts = evt.type === 'healthcheck' && Number.isFinite(evt.timeoutMs)
      ? { timeoutMs: Number(evt.timeoutMs), timeoutBackstopGraceMs: 0 }
      : undefined;

    const executePrompt = async (p: string, opts?: { cwd?: string; timeoutMs?: number; timeoutBackstopGraceMs?: number; throwOnExecError?: boolean }) => {
      const text = await this.executeApiPrompt(p, expectsStructured, opts);
      if (text) {
        this.runtime.recordAssistantReply(text);
      }
      return text;
    };

    const text = await executePrompt(prompt, healthcheckExecOpts);
    if (!text) return;

    let request;

    if (expectsStructured) {
      const { structured, error } = await parseWithRetry(text, (p) => executePrompt(p, healthcheckExecOpts));
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

  private async executeApiPrompt(prompt: string, expectsStructured: boolean, opts?: { cwd?: string; timeoutMs?: number; timeoutBackstopGraceMs?: number; throwOnExecError?: boolean }): Promise<string | null> {
    const completerOpts: any = { expectsStructured };
    if (opts?.cwd !== undefined) completerOpts.cwd = opts.cwd;
    // BL-128 — EVERY exec path forwards a deadline, not just the worker's (PO decision 2026-08-14,
    // option (a): fix the inversion, not the number). This one site is the chokepoint: the five
    // `executeApiPrompt` callers all pass through it, so a path cannot be missed by omission the way
    // it could if each call site forwarded its own.
    //
    // What was wrong: only the worker branch passed `timeoutMs` (`:391`, gated on
    // `maintainsSession`), so every OTHER exec turn fell back to `DEFAULT_EXEC_TIMEOUT_MS` = 120s —
    // against a 180s non-reply threshold. The guard tore the turn down 60s BEFORE the threshold
    // could mature, `loop()`'s catch ended the turn, and the obligation was gone before the sweep
    // could ever see it. Planner turns therefore ran at ONE FIFTH of a worker's deadline while doing
    // work that exceeds it: an S3 planner turn was killed mid-thought at exactly 120s and its
    // completed response discarded.
    //
    // Same 600s default as the worker (PO), same env override, so an operator sizes one deadline
    // rather than two — note that `AGENTTALK_WORKER_TURN_TIMEOUT_MS` now moves planner turns too.
    // An explicit caller value still wins: the healthcheck's short deadline (`:199-201`) and the
    // worker's resolved one are unchanged.
    if (opts?.timeoutMs !== undefined) completerOpts.timeoutMs = opts.timeoutMs;
    else completerOpts.timeoutMs = resolveWorkerTurnTimeoutMs();
    if (opts?.timeoutBackstopGraceMs !== undefined) completerOpts.timeoutBackstopGraceMs = opts.timeoutBackstopGraceMs;
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
      // BL-062: '\\n' is a literal backslash-n, not a newline — this prompt used to reach the
      // model as one line with the escape printed through it as text.
    ].join('\n');

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
    // BL-062: only a planner produces a plan. A worker-only team has neither, but used to be
    // handed this same plan-review prompt anyway — with the goal synthesized into a stand-in
    // "plan" (team-coordinator's buildWorkerPlan) — so the task arrived twice and the worker was
    // told to *critique* work it was there to *do*. A worker that complied would return a
    // critique, change no files, and report completed: indistinguishable from a model taking the
    // task and skipping it, which is exactly the false accusation BL-059 records. Branch on the
    // plan actually existing rather than on a role flag, so the shape follows the data.
    const plan = (evt as any).plan;
    const prompt = (plan
      ? [
          'You are the WORKER in a two-agent team. The planner has created a plan for you to review.',
          'Critically evaluate the plan. Consider:',
          '- Is the approach sound?',
          '- Are there risks or missing steps?',
          '- Can you realistically execute this?',
          '',
          // BL-053: information, not a requirement — see WORKTREE_CONTEXT for why the old
          // "use a worktree or refuse" text had to go.
          WORKTREE_CONTEXT,
          '',
          `Original task: ${(evt as any).description}`,
          '',
          `## Final Plan`,
          `${plan}`,
          WORKER_RESPONSE_INSTRUCTIONS,
        ]
      : [
          'You are the WORKER. You have been assigned a task to carry out.',
          'Do the work the task describes: make the changes, and verify them.',
          '',
          // BL-053: information, not a requirement — see WORKTREE_CONTEXT for why the old
          // "use a worktree or refuse" text had to go.
          WORKTREE_CONTEXT,
          '',
          `## Your task`,
          `${(evt as any).description}`,
          WORKER_RESPONSE_INSTRUCTIONS,
        ]
    ).join('\n');

    // M08-T3: the worker opts in to throwOnExecError so a genuine exec crash (McpError)
    // is rethrown and fenced below, rather than swallowed to `null` (the G3 hang). Planner
    // paths never pass this opt, so their null-swallow stays byte-for-byte.
    const execOpts: { cwd?: string; timeoutMs?: number; throwOnExecError?: boolean } = { throwOnExecError: true };
    if (this.completer.maintainsSession) {
      const taskId = (evt as any).taskId || 'unknown';
      // BL-053: `cwd` is a task-scoped directory NAME, deliberately relative — never a path.
      // The worker anchors it under the workdir it was assigned and provisions the worktree
      // itself, because the worker is the only party that knows that directory: in attach mode
      // the operator launches agents out-of-band, so the orchestrator never learns their workdir
      // (`workdir` appears nowhere in this repo). Sending a name and letting the worker resolve
      // it is what keeps the two ends honest.
      //
      // This used to be `execSync('git worktree add /tmp/agentalk-task-<id> …')` right here, with
      // no `cwd` option — so it ran in the ORCHESTRATOR's process cwd. Two consequences, both
      // real: the worktree belonged to whatever repo the orchestrator happened to start in (the
      // real checkout, if you weren't careful), and the worker was handed an absolute path
      // outside its own workdir — silently overriding the containment BL-052 exists to provide.
      // gemini honoured that path and escaped its workdir every turn; claude and codex discarded
      // it and stayed put. That disagreement is what made the work "vanish" and cost us the false
      // accusation recorded in BL-059.
      execOpts.cwd = `agentalk-task-${taskId}`;
      // The per-turn deadline for a WORKER's exec turn. 600s was fine while autonomous tasks were
      // single-defect fixes, but rung 5 finished in ~10 minutes — i.e. at the cap — and a larger
      // task (a refactor threaded through several call sites) would be killed mid-turn and read as
      // a stalled worker. Configurable so an operator can size the deadline to the task instead of
      // editing the engine before every run. **Default unchanged at 600s**: absent or unparseable
      // env ⇒ byte-identical behaviour to before.
      execOpts.timeoutMs = resolveWorkerTurnTimeoutMs();
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

    // BL-076: the raw response is the last line of defence for the worker's REPORT. A structured
    // message that parses but carries no text — a bare `ack_planning_protocol`, or a `work_accept`
    // whose `text` is the empty string that validatePayload permits — used to be answered with the
    // literal 'Task completed.': a placeholder asserting success while carrying no evidence of it,
    // with the real report sitting unused in `text`. That is how both rung-4 runs came back
    // reportless while the commit was on disk, and it is what left `completed` unchallenged
    // (BL-062). Fall back to what the worker actually said before falling back to a placeholder.
    if (structured.message_type === 'work_accept') {
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: true });
      await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_result', { result: (structured.message_payload as any).text || text.trim() || 'Task completed.' });
      return;
    }

    const payloadText = (structured.message_payload as any).text || (structured.message_payload as any).plan || (structured.message_payload as any).reason || '';
    await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_response', { accepted: true });
    await this.registry.handleMcpToolCall(this.agent.id, 'submit_work_result', { result: payloadText || text.trim() || 'Task completed.' });
    } catch (err) {
      if (err instanceof McpError) {
        await this.registry.pauseTaskForOperator(this.agent.id, (err as Error).message);
        return;
      }
      throw err;
    }
  }
}
