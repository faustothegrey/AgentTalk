import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiCompleter } from '../completer.js';

// llm-client owns the chat plug + ApiCompleter. These pin its CONSENSUS-AGNOSTIC contract: the
// structured-tool is INJECTED (no protocol knowledge here), the `messages` widening is honoured, and
// a non-structured turn stays a plain request. The real protocol-schema assertion lives in
// runtime-core (where buildProtocolToolSchema is injected) — see runtime-core completer.test.ts.
describe('ApiCompleter (llm-client, injected tool)', () => {
  let originalEnv: NodeJS.ProcessEnv;
  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function captureFetch(responseJson: any) {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => responseJson });
    const bodyOf = () => JSON.parse((fetchFn.mock.calls[0]![1] as any).body);
    return { fetchFn, bodyOf };
  }

  it('forwards the INJECTED tool + tool_choice:required + response_format on a structured turn', async () => {
    const { fetchFn, bodyOf } = captureFetch({ choices: [{ message: { content: 'ok' } }] });
    const stubTool = { type: 'function', function: { name: 'stub' } };
    const builder = vi.fn(() => stubTool);

    const completer = new ApiCompleter('google', 'gemini-2.5-flash', fetchFn as any, builder);
    await completer.complete('hi', { expectsStructured: true });

    const body = bodyOf();
    expect(builder).toHaveBeenCalledTimes(1);
    expect(body.tools).toEqual([stubTool]);
    expect(body.tool_choice).toBe('required');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('structured turn is a no-op when NO builder is injected (plain-chat use)', async () => {
    const { fetchFn, bodyOf } = captureFetch({ choices: [{ message: { content: 'ok' } }] });
    const completer = new ApiCompleter('google', undefined, fetchFn as any); // no builder
    await completer.complete('hi', { expectsStructured: true });

    const body = bodyOf();
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('response_format');
  });

  it('sends NO tools/tool_choice/response_format on a non-structured turn', async () => {
    const { fetchFn, bodyOf } = captureFetch({ choices: [{ message: { content: 'plain' } }] });
    const completer = new ApiCompleter('google', undefined, fetchFn as any, () => ({}));
    const result = await completer.complete('just chat');

    const body = bodyOf();
    expect(body).not.toHaveProperty('tools');
    expect(body.messages).toEqual([{ role: 'user', content: 'just chat' }]);
    expect(result.text).toBe('plain');
  });

  it('honours the widened messages[] option (role-aware multi-turn), superseding the prompt', async () => {
    const { fetchFn, bodyOf } = captureFetch({ choices: [{ message: { content: 'reply' } }] });
    const history = [
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' },
    ];
    const completer = new ApiCompleter('google', undefined, fetchFn as any);
    await completer.complete('ignored-prompt', { messages: history });

    expect(bodyOf().messages).toEqual(history);
  });
});
