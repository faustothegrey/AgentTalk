# Bite 0 — Autonomous launch + capped run of a single agent — PLAN

**Author:** Claude (planner hat, resource fallback) · **Date:** 2026-07-15 (naming corrected 2026-07-16) · **Status:** DRAFT — pre Gate 1
**Thread:** the autonomous-development ladder (Bite 0 → 1 → 2 …). Bite 0 is the smallest real increment of autonomy.
**Depends on:** BL-037 (launcher, merged). **Sibling, off critical path:** BL-038 (Goose/OpenRouter native-loop).

---

## 0. Naming — two layers, don't conflate them (corrected with the PO, 2026-07-16)
- **The (AgentTalk) launcher** — *deterministic* config-driven software. Reads a config file and starts the
  AgentTalk instance + all declared agents; enforces the cap; emits the end-of-run report. **No semantic
  inference.** Its full input is the config; it is **not** briefed and holds **no** scrum role. **This is Bite 0.**
- **Hermes** — a *real agent instance* (a later layer, **NOT in Bite 0**) that will autonomously *invoke* the
  launcher and *monitor* a live session. Being an agent, it is briefable — but it is deferred until a later bite.

## 1. Goal (one sentence)
The PO declares `{goal, team composition}` in one action (a **config file**); the **deterministic launcher** starts
the agent, enforces a machine-enforced resource cap, lets it run to done-or-fail, and reports the outcome to the PO.
**No human touches launch or the cap.**

## 2. Division of labor (settled with the PO, 2026-07-15/16)
| PO (human) | The (AgentTalk) launcher — deterministic, no inference, no scrum role | Worker |
|---|---|---|
| set `{goal, composition}` (by providing the **config file**) | read the config and start the AgentTalk instance | do the one bounded task |
| gate the outcome | launch **every agent the config declares** (via the BL-037 launcher mechanism) | (attaches, pulls its turn, works) |
| receive the end-of-run report | enforce the resource cap off the **existing meter** (`127.0.0.1:9899`) | |
|  | on **done/finished only**, emit the outcome report to the PO | |

*Deferred (not Bite 0):* **Hermes**, the agent that will later *invoke* the launcher and *monitor* a live session.

## 3. Scope
**In scope — build (minimal):**
- **The AgentTalk launcher** (deterministic software — *not* an LLM, *not* on tmux; on the WS/MCP substrate). It
  reads a **config file** and, with **no semantic inference**: (a) starts the AgentTalk instance; (b) launches
  **every agent the config declares** via the BL-037 launcher mechanism (Bite 0: exactly one); (c) delivers the
  config's `goal` as the worker's first turn; (d) enforces the config's `cap`; (e) on completion/breach stops the
  agent(s), reads the outcome, and reports to the PO; then exits.
- **The config file** — declares instance settings, the **team** (`agents[]`: provider/role), the `goal`, and the
  `cap`. This is where the PO expresses `{goal, composition}` (the PO decision); the launcher only *executes* it.

**In scope — reuse (build nothing new):**
- the **BL-037 launcher** for the spawn; **`await_turn`/turn delivery** for the goal; the **resource meter**
  (`/usage`+`/tokens`, `scripts/usage.mjs`) for cap monitoring; the **NDJSON session recorder** for the run artifact.

**Out of scope (later bites / other backlog):** **Hermes the agent** (a later layer) · more than one agent · any
inter-agent messaging · any LLM decision-making in the launch/cap layer · autonomous wake (BL-028) · consent
relaxation · Goose/OpenRouter (BL-038) · fixing the dead idle-timeout up front (we *observe* the hang here, then
build detection — LB-70/BL-028).

## 4. The bound (the anti-loop safety contract — load-bearing)
Every Bite-0 run carries a **machine-enforced cap**, enforced **deterministically by the launcher/runtime** (not an
agent), tripping on the *earliest* of:
- **wall-clock timeout** (default: 10 min), and
- **resource ceiling** read from the existing meter (default: session %-delta ≥ 5%), and
- optionally a **turn cap** (Bite 0 is effectively single-turn, so wall-clock + resource is the primary rail).

On breach → the launcher **terminates the worker** (`DELETE /agents/:id`), marks the run **FAILED (capped)**, and
reports. The PO can **interrupt at any time**. With one agent and no messaging, a runaway loop is structurally
impossible; the cap bounds a *hang*. **This run is also our first fault-tolerance probe** — we watch what a real
hang looks like under supervision to seed later detection. Keeping the cap **deterministic** (not an agent's
judgment) is what makes the safety rail trustworthy.

**Blast-radius sandbox (PO mandate, 2026-07-16).** The worker runs in a **per-task git worktree** (assigned via the
launcher's `workdir`); its file changes are contained to its own branch and **cannot reach mainline except by a
PO-gated merge** — an agent cannot touch the primary checkout or `master`. This is the security boundary for
autonomous code work. Discipline detail: **BL-036**.

## 5. Deliverables & Definition of Done (each row must be *verified by running it*)
| # | Deliverable | DoD (verifiable) |
|---|---|---|
| D1 | The launcher reads the config and deterministically starts the instance + all declared agents (Bite 0: one) via the BL-037 launcher | run it: instance up + worker attached, driven only by the config; no human ran a shell command; no semantic inference |
| D2 | Goal delivered as the worker's first turn | worker receives `goal` via `await_turn`; recorded |
| D3 | Cap machine-enforced off the existing meter + wall-clock | a deliberately-overrunning task is **auto-terminated at the cap**; run marked FAILED (capped) |
| D4 | Happy path: worker completes the bounded task, the launcher detects done | a trivial real task runs to completion; the launcher sees "done" |
| D5 | End-of-run report to the PO (done/finished only, not mid-flight) | PO receives outcome (success/failure + result + cap usage); nothing reported mid-run |
| D6 | Run artifact captured | NDJSON recording of the run exists for post-hoc observation |
| D7 | Behavior preserved | orchestrator core, BL-037 launcher, existing suites unchanged/green; the new launcher is additive |

## 6. Validation
An **E2E** on the pattern already proven for the BL-037 launcher: real launcher → real orchestrator instance →
real BL-037 spawn → real worker attach → drive to (a) completion and (b) forced cap-breach, asserting D3/D4/D5.
Provider CLI may be stubbed via the fake-bridge technique where an authed CLI is unavailable; a real Claude worker
run is the acceptance demo the PO babysits.

## 7. Open design choices for Gate 1 / PO (defaults chosen, PO 2026-07-16)
1. **Launcher placement** — new `apps/launcher/` service vs a `scripts/launcher.mjs` runner. *Default:* a small
   `scripts/` runner for Bite 0, promote to a service later.
2. **Cap units & defaults** — *Default:* wall-clock 10 min **or** session-meter %-delta ≥ 5%, whichever trips first.
3. **PO report channel** — *Default:* the UI + the NDJSON artifact, plus a written end-of-run summary.
4. **RESOLVED (PO, 2026-07-15):** the launcher **starts** the instance and **all declared agents** deterministically
   from a **config file** — no semantic inference. Config schema (freeze at Gate 1): `instance` settings ·
   `agents[]` {provider, role} · `goal` · `cap`.

## 8. Roles under current availability (Codex + agy unavailable, 2026-07-15)
Planner + Plan Reviewer + Implementer + Implementation Reviewer + Task-end Reviewer all collapse onto **Claude**
(resource fallback, each hat declared, each gate's discipline kept separate); **merge stays PO-gated**. An
independent reviewer via BL-038 (Goose/OpenRouter) would restore real gate independence once built.

## 9. Governance note
- **The launcher** is deterministic infra — a script, **not** an actor: it holds **no scrum role, no authority, no
  tag**, and needs no briefing (its full input is the config). Nothing to record in the role map for it.
- **Hermes stays RETIRED from the scrum process** (AGENT.md) — that retirement **stands**. Hermes will **return in a
  later bite as a distinct *agent* layer** (invokes the launcher, monitors a live session, reports) — briefable, but
  still **not** a scrum-authority role. Its role is specced/governed when that bite arrives, **not** in Bite 0.
- Separate cleanup (unrelated to Bite 0): the stale `/api/hermes/*` tmux-heartbeat endpoints in `server.ts` should
  be retired or repurposed — tracked independently, not part of this plan.
