# M07-T3 — Pre-spec reflection  *(DRAFT — thinking, NOT the authoritative spec)*

**Status:** Draft reflection (2026-06-20), captured to seed the formal spec. **This is not plan §11.**
The authoritative T3 spec will be written into `milestone07-centralized-brain-plan.md` (§11, à la §9/§10)
**tomorrow**, after the **backlog gate** (review the 3 open items) + a **logbook skim** (esp. LB-3).
**Author:** Claude (reviewer/architect). Decisions marked **[FAUSTO]** are his to make.

**Related:** plan §2 (target arch), §3 (contract inversion), §4 (R2/R3/R4) · `collaboration-workflow.md`
§3b–§3d · `logbook.md` LB-3 (dedup keyed on `currentTurnId`).

---

## 1. The clean framing (the easy 60%)
T1/T2 already built the **server-side brain**. The driver loop is:
```
awaitTurn → buildPrompt → [GET COMPLETION] → parse/retry → translate → handleMcpToolCall
```
For API agents, `[GET COMPLETION]` = `callApi` (in-process fetch). **T3 = generalize that one step**
to a second "completer" that, instead of fetching, sends an **exec-RPC** to the CLI harness and awaits
`{text, usage}`.
```
        ┌─ Completer:  complete(prompt[, sessionId]) → {text, usage} ──┐
 brain ▶│  ApiCompleter (T1/T2, done)  │  CliExecCompleter (T3, new)   │
        │  = fetch in-process          │  = exec-RPC → harness → raw   │
        └──────────────────────────────────────────────────────────────┘
```
Loop, prompt-building, translation, runtime: **all shared**. Mostly a refactor of the driver to inject
the completer instead of calling `callApi` directly.

## 2. The tension (why Fausto must be in the loop)
T3 **changes the wire contract** (M05 semantic events → exec-RPC). This conflicts head-on with the
CLAUDE.md "preserve behaviour" rule. Therefore:
- **[FAUSTO] Coexistence, not cutover.** Add the exec-RPC path **behind a flag**, keep the M05/M06 CLI
  path alive. **T4** retires the old path. No big-bang. (Needs explicit behaviour-change sign-off.)

## 3. The three real risks, worst first
1. **🔴 Effect-fence (R2) — the load-bearing unknown.** A CLI exec **mutates a git worktree → it is
   NOT idempotent** (unlike an API call). If the harness dies mid-exec and the orchestrator re-issues
   on reconnect → **double execution**. This is the first time the system does *side-effecting* work.
   The fence must know "did this exec's effects land?" before re-issuing. **Hardest part of M07.**
2. **🟡 Exec granularity — two flavours, don't conflate.** A *planner* turn = `prompt → text` (single
   completion, turn-by-turn in the consensus). The *worker* = "execute the plan" = a **long
   run-to-completion agentic session**. So the harness isn't only "prompt→text"; the worker needs a
   `run-to-completion → result` exec. Two RPC shapes.
3. **🔴 Session state (R3) — BIG OPEN NODE (Fausto flagged, 2026-06-20).** *Not* a checkbox.
   **Key reframe: "brain" ≠ "memory".** Centralized-brain means *semantics/decisions* live server-side
   (prompt-build, protocol, translation) — it does **not** require the raw token history to live
   server-side. So:
   - **Brain** → orchestrator (centralized).
   - **Memory** → the CLI's **native session** (`agy --continue`; claude/codex `--continue`/`--resume`,
     sessions persisted to disk). The agents are **already stateful** — M06's `GeminiPersistentExecutor`
     exploits exactly this.
   Three options, not two: (1) **stateless-resend** (orchestrator rebuilds full history each turn —
   most tokens, hits context limits); (2) **opaque `sessionId`** — harness passes a semantics-free id to
   the CLI's native session → **no resend, harness stays dumb, brain stays central**; (3) orchestrator-
   held session map.
   - **Lean: option 2 (sessionId / native session) is likely the production choice** — Fausto's
     instinct. "Stateless-first" is **only spike scaffolding** (prove the inversion without session
     complexity), *not* the end state.
   - **Residual tensions to resolve in its own spike:** (a) **determinism** — orchestrator can't see the
     CLI's exact context (compaction); OK because protocol enforces on the *reply's* `message_type`, not
     internal context; (b) **recovery (ties to R2/#4)** — `--resume <id>` from on-disk sessions can
     survive a harness restart; (c) **cost** — native session wins decisively.
   - **[FAUSTO] Decision: give R3 its own spike inside T3** (don't decide casually). Default direction:
     sessionId.

## 4. Spike-first (workflow §8)
Cheapest probe: **one CLI agent, one exec-RPC round-trip, no consensus, no reconnect** — prove the
harness reduces to `exec(prompt) → text` for a **planner** turn, reusing the brain. Green ⇒ pattern
holds. Then tackle the worker + effect-fence **separately** (the hard half).

## 5. Proposed slicing (to confirm tomorrow)
- **T3a** — exec-RPC for a **planner** (read-only, reuses the brain). Cheap; proves the inversion.
- **T3b** — **worker agentic-exec + effect-fence + reconnect** (R2/R3). The heavy piece, isolated.
  **This is where Fausto's product calls live** (worktree, re-execution, idempotency).
- **T3c** — contract bump + hash-guard re-bump.

## 6. Open decisions for Fausto (resolve before §11)
- [FAUSTO] Coexistence-behind-flag vs cutover (recommend coexistence).
- [FAUSTO] Session model (**BIG NODE — give it its own spike**, see §3.3): lean **sessionId / native
  CLI session** ("brain ≠ memory"); stateless-resend is only spike scaffolding, not the end state.
- [FAUSTO] Which CLI to pilot T3a on (claude / codex / agy)?
- [FAUSTO] Effect-fence policy for T3b: re-issue-and-dedup, or never-auto-reissue-ask-human?

> Next: backlog gate + logbook skim → then promote this into plan §11 and a `-implementation.md` T3 row set.
