# M19 - Real CLI relay and ratio - Implementation Ledger

**Status:** **Gate 1 APPROVED (Plan Reviewer Claude verified the fold, 2026-07-11)** — implementation opens only
after PO implementer assignment.
**Plan:** `design/milestone19-real-cli-relay-plan.md`
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** **Codex (PO-assigned, epic-scoped, 2026-07-11 `[PO]`)** — Gemini is the
default; this is a straight PO reassignment, **not** the LB-38 standing conditional. **Implementation Reviewer (gate
2):** **Claude** (shuffled from Codex — the implementer cannot review its own work). **Task-end Reviewer (gate 3):**
Claude *(see concentration note below)*.

> **⚠️ Concentration note (SM/architect flag, 2026-07-11).** With Codex planning+implementing, **Claude now holds
> gate 1 + gate 2 + gate 3 + architect + SM** for M19. The gates stay independent *of the implementer* (Codex ≠
> reviewer), so the `AGENT.md` tripwire ("a gate amounts to the SM greenlighting itself") does **not** fire — Claude
> reviews Codex's work, not its own. **But** gate 2 and gate 3 on the *same* actor loses the fresh-eyes-at-close
> default (Task-end Reviewer ≠ Implementation Reviewer). SP2 accepted that doubling for a *finding*; **M19 ships real
> cross-repo production code**, so it matters more here. **Mitigation options for the PO to pick at T1/closure:** (a)
> accept the doubling (declared, merges human-gated), or (b) route the gate-3 **closure sweep** to a fresh pair of
> eyes — the PO personally (as at the M19 gate), or Gemini for the mechanical re-run bars. Recommend deciding before
> closure, not at it.

This ledger records M19 claims, verifier verdicts, coordination evidence, and closure telemetry. Implementation must
not start until Gate 1 approves the plan.

## Gate 1 Review (Plan Reviewer: Claude, 2026-07-11) — CONDITIONAL APPROVAL

**Verdict: APPROVED, conditional on 3 refinements folded before implementation.** The plan matches the ratified
inception (C-first, never-B, ENABLER-BLOCKED honest outcome), the fence is sound, and — per plan-reviewer discipline
— I verified its load-bearing **code** claims against the repo, not just read them:

- **Contract source of truth** = `packages/contracts/wire-contract.json` (v7; the client's v5 is a stale duplicate);
  `packages/contracts/scripts/verify-contract.js` is the existing hash-integrity guard T1's divergence check can extend. ✓
- **Server hard-reject** T1 must preserve = `packages/mcp-transport/src/mcp-server.ts:149-154` (`-32000` + `ws.close(1008)`
  on missing/mismatched `clientInfo.contractHash`) — exactly what SP2 reproduced. ✓ (correctly fenced in T1/T2/T3 manifests)
- **M17 workflow-event channel** T3's numerator depends on = `contracts/src/types.ts:114` (`kind:'workflow_gate_event'`)
  + `registry.ts:376-453` (carried on `send_to_agent`'s `workflowEvent`/`baton`, emits `workflow_gate_attempt`). ✓
- Note: T1 is a one-directional **client catch-up to v7** (server unchanged) → no new cross-repo hash coordination; the
  durable fix is generate-from-source, not hand-copy (which would just re-seed drift). The plan already names this.

**Conditions (fold before implementation):**
1. **[clarity — real defect] Resolve the `C3` name collision.** "C3" denotes the *program* metric (Outcome Rule
   "**C3 discharged**"; closure telemetry `outcome`) **and** DoD claim C3 ("supported attach ritual") — same token,
   two referents, in both plan and ledger. Rename the DoD claims (e.g. `M19-D1..D9`) or the outcome label so a closure
   reader can never conflate "did we discharge program-C3?" with DoD-C3. (Zero-risk; I can fold this if you prefer.)
2. **[anti-false-green] Name T3's provenance-verification *method*.** C5 rightly demands the event be "chosen through
   the real CLI MCP tool surface, not injected by a proof script" — this is the exact bar that refuted M18-T3 (IP-15).
   But the plan doesn't say *how* provenance is established. Add one sentence: e.g., correlate the recorded
   `workflow_gate_attempt` to the **attached agent's own WS connection / bridge-log `tx`** of the tool call, so gate 2
   has a pre-agreed, unfakeable test rather than improvising it.
3. **[anti-false-green] C4 must prove `await_turn` *functions*, not merely "not denied."** SP2 showed
   discovery ≠ permission ≠ function. Tighten C4 so the bar is "Claude Code, non-interactively, calls `await_turn` and
   **actually blocks on / receives a turn**" — a granted-but-nonfunctional tool must not pass as a green permission proof.

None of these touch the plan's premises (all verified). They are pre-implementation cleanups; the plan is otherwise
ready. Answers to Codex's own five Gate-1 focus questions: T1 sizing ✓ (right slice, has escalation stop); T2 permission
bar → tightened by condition 3; T3 anti-theater → strong, hardened by condition 2; BL-024 as constraint ✓; ENABLER-BLOCKED
outcome ✓ clean.

**Condition fold (Planner: Codex, 2026-07-11):** folded in all three conditions. DoD rows are now `M19-D1..M19-D9`
to avoid program-C3 ambiguity; T3 requires recorder-to-bridge/WebSocket transaction correlation; T2/M19-D4 requires
Claude Code to call `await_turn` and actually block on or receive an AgentTalk turn, not merely avoid permission
denial. Implementation remains closed until the PO assigns the implementer seat.

**Fold verified — Gate 1 FULLY APPROVED (Plan Reviewer: Claude, 2026-07-11).** I checked all three folds against the
**plan** (not just this ledger): DoD rows are `M19-D1..D9` and "C3" now denotes only the program outcome (plan
Outcome Rule L42-43 vs DoD L163-171); M19-D5 + T3 required-shape (plan L147-150) + T3 budget (plan L212) require
recorder↔bridge/WS transaction correlation (same agent id / connection) — the IP-15 provenance defense; M19-D4
(plan L166) requires `await_turn` to *actually block on/receive a turn*. Premises were already verified above. **Gate
1 is closed APPROVED.** Next act is the PO's: assign the implementer seat (then T1 opens on branch
`m19-t1-contract-alignment`; gate 2 → Codex unless the implementer *is* Codex, in which case gate 2 → Claude).

## Coordination Baseline

M18 closed with relays **19**, substrate events **0**, ratio **0/19**. M19 must report both raw relay count and
substrate-carried ratio; SDK controls do not count in the substrate numerator.

## Claim / Verdict Ledger

| Item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| M19-D1 - contract alignment / stale-client guard | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (Gate 2, reproduced)** | M19-T1; Gate 2 Review below |
| M19-D2 - hard-reject semantics preserved | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (Gate 2, reproduced)** | M19-T1; Gate 2 Review below |
| M19-D3 - supported Codex + Claude attach ritual | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (Gate 2)** | M19-T2; T2 Gate 2 Review below |
| M19-D4 - Claude functional noninteractive `await_turn` proof or ENABLER-BLOCKED | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (Gate 2, reproduced by hand)** | M19-T2; T2 Gate 2 Review below |
| M19-D5 - real attached CLI substrate-carried baton/workflow event with provenance correlation | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (Gate 2)** | M19-T3; T3 Gate 2 Review below |
| M19-D6 - BL-027 raw count + ratio + fallback rows | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (honest; see caveat)** | M19-T3 / closure; `design/evidence/m19-t3-relay-ratio.txt` |
| M19-D7 - BL-024 treated as constraint; provider observations recorded | claimed by Codex, 2026-07-11 | **VERIFIED ✅** | M19-T2 / M19-T3; `proof.json` agents remain `provider:"mcp"` |
| M19-D8 - fresh evidence bars; no stale proof | claimed by Codex, 2026-07-11 | **VERIFIED ✅** | all tasks; T3 evidence under `design/evidence/m19-t3-relay-2026-07-11T06-55-10-653Z/` |
| M19-D9 - freeze bar green and forbidden surfaces clean | claimed by Codex, 2026-07-11 | **VERIFIED ✅ (299/299 reproduced)** | closure; verification below |

## M19-T1 - BL-018: contract alignment and stale-client guard

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-11).**
**Branch:** `m19-t1-contract-alignment` (⚠️ changes still **uncommitted** in both repos — see signal S1).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-11) — VERIFIED

Verified by **running** every load-bearing bar myself, not by reading the report:

- **M19-D1 (alignment + divergence guard) — VERIFIED.** Client `wire-contract.json` is now v7 `ffa94e93…` (matches
  the AgentTalk source). The guard **discriminates** — I ran the A/B on **both** sides: aligned → exit 0
  ("alignment verified"); drifted to v5 (via env override, non-destructive) → **exit 1** ("...wire contracts
  diverged"). `sync-wire-contract.js` writes the source verbatim into the client — the durable *generate-from-source*
  fix (no re-drift), exactly the Gate-1 ask.
- **M19-D2 (hard-reject preserved) — VERIFIED.** `mcp-server.test.ts` 5/5; `mcp-server.ts` untouched (fence).
- **End-to-end accept (T1's real goal: "stale v5 no longer blocks attach") — VERIFIED by direct run.** Codex's
  evidence used the exec-rpc **mock** test (proves the client *sends* v7) + composition; I closed it directly by
  re-running the live harness with the v7 client: **zero rejection lines** (was 3 on v5), all agents "Connection
  established" + `await_turn`, team created. (Killed before the gemini debate — irrelevant to T1.)
- **Freeze bar — reproduced.** `npm test` **297/297**; `tsc -b` clean; `backlog:check` 29/0; client `npm run build`
  green (5 tests). Fence clean in **both** repos (no forbidden surface touched). No stale NDJSON / no
  `m17-live-gate-proof.mjs` (D8 respected).

**Implementer signals dispositioned (Reviewer Rule 7):**
- **S1 [process] — work is uncommitted.** Codex left all T1 changes as working-tree edits on the `m19-t1` branch in
  both repos ("no commit made"). Not a code defect; but the branch must be **committed before the gate-3 merge**
  (echo of IP-12, branch-less delivery). Disposition: **accepted, commit required before merge.**
- **S2 [observation, non-blocking] — the alignment guard is fail-*open* when the sibling repo is absent.** Both
  `verify-contract.js` scripts `warn`+skip if the other repo isn't found (unless the `AGENTTALK_*_CONTRACT_PATH` env
  is set, which then fails-closed). So in a single-repo CI the divergence check silently passes. Codex made this
  explicit (loud warn) and the guard fires whenever both repos are present (the D1 bar). Disposition: **accepted as
  a pragmatic choice; noted as a possible hardening** (a CI that sets the env var to fail-closed) — not a T1 blocker.

**Gate 2 outcome: PASS.** Both T1 DoD rows VERIFIED; T1's real goal proven end-to-end; freeze bar green; fence held.

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-11) — MERGED

**Doubling declared & PO-accepted:** Claude held gate 2 + gate 3 for T1 (concentration note above). The closure
sweep re-used the gate-2 independent runs (297/297 suite, both-sided A/B divergence, end-to-end v7 accept, fence
audit) — the accepted tradeoff for this low-risk prerequisite; merge remained PO-gated (`[PO]` go, 2026-07-11).
Signal **S1 resolved**: the branch was committed in both repos as part of this closure. Hygiene: post-commit trees
clean; no leaked processes (my live-gate run reaped by age). **Merged `m19-t1-contract-alignment` → `master` in both
repos.** T2 now opens from an aligned `master`.

**T1 Coordination Evidence (BL-027, honest):** substrate events **0** — expected, T1 is the *enabler*; real
substrate-carried coordination is T3's job, and the attach path it needs is only built in T2. Every T1 role hand-off
(planner→implementer baton, implementer→reviewer gate-2 handback, reviewer→PO closure authorization) was
**terminal-relayed** via the PO. **Ratio: 0 / ~3 (all terminal).** This is the baseline M19 exists to move.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone19-real-cli-relay-plan.md
    - design/milestone19-real-cli-relay-implementation.md
    - design/evidence/**
    - packages/contracts/**
    - packages/runtime-core/src/registry/__tests__/**
    - packages/mcp-transport/src/__tests__/**
    - ../agentalk-mcp-client/wire-contract.json
    - ../agentalk-mcp-client/scripts/**
    - ../agentalk-mcp-client/__tests__/**
    - ../agentalk-mcp-client/README.md
  forbidden:
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/registry/mcp-tools.ts
    - packages/mcp-transport/src/mcp-server.ts
    - ../agentalk-mcp-client/bridge.mjs
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | pending | 0 |
| terminal fallbacks | pending | 0 |
| ratio | pending | pending |

### Implementer Claim - 2026-07-11

- `agentalk-mcp-client/wire-contract.json` is generated from `packages/contracts/wire-contract.json` by `npm run sync-contract` and is now v7 / `ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446`.
- AgentTalk and client contract verifiers both fail closed on committed-contract divergence, with version/hash output. The client build now runs the verifier.
- The server wrong-hash hard reject is preserved by the existing `mcp-server.test.ts` coverage (`-32000` response and WebSocket close `1008`); no server production file was edited.
- The narrower no-longer-v5 proof is the client WebSocket MCP test assertion that `llm-agent` initializes with the generated v7 `contractVersion` and `contractHash`.
- Fresh-run evidence is recorded in `design/evidence/m19-t1-contract-alignment.txt`; no stale NDJSON or `scripts/m17-live-gate-proof.mjs` evidence was used.

## M19-T2 - BL-026: supported real-CLI attach ritual

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-11).** The SP2 ATTACH-BLOCKED wall is
**cleared** — M19 is on track for C3, not ENABLER-BLOCKED.
**Branch:** `m19-t2-real-cli-attach` (changes uncommitted — commit before merge, signal S3).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-11) — VERIFIED

The headline claim (real Claude `await_turn` cleared the SP2 permission wall) I **reproduced by hand**, not read:

- **M19-D4 (Claude functional `await_turn`) — VERIFIED, reproduced.** I re-ran `node scripts/m19-real-cli-attach.mjs
  prove --cli claude` into a scratch dir: `awaitTurnObserved=true, blockedOnAwaitTurn=true, result=await_turn_blocked`,
  **zero `permission denied` lines** (permission granted in 1ms via `--allowedTools` + `--permission-mode auto`), the
  real `claude` debug log shows `Calling MCP tool: await_turn`, and the orchestrator logged `MCP tool call from
  <agent>: await_turn {}`. In SP2 this was **denied and never reached the server**; now it is permitted, reaches the
  server, and the CLI blocks on it. `blockedOnAwaitTurn` = the CLI process is still alive (`exitCode===null`) at the
  instant the server registers the call (`m19-real-cli-attach.mjs:441-446`) — a genuine discriminator, not a
  self-fulfilling flag. (The trailing `-32000 Connection closed` in the log is the helper's teardown, after the block
  was measured — D4's "block on" branch, honestly; "receive a turn" is T3's round-trip.)
- **M19-D3 (supported ritual, Codex + Claude) — VERIFIED.** Runbook + script create/start agents, emit per-command
  config (Codex `-c mcp_servers…`, Claude inline `--mcp-config`), print the v7 hash. **No global config mutation:**
  `configAuditPaths` (incl. the two files SP2's breach wrote — `~/.codex/config.toml`, `~/.codex/mcp.json`) all
  unchanged. Codex side confirmed on record (server logged its `await_turn`). Failure probes pass: `missingStart`
  (stays `creating`), `staleHash` (close 1008 + mismatch), `stalePort` (conn error).
- **Freeze bar — reproduced.** `npm test` **298/298**, `tsc -b` clean, m19 script test 1/1, `backlog:check` 29/0.
  Fence clean both repos (client untouched; no `wire-contract`/`bridge.mjs`/`team-coordinator`/`mcp-tools` edits).

**Implementer signals dispositioned (Reviewer Rule 7):**
- **S1 [`~/.claude.json` churn] — accepted.** Claude writes its own state blob every run; it changed (disclosed under
  `globalStateChanges`, sha differs). The *ritual* persists no config (`--no-session-persistence --strict-mcp-config
  --mcp-config` inline; `configAuditPaths` clean). Precision: `noGlobalConfigMutation:true` is accurate for config
  *files*; `~/.claude.json` is a config-bearing blob that churns as state — Codex classified/disclosed it honestly.
- **S2 [attempt-1 helper bugs] — accepted, good transparency.** Codex recorded 3 attempt-1 helper bugs (codex
  stdin/EOF timeout; claude churn misread as config; failure probe used an unstarted agent) as **helper bugs, not
  attach results**, and fixed them in attempt 2 — within the 2-attempt budget, honestly labeled.
- **S3 [uncommitted] — commit required before the gate-3 merge** (same as T1).

**Gate 2 outcome: PASS.** M19-D3 + M19-D4 VERIFIED; the SP2 ATTACH-BLOCKED wall is cleared; freeze bar green; fence
held. This resolves the SP2 finding: the spike found the wall, T2 climbed it.

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-11) — MERGED

**Doubling declared & PO-accepted** (gate 2 + gate 3, Claude). The closure sweep re-used the gate-2 runs, and the
make-or-break (Claude `await_turn` cleared) was **reproduced first-hand** in gate 2 — the strongest possible closure
evidence. Signal **S3 resolved**: branch committed. Hygiene: post-commit tree clean; my scratch re-run wrote to
`/tmp` (no repo pollution); no leaked processes. **Merged `m19-t2-real-cli-attach` → `master`** (AgentTalk only —
client untouched). Merge PO-gated (`[PO]` go, 2026-07-11).

**T2 Coordination Evidence (BL-027, honest):** substrate events **0** — T2 is still enabler-shaped (it *proves the
attach path*, it does not yet *carry a role hand-off*). All T2 role hand-offs (implementer→reviewer, reviewer→PO)
were terminal-relayed. **Ratio: 0 / ~2 (all terminal).** The first non-zero substrate numerator is **T3's** job, now
unblocked because attach + `await_turn` work.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone19-real-cli-relay-plan.md
    - design/milestone19-real-cli-relay-implementation.md
    - design/evidence/**
    - scripts/m19-*
    - scripts/__tests__/**
    - apps/orchestrator/src/__tests__/**
    - ../agentalk-mcp-client/README.md
    - ../agentalk-mcp-client/__tests__/**
  forbidden:
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/registry/mcp-tools.ts
    - packages/contracts/wire-contract.json
    - ../agentalk-mcp-client/wire-contract.json
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | pending | 0 |
| terminal fallbacks | pending | 0 |
| ratio | pending | pending |

### Implementer Claim - 2026-07-11

- Added `scripts/m19-real-cli-attach.mjs`, a supported non-mutating attach helper with runbook, prepare, real-CLI proof, and failure-probe modes. It creates/starts agents through the HTTP API, prints fresh per-agent MCP URLs with the current v7 hash, and emits Codex/Claude per-command MCP config.
- Codex proof: `codex exec` with `mcp_servers.agenttalk-bridge.*` override connected to a fresh temporary orchestrator; the server observed `MCP tool call from m19-t2-codex-proof-2: await_turn {}` and the CLI remained blocked on `await_turn` until the helper stopped it.
- Claude proof: `claude -p --strict-mcp-config --mcp-config ... --allowedTools mcp__agenttalk-bridge__await_turn,... --permission-mode auto` connected to a fresh temporary orchestrator; the debug log selected/called `mcp__agenttalk-bridge__await_turn` with no permission denial, the server observed `await_turn`, and Claude remained blocked until stopped.
- Failure probes recorded missing-start (`creating` until `/start`), stale-hash (`1008` contract mismatch), and stale-port (connection error) behavior.
- No global CLI config files changed in the successful proof snapshots (`~/.codex/config.toml`, `~/.codex/mcp.json`, `~/.claude/settings.json`, `~/.config/claude/settings.json`). Claude Code did update `~/.claude.json` state/cache during proof runs; recorded as global state churn, not MCP/global config mutation.
- Provider observation for BL-024 remains transport-shaped: both real-CLI proof agents reported `provider: "mcp"` after start.
- Raw evidence and attempt notes are summarized in `design/evidence/m19-t2-real-cli-attach.txt`; no global CLI config was edited by the helper.

## M19-T3 - BL-027: one real attached role hand-off and ratio

**Status:** **Gate 2 VERIFIED (Implementation Reviewer: Claude, 2026-07-11).** The program's deferred **C3 is
discharged** — real attached CLIs carried substrate coordination the brain accepted and recorded.
**Branch:** `m19-t3-relay-ratio` (uncommitted — commit before merge, signal S3).

### Gate 2 Review (Implementation Reviewer: Claude, 2026-07-11) — VERIFIED

This is the claim M18-T3 was **refuted** on, so I verified the provenance to the hilt.

- **M19-D5 (real-CLI substrate relay, provenance) — VERIFIED.** The `send_to_agent` carrying the baton +
  `workflow_gate_event` reached the brain and was **accepted + recorded** (`recordedGate.result:"accepted"`).
  Provenance is **unfakeable**: the tool call's `toolUseId` **`toolu_01Jirgo5…`** appears in *both* Claude's own
  debug log (`tool_dispatch_start/end send_to_agent`) *and* the bridge-recorder wire-log
  (`m19-t3-bridge-transactions.ndjson`) *and* the parsed proof — that id is minted by Claude Code's tool loop, so a
  script injection cannot produce it. `await_turn` **completed** (turn delivered by the scheduler) *before* the
  `send_to_agent` — a real round-trip, not just a block. The ratio result requires all three correlates
  (`bridgeTx && recordedGate && serverAccepted`), so it cannot false-green on one. Both a real **Claude** and a real
  **Codex** CLI proved it (2 substrate relays).
- **Method note (honest):** unlike T2 (where I re-ran the live `await_turn`), here I verified by **tracing the
  unfakeable `toolUseId` chain across four independent artifacts** rather than a fresh live re-run — that chain is
  *stronger* evidence than another instance would be, and I already reproduced real-Claude tool-calling first-hand in
  T2. Freeze bar reproduced by me: `npm test` **299/299**, `tsc -b` 0, ratio test 1/1.
- **M19-D6 (BL-027 ratio) — VERIFIED, with a load-bearing caveat.** T3 = **2/4**, milestone **2/~9**, every row
  labeled by channel + evidence; T1/T2 correctly shown as **0 (enabler only)**. **⚠️ Caveat (program risk #3):** the
  2 substrate events are **demonstration relays** produced by the T3 harness (the *narrow-A* the plan/inception
  explicitly authorized), **not** organic hand-offs from M19's real development — which was ~entirely terminal.
  So **"2/~9" means "capability proven + first data point," NOT "22% of M19's real coordination was
  substrate-carried"** (that was ~0). Read/quote it only that way. This is the honest discharge of the plan's C3 bar
  ("records at least one real attached-CLI workflow event + reports the ratio"), not a burden-reduction claim.
- **M19-D7 (BL-024 constraint) — VERIFIED.** Both proof agents recorded `provider:"mcp"`; no provider-shaped timing
  assumption introduced. **M19-D8 (fresh evidence) — VERIFIED** (no stale NDJSON; `m17-live-gate-proof.mjs` unused).
  **M19-D9 (freeze/fence) — VERIFIED** (299/299 reproduced; fence clean both repos; `~/.claude.json` state churn
  disclosed, config files untouched, same disposition as T2 S1).

**Gate 2 outcome: PASS.** M19-D5/6/7/8/9 VERIFIED. **The self-hosting program's C3 — 0 substrate events at M18 close
— now has real, provenance-proven substrate coordination over attached CLIs.** M19 outcome = **C3 discharged** (per
the plan's Outcome Rule), honestly qualified as above.

### Gate 3 Closure (Task-end Reviewer: Claude, 2026-07-11) — MERGED · **M19 CLOSED**

**Doubling declared & PO-accepted** (gate 2 + gate 3, Claude). Closure sweep re-used the gate-2 verification, whose
core (the `toolUseId` provenance chain) is *stronger* than a re-run; freeze bar reproduced (299/299). Signal **S3
resolved**: branch committed. Hygiene: post-commit tree clean, no leaked processes, client repo untouched. **Merged
`m19-t3-relay-ratio` → `master`** (AgentTalk only). Merge PO-gated (`[PO]` go, 2026-07-11). T3 is the final M19 task,
so **this merge closes the epic** — milestone telemetry filled, backlog dispositions applied (BL-018/026/027 →
`done`), program C3 status updated to *discharged (qualified)*.

### Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone19-real-cli-relay-implementation.md
    - design/evidence/**
    - scripts/m19-*
    - scripts/__tests__/**
  forbidden:
    - packages/runtime-core/src/registry/team-coordinator.ts
    - packages/runtime-core/src/registry/mcp-tools.ts
    - packages/contracts/wire-contract.json
    - ../agentalk-mcp-client/**
  free:
    - planning_runs/**
```

### Coordination Evidence

| Channel event | Artifact | Count |
|---|---|---:|
| substrate events | `design/evidence/m19-t3-relay-ratio.txt` | 2 |
| terminal fallbacks | `design/evidence/m19-t3-relay-ratio.txt` | 2 |
| ratio | `design/evidence/m19-t3-relay-ratio.txt` | 2/4 |

### Implementer Claim - 2026-07-11

- Added `scripts/m19-bridge-recorder.mjs`, a local stdio bridge wrapper that records JSON-RPC transactions before
  forwarding them to `../agentalk-mcp-client/bridge.mjs`. It lets Gate 2 correlate a real CLI MCP transaction with
  the orchestrator's recorded workflow event without modifying the client.
- Added `scripts/m19-relay-ratio.mjs`, a T3 proof helper that starts a fresh temporary orchestrator, creates two
  MCP-backed agents, attaches a real CLI to the source agent with the v7 contract hash, delivers one instruction turn,
  and writes `proof.json` only after both sides of the provenance check are present.
- Added `scripts/__tests__/m19-relay-ratio.test.mjs` to lock the recorder's ability to capture a
  `tools/call` / `send_to_agent` transaction and its workflow-event/baton arguments.
- Claude real-CLI attempt did not count toward the numerator because Claude Code hit the session limit before calling
  `await_turn` (`design/evidence/m19-t3-relay-2026-07-11T06-52-28-397Z/`).
- Resumed Claude real-CLI attempt produced a second substrate hand-off:
  `design/evidence/m19-t3-relay-2026-07-11T09-08-45-971Z/proof.json` reports
  `result:"substrate_relay_proven"`, source `m19-t3-claude-reviewer-2`, target `m19-t3-claude-implementer-2`,
  event `m19-t3-event-claude-2`, baton `m19-t3-baton-claude-2`, and no global CLI config changes. Claude Code
  changed `~/.claude.json` state/cache by one byte; the helper recorded it separately from global config mutation.
- Codex real-CLI attempt produced the substrate hand-off:
  `design/evidence/m19-t3-relay-2026-07-11T06-55-10-653Z/proof.json` reports
  `result:"substrate_relay_proven"`, source `m19-t3-codex-reviewer`, target `m19-t3-codex-implementer`, event
  `m19-t3-event-2`, baton `m19-t3-baton-2`, and no global CLI config/state changes.
- Provenance correlation holds for both counted substrate rows: each proof's `m19-t3-bridge-transactions.ndjson`
  records the same source agent connection calling `await_turn` and then `send_to_agent`; each
  `m19-t3-recording.ndjson` records the accepted `workflow_gate_attempt` for the same source agent and event; each
  `m19-t3-server.log` records both the MCP `send_to_agent` call and accepted gate.
- BL-027 raw T3 count: substrate numerator **2**, denominator **4**, ratio **2/4**. Terminal fallback rows are
  the SM/PO assignment to Codex and this Codex-to-Claude Gate 2 handoff.
- M19 milestone ratio: T1 **0/~3**, T2 **0/~2**, T3 **2/4**; total substrate numerator **2**, denominator **~9**,
  ratio **2/~9**.
- BL-024 remains a constraint: both proof agents report `provider:"mcp"` and `requestedExecutionMode:"auto"`.

### Backlog Disposition Recommendation - 2026-07-11

- **BL-018:** done for M19's stale-client/alignment guard; if full multi-version negotiation is still wanted, open a
  successor rather than keeping the stale-client finding open.
- **BL-026:** done; supported attach and real attached CLI relay both proved without global config mutation.
- **BL-027:** done for M19; the deferred C3 now has a substrate numerator and honest ratio.
- **BL-024:** keep open as a constraint; provider remains transport-shaped (`mcp`).
- **BL-025:** keep open; M19 used fresh evidence but did not install a permanent live-proof replay gate.
- **BL-022:** keep open; cross-repo checks are still manual.
- **BL-023:** keep open; leaked-process checks are still manual.
- **BL-028:** keep open; no idle-timeout behavior changed.
- **BL-014/BL-015/BL-016:** leave deferred unless the PO reprioritizes them.

### T3 Verification / Telemetry - 2026-07-11

```text
**Telemetry (T3 implementer delivery, pre-Gate 2):**
- task:        M19-T3
- wall-clock:  ~08:52 -> 11:12 CEST (includes freeze/resume gap; active proof+verification in two short windows)
- budget:      codex weekly 0%->14%, 5h/session 1%->90%; claude meter still reported session 100% after successful CLI proof
- gate:        proof 2/2 substrate after one provider-limit attempt; tsc 0; targeted vitest 1/1; full suite 54/54 files, 299/299 tests; backlog 29/0; diff whitespace clean; client repo clean; process scan clean
- coordination: terminal relays 2, substrate hand-offs 2, ratio 2/4 (M19 cumulative 2/~9)
- diff:        1 tracked ledger file modified plus new script/evidence files; commits none
- outcome:     C3 discharged in implementer evidence; pending Gate 2 / Gate 3
```

## Impediments

| ID | What blocked | Blocks | Status | Unblock condition |
|---|---|---|---|---|
| none | - | - | - | - |

## Implementer Signals

| ID | Type | Re | What and why | Reviewer disposition |
|---|---|---|---|---|
| none | - | - | - | - |

## Closure Telemetry

```text
**Telemetry (milestone closure):**
- milestone:   M19 (T1 contract alignment · T2 attach ritual + await_turn · T3 real-CLI substrate relay + ratio)
- wall-clock:  opened 2026-07-11 (inception) -> closed 2026-07-11 (same day; C-first, narrow-A fired)
- budget:      claude weekly ~16% -> ~26% (Δ ~10% over T1+T2+T3 gate-2/gate-3, incl. live re-runs); codex/gemini per their meters
- gate:        Gate 2 re-verified by hand each task — T1 A/B divergence + live-accept; T2 Claude await_turn reproduced;
               T3 toolUseId provenance chain traced (4 artifacts); freeze bar 299/299, tsc 0, backlog 29/0, fence clean both repos
- coordination: terminal relays 2 (real M19 hand-offs), substrate hand-offs 2 (demonstration relays / narrow-A),
               T3 ratio 2/4, milestone 2/~9 — see D6 caveat: capability proven + first data point, NOT a burden-reduction stat
- diff:        3 merged tasks; AgentTalk commits — T1 45daaf0, T2 acdb0cd, T3 (closure) below; client T1 847bcc6
- outcome:     **C3 discharged (qualified)** — real attached CLIs carried provenance-proven substrate coordination;
               organic burden reduction remains future work (a real dev epic run over the channel)
```
