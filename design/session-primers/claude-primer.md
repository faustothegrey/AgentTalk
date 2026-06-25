---
audience: claude
key: 20260625-0738-c4d9e1a7
written: 2026-06-25 by Claude (M09 complete+merged; spawn-prose cleanup in flight, 2 confirms pending)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` (best-effort, never blocking) and stamp wall-clock with
`date '+%Y-%m-%d %H:%M %Z (%a)'`. Don't trust this primer blindly — verify; surface anything that's off.

**1. What it is.** AgentTalk = an orchestrator coordinating multiple AI agents (in-process API providers + externally
launched MCP-attached agents) collaborating over MCP through a multi-agent consensus protocol (planners debate →
`submit_plan` → worker executes). Monorepo: `packages/{contracts,runtime-core,runtime-scenarios,observability,…}` +
`apps/{orchestrator,web}`. Semantic logic is server-side.

**2. Roles.** You are **Claude = planner / reviewer / architect — and currently also implementer** (Gemini, the normal
implementer, is **out of weekly budget**). Per **LB-14** (degraded workflow): you implement, run `tsc -b` + full suite,
self-review the diff, **report actual output** — but **merge/closure is HUMAN-GATED** (Fausto's explicit call). Honesty
over results: he'd rather a clear blocker than a scope-creep green. **Re-read AGENT.md → Implementer Rules of Engagement
before any code.** Fausto = human (scope, decisions, relay).

**3. Workflow / source of truth.** `design/collaboration-workflow.md` (method). Artifacts: `*-plan.md` (spec+DoD),
`*-implementation.md` (the **ledger** — state lives here, not chat), `design/backlog.md`, `design/logbook.md` (LB-N),
`design/implementer-pitfalls.md` (IP-N). `AGENT.md` is canonical (`CLAUDE.md`/`AGENTS.md` are symlinks).

**4. EXACTLY where we are.**
- **M09 (MCP-vocabulary removal) = ✅ COMPLETE + MERGED to `master` (`accf4d6`).** The legacy provider value was renamed
  to `'mcp'` and the old token was scrubbed **project-wide** (code, docs incl. history, diagrams, filenames, fixtures).
  The whole-project sweep is clean **except one intentional survivor: the functional `google-gemini/gemini-cli` GitHub
  URL** (renaming = dead 404). Suite **183/183**, tsc 0.
- **🔴 DEFERRED-BUT-REQUIRED: squash the M09 git history at epic close.** The merged commit *messages* still carry the
  old provider token in `git log`; the squash (`rebase -i 0fd98f7..HEAD` → clean messages → force-push → prune dead
  branches `m09-t1/t2/t3`, `m08-*`) is the final step of D6 and is **not optional**, just sequenced last by Fausto.
  Recorded in the M09 ledger (🔴 block), `design/backlog.md` (🔴 STANDING), and agent memory `m09-squash-at-epic-close`.
- **🟡 IN-FLIGHT: spawn-prose cleanup (Fausto, 2026-06-25).** He asked to wipe the `spawn` character sequence
  everywhere. Decision: **reword prose only.** DONE + committed (`ac805c2`): every `spawn` in docs/comments/log-strings →
  `launch` (case-aware); the literal `child_process.spawn` refs in the stale `architecture.md`/`implementation.md`
  reworded to name the module. **RETAINED by his explicit choice:** the ~32 functional `child_process.spawn()`
  calls/imports/adapter-stubs in `scripts/` (Node's API — can't rename without breaking the harnesses; product code
  `packages/`/`apps/` was already spawn-free).
- **⏳ TWO CONFIRMS PENDING — Fausto ended the session before answering. ASK HIM:**
  1. **Delete `fix-capture.py`?** (root-level orphaned dead one-off; its only `spawn` hits are strings it searches for;
     already did its job; nothing references it — **recommended delete**, like the spikes.)
  2. **Push `master`?** Commit **`ac805c2` (spawn reword) is LOCAL-UNPUSHED** — `origin/master` is at `f67451a`; local
     `master` is 1 ahead. This primer commit will be a 2nd unpushed commit. He has NOT approved the push yet.

**5. Where state lives.** Ledger: `design/milestone09-mcp-vocabulary-removal-implementation.md` (Status = DONE + the 🔴
epic-close block). Resume from the ledger + backlog, **not chat**. `origin/master` = `f67451a`; local `master` = `ac805c2`.

**6. Op notes / gotchas.**
- **Gate = `npm run build` (tsc -b) AND `npm test`** (vitest). Baseline **183/183**, 32 files, tsc 0. **LB-9:**
  worker/consensus tests must mock `execSync`/`existsSync` or they pollute the repo (`/tmp/agentalk-*`, stray
  `task-*` branches) — check `git worktree list` / `git branch` after runs.
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git` (public). Branch off `master` for real feature work;
  primer/ledger housekeeping commits direct-to-master are the allowed exception. **Don't push without Fausto's go**
  (see the pending confirm).
- **🖍️ DiagramTalk channel is LIVE** — tldraw whiteboard at `localhost:3000` (`diagramtalk` skill). Fausto wants to
  reason via diagrams, not only words. Full how-to in agent memory `diagramtalk-channel` + logbook LB-18/LB-19.
- **Budget:** at handoff claude **weekly ~33%** (resets Jul 1); the **5h session window was exhausted** — that's why we
  stopped. Poll `node scripts/usage.mjs` at turn 1 (best-effort; `claude` block can read `ok:false`, LB-11).
- **Gemini still out of weekly budget** → you remain implementer under LB-14.
- **M10** (consensus/protocol robustness, spike-led) is the next epic after M09; numbering confirm (M09=this, M10=that)
  is a low-churn open item in the M09 plan §8.
