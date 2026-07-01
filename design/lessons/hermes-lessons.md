# Lessons learned — Hermes (role: Scrum Master delegate)

**What this is.** Hermes's own append-only, dated record of lessons that sharpen its effectiveness over time —
**self-authored, per-agent** ("each its own"). Written at **session close** (when you write the Session Primer, or
otherwise wrap a working session); **skimmed at session start** so it actually compounds (write-only rots).

**Discipline.** Brief — **1–3 bullets per entry** (what worked / what didn't / what I'll do differently). Append-only,
newest at the bottom. This is *self-reflection on how I work* — distinct from `logbook.md` (shared cross-cutting
**facts**) and `implementer-pitfalls.md` (reviewer-authored case law about the **implementer**). **Only Hermes writes
here.**

**Format:** `### YYYY-MM-DD — <one-line theme>` then 1–3 bullets.

---

|2026-06-30|Session start: poll usage meter first. SP1 spike complete, recommendation DROP/DEFER. Next: M11-T1 (single tool, origin: M10-T3). Worked as SM: backlog gate sweep, M11 epic opened, planner→reviewer→implementer cycle. One lesson: never wait passively for agent output — poll proactively and report findings as soon as they're ready. Second lesson: never mention process/CLI/tmux details in responses — only substance (task, findings, review, decisions).|

### 2026-06-30 — Relay discipline: point to artifacts, don't restate
- When relaying instructions between agents, point to the artifact that already has the content (task breakdown, plan, ledger) instead of duplicating it in the message. Keeps messages lean and artifacts the single source of truth.

### 2026-06-30 — Session close: M11-T1 complete, full cycle SM run
- First full 3-agent cycle as SM (Hermes orchestrates): codex plans → codex reviews gate 1 → agy implements → codex reviews gate 2 → human merges. Worked well: copilot advisory on first message, relay via pointers, proactive polling.
- Vocabulary rule added to AGENT.md: 'spawn' → 'launch' is now a hard naming convention.
- Naming convention §3e adopted and applied across M10/M11 docs. Next session pick up backlog deferred items.

### 2026-07-01 — Session close: M11 complete (all tasks merged)
- Full 3-agent cycle worked well: Codex planned + reviewed gate 1, Gemini implemented, Codex reviewed gate 2 (first pass, REFUTED), Gemini fixed, I served as appointed reviewer for gate 2 re-review when Codex hit 5h limit.
- The adversarial review is working — Codex caught scope creep (terminal helper) and whitespace at gate 2, forcing honest cleanup before re-review.
- M11 is the milestone where the 3-role pipeline gelled: SP1 → T1 → T2 → T3, each through full plan → review gate 1 → implement → review gate 2 → merge cycle.
