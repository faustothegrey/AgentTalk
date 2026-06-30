# Milestone 11 — Consensus / Protocol Robustness — Implementation Status

> **Plan:** `design/milestone11-consensus-robustness-plan.md`
> **Opened:** 2026-06-30 (SM Hermes, PO Fausto confirmed)
> **Old plans:** `design/milestone10-protocol-compliance-plan.md` (thesis), `design/milestone10-phase2-plan.md` (T1–T4 breakdown)
> **Previous work (done under M10):** T1 (ejectPlanner), T2 (graded loop), T4 (API enforcement), Bridge v3 — all merged to `master`.

**Baseline before M11:** `master` `5cd03df`, check `tsc -b` + suite before first task.

## Task ledger

| Task | What | Status |
|------|------|--------|
| **MT2** | Affordance-protocol spike (per-harness probe: dynamic skills + scoped toolset) | VERIFIED ✅ |
| **T3** | Single tool `consensus_respond(action, payload)` — wire-contract v5→v6, lockstep client | ⏭️ next |
| **MT3** | Active re-prompting (current legal set in correction message) | ⬜ not started |
| **MT1** | Turn-budget / Referee (bound discussion, force-advance on non-convergence) | ⬜ not started |

### MT2 Findings

**Probe Results:**
1. **Gemini (`agy`) dynamic instructions:** Probed `executor-runtime.mjs:380-615`. In persistent mode, `agy` is invoked with `--continue` and `--print <prompt>`. There is no native API/flag per-turn to inject system instructions or skills outside of the standard user prompt.
2. **Codex dynamic instructions:** Probed `executor-runtime.mjs:627-768`. Codex persistent execution uses RPC `tools/call` with `name: 'codex-reply'`. There is no out-of-band parameter to dynamically update the system instruction.
3. **Dynamic MCP toolset:** Probed `mcp-client.mjs:20-100` and `mcp-tools.ts`. The `McpServer` is initialized with a static `AGENTTALK_MCP_TOOLS` list. `mcp-client.mjs` does not implement `notifications/tools/list_changed` to fetch updated tools dynamically.
4. **Phase-scoped enum validation:** Because tool schemas are passed once at server initialization, the schema for `consensus_respond` is static. We cannot narrow the `action` enum dynamically without a major rewrite of the MCP server and client. The server must validate phase legality internally post-receipt.

**Live Observation:**
- **Command:** `node scripts/test-mcp-gate.mjs gemini`
- **Model:** Real model (`agy` via `llm-agent.mjs`).
- **Budget Impact:** Gemini usage remained at 3% (minimal/no visible impact).
- **Result:** Successfully reached `send_to_agent` response.

**Recommendation:** **DROP/DEFER**. Dynamic per-phase skills and phase-scoped MCP toolsets require fundamental changes to the persistent executors and the MCP client/server implementations to support `notifications/tools/list_changed`. We should proceed with T3 + MT3 + MT1, maintaining a single `consensus_respond` tool with server-side phase validation.

**Repo state:** `git status --short` and `git worktree list` confirm zero pollution.

**Telemetry (task closure):**
- task:        MT2
- wall-clock:  07:40:31 → 07:45:00 (Δ ~4m)
- budget:      session 3%→3% (Δ ~0%)
- gate:        tsc n/a, suite n/a, pollution clean
- diff:        0 files, +0/-0, commits n/a (read-only spike)
- outcome:     COMPLETED ✅ (recommendation: defer/drop)

### MT2 Reviewer gate 2

**2026-06-30 — Codex reviewer verdict: VERIFIED ✅**

Evidence run/read:
- `git status --short --branch` → `## master...origin/master [ahead 19]` with no modified/untracked files.
- `git diff --stat` → no output.
- `git diff --stat 94d7a8a..04edc8a` → one docs-only file:
  `design/milestone11-consensus-robustness-implementation.md` (`28` lines changed). No production code changed.
- `git worktree list --porcelain` → only `/Users/fausto/Software/AgentTalk`; no extra task worktrees.
- Read `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:380-615`: Gemini persistent MCP mode writes
  a temporary `.gemini/settings.json`, then sends each turn as `agy --dangerously-skip-permissions [--continue]
  --print <prompt>`; no separate per-turn skill/system-instruction API is present.
- Read `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:627-768`: Codex persistent MCP mode uses
  either `codex exec ... <prompt>` in persistent-MCP mode or RPC tool calls with `{ prompt }`; no out-of-band dynamic
  system-instruction parameter is present.
- Read `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs:20-99`: client sends contract metadata at
  `initialize` and exposes a generic `callTool(name,args)` wrapper; it does not implement
  `notifications/tools/list_changed`.
- Read `packages/mcp-transport/src/mcp-server.ts:29-38` and `171-180`: server stores `options.tools` once and serves
  that static list on `tools/list`; no update/list-changed mechanism exists.
- Read `apps/orchestrator/src/server.ts:739-742`: orchestrator constructs `McpServer` with static
  `AGENTTALK_MCP_TOOLS`.

Verdict:
- MT2 was read/probe/docs-only and left no repo pollution.
- Findings are accurate: dynamic per-phase skills and phase-scoped MCP toolsets would require new executor and MCP
  client/server capabilities, not a small M11 implementation.
- Recommendation **DROP/DEFER** is founded. Proceed to **T3** with one static `consensus_respond` tool and
  server-side phase validation.

**2026-06-30 — Codex reviewer re-check requested by Hermes: VERIFIED ✅**

Evidence run/read:
- `git status --short --branch` → `## master...origin/master [ahead 20]` with no modified/untracked files before this
  re-check note.
- `git diff --stat` → no output before this re-check note.
- `git show --stat --oneline 04edc8a` → docs-only MT2 completion commit: one file,
  `design/milestone11-consensus-robustness-implementation.md`.
- `git show --stat --oneline e9c27e7` → docs-only MT2 reviewer gate-2 commit: one file,
  `design/milestone11-consensus-robustness-implementation.md`.
- `git worktree list --porcelain` → only `/Users/fausto/Software/AgentTalk`; no task worktrees.
- `git status --short --ignored -- planning_runs .claude/worktrees` shows `planning_runs/` is ignored, and
  `ls -lt planning_runs` shows newest files from 2026-06-27, so it is pre-existing ignored output, not MT2 pollution.
- Re-read the cited implementation/client/server files:
  `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:380-615`,
  `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs:627-768`,
  `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs:20-99`,
  `packages/mcp-transport/src/mcp-server.ts:29-38` + `171-180`,
  `apps/orchestrator/src/server.ts:739-742`, and `packages/runtime-core/src/registry/mcp-tools.ts:12-125`.

Verdict: **VERIFIED ✅**. No production code changed for MT2; findings are accurate; DROP/DEFER is founded; repo
pollution check is clean for this task. Continue to **T3**.

## Reviewer gate 1 — plan review

**2026-06-30 — Codex reviewer verdict: REFUTED ❌**

Evidence run/read:
- `git rev-parse --short HEAD` → `5cd03df`; baseline line is correct.
- `git status --short --branch` → `master...origin/master [ahead 16]` with only the M11 docs modified.
- Read `design/milestone11-consensus-robustness-plan.md` and checked cited files/line ranges with `wc -l` / `nl -ba`.
- `git diff --check -- design/milestone11-consensus-robustness-plan.md design/milestone11-consensus-robustness-implementation.md` → clean.

Gate findings:
1. **MT2 file/line scope is not precise enough.** The plan cites
   `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs` and
   `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs` without line ranges. The actual useful spans
   are discoverable (for example `mcp-client.mjs:20-38` handshake, `mcp-client.mjs:97-99` tool calls,
   `executor-runtime.mjs:25-38` execution-mode routing, Gemini around `380-610`, Codex around `627-760`,
   executor factory around `811-832`) and should be recorded before approval.
2. **MT1 DoD is internally inconsistent.** The MT1 task text makes live observation optional ("if budget allows"),
   while the milestone DoD still requires "deterministic test + live observation". Pick one gate. If live is required,
   it needs a concrete command/provider/retry rule; if it is observational, the milestone DoD must say so.
3. **T3 leaves a gate-level implementation decision open.** The plan says to decide during implementation whether the
   API structured-tool schema stays `respond(message_type,message_payload)` or adopts
   `consensus_respond(action,payload)`. That is an implementation-affecting contract decision and should be settled
   in the approved plan before T3 starts, or explicitly split into a reviewer-approved T3 preflight decision.

What is acceptable:
- The sequence MT2 → T3 → MT3 → MT1 is sound.
- Retry budgets are generally reasonable once the DoD inconsistency above is resolved.
- Baseline commit `5cd03df` is correct.

**2026-06-30 — Codex reviewer verdict after planner corrections: VERIFIED ✅**

Evidence run/read:
- Re-read `design/milestone11-consensus-robustness-plan.md` after corrections.
- `wc -l /Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs /Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs`
  confirmed the cited client ranges exist (`107` and `837` lines respectively).
- `git rev-parse --short HEAD` → `5cd03df`; baseline remains correct.
- `git diff --check -- design/milestone11-consensus-robustness-plan.md design/milestone11-consensus-robustness-implementation.md`
  → clean.

Disposition of prior blockers:
1. **MT2 file/line scope** — VERIFIED: `mcp-client.mjs:20-38`, `mcp-client.mjs:86-99`,
   `executor-runtime.mjs:25-38`, `executor-runtime.mjs:811-837`, `executor-runtime.mjs:380-615`, and
   `executor-runtime.mjs:627-768` are now listed.
2. **MT1 DoD consistency** — VERIFIED: live referee observation is now required, with one attempt on one available
   fit provider and explicit reviewer/PO deferral if quota/provider is unavailable.
3. **T3 API schema naming** — VERIFIED: M11 keeps API `respond(message_type, message_payload)` and translates
   post-parse to MCP/runtime `consensus_respond(action,payload)`.

Gate 1 outcome: **plan status updated to `reviewer approved`; MT2 is ready for implementer handoff.**
