---
role: implementer
key: 20260718-2352-f3a1c8
written: 2026-07-18 by Claude (session close — BL-024 T2 + T3a + T3b + T3b-2(web UI) all merged+pushed; a REAL goose client works end-to-end)
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
the PO says "merge" and "push" as SEPARATE words and means it** (held all session; stop at every branch, wait for
the literal words). **Say the independence caveat in every delivery:** as sole agent you author AND review — what
actually catches things is *running the code* (and, for a cross-repo seam, a *live* check against the real
service), never re-reading your own diff.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). Verify HEAD against `origin/master` —
never trust a primer's hash.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
Plans for a BL live in `design/bl0NN-*-plan.md`; big items get a `design/bl0NN-*-design.md`. Closed/merged slices
carry a closing block + telemetry in the backlog item — read those first. **Resume from the backlog + design/plan
docs, NOT chat.**

## Where we are (2026-07-18 close)

**AgentTalk master `~2d0bdb8`** (+ this close-out docs commit — **verify via `git fetch`**). **Client
`agentalk-mcp-client` master `79b6268`** (pushed). No worktrees/branches of ours left (T2 + T3a + T3b + T3b-2
cleaned up; the pre-existing `task-BL-039` is intentionally kept). PO's `.plist` shows modified — leave it. PO's
launchd svc — leave alone; stand up your own orchestrator on **3100** (`PORT=3100 npm run backend`, or the full
stack incl. web UI with `PORT=3100 npm run dev` → vite on 5173 proxies `/api` to 3100).

**Shipped this session (all PO-gated, merged+pushed):**
- **BL-024 T2** (`8375387`) — frozen engine **vendor-blind**: `getFactCollectionTimeoutMs` reads only
  `capabilities.factCollectionTimeoutMs`; IP-15 proof fails if the edge is reverted.
- **BL-024 T3a** — `agent-launcher` sends `{transport:'attached', vendor}` for gemini/claude/codex.
- **BL-024 T3b** (AgentTalk `92bd383`, client `79b6268`) — **`goose` is a first-class vendor with a REQUIRED model,
  and a REAL goose client works end-to-end.** `AgentVendor`/`AgentProvider` include `'goose'`; symmetric
  `normalizeAgentKind` case (→ attached); server validates `vendor:'goose'`; client requires a model for goose.
  **Live-proven:** real goose CLI 1.41.0 over OpenRouter attached over MCP, returned computed `391` / `589`.
- **BL-024 T3b-2 (web UI part)** (`2d0bdb8`) — the web UI's create/start POSTs send `{transport,vendor}`.
  Live-proven in Chrome (backend received `{transport:'attached', vendor:'gemini'}`, agent READY).

## What's next — the DEFERRED T3b-2 remainder (its own task; NOT needed for goose)

The audit showed the legacy `provider` *input* is still sent by ~12 scripts (`test-live-*.mjs`, m07/m14/m17 smokes)
and recordings (`planning_runs/*.json`); the web UI is already migrated. **The server still accepts legacy `provider`
as a deprecated input** (mapped via `normalizeAgentKind`), so everything works. The remaining hard-drop task:
1. Migrate the ~12 scripts' POST bodies to `{transport,vendor}`.
2. Add a **read-side recordings shim** (legacy→`{transport,vendor}` at the replay boundary) — see
   `design/bl024-t3b-plan.md` §4.
3. Remove the server's legacy `provider` input handling (`/api/agents` create+start, `/api/teams`).
**Do NOT delete the `AgentProvider` type / `agent.provider` field** — after T2 it's a *serialization label* still read
by recordings / usage-capture / DTOs. Leave `isUsageCaptureProvider` (`server.ts:~740`) alone — different axis.
If no other BL is assigned, report this and wait for the PO.

## Op notes / gotchas

- **Worktrees (MANDATED for code):** AgentTalk — `node scripts/wt-setup.mjs create <id> --base origin/master` →
  `/private/tmp/att-<id>` on `task-<id>`. For the **client repo** there's no wt-setup: `git -C <client> worktree add
  /private/tmp/mcpclient-<id> -b task-<id> origin/master`, then **symlink node_modules** from the primary client
  checkout (`ln -s <client>/node_modules <wt>/node_modules`) or tests can't resolve deps; remove the symlink before
  `worktree remove`. Stage files **explicitly** — never `git add -A` (a symlinked node_modules slips past
  .gitignore). Docs/backlog/governance may be edited directly on master; **code may not.**
- **Tests:** AgentTalk `npx vitest run` (**398** now); the vitest `include` is a specific list and does **not** cover
  `packages/contracts` — contracts helpers are unit-tested from runtime-core (see `normalize-agent-kind.test.ts`).
  Client `agentalk-mcp-client`: `npx vitest run` (**85**); its `exclude` deliberately drops `runs/` scratch.
  `tsc -b` uses `exactOptionalPropertyTypes` → optional fields are `?: T | undefined`. `npm run backlog:check` gates
  the backlog.
- **Live cross-repo check (the T3-family load-bearing bar):** `PORT=3100 npm run backend` (AgentTalk), then
  `curl -s -X POST 127.0.0.1:3100/api/agents -H 'content-type: application/json' -d '{...new body...}'` and read the
  record back. transport/vendor are internal (not serialized in the list DTO) — confirm via the derived `provider`.
  Kill it via `lsof -nP -iTCP:3100 -sTCP:LISTEN -t | xargs kill`. Bare foreground `sleep` is BLOCKED — use
  `perl -e 'select(undef,undef,undef,SECONDS)'`.
- **Meter:** `node scripts/usage.mjs` (best-effort). At close: claude weekly **72%**, session **~21%** (5h window
  resets ~11:09pm Europe/Rome). T2+T3a together cost ~12% session; live runs + docs are cheap.
- **Verify pushes via `fetch` + reading `origin/master`** — never the push output. Push each repo from its own dir.

Verify all the above against ground truth (`git fetch` both; read the BL-024 backlog closing blocks + the t3 plan
§7b) before acting. Report your understanding, then STOP for the PO's go.
