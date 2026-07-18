---
role: implementer
key: 20260718-2231-e7a91c
written: 2026-07-18 by Claude (session close — BL-024 T2 + T3a merged+pushed; T3b parked on goose spec)
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

**AgentTalk master `92bd383`** (pushed). **Client `agentalk-mcp-client` master `79b6268`** (pushed). No
worktrees/branches of ours left (T2 + T3a + T3b cleaned up; the pre-existing `task-BL-039` is intentionally kept).
PO's `.plist` shows modified — leave it. PO's launchd svc — leave alone; stand up your own orchestrator on **3100**
(`PORT=3100 npm run backend`).

**Shipped this session (all PO-gated, merged+pushed):**
- **BL-024 T2 CLOSED** (`8375387`) — the **frozen engine is now vendor-blind**: `getFactCollectionTimeoutMs` reads
  only `capabilities.factCollectionTimeoutMs`; no `provider`/`providerName === 'gemini'` sniff. IP-15 proof pins the
  ms and fails if the edge is reverted.
- **BL-024 T3a CLOSED** — `agent-launcher` sends `{transport:'attached', vendor}` for gemini/claude/codex.
- **BL-024 T3b CLOSED** (AgentTalk `92bd383`, client `79b6268`) — **`goose` is a first-class vendor with a REQUIRED
  model, and a REAL goose client works end-to-end.** goose was fully broken (start failed at `registry.ts:293`);
  now `AgentVendor`/`AgentProvider` include `'goose'`, `normalizeAgentKind` has a symmetric goose case (→ attached),
  the server validates `vendor:'goose'`, the client sends `{transport,vendor,model}` and **requires** a model for
  goose (it's a harness over an OpenRouter model). **Live-proven:** real goose CLI 1.41.0 over OpenRouter attached
  over MCP and returned computed `17×23=391` / `31×19=589`. AgentTalk 401/401, client 86/86.

## What's next — BL-024 **T3b-2** (optional cleanup; not needed for goose to work)

T3b-2 = **drop the legacy `provider` *input* acceptance** from the server (`/api/agents` create/start, `/api/teams`)
and sweep recordings/UI/fixtures. It's the last cleanup of the conflated union; goose already works without it (the
orchestrator still accepts legacy `provider` as a deprecated input, mapped via `normalizeAgentKind`). **Do NOT delete
the `AgentProvider` type / `agent.provider` field** — after T2 it's a *serialization label* still read by recordings /
usage-capture / DTOs; only the *input acceptance* is dropped. Plan: `design/bl024-t3b-plan.md` §2 (T3b-2) + §4
(recordings compat — recommend a read-side shim). Leave `isUsageCaptureProvider` (`server.ts:~740`) alone — different
axis. If no other BL is assigned, report this and wait for the PO.

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
