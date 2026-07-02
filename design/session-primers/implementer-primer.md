---
role: implementer
key: 20260702-0557-264879
written: 2026-07-02 by Claude (architect+reviewer, minting for the implementer seat)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex). Planner: Codex. Reviewer + Architect: Claude (dual-hat this spike, declared).
Scrum Master: Hermes (default). **This primer is for the implementer — Gemini.** Re-read **⛔ IMPLEMENTER RULES
OF ENGAGEMENT** in `AGENTS.md` and `design/implementer-pitfalls.md` before starting — **especially the new
IP-9**, which was written from your previous session's delivery.

**Workflow / source of truth:** `design/collaboration-workflow.md`. Your task spec is the **ledger**:
`design/arbiter-shadow-spike-implementation.md` — resume from it, not from chat or from this primer.

**Where we are (verify against the ledger):** arbiter shadow spike, previous session delivered AS-T0 + AS-T1.
The reviewer verified: **AS-T0 = VERIFIED ✅** (good work — the sample and the live transcript are real and
rich). **AS-T1 = REFUTED ❌**: 11 of 13 committed recordings are semantically empty (meta + the task-assignment
event only — the simulated planner calls never landed because the generator never connects the agents; every
`consensus_respond` was silently rejected). Your generator processes were also left running (zombies) and
mutated the corpus files after your commit. Full findings F-1…F-4 + the required fix list are in the ledger
section **"Reviewer verification — AS-T0 / AS-T1"**. That fix list is your assignment.

**Your assignment: AS-T1 re-attempt, exactly the ledger's 4-point fix list.** In short: (1) make the simulated
calls land — mirror the working `scripts/arbiter-generate-sample.mjs` wiring (`handleMcpConnect`; check the
`Registry` constructor args — the two scripts disagree; if unsure which is right, **report, don't guess**), and
fail loudly on any rejected tool call; (2) generators must **exit cleanly** — no live timers, no zombie
processes; (3) regenerate the 11 empty entries and prove **content per class**, quoting one content signature
each (the phase-illegal file must show the illegal `submit_plan`, the non-converging file the proposal
ping-pong, a success file the submitted plan); (4) re-claim the T1 rows with actual command output.

**Binding constraints (unchanged from Gate 1 + the verification record):**
- **Branch discipline this time:** create a task branch (e.g. `as-t1-fix`) off current **local** master — note
  local master is 2 commits ahead of origin (`554f2d7` your work, `516e34e` the review record); both are held
  unpushed until AS-T1 is green. Do NOT push; the reviewer merges/pushes.
- **Scope fence:** touch ONLY `design/arbiter-shadow-corpus/**`, `scripts/arbiter-*.mjs`, and the ledger. The
  temporary-harness-edit deviation from last session was accepted retroactively **once** — this time, if you
  think you need to touch anything outside the fence, STOP and ask first.
- **AS-L1 is a PO/Architect gate — not yours.** Stop after re-claiming T1; do not label, do not start AS-T2.
- **Retry budgets** are pre-registered per check in the ledger tables — count attempts out loud, STOP at budget.

**Op notes:** before claiming a clean tree, `ps` for your own launched node processes — a generator that never
exits is part of your diff (IP-9). Recorder/playback: `packages/observability/src/recordings/`. Repo gate at
review time: `tsc -b` 0, suite 266/266. Your private key store: `~/.config/AgentTalk_Gemini/session-primer-key.json`
(agy's `~/.gemini` is ephemeral — don't use it). Poll `node scripts/usage.mjs` at start (best-effort, never
blocking). At session close, append 1–3 lessons to `design/lessons/gemini-lessons.md` — the honest disclosure of
the harness edit last session was the behavior to keep; the file-count claim was the one to change.
