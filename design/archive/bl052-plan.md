# BL-052 — the sandbox must contain the WORKER

**Status:** plan · **PO go:** granted 2026-07-16 (hard error on missing base dir)
**Repo:** `agentalk-mcp-client` · **Branch:** `bl052-worker-containment`

## The defect

`lib/agent-launcher.mjs:90` spawns the worker with **no `cwd`**, so it inherits the launcher's working
directory. In the BL-040 D4 acceptance run that was a real checkout, and the worker — obeying a prompt that
orders it to "use strictly `git worktree`" — created a worktree, wrote files, and committed (`4193a4e`) into
`agentalk-mcp-client`. `/tmp/att-sandbox` sandboxes the **orchestrator**; nothing constrained the **worker**.

Containment today rests on `agents[].workdir`, which *is* honoured (`agent-launcher.mjs:88` → env
`AGENTTALK_WORKDIR` → `llm-agent.mjs:78-81` `process.chdir()`) — but is **optional**, and its absence silently
inherits. **No config or caller in either repo passes it.** The failure is invisible: the worker does not
crash, it does competent work in a directory nobody chose.

## Decision (PO)

A missing base dir is a **hard error**, not a silent inherit. Rationale: when the default is dangerous and the
violation produces no signal, refusing to start is the only design where the safe path is also the easy path.
There is no legitimate current user of the inherit behaviour to protect.

## Scope (Rule 6 declaration)

**May touch** (all in `agentalk-mcp-client`):
- `lib/agent-launcher.mjs` — the fix.
- `__tests__/agent-launcher.test.mjs` — contract update; the fail-open expectation is what the PO approved changing.
- `__tests__/bite0-launcher.e2e.test.mjs` — its launch path passes no workdir.
- `scripts/explore-launch-worker.mjs` — same.
- `bite0.config.example.json`, `scripts/bl040-d1d3.config.json`, `wire-contract.json` — add `workdir`.

**May NOT touch:**
- `lib/executor-runtime.mjs` — the dead `exec_rpc` cwd (lines 162/679 hardcode `process.cwd()`). Same safety
  story, different layer → **separate item, filed as BL-053.** Folding it in would make the diff unreviewable.
- `in-process-driver.ts` / the orchestrator engine — the orchestrator sandbox already works.
- `/home/fausto/Software/wt-count-task` + branch `task-count-1-10000` — **the D4 evidence. Left for the PO.**

## Design

1. **Validate before side effects.** The check sits beside the existing `provider` check at the top of
   `launchAgent`, i.e. *before* the orchestrator `POST /api/agents` — a refusal must not leave a half-created
   agent record behind.
2. **The boundary is `launchAgent`.** Not the config layer: every path funnels through here, including
   `POST /agents` over HTTP. Validating higher up would leave the direct + HTTP callers fail-open — the hole
   being closed. Accepted cost: `POST /agents` now rejects bodies it used to accept.
3. **Three refusals, all `400`:** `workdir` missing · not absolute · not an existing directory.
4. **Do not auto-create.** Create-if-missing makes any typo a fresh valid sandbox — a softer fail-open.
5. **Spawn with explicit `cwd: workdir`**, and keep `AGENTTALK_WORKDIR` (llm-agent's own `chdir` stays as
   defence in depth).
6. **Filesystem access is injected** (`isDirectory` dep, defaulting to a real `fs.statSync`) so the core stays
   unit-testable without touching disk, consistent with the existing `spawn`/`fetch` injection.

**Deliberately NOT in scope:** restricting `workdir` to a blessed root. A required-but-arbitrary workdir still
permits a real repo — it just makes it explicit and auditable. Policy enforcement is a separate call (BL-054).

## Done

- `launchAgent` refuses missing/relative/nonexistent workdir with 400, before any orchestrator call or spawn.
- The worker process is spawned with an explicit `cwd`.
- Existing suite green; new tests cover each refusal + the explicit cwd.
- Configs updated; BL-053/BL-054 filed.

## Retry budget (Rule 7)

- unit suite `agent-launcher.test.mjs`: **max 3** attempts.
- full `agentalk-mcp-client` suite: **max 2**.
- Any failure implicating an out-of-scope file → **STOP** at the show-stopper fence, even on attempt 1.

## Gate honesty

Authored and reviewed by the same actor (Claude), Codex + agy unavailable. Gate 1 here is **self-review** — a
declared weakness, not a real independent gate. Merge stays PO-gated.
