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
- Next: M12 cross-provider consensus (active). Session suspended at T4 — Codex bridge vs AgentTalk one-socket policy found. C-PF1 client fix next.

### 2026-07-01 — Epic inception with Architect role (first use)
- First use of the split Architect role (Claude) for M12 epic inception. Worked well: Architect produces plan → PO decides → Planner gives advisory POV → Architect incorporates → Planner breaks down → Reviewer gates. The full 7-step inception flow.
- Claude as Architect self-corrected an overstatement in its own plan (F5: client supports Codex in MCP mode — half-right). The live run exposed the gap. Recording, not papering over.

### 2026-07-01 — T4 honest partial: Codex bridge vs one-socket policy
- Cross-provider Gem+Codex consensus BLOCKED by architectural conflict: Codex's CodexPersistentExecutor uses bridge.mjs which opens a second WebSocket, but McpServer enforces one-active-connection-per-agentId.
- Lesson: a preflight that only tests text-relay ("Say hello") doesn't exercise the tool-calling path. A valid Codex preflight must force a tool invocation.
- Epic closed on structural proof (T2+T3 merged) with live gap documented — per PO Q6. Honest partial stands.

### 2026-07-01 — SM error: killed agents before their session close
- I terminated Codex, Claude, and agy tmux sessions without giving them a chance to write their individual lessons files, consume primer keys, or perform session close. Each agent owns its own entry in `design/lessons/<agent>-lessons.md` and its own private key store — I can't write those for them.
- Fix: next session, before killing, send each agent a "session close" baton: write your lessons, update your key store, report done. Then kill when they confirm.
- Also: verify `~/.codex/agenttalk-session-primer-key.json`, `~/.claude/projects/AgentTalk/session-primer-key.json`, and `~/.config/AgentTalk_Gemini/session-primer-key.json` are in a clean state before closing.
