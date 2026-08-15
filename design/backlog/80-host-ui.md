# Backlog — host-ui

Open items owned by the **host-ui** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-025
status: deferred
date: 2026-07-09
epic: null
tags: [live-proof, evidence, gates, friction-m18]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: a live proof is used as a rung verdict again — which is rung 6, so this reopens naturally and soon · **M18 C7 friction item** — the highest-value lesson of the epic; a proof that cannot fail is not
  evidence] — **Live proofs need a mandatory A/B baseline and a fresh-recorder assertion** — M18-T3 shipped a
  passing live proof that **passed identically on the unfixed code** and survived six gate-2 rounds
  (**IP-15**). Separately, `scripts/archive/m17-live-gate-proof.mjs` asserts against a **committed** NDJSON file rather
  than the run's own recorder output, so it can print `LIVE SMOKE PASSED` with no recorder attached (M17 finding
  **G2-1**, still open — it printed a spurious FAILED during the M18-T2 gate-3 run). **Evidence:** M18-T3 gate-3
  refute; M17 ledger G2-1; M18-T2 task-end review. Fix sketch: a live-proof convention — every proof states its
  A-side (the bar failing on the pre-change baseline) and asserts on a **fresh** recording path unique to the run.
  **2026-07-10 backlog gate:** the **mechanism stays parked** (PO ruled the evidence-determinism work comes "in
  time"), but two **constraints bind SP2 and M19 now**, because the defect in this item's body is live: (a) **do
  not use `scripts/archive/m17-live-gate-proof.mjs` as evidence** — it can print `LIVE SMOKE PASSED` with no recorder
  attached; (b) M19's DoD must state **how a recorded `workflow_gate_event` is distinguished from an injected
  one**. C3's reopen condition already demands "actual coordination, **not a proof**" for exactly this reason:
  M18-T3's log could not tell an agent that *chose* the envelope from a bridge that *stapled it on*.

<!-- @item
id: BL-035
status: deferred
date: 2026-07-13
epic: null
tags: [tester, observability, artifacts, browser]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: a human-driven Tester validation run is scheduled · surfaced 2026-07-13 during autonomous Tester instrumentation rehearsal] — **Tester run artifacts:
  durable testlog + passive screen recording** — the Tester role now needs replayable validation records, not only
  chat-local narration. `modules/governance/docs/testlog.md` exists as the durable index, but artifact capture is still manual and
  lossy: Browser Use screenshots currently overwrite a temp path, logs are not bundled, and no `.webm` recording is
  saved. Implement a lightweight Tester harness convention that creates `design/test-artifacts/<test-id>/`, captures
  targeted screenshots and logs, and, when available, records a passive browser/session `.webm`. The recording is an
  offline human-review artifact and must not be AI-analyzed by default; only paths and metadata go into context unless
  the PO requests a specific visual review. Prefer a browser-harness or tab-level recording path that does not add
  token cost; fall back to screenshot checkpoints when recording is unavailable.

<!-- @item
id: BL-050
status: deferred
date: 2026-07-16
epic: null
tags: [ui, observability, ux]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the PO`s supervision of an autonomous run is actually hindered by team identification · PO observation during the BL-049 live run · **deliberately not acted on**] — **The Team view does not
  make it clear which team you are looking at.** PO, watching a real worker-only team appear: *"si capisce male
  qual è il team sulla UI"* — with the team identified only by a generated `team-<epoch>` id, the panel reads
  ambiguously, and the agent list rendered beside it (all agents, not just members) makes it easy to misread which
  agents are actually **in** the team. Recorded verbatim because it was seen once, live, and observations that are
  not written down get rediscovered later at full cost. **Explicitly parked by the PO** (*"non vorrei perderci
  tempo adesso"*) — do not pick this up without a PO go. Consistent with **LB-93** (the UI layer stays fluid for
  now); this is a legibility/UX item, not a defect: the data is correct, the presentation is ambiguous.


*(add new items above this line)*
