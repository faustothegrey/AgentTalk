---
role: implementer
key: 20260716-0055-bite0-impl
written: 2026-07-16 by Claude (session close — Bite 0 launcher implemented on branch task-bite0, pending PO-gated merge)
---

This is your session primer.

**Project.** AgentTalk is a multi-agent orchestration system: isolated LLM agents (Claude/Codex/Gemini) attach as
MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a planner→implementer→reviewer
workflow. Current thrust: the **autonomous-development ladder** — PO sets a goal, AgentTalk forms a team, works it,
and reports, with a human-gated dimmer from `approve-each → autonomous`.

**Roles.** Human = PO (Fausto). Current bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — read it.
**Critical current state:** **Codex and Gemini (agy) are UNAVAILABLE until further notice** (PO, 2026-07-15).
**Claude is the sole available agent** → resource-scarcity fallback: you wear every hat (planner, all reviewer
seats, implementer), declare each loudly, keep each gate's discipline separate. The **Standing Conditional
Reassignment is ACTIVE** (implementer unavailable → you may implement). **Merges stay PO-gated.**

**Workflow / source of truth.** `design/collaboration-workflow.md` (method) + artifacts: `design/backlog.md`
(BL items), `AGENT.md` (governance), `design/logbook.md`, the Bite 0 plan below. There is **no `*-implementation.md`
ledger** for this thread yet — it's plan + branch + backlog.

**Active work — Bite 0 of the autonomy ladder.** `design/bite0-autonomous-launch-plan.md` is the spec. Model
(settled with PO): the PO writes a **config file** `{instance, agents[], goal, cap}`; a **deterministic launcher**
(the "(AgentTalk) launcher" — NOT an agent, no inference) starts the instance, launches the declared agent(s) via
the BL-037 on-demand launcher, delivers the goal as the first turn, **machine-enforces a cap** (wall-clock +
resource meter — the anti-loop rail), and reports at end. **"Hermes" is a SEPARATE future *agent* layer** (will
invoke the launcher + monitor a live session) — deferred, NOT Bite 0. Don't re-conflate them.

**What's DONE (this session):**
- **BL-037** (merged, sibling repo `agentalk-mcp-client` master): the on-demand HTTP launcher (`lib/agent-launcher.mjs`).
- **Bite 0 launcher** implemented on branch **`task-bite0`** in a **git worktree** at
  `/home/fausto/Software/att-worktrees/task-bite0` (sibling repo). `lib/bite0-launcher.mjs` = the deterministic
  config→launch→cap→report core. 11 hermetic core tests + 2 E2E (real core drives the real BL-037 launcher + a
  real spawned harness; proves happy-path completion AND a real wall-clock cap terminating a real hung process).
  Full sibling suite 33/33, lint clean, BL-037 untouched. **Committed (`a86733d`), NOT merged — PO-gated.**

**Your immediate next steps (PO-prioritized, 2026-07-16):**
- **BL-039** — add NDJSON run-artifact capture (D6, deferred). Small: injected `record()` effect + test.
- **BL-040** — the live run against a real AgentTalk instance + authed CLI (acceptance §6). **Blocker: the main
  repo is not built on this machine** (no `node_modules`/`dist`, `tsc` missing) — `npm install` + build first.
- Also open: the **Bite 0 merge decision** (PO-gated). **Independence caveat:** you authored Bite 0, so a gate-2
  review by you isn't independent — flag it; real independence needs Codex/agy back or **BL-038** (Goose/OpenRouter).

**Op notes / gotchas:**
- **Worktree mandate (PO, 2026-07-16):** ALL code development happens in a per-task git worktree (`task-<id>`),
  never the primary checkout; docs/governance may still be edited on master. Recorded in `AGENT.md`. Worktrees
  don't share `node_modules` — symlink the sibling repo's in.
- **Missing key store:** this fresh machine has NO `session-primer-key.json` — the primer-handshake consumed-set is
  absent, so verify against git/ledger, don't trust primers blindly. (Report the missing store to the PO.)
- **Usage meter works now** (`node scripts/usage.mjs`): at close, claude weekly 8%, session 40%. Plenty of weekly runway.
- **Git:** main repo `master` ahead of origin (unpushed — PO hasn't asked to push); sibling repo `master` has BL-037;
  `task-bite0` branch holds the Bite 0 launcher in the worktree.

Verify all of the above against ground truth before acting. Report your understanding, then STOP for the PO's go.
