# Backlog — mcp-transport

Open items owned by the **mcp-transport** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-070
status: deferred
date: 2026-07-18
epic: null
tags: [flake, tests, client, reproduce-or-park]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the client suite actually goes red on it, or client test reliability blocks an autonomous run · **low priority — reproduce-or-park, no urgency** · sibling of [[BL-065]], found during that session · CLIENT repo (`agentalk-mcp-client`)] — **`exec-rpc.test.ts > "propagates the CLI agentId into nested persistent MCP bridge URLs"` can time out under cold + load: a suspected timing flake.** During the BL-065 repro session (2026-07-18), this test (`__tests__/exec-rpc.test.ts:199`) **timed out at 5000ms once**, under the same cold-`.vite` + CPU-load condition that reproduced BL-065. It was **out of BL-065's scope, not chased, and not touched** (Rule 2 — report the fault, don't silently fix it).

  **Why it's a distinct failure class from BL-065.** BL-065 was a **~271ms race** on a *string* (a fixed 250ms sleep lost to an async `'close'` event), and its fix removed the racy wait with the assertion unchanged. This one is the **opposite shape: a genuine slow-test timeout** — the test is a heavy end-to-end bar that spawns a **real `llm-agent.mjs` child** (`--provider gemini --execution-mode persistent`), waits for it to connect to a mock MCP WebSocket server, and drives a full `exec_rpc` MCP round-trip — all inside vitest's **default 5000ms** per-test budget. On a cold/loaded first run the spawn + connect + round-trip can simply exceed 5000ms. So the plausible causes are (a) an honest slow-machine timeout the bar should tolerate, and/or (b) a real latency regression somewhere in the persistent-bridge spin-up — **not yet distinguished.**

  **Reproduce before scoping (learn from BL-065: use the ACTUAL observed condition, not a proxy).** Run the full client suite repeatedly in a **fresh worktree with cold `node_modules/.vite`** under CPU load (BL-065's `node scripts/usage.mjs` heavy-load recipe; `pkill -x yes` after, assert `pgrep -x yes | wc -l` == 0). Uniform load *hid* the BL-065 race, so don't assume it will surface this one either — read the BL-065 recipe literally. Also try `--no-file-parallelism` / `--pool=forks --poolOptions.forks.singleFork` to change worker scheduling.

  **Park condition & guardrail.** If it will not reproduce, **park it and say so** — do not "fix" it by blindly bumping the 5000ms timeout, which would hide a real spin-up regression if that's what this is. Any fix must first **attribute** the latency (slow box vs. regression): if it's genuinely just a slow-machine ceiling, a *justified, documented* timeout bump (or waiting on observable connection state instead of a fixed budget) is legitimate; if it points at a real bridge-spin-up regression, that's a product finding to file separately, not a test tweak.

  **Source:** observed 2026-07-18 while landing the BL-065 fix; recorded in the BL-065 closing block ("Sibling flake found").

<!-- @item
id: BL-034
status: deferred
date: 2026-07-13
epic: null
tags: [observability, ui, attach-mode, client-repo]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: attached-PTY agents return to the critical path · surfaced 2026-07-13 (PO + Claude design chat)] — **PTY-tee observability panel — surface each attached
  agent's real interactive TUI beside the AgentTalk UI** — the attach client (`agentalk-mcp-client`) already runs each
  provider as its **real interactive TUI inside a PTY** (`claude-pty.mjs` / `codex-pty.mjs` / `gemini-pty.mjs`,
  node-pty): it types the prompt in as keystrokes and reads the screen back. That TUI stream already exists but is
  **consumed silently** by the executor to parse the answer (`llm-agent.mjs` forwards only `stderr`, not the PTY
  `stdout`). **Proposal:** add a **flow-neutral observer tee** of `pty.onData` to a per-agent sink (log file or a
  second read-only PTY), then view it live via a web terminal (**wetty**/**ttyd**, or an embedded xterm.js panel) next
  to the conversation panel — giving the PO real-time visibility into what each agent is *actually doing* (thinking,
  tool calls, errors), not just the orchestrator's final messages. **Scope/notes:** the tee lives in the *ancillary*
  `agentalk-mcp-client` repo (pure-relay today — small observability addition, no orchestration-path change); it is
  **read-only** (typing into the mirrored TUI would fight the client's keystroke puppeteering — a true take-the-wheel
  hand-off is separate, larger work); and it exposes a shell/CLI stream, so any non-`localhost` surface needs
  auth/TLS. Related: the TUI-scraping model is also why provider "thinking" preamble sometimes leaks into replies.
  Source: 2026-07-13 design discussion following the wetty question.

<!-- @item
id: BL-038
status: deferred
date: 2026-07-15
epic: null
tags: [self-hosting, attach, native-loop, goose, openrouter, provider-diversity]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: claude/opus stops being the in-session provider, or a second lane is actually needed · surfaced 2026-07-15 (PO)] — **Native-loop attach lane via Goose + OpenRouter** — enable MCP-attach agents
  backed by OpenRouter models, driven by **Goose** running the `attach-skill.md` poll loop
  (`await_turn`→work→`submit_*`→`await_turn`). This is the **native-loop/skill lane** (M05 open follow-up), distinct
  from the built PTY-harness lane (claude/codex/gemini via `llm-agent.mjs`). Value: restores **independent agents
  (workers AND reviewers) without Codex/agy**, and adds provider diversity for Bite 1+. **Known blocker:** the
  server demands `clientInfo.contractHash` at `initialize` (LB-66); a generic MCP client can't know it — needs a
  bridge that injects the hash (à la `bridge.mjs`/BL-017) or server-side handling for skill-path agents. Deliberately
  **off Bite 0's critical path** (Bite 0 uses the built Claude-via-launcher worker). Source: PO, this session.

<!-- @item
id: BL-079
status: deferred
date: 2026-07-27
epic: null
tags: [hygiene, tooling, observability, agentalk-mcp-client, low-severity]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the noise ever actually masks a real failure · filed from BL-075, 2026-07-27 · **claim CORRECTED at the 2026-07-27 gate — see the measured note at the
  end; it is 4 of 10 files and ~4 lines, not "every file" and not "a wall"**] —
  **`agentalk-mcp-client`: some `lib/*.mjs` point at a sourcemap that does
  not exist, so every test run emits stray ENOENT lines** — the affected `.mjs` files each carry a trailing
  `//# sourceMappingURL=<name>.js.map` comment (left over from when they were emitted from TypeScript), but **no
  `.js.map` file is committed and none exists in any checkout**. Vitest/vite therefore prints a multi-line
  `ENOENT … .js.map` + stack for *each* module it loads, on every run. **Purely cosmetic — no test is affected** (BL-075's
  suite was 89/89 through the noise). **Why it is worth fixing anyway:** the noise is large enough to bury a real
  error in the scrollback, which is exactly the failure mode that costs an hour at the wrong moment; and it makes
  every clean run *look* broken to a newcomer. **Fix directions:** strip the dangling `sourceMappingURL` comments
  (the `lib/` sources are hand-maintained JS now, not build output), or commit the maps, or silence the loader.
  Pick one — the current state claims a build artifact that the repo does not have. Source: observed during every
  BL-075 test run.

  **MEASURED at the 2026-07-27 gate — the original severity was overstated, and the justification with it.**
  Actual: **4 of 10** `lib/*.mjs` carry a dangling `sourceMappingURL` (`executor-runtime` · `protocol` ·
  `provider-runtime` · `request-id`), and a real `npm test` emits **4** matching lines, with the suite **93/93**
  green — not "every module" and not a multi-line stack per module. So the "noise large enough to bury a real
  error" argument **no longer holds**; this is now purely cosmetic tidying. Kept `todo` because the repo still
  claims a build artifact it does not have, but it should not be prioritised on the buries-an-error grounds.


*(add new items above this line)*
