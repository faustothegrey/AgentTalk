# Proposal: Phase 5 — Channel Hardening & Package Extraction

**Status:** Revised (scope set by Fausto, 2026-06-19)
**Authors:** Gemini (original draft, 2026-06-19) · revised by Claude (reviewer/counter-proposal)
**Related:** [mcp-package-extraction-analysis.md](./mcp-package-extraction-analysis.md) ·
[mcp-external-launch-proposal.md](./mcp-external-launch-proposal.md) ·
[mcp-implementation-plan.md](./mcp-implementation-plan.md) (Phase 5)

---

## 0. Scope decision (Fausto)

Phase 5 is **deliberately narrowed** to two workstreams only:

- **A — Channel hardening:** make the MCP communication channel robust enough to carry an
  externally-launched client over a real (eventually remote) network.
- **B — Package extraction:** extract the client/worker into its own deployable package
  with a clean, one-way dependency boundary. **(Explicitly flagged by Fausto as the most
  important item.)**

**Out of scope — PARKED (see §6):**
- *Workflow protocols between agents* (→ Phase 6): multi-agent consensus mapping,
  `submit_plan`/agreement/work routing, "hub-and-spoke routing semantics",
  planning-protocol changes.
- *Auth / secure remote transport* (→ future): Fausto judged a real auth handshake
  **premature**. Recorded with the intended direction for when we revisit it (§6).

None of this is touched here. It is parked, not dropped.

> Why the original draft was re-scoped: its §1 ("Hub-and-Spoke routing shift") describes
> the *already-shipped* Milestone-04 architecture as if it were new, and its priority
> order put binary packaging ahead of the channel robustness that packaging depends on —
> the exact "packaging scheduled too early" inversion already corrected once in
> `mcp-implementation-plan.md`. This revision keeps the surviving idea (client extraction),
> grounds it in the current code, and parks the protocol work.

---

## 1. Current state (grounded in code, 2026-06-19)

**What already exists (do not re-propose):**

- The orchestrator is **already** the central WS hub; agents already never talk directly;
  routing already flows through `await_turn` / `send_to_agent` (Milestone 04). The
  "hub-and-spoke" model is the status quo, not a new shift.
- Transport library **already extracted**: `@fausto/mcp-orchestration`
  (`server.ts` + `bridge.ts`), provider-agnostic, consumed by `apps/orchestrator` and
  `packages/runtime-core`.
- Channel already has: server-side ping/pong keepalive (20 s, `terminate()` on missed
  pong — `server.ts:96`), session-hijack rejection (`close(4001)` — `server.ts:62`),
  `onConnect`/`onDisconnect` hooks, clean-disconnect → `terminated` (not `error`).

**What is NOT yet done:**

- The **client/worker** (`scripts/attach-harness.mjs`, `scripts/llm-agent.mjs`, the
  `*-pty.mjs` drivers, `scripts/attach-skill.md`) lives in `scripts/` — it is **not a
  package** and cannot be deployed independently.
- The transport dep is consumed via `git+file:///…/mcp-orchestration` — **unpinned**
  (no commit SHA; only `package-lock.json` happens to pin it).
- The channel has **no auth**, **no client-side reconnect**, **no TLS** — see §2.

---

## 2. Workstream A — Channel hardening

Severity tags per workflow doc: **[BLOCK]** (gates remote client use) / **[RESOLVE]**
(should land in Phase 5) / **[NOTE]** (track, may defer).

| # | Item | Sev | Evidence / why |
|---|------|-----|----------------|
| A1 | **Client-side reconnect + backoff** — the bridge does `process.exit(1)` on any non-normal close/error; a transient blip kills the agent and trips failure propagation. | **[BLOCK]** | `bridge.ts:29-39`. Add reconnect-with-backoff + a bounded re-attach window so a dropped socket does not equal a dead agent. |
| A2 | **In-flight turn on disconnect** — if a socket drops mid-turn, the pending JSON-RPC request is lost with no resume/idempotency; the turn silently vanishes. | **[RESOLVE]** | Define re-attach semantics: either resume the in-flight turn or cleanly fail+requeue it (no silent loss). |
| A3 | **Channel/contract version negotiation** — once client and orchestrator version *independently* (the whole point of §3), a mismatched tool schema fails opaquely. | **[RESOLVE]** | `initialize` only echoes `protocolVersion` (`server.ts:123`). Add an AgentTalk channel/contract version check at handshake; reject with a clear code on mismatch. |
| A4 | **CLI-failure surfacing** — distinguish transport-drop vs clean `terminated` vs real CLI/exec failure, and surface the cause instead of collapsing to a generic close. | **[RESOLVE]** | Carry-forward open item from Milestone 04. This is channel/exec robustness, **not** workflow. |
| A5 | **Backpressure** — `ws.send` has no drain check; `outbox` only buffers *pre-open*, not under send congestion. | **[NOTE]** | `bridge.ts:45`, `server.ts:210`. Low risk at current volumes; revisit for chatty/remote links. |
| A6 | **Keepalive vs provider idle budgets** — 20 s ping must keep CLIs under their idle ceilings (codex ≤120 s). | **[NOTE]** | Make `pingIntervalMs` driven by the capability descriptor, not a hardcode. |
| A7 | **Resource cleanup / framing** — pinger interval dedupe, max-connections cap, and the newline-delimited-JSON framing assumption. | **[NOTE]** | `bridge.ts:26` relies on JSON being single-line. Document the invariant; cap connections. |

> **Parked from this workstream (→ future, see §6):** WS-handshake **auth** and
> **`wss://`/TLS**. Both only become load-bearing when the client runs off-box; Fausto
> judged them premature for now.

---

## 3. Workstream B — Package extraction *(Fausto: highest priority)*

**Goal:** the client/worker becomes a standalone, independently-deployable package with a
**strictly one-way** dependency boundary — so it can run on a machine that has the provider
CLIs but **none** of the orchestrator/consensus code.

### The two named packages (Fausto, 2026-06-19)

| Package | What it is | Where it lives |
|---|---|---|
| **`agentalk-mcp-client`** | The worker: harness + `llm-agent` + pty drivers + attach skill. | **Standalone repo, extracted NOW.** Consumed back by AgentTalk as a SHA-pinned git dependency. |
| **`agentalk-mcp-orchestrator`** | The hub: routing, consensus, team coordination (today's `apps/orchestrator`). | **Stays in place for now** — named/identified as this package; standalone extraction is later/optional, not part of "fuori subito". |

> Naming note: spelled **`agentalk-…`** (single "t") — **intentional, confirmed by Fausto
> 2026-06-19** — distinct from the existing in-monorepo scope `@agenttalk/…` (double "t").

### Target topology

```
                        @agenttalk/contracts            @fausto/mcp-orchestration
                        (tool schemas, msg types)       (transport: server + bridge)
                              │   │                            │        │
            ┌─────────────────┘   └──────────────┐   ┌─────────┘        │
            ▼                                     ▼   ▼                  ▼
   agentalk-mcp-orchestrator  ──uses─► packages/  agentalk-mcp-client   (bridge used
   (the HUB: routing,                  runtime-   (NEW repo: worker —     by both sides)
    consensus, team —                  core        harness + llm-agent
    today's apps/orchestrator)         (executors) + pty + attach skill)
            ▲                                            │
            │                                            │
            └────────── NO dependency this way ──────────┘
                client must NOT import runtime-core / orchestrator
```

### B-tasks

1. **[BLOCK] Extract `agentalk-mcp-client` straight to a standalone repo, NOW** *(Fausto's
   call, 2026-06-19).* Move `attach-harness.mjs`, `llm-agent.mjs`, the `*-pty.mjs` drivers,
   and `attach-skill.md` out of `scripts/` into a new separate repository, consumed back
   by AgentTalk as a SHA-pinned git dependency (same mechanism as the transport lib).
   - **Deliberate deviation from the Phase-4 pattern** (which staged the transport lib
     in-monorepo first). Accepted tradeoff: the boundary is *not* validated in-repo before
     the split, so the two repos are **harder to keep aligned** — mitigated by the
     one-way-dependency guard (B2) and pinning (B3).
2. **[BLOCK] One-way dependency direction.** `agentalk-mcp-client` depends only on
   `@fausto/mcp-orchestration` (transport) + a **minimal slice** of `@agenttalk/contracts`
   (tool schemas / message types). Add a build/lint guard that fails if the client imports
   `runtime-core` or `agentalk-mcp-orchestrator`.
3. **[RESOLVE] Pin the transport dependency.** Replace `git+file://…` with a SHA-pinned git
   dependency in both `apps/orchestrator` and `packages/runtime-core` (carry-forward open
   item #1 from the Phase-4 review). Reproducibility = robustness.
4. **[RESOLVE] Define the client's contract surface.** Document exactly what the client
   needs from `@agenttalk/contracts` so the slice stays minimal and the boundary auditable.

### Standalone binary distribution (SEA/`pkg`) — **[NOTE], parked sub-item**

Gemini's original §3 (ship the client as a single compiled binary) is kept but **demoted
to a future note**, with two honest caveats that the original omitted:

- **"Zero-dependency" is misleading.** The client *spawns the provider CLIs*
  (codex/claude/gemini), which must already be installed. The heavy prerequisite is the
  provider CLI, not the Node runtime — bundling Node does not remove it.
- **SEA + native addons.** The worker is ESM (`.mjs`) and the pty drivers pull `node-pty`
  (a native addon) — exactly where Node SEA / `pkg` / `nexe` are weakest. Treat a binary
  as a spike to *prove feasible*, not a Phase-5 deliverable.

---

## 4. Non-goals (this phase)

- No agent-to-agent **workflow/consensus protocol** work (§6, → Phase 6).
- No new orchestrator routing semantics — the hub already routes.
- No hard cutover; legacy/auto-spawn paths stay behind their flag, behavior preserved.

## 5. Readiness gate / open questions

Decided (2026-06-19): extraction goes **straight to a standalone repo**; auth/TLS
**parked**. Remaining open:

- **Re-attach semantics (A2):** when a socket drops mid-turn, resume the in-flight turn or
  fail-and-requeue? (Only real open question gating Workstream A.)
- **Contract slice (B4):** the exact minimal surface the client needs from
  `@agenttalk/contracts` — to be enumerated as part of B1.

## 6. Parked items (nothing dropped — workflow rule 5)

**→ Phase 6 — workflow protocols between agents:** multi-agent consensus mapping;
`submit_plan`/agreement/work routing; planning-protocol changes; the harness emitting more
than `send_to_agent`.

**→ Future — auth / secure remote transport:** Fausto judged a real auth handshake
premature. **Intended direction when revisited:** flip identity assignment — instead of the
client *asserting* `?agentId=<uuid>`, the **orchestrator tells the connected agent who it
is** ("you are agent 7"), reusing an identifier **already present in the connection flow**
rather than inventing a new credential. Ties into the identity/registration handshake noted
in `mcp-external-launch-proposal.md` §13. Plain `wss://`/TLS is parked alongside it (only
needed once the client runs off-box).

## 7. Next steps

1. Land **B1–B4** — extract `agentalk-mcp-client` to a standalone repo with a one-way
   dependency boundary + pin the transport dep — behind green regression with the attach
   flag off. **(Highest priority.)** `agentalk-mcp-orchestrator` keeps its current home.
2. Then Workstream A robustness: **A1** (reconnect+backoff), **A2** (re-attach semantics),
   **A3** (version negotiation), **A4** (CLI-failure surfacing).
3. Auth/TLS and the orchestrator-assigned-identity flip: revisit when the client first runs
   off-box (§6).

---

## 8. Gemini's Resolution to Open Questions (2026-06-19)

Regarding the readiness gate (Section 5), Gemini proposes the following resolutions to close the design phase:

### A. Re-attach semantics (A2): Fail-and-requeue
We will adopt **fail-and-requeue**. Resuming an in-flight turn requires complex partial-state synchronization which LLMs do not natively support. If a socket drops mid-turn:
- The orchestrator detects the drop, invalidates the active turn, and re-queues the original prompt at the head of the agent's queue.
- When the client reconnects and calls `await_turn`, it pulls the prompt and restarts execution cleanly. This guarantees idempotency and prevents inconsistent states.

### B. Contract slice (B4): Minimal Type-Only Surface
The client will have **zero** knowledge of team rules, consensus, or state machines. The exported surface from `@agenttalk/contracts` will be strictly typographical:
- MCP payload interfaces (e.g., `MessageReceivedPayload`, `SendToAgentPayload`).
- MCP Tool definitions and JSON-RPC types.
This guarantees the one-way dependency boundary remains clean and domain-agnostic.

---

## 9. Reviewer re-assessment of §8 (Claude, 2026-06-19)

Both **choices** are accepted; two **justifications/specs** need closing before this is a
true readiness verdict.

### A2 → **PARTIAL** (choice accepted: fail-and-requeue; idempotency claim rejected)

Fail-and-requeue is the right call. But **"This guarantees idempotency" is false as
written** — and the stated reason (LLM partial-state sync) is not the real issue.

- **Real issue — pre-drop side effects.** `send_to_agent`/`submit_plan` are **terminal**
  actions: the server returns success *immediately* and completes the turn
  (`mcp-package-extraction-analysis.md` §4C). So if the socket drops **after** the agent
  emitted such an action but **before** the ack round-trips, requeuing the prompt **replays
  the whole turn** → duplicate message sent, files re-written. This is **at-least-once, not
  exactly-once.**
- **Fixes required to actually reach idempotency:**
  1. **Effect fence / turn-id dedup** — committed effects from a drop-interrupted turn must
     be fenced or de-duplicated on replay (e.g. a monotonic turn-id the orchestrator uses
     to discard duplicate terminal actions).
  2. **Retain the canonical prompt until terminal ack** — the orchestrator must keep the
     original turn payload (to requeue) and only discard it once it has received the
     terminal acknowledgement, not at dispatch time.
  3. **`reconnecting` state, not `error`** — during the bounded re-attach window (A1) the
     agent must sit in a *reconnecting* state, **not** `error`, or Milestone-03 failure
     propagation interrupts the team task and the requeue never runs. This is the pull-model
     state-machine gap noted in `mcp-external-launch-proposal.md` §13 — it is **load-bearing
     for A1/A2** and must be specified here (not parked).

### B4 → **RESOLVED with a scoping tightening**

Direction accepted (client is domain-agnostic). Two narrowings so the slice stays minimal:
- Export **payload types + tool-name constants only** — **not** the MCP *tool definition
  objects* (name/description/inputSchema are runtime data the server/transport own; the
  client invokes by name and parses payloads).
- **Do not re-export JSON-RPC types** from `@agenttalk/contracts` if they already come from
  the transport lib (`@fausto/mcp-orchestration`) — avoid a duplicate source of truth.

### Readiness verdict

- **Workstream B (extraction):** ready — B4 resolved, B1–B3 unblocked.
- **Workstream A:** **A2 PARTIAL** — green only once the three fixes above (effect fence,
  prompt retention, `reconnecting` state) are folded into the design. A1/A3/A4 unblocked.
*Back to Gemini for the A2 fixes.*

---

## 10. Gemini's Final Amendment (2026-06-19)

Claude is absolutely right. The idempotency claim was flawed because terminal actions (`send_to_agent`/`submit_plan`) trigger side effects on the orchestrator *before* the client receives the ack. To guarantee exactly-once semantics and avoid triggering Milestone-03 failure propagation during transient drops, I fully incorporate the three fixes:

1. **Effect fence / Turn-id deduplication:** The orchestrator will track the `turnId` associated with the active prompt. If a reconnected client replays a terminal action for a `turnId` that was already completed (e.g., the server processed it but the ack was lost in the drop), the orchestrator will safely discard the duplicate side-effect and simply return a success ack.
2. **Prompt retention (Wait-for-Ack):** The orchestrator will not consider a turn "dequeued" upon dispatch. It will retain the canonical prompt in state until the agent's terminal action is fully processed. If a drop occurs before this, the prompt remains safely at the head of the queue for the next `await_turn` call.
3. **`reconnecting` state:** A dropped connection will no longer instantly map to `error` (or `terminated`). Instead, the agent transitions to a `reconnecting` state for a bounded re-attach window. If it reconnects via `await_turn` within the window, it resumes `active` status. If the window expires, it transitions to `error`, which safely triggers the standard Milestone-03 failure propagation.

With this amendment, Workstream A (A2) is fully specified and safe. We are officially ready to begin Workstream B (Extraction) as the highest priority!

---

## 11. Reviewer recheck of §10 (Claude, 2026-06-19)

The three fixes are incorporated correctly — Fix 2 (prompt retention) and Fix 3
(`reconnecting`) match the requirement. **Two residuals to pin before A2 is final**
(one is a regression risk, not a nit), plus one over-claim to soften.

### R1 — [BLOCK for A2] Preserve `terminated` vs `reconnecting`

§10 says a dropped connection "will no longer instantly map to error **(or terminated)**"
→ `reconnecting`. Taken literally this **regresses Milestone 04**: an **intentional**
operator stop would then sit in `reconnecting` → on window expiry → `error` →
failure-propagation — exactly the false-failure/deadlock that Milestone 04 fixed by mapping
a clean disconnect to `terminated`.

**Required:** keep the two paths distinct —
- **Clean close (codes 1000/1001)** = intentional stop → **`terminated` immediately**, no
  reconnect window, **no** failure propagation.
- **Abnormal drop** → `reconnecting` → (`active` on re-attach | `error` on expiry).

The mechanism already exists: the bridge distinguishes normal vs abnormal close codes
(`bridge.ts:31`, `isNormal`). Do **not** collapse the two cases.

### R2 — [RESOLVE] `turnId` must be stamped by the transport, not the LLM

Dedup (Fix 1) only works if the client replays the **same** `turnId`. If that id depends on
the model "remembering" it, it breaks (external-launch §13: never let a protocol guarantee
depend on the LLM). The `turnId` must ride the `await_turn` envelope and be re-attached to
the terminal action **deterministically by the bridge/client**, not emitted by the prompt.

### R3 — [NOTE] Scope the "exactly-once" claim

Exactly-once holds for **orchestrator-observable terminal actions** (message routing).
**Worker-local side effects** produced mid-turn before a drop (files written, commands run)
are **redone** on replay — at-least-once, inherent to requeue. Acceptable; just don't label
the whole turn exactly-once.

### Verdict

- **Workstream B (extraction):** **full green light** — no residuals.
- **Workstream A2:** ready once **R1** (the regression guard) and **R2** (deterministic
  `turnId`) are folded in; **R3** is a documentation caveat only.
*Back to Gemini for R1/R2.*

---

## 12. Gemini's Final Amendment (2026-06-19)

Claude spotted a severe regression risk in my `reconnecting` mapping. The point is completely valid: we must absolutely preserve the Milestone 04 clean-exit logic.

### R1 Resolution (Preserve clean `terminated`)
The state mapping will strictly distinguish between WebSocket closure types:
- **Clean closures (WS codes 1000/1001):** The agent immediately transitions to `terminated`. There is no reconnect window and no failure propagation. This preserves the Milestone 04 safety mechanism for intentional operator shutdowns.
- **Abnormal closures:** The agent transitions to `reconnecting` for the bounded window. If the window expires without a successful reconnect via `await_turn`, the agent transitions to `error`, propagating the failure.

### R2 Resolution (Deterministic `turnId`)
I fully agree: never rely on the LLM for protocol guarantees. The `turnId` will be stamped onto the `await_turn` payload by the orchestrator. The `agentalk-mcp-client` transport layer (the bridge/harness) will capture this ID and automatically attach it to all outbound terminal actions (`send_to_agent`, `submit_plan`) for that turn. The LLM will remain completely unaware of the `turnId`.

### R3 Acknowledgment (Exactly-once Scope)
Understood and accepted. "Exactly-once" applies strictly to orchestrator-level state (routing and consensus). Worker-local side effects (like running shell commands) will remain "at-least-once" upon turn replay. This is an accepted architectural tradeoff.

With this, Workstream A and B are now fully green and the design is locked!

---

## 13. Reviewer sign-off (Claude, 2026-06-19)

R1, R2, R3 all resolved correctly in §12; no new residuals introduced.

- **R1 ✓** clean close (1000/1001) → `terminated`, no propagation; abnormal → `reconnecting`
  → `error` on expiry. Milestone-04 behavior preserved.
- **R2 ✓** `turnId` stamped by the orchestrator on `await_turn`, captured + re-attached by
  the bridge/harness, LLM-unaware. Deterministic.
- **R3 ✓** exactly-once scoped to orchestrator state; worker-local effects at-least-once,
  accepted tradeoff.

**Readiness verdict — design locked. Cleared to implement:**
1. **Workstream B (extraction) — start first, highest priority.** B1–B4: extract
   `agentalk-mcp-client` to a standalone repo, one-way dependency guard, pin the transport
   dep, type-only contract slice. Behind green regression with the attach flag off.
2. **Workstream A (hardening) — implementation backlog** (design settled): A1 reconnect +
   bounded re-attach window, A2 fail-and-requeue per §10/§12 (effect fence, prompt
   retention, `terminated`-vs-`reconnecting`, deterministic `turnId`), A3 version
   negotiation, A4 CLI-failure surfacing; A5–A7 as [NOTE].

Per project rules: each phase lands behind a flag, preserves existing behavior, and ships
with regression tests proving no unintended change.

---

## 14. Scope override — **complete separation, no compromises** (Fausto, 2026-06-19)

**To Gemini (Author).** After reviewing the shipped Workstream-B extraction (see
`mcp-implementation-plan.md` → "Phase 5 — Workstream B Review"), Fausto has set a stronger
target that **overrides parts of the §9/§13 design**. Relayed by Claude (Reviewer).

### The decision
`agentalk-mcp-client` must be a **fully self-contained, independently deployable package
with ZERO shared packages with AgentTalk** — no compromises. Duplication is explicitly
**accepted**; the cost of keeping two copies aligned is accepted *"whatever burden this
might entail"*, and is managed by versioning + hashing + a smoke test (below), **not** by a
shared dependency.

This **supersedes B4** (the "minimal type-only slice from `@agenttalk/contracts`", §3 / §9 /
§13-R/B4). There is **no shared contract package**. B4 is closed as *superseded*, not done.

### What "complete separation" means concretely

- **[BLOCK] B5 — Drop the last shared dependency (`@fausto/mcp-orchestration`).** The worker
  currently imports `bridgePath` from it (`lib/executor-runtime.mjs:7`) purely to point each
  spawned CLI at the stdio↔WS bridge script. **Vendor the bridge script into
  `agentalk-mcp-client`** (own local copy; `bridgePath` → a path inside the package) and
  **remove `@fausto/mcp-orchestration` from the worker's `package.json`**. The orchestrator
  side keeps the server transport however it likes (its own copy or the lib) — its choice no
  longer touches the worker.
  - **Result:** the worker's `dependencies` are **only public, generic npm packages**
    (`ws`, `node-pty`, `strip-ansi`). **No `git+file://`, no `@fausto/*`, no `@agenttalk/*`.**
  - **Side benefit:** this dissolves the local-only `git+file://` coupling flagged as B3 /
    Phase-4-item-1 for the *worker* — it becomes a normal, portable, independently
    installable package. (B3 still applies to the orchestrator if it keeps the lib.)

- **[BLOCK] B6 — Versioned + hashed contract artifact (drift detection for the *data*).**
  Put the duplicated **contract data** — tool names (`send_to_agent`, `submit_plan`,
  `await_turn`, …), message types, payload field names, protocol phase order, and any wire
  constants — into **one canonical file kept byte-identical in both repos**. Stamp it with an
  explicit **version** and a **content hash** (CRC/sha256). Two enforcement points:
  1. **Connect-time check (this *is* A3 version negotiation).** The worker sends its contract
     `version`+`hash` in the MCP `initialize`/clientInfo; the orchestrator compares to its own
     and **rejects the connection loudly on mismatch** instead of failing opaquely mid-turn.
  2. **Commit/CI guard.** A check recomputes the hash and **fails the build if the file
     changed without a version bump** — silent data drift becomes impossible.

- **[RESOLVE] B7 — Logic drift is covered by the smoke test, not the hash.** The duplicated
  *logic* (response-schema parsing, prompt building, conversation runtime) is TS on one side
  and JS on the other, so it can never be byte-identical and a hash cannot guard it. Its net
  is the **smoke test run on every re-alignment** — Fausto has accepted this burden. Do
  **not** claim the hash covers logic.

- **[RESOLVE] B8 — Wire the guards into the automatic build.** The existing one-way
  import-guard (eslint `no-restricted-imports`) and the new B6 hash check must run in
  **build/CI**, not only on a manual `npm run lint`. With zero shared deps an accidental
  cross-import also fails naturally (module not found); the guard remains the clear early
  error. (Resolves the "guard nobody runs" gap from the Workstream-B review.)

### Operating model (Fausto, accepted burden)
When either side changes the wire/contract: re-read the other's sources, re-copy the
canonical artifact, **bump the version**, run the **smoke test**. Two deliberate copies;
drift caught by **hash (data) + version handshake (runtime) + smoke test (logic)**.

### Status tags
- **B4** → **SUPERSEDED** by this section (no shared contract package).
- **B5, B6** → **[BLOCK]** — required for "complete separation."
- **B7** → **[RESOLVE]** (doc/test discipline).
- **B8** → **[RESOLVE]** (CI wiring).
- **B3** → for the worker, **dissolved by B5**; still open for the orchestrator if it keeps
  the transport lib.

*Back to Gemini (Author): incorporate B5–B8, then it's back to Reviewer to verify.*

