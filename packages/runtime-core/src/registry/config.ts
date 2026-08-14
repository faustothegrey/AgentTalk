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
  /**
   * BL-133 — how long a team may hold an ACTIVE task with no transcript activity before the sweep
   * calls it stalled. **Advisory only**: nothing branches on it, nothing dies of it.
   *
   * ⛔ MUST strictly exceed the exec guard (`resolveWorkerTurnTimeoutMs() +
   * EXEC_TIMEOUT_BACKSTOP_GRACE_MS`, 605s by default) — asserted at Registry construction, fails
   * closed. A worker legitimately holds ONE exec turn for up to 600s producing no transcript entry
   * at all, so a threshold below the guard would report every long worker turn as a stall. This is
   * not a tuning preference: it is the same cross-module constant relationship that disabled the
   * non-reply sweep for 41 boots in BL-128 without a single test going red.
   *
   * The ordering the engine now guarantees end to end:
   *   agentIdleTimeoutMs (180s) < execGuard (605s) < teamNoProgressTimeoutMs (900s)
   */
  teamNoProgressTimeoutMs: number;
}

export function resolveRegistryConfig(config: Partial<RegistryConfig> = {}): RegistryConfig {
  return {
    readinessTimeoutMs: 60000,
    conversationStorePath: './transcripts/conversations.json',
    agentIdleTimeoutMs: 180000,
    healthcheckTimeoutMs: 30000,
    maxUncappedRelaysPerPair: 50,
    teamNoProgressTimeoutMs: 900000,
    ...config,
  };
}
