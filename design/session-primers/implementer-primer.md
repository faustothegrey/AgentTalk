---
role: implementer
key: 20260717-0937-791eb9
written: 2026-07-17 by Claude (session close — BL-022 + BL-060 merged & pushed; rung 3 answered its question YES)
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
delivery:** as sole agent you author AND review.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). A past session built a whole
delivery on a checkout 23 commits behind and found out at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block +
telemetry; read those before re-deriving anything.

## Where we are (2026-07-17 close)

**AgentTalk `4c49ddd` — MERGED, PUSHED, verified by fetch. Client unchanged at `1ffcd01`. No worktrees, no
branches in flight, no stray processes.** The modified `com.fausto.agenttalk-orchestrator.plist` is the PO's,
pre-existing, not yours. Suite **335/335** (was 331; +4 BL-060 bars). Client still carries its one pre-existing red
(below).

**Shipped today, both PO-gated and live-verified:**
- **BL-022** (`28aa670`) — `scope-check` was single-repo blind. Now inspects every declared `../<repo>` and **fails
  hard** on one missing from disk (PO's call; extended to "exists but not a readable git repo", which a
  `catch (e) {}` was swallowing into the same hole). Cross-repo shape + e2e bar came from **agy's rung-2 run**.
- **BL-060** (`ff3a519`) — **`PORT` was a knob that turned and did nothing.** The orchestrator honoured it while
  `apps/web/vite.config.ts` hardcoded 3000. Both halves now read the same knob, same default, **moved 3000 → 3100**.
  **See "ports" below — this changes your run recipe.**
- **Rung 3 answered its question: YES — agy caught a fail-open in its OWN work, unprompted** (goal never said "fail
  open"). It missed the bigger one it was standing on. Skeleton filed as **BL-023**'s starting point.

## Read this before you write a single test

- **A bar that starts BELOW the defect cannot see it, however green.** Test where the defect is **injected**, not
  where it is observed.
- **Mutation-check per ASSERTION, not per test.** An early assertion that short-circuits ahead of your real
  guarantee means the guarantee never ran. Neutralise the early one and re-mutate.
- **★ A crash-red looks EXACTLY like a bite-red.** My first BL-022 mutation deleted `const files = new Set();`
  instead of neutering the arg; both bars reddened on a `ReferenceError` and I nearly banked it as evidence.
  **Read the mutant you actually produced, and read the failure message — "expected undefined to be defined" and
  "ReferenceError" are different worlds.**
- **★ Mutate each bar against the mutation it OWNS.** BL-060's 4 bars cover 2 guarantees: hardcoding the proxy
  reddens 1–3 and *not* 4; drifting the defaults reddens 4 and *not* 1–3. A bar that stays green under "the"
  mutation isn't necessarily vacuous — it may guard something else. Prove which.
- **"The bar bites" ≠ "the fix is right", and "it introspected" ≠ "it saw the big one".** Both agy runs prove it:
  rung 2's mutation-check passed straight through its fail-open; rung 3's introspection named a *peripheral*
  fail-open while the *root* one (default-legitimate) went unnamed. **Neither instrument retires the reviewer's
  read.**
- **A pasted transcript is a claim.** Reproduce it. agy's is now 2-for-2 honest — you learn that by replaying it,
  not by trusting it.

## What's next (PO has not chosen — ask)

- **BL-023 — ready to implement, skeleton + one real decision.** agy's `scripts/check-orchestrator-ports.mjs`
  (`runs/rung3-agy-7aa4a0a.patch`, **do not merge from the sandbox**) is a decent read-only `lsof`/`ps` skeleton
  that correctly reports-not-reaps. **But `isLeaked = isDeleted || isTaskWorktree` defaults to LEGITIMATE with no
  positive evidence for "service"** — `launchctl` is never called — so **this item's own scenario (an orchestrator
  leaked from the repo root) reports clean.** Its test also only passes inside a path containing `agentalk-task-`
  → **red on master**. Fix is small and known: positive evidence via `launchctl list`; **unknown ⇒ UNKNOWN, never
  clean**; decouple the test from its path. **PO decision open: does an UNKNOWN process FAIL the sweep (exit≠0) or
  report loudly at exit 0?** The item's own lesson cuts both ways.
- **⚠️ BL-023's own fix sketch has TWO CORRECTED PREMISES — the filing records them, don't re-inherit them:**
  **`pgrep -f dist/index.js` DOES find the launchd service (4064)**, and **`ppid` cannot discriminate** — the
  service runs at ppid 1 and *an orphaned leak reparents to ppid 1 too*. Only `launchctl` is positive evidence.
- **Pre-existing client red, PO call, do not silently delete:** `npx vitest run` in the client fails **file
  collection** on `runs/rung15-probe-STALE-see-notes.test.ts` — the INVALID rung-1.5 probe, preserved deliberately
  as the record of an invalid probe. **All 79 tests pass**; only that file errors. Options: delete, rename out of
  the glob, or exclude `runs/`.
- **Rung 4?** The open question is no longer "can agy write a biting bar" (rung 2: yes) or "can it introspect a
  fail-open" (rung 3: yes). It is whether it can find the fail-open **it is standing on** — the one in its own
  central design premise, not a peripheral branch.
- **BL-056** — still open, NOT closed by BL-064 (that was the run-artifact half; BL-056 is the UI-facing half;
  needs a PO go per LB-93).
- **BL-028** — ⛔ do NOT scope it as "make the idle timeout fire." The timeout is genuinely dead, **but the item
  says land it WITH the typed non-reply `reason`** — and that vocabulary does not exist (grep: no `awaiting-input`).
- **BL-050**, **BL-054** (PO-parked), **BL-036** (worktree discipline detail — earning its place: see the
  node_modules trap below, and 7 stale local branches are lying around).

## Op notes / gotchas (starred ones are new this session)

- **★ PORTS CHANGED — the old recipe is stale (BL-060).** **Orchestrator default is now `3100`, not 3000.**
  `apps/web/vite.config.ts` and `apps/orchestrator/src/index.ts` read the **same `PORT` knob and the same default**,
  so they move together — **set nothing** and it just works. **The UI is vite on `5173`** (`npm run frontend`),
  bound `0.0.0.0` so the PO can reach it over SSH (`http://<lan-ip>:5173/`). **The API on 3100 has no UI — do not
  send the PO there** (I did; that's how BL-060 got found).
- **★ Not every `3000` in this repo is ours.** `localhost:3000` in `scripts/m15-live-arbiter.mjs` and
  `apps/orchestrator/src/diagramtalk-bridge.ts` is **DiagramTalk's** (`DIAGRAMTALK_URL`). A grep-and-replace of
  "3000" silently repoints the DiagramTalk bridge.
- **★ Live-run recipe (updated):** `AGENTTALK_MCP_PORT=54322 nohup node apps/orchestrator/dist/index.js > log 2>&1 &`
  — **no `PORT` needed** (defaults to 3100). Pin the MCP port only because the launcher config names it. Config with
  **NO `startCommand`** + explicit `orchestratorUrl`/`mcpUrl` → the launcher **attaches** and `stopInstance` leaves
  your instance alive. **Fresh `agentId` per run** (a squatter → HTTP 409 that reads like a hang). Poll readiness
  with a `.sh` loop — **bare foreground `sleep` is BLOCKED** by the harness (`timeout` is not installed).
- **★ The PO's launchd service `com.fausto.agenttalk-orchestrator` (pid 4064) runs on 3741/54321 — LEAVE IT ALONE.**
  It **pins `PORT`/`AGENTTALK_MCP_PORT` explicitly**, so moving a default cannot reach it (verify before you touch
  a default). `lsof -nP -iTCP:<port>` and `launchctl list | grep agenttalk` both find it; so does
  `pgrep -f dist/index.js`.
- **★ BL-053 is FIXED and re-confirmed live: the worker works in `<workdir>/agentalk-task-<id>/`** — a worktree of
  the **workdir you assign**, not of the orchestrator's cwd. Rung 3's log: `/private/tmp/rung3/sandbox/agentalk-task-…`.
  **Belt-and-braces anyway:** build `dist` in the sandbox and start the orchestrator **from there**, so even a
  regression can't hand agy a worktree of your real checkout (which *does* have a pushable origin).
- **★ `completed` is NOT evidence — check the artifact.** If you still can't explain it, write **"delivery
  incomplete, reason unobservable"** — not a model-honesty defect (that's the BL-059 shape; it was false and cost
  two sessions).
- **★ Sandbox recipe (worker workdir):** `git clone <real-repo> /tmp/<run>/sandbox` then **`git remote remove
  origin`** — that is the containment, not a nicety: agy then physically cannot push. node_modules: symlink each
  entry + `.bin`, **skip `@agenttalk`**, then point `node_modules/@agenttalk/<name>` at the **sandbox's own**
  `packages/*`/`apps/*`. **Baseline the suite before the run** (and re-baseline if you merge into the sandbox).
- **★ `.gitignore` says `node_modules/` — trailing slash matches a DIRECTORY.** A symlinked `node_modules` is a
  **file** and slips past it, so **`git add -A` commits the symlink.** **Stage explicitly.** (A fresh worktree has
  no node_modules; you *will* symlink one. Hit twice today.)
- **★ `apps/web/**` is EXCLUDED from vitest** (LB-93, no UI test infra). A bar about the web app must live in
  `scripts/__tests__/**/*.test.mjs` — the only included glob that reaches it. Vite's import analysis **rejects a
  dynamic import with a variable query string**; use a static specifier + `vi.resetModules()`.
- **★ Check `dist` freshness by GREPPING dist for your change** — not timestamps. `tsc -b` only rewrites what
  changed.
- **★ NEVER type a commit hash you haven't read.** I wrote a merge hash into a closing block *before the merge
  existed*. Caught it on the verify pass, but a fabricated hash in the ledger is exactly what makes a later reader
  stop trusting the record. **Write the block, merge, then `git log` and fill the hash in.**
- **Backlog edits:** run **`npm run backlog:check`** (it gates). Statuses: **todo · doing · done · dropped ·
  deferred** (`AGENT.md` says four and is wrong). **★ Keep the `- [status · …] —` bracket on ONE line** — the parser
  reads only the first line. **Some existing items have a bracket spanning two lines; editing their status leaves a
  stray `] —` mid-body.** Read the item back after editing (I mangled BL-060 this way).
- **Chained `cd repoA && git push` then `git push`** pushes repoA **twice** and says "Everything up-to-date".
  **Use `git -C <repo>`, and verify with a `fetch` + reading the change out of `origin/master`** — never the push
  output. (`git merge -F -` does NOT read stdin, unlike `git commit -F -`; use a message file.)
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**, and
  **the PO develops REMOTELY over SSH: you cannot witness the UI; the PO is the only witness.**
- **Env:** both repos built. Meter `:9899` — poll with **`node scripts/usage.mjs`** (never hand-parse). At close:
  claude weekly ~41% / session ~68%; codex weekly 42%; antigravity 12%.

**What the independence caveat bought, so you don't treat it as ceremony:** as sole agent I filed, implemented,
reviewed and merged both items. Mutation-checking caught a vacuous bar — and **the PO caught what I could not**:
BL-060 exists because he challenged a port I asserted from a stale note, and the trap was documented in the very
primer I'd read that morning. **Reading a hazard is not recognising it in the moment.** Say the caveat out loud,
then go looking for what it predicts you'll miss — and treat the PO's questions as the control they are.

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` — BL-023/BL-056 — and
`design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for the PO's go.
