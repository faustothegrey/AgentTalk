import { describe, expect, it } from 'vitest';
import { getProviderCommand, resolveProvider } from '../../scripts/lib/provider-runtime.mjs';

describe('provider-runtime', () => {
  it('should build the Claude command with git access and non-interactive permissions', () => {
    const command = getProviderCommand('claude', 'sonnet', 'overview the repo');

    expect(command).toEqual({
      command: 'claude',
      args: [
        '-p',
        '--model',
        'sonnet',
        '--output-format',
        'json',
        '--permission-mode',
        'bypassPermissions',
        '--add-dir',
        '.git',
      ],
      stdin: 'overview the repo',
    });
  });

  it('should build the Codex command with full-auto autonomous execution', () => {
    const command = getProviderCommand('codex', 'gpt-5-codex', 'overview the repo');

    expect(command).toEqual({
      command: 'codex',
      args: [
        'exec',
        '--skip-git-repo-check',
        '--color',
        'never',
        '--json',
        '--full-auto',
        '--add-dir',
        '.git',
        '--model',
        'gpt-5-codex',
        'overview the repo',
      ],
      stdin: null,
    });
  });

  it('should build the Gemini command with git access and Gemini 3 as the default model', () => {
    const command = getProviderCommand('gemini', null, 'overview the repo');

    expect(command).toEqual({
      command: 'gemini',
      args: [
        '--prompt',
        'overview the repo',
        '--output-format',
        'json',
        '--approval-mode',
        'yolo',
        '--include-directories',
        '.git',
        '--model',
        'gemini-2.5-pro',
      ],
      stdin: null,
    });
  });

  it('should build the Gemini command with a specific Gemini model', () => {
    const command = getProviderCommand('gemini', 'gemini-2.5-flash', 'overview the repo');

    expect(command).toEqual({
      command: 'gemini',
      args: [
        '--prompt',
        'overview the repo',
        '--output-format',
        'json',
        '--approval-mode',
        'yolo',
        '--include-directories',
        '.git',
        '--model',
        'gemini-2.5-flash',
      ],
      stdin: null,
    });
  });

  it('should throw for an unsupported provider', () => {
    expect(() => resolveProvider('bogus')).toThrow('Unsupported provider: "bogus". Expected one of: claude, gemini, codex');
  });
});
