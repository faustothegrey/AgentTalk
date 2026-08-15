---
role: implementer
key: none
written: 2026-07-27 by Claude (session close — all three rung-4 findings closed and PUSHED)
key_retired: 2026-07-28 by Claude, ahead of the machine move. Was `20260727-0852-b3d91e`, consumed on the old
  machine. The Claude key store is keyed by the repo's ABSOLUTE PATH, so a move to Linux lands in a different
  project slug with an EMPTY `consumed` — and a spent key in an empty store reads as *fresh*. Without this
  retirement the new machine would cold-start-stop on two primers at once (this and the planner's) with no way
  to tell which is the live hand-off. `none` = no fresh cold-start due for the implementer seat; the body below
  stays as historical context. See PORTING.md §6.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents***
(PO, 2026-07-15), so you are likely sole agent under the **resource-scarcity fallback**: wear every hat, do the
handshake once per role, declare all of them, keep each gate separately. **Standing Conditional Reassignment
ACTIVE** (you may implement). **"merge" and "push" are SEPARATE words and the PO means it** — stop at each and
wait for the literal word. It held all of this session.
**Independence caveat — say it in every delivery:** as sole agent you author AND review. What actually catches
things is **running the code and checking the artifact**; never a re-read of your own diff, and never a status
field.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify HEAD against
`origin/master`. Never trust a primer's hash — including this one.

**Workflow / source of truth.** `modules/governance/docs/collaboration-workflow.md` + `design/backlog/` (BL items, one file
per concern since 2026-08-15) + `AGENT.md`.
Plans live in `design/bl0NN-*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item —
read those first.** Resume from the backlog and plan docs, **NOT from chat**.

## Where we are (2026-07-27 close)

**Both repos PUSHED and in sync — verify by fetching:** AgentTalk `f0eb7ee`, `agentalk-mcp-client` `de65c30`.
No worktrees or task branches of mine left in either. Green bars as of close: AgentTalk **`tsc -b` 0 · suite
407/407** (70 files); client **lint 0 · 89/89** (15 files).

**Shipped this session — all three rung-4 findings, each PO-gated, merged and pushed:**
- **BL-077** (`e25f9dc`, AgentTalk) — driver-owned status transitions now reach connected clients. The UI no
  longer freezes at `starting`, so it is a trustworthy live witness of an autonomous run again.
- **BL-075** (`de65c30`, **client repo**) — the one-shot executor honours the assigned task worktree. Per-task
  isolation is real for goose, and for any provider running `one_shot`.
- **BL-076** (`6849356`, AgentTalk) — the worker's report survives the protocol instead of being replaced by the
  literal `'Task completed.'`.

**Read this before you trust any backlog item: two of those three items' own diagnoses were WRONG where it
counted, and reproducing first is what caught it.** BL-077 claimed the broadcast was missing (it wasn't — the
driver bypassed the registry). BL-076 claimed non-JSON responses lost the report (they don't — that branch already
submits raw text; the loss was in *parsed-but-not-a-verdict*, and the **retry prompt** was converting survivable
responses into lost ones). **A finding filed live, from memory, hours after the run is a hypothesis. Reproduce it
at the seam before you design against it.** Both times the reproduction changed the fix.

## What's next — PO picks (no fresh task assigned; report + STOP for the go)

1. **BL-078 — needs a PO DECISION, not implementation.** An in-process/API agent that errors in its driver loop
   has never interrupted its team's task (that path never went through `setAgentStatus`). BL-077 left the
   semantics unchanged and **pins them with a test**, so if the answer is "it should propagate", that test is the
   first thing to change. Compounds with the dead idle timeout (LB-70/BL-028): neither a hung nor an errored
   in-process agent interrupts anything today.
2. **More rungs / a real multi-task epic on the substrate, measured.** Rung 4 is still a *datum, not a trend*; the
   program's actual claim — a measured fall in the PO's relay burden across a real dev epic — remains unproven.
   The three fixes above were aimed squarely at making such a run observable and containable.
3. **Small, well-shaped items** if you want a warm-up: **BL-079** (dangling sourcemaps in the client — every test
   run emits a wall of ENOENT noise), **BL-050** (Team view doesn't show which team you're in), **BL-047** (API
   agents not reusable across conversations — I reproduced it live this session, incidentally).
4. **The deferred BL-024 T3b-2 remainder** — drop the legacy `provider` *input*, migrate ~12 scripts + a
   recordings shim. **⚠️ Its plan doc `design/archive/bl024-t3b-plan.md` is UNTRACKED and has never been committed** — it
   exists on the PO's machine only. If you take this, commit it first or you are working from an artifact that
   does not exist for anyone else.

## Op notes / gotchas

- **Running a real goose worker (the live-proof vehicle).** Bite-0 launcher:
  `node <agentalk-mcp-client>/scripts/launcher.mjs <config.json>` — the launcher lives in the CLIENT repo,
  and is invoked by absolute path (never `cd` into it). Config needs `provider:"goose"` + an
  explicit **`model`** — **`anthropic/claude-sonnet-5` over OpenRouter is verified working** (`OPENROUTER_API_KEY`
  set; goose CLI 1.41.0). Set **`AGENTTALK_GOOSE_MAX_TURNS=50`** for a small task (the default 30 starves a real
  one; 150 for real dev work). `startCommand` boots the orchestrator — point its `cwd` at **your worktree** if you
  want your own fix exercised, and put `PORT` in `instance.env`, **not** in `startCommand.env`. `runs/` is
  gitignored, so configs there are disposable. Two runs today, both clean, ~4 min each, ~7-13% of a session window.
- **`AGENTTALK_RESPONSE_LOG` — set it on every live run.** It is the BL-064 sidecar that files the agent's RAW
  response. I forgot, and consequently could not tell which protocol branch BL-076's live run took, which cost me
  a load-bearing claim. It is one env var. Set it.
- **`completed` ≠ done (BL-062). Check the ARTIFACT — and at BOTH paths.** Post-BL-075 goose works in
  `<workdir>/agentalk-task-<id>`; before it, the workdir's main tree. When judging any run, look in both and say
  what is at each. An artifact check at the wrong coordinates is *worse* than none — it manufactures false
  confidence and a paper trail (BL-059).
- **`AGENT.md`'s per-provider `cwd` table was stale and is now corrected** (2026-07-27 STATE UPDATE in the agy
  block). Today gemini, codex and every one-shot provider honour the forwarded `cwd`; **claude on the persistent
  path is the sole exception** and structurally cannot be per-turn.
- **A live UI check is cheap and worth it.** `PORT=3100 npm run dev` (vite proxies `/ws` to the backend via the
  same knob). Real Chrome drives it via Playwright with `channel: 'chrome'` — **no browser download needed**; the
  cached Playwright chromium builds are the wrong version, so `channel: 'chrome'` is the fast path.
- **Worktrees:** `node scripts/wt-setup.mjs create <BL-id> --base origin/master` (AgentTalk only — the client repo
  has no such helper, use plain `git worktree add`). It wires `node_modules`, so **stage files EXPLICITLY, never
  `git add -A`.**
- **Gates:** AgentTalk `npx tsc -b` (uses `exactOptionalPropertyTypes` — a conditional spread is the idiom) +
  `npx vitest run`; `npm run backlog:check` gates the backlog (update BOTH the header `status:` and the prose).
  Client: `npm run lint` + `npm test`.
- **Meter:** `node scripts/usage.mjs`. **Healthy this whole session** (unlike rung 4's `ok:false`) — session ran
  9% → ~36%, the two live goose runs dominating. Best-effort, never blocking.
- **Left deliberately untouched:** the PO's modified `com.fausto.agenttalk-orchestrator.plist`, and the stale
  `task-BL-039` branch (the pre-renumbering ancestor of BL-046 — almost certainly dead, but not mine to delete).

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
