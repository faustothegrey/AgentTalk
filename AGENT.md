> **Canonical file.** `AGENT.md` is the single source; **`AGENTS.md` and `CLAUDE.md` are symlinks to it**
> (one file, three names for different tools — Claude Code reads `CLAUDE.md`, agent MCPs read `AGENTS.md`).
> **Edit `AGENT.md` only.** Don't be fooled by the three names into thinking there are three files.

This project has reached Milestone 06. From now on follow these rules:
- Preserve all existing behavior by default.
- Any behavior change requires explicit user confirmation first.
- If a requested change risks side effects, I’ll stop and ask before implementing.
- For every edit, I’ll favor minimal, targeted diffs and regression tests to prove no unintended behavior changes.
- When updating tests, I’ll treat them as behavior contracts unless you explicitly approve changing those contracts.

## 🚪 FIRST ENTRY POINT — verify your primer key before anything else  *(every session, turn 1)*

At the very start of **every** session, before reading anything else or acting, do the **primer handshake**:

0. **Know your role.** Primers are keyed by **role**, not by agent. The standing role map (you are one of these):
   **planner-reviewer → Claude *and* Codex** (by convention either may hold it — one at a time) ·
   **implementer → Gemini**. Your eligible role-primer is `design/session-primers/<role>-primer.md` —
   Claude/Codex → `planner-reviewer-primer.md`, Gemini → `implementer-primer.md`. **The `-primer.md` suffix is
   mandatory** — on a case-insensitive filesystem `claude.md` *is* `CLAUDE.md` and would be auto-slurped as
   instructions, bypassing this gate.
1. Open your eligible **role-primer** and read its `key:` header. Also read your **private key store** — a file
   *outside the repo*, in your own per-project agent dir (Claude Code: alongside your `memory/` folder, named
   `session-primer-key.json`; Codex/Gemini: the equivalent stable private dir). The store holds `{ consumed: [] }`
   — only **the keys you have already consumed**. It is private to you.
2. The key lives in the **shared** primer header, so every eligible reader sees the *same* key — that is the whole
   idea: **the right key ⇒ the right primer.** Decide by whether **you** have consumed it:
   - **key ∉ your `consumed`** → the primer is **fresh for you** → it *is* your assignment this session. Follow
     **Receiving a Session Primer** below (gather context, verify, report, **STOP**). The **one** write permitted
     in that no-action window is to **consume the key**: append it to `consumed` in your private store. That
     consume is *outside the repo* (so the repo stays untouched on cold start) and is the *don't-stop-twice*
     mechanism.
   - **key ∈ your `consumed`** → you already consumed this one (benign re-read / restart). Do **NOT** re-trigger
     the cold-start stop; treat the body as historical context and proceed normally.
   - **`key: none`, missing key, or no primer file** → nothing fresh waiting for your role; proceed normally (the
     user will brief you).

Why the key sits in the **shared** primer (not copied into each private store): the header is the single
authority, so two eligible agents naturally see one identical key — no cross-store seeding, no human relay needed
to "share" it. What stays private is only your **consumed** set, so a restart doesn't re-stop you. Routing to
exactly one actor is **not** the key's job: if more than one eligible agent cold-starts on the same fresh primer,
each independently **reports-and-STOPs** and the **human picks who proceeds** (see Receiving a Session Primer).
The repo primer is the durable, human-readable brief; the key is its freshness token. *(How to write one →
**Session Primer** section below.)*

**Also at session start — poll your runway right off the bat.** As part of turn-1 startup (a read, so it's
allowed even inside the cold-start no-action window), poll the usage meter for *your own provider's* figures —
run **`node scripts/usage.mjs`** (the reusable parser; it hits `/usage` + `/tokens` on `127.0.0.1:9899` and prints
a compact per-provider session/weekly summary — don't hand-parse the raw JSON) — and note the reading in your
report. This is the same source of truth as the **Resource
Expenditure Monitoring** rule below; doing it up front means you know your headroom *before* scoping work, not
after. **Strictly best-effort, NEVER blocking** (the `claude` block often returns `ok:false` — LB-11): if it's
down or jittery, say so in one line and carry on. Do **not** retry it or treat a failed read as a blocker.

### Milestone 06 Key Features
- **Multi-Agent Consensus under Attach Mode**: The planner protocol successfully executes across isolated MCP client environments. Planners can engage in the `fact_collection`, `discussion`, and `proposal` phases, emitting structured JSON responses that map dynamically to MCP tool calls (`submit_plan`, `send_to_agent`, etc.) without dropping the connection.
- **Provider Multi-Turn State (`agy`)**: The `GeminiPersistentExecutor` was completely rewritten to maintain native persistent multi-turn execution (`agy --continue`) within isolated temporary homes per agent. This avoids fragile `stream-json` bridge issues and reliably simulates MCP-based agent statefulness.
- **Verified live**: In `scripts/test-live-gate.mjs`, two Gemini agents (`planner-a` and `planner-b`) execute fully isolated turns, successfully debate, reach consensus, submit a valid `plan.md` plan, and cleanly hand off execution to `worker-1` which completes the test end-to-end. Suite **139/139**, build clean.

### Milestone 05 Key Features
- **MCP Attach Mode (single-agent transport)**: AgentTalk runs as an MCP server; provider MCPs are **externally launched** by the operator (not auto-launched) and connect in over a persistent WebSocket.
- **Pull-based turn loop**: attached agents block on the `await_turn` MCP tool; the orchestrator enqueues turns per agent and replies route back via `send_to_agent`. A clean disconnect marks the agent `terminated` (not `error`), so stopping an external agent doesn't trip Milestone-03 failure propagation.
- **Verified**: codex, claude, and gemini each attach and complete a turn end-to-end via `scripts/attach-harness.mjs` (Model B; MCP invoked per turn, no MCP needed on the MCP side) + the web UI. `scripts/test-attach-mode.mjs` is an in-process smoke; full regression stays green.
- **Not yet (open follow-ups)**: multi-agent **consensus** mapping (the harness only emits `send_to_agent`, no `submit_plan`/agreement/work), clean **MCP-failure surfacing**, and the **native-loop/skill** path for claude/gemini. See `design/mcp-implementation-plan.md` (Phase 5) and `design/mcp-external-launch-proposal.md`.

### Milestone 03 Key Features
- **Agent Failure Propagation**: Active team tasks are now immediately interrupted if an agent enters an `error` state (including idle timeouts), eliminating deadlocks.
- **Refined Planning Protocol**: Protocol briefings are more direct and action-oriented, with explicit initiator/peer instructions and a "Proposal Priority" rule.
- **Improved Observability**: Added regression tests to verify task interruption on agent failure across all phases.

### Workflow Rules
- **Follow Collaboration Workflow**: Strictly adhere to the workflow defined in `design/collaboration-workflow.md`. That document is the source of truth for how we build things and must be followed at all times.
- **Document Before Implementation**: Do not rush to the implementation phase. Always document proposed code changes beforehand so that another agent can review and approve the plan.
- **Document Changes**: Always amend documentation to accurately reflect the code changes that have taken place.

### Core Behavioral Rule: Honesty over Results
- **Do not optimize for "passing" at all costs.** It is not the final result that matters most, but following instructions exactly and being completely honest about the state of the system.
- **Report the actual command output, not a remembered or optimistic summary.** Never claim a test suite or command passed without actually running it and reading the final output. Do not hallucinate test results or assume that because it compiles, it passes.
- **Never fix things silently.** If something is broken, doesn't add up, or requires an ugly hack (like a sleep in production) to work, **STOP AND RAISE IT**. Do not bury the problem to make a test pass.
- **Transparency is the goal.** A failing test with a clear, honest explanation of the obstacle is immensely more valuable than a green test achieved through a dirty hack. Let the human and the Reviewer agent do their job to help resolve the blockers.

### Resource Expenditure Monitoring  *(standing rule — applies to every actor except the human)*
From now on **every agent actor** (Planner / Implementer / Reviewer / any agent — **not** the human) **monitors its own
resource expenditure as it works.** The **primary metric is token consumption** (it's the binding constraint on how much
a session can do).

> **Strictly best-effort — NEVER blocking.** This whole mechanism is observability, not a gate. If the meter is down, a
> reading fails, or anything here doesn't work — **it doesn't work, carry on.** Do not stop, do not retry it, do not treat
> it as an error or a blocker. Resource accounting must never get in the way of doing the actual task.

- **Live meter (poll it, don't guess):** two endpoints (the bare `:9899` now 404s — see [[LB-11]]):
  `curl -s http://127.0.0.1:9899/usage` → per-provider (**claude / codex / antigravity(gemini)**) percentages
  (`current_session.used_percent` + `current_week_all_models.used_percent` + reset times); and
  `curl -s http://127.0.0.1:9899/tokens` → detailed cumulative 30-day token counts (claude-only so far). **Read your own
  provider's figures.** This is the source of truth for current spend; the in-context view has **no** live token meter.
  *(Exploratory — expect intermittent `ok:false`/jitter; best-effort, never blocking.)*
- **Per unit of action.** Track expenditure at the natural granularity of work — per task / turn / checkpoint (after heavy
  reads, live runs, merges, and at session start/end). Note it briefly; a one-line rough read is enough (don't bloat
  context to measure context).
- **Build a database of consumption.** Accumulate readings into the calibration table in `design/logbook.md` (**LB-11**):
  *session → work done → %-window* (+ which operations were heavy). Over time this yields a real *tokens-per-task-type*
  estimate, so complexity can be quoted **in tokens**, empirically — not memorised constants.
- **Task-closure telemetry block (Fausto, 2026-06-24) — emit a structured block when CLOSING a task** (merge /
  task done), into the task's `*-implementation.md` ledger entry, so future readers have a consistent
  cost+outcome record (not just prose). **Best-effort: include each field *when available*; if the meter is
  `ok:false`/down, write `telemetry: unavailable` for that field and carry on — never block closure on it.**
  Fixed shape:
  ```
  **Telemetry (task closure):**
  - task:        <id>                         (e.g. M08-T3)
  - wall-clock:  <start> → <close> (<Δ>)      (start from session stamp; close from the merge commit time)
  - budget:      weekly <a%→b%> (Δ ~x%), session <a%→b%> (Δ ~y%)  [per /usage; or `unavailable`]
  - gate:        tsc <0|n>, suite <p/p>, pollution <clean|…>
  - diff:        <N files, +adds/-dels>, commits <hashes>
  - outcome:     <MERGED ✅ / BLOCKED ⛔ / …>
  ```
  Keep it to those lines; the surrounding ledger rows hold the detail. This is the structured sibling of the
  per-checkpoint one-line read above — checkpoints stay lightweight; **closure gets the full block.**
- **Watch the residual + warn.** Keep an eye on the **percentage left** and **warn when it gets too low** so work can be
  scoped/closed cleanly instead of being cut off mid-task. *(Exact warning thresholds TBD — to be calibrated in the course
  of action.)* Note: the **weekly %** is the real cross-session budget; the **5h window** resets every few hours.
- **Known limits (best-effort, 2026-06-22 — we're in deep exploration).** The meter reports **per-provider, machine-wide
  percentages** — not per-actor or per-task, and **% of an opaque, flexing plan-window, not raw tokens** (token-denominated
  figures pending a service improvement). Per-action cost is only approximable by **diffing % before/after an action**,
  which holds for a **single serial actor** and **breaks under concurrency** (parallel actors share one provider quota,
  indistinguishably). **Interim rule (Fausto, 2026-06-22): run agent actors *serially* — no parallel actors — until
  per-actor attribution exists.**

## ⛔ IMPLEMENTER RULES OF ENGAGEMENT ⛔  *(READ BEFORE EVERY TASK — NON-NEGOTIABLE)*

> **This is the most important section for anyone implementing a task.** It is the operational teeth of
> "Honesty over Results." If you are the Implementer, these rules **override your urge to deliver a green
> result.** Breaking them gets the whole delivery **rejected** — a green achieved this way is worth *less*
> than an honest red.
>
> **These rules are the *law*; `design/implementer-pitfalls.md` is the *case law*.** Skim it before you
> start (it's part of your Rule-6 scope declaration): it records the concrete, recurring ways these rules
> get broken here — so you recognise the trap in yourself before the reviewer does.

**1. "Done" is NOT "tests green.**" Done = the change works **as specified**, **strictly within scope**, with
**all prior behaviour preserved**, **and honestly reported**. A green obtained by changing anything outside scope,
weakening a test, or altering existing behaviour is a **REJECTED delivery**. **A blocker reported clearly is a
COMPLETED deliverable for the round** — you are *not* penalised for an honest red; you *are* rejected for a
scope-creep green.

**2. ANY non-trivial behaviour change is a SHOW-STOPPER — report it, don't make it.** A behaviour change is
*anything* that alters how the app behaves — **including fixing a bug you discover.** You may make one **only** if it
is **completely trivial AND provably safe**, which means: **you can exactly predict *every* ramification and are
certain *all* are acceptable.** Any uncertainty, anything non-trivial, anything touching shared logic (the engine
`team-coordinator.ts`, registry/consensus, the protocol) → **STOP. Do NOT change it. Report it to the Reviewer *and*
the human supervisor.** **Finding a bug is your job; *fixing* it is not** — other already-passed tasks depend on the
current behaviour, and only the Reviewer/human can authorise changing it. **When in doubt, it is a show-stopper.**
Your mission is to deliver the spec'd change **or report the blocker** — *never* to make the system pass by any means.
(Touch only the files this task names; this also satisfies the M06 "behaviour change needs confirmation" rule above.)

**3. Persist WITHIN the box; never make the box bigger.** Don't give up on the first failure — debug, retry, fix
**within scope** (≈3 honest attempts). But **never** persist by *broadening scope*, *changing existing behaviour*,
or *weakening a test* to force a pass. "Keep trying within scope" = good. "Make scope bigger to go green" =
forbidden. When still blocked after honest attempts: **STOP and report the blocker** with a precise diagnosis.

**4. Try-it / test-it / report-it — don't reshape reality.** Run things **as they are**. See if they work. Test.
Report the actual outcome — including failures and error conditions you *didn't* clear. Other already-passed tasks
depend on the current behaviour; **silently changing it to make your task pass breaks them.** Surfacing an error
honestly > burying it.

**5. Self-check before you claim done.** Run `git diff --stat`. Confirm **every** changed file is in this task's
scope. If one isn't, **revert it** and report why you thought you needed it. Then re-read your claim: does it say
"passed" about anything you didn't actually run? Fix that.

**6. Declare understanding & scope BEFORE you touch anything.** Before writing any code, state **in your own
words**: (a) the **scope** — which files/behaviour you may touch and which you may **NOT**; (b) what **"done"**
looks like for this task; (c) the **approach** you'll try first. This is a checkpoint: a wrong scope statement gets
corrected *before* work, not after. Do not start until you have written it.

**7. Pre-register a retry budget PER TEST — and when you stop, actually STOP.** The budget is **per individual
test/verify cycle — NOT one number for the whole task.** For **each specific test/check** you are trying to get
passing, decide and state *its own* max attempts, calibrated to *that check's* complexity (e.g. *"test X: max 2"*).
"One attempt" = one run of **that** test + one in-scope fix. **Lock the number before you see the result** — no "I'm
close, just one more." Count out loud (*"test X, attempt 2 of 2"*). On the final attempt say so —
*"last attempt on test X; if it fails I STOP and report"* — and if it fails, **STOP and report. STOP MEANS STOP:**
end your turn, hand back to the Reviewer/human, and do **not** keep working, exploring, or "trying one more thing."
**Declaring a stop and then continuing is itself a violation** (it's what got the last attempt rejected). **STOP at
the EARLIER of:** the show-stopper fence (Rule 2 — even on attempt 1), **or** that test's budget. The budget governs
**in-scope persistence only** — it never licenses scope expansion or behaviour changes.

**The gold-standard response when blocked** (imitate this):
> ✅ *"I did the in-scope change. The live test then exposed a **pre-existing engine race** (a late consensus
> message crashes both agents). That's the engine — **out of my scope** and likely the deferred M08 fault-tolerance
> issue. **I did NOT modify it.** STOPPING and reporting; this needs a scope decision."*
>
> ❌ *(forbidden)* "I patched `team-coordinator.ts` to ignore the late message so the test would pass."

### Session Primer (cold-start context brief) — NOT the per-turn baton

> **Two different things, two different names — never conflate them:**
> - **Session Primer** *(this section)* = a self-contained context summary written at session end and saved into the
>   appropriate **role-primer file**, so a cold-start reader (new context window, the human, or another agent) boots
>   with **zero prior context** after the shared header key proves the primer is fresh for that role.
> - **Baton** (a.k.a. "hand-off" in casual use) = the per-turn pass of work **between roles inside the workflow**
>   (planner→implementer→reviewer) — a dev-turn report/instruction. That is a *different* thing; it lives in the ledger
>   log and the chat, and it does **not** trigger the cold-start rule below.

**Writing a Session Primer.** When the user asks for one — or at a clean stopping point before a fresh session — write
**one tight, self-contained block** so the cold-start reader can orient with zero prior context. A Primer is
**addressed to the next holder of the *role*** (whoever next picks up planner-reviewer, or implementer — not a
specific agent), so write it in the second person to that successor and keep it **agent-neutral** where you can —
the few agent-specific bits (your provider's budget, a CLI quirk) are written fresh for whoever you expect to hand
to. It MUST **open with the exact sentence "This is your session primer."** (so the reader instantly recognises the
cold-start contract and the report-only rule below kicks in), and it MUST contain:
1. **Project micro-description** — what AgentTalk is, in 1–2 lines.
2. **Roles** — the human (Fausto) and the role map: **planner-reviewer → Claude *or* Codex**, **implementer → Gemini**,
   human = scope/decisions/relay; name **which role this primer is for** (and, if it matters, which agent you expect to take it).
3. **Workflow / source of truth** — `design/collaboration-workflow.md` (the method) + the artifacts: `*-plan.md` (spec+DoD), `*-implementation.md` (the **ledger**), `backlog.md`, `logbook.md`.
4. **Which epic/task we're on** *(REQUIRED — always state the active milestone/epic/task)* + what's next.
5. **Where state lives** — resume from the active epic's `*-implementation.md` ledger, **not from chat**.
6. **Op notes** — key/env gotchas, current blockers.

Keep it tight; the ledger holds the detail.

**Save it to the role-primer + mint a fresh key (don't paste into chat).** (1) Generate a fresh key (e.g.
`YYYYMMDD-HHMM-<rand>`); (2) overwrite `design/session-primers/<role>-primer.md` (`planner-reviewer-primer.md`
or `implementer-primer.md`) with header `role: <role>`, `key: <fresh-key>`, `written: <date> by <agent>`, then
the body (starting with the exact opening sentence). **That's it** — the key lives in this shared header, so it's
already the same for every eligible reader; there is **no** per-agent `active` to seed, no cross-store relay.
Overwriting the repo file is safe — git history keeps every prior primer. Whoever you hand to (Claude or Codex
for planner-reviewer; Gemini for implementer) cold-starts, finds this key **not** in their own `consumed`,
reports, STOPs, and consumes it in **their** store (see **First Entry Point**). If you want to leave the role
**un-handed** (no fresh cold-start due), set `key: none`.

If the human pastes a self-contained brief in chat while the role-primer says `key: none`, treat that as a
normal human brief: verify it against the repo and follow the user's explicit instructions. It does **not** by
itself trigger the private-store consume path, and it is not a substitute for a fresh keyed role-primer when the
goal is to hand off a cold session.

**First-time bootstrap (no key store yet).** The very first time an agent runs this — no private key store
exists — is a one-time **manual** setup, done with the human. With no store, any real fresh key reads as *not
consumed* → the agent would cold-start-stop on that role-primer; that's harmless (it just reports and waits), but
seed the store so the consumed-tracking works. `key: none` still means no fresh primer is waiting and proceeds
normally:
1. **Create your private key store** at your per-agent, per-project, *outside-the-repo* location, as
   `{ "consumed": [] }`. Claude Code → `~/.claude/projects/<project-slug>/session-primer-key.json` (alongside
   `memory/`). Codex → its stable private dir, e.g. `~/.codex/agenttalk-session-primer-key.json`. agy/Gemini →
   the equivalent **stable** private config/home dir — **never** the repo, **never** an ephemeral per-turn exec
   home (those are wiped). If you don't know your MCP's stable private path, **ask the human** — don't guess.
2. **The role-primer filename is fixed** by your role: `design/session-primers/planner-reviewer-primer.md`
   (Claude/Codex) or `implementer-primer.md` (Gemini). Keep the `-primer.md` suffix so it can't be auto-loaded as
   a `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` context file on a case-insensitive filesystem (LB-12).
3. From then on the handshake is automatic: read the role-primer's key, compare to your `consumed`, act/consume.
   *(Claude's store bootstrapped 2026-06-22 — migrate it to the `{consumed:[]}` shape on next write. Codex was
   bootstrapped 2026-06-26 at `~/.codex/agenttalk-session-primer-key.json`; agy/Gemini is pending its first run.)*

**Receiving a Session Primer — GATHER CONTEXT ONLY, then STOP.**
> **Critical rule.** When you load a **key-matched `fresh` role-primer** (per **First Entry Point**), you MUST NOT take any action — **no code, edits, builds, test runs, scripts, or commits**
> (the lone exception: consuming the key in your private key store, which lives *outside* the repo). Your *only* output is a **report of your understanding**:
> what the project is, which epic/task is active, where it stands per the ledger, and what you believe the next step is —
> nothing more. Then **STOP and WAIT** for the human's explicit go. **Naming the next step is context, not permission.**
>
> **Do NOT trust the Primer blindly — verify it against the project, now.** The Primer is a *claim about state*, written
> at some past moment; it can be stale, wrong, or written by an over-optimistic predecessor. Before you report, **ground
> every load-bearing statement in the actual project state** — read the ledger Status line + log, the named plan/spec, and
> the files/branches/contracts the Primer references (this is read-only context-gathering, which the no-action rule above
> allows; it is **not** starting work). If anything is **off** — the ledger says a different task is active, a "DONE/merged"
> claim isn't reflected in git, a referenced file/branch/contract is missing or changed, the hashes don't match — **say so
> immediately and prominently** in your report rather than parroting the Primer. A Primer that disagrees with the ground
> truth is itself a finding worth surfacing.
>
> **Why:** the same fresh role-primer may be seen by **more than one eligible agent at once** (e.g. both Claude *and*
> Codex are eligible for planner-reviewer). This is expected — the key does **not** route to one of them; it's a
> freshness token they all share. If each started developing on receipt they'd collide — duplicate branches, racing live
> runs, stray worktrees/processes, lost work. So **reporting-only-then-STOP is the actual collision guard**: each
> eligible reader independently reports and stops, and **the human decides who proceeds**. *(This rule is about the
> Primer/cold-start only — a mid-session **baton** to you as implementer/reviewer is a normal task assignment, not a cold start.)*

### Re-priming from an older primer (human-gated)

A **consumed** key can only ever produce a *benign re-read* (proceed normally, no gate). When you instead need a
cold instance to run the **full cold-start orientation** from an *older, already-spent* primer — e.g. a fresh
context window whose only durable brief is a primer you already consumed — use **re-priming**.

**Principle: fresh key + old body — never recycle a consumed key.** The primer *body* is durable (git history
keeps every prior `<role>-primer.md`), so re-priming re-arms a capability against a recovered body. It MUST mint
a **fresh** key (a key already in someone's `consumed` only ever yields a benign re-read, never a fresh stop).

**Gate: soft (human-approved).** The human decides to re-prime and gives the go-ahead **first**; only then does the
agent perform the ritual. The private key store is the agent's to write, so this gate is **behavioural, not
enforced** — mint the fresh key *only after* the human approves.

**Ritual** (agent performs, after approval):
1. Recover the old body: `git show <commit>:design/session-primers/<role>-primer.md`.
2. Mint a fresh key (`YYYYMMDD-HHMM-<rand>`).
3. Overwrite `<role>-primer.md` with: header `role: <role>`, `key: <fresh-key>`, `written: <date> by <agent>
   (re-primed)`, **`reprimed_from: <commit>`** (audit trail), then the recovered body.

The next cold instance finds the fresh key **not** in its `consumed` and runs the normal full cold-start gate
(gather context, **verify the recovered body against current ground truth** — it may be stale by definition —
report, STOP, consume). Re-priming changes nothing in the handshake; it only *produces* a fresh primer for it to consume.

### The baton (per-turn hand-off) — pointers, not transcript

A baton passes work between roles when both sides already
share the same artifacts — the ledger, the plan, AGENT.md. Write it, therefore, as a **pointer, not a transcript.** Open
by naming the pass itself — the role you are leaving and the role you are handing to (e.g. *"Planner → Implementer"*) —
then name the task and its branch, point to the ledger rows that *are* the spec, and add **only what cannot be derived
from the artifacts**: a fresh decision, a non-obvious gotcha, the single fact that would otherwise cost the reader an
hour. Resist re-stating the spec in the message. Every line you copy out of the ledger is a line that can later drift
from it, and a baton that contradicts its own source is worse than no baton at all; worse still, a pre-chewed brief
quietly invites the receiver to follow *your* summary instead of the source of truth. Trust the receiver to close the
gaps the way the workflow expects — by reading the artifacts and the Rules of Engagement — rather than predetermining
them. This is the exact mirror of the Session Primer above: a **Primer is self-contained** precisely because its reader
is *cold*; a **baton is a pointer** precisely because its reader is *not*.
