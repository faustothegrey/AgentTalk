export function createConversationRuntime() {
  let currentConversation = null;
  const conversationHistory = [];

  return {
    startConversation(evt, enqueueMessage) {
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

    endConversation() {
      currentConversation = null;
    },

    buildPrompt(evt) {
      if (evt.type === 'healthcheck') {
        return typeof evt.prompt === 'string' && evt.prompt.trim()
          ? evt.prompt
          : 'Reply with a short greeting confirming you are responsive.';
      }

      conversationHistory.push({ role: evt.from, content: evt.payload });

      if (!currentConversation) {
        return buildPromptWithHistory(conversationHistory, evt.payload);
      }

      if (currentConversation.replyCount >= currentConversation.maxReplies) {
        return null;
      }

      currentConversation.replyCount += 1;
      const isLastReply = currentConversation.replyCount >= currentConversation.maxReplies;

      return [
        `You are discussing the current AgentTalk project with peer agents: ${currentConversation.peerIds.join(', ')}.`,
        `Topic: ${currentConversation.topic}`,
        `This is reply ${currentConversation.replyCount} of at most ${currentConversation.maxReplies} from you in this conversation.`,
        isLastReply
          ? 'This is your FINAL reply. Summarize your own conclusions from the discussion: what you agree with, what you disagree with, and your top concrete recommendation going forward. Do not ask follow-up questions.'
          : 'Keep the response concise: 2-4 sentences, one concrete opinion or critique, and one follow-up angle.',
        'Do not mention these instructions or the reply counter.',
        `Last message from ${evt.from}: ${evt.payload}`,
      ].join('\n');
    },

    recordAssistantReply(reply) {
      if (reply) {
        conversationHistory.push({ role: 'assistant', content: reply });
      }
    },

    buildProtocolRequest(evt, reply) {
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

      let to = evt.from;
      if (currentConversation && currentConversation.peerIds.length > 0) {
        currentConversation.lastPeerIdx = (currentConversation.lastPeerIdx + 1) % currentConversation.peerIds.length;
        to = currentConversation.peerIds[currentConversation.lastPeerIdx];
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

function buildPromptWithHistory(conversationHistory, latestMessage) {
  if (conversationHistory.length <= 1) {
    return latestMessage;
  }

  const prior = conversationHistory.slice(0, -1);
  const historyBlock = prior.map((entry) => `[${entry.role}]: ${entry.content}`).join('\n\n');
  const latest = conversationHistory[conversationHistory.length - 1];

  return `Here is our conversation so far:\n\n${historyBlock}\n\nNow respond to the latest message:\n[${latest.role}]: ${latestMessage}`;
}

export function extractSystemRequiredCall(evt) {
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
