import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callApi } from '../api-client.js';

describe('api-client', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws if provider is unknown', async () => {
    await expect(callApi({ provider: 'invalid' as any, messages: [] })).rejects.toThrow('Unknown provider: invalid');
  });

  it('throws if API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(callApi({ provider: 'google', messages: [] })).rejects.toThrow('Missing GEMINI_API_KEY');
  });

  it('calls the OpenAI-compatible endpoint correctly', async () => {
    process.env.GEMINI_API_KEY = 'test-google-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello from mock' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      })
    });

    const result = await callApi({
      provider: 'google',
      model: 'my-custom-model',
      messages: [{ role: 'user', content: 'hi' }],
      response_format: { type: 'json_object' }
    }, mockFetch as any);

    expect(result.text).toBe('hello from mock');
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-google-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'my-custom-model',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });
  });

  it('throws on HTTP error', async () => {
    process.env.GEMINI_API_KEY = 'test-google-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Quota exceeded',
    });

    await expect(callApi({ provider: 'google', messages: [] }, mockFetch as any)).rejects.toThrow('HTTP 429: Quota exceeded');
  });

  it('adds extra headers for openrouter', async () => {
    process.env.OPENROUTER_API_KEY = 'test-or-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{}' } }]
      })
    });

    await callApi({
      provider: 'openrouter',
      messages: []
    }, mockFetch as any);

    const callArgs = mockFetch.mock.calls[0]![1] as any;
    expect(callArgs.headers['HTTP-Referer']).toBe('https://agenttalk.local');
    expect(callArgs.headers['X-Title']).toBe('AgentTalk M07 API Agent');
  });
});
