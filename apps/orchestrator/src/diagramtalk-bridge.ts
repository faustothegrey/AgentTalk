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
 * v1 scope = FORWARD SPINE ONLY: the `endorse` box / edge `e4` and the
 * correction/eject overlay are intentionally out (a later iteration).
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
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string, err?: unknown) => void;

  constructor(opts: DiagramTalkBridgeOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ?? process.env.DIAGRAMTALK_URL ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    if (opts.diagramId) this.diagramId = opts.diagramId;
    this.tagId = opts.tagId ?? 'consensus-cursor';
    this.tagColor = opts.tagColor ?? 'green';
    this.highlightColor = opts.highlightColor ?? 'yellow';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.log = opts.log ?? ((msg, err) => console.error(msg, err ?? ''));
  }

  /** Handle one phase transition: move the badge, then pulse the transition edge. */
  async onPhase(evt: PhaseChangeEvent): Promise<void> {
    const visual = phaseToVisual(evt.phase);
    if (!visual) return; // phase not on the v1 forward spine
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
  }

  /** Best-effort POST to /api/diagram/commands — never throws. */
  private async post(command: { type: string; input: Record<string, unknown> }): Promise<void> {
    const body = this.diagramId ? { ...command, diagramId: this.diagramId } : command;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/diagram/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.log(`[DiagramTalkBridge] ${command.type} -> HTTP ${res.status} (ignored)`);
      }
    } catch (err) {
      this.log(`[DiagramTalkBridge] ${command.type} unreachable (ignored)`, err);
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
