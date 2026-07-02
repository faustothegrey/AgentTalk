---
role: implementer
key: 20260702-0808-as-t2-arm
written: 2026-07-02 by Claude (architect; body only — the Scrum Master (Hermes) mints the fresh key to arm this primer)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex — scope, direction, role assignment, merges). Planner: Codex. Reviewer + Architect:
Claude (dual-hat this spike). Scrum Master: Hermes (default; `[Hermes]` messages bind on operational matters).
**This primer is for the implementer — Gemini.**

**Workflow / source of truth:** `design/collaboration-workflow.md` + the ⛔ Implementer Rules of Engagement in
`AGENT.md` (read them before touching anything; skim `design/implementer-pitfalls.md` too — IP-9 is yours).
Your task spec is the **ledger**: `design/arbiter-shadow-spike-implementation.md` — resume from it, not from
chat or this primer.

**Active epic/task: the Arbiter Shadow Spike (BL-009, `doing`). Your assignment is AS-T2 — the shadow arbiter
judge script. You are UNBLOCKED:** AS-L1 (the golden labeling gate) was recorded 2026-07-02 (commit `990f593`) —
PO + Architect authored golden labels for all 11 scoreable corpus entries and explicitly accepted the F-5
thinness (2 classes excluded). Read the **AS-L1 Gate Record** section of the ledger before starting: it states
the judge frame (the arbiter judges the *consensus process only*) and the verdict rationale you are building
the judge to be graded against.

**The spec is the ledger's AS-T2 section** (intent, approved work, DoD claims T2-C1…C5, pre-registered retry
budgets). The short shape: add `scripts/arbiter-shadow-judge.mjs`, replay/offline only (no production import
path), use `@agenttalk/llm-client`, support readiness-triggered cadence + at least one baseline cadence, emit
result rows under `design/arbiter-shadow-corpus/results/`. **Budget fence (Gate 1 Q3): at most ONE real LLM
call before AS-T3** — exercise the mock/dry path for everything else. Report missing token/cost fields as
unavailable, never guessed (T2-C5).

**Hands-off surfaces:** `design/arbiter-shadow-corpus/labels.json` is the PO/Architect answer key — you read
it, you never edit it. Same for `manifest.json`, the `.jsonl` recordings, and everything the spike fence
already bars (production code, recorder, protocol). Work on a task branch (e.g. `as-t2`); the reviewer merges.

**Where state lives:** the ledger's claim/verdict table + the AS-L1 gate record; corpus + labels in
`design/arbiter-shadow-corpus/`; scoring conventions for the ambiguous pair are stated in the label `notes`.

**Op notes:**
- **Recording payload shapes DIFFER by source** (a real gotcha, verified during labeling): the deterministic
  corpus wraps the task as `.payload.task.transcript`, but `live-success-1.jsonl` (live-gate recording) has the
  task object directly at `.payload.transcript`. Your replay loader must handle both — don't "fix" the files.
- Two entries carry known blemishes, deliberately left as-is (see AS-L1 gate record): `sample-success` has one
  literal `null` opinion payload; `live-success-1` terminates `refused` (worker refusal is out of the judge's
  frame — golden verdict is still `converged`).
- Your private key store is `~/.config/AgentTalk_Gemini/session-primer-key.json` (agy's `~/.gemini` is
  ephemeral — don't use it). Poll `node scripts/usage.mjs` at start (best-effort, never blocking) and skim
  `design/lessons/gemini-lessons.md`.
