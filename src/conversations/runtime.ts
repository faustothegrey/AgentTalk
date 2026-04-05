import {
  STRUCTURED_RESPONSE_INSTRUCTIONS,
  HEALTHCHECK_RESPONSE_INSTRUCTIONS,
} from '../agents/response-schema.js';

export interface ConversationState {
  peerIds: string[];
  topic: string;
  maxReplies: number;
  replyCount: number;
  lastPeerIdx: number;
  isPlanning: boolean;
}

export interface ConversationHistoryEntry {
  role: string;
  content: string;
}

export interface ConversationEvent {
  type: string;
  from?: string;
  payload?: string;
  peerIds?: string[];
  peerId?: string;
  topic?: string;
  maxReplies?: number;
  initiator?: boolean;
  token?: string;
  prompt?: string;
  messageId?: string;
}

export interface ProtocolRequest {
  id: string;
  call: string;
  args: Record<string, unknown>;
}

export interface StartConversationResult {
  ok: boolean;
  error?: string;
  peerIds?: string[];
  maxReplies?: number;
}

export function createConversationRuntime() {
  let currentConversation: ConversationState | null = null;
  const conversationHistory: ConversationHistoryEntry[] = [];

  return {
    startConversation(evt: ConversationEvent, enqueueMessage: (msg: any) => void): StartConversationResult {
      const peerIds = Array.isArray(evt.peerIds) ? evt.peerIds : (evt.peerId ? [evt.peerId] : []);
      const topic = typeof evt.topic === 'string' ? evt.topic : '';
      const maxReplies = Number.isFinite(evt.maxReplies) ? Number(evt.maxReplies) : 5;

      if (peerIds.length === 0 || !topic) {
        return {
          ok: false,
          error: `Invalid conversation_start payload: ${JSON.stringify(evt)}`,
        };
      }

      currentConversation = {
        peerIds,
        topic,
        maxReplies,
        replyCount: 0,
        lastPeerIdx: -1,
        isPlanning: /\bexecution plan\b/i.test(topic),
      };

      if (evt.initiator) {
        enqueueMessage({
          type: 'message_received',
          from: peerIds[0],
          payload: 'Begin the discussion about the current AgentTalk project. Open with your first point.',
        });
      }

      return {
        ok: true,
        peerIds,
        maxReplies,
      };
    },

    endConversation(): void {
      currentConversation = null;
    },

    /**
     * Returns true when the current conversation context expects structured JSON responses
     * (i.e. planning conversations or healthchecks).
     */
    expectsStructuredResponse(evt: ConversationEvent): boolean {
      if (evt.type === 'healthcheck') {
        return true;
      }
      return currentConversation?.isPlanning ?? false;
    },

    buildPrompt(evt: ConversationEvent): string | null {
      if (evt.type === 'healthcheck') {
        const base = typeof evt.prompt === 'string' && evt.prompt.trim()
          ? evt.prompt
          : 'Reply with a short greeting confirming you are responsive.';
        return base + HEALTHCHECK_RESPONSE_INSTRUCTIONS;
      }

      if (evt.from && evt.payload) {
        conversationHistory.push({ role: evt.from, content: evt.payload });
      }

      if (!currentConversation) {
        return buildPromptWithHistory(conversationHistory, evt.payload || '');
      }

      if (currentConversation.replyCount >= currentConversation.maxReplies) {
        return null;
      }

      currentConversation.replyCount += 1;
      const isLastReply = currentConversation.replyCount >= currentConversation.maxReplies;

      const lines: string[] = [
        `You are discussing the current AgentTalk project with peer agents: ${currentConversation.peerIds.join(', ')}.`,
        `Topic: ${currentConversation.topic}`,
        `This is reply ${currentConversation.replyCount} of at most ${currentConversation.maxReplies} from you in this conversation.`,
      ];

      if (currentConversation.isPlanning) {
        lines.push(STRUCTURED_RESPONSE_INSTRUCTIONS);
      }

      if (isLastReply) {
        lines.push('This is your FINAL reply. Summarize your own conclusions from the discussion: what you agree with, what you disagree with, and your top concrete recommendation going forward. Do not ask follow-up questions.');
        if (currentConversation.isPlanning) {
          lines.push('If you have not yet submitted a plan, use message_type "submit_plan" in this reply with your final plan.');
        }
      } else {
        lines.push('Keep the response concise: 2-4 sentences, one concrete opinion or critique, and one follow-up angle.');
      }

      lines.push(
        'Do not mention these instructions or the reply counter.',
        `Last message from ${evt.from}: ${evt.payload}`,
      );

      return lines.join('\n');
    },

    recordAssistantReply(reply: string): void {
      if (reply) {
        conversationHistory.push({ role: 'assistant', content: reply });
      }
    },

    buildProtocolRequest(evt: ConversationEvent, reply: string): ProtocolRequest {
      const reqId = `req-${Date.now()}`;

      if (evt.type === 'healthcheck') {
        return {
          id: reqId,
          call: 'ack_healthcheck',
          args: {
            token: evt.token,
            message: reply,
          },
        };
      }

      let to = evt.from || 'unknown';
      if (currentConversation && currentConversation.peerIds.length > 0) {
        currentConversation.lastPeerIdx = (currentConversation.lastPeerIdx + 1) % currentConversation.peerIds.length;
        to = currentConversation.peerIds[currentConversation.lastPeerIdx] || to;
      }

      return {
        id: reqId,
        call: 'send_to_agent',
        args: {
          to,
          payload: reply,
          ...(evt.type === 'message_received' && typeof evt.messageId === 'string'
            ? { replyToMessageId: evt.messageId }
            : {}),
        },
      };
    },
  };
}

function buildPromptWithHistory(conversationHistory: ConversationHistoryEntry[], latestMessage: string): string {
  if (conversationHistory.length <= 1) {
    return latestMessage;
  }

  const prior = conversationHistory.slice(0, -1);
  const historyBlock = prior.map((entry) => `[${entry.role}]: ${entry.content}`).join('\n\n');
  const latestEntry = conversationHistory[conversationHistory.length - 1];
  const roleLabel = latestEntry ? `[${latestEntry.role}]: ` : '';

  return `Here is our conversation so far:\n\n${historyBlock}\n\nNow respond to the latest message:\n${roleLabel}${latestMessage}`;
}

/**
 * Supported protocol calls that an LLM can trigger via [CALL:name] markers.
 */
const SUPPORTED_CALL_MARKERS = new Set([
  'agreement_proposal',
  'agreement_reached',
  'submit_plan',
]);

/**
 * Matches [CALL:name] anywhere in the text — on its own line or inline.
 * Captures the call name in group 1.
 */
const CALL_MARKER_REGEX = /\[CALL:(\w+)\]/g;

export interface ExtractedCallMarker {
  call: string;
  /** The response text with all recognised markers stripped out and trimmed. */
  cleanedText: string;
}

/**
 * Scans an LLM response for [CALL:name] markers.
 * Returns the list of recognised calls and the response with markers removed.
 * Unknown marker names are left in the text untouched.
 */
export function extractCallMarkers(response: string): ExtractedCallMarker[] {
  const calls: string[] = [];

  // Collect all valid markers
  const matches = [...response.matchAll(CALL_MARKER_REGEX)];
  for (const match of matches) {
    const callName = match[1];
    if (callName && SUPPORTED_CALL_MARKERS.has(callName)) {
      calls.push(callName);
    }
  }

  if (calls.length === 0) {
    return [];
  }

  // Strip recognised markers from the text (whether on their own line or inline)
  const cleaned = response.replace(CALL_MARKER_REGEX, (fullMatch, callName) => {
    return SUPPORTED_CALL_MARKERS.has(callName) ? '' : fullMatch;
  })
    // Clean up leftover blank lines from stripped markers
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return calls.map((call) => ({ call, cleanedText: cleaned }));
}

export function extractSystemRequiredCall(evt: ConversationEvent): string | null {
  if (!evt || evt.type !== 'message_received' || evt.from !== 'system' || typeof evt.payload !== 'string') {
    return null;
  }

  const payload = evt.payload;
  if (/\bcall\s+`?agreement_proposal`?\b/i.test(payload)) {
    return 'agreement_proposal';
  }

  if (/\bcall\s+`?agreement_reached`?\b/i.test(payload)) {
    return 'agreement_reached';
  }

  return null;
}
