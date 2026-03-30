#!/usr/bin/env node
// LLM Agent for AgentTalk V1
// Speaks the [AgentTalk]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { createConversationRuntime } from './lib/conversation-runtime.mjs';
import { emitEvent, emitReady, emitRequest, parseInboundProtocolLine } from './lib/protocol.mjs';
import { callProvider, getProviderLimit, resolveProvider } from './lib/provider-runtime.mjs';

const provider = resolveProvider((process.argv[2] ?? 'gemini').toLowerCase());
const selectedModel = getSelectedModelArg(process.argv);
const limit = getProviderLimit(provider, selectedModel);

let currentUsage = 0;
let busy = false;
const messageQueue = [];
const conversationRuntime = createConversationRuntime();

function enqueueEvent(evt) {
  messageQueue.push(evt);
  void processQueue();
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
    // Team events carry their own prompt and request builder
    if (evt._teamPrompt) {
      const { response, tokens } = await callProvider(provider, selectedModel, evt._teamPrompt);
  

      if (!response) {
        console.error(`[llm-agent] No reply generated for team event; skipping`);
        return;
      }

      console.error(`[llm-agent] Team reply (${response.length} chars): ${response.slice(0, 200)}`);
      const requests = evt._buildRequest(response);
      if (Array.isArray(requests)) {
        for (const req of requests) {
          emitRequest(req);
        }
      } else {
        emitRequest(requests);
      }
      return;
    }

    const prompt = conversationRuntime.buildPrompt(evt);
    if (!prompt) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    const { response, tokens } = await callProvider(provider, selectedModel, prompt);


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

function handleTeamTaskAssign(evt) {
  console.error(`[llm-agent] Team task assigned (planner): ${evt.description}`);
  const prompt = [
    'You are the PLANNER in a two-agent team. Your job is to analyze a task and create a clear, actionable implementation strategy.',
    'Be specific about what files to change, what approach to take, and any risks.',
    'Keep the plan concise but thorough enough for another agent (the worker) to execute it independently.',
    '',
    `Task: ${evt.description}`,
    '',
    'Respond with your implementation plan only. No preamble.',
  ].join('\n');

  enqueueTeamEvent(evt, prompt, (response) => ({
    id: `req-${Date.now()}`,
    call: 'submit_plan',
    args: { plan: response },
  }));
}

function handleTeamWorkAssign(evt) {
  console.error(`[llm-agent] Team work assigned (worker): ${evt.description}`);
  const prompt = [
    'You are the WORKER in a two-agent team. The planner has created a plan for you to review.',
    'Critically evaluate the plan. Consider:',
    '- Is the approach sound?',
    '- Are there risks or missing steps?',
    '- Can you realistically execute this?',
    '',
    `Original task: ${evt.description}`,
    '',
    `Planner\'s plan:`,
    evt.plan,
    '',
    'Respond with EXACTLY one of these formats:',
    'If you ACCEPT: Start your response with "ACCEPT" on the first line, then proceed to execute the task.',
    'If you REFUSE: Start your response with "REFUSE:" followed by your reason on the same line.',
  ].join('\n');

  enqueueTeamEvent(evt, prompt, (response) => {
    const firstLine = response.split('\n')[0].trim();
    if (firstLine.startsWith('REFUSE:') || firstLine === 'REFUSE') {
      const reason = firstLine.replace(/^REFUSE:?\s*/, '') || 'No specific reason given';
      return {
        id: `req-${Date.now()}`,
        call: 'submit_work_response',
        args: { accepted: false, reason },
      };
    }

    // Accepted — submit acceptance, then we'll submit the result
    // The response after "ACCEPT\n" is the actual work output
    const workOutput = response.replace(/^ACCEPT\s*\n?/, '').trim();
    return [
      {
        id: `req-${Date.now()}`,
        call: 'submit_work_response',
        args: { accepted: true },
      },
      {
        id: `req-${Date.now() + 1}`,
        call: 'submit_work_result',
        args: { result: workOutput || 'Task completed.' },
      },
    ];
  });
}

function enqueueTeamEvent(evt, prompt, buildRequest) {
  messageQueue.push({ _teamPrompt: prompt, _buildRequest: buildRequest, ...evt });
  void processQueue();
}

function handleInboundEvent(evt) {
  if (evt.type === 'team_task_assign') {
    handleTeamTaskAssign(evt);
    return;
  }

  if (evt.type === 'team_work_assign') {
    handleTeamWorkAssign(evt);
    return;
  }

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
