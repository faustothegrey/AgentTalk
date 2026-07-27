# BL-076 — the worker's report must survive the worker protocol

**Status:** PLANNED (awaiting plan-review gate 1)
**Filed from:** rung-4 run (BL-046), 2026-07-19 · family of BL-042 / TL-009
**Planner:** Claude (resource-scarcity fallback, 2026-07-27)
**Baseline (verified by running, 2026-07-27):** AgentTalk master `3ee7518` · suite **404/404** · `tsc -b` 0

---

## 1. The finding, restated

In both rung-4 runs goose **did** the work (edit + test + commit) but its report never reached the orchestrator.
The outcome was recoverable only from the **artifact** (the commit), never from what the worker *said* — and the
team still flipped to `completed` on that non-report, the BL-062 "completed ≠ done" trap with nothing in the
record to contradict it.

## 2. Root cause — reproduced deterministically BEFORE choosing a fix

I reproduced the loss at the seam rather than inferring it (repro is now
`packages/runtime-core/src/agents/__tests__/bl076-worker-report-survival.test.ts`, RED before the fix):

> `submit_work_result` receives the literal string **`'Task completed.'`** — a placeholder that asserts success
> while carrying **no evidence of it**. Everything the worker said is discarded.

**The loss is NOT where the backlog assumed.** A non-JSON response is *not* the lossy case: it fails to parse,
falls into the `!structured` branch (`in-process-driver.ts:336`), and that branch **already** submits the raw
text. The loss is in the **"parsed, but not a work verdict"** case:

| Response | Parses? | Branch | Report survives? |
|---|---|---|---|
| free prose ("I've reached the maximum number of actions…") | no | `!structured` | ✅ raw text submitted |
| `{"message_type":"work_accept","message_payload":{"text":"…"}}` | yes | `work_accept` | ✅ |
| **`{"message_type":"ack_planning_protocol","message_payload":{}}`** | **yes** (`validatePayload` returns `true` for this type) | **final fallthrough** | ❌ **replaced by `'Task completed.'`** |

The fallthrough at `in-process-driver.ts:361-363` reads `payload.text || payload.plan || payload.reason`, finds
nothing in an ack's empty payload, and substitutes the placeholder — **while the real report is sitting in the
`text` variable two scopes up, unused.**

This is exactly the rung-4 sequence: goose answered with non-JSON meta, `parseWithRetry` sent the correction
prompt, and goose came back with a bare protocol ack. The retry is what *converted* a survivable response into a
lost one.

**Same defect, adjacent trigger (in scope, declared):** `work_accept` validates with `typeof payload.text ===
'string'` — an **empty** string passes, so `payload.text || 'Task completed.'` loses the report there too. One
line away, identical failure. Fixed together.

## 3. Why not either fix direction the backlog proposed

- **(a) "a goose recipe that wraps its final result in the exact `work_accept` envelope"** — prompt engineering:
  probabilistic, provider-specific, and it asks an LLM to police an invariant the harness can simply guarantee.
  This project already rejected that trade once, explicitly: BL-061's rationale — *"deterministic enforcement is
  what earned the right to delete the probabilistic one."* A better-worded prompt would still fail on the next
  model that free-styles a turn.
- **(b) "capture goose's raw stdout as a report sidecar"** — **already partly built** (BL-064's `recordResponse`
  in `llm-agent.mjs` files the response before it crosses MCP). More importantly it treats the symptom: the
  **work result itself** would still say `'Task completed.'`. A sidecar someone must know to go read is not a
  report; the thing the orchestrator hands to the operator is.

**(c) — chosen: never discard the raw text.** When the structured payload yields no usable text, fall back to the
raw response instead of a placeholder. Deterministic, provider-agnostic, ~2 lines, and it fixes the actual loss
rather than routing around it.

## 4. Design

In `handleTeamWorkAssign` (`in-process-driver.ts`), both submit sites gain the raw response as their fallback:

```ts
// work_accept branch
result: (structured.message_payload as any).text || text.trim() || 'Task completed.'

// final fallthrough
result: payloadText || text.trim() || 'Task completed.'
```

**Behaviour delta:** a work result that would have been the placeholder now carries the worker's actual response.
Every case that already produced a real report is byte-for-byte unchanged — pinned by D3. `'Task completed.'`
survives as the last resort for a genuinely empty response, so no call site loses its non-empty guarantee.

**Not changed (deliberately):** the accept/refuse *decision*, the protocol, the retry, `validatePayload`, and the
prompt. This makes the report survive; it does not try to make goose emit better JSON.

## 5. Scope

**MAY touch:** `packages/runtime-core/src/agents/in-process-driver.ts` (`handleTeamWorkAssign` submit sites only)
· the new test file.

**MUST NOT touch:** `team-coordinator.ts`, `response-schema.ts` (validation/prompts), `translation.ts`, the
registry, the client repo, anything BL-075/BL-077.

## 6. Definition of Done

| # | Bar | How it is verified |
|---|---|---|
| D1 | A non-verdict structured response no longer yields `'Task completed.'` | The repro test, mutation-checked (revert ⇒ RED) |
| D2 | The worker's raw response is recoverable from the work result | Same file |
| D3 | A proper `work_accept` is byte-for-byte unchanged | Regression guard in the same file |
| D4 | `tsc -b` 0 · full suite ≥ 404/404 | Run them |
| D5 | **Live**: a real goose worker's report reaches the orchestrator, not a placeholder | Bite-0 launcher run; read the work result out of the NDJSON recording |

## 7. Work discipline

- Per-task worktree `/private/tmp/att-BL-076` (branch `task-BL-076`) — already created.
- Retry budget, pre-registered: **D1/D2/D3 max 2 each · D5 max 2** (a live goose run is slow and costs OpenRouter
  credit; on the second failure I STOP and report rather than burning a third).
- Merge **PO-gated**; "merge" and "push" are separate words.
- Sole-agent independence caveat: I author and review. The repro was written and confirmed RED **before** the fix
  existed, which is the thing that makes the later green mean something.
