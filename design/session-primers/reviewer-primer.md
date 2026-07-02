---
role: reviewer
key: none
written: 2026-07-02 by Claude (reviewer + architect, session close)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex — scope, direction, role assignment, merges). Planner: Codex. **This primer is for
the reviewer (expected: Claude), who ALSO holds the architect seat for the arbiter program** (PO-assigned at
inception; the architect has no primer file by design — this primer carries both hats' state; declare both
loudly at startup). Implementer: Gemini. Scrum Master: Hermes (default). Planner ≠ reviewer holds.

**Workflow / source of truth:** `design/collaboration-workflow.md`. Live state: the spike ledger
`design/arbiter-shadow-spike-implementation.md` — resume from it, not from chat. Plan (goal/fence/DoD):
`design/arbiter-shadow-spike-plan.md`. Direction: `design/arbiter-consensus-draft.md` (§10 = the synthesis).

**Active epic/task: the arbiter shadow spike (BL-009, `doing`).** AS-T0 and AS-T1 are **VERIFIED ✅ and merged
to master** (pushed through `fbf9994`; three review rounds — the round-1 refutation, round-2 partial, and
round-3 verification records are all in the ledger; IP-9 was minted from round 1). **NEXT: AS-L1, the golden
labeling gate — PO + Architect author labels; the implementer may NOT.** Two things happen there:
1. **L1-C3 decision first:** the scoreable corpus is **6 success / 3 failure classes (phase-illegal ·
   bounded-correction · non-converging) / 2 ambiguous**; late-message + malformed are **EXCLUDED per finding
   F-5** (soft-rejected actions are invisible in recordings — itself program-level input for Epic 1). PO +
   Architect must explicitly accept this thinness or stop the spike. Architect lean at close: accept.
2. Then label: fill `design/arbiter-shadow-corpus/manifest.json` entries (schema:
   `labels.schema.json` — verdict/rationale/confidence/notes/author) for every non-excluded entry.
After AS-L1 is recorded, re-key the **implementer primer** for AS-T2 (shadow judge script; spec in the ledger;
one real LLM call max before AS-T3 per Gate 1 Q3).

**Where state lives:** the ledger's claim/verdict table + the round records; corpus in
`design/arbiter-shadow-corpus/`; backlog dashboard via `GET /api/backlog`.

**Op notes:**
- **Backlog was redefined by the PO (2026-07-02)** — 4 states only (`todo·doing·done·dropped`), file order =
  sequence, loud definition in workflow §3b; API default view = doing+todo (`?all=true` for all). Don't use the
  old vocabulary. BL-002's absorb question re-raises at the Epic 1 gate, not before.
- Repo gate at close: `tsc -b` 0, suite **268/268**, `backlog:check` green, master in sync with origin,
  worktrees/processes clean.
- Review discipline for this spike (learned rounds 1–3): verify **content signatures** (parse the transcript
  payloads — payload shape is `{task:{…}}`), never file counts; `ps` + `git worktree list` are part of EVERY
  hygiene pass; corpus regeneration is deterministic via `node scripts/arbiter-generate-corpus.mjs`.
- Budget at close: claude weekly 5% used (fresh week), session 50%. Codex weekly 66%, gemini/antigravity fine.
