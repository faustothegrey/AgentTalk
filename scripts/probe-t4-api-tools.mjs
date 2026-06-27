import { parseArgs } from 'node:util';
import { buildProtocolToolSchema, parseStructuredResponse } from '@agenttalk/runtime-core/agents/response-schema.js';

const PROVIDERS = {
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

const options = {
  help: { type: 'boolean', short: 'h' },
  provider: { type: 'string', short: 'p' },
  model: { type: 'string', short: 'm' },
};

function printHelp() {
  console.log(`
Usage: node scripts/probe-t4-api-tools.mjs [options]

Probe API providers to check their support for the M10-T4 strict structured-output combo
(tools + tool_choice: 'required' + response_format: { type: 'json_object' }).

Options:
  -h, --help       Show this help message
  -p, --provider   Run for a specific provider only (google, openrouter, nous)
  -m, --model      Override the default model for the specified provider (requires --provider)

Default behavior: Probes all providers that have their API key present in the environment.
`);
}

async function probeProvider(providerId, overrideModel) {
  const providerDef = PROVIDERS[providerId];
  if (!providerDef) {
    console.error(`Unknown provider: ${providerId}`);
    return { provider: providerId, status: 'error_unknown_provider' };
  }

  const apiKey = process.env[providerDef.keyEnv];
  if (!apiKey) {
    return { provider: providerId, status: 'skipped', detail: 'No API key' };
  }

  const model = overrideModel || providerDef.defaultModel;
  
  const messages = [{
    role: 'user',
    content: 'Call the respond tool to acknowledge the planning protocol. Use message_type: "ack_planning_protocol" and an empty message_payload. Respond in JSON.',
  }];
  
  const tools = [buildProtocolToolSchema()];
  const tool_choice = 'required';
  const response_format = { type: 'json_object' };
  
  const body = {
    model,
    messages,
    temperature: 0,
    tools,
    tool_choice,
    response_format,
  };

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://agenttalk.local';
    headers['X-Title'] = 'AgentTalk M10-T4 Probe';
  }

  try {
    const res = await fetch(`${providerDef.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { 
        provider: providerId, 
        model,
        status: 'http_reject', 
        detail: `HTTP ${res.status}: ${text.slice(0, 150).replace(/\\n/g, ' ')}...` 
      };
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message;
    
    if (!message?.tool_calls || message.tool_calls.length === 0) {
      return { provider: providerId, model, status: 'no_tool_call', detail: 'Received 2xx but no tool_calls' };
    }

    const toolCall = message.tool_calls[0];
    const argsString = toolCall.function?.arguments;

    if (!argsString) {
      return { provider: providerId, model, status: 'invalid_arguments', detail: 'tool_calls missing arguments' };
    }

    try {
      const parsed = parseStructuredResponse(argsString);
      return { provider: providerId, model, status: 'fit', detail: `Valid payload: ${parsed.message_type}` };
    } catch (err) {
      return { provider: providerId, model, status: 'invalid_arguments', detail: `Parse error: ${err.message}` };
    }

  } catch (err) {
    return { provider: providerId, model, status: 'error', detail: `Transport error: ${err.message}` };
  }
}

async function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs({ options, strict: true });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    printHelp();
    process.exit(1);
  }

  const { values } = parsedArgs;

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.model && !values.provider) {
    console.error('Error: --model requires --provider to be specified.');
    process.exit(1);
  }

  const providersToTest = values.provider ? [values.provider] : Object.keys(PROVIDERS);

  console.log('--- M10-T4 Live API Probe ---');
  
  const results = [];
  for (const provider of providersToTest) {
    console.log(`Probing ${provider}...`);
    const result = await probeProvider(provider, values.provider === provider ? values.model : null);
    results.push(result);
  }

  console.log('\\n--- Results ---');
  console.table(results, ['provider', 'model', 'status', 'detail']);
  
  const fitCount = results.filter(r => r.status === 'fit').length;
  console.log(`\\nTotal: ${results.length} | Fit: ${fitCount} | Rejected/Error: ${results.length - fitCount - results.filter(r=>r.status==='skipped').length} | Skipped: ${results.filter(r=>r.status==='skipped').length}`);
}

main().catch(console.error);
