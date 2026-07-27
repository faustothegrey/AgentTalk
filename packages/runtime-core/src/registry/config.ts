export interface RegistryConfig {
  readinessTimeoutMs: number;
  conversationStorePath: string;
  agentIdleTimeoutMs: number;
  healthcheckTimeoutMs: number;
  /**
   * BL-083 — ceiling on agent→agent relays for one ordered pair when NO conversation is
   * active. Conversation-backed relays are unaffected: they keep using the conversation's
   * own `maxRepliesPerAgent`. This is an anti-runaway rail, not a conversation cap, so the
   * default is deliberately generous — a legitimate baton exchange must never hit it.
   */
  maxUncappedRelaysPerPair: number;
}

export function resolveRegistryConfig(config: Partial<RegistryConfig> = {}): RegistryConfig {
  return {
    readinessTimeoutMs: 60000,
    conversationStorePath: './transcripts/conversations.json',
    agentIdleTimeoutMs: 180000,
    healthcheckTimeoutMs: 30000,
    maxUncappedRelaysPerPair: 50,
    ...config,
  };
}
