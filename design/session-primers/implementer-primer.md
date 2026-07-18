---
role: implementer
key: 20260718-0947-c4f8a2
written: 2026-07-18 by Claude (session close — BL-065 reproduced, fixed, merged + pushed both repos)
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
the PO says "merge" and "push" as separate words, and means it** (held again this session: I stopped at the branch
and waited for the literal words "merge" and "push both"). **Say the independence caveat out loud in every
delivery:** as sole agent you author AND review — and what actually catches things is *running the code*, never
re-reading your own diff.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). Verify HEAD against ground truth —
a machine reboot vanished worktrees mid-session two sessions ago; don't trust a primer's hash, read `origin/master`.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block +
telemetry; read those before re-deriving. Plans for a BL live in `design/bl0NN-plan.md` when the item warrants one.

## Where we are (2026-07-18 close)

**AgentTalk `41aa049` — MERGED, PUSHED, verified by fetch. Client `8d0a823` — MERGED, PUSHED, verified.** Client
suite **81/81**. No worktrees of ours, no live orchestrators of ours. The modified
`com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing, not yours — leave it. The PO's launchd svc on
**3741/54321** is separate — leave it alone.

**Shipped this session (PO-gated):**
- **BL-065** (client `8d0a823`, fix `c1d05f2`) — the `executor-hardening.test.mjs` "session died earlier" flake.
  It was a **reproduce-or-park** item that turned out **reproducible** → became a scoped **test-only** fix. The test
  waited a fixed 250ms for the child's async `'close'` event, then pinned the *synchronous* send-guard message; on a
  cold/loaded first run the close lands late and the rejection comes from the async path (equally loud, different
  string) → red. Fix: wait on `getStatus()==='error'` (child provably reaped) so the guard is the deterministic path;
  **assertion byte-for-byte unchanged** (the item forbade relaxing it). Mutation-checked, 16/16 green under the repro
  battery. Full write-up + telemetry in the BL-065 closing block.

## Read this before you write a single line

**★ Reproduce a flake under its ACTUAL observed condition, not a plausible proxy.** BL-065 gave 0 failures in 37
runs (normal, heavy CPU load, cold-cache-in-primary-checkout) and 2/12 the instant I used the **fresh worktree**
condition the filing named. Counter-intuitively **uniform CPU load HID the race** — it stretches the racy fixed
timer too. Read the repro recipe literally.

**★ "Do not fix by relaxing the assertion" forbids defeating the bar — not fixing the flake.** BL-065's real fix
left the assertion untouched and removed the *racy wait*. A timing flake is often a **test** bug (a guessed sleep
for an async event), not a product defect; both failure branches can be equally correct.

**★ Mutation-check a test-fix by breaking the PRODUCT, then reverting.** For a deterministic-wait fix the reviewer's
question is "did it defang the guarantee?" — answer it by removing the product guard, watching the fixed test go
red, reverting. That red is the verdict; re-reading your own diff earns nothing.

**★ `completed` is NOT evidence — check the ARTIFACT** (carried forward). And **look past a filing's named symptom**
— the first bug often masks a second (BL-058 had two defects behind one filing).

## Op notes / gotchas

**Worktrees (MANDATED for all code — PO 2026-07-16; docs/backlog may be edited directly on master)**
- AgentTalk: `git worktree add /private/tmp/att-<id> -b task-<ID>`, then wire node_modules — symlink each
  `node_modules/*` entry **plus `.bin` explicitly** (`*` does NOT glob dotfiles → `vitest: command not found`),
  **skip `@agenttalk`** then recreate its entries with **RELATIVE** targets (`../../packages/x`) so they resolve
  into the worktree. Also symlink `apps/web/node_modules`. `dist` is gitignored — **`npx tsc -b` first**, then tests.
- **Client (`agentalk-mcp-client`) is far lighter — plain `.mjs`, NO build.** A worktree just needs one symlink:
  `ln -s <primary>/node_modules <wt>/node_modules`. No tsc, no per-package dance. This session's whole worktree was
  that one line. (Its vitest transform cache is `node_modules/.vite`; clear it to force a cold run.)
- **Baseline the suite BEFORE changing anything.** Stage files **explicitly** — never `git add -A` (a *symlinked*
  node_modules slips past `.gitignore`'s `node_modules/` and gets staged). **★ Still no `wt-setup` helper (BL-036).**

**Tests**
- Client suite: `npx vitest run` (81 tests / 13 files, ~4.5s warm). Config `vitest.config.mjs` excludes gitignored
  `runs/**` scratch (that exclude was BL-063's fix — don't drop it).
- **AgentTalk** vitest `include` does NOT cover `packages/runtime-scenarios/src/**` or `apps/web/**` — scenario bars
  live under `apps/orchestrator/src/__tests__/` and import the built package. Check `include` before placing a test.
- Repo idiom: `vi.useFakeTimers()` + `vi.setSystemTime(...)` for frozen-clock bars; `(obj as any).privateMethod()`
  for privates. **FREEZE THE CLOCK / wait on observable state for any timing bar** — a verdict that depends on
  machine speed is evidence about the machine (that IS the BL-065 flake).
- **Load-testing gotcha:** if you spawn CPU hogs (`yes >/dev/null &`) to simulate a loaded box, **verify they die**
  — `kill $HOGS` leaked 28 of them this session; use `pkill -x yes` then assert `pgrep -x yes | wc -l` is 0.

**Ports & live runs** (unchanged)
- Orchestrator default **3100**; UI is vite on **5173** (`npm run frontend`), bound `0.0.0.0`. **The API on 3100
  has no UI — never send the PO there.** MCP url announced on stdout *after* `Ready to manage agents.` Live recipe:
  `AGENTTALK_MCP_PORT=<p> nohup node apps/orchestrator/dist/index.js > log 2>&1 &`. **Bare foreground `sleep` is
  BLOCKED** — poll with `perl -e 'select(undef,undef,undef,1)'`. PO's launchd svc on **3741/54321 — LEAVE ALONE.**
- **`mintId(prefix)` (`registry/ids.ts`) is the id convention — USE IT.** Never `` `thing-${Date.now()}` ``.
  Nothing enforces it (BL-068, PARKED — the source-scan guard is refuted in the item itself; the only cure with
  teeth is branded id types in `packages/contracts`, a cross-repo change needing a PO scope call).

**Backlog / repo**
- **`npm run backlog:check`** gates. Statuses: **todo · doing · done · dropped · deferred**. Keep the
  `- [status · …] —` bracket on ONE line; **never** put `[[wiki-links]]` inside the bracket (parser stops at first
  `]`). **Read the printed title**, not just the exit code.
- **Verify pushes with `fetch` + reading the hash out of `origin/master`** — never the push output. Push each repo
  from its **own** directory in a **separate** step (a chained `cd repoA && git push` then `git push` pushes repoA
  twice). `git merge -F <file>` needs a message *file* (`-F -` does NOT read stdin).
- **Env:** both repos clean. Meter `:9899` — poll with **`node scripts/usage.mjs`** (never hand-parse; `claude`
  block often `ok:false`, LB-11 — best-effort, never blocking). At close: claude weekly ~54% / session unavailable;
  codex 0%; antigravity 6%.

## What's next (PO has not chosen — ask)

- **Sibling flake from BL-065 (unfiled).** Under cold + load, `exec-rpc.test.ts > "propagates the CLI agentId into
  nested persistent MCP bridge URLs"` timed out at 5000ms **once**. A separate heavier-test flake; the PO may want
  it filed as its own reproduce-or-park BL. Recorded in the BL-065 item.
- **BL-064** (persistence / orchestrator-restart durability — the reboot demonstrated the gap twice) · **BL-036**
  (worktree discipline — a `wt-setup` helper would pay for itself; 6 stale branches to confirm-then-prune:
  `task-BL-045`, `task-BL-064`, `task-M18-T3`, `task-goose-executor`, `m11-t1-consensus-respond`,
  `m12-c-pf1-codex-bridge-fix` in the CLIENT; AgentTalk has its own stale set — confirm merged/abandoned before
  deleting) · **BL-024** (the brain leaks client shape — highest architectural altitude, design-first) · the
  **autonomous-ladder cluster** BL-044/045/046/047 (high value, blocked on live agy/goose infra — token-heavy).
- **Deferred (unfiled):** a fail-fast guard in client `launcher.mjs` for a missing `cwd` (turns raw ENOENT into a
  clear message) — file if the papercut recurs.

**What the independence caveat bought again this session, so you don't treat it as ceremony:** BL-065 was a
suspected flake the filing expected to end in "couldn't reproduce → park". Reproducing it under the *exact* named
condition, then the mutation check, is what turned a park into a real fix — and neither was a re-read of the diff.
**Say the caveat out loud, then go run the thing that would prove you wrong.**

Verify all of the above against ground truth (`git fetch` both; read the BL-065 closing block + `design/logbook.md`)
before acting. Report your understanding, then STOP for the PO's go.
