---
role: implementer
key: 20260717-0830-75d95a
written: 2026-07-17 by Claude (session close — BL-063 + BL-064 merged & pushed; rung 2 answered its question)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, an orchestrator (you) driving a worker (agy) against real backlog
items.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely sole agent under the resource-scarcity fallback: wear every hat, declare each, keep
each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated —
the PO says "merge" and "push" as separate words, and means it.** agy is unavailable as an *Implementer* but is fit
as an *MCP attach client* **and fit to execute** — different things. **Say the independence caveat out loud in every
delivery:** as sole agent you author AND review. It is not ceremony — see "what the caveat bought" below.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). A past session built a whole
delivery on a checkout 23 commits behind and found out at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block +
telemetry; read those before re-deriving anything.

## Where we are (2026-07-17 close)

**AgentTalk `39c19d2` and client `1ffcd01` — both MERGED, PUSHED, and verified by fetch. No worktrees, no
branches in flight, no stray processes.** The modified `com.fausto.agenttalk-orchestrator.plist` is the PO's,
pre-existing, not yours. AgentTalk suite **329/329**; client **79/79** (plus one pre-existing red — below).

**Shipped today, both PO-gated and live-verified:**
- **BL-063** (`a971b25`) — a two-agent worker was told about its worktree **twice**: both coordinators appended
  `WORKTREE_CONTEXT` to the plan and the driver appended it again. Coordinators now send the plan and nothing but
  the plan; the driver is the single source. **The fix was agy's** (rung 1.5) and was path-complete.
- **BL-064** (client `1ffcd01`) — **the worker's report now survives.** The launcher derives
  `<recording>.responses.ndjson` and hands it down as `AGENTTALK_RESPONSE_LOG`; `llm-agent` files the report there
  **before** it crosses MCP. **This unblocked the ladder**: two rungs had been ungradable because judgment is
  invisible in a diff.
- **Rung 2 answered its question: with a report channel, agy delivered a fix, a genuinely biting e2e bar, and an
  honest mutation-check transcript.** Its candidate scope-check fix is filed as **BL-022**'s starting point.

## Read this before you write a single test

- **A bar that starts BELOW the defect cannot see it, however green.** This is the session's spine. BL-063's
  duplication survived for months because a test asserted "context appears exactly once" while driving the
  **driver alone** — the extra copy was injected **upstream**. agy's test repeated the shape and passed with the
  bug fully restored. **Test where the defect is INJECTED, not where it is observed.**
- **Mutation-check per ASSERTION, not per test.** Both BL-063 bars reddened under mutation on an *earlier*
  equality check that short-circuits ahead of the count assertion — the guarantee never ran. Neutralise the earlier
  assertion and re-mutate, or you are trusting a red you didn't earn. **A test that fails for the wrong reason
  looks exactly like one that bites.**
- **"The bar bites" ≠ "the fix is right."** agy's rung-2 transcript was honest (verified independently). Only
  **reading the diff** caught that its fix **fails open**. The mutation-check does not retire the reviewer's read.
- **A pasted transcript is a claim.** Reproduce it yourself. It took ~2 minutes and it is what makes a verdict real.

## What's next (PO has not chosen — ask)

- **BL-022 — ready to implement, with a candidate patch and one real decision.** agy's fix
  (`runs/rung2-take2-agy-8b9db8b.patch`, **do not merge from the sandbox**) matches the item's own sketch and its
  bar bites. **But it FAILS OPEN**: `if (!fs.existsSync(targetCwd)) continue;` silently skips a declared repo that
  isn't on disk — BL-022's own defect class one layer up, and against this codebase's instinct ([[BL-052]] refuses
  rather than inherits; [[BL-061]] fails closed). **Hard failure, loud warning, or silent skip? PO call.** Also
  remove `scripts/__tests__/test-runner.js` (scratch) and the swallowed `catch (e) {}`.
- **Pre-existing client red, PO call, do not silently delete:** `npx vitest run` in the client fails **file
  collection** on `runs/rung15-probe-STALE-see-notes.test.ts` (`Cannot find module '../in-process-driver.js'`) —
  the **INVALID** rung-1.5 probe: gitignored scratch, written against *AgentTalk* paths, sitting in the *client*
  repo where vitest collects it. **All 79 tests pass**; only that file errors. Verified pre-existing on
  `origin/master` (`1 failed | 11 passed`). BL-063 preserved it deliberately as the record of an invalid probe —
  destroying that record is the PO's call. Options: delete, rename out of the test glob, or exclude `runs/`.
- **Rung 3** — the open question is no longer "can agy write a bar that bites" (rung 2: yes, when asked). It is
  whether agy catches a **fail-open** in its own work. It didn't, and called it a feature.
- **BL-056** — still open and **NOT closed by BL-064**. BL-064 is the *run-artifact* half (grading); BL-056 is the
  *UI-facing* half (survive a reload, review a past run, task read endpoint, retain completed tasks; needs a PO go
  per LB-93).
- **BL-028** — ⛔ **do NOT scope it as "make the idle timeout fire."** The timeout is genuinely dead
  (`lastProgressAt` read at `registry.ts:676-680`, written nowhere) **but the item says land it WITH the typed
  non-reply `reason` — "one piece of work, not two"** — and that vocabulary **does not exist** (grep:
  no `awaiting-input` anywhere). Landing it alone kills a task for an agent that correctly paused.
- **BL-060**, **BL-050**, **BL-054** (PO-parked), **BL-036** (worktree discipline detail).

## Op notes / gotchas (starred ones are new this session)

- **★ Read the backlog item's OWN fix sketch BEFORE offering or scoping it.** Three specs in a row were the weak
  link this session, all the same way: scoped from code + memory, not from the item's text. It cost a
  near-miss on BL-028 and an ungradable rung-2 run. It is a 30-second read.
- **★ Reading a run: the report now lives in `runs/<recording>.responses.ndjson`** (BL-064). The main NDJSON is
  still **lifecycle only** by design (`run-start · agent-launched · goal-delivered · outcome`) — that is not a bug,
  it's the sidecar split. **`usage` records `0/0`** for gemini/persistent (that's what `result.tokenDetails`
  yields): the sidecar carries the **report, not the cost**.
- **★ `completed` is NOT evidence — and the honest verdict may be "reason unobservable."** Rung 2 take 1 was
  `completed` with no commit. **Check the artifact where the process actually stood** — `<workdir>/agentalk-task-<id>/`
  (BL-053; re-confirmed live twice today). Then, if you still can't explain it, **write "delivery incomplete, reason
  unobservable"** — not a model-honesty defect. That is the BL-059 shape; it was false last time and cost two
  sessions.
- **★ Live-run recipe that worked twice today (no UI needed):** `PORT=3100 AGENTTALK_MCP_PORT=54322 nohup node
  apps/orchestrator/dist/index.js > /tmp/<run>/orchestrator.log 2>&1 &`. **3100 keeps 3000 free for DiagramTalk.**
  Config with **NO `startCommand`** + explicit `orchestratorUrl`/`mcpUrl` → the launcher **attaches** and
  `stopInstance` leaves your instance alive. **Fresh `agentId` per run** (a squatter → HTTP 409 that reads like a
  hang). Poll readiness with a `.sh` loop (bare foreground `sleep` is BLOCKED; `timeout` is not installed).
- **★ The PO's launchd service `com.fausto.agenttalk-orchestrator` (pid 4064) runs on 3741/54321 — LEAVE IT ALONE.**
  **Check ports with `lsof -nP -iTCP:<port>`, never a guessed `pgrep`** (pgrep does not find it).
- **★ Sandbox recipe (worker workdir):** `git clone <real-repo> /tmp/<run>/sandbox` then **`git remote remove
  origin`** — that is the containment, not a nicety: agy then physically cannot push. node_modules: symlink each
  entry + `.bin`, **skip `@agenttalk`**, then point `node_modules/@agenttalk/<name>` at the **sandbox's own**
  `packages/*`/`apps/*`. **Baseline the suite before the run.**
- **★ `.gitignore` says `node_modules/` — with a trailing slash, which matches a DIRECTORY.** A symlinked
  `node_modules` in a seeded worktree is a **file** and slips past it, so **`git add -A` will commit the symlink.**
  Stage explicitly.
- **★ `vitest.config.ts` aliases `@agenttalk/*` → `packages/*/src`**, resolved from the config's own root — so a
  worktree's tests read **that worktree's source**, not a stale `dist`. Good news, but *verify* rather than assume.
- **★ Check `dist` freshness by GREPPING dist for your change** — not by timestamps. `tsc -b` only rewrites what
  changed, so `apps/orchestrator/dist/index.js` can be weeks old while the build is current.
- **★ `git merge -F -` does NOT read stdin** (unlike `git commit -F -`). Use a message file.
- **Backlog edits:** run **`npm run backlog:check`** (it gates). Statuses: **todo · doing · done · dropped ·
  deferred** (`AGENT.md` says four and is wrong). **Keep the `- [status · …] —` bracket on ONE line** — the parser
  reads only the first line, and a multi-line bracket yields a garbage API description **while the gate still
  reports 0 warnings**. Also: the file's "done history on top" rule is **not** how the file actually is (21 `done`
  items sit below the Todo header) — follow the practice, flag the drift, don't silently reorganise.
- **Chained `cd repoA && git push` then `git push`** pushes repoA **twice** and says "Everything up-to-date".
  **Use `git -C <repo>`, and verify with a `fetch` + reading the change out of `origin/master`** — never the push
  output. (`cd` persists between Bash calls; use absolute paths. `git worktree remove` must run against the repo
  that OWNS the worktree.)
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**, and
  **the PO develops REMOTELY over SSH: you cannot witness the UI; the PO is the only witness.**
- **Env:** both repos built, `dist` verified current (BL-063 grepped live in it). Meter `:9899` — poll with
  **`node scripts/usage.mjs`** (never hand-parse). At close: claude weekly ~36% / session ~22%; codex weekly 40%;
  **antigravity read `ok:false`** (LB-11 — best-effort, never block).

**What the independence caveat bought, so you don't treat it as ceremony:** as sole agent I filed, implemented,
reviewed and merged both items. The only thing standing in for a second pair of eyes was **mutation-checking**, and
it earned that role three times in one day — it caught agy's vacuous test, my own unbarred arbiter path, and it
was *still not enough* to catch agy's fail-open, which only a diff read found. Say the caveat out loud, then go
looking for what it predicts you'll miss.

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` — BL-022/BL-056/BL-064 —
and `design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for the PO's go.
