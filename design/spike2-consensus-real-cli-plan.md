# SP2 — Consensus Over Real Attached CLI Sessions

> **Status:** 🟢 **APPROVED — Gate 1 approved by Plan Reviewer, 2026-07-10.** This spike precedes M19. It answers the unknown that would otherwise
> make M19 conditional: whether the existing consensus protocol survives across two real attached CLI sessions.
> **Backlog context:** BL-027 is `doing` for M19's relay-ratio work; SP2 runs first per LB-71.
> **Ledger:** `design/spike2-consensus-real-cli-implementation.md`.

## 1. Goal

**Question:** Does the existing consensus protocol (`fact_collection -> discussion -> proposal`) survive across
two real attached CLI sessions?

The answer determines how M19 is planned:

- **If yes:** M19 uses consensus for the "agents agree on one file" step.
- **If no:** M19 uses plain role-to-role batons for that agreement, and "consensus over real attached CLIs"
  becomes a parked finding/backlog item.

Either answer is a successful spike outcome if it is evidenced honestly. A **park** recommendation is valid.

**Non-goal:** SP2 does **not** discharge M18's C3 reopen condition. C3 requires actual role-to-role coordination,
not a proof. SP2 is a proof that shapes M19; M19 must still carry the real coordination event and BL-027 ratio.

## 2. Scope Fence

- **Zero production code.** No edits to `packages/**`, `apps/**`, protocol validation, registry/coordinator
  behavior, MCP tool schemas, `agentalk-mcp-client`, or proof harnesses.
- **Allowed surfaces:** this plan, the SP2 ledger, evidence files under `design/evidence/**` if needed, and a
  docs-only attach runbook produced from the actual ritual.
- **Existing machinery only.** The spike may run the orchestrator, attach real CLIs, enable recording, and inspect
  recorded output. It may not patch the attach path, bridge, coordinator, or recorder.
- **No `scripts/m17-live-gate-proof.mjs` evidence.** BL-025 says that script can assert against committed NDJSON
  rather than the current run's recorder output.
- **No behavior fixes.** If the run exposes a defect, record it as a spike finding and stop or park. Do not repair
  it inside SP2.

## 3. Required Observations

SP2 must record:

1. The exact real CLI sessions used, including role/agent ids and attach method. The primary real-CLI pair is
   **Codex CLI + Claude Code** unless the SM/PO changes it before execution.
2. Each attached agent's `provider` value as observed by AgentTalk.
3. The consensus phases reached: `fact_collection`, `discussion`, `proposal`, and any terminal state.
4. Whether the final agreement/proposal was produced by the existing consensus protocol, evidenced by protocol
   artifacts rather than transcript judgment.
5. A fresh recorder path for the run, or a clearly stated reason recording could not be used.
6. The attach ritual as a runbook, written from the actual steps performed.

The `provider` observation is load-bearing. BL-024 notes that `team-coordinator.ts` changes fact-collection timing
when `team.provider === 'gemini'`, while `AgentProvider` currently mixes transport and vendor values. The control is
more specific: `team-coordinator.ts:78-79` sets the default fact-collection timeout to 480s and the Gemini timeout
to 720s; `team-coordinator.ts:974-988` raises the timeout when `team.provider` or any member's `providerName` /
`provider` is `gemini`. `scripts/test-live-gate.mjs:28-30`, the only substrate where consensus has ever worked,
created all agents with `providerName: 'gemini'`, so it ran at 720s. SP2 cannot interpret a timeout or phase
failure without recording the tested CLI pair's provider values and running a same-day known-green control.

## 4. Execution Shape

Use the smallest real coordination prompt that exercises the consensus phases without opening implementation scope.
The subject should be trivial and non-invasive, for example: "agree on one low-risk AgentTalk file that could be a
candidate for a future refactor; do not edit it."

Planned flow:

1. Start from a clean worktree and record `HEAD`.
2. Run a same-day in-process/known-working consensus control with the same or equivalent prompt. The control must
   be green before a real-CLI failure may be attributed to real-CLI consensus behavior. It must record its provider
   values and effective timeout profile, especially whether it used the 720s Gemini path.
3. Start the existing AgentTalk orchestrator with recording enabled to a fresh evidence path.
4. Register/start the two named real attached CLI agents using the current bridge ritual.
5. Record each attached agent's provider/role/identity as shown by AgentTalk.
6. Run one consensus attempt through the existing protocol.
   - **6b, conditional only:** If and only if the real-CLI run fails with a fact-collection timeout, re-run once
     at the 720s profile.
     **Run B mechanism, the only permitted one:** at agent registration, set `providerName: 'gemini'` on one of
     the real-CLI members. This raises the team's fact-collection timeout to 720s via
     `team-coordinator.ts:984`, and is inert otherwise for attached agents (`registry.ts:243` gates the only other
     `providerName` read behind `agent.provider === 'api'`; attached CLIs are `mcp` and keep the `McpCompleter`
     branch). Vendor, transport, and driver stay fixed; the timeout is the only variable. No code change, no
     constructor option, no orchestrator bootstrap edit: there is no config surface for this timeout, and adding
     one is a Rule-2 show-stopper.
     Declare the mislabel. Run B contains a provider value that is deliberately false. State this in the evidence
     beside it, and read run A's values, not run B's false value, for the SP2-C2 provider observation. If B passes
     where A failed, the finding is the timeout, not the substrate: file it against BL-024 and do not PARK
     consensus.
7. Capture the phase transcript, protocol artifacts, terminal outcome, recorder output, and any errors.
8. Write the attach runbook from the steps actually used.
9. Close with one of:
   - **PROMOTE:** consensus survived; M19 may plan consensus-based agreement.
   - **PARK:** consensus ran and failed or was inconclusive; M19 should use plain batons and file the consensus gap.
   - **ATTACH-BLOCKED:** real CLIs could not both attach/start. This teaches BL-026 and says nothing about
     consensus; do not file it as PARK.

For SP2, "survived" is an artifact bar, not a human reading of the transcript. It requires fresh recorder evidence
of at least one protocol-driven phase transition and an accepted final proposal/submission event. A transcript in
which two agents merely agree is not enough, because it could come from ordinary chatting rather than the consensus
state machine.

## 5. DoD Bar

| Claim | Required evidence |
|---|---|
| SP2-C1 | Two real attached CLI sessions connected to AgentTalk using the current attach path; agent ids, roles, CLI/provider names, and attach commands/config are recorded. |
| SP2-C2 | Each attached agent's AgentTalk `provider` value is recorded as a first-class observation. |
| SP2-C3 | A same-day known-green in-process control is recorded with its provider values and effective timeout profile. This establishes the protocol is not broken today. If the control records a 720s timeout profile, it does not license attributing a fact-collection timeout to the substrate. If the real-CLI run fails on a fact-collection timeout, SP2 must re-run once at the 720s profile before PARK. |
| SP2-C4 | The real-CLI run attempts the existing consensus protocol and records which of `fact_collection`, `discussion`, and `proposal` were reached. |
| SP2-C5 | Survival is proven by fresh recorder artifacts: a protocol-driven phase transition and an accepted final proposal/submission event. Transcript agreement alone is insufficient. |
| SP2-C6 | The ledger states whether consensus survived, failed, was inconclusive, or was attach-blocked, with the fresh evidence path and terminal condition. |
| SP2-C7 | The evidence does not rely on `scripts/m17-live-gate-proof.mjs` and does not rely on committed/stale NDJSON. |
| SP2-C8 | A docs-only attach runbook is emitted from the performed ritual, including the `creating` -> `start` trap from BL-026. |
| SP2-C9 | Scope/pollution audit covers both AgentTalk and `agentalk-mcp-client`, because the attach path runs `bridge.mjs` from the client repo. |
| SP2-C10 | The closure recommendation tells the M19 planner which agreement path to use: consensus or plain batons. |

## 6. Verification / Retry Budget

| Activity | Budget |
|---|---:|
| Real CLI attach setup attempts | 2 per agent |
| Consensus run attempts | 2 total |
| Recorder/evidence sanity checks | 2 |
| `git diff --check` | 2 |
| Pollution check in both repos (`git status --short`, process/port notes if an orchestrator was launched) | 1 |

If any two consensus attempts at the same timeout profile fail, stop and record the terminal state (`PARK` or
`INCONCLUSIVE`) rather than continuing to force a green result. The conditional 720s re-run in step 6b is counted
separately: one attempt. If attach itself fails before consensus can run, record `ATTACH-BLOCKED` instead of
`PARK`.

## 7. Out Of Scope

- M19 plan authoring.
- Refactoring any file.
- Fixing provider-shape leakage (BL-024).
- Fixing the idle timeout (LB-70 / BL-028).
- Fixing evidence-determinism machinery (BL-025).
- Adding `.mcp.json` templates or attach automation scripts (BL-026 production tooling).
- Role-skill injection or role-capability enforcement (BL-014 / BL-015).

## 8. Gate 1 Handoff

Gate 1 should review whether this plan is narrow enough to answer the SP2 question without turning into M19 or
repairing attach/consensus machinery. The load-bearing checks are the provider observation, fresh-run evidence,
and a closure recommendation that can directly shape M19.
