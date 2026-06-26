export type ApiProvider = 'google' | 'openrouter' | 'nous';

/** OpenAI-compatible `tool_choice` directive (M10-T4). `'required'` forces *some* tool call. */
export type ToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

export interface ApiCallArgs {
  provider: ApiProvider;
  model?: string;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: 'json_object' };
  /**
   * M10-T4: OpenAI-compatible function tools. Transport-only — this layer stays schema-agnostic and
   * passes the array through verbatim (the protocol tool is built by the caller). When present with
   * {@link tool_choice}, the model is constrained to call a tool at generation time.
   */
  tools?: unknown[];
  tool_choice?: ToolChoice;
}

export interface ApiCallResult {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

const PROVIDERS: Record<ApiProvider, { baseUrl: string; keyEnv: string; defaultModel: string }> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
  },
  nous: {
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    keyEnv: 'HERMES_API_KEY',
    defaultModel: 'deepseek-v4-flash',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
  },
};

export async function callApi(args: ApiCallArgs, fetchFn = fetch): Promise<ApiCallResult> {
  const providerDef = PROVIDERS[args.provider];
  if (!providerDef) {
    throw new Error(`Unknown provider: ${args.provider}`);
  }

  const apiKey = process.env[providerDef.keyEnv];
  if (!apiKey) {
    throw new Error(`Missing ${providerDef.keyEnv} in environment for provider=${args.provider}`);
  }

  const model = args.model || providerDef.defaultModel;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (args.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://agenttalk.local';
    headers['X-Title'] = 'AgentTalk M07 API Agent';
  }

  const body: any = {
    model,
    messages: args.messages,
    temperature: 0,
  };

  if (args.response_format) {
    body.response_format = args.response_format;
  }

  // M10-T4: forward function tools + the choice directive when present (only on structured turns).
  // Absent these, the body is byte-identical to the pre-T4 request (behavior preserved).
  if (args.tools) {
    body.tools = args.tools;
  }
  if (args.tool_choice) {
    body.tool_choice = args.tool_choice;
  }

  const res = await fetchFn(`${providerDef.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  // M10-T4: when a tool was forced, the envelope arrives as the tool call's `arguments` (a JSON
  // string of `{ message_type, message_payload }`) rather than `message.content`. Prefer it so the
  // downstream parser is reused verbatim; fall back to `content` for the pre-T4 (no-tools) path.
  const message = json.choices?.[0]?.message;
  const text = message?.tool_calls?.[0]?.function?.arguments ?? message?.content ?? '';

  return {
    text,
    usage: json.usage,
  };
}
