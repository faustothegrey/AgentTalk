export interface RegistryConfig {
  readinessTimeoutMs: number;
  conversationStorePath: string;
  agentIdleTimeoutMs: number;
  healthcheckTimeoutMs: number;
}

export function resolveRegistryConfig(config: Partial<RegistryConfig> = {}): RegistryConfig {
  return {
    readinessTimeoutMs: 60000,
    conversationStorePath: './transcripts/conversations.json',
    agentIdleTimeoutMs: 180000,
    healthcheckTimeoutMs: 30000,
    ...config,
  };
}
