---
audience: claude
key: 20260626-0747-c1a9e6b2
written: 2026-06-26 by Claude (DiagramTalk bridge v2 record-for-replay DONE + live-verified; master 10 ahead, un-pushed)
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

**4. EXACTLY where we are.** `master` = **`8004ae3`**, **10 commits AHEAD of `origin/master` (UN-PUSHED)** — Fausto's
call whether to push (his standing "don't push without go" rule).
- **This session (2026-06-26) — DiagramTalk bridge **v2 = record-for-replay** — ✅ DONE + live-verified.** Lets you
  record a consensus run on the M10 diagram and replay it. **OPT-IN** (`AGENTTALK_DIAGRAM_RECORD` env / `record`
  option, default OFF). The bridge opens a recording at the root phase and closes it at submittal, all over the **one**
  `/api/diagram/commands` stream (DiagramTalk added `startRecording`/`endRecording` lifecycle commands — their commit
  `a698b43`; start returns `command.result.recordingId`, end closes via `input.id`). Best-effort/never-blocking as ever.
  Bridge file: `apps/orchestrator/src/diagramtalk-bridge.ts` (+ its test).
- **The capture race (LB-24) — found, fixed upstream, re-verified.** First live smoke exposed lossy/non-deterministic
  capture (4–8 of ~11 events, submit frame always dropped) — DiagramTalk only captured on the browser's async `applied`
  result, which raced the bridge's close. DiagramTalk fixed it **internally**: capture is now **at enqueue**
  (`recordEnqueuedCommand`, their commit `cd27775`). Re-verified live: **eventCount=10, full spine** incl. submit. The
  bridge needed no contract change. (Mid-session a brief decision to delete the flag, `25ab372`, was **reversed** —
  recording stays opt-in.)
- **Commits this session on master** (all un-pushed): `d3db0d0` v2 bridge · `bf36d62` T4 plan+backlog · `f85cedd` LB-23 ·
  `3ac1ec2` LB-24 finding+retractions · `25ab372` flag-removal (reversed) · `8004ae3` flag-restore+realign+verify.
  Full record = **logbook LB-23 (v2 closure) + LB-24 (capture race, now closed)**.
- **⏭️ NEXT CANDIDATES (none committed-to; Fausto picks):**
  - **Push** `master` to origin (10 ahead) — his decision.
  - **M10 T4** — API-path enforcement: `tools`+`tool_choice`+strict `enum` so API-path planners can't emit an
    off-protocol action (vs today's parse-and-grade). **Plan DRAFTED, awaiting go**:
    `design/milestone10-t4-api-enforcement-plan.md` (3 open decisions: enum granularity · provider `tool_choice`
    capability · drop `response_format` when tools sent). Self-contained in AgentTalk, no cross-repo. Backlog has the row.
  - **DiagramTalk bridge — remaining v2 basket:** the `endorse` box + edge `e4`, and the eject/correction overlay
    (`o1–o6`). **Both need NEW brain-emitted phases** (`team-coordinator.ts`) — a separate scope decision, NOT
    "changes on the bridge alone" (Rule 2). Don't start without a scope call.
  - **M10 T3** — single-tool `consensus_respond` (wire-contract **v5→v6**, lockstep with the `agentalk-mcp-client` repo;
    higher risk). **M10 T4** API-enforcement. Both deferred per **D3**.
  - **gemini live gate** (`node scripts/test-mcp-gate.mjs gemini`) — parked while gemini is out of weekly budget
    (memory `run-gemini-live-gate-when-budget-returns`).

**5. Where state lives.** Resume from `design/logbook.md` (**LB-24** = capture-race closure; LB-23 = v2 closure; LB-22 =
bridge v1; LB-20/21 = M10 brain + DiagramTalk facility) + `design/milestone10-implementation.md` (M10 ledger) + memory
`diagramtalk-channel`, **not chat**. Gate baseline on master = **204/204, tsc 0**. Verify before/after any new code.

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** `planning_runs/` is gitignored and some tests
  write into it — pre-existing, NOT pollution; check `git status` (in-scope files only).
- **DiagramTalk e2e pattern (non-polluting).** To smoke the bridge live without touching the real M10 diagram: clone
  M10's snapshot onto a **disposable scratch diagram**, drive the bridge against it (real browser renders/captures),
  read the recording, then **delete the scratch + reactivate M10**. Capture is now server-side at enqueue, so a paced
  drive captures the full spine. Throwaway scripts live in the session scratchpad (ephemeral, not in the repo).
  **Never drive the real M10 diagram** (Fausto's explicit constraint).
- **Bridge map (`apps/orchestrator/src/diagramtalk-bridge.ts`):** `FORWARD_SPINE` phase→{box,edge}; `phaseToVisual`
  (pure); `shapeRef` (the `shape:` transport prefix — live ids are `shape:ack` etc.); `onPhase` (clear→tag→pulse, +
  open/close recording when `record`); `post()` → `/api/diagram/commands` (returns the Response so startRecording reads
  the id); `attachDiagramTalkBridge` (env-gated subscribe, `AGENTTALK_DIAGRAM_BRIDGE`).
- **Engine map (M10):** `team-coordinator.ts` — `setPlanningPhase` (the funnel firing `onPhaseChange`), `ejectPlanner`
  (T1 peer-safe), `validateProtocolStep` (T2 graded loop), `interruptPlanningForMissingEvents` (M03 dual-kill — genuine
  agent-failure only; do NOT extend for illegal moves), `pauseTaskForOperator` (M08-T3 fence).
- **Budget:** `node scripts/usage.mjs` — check the `(updated …)` stamp (memory `token-budget-checkpoints`). At handoff:
  claude **weekly ~57%** (resets Jul 1 ~9am Rome; session resets ~2am Rome). **Gemini still out of weekly budget** →
  you remain implementer (LB-14).
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. Feature code branches off `master`, merges ff. **Don't
  push without his go** — master is currently **10 ahead of origin, unpushed**. (A few small bridge-v2 edits this
  session went straight onto `master` in the working tree with Fausto's OK — not a feature branch; noted for honesty.)
  Pre-existing `docs/diagramtalk-logbook` branch is not yours; leave it.
- **DiagramTalk repo** (`/Users/fausto/Software/DiagramTalk`, branch `main`) is a **separate** repo/agent. This session
  it shipped `a698b43` (recording lifecycle commands) + `cd27775` (capture-at-enqueue fix). You only ever **read** it to
  verify contracts; never edit it — relay findings to its agent via Fausto.
