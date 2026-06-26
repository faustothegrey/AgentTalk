---
audience: claude
key: 20260626-0818-7001458a
written: 2026-06-26 by Claude (M10-T4 API-path enforcement DONE + merged + pushed; T1/T2 still gated local)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` — read the **full** output, check its `(updated …)` stamp vs `date` now.
Don't trust this primer blindly — verify; surface anything off.

**1. What it is.** AgentTalk = an orchestrator coordinating multiple AI agents (in-process **API**-path providers +
externally-launched **MCP**-attached agents) collaborating over MCP through a multi-agent **consensus protocol**
(planners debate → submit a plan → a worker executes). Monorepo: `packages/{contracts,runtime-core,…}` +
`apps/{orchestrator,web}`. Semantic logic is server-side in the "brain" (`packages/runtime-core/src/registry/team-coordinator.ts`).

**2. Roles.** You are **Claude = planner / reviewer / architect — and currently also implementer** (Gemini, the normal
implementer, is **out of weekly budget**). Per **LB-14**: you implement, run `tsc -b` + full suite, self-review the
diff, report actual output — but **merge/closure is HUMAN-GATED** (Fausto). **Re-read AGENT.md → Implementer Rules of
Engagement before any code.** Fausto = human (scope, decisions, relay).

**3. Workflow / source of truth.** `design/collaboration-workflow.md`. Artifacts: `*-plan.md` (spec+DoD),
`*-implementation.md` (the **ledger**), `design/backlog.md`, `design/logbook.md` (LB-N), `design/implementer-pitfalls.md`
(IP-N). `AGENT.md` is canonical (`CLAUDE.md`/`AGENTS.md` are symlinks).

**4. EXACTLY where we are.** Active epic = **Milestone 10** (graded, stateful protocol brain + DiagramTalk viz).
- **This session (2026-06-26) — M10-T4 API-path protocol enforcement — ✅ DONE, MERGED to `master`, PUSHED.**
  Structured API turns now send an OpenAI-compat `respond(message_type, message_payload)` function tool with
  `tool_choice:'required'` + a strict `enum` derived from `STRUCTURED_MESSAGE_TYPES` (one source of truth), so an
  off-list *structural* action is unrepresentable at generation time. Tool-call `arguments` ARE the existing envelope →
  `parseStructuredResponse` + the T2 grading loop reused verbatim. **Emission-layer optimization, brain untouched.**
  Files: `response-schema.ts` (+`buildProtocolToolSchema`), `api-client.ts`, `completer.ts` + 3 test files. Gate at
  merge: **tsc 0, suite 213/213**. Decisions (Fausto): **D-T4-1** static enum · **D-T4-2** declare-unfit (no
  `json_object` fallback — a provider that 400s on the combo is "unfit for now") · **D-T4-3** keep `response_format`
  alongside the tool. Deviation from plan §5: `message_payload` is a generic `object`, not per-type (`validatePayload`
  stays the payload net). Full record = **logbook LB-25** + ledger §T4 (`milestone10-implementation.md`).
- **⚠️ OWED on T4 (honest gap): NO live-provider call.** The combo `tools`+`tool_choice:'required'`+`response_format`
  is **assumed** for google/openrouter/nous — unit-tested via injected `fetchFn` only, never a real endpoint. Parked
  as a **backlog spike** ("M10-T4 live-verification probe — experience-led"): a *transport* capability-probe (one real
  request, classify by HTTP response), **only if** a provider actually misbehaves. NOT a model self-report handshake
  (wrong layer — the model can't introspect its server's param support). See LB-25.
- **Commits this session on `master`** (now pushed): `d0462b6` T4 feat · `90a54f3` T4 closeout docs + backlog spike ·
  (+ this primer-refresh commit). `master` was 11→12+ ahead of origin and is now **pushed to origin** (Fausto's go).
- **⏭️ NEXT CANDIDATES (none committed-to; Fausto picks):**
  - **M10 T1 + T2 — engine work, STILL GATED on local branches**, un-merged + **un-pushed**: `m10-t1-eject-planner`
    (peer-safe `ejectPlanner`) and `m10-t2-graded-loop` (graded loop, correct→retry N=2→eject; stacked on T1). Both
    "implemented + gated, merge = Fausto's call." T2 carried a tested-contract correction flag. These are the real
    engine changes — **merge is Fausto's explicit decision.**
  - **M10 T3** — single-tool `consensus_respond` (wire-contract **v5→v6**, lockstep with `agentalk-mcp-client` repo;
    higher risk). Deferred per **D3**.
  - **DiagramTalk bridge — remaining v2 basket:** the `endorse` box + edge `e4`, and the eject/correction overlay
    (`o1–o6`). **Both need NEW brain-emitted phases** (`team-coordinator.ts`) — a separate scope decision, NOT
    "bridge alone" (Rule 2). Don't start without a scope call.
  - **gemini live gate** (`node scripts/test-mcp-gate.mjs gemini`) — parked while gemini is out of weekly budget
    (memory `run-gemini-live-gate-when-budget-returns`).

**5. Where state lives.** Resume from `design/logbook.md` (**LB-25** = T4; LB-24/23 = bridge v2 + capture race; LB-22 =
bridge v1; LB-20/21 = M10 brain + DiagramTalk) + `design/milestone10-implementation.md` (M10 ledger; §T4 is newest) +
`design/backlog.md` (T4 done + probe spike) + memory `diagramtalk-channel`, **not chat**. **Gate baseline on `master`
now = 213/213, tsc 0.** Verify before/after any new code.

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** `planning_runs/` is gitignored and some tests
  write into it — pre-existing, NOT pollution; check `git status` (in-scope files only).
- **T4 code map (the emission layer — API path only):** `response-schema.ts::buildProtocolToolSchema()` (single
  `respond` tool, `message_type` enum = `STRUCTURED_MESSAGE_TYPES`, `message_payload` generic object); `api-client.ts`
  (`ApiCallArgs`/body carry `tools`+`tool_choice` only when present; decode prefers `tool_calls[].function.arguments`,
  else `content`); `completer.ts::ApiCompleter.complete` (structured turn → tool + `tool_choice:'required'` +
  `response_format`). The **MCP path (`McpCompleter`) and the brain are untouched** — they were never in T4 scope.
- **Engine map (M10):** `team-coordinator.ts` — `setPlanningPhase` (funnel firing `onPhaseChange`), `ejectPlanner`
  (T1 peer-safe), `validateProtocolStep` (T2 graded loop), `interruptPlanningForMissingEvents` (M03 dual-kill — genuine
  agent-failure only; do NOT extend for illegal moves), `pauseTaskForOperator` (M08-T3 fence).
- **Budget:** `node scripts/usage.mjs` — check the `(updated …)` stamp (memory `token-budget-checkpoints`). At handoff:
  claude **weekly ~60%**, session ~60% (session resets ~10:30am Rome; weekly resets Jul 1 ~9am Rome). **Gemini still out
  of weekly budget** → you remain implementer (LB-14).
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. Feature code branches off `master`. **`master` was pushed
  this session** (T4 landed). T1/T2 engine branches are **local-only, un-pushed, un-merged** — leave them gated unless
  Fausto says merge. Pre-existing `docs/diagramtalk-logbook` branch is not yours; leave it. **Don't push without his go.**
- **DiagramTalk repo** (`/Users/fausto/Software/DiagramTalk`, branch `main`) is a **separate** repo/agent — you only
  ever **read** it to verify contracts; never edit it; relay findings via Fausto.
