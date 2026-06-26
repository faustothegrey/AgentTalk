import { callApi, type ApiProvider, type ApiCallArgs } from './api-client.js';

/** A single chat message (OpenAI-compatible role/content pair). */
export interface ChatMessage {
  role: string;
  content: string;
}

export interface CompleterResult {
  text: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface CompleterOptions {
  /**
   * Ask the backend to emit a constrained, structured response. The API path realises this by
   * sending the {@link ApiCompleter}'s injected `structuredToolBuilder` tool with
   * `tool_choice:'required'`; backends that ignore it fall back to plain text. Consensus-agnostic
   * here — the *meaning* of "structured" (which tool) is injected by the caller, not known to this package.
   */
  expectsStructured?: boolean;
  cwd?: string;
  timeoutMs?: number;
  /**
   * Multi-turn history. When provided, it is sent verbatim as the message list (role-aware),
   * superseding the single `prompt` string. Absent → a single `{ role:'user', content: prompt }`.
   */
  messages?: ChatMessage[];
}

/**
 * The uniform plug every chat backend implements. A caller programs against this and does not care
 * whether the turn is completed by a direct provider HTTP call ({@link ApiCompleter}) or delegated
 * to an external agent (an MCP-backed completer). `maintainsSession` tells a multi-turn wrapper
 * whether the backend keeps its own conversation (send only the new turn) or is stateless (replay history).
 */
export interface Completer {
  maintainsSession?: boolean;
  complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult>;
}

/** Builds an OpenAI-compatible function tool to force on a structured turn. Injected, so this package stays domain-agnostic. */
export type StructuredToolBuilder = () => unknown;

/**
 * Direct provider-HTTP completer (stateless). Calls {@link callApi} with the prompt (or `messages`)
 * and returns the text. On a structured turn it forces the injected tool with `tool_choice:'required'`
 * + `response_format:json_object`; with no builder injected (plain-chat use) the structured flag is a no-op.
 */
export class ApiCompleter implements Completer {
  maintainsSession = false;
  constructor(
    private provider: ApiProvider,
    private model?: string,
    private fetchFn: typeof fetch = fetch,
    private structuredToolBuilder?: StructuredToolBuilder,
  ) {}

  async complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult> {
    const args: ApiCallArgs = {
      provider: this.provider,
      messages: opts?.messages ?? [{ role: 'user', content: prompt }],
    };
    if (this.model) args.model = this.model;
    if (opts?.expectsStructured && this.structuredToolBuilder) {
      // The injected tool's strict schema constrains the structural action at generation time;
      // `tool_choice:'required'` forces the call. `response_format` is kept alongside the tool.
      // (Behaviour identical to the pre-extraction ApiCompleter when the protocol builder is injected.)
      args.response_format = { type: 'json_object' };
      args.tools = [this.structuredToolBuilder()];
      args.tool_choice = 'required';
    }

    const result = await callApi(args, this.fetchFn);

    const ret: CompleterResult = { text: result.text || '' };
    if (result.usage) ret.usage = result.usage;
    return ret;
  }
}
