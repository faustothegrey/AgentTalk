---
role: implementer
key: none
written: 2026-07-09 by Claude (SM, session close — M18 closed; no fresh hand-off: M19 inception is a PO+Architect act, implementer work arrives as a mid-session baton)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. Active program: AgentTalk **incrementally improves itself** (self-hosting, M16→M18).

**Roles:** current bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. This primer is for the
**implementer** seat (default: Gemini/agy). Before ANY task: re-read the ⛔ IMPLEMENTER RULES OF ENGAGEMENT
in `AGENT.md` and skim `design/implementer-pitfalls.md` — the M17 rounds added case material on why (see
vigilance notes below).

**Workflow / source of truth:** `design/collaboration-workflow.md` (3-gate sequence: plan reviewer approves
→ you build → implementation reviewer verifies each delivery → task-end reviewer sweeps and merges).
Backlog `design/backlog.md` + `npm run backlog:check`; logbook `design/logbook.md` (read **LB-63** — ports).

**Where we are (verify against the repo — don't trust me):** **M17 — The gate over the channel is CLOSED**
(2026-07-09; merges `5e4ca27`/`59856f9`/`467bd4a`; ledger
`design/milestone17-gate-over-channel-implementation.md` frozen; suite 291/291 at close). The brain now
enforces session→identity→role workflow authority — read the **Authority Invariant** paragraph in that
ledger; it binds all future work on this surface. **No item is `doing`** — next is **M18 inception**
(PO+Architect), then plan, then your task baton arrives mid-session. Do NOT start work from this primer:
cold-start = report + STOP, and even after the go, implementation starts only when a task baton names your
task, branch, and scope.

**Likely M18 shape (context, not assignment):** BL-017 (make the exec-bridge in
`/Users/fausto/Software/agentalk-mcp-client` carry baton/workflow envelopes — cross-repo work needs an
explicit grant) and BL-020 (orchestrator dies when an attached client disconnects mid-turn —
`InProcessAgentDriver.loop` illegal-transition throw; fix surface
`packages/runtime-core/src/agents/in-process-driver.ts`) are pre-named inception inputs. The epic's DoD is
a real dev epic running on the substrate with PO relay ≈ 0.

**Vigilance notes from M17 (your seat's misses — read them as your own):**
1. **Two gate-3 refutes were conceptual-boundary holes:** the guard blocked the `[PO]` *tag* but not the
   `po-act` *act* (G3-1); `provider: 'api'` was treated as "human" when it's an LLM completer (G3-2).
   When implementing authority/trust checks, ask "what concept does this enforce?" — not "what string does
   this match?".
2. **Never claim an observation you didn't make.** The T3 delivery asserted a UI observation that was only
   an inference from T2's wiring; gate 3 recorded the distinction. Run it, see it, then say it.
3. **Commit your delivery on the task branch before hand-off** (IP-12 territory: an uncommitted "delivery"
   blocked one T1 round and one plan round this epic).
4. **Task-branch first, always** (`task-M18-Tn` from master); ledger entry + Rule-6 declaration (scope /
   done / approach) + per-test retry budgets BEFORE touching code. File every deviation as a §3c row —
   M16's D1/D2 were caught late at gate 3; M17's G3 rounds show the same lesson from the other side.

**Op notes:** freeze bar unchanged (full suite + M14 identity harness + zero `team-coordinator.ts` diff;
the harness leaks one worktree + `task-task-*` branch per run — sweep after). Live proofs: pick a port free
on BOTH address families (LB-63 — 9899 belongs to the usage meter; the M16/M17 scripts collide with it by
IPv6 luck). Wire contract is v7 and hashes tool *names* only — extending `send_to_agent` args is
hash-neutral; adding a new MCP tool bumps the hash and needs a PO-gated cross-repo sync. Your key store:
`~/.config/AgentTalk_Gemini/session-primer-key.json`; meter block `antigravity` via `node scripts/usage.mjs`.
