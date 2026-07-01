---
role: implementer
key: 20260701-2302-6562ab
written: 2026-07-01 by Claude (architect+reviewer, minting for the implementer seat)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex). Planner: Codex. Reviewer + Architect: Claude (dual-hat this spike, declared).
Scrum Master: Hermes (default). **This primer is for the implementer — Gemini, the live default.** Before
anything else, re-read **⛔ IMPLEMENTER RULES OF ENGAGEMENT** in `AGENTS.md` and skim
`design/implementer-pitfalls.md` — they are your law and case law for every task below.

**Workflow / source of truth:** `design/collaboration-workflow.md`. Your task spec is the **ledger**:
`design/arbiter-shadow-spike-implementation.md` — resume from it, not from chat. Plan (goal/fence/DoD bar):
`design/arbiter-shadow-spike-plan.md`. Direction context (read once, don't re-litigate):
`design/arbiter-consensus-draft.md`.

**Where we are:** the **arbiter shadow spike is OPEN** (PO go 2026-07-01) and **Reviewer Gate 1 PASSED** — the
task breakdown is approved. **Your assignment: AS-T0 — corpus adequacy audit** (ledger §AS-T0): prove recorded
JSONL events carry the consensus evidence a semantic judge needs (goal, ordered turns, phase/protocol moments,
terminal outcome). Sequencing after that: AS-T1 (corpus + label schema), then AS-L1 is a **PO/Architect gate —
not yours**, then AS-T2/T3. Do NOT run ahead of a gate.

**Binding constraints for AS-T0 (from the Gate 1 record — read it in the ledger):**
- **T0-C2 evidence MUST be a real `SessionRecorder`-produced sample** — an in-process deterministic run with
  recording ON is preferred (no API burn). A hand-authored JSONL is NOT admissible for adequacy.
- **Scope fence (zero production change):** touch ONLY `design/arbiter-shadow-corpus/**`,
  `scripts/arbiter-*.mjs`, and the ledger. No edits to registry/coordinator/protocol/MCP surface/client repo or
  recording infra. If recordings lack needed semantic evidence, that is a **finding — STOP and report**, not a fix.
- **Retry budgets are pre-registered per check** in the ledger tables — count attempts out loud, STOP at budget.

**Op notes:** recording is opt-in via env `AGENTTALK_DIAGRAM_RECORD` (default OFF); recorder/playback live in
`packages/observability/src/recordings/` (`session-recorder.ts`, `playback.ts`, `npm run play-recording`).
Repo gate reference: `tsc -b` clean + full suite green at `master` (pushed through `efb67c2`); your scope audit
is `git diff --stat` against the fence above. Your private key store:
`~/.config/AgentTalk_Gemini/session-primer-key.json` (bootstrapped 2026-06-27; agy's own `~/.gemini` is
ephemeral — don't use it). At session start poll `node scripts/usage.mjs` (best-effort, never blocking) and
note your antigravity reading. At session close, append 1–3 lessons to `design/lessons/gemini-lessons.md`.
Claim entries in the ledger require actual command output — never a remembered summary.
