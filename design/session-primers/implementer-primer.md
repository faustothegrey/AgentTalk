---
role: implementer
key: none
written: 2026-07-02 by Hermes (SM)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp × gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex — scope, direction, role assignment, merges). Planner: Codex. Reviewer + Architect: Claude (dual-hat this spike). Scrum Master: Hermes (default; `[Hermes]` messages bind on operational matters). **This primer is for the implementer — Gemini.**

**Workflow / source of truth:** `design/collaboration-workflow.md` + the ⛔ Implementer Rules of Engagement in `AGENT.md` (read them before starting; skim `design/implementer-pitfalls.md`). The AS-L1 gate was recorded (commit `990f593`); the AS-T2 judge script was verified and merged. Resume from the ledger: `design/arbiter-shadow-spike-implementation.md`.

**Active epic/task: the Arbiter Shadow Spike (BL-009, `doing`). Your assignment is AS-T3 — the cadence/cost scoring run. You are UNBLOCKED:** the judge script (`scripts/arbiter-shadow-judge.mjs`) and golden labels (`design/arbiter-shadow-corpus/labels.json`) are on master. The mock path works; the real LLM path is statically consistent but has never executed live.

**The spec is the ledger's AS-T3 section** (intent, approved work, DoD claims T3-C1…C5, pre-registered retry budgets). The short shape: run the scoreable corpus through the judge at each cadence, produce result rows under `design/arbiter-shadow-corpus/results/`, and append a results table to the ledger.

**CRITICAL OP NOTE — GEMINI_API_KEY.** The judge's real LLM path uses `@agenttalk/llm-client` which reads `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) from the environment. This was the blocker in AS-T2: the key was not exported in the CLI environment, so the real call returned 401, and the PO overruled the constraint. For AS-T3, the real call IS the task — without it, T3-C5 says the spike defaults to PARK. **Ensure GEMINI_API_KEY is exported before running the full matrix.** If it's still unavailable, report that as a BLOCKED finding.

**DoD claims:**
| Claim | Required evidence |
|---|---|
| T3-C1 | Score run includes every scoreable labeled corpus entry, or excludes entries with explicit reasons. |
| T3-C2 | Results table reports agreement rate on success/current-machine-right entries. |
| T3-C3 | Results table reports recovery judgment on failure classes, including which classes were not covered. |
| T3-C4 | Results table reports latency and token/cost fields per cadence, with unavailable fields marked honestly. |
| T3-C5 | If results are plausible-only without reproducible numbers, recommendation path is PARK. |

**Hands-off surfaces:** `labels.json` is the PO/Architect answer key — read only. Same for `manifest.json`, the `.jsonl` recordings. Work on a task branch (e.g. `as-t3`); the reviewer merges.

**Op notes:**
- Recording payload shapes differ: deterministic corpus wraps task as `.payload.task.transcript`, but live-success-1 has it at `.payload.transcript`. The judge already handles both — do not "fix" the files.
- `sample-success` has one literal `null` opinion payload; `live-success-1` terminates `refused` (worker refusal out-of-frame — golden verdict is `converged`). Both are deliberate; do not fix.
- The committed mock result rows under `results/` must not be globbed as real measurements by the scorer.
- Budget fence for AS-T3: one full corpus run, plus one focused rerun per failed row (max 2).

**Where state lives:** the ledger's claim/verdict table; corpus + labels in `design/arbiter-shadow-corpus/`.

**Your private key store** is `~/.config/AgentTalk_Gemini/session-primer-key.json` (agy's `~/.gemini` is ephemeral — don't use it). Poll `node scripts/usage.mjs` at start (best-effort, never blocking) and skim `design/lessons/gemini-lessons.md`.
