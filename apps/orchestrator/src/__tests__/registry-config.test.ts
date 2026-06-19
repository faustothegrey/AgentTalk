import { describe, expect, it } from 'vitest';
import { resolveRegistryConfig } from '@agenttalk/runtime-core/registry/config';

describe('registry config', () => {
  it('provides default values', () => {
    expect(resolveRegistryConfig()).toEqual({
      readinessTimeoutMs: 60000,
      conversationStorePath: './transcripts/conversations.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 30000,
    });
  });

  it('applies overrides', () => {
    expect(resolveRegistryConfig({ healthcheckTimeoutMs: 5000, readinessTimeoutMs: 1200 })).toEqual({
      readinessTimeoutMs: 1200,
      conversationStorePath: './transcripts/conversations.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 5000,
    });
  });
});
