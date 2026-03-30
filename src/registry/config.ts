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

export function extractLaunchMetadata(launchCommand: string): {
  provider?: string;
  model?: string;
} {
  const metadata: { provider?: string; model?: string } = {};

  const providerMatch = launchCommand.match(/llm-agent\.mjs\s+([^\s]+)/);
  if (providerMatch?.[1]) {
    metadata.provider = providerMatch[1].toLowerCase();
  }

  const modelMatch = launchCommand.match(/--model\s+([^\s]+)/);
  if (modelMatch?.[1]) {
    metadata.model = modelMatch[1];
  }

  return metadata;
}
