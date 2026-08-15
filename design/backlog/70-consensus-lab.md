# Backlog — consensus-lab

Open items owned by the **consensus-lab** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-010
status: deferred
date: 2026-07-02
epic: null
tags: [arbiter, judge, llm-client, shadow-mode]
-->
- [deferred · parked at M14 inception (PO, 2026-07-02) — the spike's PROMOTE qualifications, bundled] — **Judge
  hardening + shadow wiring (parked from Arbiter Epic 1)** — the four judge-touching items the leaner M14 scope
  excluded: (1) full-vocabulary gloss + judge-frame line in the judge prompt, then **re-measure the failure
  ladder** on the 11×3 matrix with a pre-registered numeric bar (suggested: success ≥5/6 AND ladder ≥2/3 at
  readiness-triggered); (2) **`llm-client` transport fix** — omit `response_format` when tools are forced on the
  google-via-OpenRouter path (shared-code behaviour change, own plan/DoD; restores `gemini-2.5-flash` as judge
  candidate); (3) **shadow wiring** — the judge rides the Facilitator interface read-only at readiness-triggered
  cadence, logging judgment-vs-machine per decision point; (4) **second-model spot-check** (all spike numbers are
  single-model `gpt-4o-mini`). Evidence base: `design/arbiter-shadow-spike-implementation.md` AS-T4 addendum.
  **Reopen condition: the §3b gate that opens the next arbiter epic** (Epic 2 / the judge epic).
  **Source:** spike PROMOTE (qualified) + PO leaner-scope decision, 2026-07-02.

<!-- @item
id: BL-044
status: deferred
date: 2026-07-13
epic: null
tags: [consensus, arbiter, api-agents, tester-finding, product-gap]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the goal moves past a single in-session agent to real multi-agent consensus · Tester finding 2026-07-13 (TL-005 / LB-91)] — **API-driven multi-agent consensus is non-functional through
  the product; the arbiter is orphaned** — three stacked walls found while trying to run a planner-planner-worker
  "agree on a file to refactor" scenario with API agents (real keys present; these are wiring gaps, not credentials):
  **(1) Arbiter unreachable** — `consensusMode` defaults to `'protocol'` and the only product team-creation path
  (`POST /api/teams` → `createTeam(members, provider)`, `server.ts:738`) never sets `'arbiter'`, so
  `arbiter-coordinator.ts` (the `gpt-4o-mini` convergence Judge) is built but dead from every UI/API control.
  **(2) `POST /api/agents` ignores `providerName`** (`server.ts:593` reads only `{id, provider, model}`) → `api` agents
  default to `google` (`registry.ts:250`); can't create OpenRouter/Nous API agents via the product.
  **→ PROMOTED to BL-046** (2026-07-13; the enabler for the OpenRouter-coordination decision).
  **(3) `google` endpoint 400s** on the consensus tool schema (*"Forced function calling (ANY mode) with response mime
  type application/json is unsupported"*) → API-driven planners can't run the protocol at all.
  **Decisions needed (PO/architect):** wire `consensusMode` to the product **or** retire the arbiter as dead code;
  accept `providerName` in agent creation (unlock non-google API agents); make `buildProtocolToolSchema` compatible
  with Google's endpoint (or route consensus API agents to OpenRouter). Note: the only currently-working consensus path
  is **MCP-attached CLI agents** (`McpCompleter`). The per-reply-**soundness** arbiter from the original scenario is the
  separate "**Conductor/SM agent**" idea (architect). Source: TL-005, LB-91.
  **UPDATE 2026-07-13 — wall (1) RESOLVED + arbiter validated (TL-013):** `POST /api/teams` now forwards
  `consensusMode` to `createTeam` (branch `task-arbiter-enable`, `d06893f`, +2 server tests), so the arbiter Judge
  path is reachable through the product. **Validated live in TL-013**: goose+deepseek planners debated free-form, the
  gpt-4o-mini Judge declared `converged`, and a real plan was synthesized (`awaiting_confirmation`). Walls (2)
  `providerName` → **BL-046** (done), and (3) google tool-schema 400 — both are **API-agent-specific and moot for the
  MCP-attach path** (goose isn't an API completer hitting google; it debates as an attach worker). Remaining on this
  item: consider hardening the **Judge's convergence bar** (TL-013 caveat: it was lax — declared converged though the
  two planners endorsed different ideas). Merge of `task-arbiter-enable` is PO-gated.

<!-- @item
id: BL-042
status: deferred
date: 2026-07-13
epic: null
tags: [goose, consensus, planning-protocol, coordination-profile, optional]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the goose lane (BL-038) reopens · optional · Tester finding 2026-07-13 (TL-009/TL-010)] — **(Optional) Full goose consensus recipe — embed the
  protocol contract so goose can plan** — goose is verified as a dev + pair-chat agent (spike, TL-008) but **cannot
  complete the strict multi-phase consensus protocol** (TL-009: content good on gpt-4o but stalls opinion→
  agreement_proposal + 60s force-shutdown; TL-010: the `--max-turns 3 --no-profile --system` coordination profile
  fixed latency but goose emits `{message_type,text}` while the protocol wants a `message_payload` envelope + an
  `ack_planning_protocol` handshake → reject/resubmit runaway). Root cause: the protocol expects an exact JSON contract
  delivered in the turn briefing, which a general agentic wrapper doesn't reproduce reliably. **If** goose-as-planner
  is still wanted, author a **full protocol recipe** — a goose `--recipe`/`--system` that embeds every `message_type`'s
  exact `message_payload` schema + the ack handshake and the phase-advancement rules (≈ replicating the contract).
  **Default recommendation instead:** goose for implementation + pair chat; keep strict consensus on the M06 CLI-agent
  path. The env-driven coordination profile (`AGENTTALK_GOOSE_MAX_TURNS`/`_NO_PROFILE`/`_SYSTEM`, client
  `ee258b6`) is the building block. Source: TL-009, TL-010, `decision-api-agents-for-coordination.md`.

<!-- @item
id: BL-043
status: deferred
date: 2026-07-13
epic: null
tags: [arbiter, consensus, heterogeneous-team, claude, goose, experiment, next-session]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: multi-agent arbiter work resumes · PO idea 2026-07-13 · **next-session experiment**] — **Heterogeneous arbiter: a Claude-backed MCP client as
  the Arbiter/Judge, goose agents for planners + worker** — TL-013 proved arbiter (semantic) consensus works with
  all-goose+deepseek, but the **Judge's convergence bar was lax** (it declared `converged` though the planners
  endorsed different ideas — the Judge is hardcoded to openrouter `gpt-4o-mini` via `callApi` in
  `arbiter-coordinator.ts`). The PO's test: run the debate with **goose planners/worker** but the **Judge (and
  Synthesizer) backed by a real Claude MCP client** — a strong model judging convergence + authoring the plan.
  **Value:** (a) harder convergence rigor (fixes the TL-013 caveat); (b) first true **mixed-provider** team test
  (goose attach + Claude attach + the arbiter path). **Work needed:** make the arbiter Judge/Synthesizer **pluggable**
  — today they're a hardcoded `callApi({provider:'openrouter', model:'openai/gpt-4o-mini'})`; route them to a
  Claude-backed completer/MCP client instead (config or a dedicated arbiter-agent seat). Depends on
  `task-arbiter-enable` (BL-044 wall 1) being merged. Source: PO, TL-013.


*(add new items above this line)*
