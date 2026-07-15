# Bite 0 — Autonomous launch + capped run of a single agent — PLAN

**Author:** Claude (planner hat, resource fallback) · **Date:** 2026-07-15 · **Status:** DRAFT — pre Gate 1
**Thread:** the autonomous-development ladder (Bite 0 → 1 → 2 …). Bite 0 is the smallest real increment of autonomy.
**Depends on:** BL-037 (launcher, merged). **Sibling, off critical path:** BL-038 (Goose/OpenRouter native-loop).

---

## 1. Goal (one sentence)
The PO declares `{goal, team composition}` in one action; **Hermes** — an autonomous infra layer with no scrum
role — launches the agent, enforces a machine-enforced resource cap, lets it run to done-or-fail, and reports the
outcome to the PO. **No human touches launch or the cap.**

## 2. Division of labor (settled with the PO, 2026-07-15)
| PO (human) | Hermes (autonomous infra — no authority, no scrum role, no `[Hermes]` tag) | Worker |
|---|---|---|
| set `{goal, composition}` (by providing the **config file**) | run a **deterministic launch script** that reads the config and starts the AgentTalk instance | do the one bounded task |
| gate the outcome | launch **every agent the config declares** via the BL-037 launcher — **no semantic inference** | (attaches, pulls its turn, works) |
| receive the end-of-run report | enforce the resource cap off the **existing meter** (`127.0.0.1:9899`) | |
|  | on **done/finished only**, report outcome to the PO | |

## 3. Scope
**In scope — build (minimal):**
- **Hermes supervisor** (deterministic software — *not* an LLM, *not* on tmux; on the WS/MCP substrate). It runs a
  **launch script that reads a config file** and, with **no semantic inference**: (a) starts the AgentTalk instance;
  (b) launches **every agent the config declares** via the launcher (Bite 0: exactly one); (c) delivers the config's
  `goal` as the worker's first turn; (d) enforces the config's `cap`; (e) on completion/breach stops the agent(s),
  reads the outcome, and reports to the PO; then exits.
- **The config file** — declares instance settings, the **team** (`agents[]`: provider/role), the `goal`, and the
  `cap`. This is where the PO expresses `{goal, composition}` (the PO decision); Hermes only *executes* it.

**In scope — reuse (build nothing new):**
- the **launcher** (BL-037) for the spawn; **`await_turn`/turn delivery** for the goal; the **resource meter**
  (`/usage`+`/tokens`, `scripts/usage.mjs`) for cap monitoring; the **NDJSON session recorder** for the run artifact.

**Out of scope (later bites / other backlog):** more than one agent · any inter-agent messaging · LLM
decision-making inside Hermes · autonomous wake (BL-028) · consent relaxation · Goose/OpenRouter (BL-038) ·
fixing the dead idle-timeout up front (we *observe* the hang here, then build detection — LB-70/BL-028).

## 4. The bound (the anti-loop safety contract — load-bearing)
Every Bite-0 run carries a **machine-enforced cap**, enforced by Hermes, tripping on the *earliest* of:
- **wall-clock timeout** (proposed default: N minutes), and
- **resource ceiling** read from the existing meter (a session/weekly %-delta or token ceiling), and
- optionally a **turn cap** (Bite 0 is effectively single-turn, so wall-clock + resource is the primary rail).

On breach → Hermes **terminates the worker** (launcher `DELETE /agents/:id`), marks the run **FAILED (capped)**,
and reports. The PO can **interrupt at any time**. With one agent and no messaging, a runaway loop is structurally
impossible; the cap bounds a *hang*. **This run is also our first fault-tolerance probe** — we watch what a real
hang looks like under supervision to seed later detection.

**Blast-radius sandbox (PO mandate, 2026-07-16).** The worker runs in a **per-task git worktree** (assigned via the
launcher's `workdir`); its file changes are contained to its own branch and **cannot reach mainline except by a
PO-gated merge** — an agent cannot touch the primary checkout or `master`. This is the security boundary for
autonomous code work. Discipline detail: **BL-036**.

## 5. Deliverables & Definition of Done (each row must be *verified by running it*)
| # | Deliverable | DoD (verifiable) |
|---|---|---|
| D1 | Hermes runs the launch script that reads the config and deterministically starts the instance + all declared agents (Bite 0: one) via the launcher | run it: instance up + worker attached, driven only by the config; no human ran a shell command; no semantic inference |
| D2 | Goal delivered as the worker's first turn | worker receives `goal` via `await_turn`; recorded |
| D3 | Cap machine-enforced off the existing meter + wall-clock | a deliberately-overrunning task is **auto-terminated at the cap**; run marked FAILED (capped) |
| D4 | Happy path: worker completes the bounded task, Hermes detects done | a trivial real task runs to completion; Hermes sees "done" |
| D5 | End-of-run report to the PO (done/finished only, not mid-flight) | PO receives outcome (success/failure + result + cap usage) over a channel; nothing reported mid-run |
| D6 | Run artifact captured | NDJSON recording of the run exists for post-hoc observation |
| D7 | Behavior preserved | orchestrator core, launcher, existing suites unchanged/green; Hermes is additive |

## 6. Validation
An **E2E** on the pattern already proven for the launcher: real Hermes supervisor → real orchestrator instance →
real launcher spawn → real worker attach → drive to (a) completion and (b) forced cap-breach, asserting D3/D4/D5.
Provider CLI may be stubbed via the fake-bridge technique where an authed CLI is unavailable; a real Claude worker
run is the acceptance demo the PO babysits.

## 7. Open design choices for Gate 1 / PO
1. **Hermes placement** — new `apps/hermes/` supervisor vs a `scripts/hermes.mjs` runner (I lean: a small
   `apps/hermes` service in the main repo, since it supervises the orchestrator).
2. **Cap units & defaults** — wall-clock minutes + which meter figure (session-% delta vs token ceiling).
3. **PO report channel** — which of Hermes's "several channels" is used for the Bite-0 report (UI, file, notification…).
4. **RESOLVED (PO, 2026-07-15):** Hermes **starts** the instance and **all declared agents** deterministically from
   a **config file** — no semantic inference. New open item → **the config schema** (`instance` settings ·
   `agents[]` {provider, role} · `goal` · `cap`): propose + freeze at Gate 1.

## 8. Roles under current availability (Codex + agy unavailable, 2026-07-15)
Planner + Plan Reviewer + Implementer + Implementation Reviewer + Task-end Reviewer all collapse onto **Claude**
(resource fallback, each hat declared, each gate's discipline kept separate); **merge stays PO-gated**. An
independent reviewer via BL-038 (Goose/OpenRouter) would restore real gate independence once built.

## 9. Governance note (pending PO go)
AGENT.md records Hermes as *"RETIRED from the process entirely."* That process retirement **stands**. Bite 0
introduces a **separate, out-of-process infra role** for Hermes: **no authority, no baton, no `[Hermes]` tag** —
run instance / launch / cap / end-of-run report only. To be recorded in AGENT.md on PO confirmation; the stale
`/api/hermes/*` tmux-heartbeat endpoints to be retired or repurposed for the new Hermes monitoring.
