import type { Conversation } from './types.js';

export function deriveConversationStatus(conversation: Conversation): Conversation['status'] {
  if (conversation.status === 'completed') {
    return 'completed';
  }

  const allAgentsReachedReplyCap = conversation.agentIds.every(
    (id) => (conversation.replyCounts[id] ?? 0) >= conversation.maxRepliesPerAgent,
  );

  return allAgentsReachedReplyCap ? 'completed' : 'active';
}

export function withDerivedConversationStatus(conversation: Conversation): Conversation {
  const derivedStatus = deriveConversationStatus(conversation);
  if (conversation.status === derivedStatus) {
    return conversation;
  }

  return {
    ...conversation,
    status: derivedStatus,
  };
}
