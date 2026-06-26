/**
 * DiagramTalk live-flow bridge (M10 / LB-21).
 *
 * Watches the consensus protocol advance and drives the M10 state-machine diagram
 * in DiagramTalk LIVE: a single `tag` badge moves across the phase boxes and a
 * `highlight` pulse fires on the forward transition edge it just took.
 *
 * Design contract (see design discussion 2026-06-25):
 *  - The protocol brain (team-coordinator.ts) stays pure: it only fires an optional
 *    `onPhaseChange` hook, re-emitted by the Registry as a `team_planning_phase` event.
 *    ALL DiagramTalk I/O lives HERE, in the app layer.
 *  - Strictly best-effort, NEVER blocking — exactly like the usage meter. A diagram
 *    that is down, a closed tab, or a bad id must never perturb a consensus run.
 *  - OFF by default: only attaches when AGENTTALK_DIAGRAM_BRIDGE is set.
 *
 * Transport: plain HTTP POST to `${DIAGRAMTALK_URL}/api/diagram/commands`, replicating
 * the `tag` (setStateTag) and `highlight` commands of diagramtalk.py byte-for-byte.
 *
 * v1 scope = FORWARD SPINE ONLY: a moving badge + forward-edge pulses.
 *
 * v2 adds OPTIONAL record-for-replay (env AGENTTALK_DIAGRAM_RECORD, default OFF):
 * wrap each run in a DiagramTalk recording — start it as the run enters the root
 * phase, end it at submittal. The recording captures the `highlight` + `setStateTag`
 * events the bridge emits (RecordingEventType), so the bridge only opens and closes
 * it with no extra per-phase wiring. Capture is server-side AT ENQUEUE (DiagramTalk
 * `cd27775`) — independent of the browser's async apply, so it no longer races the
 * close; verified full-spine live 2026-06-26 (LB-24).
 * Record start/stop are first-class COMMANDS on the same command stream
 * (`startRecording`/`endRecording` — DiagramTalk added them so the bridge drives
 * everything through ONE endpoint, `POST ${baseUrl}/api/diagram/commands`).
 * `startRecording` returns the new recording id at `command.result.recordingId`;
 * `endRecording` closes it via `input.id`.
 * The `endorse` box / edge `e4` and the correction/eject overlay remain out (they
 * need new brain-emitted phases — a later iteration).
 */

import type { EventEmitter } from 'events';

/** The planning phases the brain reports, in forward order. */
export type PlanningPhase =
  | 'protocol_ack_pending'
  | 'fact_collection'
  | 'discussion'
  | 'proposal_pending_endorsement'
  | 'submittal_pending';

/** The shape the Registry re-emits on `team_planning_phase`. */
export interface PhaseChangeEvent {
  taskId: string;
  phase: PlanningPhase;
  previous?: PlanningPhase;
}

/** What a phase maps to on the M10 stage diagram. */
export interface PhaseVisual {
  /** Box shape id to move the state badge onto (`tag`). */
  box: string;
  /** Human label shown on the badge. */
  label: string;
  /** Forward transition edge id to pulse (`highlight`); absent for the entry phase. */
  edge?: string;
}

/**
 * Forward-spine map: engine phase -> diagram box + the edge that led into it.
 * Box/edge ids match design/diagrams/m10-affordance-protocol.layout.json. The
 * `endorse` box and edge `e4` are intentionally omitted (v1 forward-spine scope).
 */
export const FORWARD_SPINE: Readonly<Record<PlanningPhase, PhaseVisual>> = {
  protocol_ack_pending: { box: 'ack', label: 'ack' },
  fact_collection: { box: 'facts', label: 'fact_collection', edge: 'e1' },
  discussion: { box: 'disc', label: 'discussion', edge: 'e2' },
  proposal_pending_endorsement: { box: 'prop', label: 'proposal', edge: 'e3' },
  submittal_pending: { box: 'submit', label: 'submittal', edge: 'e5' },
};

/** Pure mapping — exported for unit testing without any I/O. */
export function phaseToVisual(phase: PlanningPhase): PhaseVisual | undefined {
  return FORWARD_SPINE[phase];
}

/**
 * DiagramTalk addresses shapes by their tldraw id, which is the layout's logical id
 * prefixed with `shape:` (e.g. layout `ack` -> live `shape:ack`). The map keeps the
 * bare logical ids (1:1 with the layout file); this applies the transport prefix.
 */
export function shapeRef(layoutId: string): string {
  return layoutId.startsWith('shape:') ? layoutId : `shape:${layoutId}`;
}

export interface DiagramTalkBridgeOptions {
  /** DiagramTalk base url. Defaults to env DIAGRAMTALK_URL, then http://localhost:3000. */
  baseUrl?: string;
  /** Optional target diagram id (auto-switches the tab); omit to use the active diagram. */
  diagramId?: string;
  /** Tag id for the single moving state badge; reuse moves it across boxes. */
  tagId?: string;
  /** Badge colour. */
  tagColor?: string;
  /** Transition pulse colour. */
  highlightColor?: string;
  /**
   * Opt in to wrapping each run in a DiagramTalk recording (start on the root
   * phase, end at submittal). Defaults to env AGENTTALK_DIAGRAM_RECORD (OFF when
   * unset) — so the default bridge run is unchanged.
   */
  record?: boolean;
  /** Optional name applied to recordings opened when `record` is on. */
  recordName?: string;
  /** Injectable fetch + logger for testing. */
  fetchImpl?: typeof fetch;
  log?: (msg: string, err?: unknown) => void;
}

/**
 * Translates phase-change events into DiagramTalk `tag`/`highlight` commands.
 * Every network call is best-effort: failures are logged once and swallowed.
 */
export class DiagramTalkBridge {
  private readonly baseUrl: string;
  private readonly diagramId?: string;
  private readonly tagId: string;
  private readonly tagColor: string;
  private readonly highlightColor: string;
  private readonly record: boolean;
  private readonly recordName?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string, err?: unknown) => void;
  /** Id of the recording this bridge currently has open, if any (v2 record path). */
  private recordingId: string | undefined = undefined;

  constructor(opts: DiagramTalkBridgeOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ?? process.env.DIAGRAMTALK_URL ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    if (opts.diagramId) this.diagramId = opts.diagramId;
    this.tagId = opts.tagId ?? 'consensus-cursor';
    this.tagColor = opts.tagColor ?? 'green';
    this.highlightColor = opts.highlightColor ?? 'yellow';
    this.record = opts.record ?? Boolean(process.env.AGENTTALK_DIAGRAM_RECORD);
    if (opts.recordName !== undefined) this.recordName = opts.recordName;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.log = opts.log ?? ((msg, err) => console.error(msg, err ?? ''));
  }

  /** Handle one phase transition: move the badge, then pulse the transition edge. */
  async onPhase(evt: PhaseChangeEvent): Promise<void> {
    const visual = phaseToVisual(evt.phase);
    if (!visual) return; // phase not on the v1 forward spine
    // Run startup = the spine entry (the edgeless root phase): wipe any stale badge
    // left on the canvas by a prior run so each run — and any recording wrapped
    // around it — starts from a clean stage.
    if (!visual.edge) {
      // v2: open a fresh recording for this run (closing any we left open on a
      // prior, interrupted run) BEFORE the clear/tag, so the whole run is captured.
      if (this.record) {
        await this.endRecording();
        await this.startRecording();
      }
      await this.post({
        type: 'setStateTag',
        input: { tagId: this.tagId, clear: true },
      });
    }
    // Move the state badge onto the new box.
    await this.post({
      type: 'setStateTag',
      input: {
        tagId: this.tagId,
        shapeId: shapeRef(visual.box),
        label: visual.label,
        color: this.tagColor,
      },
    });
    // Pulse the edge we just traversed (entry phase has none).
    if (visual.edge) {
      await this.post({
        type: 'highlight',
        input: { ids: [shapeRef(visual.edge)], color: this.highlightColor },
      });
    }
    // v2: submittal is the terminal forward phase — close the recording here.
    // (History, LB-24: an earlier DiagramTalk captured only on the browser's async
    // `applied` result, which raced this close and dropped frames. Fixed upstream —
    // capture is now server-side AT ENQUEUE (DiagramTalk `cd27775`) — so the submit
    // tag+pulse, enqueued just above before this close, are recorded. Re-verified live
    // 2026-06-26: full spine, eventCount=10.)
    if (this.record && evt.phase === 'submittal_pending') {
      await this.endRecording();
    }
  }

  /**
   * Best-effort POST to /api/diagram/commands — never throws. Returns the Response
   * on success (so a caller like startRecording can read the body), undefined otherwise.
   */
  private async post(
    command: { type: string; input: Record<string, unknown> },
  ): Promise<Response | undefined> {
    const body = this.diagramId ? { ...command, diagramId: this.diagramId } : command;
    return this.safeFetch(
      `${this.baseUrl}/api/diagram/commands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      command.type,
    );
  }

  /**
   * v2: open a recording for this run (via the `startRecording` command) and remember
   * the id it returns. Best-effort: a failure (or an unparseable body) just leaves us
   * without a replay handle, so the run proceeds and we never close one we didn't open.
   */
  private async startRecording(): Promise<void> {
    const input = this.recordName != null ? { name: this.recordName } : {};
    const res = await this.post({ type: 'startRecording', input });
    if (!res) return;
    try {
      const data = (await res.json()) as { command?: { result?: { recordingId?: string } } };
      this.recordingId = data?.command?.result?.recordingId;
    } catch {
      /* best-effort: no usable id -> we won't try to close it */
    }
  }

  /**
   * v2: close the recording THIS bridge opened (via `endRecording` with its concrete
   * id). No-op when we never captured an id, so we never end one we didn't start.
   */
  private async endRecording(): Promise<void> {
    const id = this.recordingId;
    if (!id) return;
    this.recordingId = undefined;
    await this.post({ type: 'endRecording', input: { id } });
  }

  /**
   * Best-effort fetch shared by the command + recording calls — never throws.
   * Returns the Response on success (so callers can read a body), or undefined on a
   * non-OK status or a network error (logged once, then swallowed).
   */
  private async safeFetch(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<Response | undefined> {
    try {
      const res = await this.fetchImpl(url, init);
      if (!res.ok) {
        this.log(`[DiagramTalkBridge] ${label} -> HTTP ${res.status} (ignored)`);
        return undefined;
      }
      return res;
    } catch (err) {
      this.log(`[DiagramTalkBridge] ${label} unreachable (ignored)`, err);
      return undefined;
    }
  }
}

/**
 * Attach the bridge to a Registry IF enabled via env (AGENTTALK_DIAGRAM_BRIDGE).
 * Returns the bridge when attached, otherwise undefined. Subscription is the only
 * side effect; the brain is untouched.
 */
export function attachDiagramTalkBridge(
  registry: EventEmitter,
  opts: DiagramTalkBridgeOptions = {},
): DiagramTalkBridge | undefined {
  if (!process.env.AGENTTALK_DIAGRAM_BRIDGE) return undefined;
  const bridge = new DiagramTalkBridge(opts);
  registry.on('team_planning_phase', (evt: PhaseChangeEvent) => {
    void bridge.onPhase(evt);
  });
  return bridge;
}
