import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { createExecutor, normalizeRequestedExecutionMode, resolveExecutionMode } from '../../scripts/lib/executor-runtime.mjs';

describe('executor-runtime', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('should normalize invalid requested execution modes to auto', () => {
    expect(normalizeRequestedExecutionMode('bogus')).toBe('auto');
  });

  it('should keep one-shot execution mode when explicitly requested', () => {
    expect(resolveExecutionMode('one_shot', 'gemini')).toBe('one_shot');
  });

  it('should resolve interactive mode for claude and fall back to one-shot elsewhere', () => {
    expect(resolveExecutionMode('interactive', 'claude')).toBe('interactive');
    expect(resolveExecutionMode('interactive', 'gemini')).toBe('one_shot');
  });

  it('should create a one-shot executor and expose requested and resolved modes', () => {
    const runtime = createExecutor({
      providerName: 'gemini',
      selectedModel: 'gemini-2.5-pro',
      requestedExecutionMode: 'interactive',
    });

    expect(runtime.requestedExecutionMode).toBe('interactive');
    expect(runtime.resolvedExecutionMode).toBe('one_shot');
    expect(runtime.executor.getStatus()).toBe('starting');
  });

  it('should create an interactive executor for claude and reuse the same process across turns', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'agenttalk-exec-'));
    tempDirs.push(tempDir);
    const scriptPath = path.join(tempDir, 'fake-claude.js');

    writeFileSync(scriptPath, `
const readline = require('readline');
let turn = 0;
console.log(JSON.stringify({ type: 'system', subtype: 'hook_started', session_id: 'test-session' }));
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const parsed = JSON.parse(line);
  if (parsed.type !== 'user') return;
  turn += 1;
  const text = parsed.message.content[0].text;
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'turn-' + turn + ':' + text }] } }));
  console.log(JSON.stringify({
    type: 'result',
    is_error: false,
    result: 'turn-' + turn + ':' + text,
    usage: { input_tokens: turn, output_tokens: turn + 1 }
  }));
});
`, 'utf8');

    const runtime = createExecutor({
      providerName: 'claude',
      selectedModel: 'sonnet',
      requestedExecutionMode: 'interactive',
      interactiveCommandOverride: {
        command: 'node',
        args: [scriptPath],
        env: process.env,
      },
    });

    expect(runtime.resolvedExecutionMode).toBe('interactive');
    await runtime.executor.initialize();
    expect(runtime.executor.getStatus()).toBe('ready');

    await expect(runtime.executor.executeTurn({ id: 'req-1', prompt: 'first' })).resolves.toEqual({
      response: 'turn-1:first',
      tokens: 3,
      tokenDetails: { input: 1, output: 2 },
    });

    await expect(runtime.executor.executeTurn({ id: 'req-2', prompt: 'second' })).resolves.toEqual({
      response: 'turn-2:second',
      tokens: 5,
      tokenDetails: { input: 2, output: 3 },
    });

    await runtime.executor.close();
  });
});
