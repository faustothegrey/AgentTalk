# Self-Hosting Program (M16 → M18) — AgentTalk improves itself

**Status:** 🟡 **DRAFT — PO↔Architect inception recorded (2026-07-02 late session, compressed ceremony per
M15 precedent); awaiting Codex (planner) advisory POV and the ~2026-07-08 backlog gate.** Build starts after
Codex's weekly reset (Jul 7 ~07:14) unless the PO says otherwise.
**PO:** Fausto · **Architect:** Claude (author) · **Planner + SM:** Codex · **Implementer:** Gemini/agy ·
**Reviewer:** per-epic PO call (M15 note: independent review after any self-reviewed closure).
**Sacred goal (PO, 2026-07-02):** set AgentTalk up so it **incrementally improves itself**.

## The flywheel (what "improves itself" means here)

Self-improvement is a **loop we enter**, not a feature we ship. The human stays the governor: merges and
scope remain PO-gated (`[Human]`), exactly as the Mode-A ratifier frame worked in M15.

```mermaid
flowchart LR
    A["1 · Dev epic runs THROUGH AgentTalk<br/>(batons, gates, debates — recorded)"] --> B["2 · Recordings + telemetry<br/>make friction OBJECTIVE"]
    B --> C["3 · SM files top friction<br/>as backlog items (evidence, not memory)"]
    C --> D["4 · Next epic fixes worst friction<br/>USING the channel it improves"]
    D --> E["5 · Loop gets cheaper<br/>each iteration"]
    E --> A
    PO(("PO gate<br/>[Human]")) -.ratifies merges/scope.-> D
```

The loop closes for the first time at **M18** (first epic about AgentTalk coordinated *by* AgentTalk).
M16–M17 are bootstrap. Standing insurance for the whole program: **the terminal relay stays a declared,
working fallback** — freeze-don't-remove, per the protocol-machine precedent. If a step goes sideways, we
fall back for that step only, file what broke as spike gold, and take a smaller bite.

## Target topology

```mermaid
flowchart TB
    subgraph agents [Live agent CLI sessions]
        CL["Claude Code<br/>(reviewer/architect)"]
        CX["Codex CLI<br/>(planner+SM)"]
        AG["agy/Gemini<br/>(implementer)"]
    end
    subgraph brain [AgentTalk brain]
        AT["Registry / coordinators<br/>await_turn · send_to_agent"]
        REC["NDJSON recording<br/>(AGENTTALK_DIAGRAM_RECORD)"]
    end
    CL <-- "MCP attach" --> AT
    CX <-- "MCP attach" --> AT
    AG <-- "MCP attach" --> AT
    AT --> REC
    PO["Fausto — UI observer + [Human] gate<br/>(terminal relay = declared fallback)"] --- AT
```

## Milestone ladder

### M16 — One real baton *(embarrassingly small, by design)*

**Goal.** Two live agent sessions attach (planner-seat and reviewer-seat); **one origin-tagged, role→role
baton** travels through the brain, is recorded, and the PO watches it land in the UI instead of pasting it.
**Scope sketch (fence at epic plan time).** Attach-mode plumbing reuse (M05); a minimal baton message shape
carrying the Origin Tag Protocol tag as data; recording on; a live proof run. **No** new consensus logic,
**no** `team-coordinator.ts` diff (frozen path + suite + M14 identity harness remain the freeze bar), **no**
UI beyond what exists.
**DoD claim sketch.** C1: one real baton delivered agent→agent through the brain, recorded (NDJSON evidence
with the tag visible). C2: freeze bar green. C3: fallback documented — the same baton relayed by terminal
still works.
**Known unknown (the reason M16 exists):** the **idle-agent wake problem** — see SP-WAKE below. M16's shape
(blocking `await_turn` vs. pull-on-poke) is decided by the spike's evidence, not by optimism.

### M17 — The gate over the channel

**Goal.** Reviewer verdicts and SM go/no-go flow through AgentTalk; **origin tags become structured metadata
the brain enforces** (a `[Codex]` operational instruction vs. `[Human]` PO act is machine-checkable, not
square-bracket convention). PO relay burden shrinks to poking idle agents (or nothing, if SP-WAKE says
blocking waits hold).
**Scope sketch.** Message metadata schema + enforcement at routing; gate events surfaced in UI/recording;
workflow docs updated to name the channel as primary and terminal as fallback.
**DoD claim sketch.** C1: a real reviewer verdict and a real SM go delivered and recorded over the channel.
C2: a PO-level act attempted with a non-`[Human]` tag is refused by the brain (negative test). C3: freeze
bar green.

### M18 — Self-hosting milestone *(the flywheel's first turn)*

**Goal.** One full, deliberately small dev epic runs end-to-end on the substrate — planning baton, gates,
implementation hand-offs, closure — with the terminal used only if a declared fallback moment occurs.
**Scope sketch.** No new machinery by default; this epic *consumes* M16+M17. Candidate rider: repair the
DiagramTalk endpoint (unavailable since M15-T3) so recordings render as live diagrams — observability
dessert, PO's "spectacular diagrams" done properly. Post-epic: SM files friction→backlog from the
recordings — **that act closes the loop and is the program's true DoD.**
**DoD claim sketch.** C1: the epic's every baton/gate exists in the recording. C2: friction→backlog entries
cite recording evidence. C3: PO relay count during the epic ≈ 0 (poke-only or none); fallback moments, if
any, honestly logged.

## SP-WAKE — preparatory spike (architect's side-dish pick; runs on PO go, pre-Jul-8 window)

**Question.** Can a long-lived interactive CLI session (Claude Code / Codex CLI) attach to AgentTalk over
MCP, block on `await_turn` for a realistic idle period, and wake cleanly when a baton arrives — repeatedly?
M05 proved attach-and-complete-a-turn with a harness; it did **not** prove long-lived interactive blocking.
**Method.** One attached real session + one harness-driven sender; three probes: (a) immediate turn, (b)
turn after ≥10 min idle, (c) two consecutive turns without re-attach. Recording on. Client-side timeout
behavior noted per CLI.
**Pre-registered budgets:** attach + probe (a): max 2 attempts · probe (b): max 2 · probe (c): max 2 ·
freeze-bar re-run after any code touch: 1. Hygiene sweep (`git worktree list`, `ps`) every round.
**Honest bar.** Outcome is a **finding, not a pass/fail**: "blocking holds" → M16 uses `await_turn`;
"blocking breaks at N minutes / on timeout X" → M16 ships pull-on-poke and the finding seeds an M17+ wake
fix. Either answer is spike gold. **Scope fence:** no runtime changes without a fresh PO go; observation
first.
**Resources.** Cents-scale LLM cost (none expected — plumbing only), one session slot on Claude or agy;
Codex not required.

## Sequencing & resources (inception record)

- **Build waits for full strength: ~Jul 8** (Codex weekly resets Jul 7 ~07:14; at inception Codex 84% weekly,
  Claude ~30%, agy fresh daily). Pre-Jul-8 window = side dishes only: this draft, Codex's advisory POV
  (cheap), SP-WAKE on PO go.
- **Serial actors rule stands** (PO, 2026-06-22): no parallel agent development until per-actor token
  attribution exists — parallel digging would blind the telemetry the flywheel depends on. Re-examined, not
  removed, inside this program (per-actor attribution is itself a likely early friction→backlog item).
- **Backlog:** M16 (and the program pointer) to be gated into `backlog.md` at the ~Jul-8 backlog gate by the
  SM with the PO — not pre-created here; this draft is the inception artifact the gate consumes.
- **Per-epic plans** (fences, full DoD tables, per-check budgets) get authored at each epic's own inception;
  the sketches above are altitude, not spec.

## Risks (stated at this altitude)

1. **Wake fragility** (the M16 unknown) — mitigated by SP-WAKE deciding M16's shape before the epic opens.
2. **Coordination-on-coordination:** a substrate bug mid-epic takes the team's channel down — mitigated by
   the standing terminal fallback and M18's "deliberately small epic" rule.
3. **Meta-work creep** (Claude's recorded recurring blind spot): the program must not grow ceremony faster
   than it removes relay burden. Proportionality check at every gate: *did the PO's per-epic relay count go
   down?* If not, the program is failing regardless of green suites.
