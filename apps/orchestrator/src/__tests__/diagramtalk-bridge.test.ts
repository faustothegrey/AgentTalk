import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  phaseToVisual,
  phaseToOverlay,
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

  it('clears the stale badge then tags ack on the entry phase (no edge to pulse)', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, tagId: 'cur' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });

    expect(f).toHaveBeenCalledTimes(2); // clear, then tag — no highlight (entry)
    expect(JSON.parse((f.mock.calls[0]![1] as any).body)).toMatchObject({
      type: 'setStateTag',
      input: { tagId: 'cur', clear: true },
    });
    expect(JSON.parse((f.mock.calls[1]![1] as any).body)).toMatchObject({
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

describe('DiagramTalk bridge — record-for-replay (v2, opt-in, command path)', () => {
  // Every call now hits /api/diagram/commands; branch on the command `type`. The
  // startRecording command returns the new recording id at command.result.recordingId.
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

  afterEach(() => {
    delete process.env.AGENTTALK_DIAGRAM_RECORD;
  });

  it('emits NO recording commands when record is off (default — behaviour preserved)', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    await b.onPhase({ taskId: 't', phase: 'submittal_pending' });
    const types = f.mock.calls.map((c) => bodyOf(c).type);
    expect(types).not.toContain('startRecording');
    expect(types).not.toContain('endRecording');
  });

  it('opens a recording at the root phase (before the clear/tag) and closes it at submittal', async () => {
    const f = recFetch('rec-1');
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', record: true });

    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' }); // entry
    // Everything rides one endpoint; the very first command is the recording START.
    expect(f.mock.calls[0]![0]).toBe('http://x/api/diagram/commands');
    expect(bodyOf(f.mock.calls[0]!).type).toBe('startRecording');

    await b.onPhase({ taskId: 't', phase: 'submittal_pending' }); // terminal forward phase
    const last = bodyOf(f.mock.calls.at(-1)!);
    expect(last.type).toBe('endRecording');
    expect(last.input.id).toBe('rec-1'); // closes the id start returned
  });

  it('reads AGENTTALK_DIAGRAM_RECORD as the record default', async () => {
    process.env.AGENTTALK_DIAGRAM_RECORD = '1';
    const f = recFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    expect(bodyOf(f.mock.calls[0]!).type).toBe('startRecording');
  });

  it('targets the configured diagramId in the startRecording command', async () => {
    const f = recFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', record: true, diagramId: 'D1' });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    expect(bodyOf(f.mock.calls[0]!)).toMatchObject({ type: 'startRecording', diagramId: 'D1' });
  });

  it('does NOT close a recording it never opened (start failed -> no endRecording)', async () => {
    const f = vi.fn().mockImplementation((_url: string, init?: any) => {
      const type = init?.body ? JSON.parse(init.body).type : undefined;
      if (type === 'startRecording') return Promise.resolve({ ok: false, status: 500 });
      return Promise.resolve({ ok: true, status: 200 });
    });
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', record: true, log: () => {} });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    await b.onPhase({ taskId: 't', phase: 'submittal_pending' });
    expect(f.mock.calls.map((c) => bodyOf(c).type)).not.toContain('endRecording');
  });

  it('never throws when the command endpoint is unreachable (best-effort)', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const b = new DiagramTalkBridge({ fetchImpl: f as any, record: true, log: () => {} });
    await expect(b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' })).resolves.toBeUndefined();
  });
});

describe('DiagramTalk bridge — protocol-event overlay mapping (pure, v3)', () => {
  it('maps each funnel phase to its eject/correction lane (oN edge + l-* node)', () => {
    expect(phaseToOverlay('protocol_ack_pending')).toEqual({ edge: 'o1', lane: 'l-ack' });
    expect(phaseToOverlay('fact_collection')).toEqual({ edge: 'o2', lane: 'l-facts' });
    expect(phaseToOverlay('discussion')).toEqual({ edge: 'o3', lane: 'l-disc' });
    expect(phaseToOverlay('proposal_pending_endorsement')).toEqual({ edge: 'o4', lane: 'l-prop' });
    expect(phaseToOverlay('submittal_pending')).toEqual({ edge: 'o6', lane: 'l-submit' });
  });

  it('returns undefined for an unknown/absent phase', () => {
    expect(phaseToOverlay(undefined)).toBeUndefined();
  });
});

describe('DiagramTalk bridge — protocol events (v3 dispatch)', () => {
  const okFetch = () => vi.fn().mockResolvedValue({ ok: true, status: 200 });
  const bodyOf = (call: any) => JSON.parse((call[1] as any).body);

  it('endorsed: stops the badge on `endorse` then pulses `e4`', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, baseUrl: 'http://x', tagId: 'cur' });
    await b.onProtocolEvent({ taskId: 't', kind: 'endorsed' });

    expect(f).toHaveBeenCalledTimes(2);
    expect(bodyOf(f.mock.calls[0]!)).toMatchObject({
      type: 'setStateTag',
      input: { tagId: 'cur', shapeId: 'shape:endorse', label: 'endorsement' },
    });
    expect(bodyOf(f.mock.calls[1]!)).toMatchObject({
      type: 'highlight',
      input: { ids: ['shape:e4'] },
    });
  });

  it('correction: pulses the phase lane (oN + l-*) in the default correction colour (violet, in palette)', async () => {
    const f = okFetch();
    // No explicit colour -> the default must be a valid DiagramTalk HIGHLIGHT_COLORS
    // member {yellow, blue, green, red, violet}; orange (an earlier default) 400s live.
    const b = new DiagramTalkBridge({ fetchImpl: f as any });
    await b.onProtocolEvent({ taskId: 't', kind: 'correction', phase: 'discussion' });

    expect(f).toHaveBeenCalledTimes(1);
    expect(bodyOf(f.mock.calls[0]!)).toMatchObject({
      type: 'highlight',
      input: { ids: ['shape:o3', 'shape:l-disc'], color: 'violet' },
    });
  });

  it('eject: pulses the phase lane (oN + l-*) in the eject colour', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any, ejectColor: 'red' });
    await b.onProtocolEvent({ taskId: 't', kind: 'eject', phase: 'proposal_pending_endorsement' });

    expect(f).toHaveBeenCalledTimes(1);
    expect(bodyOf(f.mock.calls[0]!)).toMatchObject({
      type: 'highlight',
      input: { ids: ['shape:o4', 'shape:l-prop'], color: 'red' },
    });
  });

  it('correction/eject with no resolvable phase is a no-op (no command)', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any });
    await b.onProtocolEvent({ taskId: 't', kind: 'eject' }); // phase undefined
    expect(f).not.toHaveBeenCalled();
  });

  it('never throws when DiagramTalk is unreachable (best-effort)', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const b = new DiagramTalkBridge({ fetchImpl: f as any, log: () => {} });
    await expect(b.onProtocolEvent({ taskId: 't', kind: 'endorsed' })).resolves.toBeUndefined();
  });

  it('serialises commands: a slow endorsed badge is not overtaken by the next submittal', async () => {
    let releaseEndorse: (() => void) | undefined;
    const f = vi.fn().mockImplementation((_url: string, init?: any) => {
      const shapeId = init?.body ? JSON.parse(init.body).input?.shapeId : undefined;
      if (shapeId === 'shape:endorse') {
        return new Promise((res) => {
          releaseEndorse = () => res({ ok: true, status: 200 });
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
    const b = new DiagramTalkBridge({ fetchImpl: f as any, tagId: 'cur' });

    // endorsed (slow) emitted just before the submittal phase change — fire-and-forget.
    const p1 = b.onProtocolEvent({ taskId: 't', kind: 'endorsed' });
    const p2 = b.onPhase({ taskId: 't', phase: 'submittal_pending' });
    await new Promise((res) => setImmediate(res));

    // While the endorse tag is in flight, the submit tag must be BLOCKED behind it.
    const shapesSoFar = f.mock.calls.map((c) => bodyOf(c).input?.shapeId);
    expect(shapesSoFar).toContain('shape:endorse');
    expect(shapesSoFar).not.toContain('shape:submit');

    releaseEndorse!();
    await Promise.all([p1, p2]);

    const order = f.mock.calls.map((c) => bodyOf(c).input?.shapeId).filter(Boolean);
    expect(order.indexOf('shape:endorse')).toBeLessThan(order.indexOf('shape:submit'));
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
    expect(r.listenerCount('team_protocol_event')).toBe(0);
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

  it('also subscribes to team_protocol_event and dispatches it (v3)', async () => {
    process.env.AGENTTALK_DIAGRAM_BRIDGE = '1';
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const r = new EventEmitter();
    attachDiagramTalkBridge(r, { fetchImpl: f as any });
    expect(r.listenerCount('team_protocol_event')).toBe(1);

    r.emit('team_protocol_event', { taskId: 't', kind: 'endorsed' });
    await new Promise((res) => setImmediate(res));
    expect(f).toHaveBeenCalled();
  });
});
