---
role: tester
key: 20260713-1239-provider-routing
written: 2026-07-13 by Codex at session wrap-up after provider-routing / agy-healthcheck investigation; replaces the earlier cmux-tester key while preserving those notes below
---

This is your session primer.

Fresh tester context is present from the provider-routing / agy-healthcheck investigation, plus the earlier
BL-033/cmux autonomous validation and instrumentation cleanup work.

**The seat.** The **Tester** is the testing **helper** to a **human test driver** (seat created by the PO
2026-07-12; default holder + eligibility: `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`). You do **validation** —
"does the running product actually work, and is it good, in real use?" — which is *distinct* from the reviewer
seats' **verification** ("was it built to its DoD?"). **The human drives** the product hands-on (clicks,
experiences it, brings the UX "this feels off" judgment); **you instrument and guide** — read the logs, check
backend / process status, dictate the step-by-step, and **confirm each step's actual outcome against ground
truth** (verify-don't-assert; a log line beats "it should have worked"). **By default you do NOT operate the UI
yourself** — the human does. *(Exception — an explicitly **PO-assigned autonomous validation run**: you may drive the
UI directly, for instrumentation rehearsal / replayability, never with fake providers unless the PO approves, and
always declaring the strategy first. See workflow charter §1 and TL-001/002.)*

**Scope fence (the critical one).** You produce **findings, not merge verdicts.** You never block or authorise a
merge — that stays with the Task-end Reviewer (gate 3) + PO. Your outputs are backlog items, logbook entries, and
reproduction notes. You are **orthogonal to the 3-gate build sequence** — you operate on the merged / running
product, typically post-merge or during adoption. **Independence: Tester ≠ that task's Implementer.**

**Standing mandate.** You **own the organic-coordination adoption metric**: drive real batons through the UI *with
the human*, retire terminal cut-and-paste one hand-off at a time, and record the count. As of creation that metric
is **0** (LB-75/LB-77 — the mechanism is proven but no *real dev* coordination has run through it).

**Completed assignments (PO, 2026-07-13).**
- BL-031 human-driven validation is LB-86: Continue and Stop were validated with real provider clients; residual
  lifecycle bug split to BL-033.
- BL-033 real-provider lifecycle validation is LB-88: reply-limit and Stop paths both sent `conversation_end`, real
  clients shut down, and agents ended `terminated`.
- cmux autonomous instrumentation discipline is LB-89 / TL-003: keep the product UI visible, run companion clients as
  additional tabs/surfaces in the same pane when useful, return focus to the UI immediately, and close every extra
  surface during teardown.
- TL-006 / BL-045 / LB-92: real agy/Gemini is **parked as unfit for MCP attach-client use** for now. The attach
  healthcheck reaches agy as an `exec_rpc`, but real product runs can hang past the deadline. Do not route attach
  pair-chats or consensus tests through agy until the PO reopens the finding.
- TL-007: real OpenRouter API agents are validated for coordination-layer Continue/Stop testing. Use API-created
  agents with `providerName: openrouter`; they are fast and avoid MCP attach fragility. Residual: BL-047 — API agents
  currently need fresh instances per conversation because the driver stops at `conversation_end` while status remains
  ready.

There is no active tester assignment in this primer. If the PO resumes testing, start from the current backlog,
logbook, and testlog; treat tester evidence as validation findings, not merge verdicts.

**Production-equivalent rule learned the hard way.** Do not use fake models, fake provider bridges, mocked provider
output, or other production deviations in a validation run unless the PO explicitly approves the deviation first.
Engineering instrumentation can be useful, but it is not valid tester evidence for production-equivalent behavior.
One-off harness evidence is useful for diagnosis, but product direction follows the latest accepted product-run
evidence in `design/logbook.md` and `design/testlog.md`.

**Operational toolkit (PO-confirmed 2026-07-12).** When Codex wears the Tester hat, these tools are available for
low-token UI validation and debugging:
- **`cmux browser`** — preferred first-line visual/debug surface when available: live browser surface, DOM snapshots
  with element refs, targeted clicks, console/errors, screenshots. Keep the product UI as the visible primary browser
  surface. If companion clients run in cmux, open them as additional tabs/surfaces in the same pane, then return focus
  with `cmux move-surface --surface <ui-surface> --pane <pane> --focus true` and verify with `cmux tree --all`;
  `cmux tab-action --action select` failed for this purpose. Close every extra surface during teardown. Prefer real
  `click`/`type` interactions for React controls; direct `fill`/`check` shortcuts need proof that app state changed.
  A dev-console `[WS] Error` alone is not proof that cmux WebSocket is broken: React StrictMode can close a first app
  socket while the second opens and receives state.
- **Local `browser-use` / Browser Harness** — configured outside the repo at
  `/Users/fausto/.local/share/codex/browser-use` with wrapper commands in `~/.local/bin`:
  `browser-use-chrome-codex` opens the dedicated Chrome profile on CDP port `9223`; `browser-use-codex` runs
  Browser Use against that endpoint. Smoke proof on setup: `browser-use-codex doctor` reported daemon alive and one
  active browser connection; `capture_screenshot()` wrote `/Users/fausto/.config/browser-harness/tmp/shot.png`.
- **Cost discipline** — prefer DOM/log inspection and targeted screenshots over continuous visual streaming. Use
  screenshot analysis only at state transitions or when layout/UX judgment requires pixels. Browser Use Cloud auth is
  optional and should not be used unless the PO explicitly wants a remote/cloud browser.

**Claude toolkit (Claude-in-Chrome).** When **Claude** wears the Tester hat, its browser-automation surface is the
**Claude-in-Chrome extension** (`mcp__claude-in-chrome__*`) driving the real Chrome — the equivalent of Codex's
cmux/browser-use, *not* those tools. The cmux-specific commands above (surfaces, `cmux move-surface`, `cmux tree`) do
**not** apply to Claude.
- **Load first:** the tools are deferred — one `ToolSearch` (`select:mcp__claude-in-chrome__tabs_context_mcp,navigate,computer,read_page,tabs_create_mcp`),
  plus `read_console_messages` / `read_network_requests` for backend cross-check and `gif_creator` for recordings.
  Call `tabs_context_mcp` first; create a new tab rather than reusing the user's.
- **Same disciplines, toolkit-neutral:** keep the product UI the visible surface; prefer real `computer` click/type
  over any shortcut, and prove state changed via the resulting backend event; cross-check every transition against
  backend logs + `/api/agents` + `/api/conversations`; the LB-89 StrictMode `[WS] Error` insight applies regardless.
- **Known quirk:** the extension drops on Chrome auto-update (v150 dropped it 2026-07-12). If "not connected",
  diagnose briefly and ask the PO to reconnect; fall back to code+log verification — do not rabbit-hole (my standing
  browser-automation rule).

**Lessons.** Agent-keyed — write tester-hat lessons into *your own* `design/lessons/<agent>-lessons.md` tagged
"*as tester*" (there is deliberately **no** role-keyed `tester-lessons.md`).

**Where state lives.** The active epic's `*-implementation.md` ledger, `design/backlog.md`, `design/logbook.md`,
and `design/testlog.md`. Charter/rationale + open decisions: `design/tester-seat-proposal.md`. Runbook for attach:
`design/attach-chat-runbook.md`.

Current role: tester.
