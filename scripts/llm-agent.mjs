#!/usr/bin/env node
// LLM Agent for AgentTalk V1
// Speaks the [AgentTalk]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { createConversationRuntime } from './lib/conversation-runtime.mjs';
import { emitEvent, emitReady, emitRequest, parseInboundProtocolLine } from './lib/protocol.mjs';
import { callProvider, getProviderLimit, resolveProvider, scrapeExternalUsage } from './lib/provider-runtime.mjs';

const provider = resolveProvider((process.argv[2] ?? 'gemini').toLowerCase());
const selectedModel = getSelectedModelArg(process.argv);
const limit = getProviderLimit(provider, selectedModel);

let currentUsage = 0;
let busy = false;
const messageQueue = [];
const conversationRuntime = createConversationRuntime();

function emitExternalUsage(output) {
  emitEvent({
    type: 'external_usage',
    provider,
    output,
  });
}

async function refreshExternalUsage() {
  try {
    const output = await scrapeExternalUsage(provider);
    if (output) {
      emitExternalUsage(output);
    }
  } catch (err) {
    console.error(`[llm-agent] Failed to scrape external usage: ${err.message}`);
    emitExternalUsage(`Usage unavailable: ${err.message}`);
  }
}

function enqueueEvent(evt) {
  messageQueue.push(evt);
  void processQueue();
}

function emitUsageUpdated(tokens) {
  if (tokens <= 0) return;
  currentUsage += tokens;
  emitEvent({
    type: 'usage_updated',
    total: currentUsage,
    limit,
  });
  console.error(`[llm-agent] Usage: +${tokens} tokens (Total: ${currentUsage}/${limit})`);
}

async function processQueue() {
  if (busy || messageQueue.length === 0) return;
  busy = true;
  emitEvent({ type: 'busy_state', busy: true });

  const evt = messageQueue.shift();
  if (!evt) {
    busy = false;
    emitEvent({ type: 'busy_state', busy: false });
    return;
  }

  if (evt.type === 'healthcheck') {
    console.error(`[llm-agent] Healthcheck requested (token: ${evt.token})`);
  } else {
    console.error(`[llm-agent] Message from ${evt.from}: ${evt.payload}`);
  }

  try {
    const prompt = conversationRuntime.buildPrompt(evt);
    if (!prompt) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    const { response, tokens } = await callProvider(provider, selectedModel, prompt);
    emitUsageUpdated(tokens);

    if (!response) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    conversationRuntime.recordAssistantReply(response);
    console.error(`[llm-agent] Reply (${response.length} chars): ${response.slice(0, 200)}`);
    emitRequest(conversationRuntime.buildProtocolRequest(evt, response));
  } catch (err) {
    console.error(`[llm-agent] Error: ${err.message}`);
  } finally {
    busy = false;
    emitEvent({ type: 'busy_state', busy: false });
    if (messageQueue.length > 0) {
      void processQueue();
    }
  }
}

function handleInboundEvent(evt) {
  if (evt.type === 'message_received' || evt.type === 'healthcheck') {
    enqueueEvent(evt);
    return;
  }

  if (evt.type === 'conversation_start') {
    const result = conversationRuntime.startConversation(evt, enqueueEvent);
    if (!result.ok) {
      console.error(`[llm-agent] ${result.error}`);
      return;
    }

    console.error(`[llm-agent] Conversation started with peers: ${result.peerIds.join(', ')}; max replies: ${result.maxReplies}`);
    return;
  }

  if (evt.type === 'conversation_end') {
    console.error(`[llm-agent] Conversation ended: ${evt.reason}`);
    conversationRuntime.endConversation();
  }
}

function handleInboundLine(line) {
  const parsed = parseInboundProtocolLine(line);
  if (!parsed) {
    return;
  }

  if (parsed.type === 'EVT') {
    try {
      handleInboundEvent(JSON.parse(parsed.json));
    } catch {
      console.error('[llm-agent] Failed to parse EVT:', parsed.json);
    }
    return;
  }

  if (parsed.type === 'RES') {
    console.error(`[llm-agent] Got RES: ${line}`);
    return;
  }

  console.error(`[llm-agent] Unknown protocol: ${line}`);
}

emitReady(`agent-${provider}-${Date.now()}`);
emitEvent({ type: 'usage_updated', total: 0, limit });
emitExternalUsage('Loading usage...');
console.error(`[llm-agent] Provider: ${provider}, Model: ${selectedModel || 'default'}, Token Limit: ${limit}`);

void refreshExternalUsage();
setInterval(() => {
  void refreshExternalUsage();
}, 300000);

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  handleInboundLine(trimmed);
});

function getSelectedModelArg(argv) {
  const modelIndex = argv.indexOf('--model');
  if (modelIndex === -1 || !argv[modelIndex + 1]) {
    return null;
  }

  return argv[modelIndex + 1];
}
