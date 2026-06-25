# Milestone 09 — MCP-vocabulary removal — Implementation Status

> **Vocabulary note (Fausto, 2026-06-25).** The externally-launched/exec-RPC agent path is named **`'mcp'`**
> throughout (`provider` is `api` | `mcp` | gemini/claude/codex). Per the "all legacy prose must go — maximal"
> decision, this ledger is **legacy-token-free**: rows name the *target* (the old name is intentionally not shown).
> The only surviving legacy string project-wide is the functional `google-gemini/gemini-cli` GitHub URL.

**Status:** **DONE + EPIC CLOSED — all tasks merged; history squashed (Fausto, 2026-06-25).** Gate at squash:
tsc 0, suite 183/183 (32 files). The whole-project legacy-token sweep returns **only the `gemini-cli` URL** (by
design).

> ## ✅ EPIC-CLOSE SQUASH — DONE (Fausto, explicit 2026-06-25)
> **Whole history squashed to a single root commit `565ad3d`.** D6 ("no legacy token *anywhere*, including
> history") is now fully satisfied. Fausto confirmed going **beyond** the originally-recorded M09-only recipe
> (`0fd98f7..HEAD`): the legacy provider token also lived in **M07/M08** commit messages, so all **201 commits**
> were collapsed via an orphan branch (byte-identical tree) into one clean, token-free commit. Then **force-pushed**
> (public repo) and **pruned** the dead `m09-t1/t2/t3` + `m08-*` branches (local + remote). Side effect: short-hash
> citations in `design/*.md` (incl. the rows below) no longer resolve — inherent to a history rewrite; the ledger
> prose remains the record of state. Agent memory `m09-squash-at-epic-close` deleted as satisfied.
Plan: `design/milestone09-mcp-vocabulary-removal-plan.md`. Implementer = Claude (Gemini out of budget; delegated
gate per LB-14, merge stays Fausto's call). Baseline before T1: `master` `35051c8`, `tsc -b` 0, **183/183** (32 files).

## Task ledger

| Task | What | Status |
|---|---|---|
| **T1** | Type the agent `provider` as the `AgentProvider` union (in `@agenttalk/contracts`) | **MERGED** to `master` (`5669762`, ff; pushed). |
| T2 | Set the externally-launched provider value to `'mcp'` (compiler-guarded by T1) | **MERGED** to `master` (`6b45895`, ff; pushed). |
| T3 | Rename completer/error identifiers to `McpCompleter` / `McpError` | **MERGED** (`4c9dc52`); gate green. |
| T4 | Rename test/script files to `mcp-*.test.ts` / `test-mcp-*.mjs` | **MERGED** (`ad49de6`); gate green. |
| T5 | Rename the scenario entrypoint to `scenario-runner.ts` (+ `package.json` script) | **MERGED** (`ad49de6`); `dist/scenario-runner.js` builds. |
| T6 | Remove all legacy vocabulary from docs **incl. history**; delete `spikes/`; rewrite to `mcp`/`MCP` | **MERGED** — done. Spikes deleted; full project scrubbed (only the `gemini-cli` URL retained). |
| T7 | Whole-project verification sweep + close squash | **Sweep passing** (returns only the `gemini-cli` URL). Squash + merge = Fausto's call at close. |

## T1 — provider union (log)

**Scope declared (Rule 6):** add `AgentProvider` in `contracts`; switch agent-axis `provider?: string` →
`AgentProvider` at the type sites; **no** value change (`'mcp'` stays), **no** `Mcp*` rename, **no**
behaviour change. Retry budget: tsc ≤3, suite ≤2.

**Changes (6 files, +23/-11):**
- `packages/contracts/src/types.ts` — define `export type AgentProvider = 'api' | 'mcp' | 'gemini' |
  'claude' | 'codex'` (with a comment distinguishing it from the API-vendor `ApiProvider` axis and from
  `providerName`); apply it to `Team.provider` and `TranscriptEntry.provider`.
- `packages/runtime-core/src/agents/agent.ts` — `Agent.provider: AgentProvider` (+ import).
- `packages/runtime-core/src/registry/registry.ts` — `createAgent` options, `activateAgent` param,
  `createTeam` param (+ import).
- `packages/runtime-core/src/registry/team-coordinator.ts` — `createTeam` param (+ import).
- `packages/runtime-scenarios/src/scenarios/types.ts` — `ScenarioAgentDefinition.provider` (+ import).
- `apps/orchestrator/src/server.ts` — the **one** site tsc surfaced: `POST /api/teams` reads `provider` from
  an untyped HTTP body. Applied a **localized boundary cast** `as AgentProvider | undefined` with a comment —
  **behaviour byte-for-byte identical** (the value is still forwarded unchecked; no runtime validation added).

**🚩 Honesty note — the boundary site (server.ts:636).** The union deliberately surfaced an *untyped string
entering the typed discriminant* from the `POST /api/teams` body. Today that boundary accepts any string and
forwards it; T1 **preserves** that (cast, no validation). **Adding boundary validation would be a behaviour
change → deliberately OUT OF SCOPE** (recorded as possible future hardening). No other untyped call site exists
(tsc flagged only this one; all other `createAgent`/`activateAgent`/`createTeam` callers already pass
union-valid values).

**Gate (delegated, LB-14):** `tsc -b` **0**; full suite **183/183** (32 files, unchanged count — no test
modified); `git diff --stat` = the 6 files above, all in scope. No repo pollution (no new worktrees/branches;
type-only change, provisioning path untouched).

**Telemetry (task closure):**
- task:        M09-T1
- wall-clock:  2026-06-24 ~22:00 → ~22:12 CEST (~12 min)
- budget:      weekly 19%→25% (Δ ~6%, whole continued session), session →89% (long session)
- gate:        tsc 0, suite 183/183, pollution clean
- diff:        6 files, +23/-11; branch `m09-t1-provider-union` (commit pending)
- outcome:     MERGED ✅ (`5669762`, ff to `master`, pushed; Fausto's merge-gate go 2026-06-24)

## T2 — flip value `'mcp' → 'mcp'` (log)

**Scope declared (Rule 6):** value-flip ONLY (`'mcp' → 'mcp'`), behaviour byte-for-byte preserved
(`'mcp'` routes through the identical exec path). T1's union made every site compiler-visible. **NOT** in scope:
identifiers `Mcp*` (T3), filenames `mcp-*.test.ts` (T4), test descriptions, agent-name strings
(`mcp-agent-1`/`mcp-worker-1`), the `server.ts:636` boundary cast, `ApiProvider`/web client, `gemini/claude/codex`
values. Retry budget: tsc ≤2, suite ≤2.

**Changes (9 files, +19/-19):**
- `packages/contracts/src/types.ts` — union member `'mcp' → 'mcp'`; doc comment reworded (now describes
  `'mcp'`, notes "was 'mcp' before M09-T2" — the single intentional `mcp` mention retained, as history).
- `packages/runtime-core/src/registry/registry.ts:211,323` — the two discriminant comparisons.
- `__tests__/mcp-agent.test.ts` — 2 `provider:` inputs + the one `toBe(...)` assertion (input+expected move
  together; round-trip contract preserved, only the literal token changes).
- `__tests__/team-mcp-consensus.test.ts` (3 inputs), `__tests__/mcp-noresend.test.ts` (2 inputs).
- Scripts `test-mcp-provider.mjs`, `test-live-gate.mjs`, `m07-t3b2-live-worker.mjs`, `test-mcp-gate.mjs`
  — `provider:` inputs (edited for repo-wide consistency; **no live run needed** — the value's only behavioural
  consumer is the discriminant at `registry.ts:211,323`, already unit-tested, and producer+consumer flipped together).

**🚩 Honesty note — the one `toBe` edit.** `mcp-agent.test.ts` asserted `expect(agent.provider).toBe('mcp')`.
The value flip required flipping this to `toBe('mcp')`. The **assertion contract is unchanged** ("provider round-trips
through createAgent") — input and expected are flipped together. This is the only assertion literal touched; flagged to
Fausto in the scope declaration. Plan T2 explicitly anticipated "let the compiler enumerate every site (… tests …)".

**Gate (delegated, LB-14):** `tsc -b` **0**; full suite **183/183** (32 files — same count, no test added/removed);
`git diff --stat` = the 9 files above, all in scope; no repo pollution (no worktrees/`task-*` branches/`/tmp` dirs).

**Telemetry (task closure):**
- task:        M09-T2
- wall-clock:  2026-06-25 06:03 → 06:09 CEST (~6 min)
- budget:      weekly 26%→26% (Δ ~0%), session 0%→0% (per /usage; fresh window, change below resolution)
- gate:        tsc 0, suite 183/183, pollution clean
- diff:        9 files, +19/-19; branch `m09-t2-flip-mcp-value` (`6b45895`)
- outcome:     MERGED ✅ (`6b45895`, ff to `master`, pushed; Fausto's merge-gate go 2026-06-25)

## T3 — rename identifiers `Mcp* → Mcp*` (log)

**Scope declared (Rule 6):** rename the only two `Mcp*` tokens — `McpError → McpError`,
`McpCompleter → McpCompleter` (D3, drop "exec") — across 5 files. Behaviour byte-for-byte preserved
(production discriminates via `instanceof`, not the `.name` string). **NOT** in scope: filenames, the `'mcp'`
value (T2 done), test/script lowercase prose (T4), `server.ts` boundary. Retry budget: tsc ≤2, suite ≤2.

**Changes (5 files, +39/-39):**
- `agents/completer.ts` — class defs `McpError`/`McpCompleter`, `new McpError(...)` sites, JSDoc `{@link …}`,
  **and `this.name = 'McpError' → 'McpError'`** (see flag). Plus one orphan prose comment swept for coherence
  (a "mcp turn" → "mcp exec turn" — the file would otherwise be half-renamed).
- `agents/in-process-driver.ts` — import + the two `instanceof McpError` guards (the behaviour-relevant sites) + comments.
- `registry/registry.ts` — import + `new McpCompleter(agent, this)` + one comment.
- `agents/__tests__/completer.test.ts`, `agents/__tests__/in-process-driver.test.ts` — imports, usages, comments,
  **and the two `name: 'McpError'` assertions** (moved in lockstep with `this.name`).
- New counts: **16 `McpCompleter` / 23 `McpError`** — exact match to the plan's original `Mcp*` tallies.

**🚩 Honesty note — the `.name` value + assertions (like T2's `toBe`).** `this.name = 'McpError'` is a runtime
string. Verified it's **never** read in production (routing is `instanceof McpError` at `in-process-driver.ts:189,318`)
and **not persisted** in any json/recording fixture — its only consumers are two test assertions. Renamed value +
assertions together: the contract ("typed rejection reports its own name + reason + agentId") is preserved; keeping
the old string would both be an inconsistent Error subclass and fail DoD §7.2 (literal contains "Mcp").

**📌 Surfaced plan gap (for Fausto, decide at T4/T6):** after T2/T3, lowercase `mcp` prose survives in source —
test descriptions/comments in `team-mcp-consensus.test.ts` & `mcp-agent.test.ts`, and 3 scripts. These
ride along with **T4** (those files get renamed → sweep their prose then). `types.ts:11` keeps an *intentional*
"was 'mcp'" history note. No source file is left orphaned after T3 (completer.ts:5 swept here).

**Gate (delegated, LB-14):** `tsc -b` **0**; full suite **183/183** (32 files, same count); `git diff --stat` =
the 5 files above; no repo pollution.

**Telemetry (task closure):**
- task:        M09-T3
- wall-clock:  2026-06-25 06:13 → 06:20 CEST (~7 min)
- budget:      weekly 26%→26% (Δ ~0%), session 0% (fresh window; change below /usage resolution)
- gate:        tsc 0, suite 183/183, pollution clean
- diff:        5 files, +39/-39; branch `m09-t3-rename-identifiers` (`4c9dc52`)
- outcome:     COMMITTED to branch — AWAITING Fausto's merge-gate (LB-14)
