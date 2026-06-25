# Milestone 10 — Protocol compliance via affordance-based tool exposure — Plan

> **Spike-led epic.** M10 makes multi-agent consensus *robust* by attacking the root cause logged in
> **LB-10**: agents don't reliably follow the multi-phase protocol, and **tolerance ≠ compliance**.
> Phase 1 (this plan's focus) is a **feasibility spike** — read/research + small probes, **no
> production changes** — that answers whether the production substrate can support an "affordance
> protocol" before we commit to building one. Phase 2 (implementation) is deliberately left to be
> *shaped by the spike's findings*.

## 1. Thesis (from LB-10) — compliance, not tolerance

Across M06–M08 the recurring failure (LB-6/7/8) is agents not following the consensus phase machine
(ack → fact_collection → discussion → proposal → endorsement → submit_plan); weak models hallucinate
transitions. M08 made the engine **tolerant** (no dual-crash on an illegal move) — but a tolerant
engine + a non-compliant agent **stalls/times out**. The cure is **compliance**.

**The lever — "affordance protocol" vs "prose protocol":**
- **Today (prose):** the brain *describes* the protocol in prose, the model **self-tracks its phase and
  self-selects `message_type`**, and the brain **validates/rejects after the fact**.
- **Proposed (affordance):** the brain (which already knows the phase) **exposes only the tool(s) legal
  for the current phase** — an illegal move is never on the menu, like greyed-out buttons. Helps the
  *weakest* models most; the natural next step of the M07 "centralized brain" thesis (brain owns
  per-turn **affordances**, not just prompt/parse/lifecycle).

Visual: `M10 · Affordance Protocol` diagram on DiagramTalk (phases spine → per-phase legal tool →
prose-problem / affordance-solution / spike-fork annotations). Render archived at scoping time.

## 2. Why spike-led — the feasibility fork (the heart of Phase 1)

The two execution paths have different **compliance ceilings**, and the production one is **unverified**:

| Path | Can the brain constrain the per-turn tool set? |
|---|---|
| **API** (in-process) | We control the request → native function-calling, per-call tool sets, schema-enforced args. Affordance protocol **likely fully achievable**. |
| **MCP** (agy/claude/codex — the *production* direction) | Raw prompt → raw text; the MCP runs its **own** internal tool loop → we may **not** be able to restrict its per-turn tools. Possibly irreducibly freeform → stuck with prose+parse+tolerance (weakest substrate). **UNKNOWN — this is the spike's core question.** |

LB-10's open fork: **is the API path the better substrate for robust consensus, with MCP reserved for
single-agent execution?** The implementation plan can't be written until this is resolved.

## 3. Phase-1 spike — goal & boundaries

**Goal:** produce an evidence-backed findings report that (a) answers the three LB-10 questions, (b)
resolves the API-vs-MCP substrate fork with a recommendation, and (c) sketches the Phase-2
implementation (or returns a no-go/alternative). **It is exploratory: read, research, and *small*
probes only.**

**STRICTLY out of scope (do NOT change):** the protocol engine (`team-coordinator.ts`), the brain
(`in-process-driver.ts`, the MCP completer), the wire-contract, any provider wiring. No affordance
implementation in Phase 1 — that's Phase 2. Also out of M10 entirely: **operator abort/recovery for
`awaiting_operator` tasks** (M08-T3 shipped fence-only; explicitly its *own* future milestone).

## 4. Spike questions → concrete investigations

- **SQ1 — API-path function-calling guarantees.** For each in-process API provider we use: can we
  restrict the **offered tool set per call**? Is there **enforced arg-schema** / constrained decoding /
  forced tool choice? *Method:* read each provider's current function-calling docs/SDK — **do not
  answer from memory**; for Anthropic use the `claude-api` skill, for others their current API docs —
  plus a minimal live probe if a doc is ambiguous.
- **SQ2 — MCP-path per-turn tool constraint.** Does the MCP transport (agy/claude/codex MCP servers)
  expose **any** hook to constrain which tools the agent may call **this turn**, or is it irreducibly
  freeform-text with its own internal tool loop? *Method:* inspect the MCP server interfaces +
  `mcp-server.ts`/the attach turn-loop; check each provider-MCP's documented options.
- **SQ3 — substrate fork + injection map.** Given SQ1/SQ2: API-as-consensus-substrate vs MCP-for-
  execution-only — recommend. *Method:* map the **current** per-turn affordance/validation points in the
  code (where the brain builds the prompt and validates `message_type`) so Phase 2 has concrete
  injection sites, and weigh the fork against them.

## 5. Definition of Done (Phase-1 spike)

1. **Findings report** answering SQ1, SQ2, SQ3 with **cited evidence** (provider docs + code refs), not
   assertions — recorded as a logbook `LB-N` entry (+ this plan updated).
2. **Substrate-fork recommendation** (API-substrate vs hybrid vs MCP-also-works), with the reasoning.
3. **Phase-2 sketch or go/no-go:** if affordances are feasible, a concrete injection-point list and a
   proposed Phase-2 task breakdown; if not, the alternative (e.g. stronger post-hoc coercion).
4. **No production code changed** (Rule 5 self-check clean); any probe code lives in `scratchpad/` or a
   clearly-marked throwaway, not the repo.

## 6. Sequencing & notes

- Phase 1 is **research/feasibility**; Phase 2 (implementation) is a *separate* plan written **after**
  the spike reports. Do not pre-commit Phase-2 scope here.
- Implementer = Claude under LB-14 (Gemini out of budget); the spike is read/research-heavy → low token
  burn relative to impl, but **serial-actor rule** still applies.
- Honesty over results: a clear "MCP can't constrain per-turn tools, so the production path can't fully
  comply" is a **valuable** spike result, not a failure.

## 7. Open items

- **✅ Milestone numbering — ACCEPTED (Fausto, 2026-06-25): M10 = this epic** (consensus/protocol
  robustness via affordance-based tool exposure), renumbered from the former M09.
- **Spike depth bound** — cap Phase-1 at the three SQs above; resist expanding into Phase-2 design
  mid-spike (LB-10 warns: "focused spike, not an open-ended dive").
