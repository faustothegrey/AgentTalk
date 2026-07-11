# Design note (STUB) — Per-agent capability / track-record signal for SM reassignment

> **Status:** STUB — captured, not specified. **Nothing to implement yet** (PO, 2026-07-11).
> **Owner:** Architect. **Backlog:** BL-029. **Trigger to revisit:** M19 yields more per-agent data points.
> **Origin:** the SP2 attach breach + reassignment call, 2026-07-11
> (`design/spike2-consensus-real-cli-implementation.md` → 2026-07-11 finding).

## Why this exists

We have the **authority** to reassign an agent (SM owns it — LB-34; the standing conditional reassignment —
LB-38; PO overrides) but no **signal** that tells the SM *when* an agent is under-performing enough to warrant it.
When the SM judged Gemini "over-matched" on SP2 and proposed swapping in Codex, that was a **gut call** — no
durable, auditable per-agent record backed it. This note captures the idea so it survives until it's worth building.

The idea is **earned by a real failure, not pre-written for a hypothetical** — which is the bar this project holds
process to. It is deliberately left as a stub to respect proportionality: build it when the data exists, not before.

## What it is (and is not)

- **IS:** a lightweight, **reviewer-fed** (never self-fed), **per-agent dossier** the SM reads to inform two
  decisions — *inception assignment* (who gets the task) and *reassignment* (when to pull an agent mid-flight).
- **IS NOT:** an ELO/numeric leaderboard, an automated gate, or anything the rated agent maintains about itself.

## The raw signal already exists — un-aggregated

The material to aggregate is already produced by the workflow; nothing new needs to be *generated*, only *collected*:

| Source | What it already records | Strength |
|---|---|---|
| `design/implementer-pitfalls.md` | reviewer-authored case law on *how the implementer failed* (IP-1…IP-N) | strong — independent, adversarial |
| `*-implementation.md` verdict rows + closure telemetry | VERIFIED-first-pass vs. REFUTED-and-redelivered; cost/outcome | strong — per-task, evidenced |
| `design/lessons/<agent>-lessons.md` | self-reported reflection | weak — self-graded, but real |

## Four hazards the design MUST answer (else it does harm)

1. **Attribution is known-broken.** Same reason we run agents serially: the meter is per-provider machine-wide,
   not per-actor. A "miss" may be the **plan's**, the **environment's**, or an **impossible task's** fault — not
   the agent's.
2. **Difficulty / feasibility confound.** SP2 is the cautionary example: Gemini's "miss" may be a task that is
   **impossible in-scope** (the fence forbids the `bridge.mjs` edit a real attach appears to need). The rating
   **must normalize by task difficulty and feasibility**, or it merely punishes whoever draws the hard cards.
3. **Honesty-gaming — the load-bearing hazard.** Rating on "green" incentivises exactly the scope-creep-green the
   *Honesty over Results* section exists to prevent. The rating **must reward an honest RED (a clearly-reported
   blocker is a completed deliverable) and penalise a scope-creep GREEN** — it rates **scope discipline + honesty**,
   not pass/fail. Get this backwards and the mechanism actively corrodes the culture it sits in.
4. **Sample size.** N=1 is noise. A **pattern** of breaches should count; a **single** miss should not tank a
   rating. Needs a floor before any signal is actionable.

## Open questions (for when this is picked up)

- What are the *dimensions*? (scope discipline · honesty/blocker-reporting · verdict quality · difficulty-adjusted
  throughput — deliberately **not** raw win rate.)
- Where does the dossier live, and who writes it — the Implementation Reviewer at gate 2? A separate SM sweep?
- How is *difficulty* scored without a new bureaucracy? (reuse the token-telemetry + review-round count?)
- Does it feed inception assignment (📌 DEFAULT ROLE ASSIGNMENTS) automatically, or stay advisory to the SM/PO?
- Interaction with the **PO's** sole authority over role assignment — this signal *informs*, it does not *decide*.

## Non-goals

- No automated reassignment. The signal informs a human/SM judgment; it never fires a swap on its own.
- No agent self-rating. Reviewer-fed only, to preserve independence.
- Not a substitute for the per-task gates — it aggregates their output, it does not replace them.
