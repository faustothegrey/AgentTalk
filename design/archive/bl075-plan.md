# BL-075 — the one-shot executor ignores the assigned task worktree

**Status:** PLANNED (awaiting plan-review gate 1)
**Filed from:** rung-4 run (BL-046), 2026-07-19 · family of BL-053
**Planner:** Claude (resource-scarcity fallback, 2026-07-27)
**Repo under change:** `agentalk-mcp-client` (the fix is client-side) · plan doc lives here, per convention
**Baseline (verified by running, 2026-07-27):** client `npm test` **86/86** (14 files) · client master `79b6268` == `origin/master`

---

## 1. The finding, restated

The orchestrator provisions a per-task git worktree and forwards its path as the exec `cwd`. In both rung-4 runs
**goose edited and committed in the sandbox's MAIN tree** while the assigned `agentalk-task-<id>` worktree stayed
empty.

**Impact:** per-task isolation is not real for goose — concurrent tasks in one workdir share a tree, and changes
land on the workdir's checked-out branch rather than the task branch. **Also a review hazard:** it is what made the
rung-4 reviewer mis-grade a good run as "no work" by checking the empty worktree (the BL-059 trap).

## 2. Root cause (verified by reading the code)

The forwarding chain is intact right up to the last step:

| Step | Site | State |
|---|---|---|
| Worker provisions the task dir | `llm-agent.mjs:115` | ✅ works |
| Worker puts it in the **sink** as `cwd` | `llm-agent.mjs:123` | ✅ works |
| Executor spawns the CLI in that cwd | — | ❌ **dropped here** |

`OneShotExecutor.executeTurn(request, sink)` (`lib/executor-runtime.mjs:95`) **never reads `sink.cwd`.** It calls
`callProvider(...)` forwarding only `onStderrChunk`. And `callProvider` (`lib/provider-runtime.mjs:50`) accepts an
`options` bag but likewise only destructures `onStderrChunk`, so its `spawnAndCollect` call passes no `cwd` and the
child inherits `process.cwd()` — the workdir's main tree.

Both persistent executors already do this correctly:
- gemini — `executor-runtime.mjs:574`: `cwd: sink.cwd || process.cwd()`
- codex — `executor-runtime.mjs:722`: `cwd: sink.cwd || process.cwd()` (added by BL-053)

**So BL-075 is the same defect BL-053 fixed for the persistent path, left unfixed on the one-shot path.**

### ⚠️ Ground-truth correction — `AGENT.md` is stale on this

`AGENT.md` currently states: *"gemini is the ONLY provider that honours it (`lib/executor-runtime.mjs:567`); claude
(`:161`) and codex (`:713`) hardcode `process.cwd()`."* **That is no longer true.** Codex honours `sink.cwd` today
(`:722`, with an explicit BL-053 comment). Claude's `:161` is a *session-level* cwd that structurally cannot be
per-turn (the process is spawned once at `initialize()`, before any turn exists) — documented there as a known
limit, not a hole, since `process.cwd()` is still the assigned workdir. **This should be corrected at close.**

### Scope is wider than goose

`OneShotExecutor` is used for **goose** (never persistent-capable) **and for any provider explicitly requesting
`executionMode: 'one_shot'`** — including claude/codex/gemini (`createExecutor`, `executor-runtime.mjs:782/786`).
So the bug affects every one-shot turn, not just goose. Fixing it at the `OneShotExecutor`/`callProvider` seam
fixes them all at once, which is both minimal and correct.

## 3. Design (two links, mirroring the established pattern)

```js
// lib/executor-runtime.mjs — OneShotExecutor.executeTurn
const result = await callProvider(this.#providerName, this.#selectedModel, request.prompt, {
  ...(request.onStderrChunk ? { onStderrChunk: request.onStderrChunk } : {}),
  cwd: sink.cwd || process.cwd(),        // BL-075 — same rule gemini/codex already follow
});

// lib/provider-runtime.mjs — callProvider
const { onStderrChunk, cwd } = options;
// … spawnAndCollect(command, args, { …, cwd: cwd || process.cwd(), … })
```

`spawnAndCollect` already spreads unknown options straight into `spawn()` (`provider-runtime.mjs:335-336`), so
`cwd` needs no further plumbing.

**Behaviour delta:** a one-shot child process now runs in the task worktree **when the orchestrator assigned one**.
When it did not (`sink.cwd` undefined — e.g. provisioning failed, BL-061), the `|| process.cwd()` fallback keeps
today's behaviour byte-for-byte. No protocol, prompt, or report path changes.

## 4. Scope

**MAY touch:** `lib/executor-runtime.mjs` (`OneShotExecutor.executeTurn` only) · `lib/provider-runtime.mjs`
(`callProvider` only) · a new test file · `AGENT.md` stale-claim correction (docs, at close).

**MUST NOT touch:** the persistent executors, `provisionTaskDir`/`task-worktree.mjs`, the bridge, the wire
contract, goose's command construction, anything in the AgentTalk orchestrator repo.

## 5. Definition of Done

| # | Bar | How it is verified |
|---|---|---|
| D1 | `OneShotExecutor` forwards `sink.cwd` to the provider call | Unit test, mutation-checked (revert ⇒ RED) |
| D2 | `callProvider` forwards `cwd` into the spawned child | Unit test observing the real spawn |
| D3 | No assigned cwd ⇒ unchanged fallback to `process.cwd()` | Unit test (regression guard on the no-worktree path) |
| D4 | Client suite ≥ 86/86, lint clean | `npm test` + `npm run lint` |
| D5 | **Live**: a real goose worker's file lands in `agentalk-task-<id>`, NOT the workdir main tree | Real goose run via the Bite-0 launcher; check the artifact at BOTH paths |

D5 is the bar that matters — this defect was *discovered* live and mis-graded once already. Per the rung-4 lesson,
I check **both** locations and report what is at each, rather than assuming.

## 6. Work discipline

- Per-task **git worktree** (PO mandate). The client repo has no `wt-setup.mjs`, so plain `git worktree add`.
- Retry budget, pre-registered: **D1/D2/D3 max 2 attempts each · D5 max 2** (a live goose run is slow and costs
  OpenRouter credit; if it fails twice I STOP and report rather than burning a third).
- Merge **PO-gated**; "merge" and "push" are separate words. Note this merges in the **client** repo.
- Sole-agent independence caveat: I author and review. D5 (the artifact, at both paths) is what actually catches
  a mistake here — not re-reading my own diff.
