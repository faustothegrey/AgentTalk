# Spike — make the Web UI reactive to EXTERNAL (API-driven) events

**Author:** Claude (temp implementer, resource fallback) · **Date:** 2026-07-16
**Status:** ✅ BUILT & MERGED (`d4ac001`, 2026-07-16) — PO-witnessed live validation.

> ⚠️ **Read this before trusting the plan below — the live run refuted it twice.**
> 1. **§Proposed fix step 1 is WRONG.** Emitting from `registry.createAgent()` ships `provider`/`model` as
>    `undefined`: `POST /api/agents` assigns them *after* `createAgent()` returns, the registry emits
>    `provider`/`model` only from `activateAgent()`, and the frontend has no case for either. The broadcast went
>    into the route (where the data is complete); `registry.ts` was never touched.
> 2. **§Proposed fix steps 1–2 were NOT sufficient.** The launcher creates its worker ~100ms after the
>    orchestrator is ready while the UI's socket retries every 2s → `agent_added` reached **zero clients**, and the
>    whole `creating→starting→ready` burst fell in the same window, so the unknown-id refetch had no event to fire
>    on. The suite was **324/324 with the bug still live**. The fix that actually worked: **`fetchAgents()` on the
>    WebSocket's `onOpen`** — resync on every (re)connect rather than trusting no event was missed.
> 3. **§Validation was too weak as written.** "See the agent appear" cannot distinguish the broadcast from a page
>    remount. The decisive test was watching a **stale agent disappear** on reconnect: `agent_added` can only add,
>    so only a real refetch could remove it.
> 4. **Point 3 (audit) done:** standalone team/task rendering already works — no live view needed. But teams carry
>    the identical reconnect hole and have **no client-side list call at all** → **BL-049**.
>
> Also shipped (PO-requested, same branch): a server-initiated WS **keepalive** + a live connection indicator.
> There was no ping/pong anywhere, so a half-open socket would have kept the new indicator green over a dead
> backend — the keepalive is what makes it honest, not a nice-to-have.
>
> The sections below are preserved as the original scoping, not as instructions.
**Motivation:** the BL-040 D4 babysat run (and every future autonomous/launcher-driven test) creates agents,
teams and tasks **outside the UI** — via the API / the (AgentTalk) launcher, not by a human clicking in the web
app. The PO needs to **witness** these runs live in the UI. Today the UI shows **nothing** for externally-created
entities. This spike finds why and scopes the minimal fix.

## Finding (grounded in code, 2026-07-16)

The live-event plumbing **mostly already exists** — the gap is narrow:

- **UI WebSocket exists.** Backend serves `/ws` (`apps/orchestrator/src/server.ts:831`) with a `broadcast()` fan-out
  (`server.ts:1054`). Frontend subscribes via `useWebSocket` (`apps/web/src/hooks/useWebSocket.ts`, wired in
  `App.tsx:249` → `handleWsMessage`).
- **Most lifecycle events ARE broadcast + handled.** `registry.on('status'|'team'|'team_task'|'session_status'|…)`
  → `broadcast({type:'status'|'team_updated'|'team_task_updated'|…})` (`server.ts:1066–1165`); the frontend handles
  `status`, `team_updated`(→`setActiveTeam`), `team_task_updated`(→`setActiveTeamTask`), etc. (`App.tsx:199–243`).

**THE HOLE — agent creation is never pushed to the UI:**
1. **Backend:** creating an agent only does `recorder?.record('runtime','agent_created', …)` (`server.ts:609`). The
   registry emits `status`/`execution_mode`/`session_status`/`provider`/`model` on *state changes* but **never emits
   an `agent_registered`/`agent_created` event**, and the server **never broadcasts** "a new agent exists."
2. **Frontend:** the agent list is filled by `api.agents.list()` on mount / after a UI-initiated create
   (`App.tsx:315,333`). The WS path only calls `updateAgentStatus(message.id, …)` for `status` events — which
   updates an **already-present** agent. A `status` event for an agent the list has never seen has **no matching
   entry → nothing renders.**

**Net:** an agent created via API *after* page load is invisible; its later `status`/team events have no row to
attach to. (Teams/tasks broadcast fine but set only the *active* entity — verify they render when the human never
opened that team through the UI.)

## Proposed minimal fix (the spike)

1. **Backend — emit + broadcast agent creation.**
   - `registry.ts`: emit `this.emit('agent_registered', <agentSummary>)` when an agent is created/activated (mirror
     the existing `this.emit('status', …)` at `registry.ts:206`).
   - `server.ts`: `registry.on('agent_registered', (agent) => broadcast({ type: 'agent_added', agent }))` (mirror the
     `status` wiring at `server.ts:1073`).
2. **Frontend — add unknown agents to the list.**
   - `App.tsx handleWsMessage`: `case 'agent_added': addAgent(message.agent); break;`
   - `hooks/useAgents.ts`: add an `addAgent` (idempotent upsert by id).
   - Defensive: on a `status` event for an **unknown** id, trigger a `fetchAgents()` refetch (covers races / missed
     events).
3. **Audit teams/tasks rendering** for externally-created entities: confirm `team_updated`→`setActiveTeam` and
   `team_task_updated`→`setActiveTeamTask` surface a team the human never opened (may need to auto-select the active
   team, or a "live runs" panel). If they don't render standalone, add a minimal live view.

## Validation (repeat the BL-040 D4 flow with the UI open)

With the UI open: launch a worker via the launcher / API, create a worker-only team, `assignTask`. Expect to SEE,
live, with no refresh: the agent row appear → `status` transitions (ready→busy→ready) → team `delegated → in_progress
→ completed` → the worker's `work_accept` text. This is exactly the run recorded in `/tmp/att-sandbox/session.ndjson`
during the 2026-07-16 babysat probe (worker answered correctly; see the BL-040 findings).

## Scope / non-goals

Spike = prove the reactive path for **agents + teams + tasks** end-to-end with an externally-driven run. NOT in
scope: full UI redesign, a dedicated "autonomous runs" dashboard (a good *follow-up*), auth, or historical replay.
Keep the diff minimal and additive; preserve all existing UI behavior (M06 rules). Do it in a **per-task git
worktree** (worktree mandate) since it touches `apps/web` + orchestrator code.

## Files in play
- `packages/runtime-core/src/registry/registry.ts` — emit `agent_registered`
- `apps/orchestrator/src/server.ts` — `registry.on('agent_registered')` → `broadcast({type:'agent_added'})`
- `apps/web/src/App.tsx` — `handleWsMessage` `case 'agent_added'` (+ unknown-id refetch)
- `apps/web/src/hooks/useAgents.ts` — `addAgent` upsert
