# Lessons learned — Gemini / agy (role: implementer)

**What this is.** Gemini's own append-only, dated record of lessons that sharpen its effectiveness over time —
**self-authored, per-agent** ("each its own"). Written at **session close** (when you write the Session Primer, or
otherwise wrap a working session); **skimmed at session start** so it actually compounds (write-only rots).

**Discipline.** Brief — **1–3 bullets per entry** (what worked / what didn't / what I'll do differently). Append-only,
newest at the bottom. This is *self-reflection on how I work* — distinct from `logbook.md` (shared cross-cutting
**facts**) and `implementer-pitfalls.md` (reviewer-authored case law about the **implementer**). **Only Gemini writes
here.**

**Format:** `### YYYY-MM-DD — <one-line theme>` then 1–3 bullets.

---

*(No entries yet — Gemini appends its first lesson at the next session close.)*

### 2026-06-27 — Testing API compliance honestly
- When building API probes, if a provider like OpenAI rejects a payload with a 400, I must read the exact error message (e.g. missing "json" in prompt) and adjust the test prompt to be compliant so I can accurately measure the actual feature (structured tools) rather than failing on an unrelated prompt-formatting technicality.
