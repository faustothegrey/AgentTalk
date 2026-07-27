import { describe, expect, it } from 'vitest';
import { resolveRegistryConfig } from '@agenttalk/runtime-core/registry/config';

describe('registry config', () => {
  it('provides default values', () => {
    expect(resolveRegistryConfig()).toEqual({
      readinessTimeoutMs: 60000,
      conversationStorePath: './transcripts/conversations.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 30000,
      // BL-083 — new key; `toEqual` is exhaustive, so it is listed here rather than the
      // assertion being loosened.
      maxUncappedRelaysPerPair: 50,
    });
  });

  it('applies overrides', () => {
    expect(resolveRegistryConfig({ healthcheckTimeoutMs: 5000, readinessTimeoutMs: 1200 })).toEqual({
      readinessTimeoutMs: 1200,
      conversationStorePath: './transcripts/conversations.json',
      agentIdleTimeoutMs: 180000,
      healthcheckTimeoutMs: 5000,
      maxUncappedRelaysPerPair: 50,
    });
  });
});
