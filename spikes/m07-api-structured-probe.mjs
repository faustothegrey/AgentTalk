#!/usr/bin/env node
// M07 SPIKE (throwaway, isolated — does NOT touch orchestrator/client code).
//
// Goal: de-risk R1 (epic §4) — can a hosted OpenAI-compatible model reliably produce the
// structured JSON `message_type` the consensus protocol requires, when the *orchestrator*
// builds the prompt (the "centralized brain" pattern)? This is the cheapest probe of both R1
// and the centralized-brain viability, with zero impact on current code.
//
// Usage:
//   PROVIDER=openai   node spikes/m07-api-structured-probe.mjs           # uses OPENAI_API_KEY
//   PROVIDER=openrouter MODEL=nousresearch/hermes-4-405b node spikes/...  # OPENROUTER_API_KEY
//   PROVIDER=nous      MODEL=<hermes-id> node spikes/...                  # NOUS_API_KEY
//
// It sends a handful of representative planning turns, forces response_format json_object,
// parses the reply, and reports whether each turn yielded a legal `message_type`.

const PROVIDERS = {
  openai:     { baseUrl: 'https://api.openai.com/v1',                 keyEnv: 'OPENAI_API_KEY',     defaultModel: 'gpt-4o-mini' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',             keyEnv: 'OPENROUTER_API_KEY', defaultModel: 'openai/gpt-4o-mini' },
  nous:       { baseUrl: 'https://inference-api.nousresearch.com/v1', keyEnv: 'NOUS_API_KEY',       defaultModel: 'Hermes-4-405B' },
  google:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-2.5-flash' },
};

const providerName = (process.env.PROVIDER || 'openai').toLowerCase();
const provider = PROVIDERS[providerName];
if (!provider) { console.error(`Unknown PROVIDER=${providerName}; expected one of ${Object.keys(PROVIDERS)}`); process.exit(2); }
const apiKey = process.env[provider.keyEnv];
if (!apiKey) { console.error(`Missing ${provider.keyEnv} in env for provider=${providerName}`); process.exit(2); }
const model = process.env.MODEL || provider.defaultModel;

// Condensed but faithful slice of the real planning briefing (see design/planning-protocol.md).
const PROTOCOL_BRIEF = [
  'You are a PLANNER in a two-agent team reaching a formal agreement via a strict protocol.',
  'The orchestrator enforces protocol state based ONLY on the message_type in your JSON reply.',
  'Legal message_types: opinion, agreement_proposal, agreement_acceptance, submit_plan, fact_collection_end, ack_planning_protocol.',
  'You MUST reply with a single JSON object: {"message_type": "<one legal type>", "message_payload": { ... }}.',
  'No prose outside the JSON.',
].join('\n');

// Each scenario: a system+user context, and the set of message_types that would be LEGAL here.
const SCENARIOS = [
  { name: 'discussion-turn', legal: ['opinion', 'agreement_proposal'],
    user: 'Discussion phase. Your peer said: "We should refactor the auth module." Respond with your opinion to advance the discussion.' },
  { name: 'proposal-turn', legal: ['agreement_proposal'],
    user: 'You and your peer are clearly aligned on refactoring the auth module into a service. Formally propose that the discussion has converged.' },
  { name: 'submit-turn', legal: ['submit_plan'],
    user: 'Your peer just sent agreement_acceptance. You did NOT send the acceptance, so you must now submit the final implementation plan. message_payload.plan must contain the concrete plan.' },
];

async function callModel(userMsg) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(providerName === 'openrouter' ? { 'HTTP-Referer': 'https://agenttalk.local', 'X-Title': 'AgentTalk M07 spike' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [ { role: 'system', content: PROTOCOL_BRIEF }, { role: 'user', content: userMsg } ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  if (!res.ok) { throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`); }
  const json = await res.json();
  return { content: json.choices?.[0]?.message?.content ?? '', usage: json.usage };
}

function parseMessageType(content) {
  try { const o = JSON.parse(content); return typeof o.message_type === 'string' ? o.message_type : null; }
  catch { return null; }
}

async function main() {
  console.log(`[spike] provider=${providerName} model=${model} baseUrl=${provider.baseUrl}`);
  let pass = 0; let totalIn = 0; let totalOut = 0;
  for (const s of SCENARIOS) {
    try {
      const { content, usage } = await callModel(s.user);
      totalIn += usage?.prompt_tokens || 0; totalOut += usage?.completion_tokens || 0;
      const mt = parseMessageType(content);
      const ok = mt && s.legal.includes(mt);
      if (ok) pass++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(16)} -> message_type=${mt ?? '<unparseable>'}  (legal: ${s.legal.join('|')})`);
      if (!ok) console.log(`        raw: ${content.slice(0, 160).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`  ERROR ${s.name.padEnd(16)} -> ${e.message}`);
    }
  }
  console.log(`[spike] result: ${pass}/${SCENARIOS.length} scenarios produced a legal message_type  (tokens in=${totalIn} out=${totalOut})`);
  process.exit(pass === SCENARIOS.length ? 0 : 1);
}

main().catch((e) => { console.error('[spike] fatal', e); process.exit(1); });
