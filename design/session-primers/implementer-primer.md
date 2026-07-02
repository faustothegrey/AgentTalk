---
role: implementer
key: 20260702-1731-m15-t1
written: 2026-07-02 by Codex (planner + scrum master)
---

This is your fresh implementer assignment.

**Role / authority.** You are the **Implementer** (Gemini/agy). Codex holds Planner + Scrum Master, and is also
the implementation reviewer for this session per PO appointment recorded in the M15 ledger. Claude independently
approved the M15 breakdown at Gate 1 before that reviewer switch. Merge remains human-gated.

**Active epic.** **M15 — Arbiter Consensus, Direct Path** (BL-012 `doing`).
- Plan: `design/milestone15-arbiter-consensus-plan.md`
- Ledger / task contract: `design/milestone15-arbiter-consensus-implementation.md`
- Gate 1: APPROVED by Claude, with notes dispositioned by Codex in the ledger.

**Your task: M15-T1 only — ArbiterCoordinator skeleton + routing.**

Implement only the T1 scope from the ledger:
- Add `consensusMode: 'protocol' | 'arbiter'` as an opt-in/defaulted surface.
- Keep existing/default calls on the protocol path.
- Route arbiter opt-in multi-planner planning to a new `ArbiterCoordinator`.
- Build the free-form arbiter debate skeleton, transcript recording, and hard turn-budget fail-soft path.
- Use only injected deterministic mock judge behavior in tests. No real LLM calls in T1.

**Hard fences.**
- Do **not** edit `packages/runtime-core/src/registry/team-coordinator.ts`.
- Do **not** edit protocol payload/tool definitions, `mcp-tools.ts`,
  `packages/runtime-core/src/agents/in-process-driver.ts`, `@agenttalk/llm-client`, client repos, or
  recording/playback infrastructure.
- Do **not** implement T2 judge/synthesis wiring or T3 live proof.
- Do **not** broaden scope if a default-protocol regression appears. Stop and report.

**Gate 1 note dispositions you must honor.**
- The forbidden `in-process-driver` path is `packages/runtime-core/src/agents/in-process-driver.ts`.
- In arbiter mode, `advance-to:*` verdicts are progress hints only: treat as `hold`/continue, record the verdict,
  and do not map them onto protocol phases.
- T1-C4 visibility means a task update plus emitted runtime event; a log line alone does not satisfy it.

**Required verification budgets (pre-registered in the ledger).**
- New targeted arbiter routing/skeleton vitest: max 3 attempts.
- Default-protocol regression vitest/assertion: max 2 attempts.
- `node scripts/m14-identity-harness.mjs --check`: max 2 attempts.
- `npx tsc -b`: max 2 attempts.
- Full `npm test`: max 1 attempt.
- `git diff --check`: max 2 attempts.
- `git worktree list` pollution check: max 1 attempt.

**Before coding.** Follow the Implementer Rules of Engagement: declare scope, done, first approach, and per-check
retry budgets in your own words before touching files. Skim `design/implementer-pitfalls.md` and
`design/lessons/gemini-lessons.md`. Poll `node scripts/usage.mjs` best-effort.

**When done or blocked.** File implementer claims in the M15 ledger with exact command output, `git diff --stat`,
touched-file scope disposition, and any blocker. If a check hits its budget or exposes an out-of-scope behavior
change, STOP and report.
