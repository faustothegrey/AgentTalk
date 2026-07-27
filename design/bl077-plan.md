# BL-077 — broadcast agent status transitions to connected clients

**Status:** PLANNED (awaiting plan-review gate 1)
**Filed from:** rung-4 run (BL-046), PO live observation, 2026-07-19
**Planner:** Claude (resource-scarcity fallback, 2026-07-27)
**Baseline (verified by running, 2026-07-27):** `tsc -b` exit 0 · suite **402/402** (68 files) · master `3944ec3` == `origin/master`

---

## 1. The finding, restated

During the rung-4 autonomous run the PO watched the web UI show the goose agent stuck at `starting` for the whole
run, while the backend log showed `creating → starting → ready → busy`. A **fresh page load showed the true
status** (`READY`) because the UI fetches from the API on mount. So the data is correct; the **live push** is
missing.

**Impact:** the UI is not a trustworthy live witness of agent progress — which directly undercuts using it to watch
autonomous runs (the whole point of the self-hosting ladder).

## 2. Root cause (verified by reading the code, not inferred)

There are **two** ways an agent's status changes, and only one of them emits an event:

| Path | Site | Emits `status`? | Broadcast? |
|---|---|---|---|
| `Registry.setAgentStatus()` | `packages/runtime-core/src/registry/registry.ts:219` | ✅ `this.emit('status', …)` | ✅ |
| `Agent.setStatus()` (raw) | `packages/runtime-core/src/agents/agent.ts:78` | ❌ mutates + `console.log` only | ❌ |

`apps/orchestrator/src/server.ts:1178` already broadcasts **every** registry `status` event to all open WebSocket
clients. The server side is fine — nothing to fix there.

**`InProcessAgentDriver` bypasses the registry entirely.** It holds a `registry` reference
(`in-process-driver.ts:24`) but calls `this.agent.setStatus()` **directly** at all six of its own transition sites:

| Line | Transition | Currently broadcast? |
|---|---|---|
| `in-process-driver.ts:44` | `creating → starting` | ❌ |
| `in-process-driver.ts:46` | `→ ready` (start) | ❌ |
| `in-process-driver.ts:69` | `→ busy` (turn begins) | ❌ |
| `in-process-driver.ts:72` | `→ ready` (turn ends) | ❌ |
| `in-process-driver.ts:78` | `→ error` (loop error) | ❌ |
| `in-process-driver.ts:98` | `→ ready` (conversation_end) | ❌ |

This **exactly explains the observation**: the single `starting` broadcast the PO saw came from
`registry.ts:242` (`activateAgent`), which *does* go through `setAgentStatus`. Every transition after that belonged
to the driver — hence silence, hence a UI frozen at `starting`.

## 3. ⚠️ Show-stopper flagged, NOT fixed (Implementer Rule 2)

`Registry.setAgentStatus()` does more than emit — it also carries the **M03 failure-propagation side effect**:

```ts
if (newStatus === 'error' && oldStatus !== 'error') {
  void this.teamCoordinator.handleAgentFailure(agent.id);   // registry.ts:224-226
}
```

**Naively routing the driver's six sites through `setAgentStatus()` would newly fire `handleAgentFailure()` for
in-process/API agent errors (line 78) — task interruption that does not happen today.** That is a real behaviour
change touching the engine (`team-coordinator.ts`), i.e. a **show-stopper**. **I am not making it.**

**Therefore the design below adds a side-effect-free notifier** and leaves failure propagation *exactly* as it is.
Whether driver-path errors *should* propagate is a separate question → **flagged to the PO; propose filing as a new
BL item. Out of scope for BL-077.**

## 4. Design (minimal, behaviour-preserving)

Add one method to `Registry`, next to `setAgentStatus`:

```ts
/**
 * Sets an agent's status and emits the status event for the UI, WITHOUT the
 * failure-propagation side effect of setAgentStatus (BL-077). For driver-owned
 * transitions, whose semantics are unchanged — this only makes them visible.
 */
notifyAgentStatus(agent: Agent, newStatus: AgentStatus): void {
  agent.setStatus(newStatus);
  this.emit('status', { id: agent.id, status: newStatus });
}
```

Then replace the six `this.agent.setStatus(x)` calls in `in-process-driver.ts` with
`this.registry.notifyAgentStatus(this.agent, x)`.

**Net behaviour delta: an event is emitted where previously none was.** Status values, ordering, transition
legality (`ALLOWED_TRANSITIONS` still enforced inside `Agent.setStatus`), and failure propagation are all untouched.

**Why not the alternatives:**
- *Make `Agent` an EventEmitter* — catches future bypasses too, but `registry.setAgentStatus` would then double-emit,
  and it widens the blast radius to every `Agent` consumer. Rejected: bigger than the finding.
- *Make `setAgentStatus` public and reuse it* — drags in the `handleAgentFailure` side effect (§3). Rejected.

## 5. Scope

**MAY touch:**
- `packages/runtime-core/src/registry/registry.ts` — add `notifyAgentStatus` (additive only).
- `packages/runtime-core/src/agents/in-process-driver.ts` — six call sites.
- `packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts` — the mock `Registry` needs the new method
  (test double, not a behaviour contract).
- A new test file for the DoD bar below.

**MUST NOT touch:** `team-coordinator.ts`, consensus/arbiter, the protocol, `server.ts` (already correct),
`Agent.setStatus`'s transition table, the web UI, anything BL-075/BL-076.

## 6. Definition of Done

| # | Bar | How it is verified |
|---|---|---|
| D1 | A driver `busy` transition emits a registry `status` event | New unit test, mutation-checked (revert the fix ⇒ RED) |
| D2 | A driver `ready` transition emits a registry `status` event | Same test file |
| D3 | Failure propagation is unchanged — a driver `error` does **not** call `handleAgentFailure` | New regression test asserting the spy was NOT called |
| D4 | `tsc -b` exit 0 | Run it |
| D5 | Full suite ≥ 402/402, no regressions | `npx vitest run` |
| D6 | **Live proof**: UI updates `starting → ready → busy` without a reload | Real orchestrator on `PORT=3100`, driven in Chrome, backend log shows `[Server] Status … → 1 client(s)` for `ready`/`busy` |

D6 is the bar that actually matters — this is an observability fix, so a green unit test is not proof. Per the
rung-4 lesson: verify on the real surface.

## 7. Work discipline

- Per-task **git worktree** (PO mandate 2026-07-16): `node scripts/wt-setup.mjs create BL-077 --base origin/master`.
- Retry budget, pre-registered per check: **D1/D2 max 2 attempts · D3 max 2 · D6 max 3** (live UI is flakier).
  On exhaustion: STOP and report.
- Merge is **PO-gated**; "merge" and "push" are separate words.
- Sole-agent independence caveat: I author and review this. What catches defects here is **running it** (D6),
  not re-reading my own diff.
