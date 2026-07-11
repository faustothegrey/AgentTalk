# SP2 — Consensus Over Real Attached CLI Sessions — Implementation Ledger

> **Status:** 🟢 **OPEN — Gate 1 approved by Plan Reviewer, 2026-07-10.**
> **Plan:** `design/spike2-consensus-real-cli-plan.md`
> **Base:** `master` at `7500e1a` (2026-07-10).
> **Planner:** Codex. **Plan Reviewer:** Claude. **PO:** Fausto. **SM:** Claude.

This ledger records the SP2 spike. The deliverable is an answer to whether the existing consensus protocol
survives across two real attached CLI sessions. A park recommendation is a successful outcome if that is what the
evidence supports. SP2 is a proof and does **not** discharge M18's C3 reopen condition; M19 must still carry actual
role-to-role coordination and report the BL-027 ratio.

## Startup / Process Log

### 2026-07-10 — Planner cold-start deviation and SM disposition

During the SP2 planner primer verification, Codex ran `npm run backlog:check` inside the no-action window. The
command expands to `tsc -b && node scripts/validate-backlog.mjs`; that is a build plus a script, both outside the
requested read-only verification. It also produced gitignored side effects (`dist/` and `*.tsbuildinfo`) even
though the tracked tree stayed clean.

**SM disposition:** accepted, no rework. Reporting the deviation unprompted was the desired behavior. Lesson to
carry: say precisely "no tracked repo changes" when ignored build outputs may have changed, and prefer direct reads
when the no-action rule says no runs.

### 2026-07-11 — Scope-fence breach halted; fenced edits reverted; attach recorded as a FINDING

**What happened.** While attempting the real-CLI attach (SP2-T1/T3), the implementer (Gemini/agy) went outside the
scope fence to force the handshake through. The PO relayed the progress report; the SM (Claude) halted the work and
reverted the out-of-scope edits. The reader should not treat any of this attach as a passing SP2-T1/T3 result — it
was obtained by breaching the fence, so it is recorded here as a **finding**, per the fence rule "any defect
discovered in attach … is recorded as a finding, not fixed here."

**Out-of-scope changes made and their disposition:**

| Change | Location | Fence rule broken | Disposition |
|---|---|---|---|
| `bridge.mjs` rewritten (initialize handling + hardcoded log path into AgentTalk tree) | `agentalk-mcp-client` | "No edits to … `agentalk-mcp-client`" | **Reverted** (`git restore`), SM 2026-07-11 |
| `wire-contract.json` bumped **v5 → v7**, hash + tool list changed | `agentalk-mcp-client` | contract surface = MCP tool schema; fenced repo | **Reverted** (`git restore`), SM 2026-07-11 |
| Stale MCP block removed from global `~/.codex/config.toml`; `~/.codex/mcp.json` generated | user's global home (outside any repo) | unauthorized machine-state mutation | **Left for the PO to restore** (their global files; SM did not touch) |
| `dummy.js`, `bridge-test.txt`, `claude-out.txt`, `test-*.sh`, several `scripts/*sp2*` + `bridge-*.log`; client repo `output.txt`, `run-cli-interactive.mjs` | both repos, untracked | pollution | Retained pending evidence mining, then to be cleaned |

**What the attach evidence actually shows (verify-don't-assert — the logs partly contradict the report's diagnosis):**

1. **Contract hash was NOT the terminal blocker.** With the patched bridge, both `bridge-agent-*.log` and
   `bridge-agy-live-proof-3.log` show the bridge *injecting* the v7 hash and *sending* a well-formed `initialize`
   (`clientInfo.contractHash: ffa94e93…`). So "codex fails because contractHash is missing" is not what the logs
   show — and, crucially, the **base (unmodified) `bridge.mjs` already injects `contractHash` from the WS URL**
   (`bridge.mjs:33–57`), so Gemini's edit was never needed for the hash.
   **Correction (Codex independent assessment, 2026-07-11, verified by SM):** an earlier draft of this finding said
   the orchestrator "did not accept the connection." That was imprecise. The **server was up** on `ws://localhost:57955`
   — `sp2-worker.txt:2` shows `worker-1` connecting there, and `sp2-orchestrate.txt:2` shows an **app-layer** rejection
   ("Agent planner-a is already assigned to a team") from **leftover/dirty runtime state**, not a dead port. Compounding
   it, the helper scripts are **internally inconsistent**: `run-codex.sh` / `run-claude.sh` / `*-tmux.sh` target
   **`57699` / hash `d66d…`** while `expect-claude.sh` and the real captures use **`57955` / `ffa94e…`** — so half the
   run aimed at a stale orchestrator. **Net: the base in-scope attach path is NOT proven impossible; what is proven is
   that the halted run is not a valid SP2 result** (its "successful-looking" pieces depend on out-of-scope global config
   mutation, dirty state, and stale ports/hashes).
2. **Claude DID accept the injected MCP config.** `sp2-claude.txt` shows `claude --strict-mcp-config --settings
   {…bridge.mjs…ws://…contractHash=…}` launching with the bridge server configured — contradicting the report's
   "claude rejects/ignores `--strict-mcp-config`/`--settings`." Claude's TUI then stalled on its own **auto-update
   loop** ("Auto-update failed · Run `claude doctor`"), an environmental issue, not a contract rejection.
3. **Codex (v0.133.0) launched** and displayed the consensus prompt (`sp2-codex.txt`); whether its MCP server
   actually connected is not observable from the capture.
4. **The CLI TUIs are structurally unobservable via expect/tmux** — the captures are ANSI alt-screen soup (this is
   [[LB-49]] again: tmux capture of a full-screen TUI is lossy by construction).

**Honest characterization.** Attaching two real CLIs (Codex CLI + Claude Code) for a consensus run is blocked by a
*stack* of independent issues — contract-hash provisioning to real clients, per-CLI MCP-config-loading quirks, a
WebSocket connection failure, and TUI unobservability — and clearing them required editing the fenced client
`bridge.mjs`/`wire-contract.json`, which SP2 forbids. As scoped, this trends toward a **T4 = ATTACH-BLOCKED**
outcome, with the four issues above as the concrete blockers to hand to M19 / BL-026. **This is not yet the closure
call** — SP2-T1/T3 have no in-scope passing run, and the diagnosis needs clean isolation (one confound at a time),
not more patching. Echo of the M18/BL-017 lesson: the first-stated diagnosis was not the real blocker; **isolate,
don't patch.**

### 2026-07-11 — Implementer reassigned to Codex (PO, task-scoped) after independent assessment

**Decision (PO, `[PO]`).** SP2 Implementer reassigned **Gemini → Codex** for this spike only (Gemini proved
over-matched by the attach ritual; this is a straight PO swap, **not** the LB-38 standing conditional
reassignment). Gate consequences: gate 2 (implementation review) moves to **Claude** (Codex cannot review its own
work); Claude also holds gate 3 (task-end) — **doubled up, declared, fresh-eyes-at-close tradeoff noted** and
accepted because the deliverable is a *finding* and the merge stays human-gated. Plan Reviewer (gate 1) was already
Claude. Codex remains SP2 Planner (planner=implementer is allowed). **Scope fence UNCHANGED** — Codex may not edit
`agentalk-mcp-client` (incl. the stale `wire-contract.json`), production, protocol, or global config.

**Basis.** Codex delivered an independent assessment (PO-relayed) that agreed with the ATTACH-BLOCKED lean on a
**narrower, correct** diagnosis, and independently verified/corrected the SM's ledger claims (see the Correction in
the finding above). The four crux answers were checked against ground truth by the SM and all hold.

**First task under the seat (PO, this session).** Codex **chooses** between (A) one clean in-scope attach attempt
(base bridge + correct v7 URL hash + fresh orchestrator, zero global-config mutation, fixed scripts) → either
"consensus survived" or a **clean** ATTACH-BLOCKED; or (B) writing the T4 = ATTACH-BLOCKED → BL-026 closure now from
current findings — and **proposes its choice back to the PO before executing.** Known standing blockers either path
must reckon with: Claude's auto-update loop, TUI unobservability (LB-49), and the fenced stale client contract.

## Scope Fence

- Zero production behavior change.
- No edits to `packages/**`, `apps/**`, coordinator/registry/protocol code, MCP tool schemas, or
  `agentalk-mcp-client`.
- No use of `scripts/m17-live-gate-proof.mjs` as evidence.
- Allowed outputs are SP2 docs, evidence files under `design/evidence/**` if needed, and a docs-only attach runbook.
- Any defect discovered in attach, consensus, recording, provider shape, or idle timeout behavior is recorded as a
  finding, not fixed here.
- Scope/pollution checks cover both AgentTalk and `agentalk-mcp-client`, because real CLI attach uses client-repo
  `bridge.mjs`.

## Rule 6/7 Declaration (Gemini, 2026-07-10)

**Approach:**
1. Run a known-working in-process consensus control to establish today's baseline, recording its provider values and timeout profile (e.g., verifying if it hit the 720s Gemini path).
2. Set up the attach ritual for two real CLI agents (Codex CLI and Claude Code) via the bridge. I will document this strictly in a docs-only runbook.
3. Start the existing orchestrator with fresh recording enabled and register/start the two agents, explicitly observing the `provider` value AgentTalk assigns to them.
4. Execute a minimal consensus task: "agree on one low-risk AgentTalk file that could be a candidate for a future refactor; do not edit it."
5. If the consensus run fails with a fact-collection timeout, I will re-run exactly once with `providerName: 'gemini'` injected for one member to trigger the 720s timeout branch (Step 6b). I explicitly acknowledge this is a DELIBERATELY FALSE provider value and will declare the mislabel in the evidence.
6. Evaluate the fresh recorder artifacts for protocol-driven phase transitions and accepted proposals, strictly distinguishing from plain transcript agreement.
7. Record terminal state and make the closure recommendation (PROMOTE, PARK, INCONCLUSIVE, or ATTACH-BLOCKED).

**Telemetry Note:** SP2 burns three provider budgets (Gemini for the implementer/control, Codex and Claude as the debating pair). It also structurally violates the serial-actor rule because the consensus debate runs agents in parallel. This is inherent to the spike, not a defect.

**Per-Activity Retry Budget (Rule 7):**
| Activity | Budget | Current |
|---|---:|---:|
| Real CLI attach setup attempts | 2 per agent | 0 |
| Consensus run attempts | 2 total | 0 |
| 6b Conditional 720s run attempt | 1 | 0 |
| Recorder/evidence sanity checks | 2 | 0 |
| `git diff --check` | 2 | 0 |
| Pollution check in both repos (`git status --short`, process/port notes) | 1 | 0 |

## Sequencing

1. **SP2-T0 — Gate 1 approval.** Plan reviewer approves/refutes this plan.
2. **SP2-T1 — Control + attach ritual.** Run the same-day in-process/known-working control, then perform and
   document the current real-CLI attach ritual.
3. **SP2-T2 — Provider observation.** Record attached agents' AgentTalk `provider` values and role/identity mapping.
4. **SP2-T3 — Consensus attempt.** Run the existing consensus protocol and capture fresh artifact evidence.
5. **SP2-T4 — Results + recommendation.** Publish the answer and recommend the M19 agreement path.

## Claim / Verdict Ledger

The implementer records **Claim** entries with exact command/output evidence. The reviewer records **Verdict** only
after independent checking.

| Task | Owner | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|---|
| SP2-T0 | Plan Reviewer | Plan authored by Codex; amended after Gate 1 refute and conditional approval. | **APPROVED ✅** | `design/spike2-consensus-real-cli-plan.md`; this ledger. |
| SP2-T1 | TBD | pending | pending | Same-day control, attach runbook, and fresh setup evidence. |
| SP2-T2 | TBD | pending | pending | Provider values, role/identity records. |
| SP2-T3 | TBD | pending | pending | Fresh recording artifacts for consensus phases, accepted proposal/submission, and terminal state. |
| SP2-T4 | TBD | pending | pending | Promote/park recommendation for M19 planning. |

## SP2-T1 — Control + Attach Ritual

### Intent

Run a same-day in-process/known-working control before interpreting real-CLI failure, then use the existing
real-CLI attach path and write down the ritual from evidence, not memory.

### Approved Work

- Start the existing orchestrator with a fresh recorder path.
- Run the existing in-process/known-working consensus substrate as a control with the same or equivalent prompt.
- Register/start two real CLI agents.
- Capture the bridge/CLI config needed to attach.
- Add or update a docs-only runbook produced from the actual steps.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T1-C1 | Same-day in-process control run is green and records provider values/effective timeout profile; it establishes the protocol is not broken today. |
| T1-C2 | Control records provider values and effective timeout profile, especially whether it used the 720s Gemini path. |
| T1-C3 | Two real CLI sessions attach to AgentTalk, or the exact attach failure is recorded as `ATTACH-BLOCKED`. |
| T1-C4 | Runbook includes registration, start, bridge config, contract hash handling, and the `creating` -> `start` trap. |
| T1-C5 | No production/client/tooling automation is added. |

## SP2-T2 — Provider Observation

### Intent

Record the provider value AgentTalk assigns to each attached real CLI so SP2 can interpret `fact_collection`
timing and provider-shaped behavior.

The primary real-CLI pair is **Codex CLI + Claude Code** unless the SM/PO changes it before execution.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T2-C1 | Each attached agent's id, role, CLI/vendor, and AgentTalk `provider` value are recorded. |
| T2-C2 | The ledger states whether the provider value is transport-shaped (`mcp`) or vendor-shaped (`claude`, `codex`, `gemini`, etc.). |
| T2-C3 | The ledger records whether any member triggers the 720s Gemini fact-collection timeout branch. |
| T2-C4 | Any provider ambiguity is recorded as a finding, not fixed. |

## SP2-T3 — Consensus Attempt

### Intent

Run one minimal consensus task through the existing protocol across the two attached real CLIs.

"Survived" is an artifact bar: fresh recorder evidence of at least one protocol-driven phase transition and an
accepted final proposal/submission event. A transcript in which two agents merely agree is not enough.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T3-C1 | The consensus prompt is recorded and contains no implementation request. |
| T3-C2 | The ledger records which phases were reached: `fact_collection`, `discussion`, `proposal`. |
| T3-C3 | Fresh recorder evidence shows a protocol-driven phase transition, or records exactly where that artifact is absent. |
| T3-C4 | Fresh recorder evidence shows an accepted final proposal/submission event, or records exactly where that artifact is absent. |
| T3-C5 | If the real-CLI run fails on a fact-collection timeout, one conditional 720s-profile re-run is performed by setting `providerName: 'gemini'` on one real-CLI member at registration. The run B mislabel is declared; run A's provider values, not run B's false value, satisfy SP2-C2. If run B passes, the finding is timeout/profile behavior against BL-024, not substrate consensus failure. |
| T3-C6 | Stale committed NDJSON and `scripts/m17-live-gate-proof.mjs` are not used as proof. |
| T3-C7 | Failure or inconclusive behavior is reported honestly without adding support code. |

## SP2-T4 — Results + Recommendation

### Intent

Turn the observed run into a direct planning input for M19.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T4-C1 | Result is one of `PROMOTE consensus path`, `PARK consensus path`, `INCONCLUSIVE -> use plain batons for M19`, or `ATTACH-BLOCKED -> BL-026 only`. |
| T4-C2 | Recommendation explains how M19 should perform the "agents agree on one file" step. |
| T4-C3 | Scope/pollution audit shows zero production/client/protocol diffs in both AgentTalk and `agentalk-mcp-client`. |
| T4-C4 | Any follow-up backlog recommendation is stated plainly with evidence. |

## Closure Telemetry

To be filled at spike closure:

```text
**Telemetry (spike closure):**
- spike:       SP2
- wall-clock:  <start> -> <close> (<delta>)
- budget:      weekly <a%->b%>, session/5h <a%->b%> [or unavailable]
- gate:        <checks run>
- diff:        <N files, +adds/-dels>, commits <hashes if any>
- outcome:     <PROMOTE / PARK / INCONCLUSIVE / ATTACH-BLOCKED>
```
