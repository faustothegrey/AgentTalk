---
role: implementer
key: 20260717-1428-3c9f4a
written: 2026-07-17 by Claude (session close — BL-056 merged+pushed after BL-066/BL-067 cleared the ground under it)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely sole agent under the resource-scarcity fallback: wear every hat, declare each, keep
each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated —
the PO says "merge" and "push" as separate words, and means it.** agy is unavailable as an *Implementer* but is
fit as an *MCP attach client* and fit to execute. **Say the independence caveat out loud in every delivery:** as
sole agent you author AND review. It is not ceremony — see the bottom of this file.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). A past session built a whole
delivery on a checkout 23 commits behind and found out at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block +
telemetry; read those before re-deriving anything. Plans for BL items live in `design/bl0NN-plan.md` when the item
warrants one (`bl052-plan.md`, `bl056-plan.md` are the shape).

## Where we are (2026-07-17 close)

**AgentTalk `4c16dfb` — MERGED, PUSHED, verified by fetch + reading the code back out of `origin/master`. Client
unchanged at `786f58a` (also pushed).** Suite **359/359**, tsc 0. The modified
`com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing, not yours.

**Shipped today, all PO-gated:**
- **BL-056** (`3e9ff4c`) — a finished run is retrievable; the empty state is honest. **D5/D6 PO-witnessed live.**
- **BL-066** (`fc3b55a`) + **BL-067** (`91834ae`) — ids mint from a counter, not the clock. Six sites.

**Left running deliberately** (kill them and today's runs are gone — that is BL-056's scope boundary, not a bug):
witness orchestrator **pid 98730**, cwd `/private/tmp/att-bl056`, ports **3100** + MCP **54344**, with **three
attached gemini workers**. Four worktrees exist (`att-bl056`, `att-bl066`, `att-bl067` all merged and disposable)
plus ~7 stale branches — that is BL-036 making its own case.

## Read this before you write a single line

**★ The one lesson from 2026-07-17, and it cost four premises: I was wrong every time I reasoned from code
instead of running it, and right every time I ran something.** Four in one day:
1. *"The UI lies"* — it was the doomed branch's UI, not master's. I looked at a screen and generalised.
2. *"The data was never lost, only the pointer"* — my plan's central claim, holed by an id collision I hadn't
   found yet.
3. *"All four mint sites"* — six. The survey grepped for ``id: `team-`` / ``id: `task-``: **the exact shape I had
   already concluded**, so it returned my assumption. **A grep shaped by your conclusion cannot disconfirm it.**
4. *"Agents are silently evicted"* — filed as **verified**. `createAgent` guards at `registry.ts:178`; I read
   `agents.set(...)` and reasoned by analogy with teams instead of reading the function.

Two were caught only because the **PO** pointed at something. **Run it. The terminal is the only thing that was
right all day.**

- **★ `completed` is NOT evidence — check the ARTIFACT.** A witness run reported `status: "completed"` having done
  **nothing**: the transcript said `fatal: not a git repository` and the answer appeared nowhere. Team status was
  technically honest and completely useless — the worker returned a result, and that result happened to be an
  error string. **The orchestrator cannot read semantics.**
- **★ A crash-red looks EXACTLY like a bite-red, and the summary line cannot tell them apart.** Twice today:
  task-id bars died on `Team is already working on a task` (killed by a *different* collision before testing their
  own thing); a conversation bar **timed out** because a frozen clock stalled a healthcheck await. **Read the
  mutant and read the failure message.**
- **★ Mutation-check per ASSERTION, not per test — an early assertion can pass VACUOUSLY.** My agent-id bar's
  `expect(a.id).not.toBe(b.id)` passed on unfixed code because the second POST failed and `b` had no `id`:
  `realId !== undefined` is true for a reason unrelated to the guarantee. **Assert the statuses first.**
- **★ Stage the fix to prove each bar owns its mutation.** Fix team ids only → the task bar then failed on its
  *own* assertion. Only then fix the task sites. Without staging you cannot tell which bar guards what.
- **★ FREEZE THE CLOCK for any id/timing bar.** The whole id class was found by a bar that passed 354/354 under
  full-suite load and failed 5-of-6 in isolation — load spaced two mints into different milliseconds. **A bar
  whose verdict depends on machine speed is evidence about the machine.** Frozen, it is certain. And "ids are
  usually unique" is not a property; **"ids are unique even when the clock does not move"** is.
- **★ A green suite can be luck.** 354/354 was green with the defect live. Deleting the "flaky" bar would have
  shipped it under a green.

## Op notes / gotchas (starred = new 2026-07-17)

**Ports & live runs**
- **Orchestrator default `3100`; the UI is vite on `5173`** (`npm run frontend`, or `npx vite` in `apps/web`),
  bound `0.0.0.0` → the PO reaches it at `http://<lan-ip>:5173/` (LAN IP was `192.168.178.112`). **The API on 3100
  has no UI — never send the PO there.** Both halves read the same `PORT` knob and default (BL-060) — **set
  nothing**.
- **Not every `3000` is ours**: `localhost:3000` in `m15-live-arbiter.mjs` / `diagramtalk-bridge.ts` is
  **DiagramTalk's**. A grep-and-replace of "3000" silently repoints it.
- **The PO's launchd service `com.fausto.agenttalk-orchestrator` (pid 4064) runs on 3741/54321 — LEAVE IT ALONE.**
  It pins its ports explicitly, so moving a default cannot reach it.
- **Live-run recipe:** `AGENTTALK_MCP_PORT=54344 nohup node apps/orchestrator/dist/index.js > log 2>&1 &` from the
  worktree you want to test. **The MCP url is announced on stdout** (`MCP server URL set to: ws://localhost:<p>/`)
  *after* `Ready to manage agents.` Poll readiness with a `.sh` loop — **bare foreground `sleep` is BLOCKED**.
- **★ Swapping the running build DROPS attached workers** (they do not reattach). Build the new `dist` FIRST, then
  kill+start. Better: swap *before* asking the PO to launch anything.

**Launching agy workers (both scripts exist; they are NOT redundant)**
- **★ `node scripts/launcher.mjs <config.json>`** (client repo) — a full Bite-0 run: creates a worker-only team,
  assigns the goal, polls to termination. **Config with NO `startCommand` + explicit `orchestratorUrl`/`mcpUrl` →
  it ATTACHES and leaves your orchestrator alive.** Fresh `agentId` per run (a squatter → **409**, which reads
  like a hang).
- **★ `node scripts/explore-launch-worker.mjs`** — attaches ONE worker to an already-running orchestrator and
  **creates no team**. This is what you want when you need a team with **no task**, or the UI open *before* the
  agent exists. `MCP_URL='ws://localhost:<p>/' ORCH_URL=... WORKER_PROVIDER=gemini WORKER_ID=<fresh>
  WORKER_WORKDIR=<dir>`.
- **★ `WORKER_WORKDIR` must be an EXISTING GIT REPO** — the worker provisions `<workdir>/agentalk-task-<id>/` as a
  **worktree**, so a plain dir fails with `fatal: not a git repository` **and the run still reports `completed`.**
  `git init` + one commit + **`git remote remove origin`** (that removal *is* the containment: the worker then
  physically cannot push).
- **★ `POST /api/agents` cannot give you a ready agent** — attach mode means agents come from outside; it sits at
  `creating` forever. Launch one.
- **BL-053 (fixed):** the worker works in `<workdir>/agentalk-task-<id>/` — a worktree of the workdir **you
  assign**, not of the orchestrator's cwd.

**Worktrees (MANDATED for all code — PO 2026-07-16)**
- `git worktree add /private/tmp/att-<id> -b task-<ID>`, then wire node_modules: symlink each `node_modules/*`
  entry, **★ plus `.bin` explicitly — `*` does NOT glob dotfiles** (this bit me: `vitest: command not found`).
  **Skip `@agenttalk`**, then recreate its entries **with their RELATIVE targets** (`../../packages/x`) so they
  resolve **into the worktree** — otherwise you are testing the primary checkout's code, not yours. Verify with
  `os.path.realpath`. Also symlink `apps/web/node_modules`.
- **★ Baseline the suite BEFORE you change anything.** It is the number every later claim is measured against.
- **`.gitignore` says `node_modules/`** — the trailing slash matches a DIRECTORY, so a **symlinked**
  `node_modules` is a file and slips past it. **Stage explicitly**, never `git add -A`.

**Measurement traps (all four bit me today)**
- **★ `$?` after a pipe measures the LAST command**, not your script. I nearly filed a false defect against
  BL-023's sweep because `node check.mjs | head` reported exit 0 while the script exits 1. **Run it unpiped.**
- **★ `grep -o "some/route"` matches SUBSTRINGS.** `api/teams/:id/tasks` matched the prefix of an existing
  `POST /api/teams/:id/tasks/:taskId/confirm` and told me master had a route it did not have. **Anchor the
  pattern** (`app.get('/api/...'`).
- **★ A status code can be non-discriminating.** `GET /api/teams/nope/tasks` → **404 whether the route exists**
  (unknown team, by design) **or not** (Express). Same code, opposite meanings. **The BODY discriminated** (JSON
  `{"error":...}` vs Express HTML). Design the probe so **one mechanism explains the result**.
- **★ Check `dist` freshness by GREPPING dist for your change**, not timestamps. `tsc -b` only rewrites what
  changed.
- **NEVER type a commit hash you haven't read.** Write the block, merge, `git log`, then fill it in.

**Backlog**
- **`npm run backlog:check`** gates. Statuses: **todo · doing · done · dropped · deferred** (`AGENT.md` says four
  and is wrong).
- **Keep the `- [status · …] —` bracket on ONE line** — the parser reads only the first line.
- **★ NEVER put `[[wiki-links]]` inside the status bracket** — the parser stops at the first `]` and the title
  silently becomes garbage. **The gate still reports "OK — 0 warnings"**, so *read the printed title*, not the
  exit code. Put links in the body.

**Repo / git**
- **Chained `cd repoA && git push` then `git push` pushes repoA twice** and says "Everything up-to-date". Use
  `git -C <repo>`, and **verify with `fetch` + reading the change out of `origin/master`** — never the push
  output. (`git merge -F -` does NOT read stdin, unlike `git commit -F -`; use a message file.)
- **★ Two branches inserting tests at the same anchor WILL conflict on rebase.** Do **not** union the conflict
  sides blindly — it silently unbalances the file and esbuild then says only "Unexpected end of file". Resolve as:
  `git checkout --ours <file>` (= the new base) then **re-insert your block at the anchor** programmatically.
- **No UI test infrastructure, by PO decision (LB-93)** — `apps/web/**` is excluded from vitest. The bar for UI
  work is a **live, witnessed run**. **★ You CAN now witness the UI yourself** via the Claude-in-Chrome tools
  (`localhost` is pre-authorized) — but that makes you able to *see* it, not to *judge* it. The PO is the control.
- **★ `mintId(prefix)` (`registry/ids.ts`) is now the id convention — USE IT.** Never write
  `` `thing-${Date.now()}` ``. **Nothing enforces this yet**, which is exactly how the class got re-introduced six
  times.
- **Env:** both repos built. Meter `:9899` — poll with **`node scripts/usage.mjs`** (never hand-parse). At close:
  claude weekly ~47% / session ~35%; codex 49%; antigravity ~6%.

## What's next (PO has not chosen — ask)

- **★ The id CONVENTION GUARD — the only open item that treats the disease.** `registry.ts:616`
  (`` `msg-${Date.now()}-${this.outboundMessageSeq}` ``) and `:802` **already** appended a counter *before* today.
  **Two people hit this defect, solved it locally, and it never became a convention — so it was re-introduced six
  times.** It was never six bugs; it was a missing convention, and `mintId` only cures it if the next person finds
  it. Proposed: a test that scans source for a `Date.now()` reaching an id and fails. **Reservation, stated up
  front:** pattern-scanning tests are brittle and become the noise the next person deletes — which is BL-023's "a
  check that cries wolf gets disabled", one item removed. Worth doing carefully.
- **Surveyed, unfiled** (from BL-067's honest survey — *every* `Date.now()`, not a shaped grep):
  `apps/web/src/App.tsx:194` uses `String(Date.now())` as a **React key** (real, cheap) · `registry.ts:280`
  `usage-…` and `conversations/runtime.ts:230` `req-…` are **correlation ids, not Map keys** (low; only the first
  verified). Genuinely safe: `healthcheck-manager.ts:15`, `scheduler.ts:90` (both append `Math.random()`).
- **Orchestrator-restart durability** — BL-056 explicitly does **NOT** cover it, and the boundary is
  *demonstrated*: a `kill` erased 8 real runs permanently, including the 15-minute one the item was built on. If
  "review a session after the fact" must survive a restart, that is persistence (BL-064 territory). **Unfiled,
  PO's call.**
- **The `tasks` map grows UNBOUNDED** (never pruned). It is what made BL-056 cheap and it is a real leak on a
  long-lived orchestrator. Unfiled.
- **BL-065** — suspected timing flake in `executor-hardening.test.mjs`, observed once, NOT reproduced. **Do not
  "fix" it by relaxing the assertion.**
- **BL-036** (worktree discipline: 4 worktrees + ~7 stale branches right now) · **BL-028** (⛔ do NOT scope it as
  "make the idle timeout fire" — it needs the typed non-reply `reason`, which does not exist) · **BL-050** ·
  **BL-054** (PO-parked) · **BL-056's UI sibling BL-051** is already done.
- **Rung 4** — the open question is whether agy can find the fail-open **it is standing on**, in its own central
  premise, not a peripheral branch. *(Note the mirror, and take it seriously: today I failed exactly that test,
  four times, and only execution caught me. Do not grade agy against a bar you cannot pass.)*

**What the independence caveat bought, so you don't treat it as ceremony:** as sole agent I filed, planned,
implemented, reviewed and merged three items. The mechanisms that actually caught things were **running the code**
and **the PO's questions** — never my own careful reading. BL-056 became a *witnessed* fix only because the PO
said "you use browser-use and I watch"; BL-066 exists because a bar I wrote for something else flaked and I chose
to read it instead of deleting it. **Say the caveat out loud, then go looking for what it predicts you'll miss.**

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` — the BL-056/066/067
closing blocks — and `design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for the
PO's go.
