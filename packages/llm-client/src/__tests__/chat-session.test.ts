import { describe, it, expect, vi } from 'vitest';
import { ChatSession } from '../chat-session.js';
import type { Completer, CompleterOptions } from '../completer.js';

// A fake Completer that records the (prompt, opts) it was called with and returns a canned reply.
function fakeCompleter(maintainsSession: boolean, reply = 'reply') {
  const calls: Array<{ prompt: string; opts: CompleterOptions | undefined }> = [];
  const completer: Completer = {
    maintainsSession,
    complete: vi.fn(async (prompt: string, opts?: CompleterOptions) => {
      calls.push({ prompt, opts });
      return { text: reply };
    }),
  };
  return { completer, calls };
}

describe('ChatSession', () => {
  it('stateless backend: replays the full history (role-aware) each turn', async () => {
    const { completer, calls } = fakeCompleter(false);
    const chat = new ChatSession(completer);

    await chat.send('first');
    await chat.send('second');

    // 2nd turn replays: user/assistant/user.
    expect(calls[1]!.opts!.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]);
    expect(chat.messages).toHaveLength(4); // 2 user + 2 assistant
  });

  it('session-keeping backend: sends ONLY the latest turn (no messages replay)', async () => {
    const { completer, calls } = fakeCompleter(true);
    const chat = new ChatSession(completer);

    await chat.send('first');
    await chat.send('second');

    expect(calls[1]!.prompt).toBe('second');
    expect(calls[1]!.opts!.messages).toBeUndefined();
  });

  it('seeds a system prompt and preserves it across reset()', async () => {
    const { completer, calls } = fakeCompleter(false);
    const chat = new ChatSession(completer, { system: 'be terse' });

    await chat.send('hello');
    expect(calls[0]!.opts!.messages![0]).toEqual({ role: 'system', content: 'be terse' });

    chat.reset();
    expect(chat.messages).toEqual([{ role: 'system', content: 'be terse' }]);
  });
});
