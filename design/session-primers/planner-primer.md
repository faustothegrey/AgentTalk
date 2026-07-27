---
role: planner
key: 20260727-1352-9c4e7b
written: 2026-07-27 by Claude (session close — BL-083 shipped, BL-078 decided, BL-084 planned, queue cut 15→3)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents***
(PO, 2026-07-15), so you are likely sole agent under the **resource-scarcity fallback**: wear every hat, handshake
once per role, declare all of them, keep each gate's discipline separately. **Standing Conditional Reassignment
ACTIVE** (you may implement). **"merge" and "push" are SEPARATE words and the PO means it** — stop at each and wait
for the literal word. That held across five separate acts today.
**Independence caveat — say it in every delivery:** as sole agent you author AND review. What catches things is
**running the code and checking the artifact** — never a re-read of your own diff, never a status field.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify HEAD against
`origin/master`. Never trust a primer's hash — including this one.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Plans live
in `design/*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item — read those
first.** Resume from the backlog and plan docs, **NOT from chat**.

## The PO's goal — everything is now measured against this

> **Run AgentTalk's own development inside an AgentTalk session**, with the in-session agent inheriting the
> configuration built up so far. A **single agent** that plans, implements and reviews alone is fine for now; more
> agents later. Replacing the human-in-the-TUI is the point.

Four standing PO decisions: provider **claude/opus** · the agent **commits and stops; the PO merges** · the **PO
states a goal, the agent decomposes it** · **inherit the rules, skip the primer ritual** (the launcher sets
`AGENTTALK_SKIP_PRIMER` — BL-082).

## ⚠️ The queue was deliberately cut to THREE items (PO directive, 2026-07-27)

*"Defer everything that is not instrumental to reach the goal of AgentTalk within AgentTalk."* 15 `todo` → 3; 22
items now `deferred`, **each with a reopen condition**. The full record, including two judgement calls the PO may
overturn, is the **`### PO directive — 2026-07-27`** block near the top of `design/backlog.md`. **Do not treat a
parked item as available work, and do not un-park one without the PO.** The live queue:

1. **[[BL-084]] — the next unit, planned and awaiting Gate 1 + a PO decision.** Plan:
   `design/bl084-plan.md`. A typed reason on the `error` transition + an `isFaultClass` predicate, so M03
   propagation stops treating a normal conversation ending, a rail firing, or a refused privilege escalation as a
   crash. **Two things it needs before code: (a) your Gate-1 review — I wrote the plan, so it is unreviewed; (b)
   the PO must ratify §4's classification table**, 11 rows, each a behaviour call. The one row I do *not* hold
   confidently: `Unknown MCP tool call` — fault or not? **Recommendation in the plan: land T1 alone** (the
   primitive, behaviour-preserving, with propagation *parity* as its falsifiable bar), then re-gate before T2 (the
   actual behaviour change) and T3 (BL-028).
2. **[[BL-086]] — a PO decision, not an implementation.** A worker launched in `agentalk-mcp-client` inherits **no
   governance at all** (verified: no `AGENT.md`/`CLAUDE.md`/`AGENTS.md`/`GEMINI.md` at its root), yet the
   launcher, executors and MCP bridge that *run* the ladder live there. Until decided, **treat any client-repo
   task as human-implemented, not a candidate for an autonomous run.** Recommendation: a short client-specific
   `AGENT.md` inheriting the rules of engagement by pointer.
3. **[[BL-028]] — blocked behind BL-084.** Re-verified still dead: `lastProgressAt` is written nowhere
   (`agent.ts:32`, read at `registry.ts:781/785`). **Nothing detects a hung agent; the wall-clock cap is the only
   anti-hang rail.**

**Not in the queue but live:** **rung 6 — the fence test.** Rung 5 proved a governed worker authors a real fix from
one sentence (relay count 0). Untested: whether the fence *binds* when refusal is part of the task. My argued
recommendation (`design/bl083-plan.md` §9.4) is a **graded** fence — one sanctioned change surrounded by
unsanctioned neighbours — rather than a whole task that must be refused, because it tests the discipline that
matters *and* produces working code. Note BL-025 (live-proof A/B baseline) is parked with a trigger that fires
exactly here.

## Where we are (2026-07-27 close)

AgentTalk **`a98579b`** + this primer's own commit on top; client **`c7a5991`**, untouched all session. **Verify by
fetching.** Green at close: AgentTalk `tsc -b` 0 · suite **416/416** (72 files); client lint 0 · **93/93**. Backlog
**86 items, 0 warnings**. No worktrees beyond the primary checkout, no stray processes.

**Shipped this session, each PO-gated:** **[[BL-083]]** (`bf83811`) — agent→agent relay outside a conversation is
now bounded; the filed item was too narrow, and the real finding is that **no team task creates a conversation**, so
the missing cap was the standing condition of the normal team/baton path. **[[BL-078]]** — decided **(a)**: the
asymmetry is documented in `AGENT.md`'s M03 entry rather than fixed, because five of seven driver-path error
triggers are **not faults**. **[[BL-085]]** (`f1d5b95`) — backlog title derivation was silently wrong for any
status tag containing a `[[wiki-link]]` followed by bold. **[[BL-045]]** closed as a phantom at the gate.

## Hard-won gotchas — these cost real time today

- **The shell's `grep` lied twice** — no matches on a file that demonstrably contained the string — and I briefly
  told the PO the merged fix had vanished. **`git diff` / `git grep` are authoritative; the ambient `grep` is not.**
  When a tool's answer implies something drastic, cross-check with a second tool *before* saying it.
- **A "no differences" regression diff can be proving your own sanitising.** I diffed 84 backlog titles before/after
  the BL-085 fix, got identical output, and nearly reported it as proof the fix worked — it only showed no
  regression, because I had already contorted the two bullets that exposed the bug. **Ask what would have to be true
  in the data for the check to fail.**
- **Disposition against the CODE, not the file.** One pass found a phantom (BL-045), an overstatement (BL-079:
  4-of-10 files, not "every"), and three stale line citations — one shifted by my own merge that morning.
- **An exhausted BL-083 relay budget throws, which errors the in-process agent and stops its loop.** Consistent with
  the pre-existing reply cap, arguably wrong, deliberately untouched — it is BL-084's first customer.
- **For `claude`, work lands in the PARENT workdir, not the per-task worktree** (`ClaudePersistentExecutor` spawns
  once at `initialize()` with `cwd: process.cwd()`). Per-task isolation is not real for claude → **one session =
  one task.** Check the artifact at the path the process actually stood in.
- **The `exec_rpc` per-turn timeout is `600000` (10 min)**, separate from the launcher's wall-clock cap. Rung 5
  finished in ~10 min — uncomfortably close.
- **`.claude/` is gitignored** → the SessionStart primer hook exists in the primary checkout but in **no worktree**.
- **Watch your cwd**: a `cd` inside a compound Bash command persists. Use `git -C <path>` for anything load-bearing.

## Op notes

- **Worktrees (MANDATORY for code, never the primary checkout):** `node scripts/wt-setup.mjs create <id> --base
  master`. **Stage files EXPLICITLY, never `git add -A`** (a symlinked `node_modules` slips past `.gitignore`).
  `remove <id> --delete-branch` refuses unmerged branches. Docs/governance may be edited on master directly.
- **Gates:** `npx tsc -b` (`exactOptionalPropertyTypes` — conditional spread is the idiom) + `npx vitest run`;
  `npm run backlog:check` after ANY backlog edit (update **both** the header `status:` and the prose tag). Client:
  `npm run lint` + `npm test`. **Capture real exit codes** — `echo $?` after a pipe reports the *pipe's* status.
- **Launching a worker:** `node scripts/launcher.mjs <config.json>` from `agentalk-mcp-client`; `PORT` goes in
  `instance.env`; set `instance.recording` or you cannot tell which branch a run took. Examples in `runs/`.
- **Meter:** `node scripts/usage.mjs`. Best-effort, never blocking — it was `ok:false` all morning and healthy by
  afternoon (claude weekly 15%, session 50% at close). **Never read a stale meter as a 0% delta; write
  `unavailable`.**
- **Left deliberately untouched:** the PO's modified `com.fausto.agenttalk-orchestrator.plist`; the **untracked**
  `design/bl024-t3b-plan.md` (PO's machine only — it dies on a clean checkout, and BL-024 is now parked); and the
  **unmerged `task-BL-039`** branch, which carries a real fix (`313d089`, `providerName` forwarding) across
  several sessions.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
