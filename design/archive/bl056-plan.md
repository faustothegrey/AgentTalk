# BL-056 — a past run must be RETRIEVABLE, not merely witnessable

**Status:** plan · **PO go:** pending (gate 1)
**Repo:** `AgentTalk` · **Branch:** `task-BL-056` (per-task worktree, per the 2026-07-16 mandate)
**Author/reviewer:** Claude, sole agent under the resource-scarcity fallback — **I author and review this
plan. The PO's read is the real gate.**

## The defect — verified live, 2026-07-17, not read off the filing

- **Probed, not assumed:** `/api/tasks`, `/api/teams/:id`, `/api/teams/:id/task`, `/api/teams/:id/tasks` **all
  404**. `GET /api/teams` (`server.ts:745`) is the only door, and it returns **no `currentTaskId` for any of the
  8 teams** the running orchestrator holds.
- **Witnessed in the UI:** `team-1784284016745` — a `planner-planner-worker` trio that ran **10:26:56 → 10:41:56
  (15 minutes)** and ended `interrupted` — renders as a team with nothing to show.
- **Consequence:** every one of today's 8 runs is unreviewable through the product.

## The correction that rewrites the design — READ THIS BEFORE THE FILING

The filing says completion *deletes* `team.currentTaskId`. **True** — five sites
(`team-coordinator.ts:1439, 1615, 1921, 1968`; `arbiter-coordinator.ts:510`). But the filing's *implication* —
that the run's output is therefore **lost** — is **false**, and the whole plan turns on this:

- **`private tasks: Map<string, TeamTask>` (`team-coordinator.ts:133`) is NEVER pruned.** No `.delete`, no
  `.clear`, anywhere in the registry.
- **`TeamTask` carries `teamId`** (`contracts/src/types.ts:50`), so a by-team lookup needs no new bookkeeping.
- **`getTask(taskId)` already exists** (`team-coordinator.ts:1550`).

**Every task and transcript from all 8 of today's teams is sitting in orchestrator memory right now.** The data
was never lost. **The pointer was.**

> `currentTaskId` answers **"what is this team doing *now*?"** The UI used it to answer **"what did this team
> *do*?"** Two different questions, one pointer — and completion correctly retires the first one.

**Therefore the deletion is not the bug and must not be touched.** A completed task genuinely is not *current*;
those five `delete` lines are right. The bug is that "current" was the *only* way to reach a task.

**This retires the show-stopper fence I raised with the PO.** I proposed adding a parallel retained record
alongside `currentTaskId`. That would have duplicated state the system already keeps, and bought a real
behaviour-change risk in the completion path for nothing. **The fix is purely additive: one read method, one
route, one fetch.** Read the code before designing the fix — the fence I was about to ask the PO to approve
existed only in my model of the system.

## What `a4d0cbe` earned before it was killed

The (now-deleted, stale) `ui-team-run-in-main` branch rendered `Team is assembled. No task has been given yet.`
for the interrupted 15-minute team — **a false statement**. Master never lies: it renders the panel only when a
task exists (`TeamSidebar.tsx:191`), and `App.tsx:282` says so deliberately ("showing one … is the same lie this
task exists to remove").

**Why that matters here:** the branch's author wrote a lie *by accident*, because **the data model cannot
distinguish "this team was never given a task" from "this team's task is unreachable."** Master dodges it only by
saying nothing at all. Anyone who improves that panel walks into the same trap. **Making the two states
distinguishable is a DoD row (D3), not a nicety** — it is the only durable fix for the class.

## Scope (Rule 6 declaration)

**May touch:**
- `packages/runtime-core/src/registry/team-coordinator.ts` — **ADD** `getTasksForTeam(teamId)`. Read-only, new
  method, no existing line modified.
- `apps/orchestrator/src/server.ts` — **ADD** `GET /api/teams/:id/tasks`.
- `apps/web/src/App.tsx` — fetch the active team's tasks on mount/reconnect.
- `apps/web/src/components/team/TeamSidebar.tsx` — render a retrieved task; truthful empty state.
- `packages/contracts/src/types.ts` — only if the response needs a type.
- corresponding tests.

**May NOT touch:**
- **The five `delete team.currentTaskId` sites** — live semantics, shared engine. Untouched, by design.
- `arbiter-coordinator.ts` beyond that read · `registry.ts:423` (reads `currentTaskId` for sender routing) ·
  consensus/protocol logic · the planning phases.
- Anything in the client repo.

## Design

1. **`getTasksForTeam(teamId): TeamTask[]`** — filter `this.tasks.values()` by `teamId`, ordered oldest→newest.
   Pure read over state that already exists.
2. **`GET /api/teams/:id/tasks`** — beside `GET /api/teams`:
   - unknown team → **404**
   - known team, never given a task → **200 `[]`**
   - known team with task(s) → **200 `[…]`**
   The `[]` vs `[task]` distinction **is** D3: it is what lets the UI say something true in the empty case.
3. **Web:** on `fetchTeams`, also fetch the active team's tasks; if `activeTeamTask` is null, populate from the
   newest retrieved task. `App.tsx:282`'s drop-on-mismatch stays — it is correct; it simply gains a way to
   *repopulate*, which is exactly what its own comment says is missing.
4. **`currentTaskId` untouched.** Live behaviour is byte-identical.

## Scope boundary — the PO decides, and I am not deciding it inside the implementation

**In-memory retention fixes the PAGE RELOAD** — the item's headline, and the bar it will be judged on. **It does
NOT survive an ORCHESTRATOR RESTART:** the Map is process memory. Today's 8 teams are visible only because the
process has been up since 09:56; `kill` it and they are gone for good.

If "review an agent-driven session after the fact" is meant to survive a restart, **that is persistence, not this
item** — the NDJSON recording is the durable artifact (BL-064 territory), and it holds lifecycle events, not
transcripts. **I propose BL-056 stops at page-reload and I file the durability half as a separate item.** Flagged
for the PO rather than folded in silently.

**Also observed, out of scope, filing suggestion only:** the `tasks` Map grows **unbounded** (never pruned). It is
what makes this fix cheap and it is a real leak on a long-lived orchestrator. Pre-existing; not this diff.

## Definition of Done

| # | Row | Bar |
|---|-----|-----|
| **D1** | `getTasksForTeam` returns a team's task **after completion/interruption** | unit, orchestrator suite |
| **D2** | `GET /api/teams/:id/tasks` → 200 + task after a completed run; **`[]`** for a team never given a task; **404** unknown team | integration, orchestrator suite |
| **D3** | "never had a task" is **distinguishable** from "has a task" at the API — the row `a4d0cbe` earned | integration |
| **D4** | **`currentTaskId` semantics unchanged** — full existing `team-coordinator` suite green; **zero diff** to the five delete sites (`git diff` proves it) | regression |
| **D5** | **Page reload after a run still shows the run's output** | **LIVE WITNESSED RUN** (LB-93) — PO watching, me driving Chrome |
| **D6** | The empty state tells the truth in both cases | live, same run |

**Every bar is mutation-checked per ASSERTION, not per test** — and each mutant is read before it is banked
(a `ReferenceError` red is not a bite red). D1–D4 are **orchestrator-side and fully automatable**: the majority
of this item never needed the LB-93 exemption. Only D5/D6 are UI.

## Gates

1. **Gate 1 (plan):** this doc. Author and reviewer are the same actor — **the PO's read is the real gate.**
2. **Gate 2 (implementation):** per-delivery verdict rows, run-not-read.
3. **Gate 3 (task-end):** independent closure sweep (incl. `scripts/check-orchestrator-ports.mjs`, BL-023's
   new eyes), telemetry block, **merge is PO-gated.**

**Prerequisite before implementation:** kill `ui-team-run-in-main` — it rewrites `TeamView.tsx`/`App.tsx`, this
item's blast radius. That stops the PO's live orchestrator (60907) and vite (60972) and **drops the three
attached gemini workers**; the instance gets restarted from master afterwards. PO-timed.
