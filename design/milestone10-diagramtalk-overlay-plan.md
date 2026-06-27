# M10 — DiagramTalk bridge v3: endorse stop + eject/correction overlay (`endorse`/`e4` + `o1–o6`)

**Status:** ✅ MERGED to `master` at `53593a4` + pushed. Live-verified (badge-walk, Fausto watched 2026-06-26).
Gate: tsc 0, suite 225/225. Full record: ledger §Bridge-v3 + logbook LB-26; status correction LB-31.
Deviation from this plan: default `correctionColor` is **violet** not orange (orange 400s — not in DiagramTalk's
HIGHLIGHT_COLORS; caught by the live badge-walk).
**Author:** Claude (planner/architect), 2026-06-26.
**Decisions taken (Fausto, this session):** scope = **full basket** (endorse/e4 **and** the o1–o6 overlay);
emission approach = **observation-only hook** (a separate best-effort emitter that NEVER feeds consensus
validation — the brain's protocol behaviour stays provably unchanged).

---

## 1. Why / what's left

The v1 forward-spine bridge (LB-22, merged) walks a badge `ack → facts → disc → prop → submit`. Two diagram
features remain dark, both flagged in the bridge header as needing **new brain-emitted signals**:

- **`endorse` box + edge `e4`.** The true spine is `prop ─e4("proposed")→ endorse ─e5("accepted")→ submit`.
  v1 maps `submittal_pending → submit` pulsing **e5**, so the badge **jumps `prop ▶ submit`**, never landing on
  `endorse` or pulsing `e4`. This piece adds the missing stop.
- **`o1–o6` overlay.** Each `oN` is an edge from a phase box down to its eject/correction lane node (`l-*`):
  `o1`=ack, `o2`=facts, `o3`=disc, `o4`=prop, `o5`=endorse, `o6`=submit. Lighting these shows when a planner is
  **corrected (T2 graded loop)** or **ejected (T1)** at a given phase.

```
 ack ─e1→ facts ─e2→ disc ─e3→ prop ─e4→ endorse ─e5→ submit
  │o1      │o2       │o3      │o4    │o5            │o6
  ▼        ▼         ▼        ▼      ▼              ▼
 l-ack    l-facts   l-disc   l-prop l-endorse      l-submit      (eject/correction lane)
```

## 2. Scope — files I MAY touch

| File | Change |
|---|---|
| `packages/runtime-core/src/registry/team-coordinator.ts` | **Additive only:** a new optional dep `onProtocolEvent?`, a `ProtocolEvent` type, and **3 best-effort emission calls** at the sites below. Same try/catch-and-swallow discipline as the existing `setPlanningPhase`→`onPhaseChange` hook. **No** change to validation, control flow, state, or any existing behaviour. |
| `packages/runtime-core/src/registry/registry.ts` | One line mirroring `team-coordinator.ts:124`: re-emit `onProtocolEvent` as a `team_protocol_event` registry event. |
| `apps/orchestrator/src/diagramtalk-bridge.ts` | Subscribe to `team_protocol_event`; map endorsed→`endorse`/`e4`, correction/eject→`oN`/`l-*`; add a small **command-ordering queue** so the endorsed badge can't be overtaken by the immediately-following submittal badge. |
| `apps/orchestrator/src/__tests__/diagramtalk-bridge.test.ts` | New bridge cases (mapping, ordering, best-effort swallow). |
| `packages/runtime-core/src/registry/__tests__/*` (the existing team-coordinator test file) | New cases asserting the hook fires with the right `{kind, phase}` and that hook-unset / throwing-hook behaviour is unchanged. |

**Explicitly NOT in scope (show-stopper if touched):** `validateProtocolStep` / `ejectPlanner` *logic*,
`getPlanningPhase`, `setPlanningPhase`, any consensus/validation/timer behaviour, the MCP path
(`McpCompleter`), T4 code. I only **add an emit call** inside `ejectPlanner` / the validation retry branch — I
do not alter what they decide or do.

## 3. The observation-only hook (the Rule-2 safety boundary)

```ts
// team-coordinator.ts
export type ProtocolEventKind = 'endorsed' | 'correction' | 'eject';
export interface ProtocolEvent {
  taskId: string;
  kind: ProtocolEventKind;
  phase?: PlanningPhase;   // phase the event occurred at → selects the oN edge / l-* node
  agentId?: string;
  reason?: string;
}
// deps: onProtocolEvent?: (evt: ProtocolEvent) => void;

private emitProtocolEvent(evt: ProtocolEvent): void {
  try { this.deps.onProtocolEvent?.(evt); }
  catch (err) { this.deps.logError('[TeamCoordinator] onProtocolEvent hook threw (ignored)', err); }
}
```

This is **pure observability**: it reads no consensus state to *decide* anything, returns nothing, and feeds
nothing back into validation. With the dep unset (every existing caller, all current tests) behaviour is
**byte-identical** to today.

## 4. Emission sites (3) — exact locations

1. **`endorsed`** — in the `agreement_acceptance` handler, **immediately before**
   `this.setPlanningPhase(task.id, 'submittal_pending')` (currently `team-coordinator.ts:662`). The agreement has
   just been accepted/endorsed; emit `{ kind:'endorsed', phase:'proposal_pending_endorsement' }`.
2. **`correction`** — in `validateProtocolStep`, inside the **retry branch** (`retryCount < MAX_REGRESSION_RETRIES`,
   currently `:1884–1891`), alongside the existing `askRegressionConfirmation`/`askProtocolCorrection` call. Emit
   `{ kind:'correction', phase:getPlanningPhase(taskId), agentId:senderAgentId }`.
3. **`eject`** — in `ejectPlanner`, after the task is found (currently `:1604`). Emit
   `{ kind:'eject', phase:getPlanningPhase(task.id), agentId, reason }`.

## 5. Bridge mapping (app layer)

- **endorsed** → `setStateTag` badge → `shape:endorse` (label `endorsement`), then `highlight e4`. The existing
  `submittal_pending` phase event then moves the badge → `submit` + pulses `e5` (sequence: prop → endorse → submit).
- **correction at phase P** → `highlight [oN(P), l-node(P)]` in an **amber** "retry" colour.
- **eject at phase P** → `highlight [oN(P), l-node(P)]` in a **red** "terminal" colour.
- Phase → (oN, l-node): `protocol_ack_pending`→(o1,l-ack) · `fact_collection`→(o2,l-facts) ·
  `discussion`→(o3,l-disc) · `proposal_pending_endorsement`→(o4,l-prop) · `submittal_pending`→(o6,l-submit) ·
  (endorse lane o5/l-endorse kept in the map for completeness; no phase currently resolves to it).

**Ordering queue.** `endorsed` and `submittal_pending` are emitted back-to-back in one synchronous handler; the
registry dispatches both to the bridge as fire-and-forget async, so their HTTP posts could interleave and flip the
badge. The bridge will serialise all commands through a single tail-promise chain
(`this.tail = this.tail.then(send)`), so post order == emission order. Stays entirely in the app layer; v1 spine
tests must remain green.

## 6. Risk & honesty notes

- The brain edits are **additive emit-only**, mirroring an already-merged, already-reviewed pattern
  (`onPhaseChange`). This is the "trivial AND provably safe" lane *and* it's pre-authorised by Fausto's scope
  decision — but **merge stays human-gated** (LB-14).
- **No live LLM run** is needed to prove emission (same as v1): the hook firing is unit-tested; the visual mapping
  is unit-tested; a manual live badge-walk against the M10 diagram is **optional verification**, offered not owed.
- `getPlanningPhase` is **read-only** here; calling it from the new emit sites does not mutate anything.

## 7. Gate & DoD

- `npm run build` (tsc -b) → 0 errors.
- `npm test` → full suite green (current baseline **213/213**; this adds N cases → 213+N).
- `git diff --stat` shows **only** the files in §2.
- `git status` clean of `planning_runs/` noise per LB-9 (pre-existing, not pollution).
- DoD: with `AGENTTALK_DIAGRAM_BRIDGE` set, the badge stops on `endorse` (pulsing `e4`) before `submit`, and a
  correction/eject lights the matching `oN`+`l-*`; with the bridge OFF / hook unset, behaviour is unchanged.

## 8. Retry budget (Rule 7) — declared per check at implementation time

Per-test budgets locked before each run (e.g. "bridge ordering test: max 2"). Show-stopper fence (Rule 2) stops me
earlier than any budget if a brain change turns out non-trivial.
