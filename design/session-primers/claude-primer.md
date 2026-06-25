---
audience: claude
key: 20260625-2206-b4e7f1a9
written: 2026-06-25 by Claude (DiagramTalk live-flow bridge v1 MERGED to master at 7c1765c; un-pushed)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` — read the **full** output, check its `(updated …)` stamp vs `date` now,
stamp wall-clock. Don't trust this primer blindly — verify; surface anything off.

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

**4. EXACTLY where we are.** `master` = **`7c1765c`**, **3 commits AHEAD of `origin/master` (UN-PUSHED)** — Fausto's
call whether to push (his standing "don't push without go" rule).
- **Last session's work — DiagramTalk live-flow bridge v1 — ✅ DONE + MERGED (2026-06-25).** Delivers LB-21's
  "missing piece": watch the consensus protocol advance LIVE on the M10 state-machine diagram. Commits:
  - `988b721` — v1 forward-spine bridge. Brain stays **pure**: `team-coordinator.ts` gained one private
    `setPlanningPhase()` funnel (the 6 `planningPhases.set` sites route through it) firing an **optional**
    `onPhaseChange` dep; `registry.ts` re-emits it as a `team_planning_phase` event; new
    `apps/orchestrator/src/diagramtalk-bridge.ts` maps phase→box+edge and POSTs `setStateTag`/`highlight` to
    `${DIAGRAMTALK_URL}/api/diagram/commands`. **Best-effort, never blocking, OFF unless `AGENTTALK_DIAGRAM_BRIDGE`
    is set.** Live ids carry a **`shape:` prefix** (handled by `shapeRef()`).
  - `0a2f7cc` — clear-on-start: on the entry phase, clear the cursor tag before tagging `ack` (clean stage per run).
  - `7c1765c` — LB-22 docs (marks MERGED). Full record = **logbook LB-22** (+ LB-20/LB-21 for the M10 brain + the
    DiagramTalk facility).
  - **LIVE-VERIFIED twice** against Fausto's loaded M10 diagram (no LLM budget — drove the real bridge through the 5
    phases; badge walked `ack→facts→disc→prop→submit`, edges `e1/e2/e3/e5` pulsed).
- **M10 brain itself (earlier, already on master):** graded, stateful protocol loop — valid→ack+advance ·
  invalid→correct+retry(N=2) · repeated→peer-safe **eject**. Phase-2 v1 = **T1** (`76e5b34` peer-safe `ejectPlanner`) +
  **T2** (`5fea20c` graded `validateProtocolStep`). Plans: `design/milestone10-*plan.md`; ledger
  `design/milestone10-implementation.md`.
- **⏭️ NEXT CANDIDATES (none committed-to; Fausto picks):**
  - **DiagramTalk bridge v2:** the `endorse` box + edge `e4` (tap the `agreement_acceptance` handler); the
    **eject/correction overlay** (`o1–o6`, red/yellow off the T2 graded loop); wrap a run in `record` for replay.
  - **M10 T3** — single `consensus_respond(action,payload)` tool (wire-contract bump **v5→v6**, lockstep with the
    `agentalk-mcp-client` repo + handshake gate; higher risk). **M10 T4** — API-path enforcement (`tools`+`tool_choice`+
    strict `enum`; pure optimization). Both deferred per D3.
  - **gemini live gate** (`node scripts/test-mcp-gate.mjs gemini`) — still parked while gemini is out of weekly budget
    (memory `run-gemini-live-gate-when-budget-returns`).

**5. Where state lives.** Resume from `design/logbook.md` (LB-22 is the bridge closure record; LB-20/21 the M10 brain +
DiagramTalk facility) + `design/milestone10-implementation.md` (the M10 ledger) + memory `diagramtalk-channel`, **not
chat**. Gate baseline on master = **198/198, tsc 0**. Verify it still holds before/after any new code.

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** `planning_runs/` is gitignored and the
  failure/consensus tests write into it — pre-existing, NOT pollution; check `git status` (in-scope files only).
- **DiagramTalk bridge map (`apps/orchestrator/src/diagramtalk-bridge.ts`):** `FORWARD_SPINE` = phase→{box,edge};
  `phaseToVisual` (pure); `shapeRef` (the `shape:` transport prefix); `DiagramTalkBridge.onPhase` (clear-on-entry →
  tag → highlight); `attachDiagramTalkBridge` (env-gated subscribe). Drive it live via the `diagramtalk.py` CLI at
  `/Users/fausto/Software/DiagramTalk/diagramtalk/scripts/diagramtalk.py` (`tag`/`highlight`/`context`/`commands`).
- **Known DiagramTalk rendering quirk (Fausto, 2026-06-25):** the `highlight` pulse overlay does **not** align to a
  shape's bounding box (especially on arrows — looks askew). This is **DiagramTalk-side rendering**, NOT the bridge —
  the bridge only names the id+color. A note for the DiagramTalk dev agent if it ever matters; not an AgentTalk bug.
- **Engine map (M10):** `team-coordinator.ts` — `setPlanningPhase` (NEW funnel + onPhaseChange), `ejectPlanner` (T1
  peer-safe), `validateProtocolStep` (T2 graded loop), `interruptPlanningForMissingEvents` (M03 dual-kill — still used
  for genuine agent-failure/watchdog; do NOT extend it for illegal moves), `pauseTaskForOperator` (M08-T3 fence).
- **Budget:** `node scripts/usage.mjs` — check the `(updated …)` stamp (memory `token-budget-checkpoints`). At handoff:
  claude **weekly ~53%** (resets Jul 1 ~9am Rome; session resets ~2am Rome). **Gemini still out of weekly budget** →
  you remain implementer (LB-14).
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. Feature code branches off `master`, merges ff, branch
  deleted. **Don't push without his go** — and note master is currently **ahead of origin by 3, unpushed**. There's
  also a pre-existing `docs/diagramtalk-logbook` branch (not yours; leave it).
