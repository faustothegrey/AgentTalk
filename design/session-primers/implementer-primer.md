---
role: implementer
key: 20260718-1335-a3f7c1
written: 2026-07-18 by Claude (session close — env-awareness thread BL-071/072 + wt-setup BL-036, all merged)
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
the PO says "merge" and "push" as separate words, and means it** (held all session; I stopped at every branch and
waited for the literal words). **Say the independence caveat out loud in every delivery:** as sole agent you author
AND review — and what actually catches things is *running the code*, never re-reading your own diff.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). Verify HEAD against ground truth —
a machine reboot vanished worktrees mid-session once; don't trust a primer's hash, read `origin/master`.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Plans for a BL live in
`design/bl0NN-plan.md` when the item warrants one. Closed items carry a closing block + telemetry; read those first.

## Where we are (2026-07-18 close)

**AgentTalk `2b4b80f` — MERGED, PUSHED, verified by fetch. Client `8f02b02` — MERGED, PUSHED, verified.** No
worktrees of ours, no live orchestrators of ours, no leaked `yes` hogs. The modified
`com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing — leave it. The PO's launchd svc on
**3741/54321** is separate — leave it alone.

**Shipped this session (all PO-gated):**
- **BL-070** (committed) — filed the `exec-rpc.test.ts` "propagates the CLI agentId…" timeout as a low-priority
  **reproduce-or-park** flake (sibling of BL-065, client repo). Distinct class from BL-065: a slow-test 5000ms
  timeout on a heavy real-child E2E, not a race.
- **BL-071 DONE (both phases).** Environment awareness — **verifiable** half:
  - **P1** (AgentTalk `0e594bc`): the orchestrator serves its own self-observed host at **`GET /api/environment`**.
    Added `HostEnvironment` (`packages/contracts/src/types.ts`) + a pure `captureHostEnvironment()`
    (`packages/runtime-core/src/shared/environment.ts`). **Contract-free** (the wire hash covers only
    `{mcpTools,packetTypes,protocolPrefix}`, NOT `types.ts` — read `verify-contract.js`).
  - **P2** (AgentTalk `6becfa2` + client `8f02b02`, **lockstep v8**): per-agent env. New **`report_environment`**
    MCP tool (wire contract **v7→v8, hash `8df9593…`**, identical both repos). Client gathers its own host
    (`agentalk-mcp-client/lib/environment.mjs`) and reports it **once on connect, fire-and-forget**; orchestrator
    stores it on the `Agent` record and surfaces it via **`GET /api/agents`** (`host` field). Verified LIVE:
    real v8 client → real v8 orchestrator → real `darwin` host in `/api/agents`.
- **BL-072 DEFERRED** (decision recorded). "Am I within AgentTalk?" → **behaviour-tuning, not authorization**
  (they're different jobs in different places; authorization would live orchestrator-side, so going light costs
  nothing). No consumer today → build nothing yet. **Reopen trigger:** the first real behaviour that branches on
  within-ness. Two guardrails in the item.
- **BL-036 tooling bite DONE** (AgentTalk `53d4f56`): **`scripts/wt-setup.mjs`** — see op-notes; the manual
  worktree dance is retired. Item stays `todo` (discipline doc + stale-branch prune remain).

## Read this before you write a single line

**★ USE `scripts/wt-setup.mjs` — don't hand-run the worktree dance anymore.**
`node scripts/wt-setup.mjs create <id> [--base <ref>] [--baseline]` builds `/private/tmp/att-<id>` on branch
`task-<id>` with node_modules fully wired + `tsc -b`; `remove <id> [--delete-branch]` tears it down clean. (Client
worktree is still a single `ln -s <primary>/node_modules <wt>/node_modules` — no helper there.)

**★ A contract-hash bump has a wide blast radius — `grep` the OLD hash across BOTH repos before scoping.** The
v7→v8 bump broke a test that hardcoded the hash, 6 client spawn-tests (via unrelated mechanisms), and left
`scripts/m16-live-baton-proof.mjs` + `m17-live-gate-proof.mjs` hardcoding v7 (**flagged, NOT fixed — they'll be
rejected by a v8 orchestrator; update to v8 or read the hash dynamically**). One grep maps it in seconds.

**★ When your change breaks tests, ask "is my change wrong, or does the test/mock encode an assumption my
legitimate change violates?"** and prefer the fix that improves the *design* (fire-and-forget beat editing 5 tests;
one mock was just unfaithful to the real orchestrator). Don't reflexively edit the bar.

**★ Dogfood tooling; `completed` is NOT evidence — check the artifact / run the thing.** (carried forward)

## Op notes / gotchas

**Worktrees (MANDATED for all code — PO 2026-07-16; docs/backlog/governance may be edited directly on master)**
- AgentTalk: **`node scripts/wt-setup.mjs create <id> --baseline`** (replaces the manual symlink dance). Stage
  files **explicitly** — never `git add -A` (a symlinked `node_modules` slips past `.gitignore`).
- Client is lighter — plain `.mjs`, **NO build**. Worktree = one symlink. Its vitest transform cache is
  `node_modules/.vite`; clear it (`rm -rf node_modules/.vite`) to force a cold run (a stale read once showed a
  wrong file count — re-run cold before trusting a green).

**Tests**
- Client suite: `npx vitest run` (**84** tests / 14 files now). Config excludes gitignored `runs/**` (BL-063).
- **AgentTalk** suite: `npx vitest run` (**372** now). `include` covers `apps/orchestrator/src/**`,
  `packages/*/src/**`, `scripts/__tests__/**/*.test.mjs` — NOT `packages/runtime-scenarios/src/**` or `apps/web/**`.
  `npm test` also runs `verify-contract.js` (the wire-contract hash + cross-repo alignment check).
- Repo idiom: `vi.useFakeTimers()` for frozen-clock bars; wait on **observable state**, never a fixed sleep, for
  any timing bar (that's the BL-065 flake). Inject clocks/os for pure helpers.

**Ports & live runs** (unchanged)
- Orchestrator default **3100** (`PORT` env); MCP **`AGENTTALK_MCP_PORT`**. UI is vite on **5173**
  (`npm run frontend`). **The API port has no UI — never send the PO there.** Live recipe:
  `PORT=<p> AGENTTALK_MCP_PORT=<q> nohup node apps/orchestrator/dist/index.js > log 2>&1 &`; wait for
  `Ready to manage agents.`. **Bare foreground `sleep` is BLOCKED** — poll with
  `perl -e 'select(undef,undef,undef,1)'`. PO's launchd svc on **3741/54321 — LEAVE ALONE.**
- Cheap live cross-repo attach (no LLM/token burn): the client reports env / attaches **before** any turn, so you
  can launch `llm-agent.mjs` with a fake `AGENTTALK_PERSISTENT_COMMAND_JSON` bridge, let it connect, `curl` the
  orchestrator, and kill. See this session's P2 live check for the exact incantation (in git history).
- **`mintId(prefix)` (`registry/ids.ts`) is the id convention — USE IT.** Nothing enforces it (BL-068 PARKED).

**Backlog / repo**
- **`npm run backlog:check`** gates. Statuses: **todo · doing · done · dropped · deferred**. Keep the
  `- [status · …]` bracket on ONE line; **never** put `[[wiki-links]]` inside the bracket. **Read the printed title.**
- **Verify pushes with `fetch` + reading the hash out of `origin/master`** — never the push output. Push each repo
  from its **own** directory in a **separate** step. `git merge -F <file>` needs a message *file* (`-F -` does NOT
  read stdin). Wire contract is **v8** now (`8df9593…`), identical in both repos — a bump means editing BOTH
  `wire-contract.json` + `client: npm run sync-contract` (reads AgentTalk's via `AGENTTALK_CONTRACT_PATH`).
- **Env:** both repos clean (only the PO's `.plist` shows modified — leave it). Meter `:9899` — poll with
  **`node scripts/usage.mjs`** (best-effort, `claude` block often `ok:false`, LB-11). At close: claude weekly ~60%,
  antigravity 6%.

## What's next (PO has not chosen — ask)

- **BL-064** — persistence / orchestrator-restart durability (a reboot demonstrated the gap twice). Self-contained.
- **BL-036 remaining bites** — the **discipline doc** (merge serialization, id allocation without races) + the
  one-time **stale-branch prune** (branches enumerated in the item; destructive, confirm-then-prune). The
  `wt-setup` tooling is done.
- **m16/m17 v7-hash follow-up** — the two live-proof scripts hardcode the retired v7 hash (flagged in BL-071's
  closing note); update to v8 or read dynamically. Small; file as its own BL if it bites.
- **BL-024** (the brain leaks client shape — highest architectural altitude, design-first) · the
  **autonomous-ladder cluster** BL-044/045/046/047 (high value, blocked on live agy/goose infra — token-heavy).
- **BL-072** stays deferred until a behaviour needs the within-AgentTalk signal (then build it agent-side,
  grounded in the live connection — see the item).

Verify all of the above against ground truth (`git fetch` both; read the BL-071/BL-036 closing blocks +
`design/logbook.md`) before acting. Report your understanding, then STOP for the PO's go.
