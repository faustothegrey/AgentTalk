import type { Completer, CompleterOptions, ChatMessage } from './completer.js';

export interface ChatSessionOptions {
  /** Optional system prompt, seeded as the first message and preserved across {@link ChatSession.reset}. */
  system?: string;
}

/**
 * A thin multi-turn conversation over any {@link Completer}. Holds the running message history and
 * adapts per backend: a stateless backend (`maintainsSession=false`, e.g. ApiCompleter) gets the full
 * history replayed each turn; a session-keeping backend (`maintainsSession=true`, e.g. an MCP agent
 * that owns its own conversation) gets only the latest user turn. The plug abstracts the rest.
 */
export class ChatSession {
  private history: ChatMessage[] = [];

  constructor(private readonly completer: Completer, opts?: ChatSessionOptions) {
    if (opts?.system) this.history.push({ role: 'system', content: opts.system });
  }

  /** The conversation so far (read-only snapshot). */
  get messages(): ReadonlyArray<ChatMessage> {
    return this.history;
  }

  /** Send a user turn, append the assistant reply to history, and return the reply text. */
  async send(userText: string, opts?: CompleterOptions): Promise<string> {
    this.history.push({ role: 'user', content: userText });

    const sendOpts: CompleterOptions = { ...opts };
    if (!this.completer.maintainsSession) {
      // Stateless backend: replay the whole conversation (role-aware) each turn.
      sendOpts.messages = [...this.history];
    }
    // Session-keeping backend: send only this turn (the backend remembers the rest).
    const res = await this.completer.complete(userText, sendOpts);

    this.history.push({ role: 'assistant', content: res.text });
    return res.text;
  }

  /** Clear the conversation, preserving an initial system message if one was set. */
  reset(): void {
    this.history = this.history.filter((m) => m.role === 'system').slice(0, 1);
  }
}
