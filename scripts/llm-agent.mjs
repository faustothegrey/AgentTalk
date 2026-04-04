#!/usr/bin/env node
// LLM Agent for AgentTalk V1
// Speaks the [AgentTalk]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import path from 'path';
import { createConversationRuntime, extractCallMarkers, extractSystemRequiredCall } from './lib/conversation-runtime.mjs';
import { createRequestIdGenerator } from './lib/request-id.mjs';
import { createExecutor, normalizeRequestedExecutionMode } from './lib/executor-runtime.mjs';
import { emitEvent, emitReady, emitRequest, parseInboundProtocolLine } from './lib/protocol.mjs';
import { getProviderLimit, resolveProvider } from './lib/provider-runtime.mjs';

function parseArgs(argv) {
  const provider = argv[2] ?? 'gemini';
  const modelIndex = argv.indexOf('--model');
  const model = modelIndex !== -1 && argv[modelIndex + 1] ? argv[modelIndex + 1] : null;
  const executionModeIndex = argv.indexOf('--execution-mode');
  const executionMode = executionModeIndex !== -1 && argv[executionModeIndex + 1]
    ? argv[executionModeIndex + 1]
    : process.env.AGENTTALK_EXECUTION_MODE;

  return { provider, model, executionMode };
}

function parseInteractiveCommandOverrideFromEnv() {
  const raw = process.env.AGENTTALK_INTERACTIVE_COMMAND_JSON;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    const command = typeof parsed.command === 'string' ? parsed.command : undefined;
    const args = Array.isArray(parsed.args) ? parsed.args.filter((value) => typeof value === 'string') : [];
    const env = parsed.env && typeof parsed.env === 'object'
      ? { ...process.env, ...parsed.env }
      : process.env;

    if (!command) {
      return undefined;
    }

    return { command, args, env };
  } catch (err) {
    console.error(`[llm-agent] Ignoring invalid AGENTTALK_INTERACTIVE_COMMAND_JSON: ${err.message}`);
    return undefined;
  }
}

const {
  provider: providerName,
  model: selectedModel,
  executionMode: requestedExecutionModeInput,
} = parseArgs(process.argv);
const provider = resolveProvider(providerName.toLowerCase());
const limit = getProviderLimit(provider, selectedModel);
const requestedWorkingDirectory = process.env.AGENTTALK_WORKDIR;
const requestedExecutionMode = normalizeRequestedExecutionMode(requestedExecutionModeInput);
const interactiveCommandOverride = parseInteractiveCommandOverrideFromEnv();

if (requestedWorkingDirectory) {
  const resolvedWorkingDirectory = path.resolve(requestedWorkingDirectory);
  process.chdir(resolvedWorkingDirectory);
  console.error(`[llm-agent] Working directory set to ${resolvedWorkingDirectory}`);
}

let currentUsage = 0;
let busy = false;
const messageQueue = [];
const conversationRuntime = createConversationRuntime();
const nextRequestId = createRequestIdGenerator();
const CONTROL_CALLS = new Set(['agreement_proposal', 'agreement_reached', 'ack_planning_protocol']);
const pendingControlCalls = new Set();
const pendingControlRequestIds = new Map();
const {
  requestedExecutionMode: normalizedRequestedExecutionMode,
  resolvedExecutionMode,
  executor,
} = createExecutor({
  providerName: provider,
  selectedModel,
  requestedExecutionMode,
  ...(interactiveCommandOverride ? { interactiveCommandOverride } : {}),
});

function enqueueEvent(evt) {
  messageQueue.push(evt);
  void processQueue();
}

function emitTrackedRequest(request) {
  if (!request || typeof request !== 'object' || typeof request.call !== 'string' || typeof request.id !== 'string') {
    emitRequest(request);
    return true;
  }

  const call = request.call;
  if (CONTROL_CALLS.has(call) && pendingControlCalls.has(call)) {
    console.error(`[llm-agent] Suppressing duplicate in-flight control call: ${call}`);
    return false;
  }

  emitRequest(request);

  if (CONTROL_CALLS.has(call)) {
    pendingControlCalls.add(call);
    pendingControlRequestIds.set(request.id, call);
  }

  return true;
}

function handleResponseLine(payloadText) {
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return;
  }

  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') {
    return;
  }

  const call = pendingControlRequestIds.get(payload.id);
  if (!call) {
    return;
  }

  pendingControlRequestIds.delete(payload.id);
  pendingControlCalls.delete(call);
}

function emitSessionUpdate() {
  emitEvent({
    type: 'session_update',
    sessionStatus: executor.getStatus(),
    requestedExecutionMode: normalizedRequestedExecutionMode,
    resolvedExecutionMode,
  });
}

async function executePrompt(idPrefix, prompt) {
  return executor.executeTurn({
    id: `${idPrefix}-${Date.now()}`,
    prompt,
    onStderrChunk: (chunk) => process.stderr.write(chunk),
  });
}



async function processQueue() {
  if (busy || messageQueue.length === 0) return;
  busy = true;
  emitEvent({ type: 'busy_state', busy: true });
  emitSessionUpdate();

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
    if (evt.type === 'custom_event_request' && typeof evt.event === 'string') {
      const call = evt.event.trim();
      if (call) {
        console.error(`[llm-agent] Complying with custom_event_request: ${call}`);
        emitTrackedRequest({
          id: nextRequestId(),
          call,
          ...(evt.args && typeof evt.args === 'object' ? { args: evt.args } : {}),
        });
        return;
      }
    }

    const requiredCall = extractSystemRequiredCall(evt);
    if (requiredCall) {
      console.error(`[llm-agent] Complying with required system event: ${requiredCall}`);
      emitTrackedRequest({
        id: nextRequestId(),
        call: requiredCall,
      });
      return;
    }

    // Team events carry their own prompt and request builder
    if (evt._teamHandler) {
      await evt._teamHandler();
      return;
    }

    if (evt._teamPrompt) {
      const { response } = await executePrompt('team-turn', evt._teamPrompt);

      if (!response) {
        console.error(`[llm-agent] No reply generated for team event; skipping`);
        return;
      }

      console.error(`[llm-agent] Team reply (${response.length} chars): ${response.slice(0, 200)}`);
      const requests = evt._buildRequest(response);
      if (Array.isArray(requests)) {
        for (const req of requests) {
          emitTrackedRequest(req);
        }
      } else {
        emitTrackedRequest(requests);
      }
      return;
    }

    const prompt = conversationRuntime.buildPrompt(evt);
    if (!prompt) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    const { response } = await executePrompt('conversation-turn', prompt);

    if (!response) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    conversationRuntime.recordAssistantReply(response);
    console.error(`[llm-agent] Reply (${response.length} chars): ${response.slice(0, 200)}`);

    // Check for [CALL:...] protocol markers in the LLM response
    const markers = extractCallMarkers(response);
    if (markers.length > 0) {
      const marker = markers[0]; // use first marker only
      console.error(`[llm-agent] Detected protocol marker: [CALL:${marker.call}]`);

      // Send the discussion text (with marker stripped) to the peer, if non-empty
      if (marker.cleanedText) {
        const messageRequest = conversationRuntime.buildProtocolRequest(evt, marker.cleanedText);
        messageRequest.id = nextRequestId();
        emitTrackedRequest(messageRequest);
      }

      // Emit the protocol call
      const callArgs = marker.call === 'submit_plan'
        ? { plan: marker.cleanedText || response }
        : {};

      emitTrackedRequest({
        id: nextRequestId(),
        call: marker.call,
        args: callArgs,
      });
    } else {
      const request = conversationRuntime.buildProtocolRequest(evt, response);
      request.id = nextRequestId();
      emitTrackedRequest(request);
    }
  } catch (err) {
    console.error(`[llm-agent] Error: ${err.message}`);
    emitTrackedRequest({
      id: nextRequestId(),
      call: 'send_to_agent',
      args: { to: 'user', payload: `[Agent error] ${err.message}` },
    });
    emitSessionUpdate();
  } finally {
    busy = false;
    emitEvent({ type: 'busy_state', busy: false });
    emitSessionUpdate();
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

    const { response: progressUpdate } = await executePrompt('planner-progress', progressPrompt);
    if (progressUpdate) {
      progressUpdates.push(progressUpdate);
      console.error(`[llm-agent] Planner progress update (${progressUpdate.length} chars): ${progressUpdate.slice(0, 200)}`);
      emitTrackedRequest({
        id: nextRequestId(),
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

    const { response: directionUpdate } = await executePrompt('planner-direction', directionPrompt);
    if (directionUpdate) {
      progressUpdates.push(directionUpdate);
      console.error(`[llm-agent] Planner direction update (${directionUpdate.length} chars): ${directionUpdate.slice(0, 200)}`);
      emitTrackedRequest({
        id: nextRequestId(),
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

    const { response: finalPlan } = await executePrompt('planner-final', finalPlanPrompt);
    if (!finalPlan) {
      console.error('[llm-agent] No final plan generated for team event; skipping');
      return;
    }

    console.error(`[llm-agent] Final planner reply (${finalPlan.length} chars): ${finalPlan.slice(0, 200)}`);
    emitTrackedRequest({
      id: nextRequestId(),
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
    '- Can you execute it strictly inside a `git worktree`?',
    '',
    'You must use strictly `git worktree` for this task.',
    'If you cannot or will not use a git worktree, you must refuse and abort the task.',
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
        id: nextRequestId(),
        call: 'submit_work_response',
        args: { accepted: false, reason },
      };
    }

    // Accepted — submit acceptance, then we'll submit the result
    // The response after "ACCEPT\n" is the actual work output
    const workOutput = response.replace(/^ACCEPT\s*\n?/, '').trim();
    return [
      {
        id: nextRequestId(),
        call: 'submit_work_response',
        args: { accepted: true },
      },
      {
        id: nextRequestId(),
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


let brainstormContext = null;

function handleBrainstormStart(evt) {
  console.error(`[llm-agent] Brainstorm started: topic="${evt.topic}", peers=${evt.peerIds.join(',')}, initiator=${evt.initiator}`);
  brainstormContext = {
    teamId: evt.teamId,
    taskId: evt.taskId,
    topic: evt.topic,
    peerIds: evt.peerIds,
    maxReplies: evt.maxReplies,
    repliesSent: 0,
  };

  if (evt.initiator) {
    const prompt = [
      `You are in a brainstorm session with ${evt.peerIds.length} other agents.`,
      `Topic: ${evt.topic}`,
      `You have up to ${evt.maxReplies} replies. You are the initiator — open the discussion.`,
      'Be concise. Share your initial perspective and invite the others to respond.',
    ].join('\n');

    enqueueTeamEvent(evt, prompt, (response) => {
      brainstormContext.repliesSent++;
      return {
        id: nextRequestId(),
        call: 'send_to_agent',
        args: { to: evt.peerIds[0], payload: response },
      };
    });
  }
}

function handleBrainstormMessage(evt) {
  if (!brainstormContext) {
    enqueueEvent(evt);
    return;
  }

  if (brainstormContext.repliesSent >= brainstormContext.maxReplies) {
    console.error(`[llm-agent] Brainstorm reply cap reached, ignoring message from ${evt.from}`);
    return;
  }

  const prompt = [
    `You are in a brainstorm session on: ${brainstormContext.topic}`,
    `You have ${brainstormContext.maxReplies - brainstormContext.repliesSent} replies left.`,
    `${evt.from} says: ${evt.payload}`,
    'Respond with your perspective. Build on ideas, challenge assumptions, or introduce new angles. Be concise.',
  ].join('\n');

  enqueueTeamEvent(evt, prompt, (response) => {
    brainstormContext.repliesSent++;
    return {
      id: nextRequestId(),
      call: 'send_to_agent',
      args: {
        to: evt.from,
        payload: response,
        ...(typeof evt.messageId === 'string' ? { replyToMessageId: evt.messageId } : {}),
      },
    };
  });
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

  if (evt.type === 'brainstorm_start') {
    handleBrainstormStart(evt);
    return;
  }

  if (evt.type === 'brainstorm_end') {
    console.error(`[llm-agent] Brainstorm ended: ${evt.reason}`);
    brainstormContext = null;
    return;
  }

  if (evt.type === 'custom_event_request') {
    enqueueEvent(evt);
    return;
  }

  if (evt.type === 'message_received' || evt.type === 'healthcheck') {
    if (brainstormContext && evt.type === 'message_received' && evt.from !== 'user') {
      handleBrainstormMessage(evt);
      return;
    }
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
    handleResponseLine(parsed.json);
    console.error(`[llm-agent] Got RES: ${line}`);
    return;
  }

  console.error(`[llm-agent] Unknown protocol: ${line}`);
}

async function main() {
  await executor.initialize();

  emitReady({
    session: `agent-${provider}-${Date.now()}`,
    requestedExecutionMode: normalizedRequestedExecutionMode,
    resolvedExecutionMode,
    sessionStatus: executor.getStatus(),
  });
  console.error(
    `[llm-agent] Provider: ${provider}, Model: ${selectedModel || 'default'}, Token Limit: ${limit}, Execution Mode: ${normalizedRequestedExecutionMode} -> ${resolvedExecutionMode}`,
  );

  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    handleInboundLine(trimmed);
  });
}

main().catch((err) => {
  console.error(`[llm-agent] Fatal error: ${err.message}`);
  process.exit(1);
});
