# BL-092 — the 403 flake in the BL-048 broadcast test

**Status:** 🔍 **INVESTIGATION — no decision, no code.** Written to weigh the options recorded in [[BL-092]]
and recommend one. **Nothing in this document was implemented; no source file was changed.**
**Author:** Claude, 2026-07-27, as the worker on an operator-launched (O-3) run.
**Item:** [[BL-092]] (`todo`, filed 2026-07-27 out of [[BL-090]]'s gate run).
**Related:** [[BL-048]] (the test's subject) · [[BL-090]] (where it surfaced) · [[BL-091]] (the sibling
"our checks cannot see it" finding).

**Recommendation in one line: take neither recorded option — both are refuted by evidence below — and instead
instrument the failure so it names the listener that answered (option D), because every candidate fix is
unfalsifiable until we know who sent the 403.**

---

## 1. What the backlog got right, verified

Two of BL-092's load-bearing claims hold up under independent check, and they are the important two.

**The test really does race an unawaited second listener.** `server.test.ts:70` calls `startServer(registry, 0, …)`
and awaits only `'listening'` on the HTTP server. `startServer` *additionally* constructs an `McpServer` and calls
`mcpServer.start(… : 0).then(…)` — fire-and-forget, outside any await (`server.ts:934`). So every `beforeEach`
creates **two** ephemeral listeners and the test synchronises with only one. Confirmed as described.

**Nothing in this repository emits `403`.** A repo-wide search across `apps/`, `packages/` and `scripts/`
(excluding `dist/` and `node_modules`) returns no `403`, no `Forbidden`, and no `verifyClient` in any source
file. Confirmed.

## 2. What the backlog got wrong — the leading suspect is refuted

BL-092 names a prime suspect: *"plausibly one of the MCP servers, which would refuse a handshake carrying no
agent identity or contract hash."* **That is not what the MCP server does, and it cannot produce this error.**

Read `packages/mcp-transport/src/mcp-server.ts`:

- **It applies no path filter when bound to a port.** `wssOptions.path = '/mcp'` is set **only** on the
  `server` branch (`mcp-server.ts:57-61`). Given a *port* — which is how `server.ts` starts it — no `path` is
  set, so `ws` accepts an upgrade on **any** path, `/ws` included.
- **Every rejection it makes happens *after* a successful handshake**, as a WebSocket close code:
  `4001` "Session already active" (`:86`), `4003` (`:108`), `1008` "Contract hash mismatch" (`:154`). A close
  code is only reachable once the socket is **open**.

So had an MCP server answered, the client would have observed `open` followed by a close with a 4xxx code —
**not** `Unexpected server response: 403`. The test's `openSocket()` awaits `'open'`, and would have resolved.

**`ws` itself never sends 403 either.** Its server aborts handshakes with `400` (path mismatch, `:278`), `401`
(`verifyClient`, `:337`/`:353`) and `503` (shutting down, `:385`). There is no `403` in `websocket-server.js`.

**This narrows the bug rather than widening it.** The 403 cannot come from our HTTP server, our MCP server, or
the `ws` library. It came from a listener that is not part of this repository at all — which is exactly what
BL-092's title says, and exactly what its own hypothesis then walks away from.

## 3. A mechanism that is demonstrated, not hypothesised

BL-092 hypothesises port *recycling*: that a port is released and re-acquired between `baseUrl` being computed
and `openSocket()` dialling it. **That specific story cannot be right for the app server's port.** `baseUrl` is
read from `server.address()` after `'listening'` and the server stays bound for the whole test; the OS cannot
hand that port to anyone else while it is held. There is no window to race.

There is, however, a real mechanism, and it survives that objection: **`server.ts` binds the wildcard while the
test dials loopback.**

`server.ts:1274` is `server.listen(port, () => {…})` — **no host argument**, so Node binds `0.0.0.0`/`::`. The
test dials `127.0.0.1`. Those are not the same address, and the kernel resolves them by **specificity**.

I tested this on the affected host rather than asserting it:

```
foreign server bound 127.0.0.1:52670 (answers 403)
wildcard bind on same port 52670: OK          <-- no EADDRINUSE
dial 127.0.0.1:52670 -> HTTP 403              <-- the foreign server answered, not ours
```

So: if any process holds `127.0.0.1:N`, our wildcard `listen(N)` **still succeeds**, `server.address().port`
**reports `N` and looks perfectly healthy**, and a dial to `127.0.0.1:N` reaches **the other process**. That
reproduces the observed symptom precisely — a 403 from a server that is not ours, with no error anywhere on
our side.

**What I could not confirm — stated plainly.** For this to fire, the kernel must *hand out* an ephemeral port
that a foreign process already holds on loopback. I measured that: holding 300 loopback-only ports, then
performing 400 wildcard binds and 400 loopback binds, produced **0 collisions in 700 trials**. macOS's
allocator (range 49152–65535 here) evidently skips ports it can see in use. So this path is **rare** — which is
consistent with 1 failure in 3 full-suite runs, but it is *not* proof that this is what happened. **The listener
that sent the 403 remains unidentified.** That is the single most important open fact in this investigation, and
it is why the recommendation below is what it is.

**One correction while here:** BL-092 says *"the whole suite binds port 0 in this pattern, so this is a
suite-wide latent flake."* Only **two** test files bind a listener at all — `server.test.ts` and
`m17-gate-recording.test.ts`. The blast radius is two files, not the suite. The concern about gate signal
quality stands; the stated scope does not.

## 4. The recorded options, weighed

### Option A — have `startServer` expose the MCP port as a resolved promise so tests can await it

**Refuted as a fix for this failure.** The test never dials the MCP port; it dials `baseUrl`, built from the
*HTTP* server's address. Awaiting the MCP port changes nothing about which listener answers a dial to the HTTP
port. And §2 removes the motive: the MCP server could not have sent the 403 regardless of when it came up.

It retains **modest independent value** — an unawaited `.then()` that mutates `process.env`
(`AGENTTALK_PERSISTENT_MCP_URL`, `server.ts:935`) after the test may already have finished is genuine
cross-test pollution, and leaked ephemeral listeners are untidy. That is a real hygiene item worth filing on its
own merits. **It is not this bug**, and adopting it here would close BL-092 without fixing anything — the worst
available outcome, because the flake would return wearing a "fixed" label.

### Option B — dial from the live `server.address()` at connect time rather than a captured `baseUrl`

**Refuted, and demonstrably so.** In the mechanism reproduced in §3, `server.address().port` returns **`52670`**
— the same value `baseUrl` captured, and the same value that misroutes. Re-reading the address at connect time
yields an identical dial to an identical wrong listener. The premise of option B is that `baseUrl` goes stale;
it does not, because the server holds its port for the test's duration (§3).

### Option C — bind the server explicitly to `127.0.0.1` (surfaced by this investigation, not recorded)

This is the only option that addresses the one mechanism actually demonstrated: bind loopback and the
specificity mismatch disappears, since a conflicting loopback holder would then cause an honest `EADDRINUSE`
and the allocator would pick another port.

**But it must not be applied to production as written, and this is a trap worth flagging.** `server.ts:967-968`
records the deployment reality in a comment: *"the UI is browsed over the LAN."* Binding the orchestrator to
`127.0.0.1` would make the web UI unreachable from every other machine — a serious behaviour change, squarely a
Rule-2 show-stopper. Any version of this must be an **opt-in host parameter** defaulting to today's wildcard
behaviour, with only the tests passing `127.0.0.1`.

Even scoped that way, it is a **fix aimed at an unconfirmed cause**. It would very likely make the symptom go
away; it would not tell us whether we had fixed the bug or merely perturbed the timing — and an unfalsifiable
green is precisely what this project's rules exist to prevent.

### Option D — make the failure name its own culprit (recommended)

The test currently destroys the one piece of evidence that would settle this. `openSocket()` rejects on
`socket.once('error', reject)` (`server.test.ts:99`), and `ws` emits a separate **`unexpected-response`** event
carrying the actual `IncomingMessage` — status line **and headers**, including `Server:`, `WWW-Authenticate`,
and any body. We are throwing away the response that would identify the listener in one line.

The change is test-local, additive, and carries no production risk: attach an `unexpected-response` handler in
`openSocket()` that captures status, headers and body into the rejection message, and — because the event is
rare — have CI surface it loudly.

## 5. Recommendation

**Take option D. Do not take A or B. Hold C as the pre-registered fix, conditional on what D reports.**

The reasoning is short. Both recorded options are refuted above: B cannot work (the address it re-reads is the
address that misroutes), and A targets a suspect that §2 eliminates. C is the only live candidate, but it treats
a cause that 700 trials failed to reproduce — so applying it now buys a green of unknown meaning. The one thing
we genuinely lack is the identity of the listener, and we lack it *only* because the test discards the response
that names it. Fixing that costs a few lines in one test file, touches no production code, and converts an
unfalsifiable intermittent into a report.

This also fits the standing rule that a red must mean something. BL-092's own strongest argument is that a gate
green 2 times in 3 cannot distinguish a regression from noise. Option D is the only choice that improves what
the *next* occurrence tells us; A and B would leave the next one just as mute, and C would suppress it without
explaining it.

**Pre-registered decision rule**, so the follow-up is not re-litigated once evidence arrives:

| What the captured response shows | Action |
|---|---|
| A `Server:` header naming a foreign process (proxy, dev server, OS service) | Adopt **C** as an opt-in host param; the mechanism in §3 is then confirmed |
| A response identifiably from one of our own listeners | §2 is wrong — reopen the investigation with that evidence; do **not** apply C |
| No further occurrence within an agreed number of full-suite runs | Leave BL-092 `todo` with the instrumentation in place; do not fix blind |

**Cost:** option D is a handful of lines in `server.test.ts`. Options A and C are larger and touch shared
infrastructure (A changes `startServer`'s contract; C changes its signature), which is why BL-092 correctly
declined to do either on discovery.

## 6. Scope note

This document is analysis only. No source file, test, or configuration was modified in producing it; the two
probes cited in §3 were throwaway scripts run outside the repository, under `/tmp`. Adopting **any** option
above — including D — is a separate, gated change, and C in particular alters production binding behaviour and
would require explicit confirmation per the M06 behaviour-change rule.
