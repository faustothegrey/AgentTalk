import { ConversationStore } from '../conversations/conversation-store.js';
import type { EventPayload } from '../protocol/protocol-payloads.js';
import type { OutboundProtocolPacketType } from '../protocol/protocol.js';
import type { Conversation, TranscriptEntry } from '../shared/types.js';
import { Agent } from '../agents/agent.js';

interface ConversationCoordinatorDeps {
  conversations: ConversationStore;
  getAgent: (id: string) => Agent;
  requestHealthCheck: (agentId: string) => Promise<{ agentId: string; message: unknown }>;
  sendProtocol: (
    id: string,
    type: OutboundProtocolPacketType,
    payload: EventPayload,
  ) => Promise<void>;
  emitConversation: (conversation: Conversation) => void;
  logError: (message: string, err: unknown) => void;
}

export class ConversationCoordinator {
  constructor(private readonly deps: ConversationCoordinatorDeps) {}

  async startConversation(
    agentIds: string[],
    topic: string,
    maxRepliesPerAgent: number,
  ): Promise<Conversation> {
    if (agentIds.length < 1) {
      throw new Error('Conversation requires at least one agent');
    }

    const uniqueAgentIds = [...new Set(agentIds)];
    if (uniqueAgentIds.length !== agentIds.length) {
      throw new Error('Conversation requires different agents');
    }

    const agents = agentIds.map((id) => this.deps.getAgent(id));

    for (const agent of agents) {
      if (agent.status !== 'ready' && agent.status !== 'busy') {
        throw new Error(`Agent ${agent.id} must be ready before starting a conversation`);
      }
    }

    await Promise.all(agentIds.map((id) => this.deps.requestHealthCheck(id)));

    const existingConversation = this.findActiveConversationByAgents(agentIds);
    if (existingConversation) {
      return existingConversation;
    }

    const now = new Date().toISOString();
    const replyCounts: Record<string, number> = {};
    agentIds.forEach((id) => {
      replyCounts[id] = 0;
    });

    const conversation: Conversation = {
      id: `conversation-${Date.now()}`,
      agentIds,
      topic,
      maxRepliesPerAgent,
      replyCounts,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      transcript: [
        {
          kind: 'system',
          timestamp: now,
          from: 'system',
          to: agentIds.join(','),
          payload: `Conversation created with ${agentIds.length} agents: ${topic}`,
        },
      ],
    };

    this.deps.conversations.add(conversation);
    this.deps.emitConversation(conversation);

    for (const [i, id] of agentIds.entries()) {
      const peerIds = agentIds.filter((peerId) => peerId !== id);
      const peerId = peerIds[0] || 'user'; // Fallback to 'user' if no peers

      await this.deps.sendProtocol(id, 'EVT', {
        type: 'conversation_start',
        conversationId: conversation.id,
        peerIds,
        peerId,
        topic,
        maxReplies: maxRepliesPerAgent,
        initiator: i === 0,
      });
    }

    return conversation;
  }

  getConversations(): Conversation[] {
    return this.deps.conversations.list();
  }

  removeConversation(id: string): boolean {
    return this.deps.conversations.remove(id);
  }

  findActiveConversationByAgents(
    agentIds: string[] | string,
    maybeTo?: string,
  ): Conversation | undefined {
    let ids: string[];
    if (Array.isArray(agentIds)) {
      ids = agentIds;
    } else if (maybeTo) {
      ids = [agentIds, maybeTo];
    } else {
      return undefined;
    }

    return this.deps.conversations.findActiveByAgents(ids);
  }

  recordConversationMessage(conversation: Conversation, entry: TranscriptEntry): void {
    const result = this.deps.conversations.recordMessage(conversation, entry);
    if (result.completed) {
      this.markConversationCompleted(conversation, 'All agents reached reply limit');
      return;
    }

    this.deps.emitConversation(conversation);
  }

  markConversationCompleted(conversation: Conversation, reason: string): void {
    if (!this.deps.conversations.markCompleted(conversation, reason)) {
      return;
    }

    this.deps.emitConversation(conversation);

    for (const id of conversation.agentIds) {
      this.deps.sendProtocol(id, 'EVT', {
        type: 'conversation_end',
        conversationId: conversation.id,
        reason,
      }).catch((err) => this.deps.logError(`[Registry] Failed to send conversation_end to ${id}:`, err));
    }
  }
}
