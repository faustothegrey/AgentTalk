---
role: plan-reviewer
key: 20260712-1815-e4b1a7
written: 2026-07-12 by Claude (session close — Tester seat created; BL-031 delivered on a branch, pending validation; no plan-review gate pending)
---

This is your session primer.

**Project (1–2 lines).** AgentTalk orchestrates several *real* heterogeneous LLM CLI agents (Claude Code, Codex,
Gemini) as one software-development team that plans/builds/reviews/merges code by talking through a deterministic,
auditable MCP substrate, under a human Product Owner (Fausto) who holds scope + merges. Aim: **self-hosting** — the
team improves its own codebase; success = the PO's manual coordination burden falls, measurably, over time.

**Roles.** Human = PO (apex; scope/direction/merges/relay). Agents: planner, three reviewer seats (plan /
implementation / task-end — independence: no self-review; task-end ≠ implementation reviewer at close), implementer,
architect, **and now Tester (NEW 2026-07-12)**. Current bindings live **only** in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` (read it — don't infer). **This primer is for the plan-reviewer (gate 1); you [Claude] also hold
task-end-reviewer, architect, and the delegated SM.** Do the First Entry Point handshake, verify this brief against
the repo, report, and **STOP** for the PO's go — do not start work.

**The Tester seat (created this session — know it exists).** Agent **helper** to a **human test driver**: the human
drives the running product hands-on (clicks, UX judgment); the agent instruments/guides (logs, backend status,
step-by-step, verify-don't-assert) — it does **not** operate the UI. **Default holder = Codex.** Does *validation*
(does it work in real use?), distinct from the reviewer seats' *verification* (built to DoD?). **Scope fence: it
produces findings, not merge verdicts** — never a gate. Owns the organic-coordination adoption metric. Charter:
`design/collaboration-workflow.md §1` + `design/tester-seat-proposal.md`; primer `tester-primer.md` (`key: none`).

**Workflow / source of truth.** `design/collaboration-workflow.md` (method) + artifacts: each epic's `*-plan.md`
(spec+DoD) and `*-implementation.md` (ledger — real state), `design/backlog.md`, `design/logbook.md` (LB-N),
`design/lessons/claude-lessons.md` (skim at start). Verify-don't-assert: ground every load-bearing claim in git/code.

**Where we are (REQUIRED — verify against git).** **Program is BETWEEN EPICS; M20 closed 2026-07-12 — no plan-review
gate pending.** This session did the *first un-scripted, UI-driven, PO-approved agent↔agent relay run* (real
codex↔gemini, 5/5 batons; **LB-77**) — the M20 operational path works from the browser. **Honest boundary intact:**
that's an operational-path proof, **NOT** real dev coordination → **organic dev coordination is still 0** (topic was
a word-agreement). Two work items came out of it, both on `master` (pushed): **LB-76** (the two coordination flows
diagram), **LB-77** (the run), **BL-031** (inline-relay-approval UI redesign), and the **Tester seat**.

**⚠️ Open work in flight (don't lose these):**
- **`fix/BL-031-inline-relay-approval` (branch, UNMERGED, `099772c`)** — inline relay approval in the conversation
  window (pending relays render in the main thread, highlighted, Approve/Deny below; handles N pending). Only
  `apps/web/src/App.tsx` touched; `tsc`+vite clean. **Runtime/UX NOT validated.** Next step = the **Tester seat's
  first assignment**: Codex instruments a **human-driven** validation run, then merge. **Independence trap:** Claude
  implemented BL-031, so a Claude task-end-reviewer must **not** be the one to close/merge it — route validation to
  Codex(Tester)+PO and let a non-Claude (or the PO) merge. Merge is PO-gated regardless.
- **Deferred (PO):** "how to handle UI fixes *systemically* in the workflow" — parked for later; decide the
  Tester-validates-pre-merge-vs-post-merge question when it's picked up (the charter currently says post-merge).

**Likely next work (PO decides — don't assume).** (a) the **BL-031 validation run** (Codex+human) then merge; (b)
**operational adoption** of M20 (real batons, move the metric off 0); (c) a **new epic** (inception → backlog gate →
planner → your gate 1 → implementer); (d) research from `design/research-agenda.md`. If a plan lands for gate 1, your
move is the usual: grep its load-bearing code claims + the blast radius of any shared-code change *before* approving.

**Op notes / gotchas.**
- **Meter:** `node scripts/usage.mjs`. Claude ~41% weekly at this close (resets Jul 15 ~9am Rome).
- **Attach runbook** for the UI relay flow: `design/attach-chat-runbook.md`. MCP port is random per backend restart
  (grab it from the log). Wire-contract hashes must match between repos (currently `ffa94e93…`, both fine).
- **Chrome extension** drops on Chrome auto-update; fall back to code+test verification, don't rabbit-hole.
- **Do NOT reap** `com.fausto.agenttalk-orchestrator` — it's the PO's `launchd` service (ppid 1, non-default ports),
  not a leak. Identify before you reap (launchctl / etime / ppid).
- Stale branches `task-M18-T3` and (now) `fix/BL-031-inline-relay-approval` (the latter is *live* WIP, not stale).
  Backlog: 31 items, 0 warnings; BL-031 is `todo`.
