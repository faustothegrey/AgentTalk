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

**AgentTalk master `9c3c74d`** (pushed) — **+ an unpushed docs commit** with THIS primer + the T3a backlog record
+ lessons (verify via fetch; the PO may or may not have pushed it). **Client `agentalk-mcp-client` master `3612511`**
(pushed). No worktrees/branches of ours left (T2 + T3a cleaned up). PO's `.plist` shows modified — leave it. PO's
launchd svc — leave alone; stand up your own orchestrator on **3100** (`PORT=3100 npm run backend`).

**Shipped this session (all PO-gated, merged+pushed):**
- **BL-024 T2 CLOSED** (`8375387`) — the **frozen engine is now vendor-blind**: `getFactCollectionTimeoutMs` reads
  only `capabilities.factCollectionTimeoutMs` (team + members); no `provider`/`providerName === 'gemini'` sniff.
  Edge injects 720s for exactly the old-bump configs (incl. the `mcp`+`providerName:'gemini'` gap). IP-15 proof
  pins the ms and fails if the edge is reverted (manually verified). Suite 398/398.
- **BL-024 T3a CLOSED** (client `3612511`) — `agent-launcher` sends `{transport:'attached', vendor}` for
  gemini/claude/codex. **Server unchanged** (`activateAgent` re-derives from stored provider; `/api/agents` already
  accepts the new shape since T1). Client suite 85/85; live-checked against a real orchestrator.

## What's next — BL-024 **T3b** is BLOCKED on the goose spec (read this before planning it)

T3b = **drop the legacy `provider` acceptance** + retire/reduce the conflated `AgentProvider` union. **But it cannot
start yet.** T3a deliberately left **`goose` on the legacy `provider` path** — because the PO ruled (2026-07-18)
that *goose is a real vendor but its axis mapping is deferred ("not now, not needed to proceed")*. goose is in
**neither** `AgentVendor` (`gemini|claude|codex`) **nor** the legacy `AgentProvider` union, and AgentTalk has zero
goose handling. So:
- **You cannot remove legacy `provider` acceptance while goose is the sole remaining user of it.**
- **T3b's precondition is the goose-as-vendor spec:** add `'goose'` to `AgentVendor`; fix `normalizeAgentKind`'s
  reverse map (`transport+vendor → legacyProvider`) — today it forces an unknown vendor to opaque `'mcp'`, which
  would *change* goose's behaviour; extend server vendor-validation (`server.ts:~611`). THEN drop legacy + sweep
  fixtures/recordings. See `design/bl024-t3-plan.md` §7b for the ruling and §5 for the recordings-compat plan.
- **Also possibly latent:** a `provider:'goose'` create post-T1 maps to *no transport* → may already error at
  `registry.ts:293`. Nobody has verified goose end-to-end. Worth a read-only check when goose is picked up (the PO
  steered "not now").

**Do NOT plan T3b until the PO greenlights the goose spec.** If asked what's next and no other BL is assigned,
report this block and wait.

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
