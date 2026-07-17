---
role: implementer
key: 20260718-0152-a7c3e9
written: 2026-07-18 by Claude (session close — BL-058 fixed, BL-068/069 filed, BL-069 merged+pushed)
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
the PO says "merge" and "push" as separate words, and means it** (this held all session: I stopped at the branch
every time and waited for the literal word). **Say the independence caveat out loud in every delivery:** as sole
agent you author AND review — and what actually catches things is *running the code*, never re-reading your own diff.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). And note: **the machine rebooted
mid-session last time** — a live witness orchestrator and three worktrees vanished, and `4c16dfb` (the prior
primer's "where we are") had already advanced. Verify HEAD, don't trust a primer's hash.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block +
telemetry; read those before re-deriving. Plans for a BL live in `design/bl0NN-plan.md` when the item warrants one.

## Where we are (2026-07-18 close)

**AgentTalk `59fd776` — MERGED, PUSHED, verified by fetch. Client `56269cf` — MERGED, PUSHED, verified.** Suite
**361/361**, tsc 0. The modified `com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing, not yours.
No worktrees, no live orchestrators of ours running (the PO's launchd svc on 3741/54321 is separate — leave it).

**Shipped this session, all PO-gated:**
- **BL-058** (client `56269cf`) — the Bite-0 config `bl040-d1d3.config.json` could not start an orchestrator: `cwd`
  `../../AgentTalk` (absent) → `../AgentTalk`, **plus a second defect the filing never saw** — `orchestratorUrl`
  `:3000` → `:3100` (the startCommand launches with no `PORT`, so it binds the BL-060 default 3100). Verified by
  booting the orchestrator from the fixed cwd. **Deferred:** a fail-fast guard in client `launcher.mjs` for a
  missing cwd (turns raw ENOENT into a clear message) — unfiled, small, file it if the papercut recurs.
- **BL-068 + BL-069** (`f46e69c`) — filed the id-convention findings. **BL-069** (`340bd7f`, fix `6bc2a6b`) — the
  seventh id site (scenario-scheduler run suffix) fixed: counter, not clock; frozen-clock bar, mutation-checked.

## Read this before you write a single line

**★ The pattern that paid off three times this session: run the disconfirming thing BEFORE you commit to it.**
- **BL-068 was refuted before it was built.** I recommended a test that scans source for a `Date.now()` reaching an
  id. Then I ran the *honest broad* survey (every `Date.now()`, 49 sites) and it killed the idea at both ends:
  broad it flags ~40 ordinary elapsed-time sites (BL-023's cry-wolf), narrowed it **misses** BL-069 (clock →
  variable → argument → interpolation in another file). **A grep shaped by your conclusion cannot disconfirm it;
  the survey you must read is the broad one.** Filed the refutation *with the evidence* and built nothing.
- **The mutation check is the verdict, not the green.** BL-069's bar was green with the fix — worth nothing until I
  reverted the seam to the pre-fix body and watched **both** assertions go red under a frozen clock. Per-assertion,
  staged, clock frozen so the verdict can't depend on machine speed.
- **★ `completed` is NOT evidence — check the ARTIFACT** (still true, carried from before). And **look past a
  filing's named symptom**: BL-058 was filed as one bug (`cwd`) and had two; the first masked the second, and
  "done" is the item's *goal* ("start as written"), not its literal sentence.

## Op notes / gotchas

**Worktrees (MANDATED for all code — PO 2026-07-16; docs/backlog may be edited directly on master)**
- `git worktree add /private/tmp/att-<id> -b task-<ID>`, then wire node_modules: symlink each `node_modules/*`
  entry **plus `.bin` explicitly** (`*` does NOT glob dotfiles → `vitest: command not found`). **Skip `@agenttalk`**,
  then recreate its entries with **RELATIVE** targets (`../../packages/x`) so they resolve **into the worktree**
  (verify with `os.path.realpath` → must start with the worktree path). Also symlink `apps/web/node_modules`.
- **dist is gitignored and NOT committed** — a fresh worktree has none. **`npx tsc -b` first**, then tests (they
  import built `@agenttalk/*` from dist). After a source change, **rebuild before running the bar**, and **grep
  dist for your change** to prove the artifact under test carries it (not a stale build).
- **Baseline the suite BEFORE changing anything** (was 361/361). Stage files **explicitly** — `.gitignore`'s
  `node_modules/` (trailing slash) matches a dir, so a *symlinked* node_modules slips past `git add -A`. Never `-A`.
- **★ The worktree setup costs more than a small fix** (node_modules dance + two builds for two lines). That is
  BL-036's case; there is still **no `wt-setup` helper** — writing one would pay for itself.

**Tests**
- **vitest `include` does NOT cover `packages/runtime-scenarios/src/**`** (nor `apps/web/**`, excluded by PO/LB-93).
  Scenario/scheduler bars therefore live under **`apps/orchestrator/src/__tests__/`** and import the built package
  (`@agenttalk/runtime-scenarios/scheduler/...`). Check `vitest.config.*` `include` before placing a new test.
- Repo idiom: `vi.useFakeTimers()` + `vi.setSystemTime(...)` for frozen-clock bars; `(obj as any).privateMethod()`
  to reach privates. **FREEZE THE CLOCK for any id/timing bar** — a verdict that depends on machine speed is
  evidence about the machine.

**Ports & live runs** (unchanged, carried forward)
- Orchestrator default **3100**; UI is vite on **5173** (`npm run frontend`), bound `0.0.0.0`. **The API on 3100
  has no UI — never send the PO there.** MCP url is announced on stdout *after* `Ready to manage agents.`
  Live recipe: `AGENTTALK_MCP_PORT=<p> nohup node apps/orchestrator/dist/index.js > log 2>&1 &`. **Bare foreground
  `sleep` is BLOCKED** — poll with a loop (`perl -e 'select(undef,undef,undef,1)'` works). The PO's launchd svc
  `com.fausto.agenttalk-orchestrator` on **3741/54321 — LEAVE IT ALONE.**
- **`mintId(prefix)` (`registry/ids.ts`) is the id convention — USE IT.** Never `` `thing-${Date.now()}` ``.
  **Nothing enforces this** (that's exactly BL-068) — so the next writer must choose it.

**Backlog / repo**
- **`npm run backlog:check`** gates. Statuses: **todo · doing · done · dropped · deferred**. Keep the
  `- [status · …] —` bracket on ONE line; **never** put `[[wiki-links]]` inside the bracket (parser stops at the
  first `]`, title becomes garbage, and the gate still says "OK" — **read the printed title**, not the exit code).
- **Verify pushes with `fetch` + reading the hash out of `origin/master`** — never the push output. `git merge -F -`
  does NOT read stdin (use a message file); a chained `cd repoA && git push` then `git push` pushes repoA twice.
- **★ `$?`/`PIPESTATUS` after a pipe measures the LAST command** — run `tsc -b` unpiped to trust its exit code.
- **Env:** both repos built. Meter `:9899` — poll with **`node scripts/usage.mjs`** (never hand-parse; `claude`
  block is often `ok:false`, LB-11 — best-effort, never blocking). At close: claude weekly ~52% / session ~7%;
  codex 66%; antigravity 6%.

## What's next (PO has not chosen — ask)

- **BL-068 — the id CONVENTION, and it is PARKED (PO chose "build nothing" 2026-07-17).** The obvious guard (a
  source-scanning test) is **refuted in the item itself** — do not re-propose it without reading why. The only cure
  with teeth is **branded id types** in `packages/contracts` = a cross-repo change (`agentalk-mcp-client` +
  `apps/web`) needing a plan and a PO scope call. Big. Reopen trigger: a seventh id site, or `contracts` opened for
  another reason.
- **BL-065 — a suspected flake** in client `executor-hardening.test.mjs`, seen ONCE (1/4 with the fix, 0/3 on
  master, 0/3 isolated). It is a **reproduce-or-park** job, **NOT a code fix** — the item warns in bold that
  relaxing the assertion is worse than the flake (it guards "the executor fails loudly on a dead session"). Cheap to
  attempt (re-run the client suite under constrained parallelism / a cold worktree), but the honest expected outcome
  is "couldn't reproduce → park with the numbers". No satisfying green at the end.
- **BL-064** (persistence / orchestrator-restart durability — the reboot demonstrated the gap twice) · **BL-036**
  (worktree discipline — 6 stale branches: `task-BL-039`, `task-BL-063`, `task-M18-T3`, `task-arbiter-enable`,
  `wip/BL-038-provider-timeouts`, `docs-bl045-root-cause`; confirm merged/abandoned before deleting) · **BL-024**
  (the brain leaks client shape — highest architectural altitude, design-first) · the **autonomous-ladder cluster**
  BL-044/045/046/047 (high value, blocked on live agy/goose infra — token-heavy, live runs the only honest judge).
- **Deferred follow-up from BL-058:** the client `launcher.mjs` fail-fast-on-missing-cwd guard (unfiled).

**What the independence caveat bought this session, so you don't treat it as ceremony:** three items closed by one
actor — and two of them shipped *zero code* (a refutation filed with evidence, a low-severity fix). The things that
actually caught defects were the broad survey and the mutation check, never a careful re-read. **Say the caveat out
loud, then go find what it predicts you'll miss.**

Verify all of the above against ground truth (`git fetch` both; read the BL-058/068/069 closing blocks and
`design/logbook.md`) before acting. Report your understanding, then STOP for the PO's go.
