import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'fs';
import { SessionRecorder } from '../recordings/session-recorder.js';
import { loadSessionRecording, playSessionRecording } from '../recordings/playback.js';

const RECORDING_PATH = './test-recordings/session.ndjson';

describe('recording playback', () => {
  afterEach(() => {
    if (existsSync('./test-recordings')) {
      rmSync('./test-recordings', { recursive: true, force: true });
    }
  });

  it('should persist runtime events and replay the resulting final state', async () => {
    const recorder = new SessionRecorder(RECORDING_PATH, '/tmp/agenttalk-test');
    recorder.record('runtime', 'agent_created', { id: 'agent-1' });
    recorder.record('runtime', 'status', { id: 'agent-1', status: 'ready' });
    recorder.record('runtime', 'session_status', { id: 'agent-1', sessionStatus: 'ready' });
    recorder.record('runtime', 'provider', { id: 'agent-1', provider: 'gemini' });
    recorder.record('runtime', 'model', { id: 'agent-1', model: 'gemini-3.0-flash' });
    recorder.record('runtime', 'output', { id: 'agent-1', text: 'hello\r\n' });
    recorder.record('runtime', 'agent_message', { from: 'agent-1', payload: 'done' });
    recorder.record('runtime', 'conversation', {
      conversation: {
        id: 'conversation-1',
        agentIds: ['agent-1', 'agent-2'],
        topic: 'Test topic',
        maxRepliesPerAgent: 2,
        replyCounts: { 'agent-1': 1, 'agent-2': 0 },
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        transcript: [],
      },
    });
    await recorder.close();

    const raw = readFileSync(RECORDING_PATH, 'utf8');
    expect(raw.split('\n').filter(Boolean)).toHaveLength(8 + 1);

    const recording = loadSessionRecording(RECORDING_PATH);
    expect(recording.meta.cwd).toBe('/tmp/agenttalk-test');

    const state = await playSessionRecording(recording);
    expect(state.processedEvents).toBe(8);
    expect(state.agents).toEqual([
      expect.objectContaining({
        id: 'agent-1',
        status: 'ready',
        sessionStatus: 'ready',
        provider: 'gemini',
        model: 'gemini-3.0-flash',
        outputs: ['hello\r\n'],
        agentMessages: ['done'],
      }),
    ]);
    expect(state.conversations).toEqual([
      expect.objectContaining({
        id: 'conversation-1',
        topic: 'Test topic',
        status: 'active',
      }),
    ]);
  });
});
