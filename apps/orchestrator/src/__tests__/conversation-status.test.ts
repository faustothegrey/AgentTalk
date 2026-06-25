import { describe, expect, it } from 'vitest';
import { deriveConversationStatus, withDerivedConversationStatus } from '@agenttalk/runtime-core/conversations/conversation-status';
import type { Conversation } from '@agenttalk/contracts/types';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    agentIds: ['a1', 'a2'],
    topic: 'topic',
    maxRepliesPerAgent: 2,
    replyCounts: { a1: 0, a2: 0 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    transcript: [],
    ...overrides,
  };
}

describe('conversation-status', () => {
  it('derives completed when all agents reached reply cap', () => {
    const conversation = makeConversation({
      replyCounts: { a1: 2, a2: 3 },
    });
    expect(deriveConversationStatus(conversation)).toBe('completed');
  });

  it('keeps explicit completed status', () => {
    const conversation = makeConversation({
      status: 'completed',
      replyCounts: { a1: 0, a2: 0 },
    });
    expect(deriveConversationStatus(conversation)).toBe('completed');
  });

  it('returns updated copy when derived status differs', () => {
    const conversation = makeConversation({ replyCounts: { a1: 2, a2: 2 } });
    const next = withDerivedConversationStatus(conversation);
    expect(next).not.toBe(conversation);
    expect(next.status).toBe('completed');
  });

  it('returns original object when status is already correct', () => {
    const conversation = makeConversation();
    expect(withDerivedConversationStatus(conversation)).toBe(conversation);
  });
});
