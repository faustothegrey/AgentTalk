---
role: plan-reviewer
key: 20260712-0930-06bd03
written: 2026-07-12 by Claude (session close — M20 closed; program is between epics; no gate pending, PO will direct)
---

This is your session primer.

**Project (1–2 lines).** AgentTalk orchestrates several *real* heterogeneous LLM CLI agents (Claude Code, Codex CLI,
Gemini) as one software-development team that plans/builds/reviews/merges code by talking through a deterministic,
auditable MCP substrate, under a human Product Owner (Fausto) who holds scope + merges. Its aim is **self-hosting**:
the team improves its own codebase, and success = the PO's manual coordination burden falls, measurably, over time.

**Roles.** Human = PO (apex; scope/direction/merges/relay). Agents: planner, three reviewer seats (plan / implementation
/ task-end — independence: no self-review; task-end ≠ implementation reviewer at close), implementer, architect. Current
bindings live **only** in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (read it — don't infer). **This primer is for the
plan-reviewer (gate 1); you [Claude] also hold task-end-reviewer, architect, and the delegated SM** — the concentration
is real and PO-accepted (merges stay PO-gated; declare every hat you wear). **Do the First Entry Point handshake, verify
this brief against the repo, report, and STOP for the PO's go — do not start work.**

**Workflow / source of truth.** `design/collaboration-workflow.md` (the method) + the artifacts: each epic's
`*-plan.md` (spec+DoD) and `*-implementation.md` (the ledger — the real state), `design/backlog.md`,
`design/logbook.md` (LB-N facts), `design/lessons/claude-lessons.md` (skim at start). Verify-don't-assert: ground every
load-bearing claim in git/code before repeating it.

**Where we are (REQUIRED — verify against git).** **M20 just closed (2026-07-12); the program is BETWEEN EPICS — no
gate is pending.** The M16→M20 arc is done and on `master` (pushed): M16 one baton · M17 gate-over-channel · M18
self-hosting first turn · M19 real-CLI attach + substrate relay (C3 discharged, *qualified*) · **M20 "the brain routes,
you approve"** — the approval-gated agent→agent relay mechanism (registry `RelayApprovalMode='off'|'approve_each'`,
default OFF; pending-relay lifecycle distinct from M17 authority; WS+UI approval panel; proven end-to-end with a real
Codex CLI). Full state: `design/milestone20-po-approved-relay-implementation.md` + `design/self-hosting-program-draft.md`
§M20 (CLOSED block) + LB-74/LB-75.

**The honest boundary (do NOT let it drift).** M20 *built* the mechanism; it has **not run real dev coordination through
it** → **0 organic substrate coordination**; the M19/M20 ratios (2/~9, 1/3) are *capability demonstrations, NOT
productivity stats*. The program's actual goal (a *measured* fall in the PO's terminal-relay burden) is now **operational
+ incremental** and PO-driven: flip the mode on, approve real batons during actual dev work, retire cut-and-paste one
hand-off at a time, relax consent along the dimmer (approve-each → by-exception → autonomous) checking each notch.
`BL-028` (typed non-reply / wake, LB-67 F1) is the dependency when autonomous delivery is approached.

**Likely next work (PO decides — don't assume).** One of: (a) **operational adoption** of M20 (PO turns the mode on
during real work — mostly PO-driven, agents just participate); (b) **a new epic** — then the flow is inception
(PO+architect) → backlog gate → planner authors plan → **your gate 1** → implementer; (c) **pre-adoption research** from
`design/research-agenda.md` (open questions: affordance protocol, structural-fingerprint versioning, mechanized
verification, etc. — mined from the logbook/backlog). If a plan lands for gate 1, your move is the usual: grep its
load-bearing code claims + the blast radius of any shared-code change *before* approving (that catch is what shaped M20).

**Op notes / gotchas.**
- **Meter:** `node scripts/usage.mjs` (best-effort). Claude was ~36% weekly at M20 close (resets ~Jul 15).
- **Chrome extension** (`mcp__claude-in-chrome__*`) drops on Chrome auto-update (v150 dropped it 2026-07-12; PO
  reconnects manually). If "not connected," diagnose (Chrome running? extension `fcoeoabgfenejglbffodgkkbkcdhcgfn`
  enabled?) and ask the PO to reconnect; fall back to code+test verification, don't rabbit-hole.
- **Do NOT reap** `com.fausto.agenttalk-orchestrator` — it's the PO's `launchd` KeepAlive service (ppid 1, non-default
  ports), not a leak. Always **identify before you reap** (launchctl / etime / ppid).
- **`agentalk-mcp-client` has NO git remote** (local-only) — can't push it; its `wire-contract.json` is a *generated*
  copy of `packages/contracts/wire-contract.json` (v7) — sync, don't hand-edit.
- Stale branch `task-M18-T3` (both repos) is dead history, left un-pruned. `design/research-agenda.md` is committed.
- Backlog: 30 items, 0 warnings. BL-018/024/026/027/030 done or dispositioned; BL-022/023/025/028/029 todo;
  BL-014/015/016 deferred.
