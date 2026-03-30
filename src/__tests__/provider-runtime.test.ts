import { describe, expect, it } from 'vitest';
import { getProviderCommand, resolveProvider } from '../../scripts/lib/provider-runtime.mjs';

describe('provider-runtime', () => {
  it('should build the Gemini command with Gemini 3 as the default model', () => {
    const command = getProviderCommand('gemini', null, 'overview the repo');

    expect(command).toEqual({
      command: 'gemini',
      args: ['--prompt', 'overview the repo', '--output-format', 'json', '--model', 'gemini-3-flash'],
      stdin: null,
    });
  });

  it('should build the Gemini command with a specific Gemini model', () => {
    const command = getProviderCommand('gemini', 'gemini-2.5-flash', 'overview the repo');

    expect(command).toEqual({
      command: 'gemini',
      args: ['--prompt', 'overview the repo', '--output-format', 'json', '--model', 'gemini-2.5-flash'],
      stdin: null,
    });
  });

  it('should throw for an unsupported provider', () => {
    expect(() => resolveProvider('bogus')).toThrow('Unsupported provider: "bogus". Expected one of: claude, gemini, codex');
  });
});
