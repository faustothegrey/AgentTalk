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

### 2026-06-29 — Executing exploratory spikes (protocol-state-event-unification)
- When executing a non-code spike, explicitly declaring the read-only scope boundary upfront ensures strict adherence to the "do not change production code" non-goal, which is critical for exploratory debt analysis.
- When updating structured markdown forms (like spike plans or DoD tables), using targeted edits over file rewrites prevents accidental drift in the document layout.

### 2026-06-30 — Spiking dynamic MCP tools and system instructions
- In a persistent CLI wrapper context (like `agy --continue` or `codex exec`), there is no native out-of-band way to inject per-turn system instructions dynamically; attempting to scope tools or instructions strictly per-phase requires significant foundational rewrites of the MCP layer. It is often safer to fall back to server-side action validation rather than fighting the execution model.

### 2026-07-01 — Mixed-model Execution Contexts (Stdin vs Text Relay)
- When transitioning an external agent client (e.g., Codex) from native tool-calling back to a raw text-exec model (to fix socket collisions), watch out for standard I/O side effects. An agent that previously managed its own tools via a persistent bridge might rely on an active `stdin` (e.g., for its internal `exec_command` tool). Piping its execution (`stdio: ['ignore', 'pipe', 'pipe']`) will close `stdin` and crash those internal tools, demonstrating that execution models must account for process environment dependencies as much as API payloads.
- An honest partial result, like recording a derailment and stopping before burning the budget or making unauthorized changes, is significantly more valuable than a hacked success. Explicitly stating "honest partial" builds trust and ensures the team solves the true root cause.

### 2026-07-02 — Validating recording systems via end-to-end edge case generation
- When validating if an internal subsystem records edge-case failures, driving the true orchestrator engine to the failure point ensures complete simulation fidelity. Mocking or skipping phases may silence failures unexpectedly.
