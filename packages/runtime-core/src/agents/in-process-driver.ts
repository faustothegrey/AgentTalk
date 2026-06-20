import { Agent } from './agent.js';
import { callApi, ApiProvider } from './api-client.js';
import { parseWithRetry, translateStructuredResponse } from './translation.js';
import { createConversationRuntime, ConversationEvent } from '../conversations/runtime.js';
import type { Registry } from '../registry/registry.js';

export interface InProcessDriverOptions {
  provider?: ApiProvider;
  model?: string;
  fetchFn?: typeof fetch;
}

export class InProcessAgentDriver {
  private runtime = createConversationRuntime();
  private isRunning = false;
  private provider: ApiProvider;
  private model?: string;
  private fetchFn: typeof fetch;

  constructor(
    private agent: Agent,
    private registry: Registry,
    options: InProcessDriverOptions = {}
  ) {
    this.provider = options.provider || 'google';
    this.model = options.model;
    this.fetchFn = options.fetchFn || fetch;
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
        
        this.agent.setStatus('busy');
        await this.handleTurn(turn as ConversationEvent);
        if (this.isRunning) {
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

    const prompt = this.runtime.buildPrompt(evt);
    if (!prompt) return;

    const expectsStructured = this.runtime.expectsStructuredResponse(evt);

    const executePrompt = async (p: string) => {
      const res = await callApi({
        provider: this.provider,
        model: this.model,
        messages: [{ role: 'user', content: p }],
        response_format: expectsStructured ? { type: 'json_object' } : undefined
      }, this.fetchFn);
      
      this.runtime.recordAssistantReply(res.text);
      return res.text;
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
        const opinionReq = this.runtime.buildProtocolRequest(evt, (structured!.message_payload as any).text);
        await this.registry.handleMcpToolCall(this.agent.id, opinionReq.call, opinionReq.args);
        
        request = {
          call: 'agreement_proposal',
          args: { proposal: (structured!.message_payload as any).text }
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
}
