---
role: reviewer
key: 20260702-2232-45dc83
written: 2026-07-02 by Claude (reviewer + architect, session close)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto = PO (apex; batoned manually via terminal through M15 — whether that interim persists is
his call now M15 is closed). **Codex = Planner + Scrum Master** (dual, declared; `[Codex]` binds
operationally, `[Human]` for PO-level acts). Gemini/agy = implementer. **Hermes is OUT** — `[Hermes]`
carries no authority. This primer is for the **reviewer** — default Claude, who also held the **architect**
seat for the arbiter program (dual-hat, declare all hats you hold).

**Workflow / source of truth:** `design/collaboration-workflow.md` + the ⛔ Reviewer Rules in `AGENT.md`.
Backlog via `npm run backlog:check`. Distrust this primer: verify against ledger/plan/git before repeating.

**Where we are (verify):** **M15 — Arbiter Consensus, Direct Path is CLOSED — merged & pushed 2026-07-02**
(epic commits through `fdbd766` on origin/master; BL-012 done; ledger
`design/milestone15-arbiter-consensus-implementation.md`). Suite **275/275** + M14 identity harness green at
close; protocol path stays frozen. **No item is `doing`** — the next epic is a PO/SM backlog-gate call
(candidates live in `design/backlog.md` Todo). Expect no gate-ready work until the SM batons you.

**What M15 closure looked like (context for future gates):** T1/T2 implemented by Gemini, reviewed by Codex
(PO-appointed implementation reviewer; T1 VERIFIED by PO override over hygiene annotations). T3 closed by
Codex as temporary implementer+reviewer (full self-review, PO-requested); the PO then asked Claude for an
independent pass, which caught a real work-routing regression (composition guard missing at
`registry.ts:473/485` — repro: arbiter-opted worker-only team crashes on `submit_work_response`). Codex
conceded, fixed, added a regression test; Claude re-verified (repro flipped to pass) before the merge go.
**Lesson standing: PO-requested independent passes after self-review closures earn their cost — ask for one
if a future closure is self-reviewed.**

**Op notes (hard-won — details in LB-49/LB-50/LB-51/LB-52 and the M15 ledger):**
- **Freeze bar for anything touching runtime:** `npm test` (275/275 at close) AND
  `node scripts/m14-identity-harness.mjs --check` green; zero `team-coordinator.ts` diff (also watch for
  `as any` pokes into its private state — Gemini smuggled one in T3; no file diff shows it).
- **Known accepted defect:** every identity-harness run leaks one worktree + `task-task-*` branch. **Run
  `git worktree list` + `git branch --list 'task-*'` after every gate round and clean** (three leaks cleaned
  on 2026-07-02 alone).
- Poll `node scripts/usage.mjs` at start (best-effort, never blocking; Claude weekly was ~30% at close,
  resets Jul 8 ~09:00; Codex weekly 84% — Codex is the scarce resource this week).
- Skim `design/lessons/claude-lessons.md` at start; your key store:
  `~/.claude/projects/<slug>/session-primer-key.json`.
