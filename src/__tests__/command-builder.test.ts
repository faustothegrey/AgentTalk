import { describe, expect, it } from 'vitest';
import { buildAgentCommand, buildProcessOptions, isBundledLlmAgentCommand } from '../scenarios/command-builder.js';

describe('command-builder', () => {
  it('builds the standard llm-agent launch command', () => {
    expect(buildAgentCommand('gemini', 'gemini-2.5-pro')).toBe(
      'node scripts/llm-agent.mjs gemini --model gemini-2.5-pro',
    );
  });

  it('detects bundled launcher commands', () => {
    expect(isBundledLlmAgentCommand('node scripts/llm-agent.mjs claude --model sonnet')).toBe(true);
    expect(isBundledLlmAgentCommand('  node scripts/llm-agent.mjs codex --model gpt-5-codex')).toBe(true);
    expect(isBundledLlmAgentCommand('claude -p "hi"')).toBe(false);
  });

  it('builds process options for bundled launcher commands', () => {
    const options = buildProcessOptions(
      'node scripts/llm-agent.mjs gemini --model gemini-2.5-pro',
      '/tmp/work',
      'one_shot',
    );

    expect(options?.cwd).toBe(process.cwd());
    expect(options?.env).toMatchObject({
      AGENTTALK_WORKDIR: '/tmp/work',
      AGENTTALK_EXECUTION_MODE: 'one_shot',
    });
  });

  it('returns cwd-only options for non-bundled commands', () => {
    expect(buildProcessOptions('claude -p', '/tmp/work', 'interactive')).toEqual({ cwd: '/tmp/work' });
  });

  it('returns undefined for non-bundled commands without working directory', () => {
    expect(buildProcessOptions('claude -p', undefined, 'interactive')).toBeUndefined();
  });
});
