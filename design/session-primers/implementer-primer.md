---
role: implementer
key: 20260716-2214-124ee1
written: 2026-07-16 by Claude (session close — BL-057 + BL-053 + BL-061 merged & pushed; BL-059 RETRACTED)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — a deterministic **launcher** takes `{instance, agents[], goal, cap}`, starts an instance, launches the
agent, delivers the goal, machine-enforces a resource cap, and reports.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex + Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely the sole agent under the resource-scarcity fallback: wear every hat, declare each,
keep each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay
PO-gated** — the PO says "merge" and "push" explicitly, as separate acts. ⚠️ **agy is UNAVAILABLE as an
*Implementer* but is FIT as an *MCP attach client* — and, as of today, fit to EXECUTE too.** Different things.
**Say the independence caveat out loud in every delivery** — as sole agent you author AND review; everything below
was authored, reviewed and gated by one actor, and the BL-059 retraction in particular has had only one pair of
eyes.

**⚠️ `git fetch` BOTH repos at startup.** `AgentTalk` and `agentalk-mcp-client`. A past session built a whole
delivery on a checkout 23 commits behind, discovered only at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**, which is where the state is. Each
closed item carries a closing block + telemetry; read those before re-deriving anything.

## Where we are (2026-07-16 close) — four items closed, all merged AND pushed

Everything below is on both mainlines. AgentTalk `5691fd7`, client `508c617`. Suites: AgentTalk **325/325**,
client **73/73**.

- **BL-057 done** (`3403bdb`) — `AGENTTALK_PERSISTENT_MCP` **no longer exists. Set nothing.** The flag gated nine
  sites across *all three* providers (the item claimed gemini + two); no fall-through had ever survived a live run.
  Deleted, along with `agy mcp` and `codex mcp-server`. One path per provider: the proven one.
- **BL-053 done** (AgentTalk `b2f2335`, client `34c87f5`) — the orchestrator no longer shells git in its own repo.
  The worker provisions `<workdir>/agentalk-task-<id>` itself and works there. `path.basename` is a **fence**: no
  path the orchestrator sends can put a worker outside its workdir. The prompt now *tells* the agent it has a
  worktree (`WORKTREE_CONTEXT`) instead of demanding it police one.
- **BL-061 done** (`508c617`) — fail closed: a task dir *asked for* and unavailable now **throws** through the
  turn-failure channel (agent survives, orchestrator told, git's stderr as the reason). *Not asked for* still
  returns `undefined` and runs at the workdir root — **planner-shaped turns depend on that; don't "tighten" it.**
- **BL-059 RETRACTED → `dropped`.** **Read this before you form any opinion about agy.**

## 🔑 The one thing to internalise: BL-059 was OUR bug, and it nearly became doctrine

We accused agy of accepting work and faking `completed`. **It was false. agy did the work every time.** It was on
disk — in `/tmp/agentalk-task-<id>/`, the cwd it uniquely honoured — while we checked the worker's `workdir` and
found nothing. Two sessions of confident, vivid, well-evidenced narrative about a dishonest model, written into
the backlog, into canonical `AGENT.md`, and into a lessons file. All observer error. The PO killed it with one
sentence: *"check BL-053 first before we blame agy."* Two `cat`s settled it.

**The transferable lesson, which cost the most to learn:** *"check the artifact, not the status"* is only as good
as knowing **where the process actually stood**. A verification run at the wrong coordinates **does not fail
safe** — it manufactures confidence and a paper trail. Read the spawn cwd out of the code (30 seconds) before
concluding an agent didn't work. And **distrust-the-docs applies hardest to docs you wrote**: every prior
"occurrence" was inherited on trust from my own past artifact.

Post-BL-053 the trap is *mostly* closed — every provider now works under its `workdir`, so "look in the workdir" is
true again. **`completed` still is not evidence** (check the artifact), but check it in `<workdir>/agentalk-task-<id>/`.

## What's next (PO has not chosen — ask)

Open, roughly in the order I'd argue for them:
- **BL-056** — no durable transcript; a run's output dies on page reload and there's no task read endpoint. **It
  blocked verification twice in one day.** For an autonomous ladder, "you had to be watching" is not review.
  Needs a PO go (LB-93: the UI layer stays fluid).
- **BL-058** — `scripts/bl040-d1d3.config.json` has a broken `startCommand.cwd` (`../../AgentTalk` resolves against
  `clientRoot`) → misleading `spawn node ENOENT`. Small, and it has already cost real time twice. Its
  `"provider": "gemini"` also never launches agy (`run-d1d3.sh` overrides to `fake-worker-bridge.cjs`) — **don't
  read that config as agy coverage.**
- **BL-060** (PO-raised) — `PORT` moves the orchestrator but `apps/web/vite.config.ts` hardcodes the proxy to 3000.
- **BL-050**, **BL-054** (PO-parked), **BL-036** (worktree discipline detail).
- **Bite 1** of the ladder — the PO's call, not yours.

## Op notes / gotchas (each cost real time; the starred ones are new today)

- **★ Look for a worker's output in `<workdir>/agentalk-task-<id>/`** — not the workdir root, not the orchestrator's
  repo. This single fact is what BL-059 got wrong.
- **★ Two sandboxes, still two.** The orchestrator's cwd and the worker's `workdir` are different repos. Start the
  orchestrator with `cwd=/tmp/att-sandbox` (throwaway git repo), give the worker `workdir=/tmp/att-worker-sandbox`
  (also a real git repo — it must be, or provisioning now **fails the turn**, by design). A previous session
  polluted the real repo by pointing the orchestrator at it *while debugging* — the guard lapses during debugging,
  not during planning.
- **★ In an AgentTalk *worktree*, do NOT symlink `node_modules` to the real repo.** `@agenttalk/*` resolves via
  `node_modules/@agenttalk/x → ../../packages/x`, which then resolves against the **real** repo — so your build
  silently runs the **old** code and your live test proves nothing. (It burned me; `npm install` in the worktree
  also fails on a corrupted npm cache entry.) Build a contained `node_modules`: symlink every real dep individually
  **except** `@agenttalk`, then point `@agenttalk/*` at the worktree's own `packages/*` and `apps/*`.
  **Verify the built dist actually contains your change before trusting a live run** (`grep` the dist — and beware:
  my grep matched my *own comment* and nearly read as failure).
- **★ Mutation-check any bar you're about to rely on.** Break the fix, watch the test fail, restore. One command;
  converts "it's green" into "it would catch the bug".
- **★ Faking a provider? Use `claude`.** gemini's per-turn spawn **discards `baseCmd.args`** (it hardcodes agy's
  flags), so a `persistentCommandOverride` cannot carry a script path → `agy exec failed with exit code 9`. Every
  e2e fake in the client runs through claude for this reason.
- **★ claude has session-level cwd only** — its process spawns once in `initialize()`, before any turn exists, so
  it gets session isolation, not per-task. Not a containment hole (its cwd is the workdir). Documented in the code.
- **`completed` is NOT evidence of work** — check the artifact (now: in the task dir). Design the observable
  *before* the run: a **computed** answer (`391`, `589`, `667`) plus absent-before/present-after is what makes it
  proof.
- **The launcher does NOT exit** when the config has no `startCommand`, and the worker **outlives the run,
  squatting on its agent id** → the next run dies on **HTTP 409** that looks like a hang. **Fresh `agentId` per
  run; kill leftover `llm-agent.mjs` first.**
- **`workdir` is MANDATORY** on `launchAgent`/configs: absolute, must already exist, never auto-created (BL-052).
- **Dynamic MCP port.** The orchestrator prints `MCP server URL set to: ws://localhost:<PORT>/` **after** "Ready to
  manage agents." Parse it; it is NOT `:3000/mcp`. Omit `instance.mcpUrl` unless you started the orchestrator
  yourself.
- **UI needs the orchestrator on 3000** (`apps/web/vite.config.ts` hardcodes the proxy — BL-060). UI dev server:
  `cd apps/web && npm run dev` → `:5173`. **The PO's DiagramTalk also wants 3000** — `lsof -nP -iTCP:3000` and
  **ask before touching it**.
- **The PO develops REMOTELY over SSH.** Your Chrome cannot see the dev server's `localhost`. **You cannot witness
  the UI yourself; the PO is the only witness** — ask them to open the page BEFORE the run (BL-056: the transcript
  arrives once and cannot be refetched).
- **agy is fast:** bare `agy --print` ≈ **9.65s**; live worker turn ≈ **14s** — under the 30s healthcheck default.
  No provider-specific 90s timeout needed. *(Measure, don't inherit — the PO disbelieved the written number and was
  right.)*
- **`agy --help` is free root-cause tooling** — real subcommands at zero LLM cost.
- **🛑 Bare `sleep` in a foreground Bash call is BLOCKED** (silent exit 1) and **`timeout` is not installed.** Put
  waits in a `.sh` poll loop (`/tmp/wait-orch.sh` pattern) or background + read the log.
- **`pkill -f <pattern>` kills its own shell** (exit 144) and `pgrep -f`/`grep` match the shell running them.
  Verify with `ps -p <pid> -o args=` before believing in a stray process; check the **port**.
- **`rm -rf` is in the settings `deny` list** — use fresh dir names, or `git worktree remove --force` + `git branch -D`.
- **Chained `cd repoA && git push` then `git push`** pushes **repoA twice** — the cwd persists and git says
  "Everything up-to-date", which reads like success. **Use `git -C <repo>`.**
- **Backlog edits:** run **`npm run backlog:check`** (it gates). Statuses are exactly **todo · doing · done ·
  dropped** — no inventing (`status: invalid` was rejected; a retracted false item is **dropped**). The prose
  status token must be **plain**: `- [done · **MERGED …**]`, never `- [**done · …**]` (the parser reads `**done`).
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**.
- **Papercut, left alone:** client `lib/executor-runtime.mjs` ends in `//# sourceMappingURL=…js.map` for a map that
  doesn't exist (pre-existing) → harmless "map file" noise in test output.
- **Env:** both repos built; `claude` + `agy` CLIs authed on PATH; meter `:9899` UP — poll with
  **`node scripts/usage.mjs`** (never hand-parse). At this close: claude weekly **29%**, session **45%** (resets
  01:49 Rome); codex weekly 33%; antigravity 5%.

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` BL-053 / BL-057 / BL-059 /
BL-061 closing blocks and `design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for
the PO's go.
