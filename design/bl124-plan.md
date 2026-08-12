# Plan — BL-124: give the idle advisory a channel that cannot be switched off, then measure

**Author:** Claude (planner). **Date:** 2026-08-11. **Status:** awaiting **Gate 1**.
**Item:** [[BL-124]] (filed 2026-08-11, on the PO's same-session decision "measurement spike first").
**Parents:** `design/bl028-plan.md` §5 (the phasing this discharges) · `design/bl028-t3b-plan.md`.
**Scope class:** observability only — one new sink, no change to what is classified. `human-only`.

> **The one-sentence version:** T3a's justification was measurement; the measurement never reached disk on the
> instance that sees real runs. This makes it reach disk, then gets the number T3c is required to have.

---

## 1. What is true today — read from the running system, not from the plan

| Fact | Where | How verified |
|---|---|---|
| The sweep is live, advisory, and cannot kill | `registry.ts:1002-1028`; no path to `setAgentStatus` | code read + T3a's own tests |
| It emits `agent_non_reply` with `{reason, silentForMs}` | `registry.ts:1023-1024` | code read |
| Consumer 1: recorder | `server.ts:1302` — `recorder?.record(...)` | code read |
| Consumer 2: WS broadcast → UI | `server.ts:1303`; `App.tsx:251` | code read |
| Consumer 3: `console.warn` | `registry.ts:1028` | code read |
| **`recorder` exists only under `AGENTTALK_RECORDING_PATH`** | `apps/orchestrator/src/index.ts:22` | code read |
| **The live launchd unit does not set it** | `~/Library/LaunchAgents/com.fausto.agenttalk-orchestrator.plist` — `PORT`, `AGENTTALK_MCP_PORT`, `PATH`, nothing else | file read |
| **Zero notices in the live logs** | `~/.hermes/logs/agenttalk-orchestrator.err.log` (2.1 MB) + `.log` (131 KB) | `grep -c "has not replied"` → `0` / `0` |
| The running build **does** contain T3a+T3b | `dist/registry/registry.js`: warn string present, `awaiting-input` ×4; built after the 2026-08-08 src commit | grep + `ls -la` |
| Threshold | `agentIdleTimeoutMs: 180000` (`registry/config.ts:19`) | code read |
| Orchestrator uptime | PID 83663, started 2026-08-11 09:18:50 | `ps -o lstart` |

**The three channels fail in three different ways, which is the actual finding.** The recorder is
*configuration-dependent* and off. The broadcast is *ephemeral* — it needs a human watching a browser at the
moment of emission, and it survives nothing. The console warn is durable but *unstructured*, and it is the only
one that ever fires unconditionally. An instrument whose sole unconditional output is a prose line in a 2 MB
mixed log is not a measurement device.

## 2. The ambiguity, and why it must be settled by running rather than reading

Zero notices is consistent with **two opposite worlds**:

- **W1 — nothing has been quiet.** No team ran a >180 s silent turn since T3a merged (2026-08-08). The sweep is
  fine; there has simply been no traffic. Under W1 the instrument is untested, and T3c would be built on an
  untested detector.
- **W2 — the sweep does not fire in practice.** Some condition in `classifySilence` — most plausibly
  `currentTurnId` being cleared earlier than the gate assumes, or the once-per-obligation dedup key — means real
  runs never reach the emit. Under W2 T3c would escalate on a signal that does not arrive.

The evidence on hand cannot separate them: the launchd logs carry **no timestamps**, so activity cannot be dated
against the merge. **This is the fork the spike exists to close**, and it is the reason the item is not simply
"add an env var."

## 3. Design — one sink that cannot be configured off

```
registry emits agent_non_reply ──┬─→ recorder?.record(...)      (unchanged; still optional)
                                 ├─→ broadcast → UI             (unchanged; still ephemeral)
                                 ├─→ console.warn               (unchanged)
                                 └─→ NEW: append-only JSONL sink, always on
                                          one line per notice, structured
```

**Why a dedicated sink rather than just setting `AGENTTALK_RECORDING_PATH`.** Setting the env var is one line
and would work — and it is the wrong fix on its own, for the reason this item exists: it re-creates the exact
failure mode, an instrument that a deployment can silently switch off. The whole defect being corrected is that
`recorder?.` evaluated to a no-op and **nobody noticed for three days** because a no-op emits nothing, including
no complaint. A sink that is always on cannot fail that way. Setting the env var is worth doing **as well** —
it is free and it enriches the session recordings — but it is not the deliverable.

**Shape of a line** (one JSON object per line, appended, never rotated by us):

```json
{"ts":"2026-08-11T09:18:50.123Z","agentId":"worker-1","turnId":"…","reason":"quiet","silentForMs":184200,"transport":"attached","teamId":"…"}
```

`reason` and `silentForMs` come straight off the notice. `transport` is what makes the distribution
*interpretable* — the whole BL-120 arc turned on attached-vs-in-process being confused, and a distribution that
cannot be split by transport would invite exactly that error again.

**Where it writes.** A path defaulting to something stable and not inside the repo, overridable by env. It must
not land in a git worktree — a spike that pollutes `git status` teaches the wrong habit and would trip the
hygiene checks at close.

## 4. Bars — each with the mutation that must turn it red

| # | Bar | Mutation that must turn it red |
|---|---|---|
| **B1** | A notice emitted with **no** env configuration at all produces a line in the sink | make the sink construction conditional on any env var |
| **B2** | The line's `silentForMs` and `reason` **equal** the notice's own fields | write a recomputed or rounded value |
| **B3** | `awaiting-input` and `quiet` are **both** recorded and distinguishable | filter either out at the sink |
| **B4** | **Nothing propagates, still.** The sink is a pure reader — no status change, `handleAgentFailure` never called | give the sink any return value the sweep acts on |
| **B5** | A sink whose write **fails** (bad path, no permission) does not crash or stall the sweep | let the write throw uncaught |
| **B6** | The distribution artifact is derivable from the sink alone — no other source needed | — (procedural: the artifact is produced from the file) |

**B1 is the bar this item is about.** B5 is not defensive padding: the sweep runs on a 30 s interval inside the
registry, and an unhandled throw there is a failure mode strictly worse than the missing measurement.

## 5. Phasing

**S1 — the sink.** Code + tests (B1–B5). Small: one writer, one wiring line at `server.ts`, no change to
`classifySilence`. Deliverable on its own.

**S2 — deploy + drive traffic.** Rebuild, restart the live unit (**PO's hand — see §6**), then run real
multi-agent work until notices accumulate. Also set `AGENTTALK_RECORDING_PATH` while the plist is open.

**S3 — the artifact.** Reduce the sink to a distribution by `reason` × `transport`, write it into a durable
design artifact, and state which of W1/W2 it resolves. **This is the deliverable T3c consumes.**

**A run that produces zero notices is a RESULT.** If S2 drives genuine multi-agent turns past 180 s of silence
and the sink stays empty, that refutes W1 and lands us in W2 — a live defect in a shipped detector, which is a
larger finding than the threshold this spike set out to inform. **Do not treat an empty sink as a failed spike
and do not go hunting for a way to make it non-empty.** Report it.

## 6. Scope fence

**May touch:** a new sink module + its tests · the wiring line in `apps/orchestrator/src/server.ts` next to the
existing `agent_non_reply` handler · the new artifact under `design/`.

**May NOT touch:** `classifySilence` (`registry.ts:903`) — **expect a 0-line diff** · the emit site and its
dedup (`registry.ts:1002-1028`) · `AgentNonReplyReason` and the fault taxonomy · `agentIdleTimeoutMs` — **the
threshold is what we are measuring, not tuning** · anything on the path to `setAgentStatus`.

**⛔ Show-stoppers — stop and report, do not fix:**
- Any temptation to **change the threshold** because the numbers look inconvenient. The number is the output.
- Discovering W2 — that the sweep genuinely cannot fire. **File it; do not fix it in this task.** It is a
  behaviour change in shared engine code, and the Implementer Rules make it a show-stopper outright.
- Any need to restructure the emit site to get the data out.

**Deployment is the PO's.** Editing `com.fausto.agenttalk-orchestrator.plist` and restarting the live unit
changes the machine's running services, outside any worktree and outside the sandbox every other rule in this
project assumes. It needs the PO's hand or an explicit say-so — an agent must not do it unattended.

## 7. Risk

**S1's blast radius is a file nobody reads yet**, which is about as small as a live-code change gets — the same
argument T3a made, and it held. The real risk is procedural and worth naming: **a spike that measures nothing
and is declared done anyway.** §5's "zero notices is a RESULT" exists to make that outcome reportable rather
than embarrassing, because the failure mode here is an actor quietly widening the run until something appears.

**Effort:** S1 is small. S2's cost is dominated by driving real traffic, and its budget is provider tokens, not
engineering time.

## 8. Open questions for Gate 1 / the PO

1. **Sink path** — outside the repo (e.g. under `~/.agenttalk/`) or a gitignored path inside it? I recommend
   outside: it survives worktree cleanup and cannot pollute a task branch.
2. **How much traffic is enough for S2?** I would rather state a stopping rule up front than judge it later —
   proposal: **stop at 20 notices or 3 real multi-agent runs, whichever comes first**, and report the
   distribution as-is even if thin. A thin honest distribution beats a padded one.
3. **Does S2 need genuinely heterogeneous providers**, or does a single-provider team suffice for a first
   distribution? Cheaper is single-provider; the `transport` split is the dimension that matters, not the vendor.
4. Once S1 is in, **should the sink stay permanently** or be removed at T3c's close? I recommend it stays — a
   detector whose output is not recorded is the exact defect this item is about.
