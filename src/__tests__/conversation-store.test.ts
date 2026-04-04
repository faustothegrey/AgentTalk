import { existsSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationStore } from '../conversations/conversation-store.js';
import type { Conversation } from '../shared/types.js';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: `conversation-${Date.now()}`,
    agentIds: ['a1', 'a2'],
    topic: 'topic',
    maxRepliesPerAgent: 1,
    replyCounts: { a1: 0, a2: 0 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    transcript: [],
    ...overrides,
  };
}

const tempDirs: string[] = [];

function makeStore(storePath?: string) {
  if (storePath) {
    return new ConversationStore(storePath);
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'agenttalk-conv-store-'));
  tempDirs.push(dir);
  return new ConversationStore(path.join(dir, 'conversations.json'));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ConversationStore', () => {
  it('adds, persists, and loads conversations', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agenttalk-conv-store-'));
    tempDirs.push(dir);
    const storePath = path.join(dir, 'conversations.json');
    const store = makeStore(storePath);
    const convo = makeConversation({ id: 'c1' });
    store.add(convo);

    const reloaded = makeStore(storePath);
    reloaded.load();
    expect(reloaded.list().map((c) => c.id)).toContain('c1');
  });

  it('finds active conversations by agent set regardless of order', () => {
    const store = makeStore();
    const convo = makeConversation({ id: 'c-set', agentIds: ['a1', 'a2', 'a3'] });
    store.add(convo);

    const found = store.findActiveByAgents(['a3', 'a1', 'a2']);
    expect(found?.id).toBe('c-set');
  });

  it('increments reply counts and signals completion when all hit max replies', () => {
    const store = makeStore();
    const convo = makeConversation({ id: 'c-replies', maxRepliesPerAgent: 1 });
    store.add(convo);

    const one = store.recordMessage(convo, {
      kind: 'message',
      timestamp: '2026-01-01T00:00:01.000Z',
      from: 'a1',
      to: 'a2',
      payload: 'hello',
    });
    expect(one.completed).toBe(false);

    const two = store.recordMessage(convo, {
      kind: 'message',
      timestamp: '2026-01-01T00:00:02.000Z',
      from: 'a2',
      to: 'a1',
      payload: 'hi',
    });
    expect(two.completed).toBe(true);
  });

  it('marks completed once and appends completion system entry', () => {
    const store = makeStore();
    const convo = makeConversation({ id: 'c-complete' });
    store.add(convo);

    expect(store.markCompleted(convo, 'done')).toBe(true);
    expect(store.markCompleted(convo, 'again')).toBe(false);
    expect(convo.status).toBe('completed');
    expect(convo.transcript[convo.transcript.length - 1]?.payload).toBe('done');
  });
});
