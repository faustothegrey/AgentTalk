---
role: plan-reviewer
key: 20260713-0020-b7d4e9
written: 2026-07-13 by Claude (session close — BL-032 closed via full 3-gate; BL-031 unblocked, pending validation)
---

This is your session primer.

**Project (1–2 lines).** AgentTalk orchestrates several *real* heterogeneous LLM CLI agents (Claude Code, Codex,
Gemini) as one software-development team that plans/builds/reviews/merges code by talking through a deterministic,
auditable MCP substrate, under a human Product Owner (Fausto) who holds scope + merges. Aim: **self-hosting** — the
team improves its own codebase; success = the PO's manual coordination burden falls, measurably, over time.

**Roles.** Human = PO (apex; scope/direction/merges/relay). Agents: planner, three reviewer seats (plan /
implementation / task-end — independence: no self-review; task-end ≠ implementation reviewer at close), implementer,
architect, **Tester** (agent helper to a human test driver; default Codex; created 2026-07-12). Bindings live **only**
in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. **This primer is for the plan-reviewer (gate 1); you [Claude] also hold
task-end-reviewer, architect, delegated SM, and served as temp Implementation Reviewer on BL-032.** Do the First Entry
Point handshake, verify this brief against the repo, report, and **STOP** for the PO's go — do not start work.

**Workflow / source of truth.** `design/collaboration-workflow.md` (method) + artifacts: each epic/task's `*-plan.md`
(spec+DoD) and `*-implementation.md` (ledger — real state), `design/backlog.md`, `design/logbook.md` (LB-N),
`design/lessons/claude-lessons.md` (skim at start — read the 2026-07-13 BL-032 entry). Verify-don't-assert: ground
every load-bearing claim in git/code before repeating it.

**Where we are (REQUIRED — verify against git; state moved under me — see the caution).** Program is BETWEEN EPICS.
**master HEAD = `71f3242`, ahead of `origin` by 2 (UNPUSHED).** ⚠️ **Caution: a parallel Codex BL-031 validation
session advanced master + several primers/backlog/logbook *after* my BL-032 close** — verify HEAD and the ledgers
before trusting any commit hash below. Recent arc on `master`:
- **Tester seat created + proved out.** Codex-as-Tester (PO driving) caught **BL-032** on its first BL-031 validation
  run (LB-77 first UI relay; LB-78 the blocked validation), then a second validation run confirmed BL-031 works with
  real providers (**LB-86**) and found **BL-033**. The seat is paying off.
- **BL-032 DONE** (`7dc3f19`, was merged `8f03bad`; master has since advanced) — attach-mode pair-chat startup fix.
  Full 3-gate: Gate 1 (you, conditional-approve + 4 amendments) → impl (Codex, temp) → Gate 2 (you, PASS, 8/8 DoD
  VERIFIED, IP-15 discriminate check) → Gate 3 (PO). Root cause was **not** a queue mismatch: a provider-attached
  target that missed its healthcheck exec stayed wedged past the healthcheck deadline; fix aligns the healthcheck exec
  deadline (grace 0) to the contract. Healthcheck strictness + M20 relay unchanged. Ledger:
  `design/bl-032-attach-pair-chat-healthcheck-implementation.md`.

**⚠️ Open work in flight (don't lose):**
- **BL-031 inline relay approval — VALIDATED, still UNMERGED.** Branch `fix/BL-031-inline-relay-approval` @ `da07821`
  (worktree `AgentTalk-BL-031-validation`): my inline-approval `App.tsx` **+ Codex's added "supervised conversation
  control"**. Real-provider validation passed (**LB-86**): Continue path (pending relays delivered only on the PO's
  Continue) and Stop path (denied relay, conversation stopped) both work with real Gemini/Antigravity. Status `todo`;
  **needs a merge decision.** **Independence knot for the PO:** I implemented the original inline UI; Codex implemented
  the supervised-control additions AND was the tester — so BL-031's task-end merge needs a party clear of both
  (likely the PO). Codex primed the impl-reviewer + planner primers itself; do **not** overwrite them.
- **BL-033 (todo, new)** — MCP pair-chat agents remain `busy` after `conversation_end` while their `llm-agent`
  clients keep waiting for turns (post-end lifecycle bug, found during the BL-031 validation; LB-86).
- **Deferred (PO):** "how to handle UI fixes *systemically* in the workflow" (Tester pre- vs post-merge validation).

**Likely next work (PO decides — don't assume).** (a) resume **BL-031 Tester validation** → merge; (b) M20 adoption
(move the organic-coordination metric off 0); (c) a new epic (inception → backlog gate → planner → **your gate 1** →
implementer); (d) research from `design/research-agenda.md`.

**Gate-1 discipline that keeps paying off (do this).** Grep the **blast radius** of any shared-code change *before*
approving — it caught the breakers in M16/M17/M20 and on BL-032 it **partly refuted the plan's own root-cause lead**
(the relay path shares `sendProtocol→queueTurn` yet worked), reshaping T0. The grep is a hypothesis-tester, not just a
breaker-finder. Also verify the plan's cited evidence (LB/BL ids) actually exists.

**Op notes / gotchas.**
- **Meter:** `node scripts/usage.mjs`. Claude ~41% weekly at close (resets Jul 15 ~9am Rome).
- **Attach runbook:** `design/attach-chat-runbook.md`. MCP port is random per backend restart. Wire-contract hashes
  must match between repos (`ffa94e93…`).
- **Chrome extension** drops on Chrome auto-update; fall back to code+test verification.
- **Do NOT reap** `com.fausto.agenttalk-orchestrator` (PO's `launchd` service, non-default ports). Identify before reap.
- Backlog: 33 items, 0 warnings. BL-032 `done`; BL-031 `todo` (validated, unmerged); BL-033 `todo` (new); stale
  branch `task-M18-T3`.
