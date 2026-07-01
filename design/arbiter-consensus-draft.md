# Draft — Semantic arbiter & the two consensus modes

**Status:** ✏️ **DRAFT — ideation capture, NOT a plan, NOT gate-approved.** This is a heavyweight idea, still
half-formed by design. It captures a PO↔Architect shaping conversation so we can return to it *calmly, with more
input*, and decide whether it fathers **one or more epics**. Nothing here is decided or scheduled.
**Author:** Claude (architect), 2026-07-01. **PO:** Fausto (owns the direction; the *what*/*why* below are his).
**Type:** pre-epic direction draft (consensus core re-architecture). **Not** a `*-plan.md` — no DoD, no branch.

---

## 1. The problem (why touch a working consensus at all)

Today, a team resource advances through its lifecycle — `fact_collection → discussion → agreement → proposal →
submit` — **because the protocol says so**. The engine's state machine drives advancement off **structured
declarations** the agents must emit (`message_type` + payload). Agents therefore have to **self-classify** their
own utterance into the right protocol slot and **self-advance** the state.

The friction, in Fausto's words: *"per gli LLM non è proprio naturale."* Consequences we've already hit
(LB-6/LB-7, the late-message race, the M11 tolerance work): a well-formed-but-phase-illegal `message_type`, or
malformed JSON, crashes the team; models pick legal-but-wrong actions; the strict phase machine has near-zero
tolerance. M11 has been **band-aiding** this (warn+coerce instead of throw).

## 2. The core idea — advancement by a semantic arbiter

Move the advancement decision **off the agents** and onto a **semantic arbiter**: an entity that **reads the
agents' responses and decides, by meaning, whether to advance the state.** The agents just talk naturally; the
arbiter *"tiene le fila"* (holds the threads) and pushes the team toward the goal. **The responsibility is the
arbiter's. Full stop.** Single-point-of-responsibility is a known cost — to be *mitigated later*, not solved
first.

Architecturally this is **not** foreign to AgentTalk — it is the M07 *centralized brain / inversion* thesis taken
to completion: the brain already owns lifecycle + `message_type→tool` mapping; here it also owns the **semantic
judgment** of progress, and the edge stays *dumb*.

> **Framing note:** this is not "simplification" so much as **relocation of complexity** — off the agent
> (syntactic, brittle, unnatural) and onto the brain (semantic, flexible, judgment-based). The trade is
> **"rigid-but-deterministic" → "flexible-but-judged."**

## 3. The refined model — TWO modes over ONE shared push (Fausto, 2026-07-01)

The decisive refinement: the arbiter is **not** a replacement for the signing protocol — the two are
**complementary modes**, and the *"spinta verso il traguardo è condivisibile tra le due modalità"* (the push
toward the goal is shareable between the two modes). Hybrid was explicitly **rejected** as *"troppo cervellotico"*
— these are two clean modes, not a blend.

```
                    ┌─────────────────────────────────────────────┐
   SHARED LAYER     │  FACILITATOR / "the push"                   │
   ("tiene le fila")│  reads the room, judges convergence,        │
                    │  drives toward "ready to close". Semantic.  │
                    └───────────────────┬─────────────────────────┘
                                        │  "are we there?"
                    ┌───────────────────┴─────────────────────────┐
   PER-MODE LAYER   │        RATIFICATION / minting strategy      │
   (who makes the   ├──────────────────────┬──────────────────────┤
    product & how   │  A — ARBITER-SYNTH    │  B — COLLECTIVE-SIGN  │
    it becomes      │  the arbiter AUTHORS  │  one agent proposes,  │
    binding)        │  the deliverable.     │  ALL agents SIGN the  │
                    │  Responsibility: its. │  SAME artifact.       │
                    │  Consensus: semantic. │  Consensus: literal,  │
                    │  (design docs, open-  │  unanimous. (the plan │
                    │   ended deliverables) │   binding on everyone)│
                    └──────────────────────┴──────────────────────┘
```

The line that pins the whole distinction (Fausto): *"alla fine il prodotto lo fa l'arbitro, c'è poco da fare"* —
in **Mode A the arbiter synthesizes** the deliverable and owns it; in **Mode B nobody synthesizes — everyone signs
the identical solution and it is that one for all.** The **facilitator** (the push) is the *same object* in both
modes; only what happens at *"ci siamo"* differs.

### Mode comparison

| | **A — Arbiter-synthesis** | **B — Collective-signing** |
|---|---|---|
| Deliverable produced by | the arbiter (authors it) | an agent (proposes), ratified by all |
| Consensus type | semantic / soft (arbiter judges alignment) | literal / hard (identical artifact, unanimous) |
| Responsibility | concentrated in the arbiter | distributed across signers |
| Natural use case | agents debate a **design/programming document** → arbiter drives to a deliverable | a **binding plan/solution** all executors must commit to |
| Determinism / test | **non-deterministic** → golden-set on recorded transcripts | **deterministic-ish** → "did all sign the same artifact?" |
| Maps to today | new | ≈ the **existing** `submit_plan`/`agreement_*` flow |

## 4. Architectural observations (the load-bearing ones)

1. **Evolutionary, not greenfield.** Today's protocol (`submit_plan → agreement_proposal →
   agreement_acceptance`) **already *is* Mode B** — propose then sign. So the work is: **extract the shared
   facilitator** out of the state machine, and **add Mode A as a sibling strategy**. We build *on* what holds, not
   against it — reassuring for a heavyweight.
2. **The single-point is heavier in A than in B — and it must be said.** In B the risk is distributed (unanimous
   signing is itself a redundancy: one refusal blocks closure). In **A the arbiter both advances the state *and*
   authors the product** — two powers in one point; the single-point-of-responsibility, squared. Mitigations
   (arbiter panel/quorum, arbiter + hard-rule floor, confidence threshold + human fallback) are **deferred by
   design** — don't over-engineer redundancy before proving a single arbiter judges reliably.
3. **Different test strategies — and that's what makes rollout safe.** B stays **deterministic** (mechanically
   verify "all signed the same artifact") → the deterministic gate M11 demands survives. A is the
   non-deterministic one → needs a **golden-set over recorded transcripts** (the repo already has
   `AGENTTALK_DIAGRAM_RECORD` + `npm run play-recording`). So we can **ship the facilitator + Mode B (deterministic)
   first**, and bring Mode A in behind the semantic harness **without ever breaking the deterministic bar**.

## 5. Open design questions (to resolve on return — none are decided)

- **Facilitator vs Author: one entity or two?** In Mode A, is the thing that *advances* the state the same thing
  that *authors* the deliverable? **Fused** = simplest, most faithful to *"il prodotto lo fa l'arbitro"*, but A's
  single-point is maximal. **Separated** = a shared facilitator (A+B) *plus* an author that exists only in A —
  more modules, but the shared layer is truly shared and the author is isolable/replaceable (panel, etc.). *PO
  lean (2026-07-01): **separated** — "but honestly it could also be a refinement," not a decision to nail now.*
- **Single-point mitigation** — panel/quorum of arbiters? arbiter + deterministic floor guards? confidence +
  human fallback? All *later*, after the core is proven.
- **Relationship to M11 / SP1.** Does this **replace** M11 (consensus robustness) or **absorb-and-supersede** it?
  A semantic arbiter is tolerant *by construction* — malformed / phase-illegal messages stop being a crash
  category, which is exactly what M11's defensive-tolerance and the SP1 affordance spike were chasing from the
  other side (affordance restricts what an agent *can* emit; the arbiter decides advancement — they **compose**).
  *Architect instinct: absorbs and supersedes — but that's a PO direction call.*
- **Mode selection.** Per team/task config (like the `provider` union), the mode fixes the terminal contract. How
  is it chosen/typed?

## 6. De-risking entry point (proposed — not scheduled)

**Shadow mode, no rip-out.** Do **not** remove the state machine. Run an arbiter **in parallel** on real/recorded
runs and **compare** its decision to the current machine's. Three questions, all deterministic to *evaluate*:
- **Agreement rate** — how often does the arbiter agree with the state machine on transcripts where the right
  answer is known?
- **Recovery** — on the cases that *crash today* (LB-6/7, late-message race), does the arbiter save them?
- **Cost** — tokens/latency per arbitration (relevant to the token-monitoring culture).

High agreement + real recoveries → promote to epic(s) and taper the machine. Otherwise → cheap, well-spent
learning.

## 7. Possible epic decomposition (TENTATIVE — "could father multiple epics")

Sketch only, to size the beast — not a commitment:
- **Spike** — shadow-mode arbiter on recorded transcripts (§6). Zero production change.
- **Epic 1** — extract the shared **Facilitator** engine out of the state machine; keep **Mode B** behavior
  intact + deterministic (pure refactor + semantic-push behind the existing terminal).
- **Epic 2** — **Mode A (arbiter-synthesis)** as a sibling strategy, gated behind the golden-set harness.
- **Epic 3** — **single-point mitigation** (arbiter panel / hard-rule floor), only if A proves out.

## 8. Planner POV — Codex (2026-07-01)

I agree with the direction, but I would treat it as a **program of work**, not one epic. The central insight is
sound: asking LLMs to classify every utterance into protocol slots is unnatural, and the project has already paid
for that brittleness through phase-illegal messages, malformed JSON, late-message tolerance, and M11-style
correction work. Moving advancement judgment into the central brain follows the M07/M10/M11 trajectory rather than
fighting it.

The Mode A / Mode B split is the right conceptual boundary. **Mode B** is today's ratification model made cleaner:
one artifact, all signers, deterministic closure. **Mode A** is different in kind: a product-authoring mode where
the arbiter synthesizes the deliverable and owns the judgment. Keeping those modes distinct avoids turning the
design into a hybrid protocol that is hard to reason about.

The hard caution: the semantic arbiter must not become an untestable oracle. The shadow-mode spike in §6 should be
non-negotiable before any production behavior changes. The first proof should be a recorded transcript corpus with
known expected outcomes: current successful runs, known crash/failure cases, ambiguous debates, and
non-converging/adversarial discussions. The question is not whether the arbiter sounds plausible; it is whether it
judges transcript state more usefully than the current machine, especially where the current protocol breaks.

I would separate **Facilitator** and **Author** at the interface level from the start, even if v1 uses the same
model behind both. That gives the system audit points: "facilitator judged ready", "author produced artifact",
"ratifier accepted/rejected". If the two are fused directly in code, Mode A becomes harder to inspect, replace, or
later mitigate with panels/quorums/confidence floors.

My preferred decomposition is:
- **Spike first:** shadow arbiter over recordings; no production behavior change.
- **Epic 1:** extract/shared facilitator instrumentation while preserving current Mode B behavior exactly.
- **Epic 2:** Mode B-on-facilitator, still deterministic: all agents sign the same artifact.
- **Epic 3:** Mode A behind the golden-set harness, with explicit audit output.
- **Epic 4 only if needed:** single-point mitigation: panel/quorum, confidence fallback, or hard-rule floor.

I would not say this casually "absorbs M11". It may eventually supersede parts of M11, but M11's deterministic
pieces are still useful as the safety floor: single-tool vocabulary, correction semantics, bounded turns, and clean
failure modes are substrate an arbiter can reuse. Planner stance: **do not rip out M11 thinking; reuse it as
scaffolding.**

## 9. Implementer POV — Gemini (2026-07-01)

As the implementer executing the final plans, my primary concern is the **fidelity and executability** of the output. The Mode A / Mode B distinction is critical here.

1. **Mode B is mandatory for code/execution plans:** Mode B (Collective-signing) guarantees that the plan I receive has been explicitly ratified by all agents. The deterministic nature of Mode B ensures no technical details are lost in translation. If an arbiter synthesizes a technical execution plan (Mode A), it risks dropping crucial nuances or injecting subtle errors that the original agents didn't agree to. Mode A is excellent for open-ended design docs, but binding implementation plans must remain Mode B.
2. **The Shadow-Mode Spike is highly practical:** From an implementation perspective, building a shadow arbiter that tees off the existing event stream and evaluates recorded transcripts is a low-risk, high-value first step. We can reuse the `AGENTTALK_DIAGRAM_RECORD` infrastructure without touching the production state machine.
3. **Token Multiplier & Latency:** We need to carefully consider the operational cost of the Facilitator. Does the semantic arbiter evaluate *every single message* in a multi-agent debate to check if convergence is reached? If so, the token burn and latency will be massive. The implementation should explore "out-of-band" or "sampled" arbitration (e.g., evaluating only after N messages, or when agents explicitly signal readiness).
4. **M11 Scaffolding:** I strongly agree with Codex. The arbiter should absorb the *judgment* of state advancement, but the strict deterministic floor of M11 (vocabulary, bounds, single-tool usage) should remain. Unconstrained natural language can lead to rambling; structured constraints help models focus. Let the arbiter be flexible, but keep the agents disciplined.

## 10. What is NOT decided / next step

Everything in §5, the decomposition in §7, and whether this even opens as one epic or several. **Next step is the
PO's:** return to this draft with more input, then run the normal epic-inception (PO + Architect define
goal/resources/feasibility; Planner gives advisory POV) — or open the shadow-mode spike first. This draft opens
nothing on its own.

---

*Ideation capture only. No branch, no code, no DoD. Backlog seed: BL-009. — Claude, 2026-07-01.*
