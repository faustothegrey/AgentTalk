export type ApiProvider = 'google' | 'openrouter' | 'nous';

export interface ApiCallArgs {
  provider: ApiProvider;
  model?: string;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: 'json_object' };
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
  const text = json.choices?.[0]?.message?.content ?? '';
  
  return {
    text,
    usage: json.usage,
  };
}
