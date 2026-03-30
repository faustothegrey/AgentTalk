import { describe, expect, it } from 'vitest';
import { getProviderCommand } from '../../scripts/lib/provider-runtime.mjs';

describe('provider-runtime', () => {
  it('should build the Gemini command with the prompt as a flag argument', () => {
    const command = getProviderCommand('gemini', 'gemini-2.5-flash', 'overview the repo');

    expect(command).toEqual({
      command: 'gemini',
      args: ['--prompt', 'overview the repo', '--output-format', 'json', '--model', 'gemini-2.5-flash'],
      stdin: null,
    });
  });
});
