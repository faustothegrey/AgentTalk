import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  phaseToVisual,
  shapeRef,
  DiagramTalkBridge,
  attachDiagramTalkBridge,
} from '../diagramtalk-bridge.js';

describe('DiagramTalk bridge — forward-spine mapping (pure)', () => {
  it('maps each spine phase to its box + entry edge', () => {
    expect(phaseToVisual('protocol_ack_pending')).toEqual({ box: 'ack', label: 'ack' });
    expect(phaseToVisual('fact_collection')).toMatchObject({ box: 'facts', edge: 'e1' });
    expect(phaseToVisual('discussion')).toMatchObject({ box: 'disc', edge: 'e2' });
    expect(phaseToVisual('proposal_pending_endorsement')).toMatchObject({ box: 'prop', edge: 'e3' });
    expect(phaseToVisual('submittal_pending')).toMatchObject({ box: 'submit', edge: 'e5' });
  });

  it('the entry phase has no transition edge', () => {
    expect(phaseToVisual('protocol_ack_pending')!.edge).toBeUndefined();
  });

  it('shapeRef applies the DiagramTalk transport prefix idempotently', () => {
    expect(shapeRef('ack')).toBe('shape:ack');
    expect(shapeRef('shape:ack')).toBe('shape:ack');
  });
});

describe('DiagramTalk bridge — dispatch (best-effort HTTP)', () => {
  const okFetch = () => vi.fn().mockResolvedValue({ ok: true, status: 200 });

  it('posts setStateTag then highlight for a mid-spine phase', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', tagId: 'cur' });
    await b.onPhase({ taskId: 't', phase: 'discussion' });

    expect(f).toHaveBeenCalledTimes(2);
    const [tagUrl, tagInit] = f.mock.calls[0]!;
    expect(tagUrl).toBe('http://x/api/diagram/commands');
    expect(JSON.parse((tagInit as any).body)).toMatchObject({
      type: 'setStateTag',
      input: { tagId: 'cur', shapeId: 'shape:disc', label: 'discussion' },
    });
    expect(JSON.parse((f.mock.calls[1]![1] as any).body)).toMatchObject({
      type: 'highlight',
      input: { ids: ['shape:e2'] },
    });
  });

  it('opens recording, clears the stale badge, then tags ack on the entry phase (no edge)', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, tagId: 'cur' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });

    // entry now also opens a recording first: startRecording, clear, tag — no highlight.
    expect(f).toHaveBeenCalledTimes(3);
    expect(JSON.parse((f.mock.calls[0]![1] as any).body).type).toBe('startRecording');
    expect(JSON.parse((f.mock.calls[1]![1] as any).body)).toMatchObject({
      type: 'setStateTag',
      input: { tagId: 'cur', clear: true },
    });
    expect(JSON.parse((f.mock.calls[2]![1] as any).body)).toMatchObject({
      type: 'setStateTag',
      input: { tagId: 'cur', shapeId: 'shape:ack' },
    });
  });

  it('does NOT clear on a mid-spine phase (clear is startup-only)', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any });
    await b.onPhase({ taskId: 't', phase: 'discussion' });
    const bodies = f.mock.calls.map((c) => JSON.parse((c[1] as any).body));
    expect(bodies.some((x) => x.input?.clear)).toBe(false);
  });

  it('includes diagramId when configured', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, diagramId: 'D1' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    expect(JSON.parse((f.mock.calls[0]![1] as any).body)).toMatchObject({ diagramId: 'D1' });
  });

  it('never throws when DiagramTalk is unreachable (best-effort)', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const b = new DiagramTalkBridge({ fetchImpl: f as any, log: () => {} });
    await expect(b.onPhase({ taskId: 't', phase: 'fact_collection' })).resolves.toBeUndefined();
  });
});

describe('DiagramTalk bridge — record-for-replay (v2, unconditional, command path)', () => {
  // Every call hits /api/diagram/commands; branch on the command `type`. The
  // startRecording command returns the new recording id at command.result.recordingId.
  // Recording is no longer opt-in — it wraps every run the bridge drives.
  const bodyOf = (call: any) => JSON.parse((call[1] as any).body);
  const recFetch = (recordingId = 'rec-1') =>
    vi.fn().mockImplementation((_url: string, init?: any) => {
      const type = init?.body ? JSON.parse(init.body).type : undefined;
      if (type === 'startRecording') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({ command: { result: { recordingId, activeId: recordingId } } }),
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

  it('opens a recording at the root phase (before the clear/tag) and closes it at submittal', async () => {
    const f = recFetch('rec-1');
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x' });

    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' }); // entry
    // Everything rides one endpoint; the very first command is the recording START.
    expect(f.mock.calls[0]![0]).toBe('http://x/api/diagram/commands');
    expect(bodyOf(f.mock.calls[0]!).type).toBe('startRecording');

    await b.onPhase({ taskId: 't', phase: 'submittal_pending' }); // terminal forward phase
    const last = bodyOf(f.mock.calls.at(-1)!);
    expect(last.type).toBe('endRecording');
    expect(last.input.id).toBe('rec-1'); // closes the id start returned
  });

  it('targets the configured diagramId in the startRecording command', async () => {
    const f = recFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', diagramId: 'D1' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    expect(bodyOf(f.mock.calls[0]!)).toMatchObject({ type: 'startRecording', diagramId: 'D1' });
  });

  it('does NOT close a recording it never opened (start failed -> no endRecording)', async () => {
    const f = vi.fn().mockImplementation((_url: string, init?: any) => {
      const type = init?.body ? JSON.parse(init.body).type : undefined;
      if (type === 'startRecording') return Promise.resolve({ ok: false, status: 500 });
      return Promise.resolve({ ok: true, status: 200 });
    });
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', log: () => {} });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    await b.onPhase({ taskId: 't', phase: 'submittal_pending' });
    expect(f.mock.calls.map((c) => bodyOf(c).type)).not.toContain('endRecording');
  });

  it('never throws when the command endpoint is unreachable (best-effort)', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const b = new DiagramTalkBridge({ fetchImpl: f as any, log: () => {} });
    await expect(b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' })).resolves.toBeUndefined();
  });
});

describe('attachDiagramTalkBridge — env gating', () => {
  afterEach(() => {
    delete process.env.AGENTTALK_DIAGRAM_BRIDGE;
  });

  it('is a no-op (no listener) when AGENTTALK_DIAGRAM_BRIDGE is unset', () => {
    delete process.env.AGENTTALK_DIAGRAM_BRIDGE;
    const r = new EventEmitter();
    expect(attachDiagramTalkBridge(r)).toBeUndefined();
    expect(r.listenerCount('team_planning_phase')).toBe(0);
  });

  it('subscribes and dispatches on the event when enabled', async () => {
    process.env.AGENTTALK_DIAGRAM_BRIDGE = '1';
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const r = new EventEmitter();
    const b = attachDiagramTalkBridge(r, { fetchImpl: f as any });
    expect(b).toBeDefined();
    expect(r.listenerCount('team_planning_phase')).toBe(1);

    r.emit('team_planning_phase', { taskId: 't', phase: 'fact_collection' });
    await new Promise((res) => setImmediate(res)); // let the async handler run
    expect(f).toHaveBeenCalled();
  });
});
