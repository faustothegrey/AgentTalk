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

### 2026-07-01 — Session close: M12 complete (honest partial, C-PF1 fix verified)
- M12: cross-provider consensus epic closed. T1/T2/T3 merged. C-PF1 fix: removed bridge MCP config from CodexPersistentExecutor — confirmed by PF2 (structured preflight with no 4001 errors).
- T4 honest partial: Codex bridge collision resolved, but Codex's behavioral protocol compliance (R1 — prose/JSON mixing, deep exploration) remains a genuine finding. Connection model is fixed; behavioral gap is a separate concern.
- Lesson: when implementing in a cross-repo fix, keep the scope tight. C-PF1 was a 3-line change — precisely scoped, and it worked.

### 2026-07-02 — Session close: deferred backlog, AS-L1/AS-T2 done, workflow speed-ups
- Full spike pipeline ran: AS-L1 (PO + Architect labels) → AS-T2 (shadow judge script, two review rounds, PO overruled real-LLM constraint) → merged. All four agents (me as SM, Claude as architect+reviewer, agy as implementer) cycled.
- Three workflow speed-ups adopted by PO: branch commit freedom for agents, SM greenlights after priming (PO overrides), reviewer may fix zero-risk defects directly.
- Lesson: this session I DID let agents write their lessons before killing — the protocol works. Keep doing this.
- Lesson: the PO overrule mechanism is fast and effective for non-critical gates. Used it for the real-LLM fence in AS-T2. Don't default to it, but keep it available.

### 2026-07-02 — Session close: Arbiter Shadow Spike PROMOTED ✅
- Full spike cycle: AS-T0 → AS-T1 → AS-L1 → AS-T2 → AS-T3 → AS-T3b → AS-T4 → PROMOTE.
  Agreement rate went from 0/6 to 5/6 after fixing measurement artifacts.
- Autonomous pipeline worked: SM batons between implementer and reviewer without PO intervention for routine turns. PO only needed for merge gate and architecture decisions.
- Lesson: heartbeat mechanism with cron jobs failed — 5min cycle too slow for fast agents, and fresh sessions have no memory of prior state to detect "just finished" vs "idle." Dropped the approach. Will check manually.
- Lesson: OpenRouter is a reliable fallback when Gemini's direct API key isn't available in CLI env. Judge model swap was transparent to findings (provider-agnostic design proved sound).
