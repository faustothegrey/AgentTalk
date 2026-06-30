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

### 2026-06-29 — SM activation, spike orchestration handoff

- **What worked:** Agentctl workflow (spawn → send → capture) with parallel Codex+Gemini agents works smoothly for the plan→implement→review cycle. The spike was the right format for the tiny tech-debt item — no epic overhead.
- **What didn't:** Codex sometimes gets stuck at the `›` prompt and needs the message re-sent. Need to add "press Enter first" or send empty line if capture shows stale prompt after send.
- **What I'll do differently:** As SM I should do a quick backlog gate sweep at session start before jumping into delegation. Also need to ground every claim against git (the vault note was stale about my delegation status — real state was in AGENT.md).
