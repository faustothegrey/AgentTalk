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

  it('posts only the tag for the entry phase (no edge to pulse)', async () => {
    const f = okFetch();
    const b = new DiagramTalkBridge({ fetchImpl: f as any });
    await b.onPhase({ taskId: 't', phase: 'protocol_ack_pending' });
    expect(f).toHaveBeenCalledTimes(1);
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
