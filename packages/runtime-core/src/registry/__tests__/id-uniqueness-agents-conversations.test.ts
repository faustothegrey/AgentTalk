import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { ConversationCoordinator } from '../conversation-coordinator.js';
import { ConversationStore } from '../../conversations/conversation-store.js';
import type { Agent } from '../../agents/agent.js';

// BL-067 — the mint site BL-066 missed in the conversation coordinator.
//
// Same discipline as BL-066: the clock is FROZEN, so the collision is certain
// rather than likely. A bar whose verdict depends on how fast the machine ran is
// evidence about the machine, not the code.
//
// This drives the coordinator directly with stub deps rather than going through
// Registry, for one reason worth stating: `startConversation` awaits a real
// healthcheck round-trip, and a frozen clock stops that from ever completing —
// the bar times out instead of biting, which reads identically in the summary
// and proves nothing. Stubbing `requestHealthCheck` puts the frozen clock around
// the mint itself, which is where the defect is injected.
describe('BL-067: conversation ids do not depend on the clock', () => {
  const storeDir = './test-transcripts-bl067';
  const storePath = `${storeDir}/conversations.json`;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (existsSync(storeDir)) rmSync(storeDir, { recursive: true, force: true });
  });

  function makeCoordinator(): { coordinator: ConversationCoordinator; store: ConversationStore } {
    const store = new ConversationStore(storePath);
    const coordinator = new ConversationCoordinator({
      conversations: store,
      getAgent: (id: string) => ({ id, status: 'ready' }) as unknown as Agent,
      requestHealthCheck: async (agentId: string) => ({ agentId, message: 'ok' }),
      sendProtocol: async () => {},
      emitConversation: () => {},
      logError: () => {},
    });
    return { coordinator, store };
  }

  // ConversationStore.add() does `.set(conversation.id, ...)` and then persist(),
  // so a colliding id does not merely evict in memory — it writes the eviction to
  // disk. That is why this asserts BOTH ids and survival, not just the ids.
  it('mints distinct conversation ids within a single millisecond, and keeps both', async () => {
    const { coordinator, store } = makeCoordinator();
    vi.spyOn(Date, 'now').mockReturnValue(1_784_289_424_679);

    const first = await coordinator.startConversation(['a1', 'a2'], 'first topic', 2);
    const second = await coordinator.startConversation(['a3', 'a4'], 'second topic', 2);

    expect(first.id).not.toBe(second.id);
    expect(store.list()).toHaveLength(2);
  });
});
