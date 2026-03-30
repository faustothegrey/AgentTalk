#!/usr/bin/env node
// LLM Agent for AgentTalk V1
// Speaks the [AgentTalk]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { createConversationRuntime } from './lib/conversation-runtime.mjs';
import { emitEvent, emitReady, emitRequest, parseInboundProtocolLine } from './lib/protocol.mjs';
import { callProvider, getProviderLimit, resolveProvider } from './lib/provider-runtime.mjs';

function parseArgs(argv) {
  const provider = argv[2] ?? 'gemini';
  const modelIndex = argv.indexOf('--model');
  const model = modelIndex !== -1 && argv[modelIndex + 1] ? argv[modelIndex + 1] : null;

  return { provider, model };
}

const { provider: providerName, model: selectedModel } = parseArgs(process.argv);
const provider = resolveProvider(providerName.toLowerCase());
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
    if (evt._teamHandler) {
      await evt._teamHandler();
      return;
    }

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
  enqueueTeamHandler(evt, async () => {
    const progressUpdates = [];

    const progressPrompt = [
      'You are the PLANNER in a two-agent team.',
      'The user wants to follow your planning activity while you elaborate the final plan.',
      'Write a chatty planning update to the user: what you are evaluating, what candidate direction looks strongest so far, and what tradeoff or uncertainty you are still resolving.',
      'Do not give the final plan yet.',
      'Use 3-5 sentences, plain text only.',
      '',
      `Task: ${evt.description}`,
    ].join('\n');

    const { response: progressUpdate } = await callProvider(provider, selectedModel, progressPrompt);
    if (progressUpdate) {
      progressUpdates.push(progressUpdate);
      console.error(`[llm-agent] Planner progress update (${progressUpdate.length} chars): ${progressUpdate.slice(0, 200)}`);
      emitRequest({
        id: `req-${Date.now()}`,
        call: 'send_to_agent',
        args: {
          to: 'user',
          payload: progressUpdate,
        },
      });
    } else {
      console.error('[llm-agent] Planner progress update was empty; continuing to final plan');
    }

    const directionPrompt = [
      'You are the PLANNER in a two-agent team.',
      'Send another chatty progress update to the user now that you are converging on the final plan.',
      'State the concrete refactoring target you are leaning toward, why it is the best small-scoped change, and what the final plan will likely contain.',
      'Do not output the final numbered plan yet.',
      'Use 2-4 sentences, plain text only.',
      '',
      `Task: ${evt.description}`,
      progressUpdates.length > 0 ? `Earlier progress update:\n${progressUpdates.join('\n\n')}` : '',
    ].filter(Boolean).join('\n');

    const { response: directionUpdate } = await callProvider(provider, selectedModel, directionPrompt);
    if (directionUpdate) {
      progressUpdates.push(directionUpdate);
      console.error(`[llm-agent] Planner direction update (${directionUpdate.length} chars): ${directionUpdate.slice(0, 200)}`);
      emitRequest({
        id: `req-${Date.now()}`,
        call: 'send_to_agent',
        args: {
          to: 'user',
          payload: directionUpdate,
        },
      });
    }

    const finalPlanPrompt = [
      'You are the PLANNER in a two-agent team. Your job is to analyze a task and create a clear, actionable implementation strategy.',
      'Be specific about what files to change, what approach to take, and any risks.',
      'Keep the plan concise but thorough enough for another agent (the worker) to execute it independently.',
      'The final plan must be implementation-ready, not an intention to analyze later.',
      'Do not say you will "find", "analyze", "look for", or "identify" the refactoring opportunity later.',
      'You must already choose the concrete target and describe the exact change to make.',
      'Name the file(s) or code area(s) you intend to change whenever possible.',
      '',
      `Task: ${evt.description}`,
      progressUpdates.length > 0 ? `Earlier progress updates:\n${progressUpdates.join('\n\n')}` : '',
      '',
      'Your final response will trigger the explicit submit_plan completion signal.',
      'Only give your finished implementation plan in that final response. No preamble.',
    ].filter(Boolean).join('\n');

    const { response: finalPlan } = await callProvider(provider, selectedModel, finalPlanPrompt);
    if (!finalPlan) {
      console.error('[llm-agent] No final plan generated for team event; skipping');
      return;
    }

    console.error(`[llm-agent] Final planner reply (${finalPlan.length} chars): ${finalPlan.slice(0, 200)}`);
    emitRequest({
      id: `req-${Date.now()}`,
      call: 'submit_plan',
      args: { plan: finalPlan },
    });
  });
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

function enqueueTeamHandler(evt, teamHandler) {
  messageQueue.push({ _teamHandler: teamHandler, ...evt });
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
console.error(`[llm-agent] Provider: ${provider}, Model: ${selectedModel || 'default'}, Token Limit: ${limit}`);

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  handleInboundLine(trimmed);
});
