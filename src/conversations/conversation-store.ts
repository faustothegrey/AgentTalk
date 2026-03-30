import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { deriveConversationStatus, withDerivedConversationStatus } from './conversation-status.js';
import type { Conversation, TranscriptEntry } from '../shared/types.js';

export class ConversationStore {
  private conversations = new Map<string, Conversation>();

  constructor(private readonly storePath: string) {}

  load(): void {
    const resolvedPath = this.getStorePath();
    if (!existsSync(resolvedPath)) {
      return;
    }

    try {
      const raw = readFileSync(resolvedPath, 'utf8').trim();
      if (!raw) {
        return;
      }

      const conversations = JSON.parse(raw) as Conversation[];
      for (const conversation of conversations) {
        this.conversations.set(conversation.id, conversation);
      }
    } catch (err) {
      console.error('[ConversationStore] Failed to load conversations:', err);
    }
  }

  list(): Conversation[] {
    return Array.from(this.conversations.values())
      .map(withDerivedConversationStatus)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  add(conversation: Conversation): void {
    this.conversations.set(conversation.id, conversation);
    this.persist();
  }

  remove(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  findActiveByAgents(agentIds: string[] | string, maybeTo?: string): Conversation | undefined {
    let ids: string[];
    if (Array.isArray(agentIds)) {
      ids = agentIds;
    } else if (maybeTo) {
      ids = [agentIds, maybeTo];
    } else {
      return undefined;
    }

    return this.list().find((conversation) =>
      deriveConversationStatus(conversation) === 'active' &&
      conversation.agentIds.length === ids.length &&
      ids.every((id) => conversation.agentIds.includes(id))
    );
  }

  recordMessage(conversation: Conversation, entry: TranscriptEntry): { completed: boolean } {
    conversation.transcript.push(entry);
    conversation.replyCounts[entry.from] = (conversation.replyCounts[entry.from] ?? 0) + 1;
    conversation.updatedAt = entry.timestamp;

    const completed = conversation.agentIds.every(
      (id) => (conversation.replyCounts[id] ?? 0) >= conversation.maxRepliesPerAgent,
    );

    this.persist();
    return { completed };
  }

  markCompleted(conversation: Conversation, reason: string): boolean {
    if (conversation.status === 'completed') {
      return false;
    }

    conversation.status = 'completed';
    conversation.updatedAt = new Date().toISOString();
    conversation.transcript.push({
      kind: 'system',
      timestamp: conversation.updatedAt,
      from: 'system',
      to: conversation.agentIds.join(','),
      payload: reason,
    });
    this.persist();
    return true;
  }

  persist(): void {
    const resolvedPath = this.getStorePath();
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    writeFileSync(resolvedPath, JSON.stringify(this.list(), null, 2), 'utf8');
  }

  private getStorePath(): string {
    return path.resolve(this.storePath);
  }
}
