import { describe, expect, it } from 'vitest';
import { extractLaunchMetadata, resolveRegistryConfig } from '../registry/config.js';

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

  it('extracts provider and model from launch commands', () => {
    expect(extractLaunchMetadata('node scripts/llm-agent.mjs Claude --model sonnet')).toEqual({
      provider: 'claude',
      model: 'sonnet',
    });
  });

  it('returns empty metadata when launch command is unrelated', () => {
    expect(extractLaunchMetadata('python app.py')).toEqual({});
  });
});
