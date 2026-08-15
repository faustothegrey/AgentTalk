# Plan — BL-124: give the idle advisory a channel that cannot be switched off, then measure

**Author:** Claude (planner). **Date:** 2026-08-12; **corrected 2026-08-13** after Gate 1.
**Status:** **Gate 1 PASSED conditionally 2026-08-13** (plan reviewer: Claude — *self-review under the
resource-scarcity fallback, see §9*), on condition that findings F1–F5 be corrected in this text before S1
starts. **They have been; this revision is the corrected text.** §9 records what changed and why.
**Item:** [[BL-124]] (filed 2026-08-12, on the PO's same-session decision "measurement spike first";
the §1 evidence was gathered 2026-08-11 — the session spanned the date boundary).
**Parents:** `design/bl028-plan.md` §5 (the phasing this discharges) · `design/bl028-t3b-plan.md`.
**Scope class:** observability only — one new sink, no change to what is classified. `human-only`.

> **The one-sentence version:** T3a's justification was measurement; the measurement never reached disk on the
> instance that sees real runs. This makes it reach disk, then gets the number T3c is required to have.

---

## 1. What is true today — read from the running system, not from the plan

> **Cite convention (corrected at Gate 1 — F2).** `registry.ts` here means
> **`packages/runtime-core/src/registry/registry.ts`**. There is no `registry.ts` under `apps/orchestrator/`,
> and the bare cites in this table's first revision sent a checker looking in the wrong package.

| Fact | Where | How verified |
|---|---|---|
| The sweep is live, advisory, and cannot kill | `registry.ts:1000-1029`; no path to `setAgentStatus` | code read + T3a's own tests |
| It emits `agent_non_reply` with `{reason, silentForMs}` | `registry.ts:1021-1029` | code read |
| Consumer 1: recorder | `server.ts:1302` — `recorder?.record(...)` | code read |
| Consumer 2: WS broadcast → UI | `server.ts:1303`; `App.tsx:251` | code read |
| Consumer 3: `console.warn` | `registry.ts:1028` | code read |
| **`recorder` exists only under `AGENTTALK_RECORDING_PATH`** | `apps/orchestrator/src/index.ts:21-23` | code read |
| **The live launchd unit does not set it** | `~/Library/LaunchAgents/com.fausto.agenttalk-orchestrator.plist` — `PORT`, `AGENTTALK_MCP_PORT`, `PATH`, nothing else | file read |
| **Zero notices in the live logs** | `~/.hermes/logs/agenttalk-orchestrator.err.log` (2.2 MB) + `.log` (132 KB) | `grep -c "has not replied"` → `0` / `0` (re-run 2026-08-13) |
| **The logs SPAN restarts** — launchd appends, so the zero-hit result covers **41 boots**, not one | `grep -c "Orchestrator V1 started"` → `41`; plist has no truncate directive | grep + plist read |
| The running build **does** contain T3a+T3b | **`packages/runtime-core/dist/registry/registry.js`**: warn string ×1, `awaiting-input` ×4; built 2026-08-09 08:01 | grep + `stat` |
| …and that IS what runs | launchd runs `dist/index.js` from `apps/orchestrator`; `node_modules/@agenttalk/runtime-core` → `packages/runtime-core` | plist + `ls -la` on the symlink |
| Threshold | `agentIdleTimeoutMs: 180000` (`registry/config.ts:19`) | code read |
| Orchestrator uptime | **PID 672, started 2026-08-13 14:24:31** (was PID 83663 / 08-11 when first written — it restarts) | `lsof -ti :3741` + `ps -o lstart` |

> **⚠️ F2, and it is worth stating rather than silently fixing.** The first revision verified the build claim
> against **`dist/registry/registry.js` at the repo root** — a **stale 2026-04-09 artifact** where both greps
> return **0**. The claim was TRUE and the evidence pointed at a file that refutes it. A checker following that
> cite literally would have "disproved" a correct statement and concluded the running build predates T3a —
> re-opening a build confound this plan had genuinely already closed. **The lesson is the one this whole item is
> about: an instrument aimed at the wrong target reports confidently and wrongly.**

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

**Two corrections to how strongly this evidence should be read (Gate 1, F5).** The first revision leaned on the
orchestrator's *uptime* as the observation window, which was already stale when written and is the weaker
framing. The stronger and the weaker fact are both worth holding:

- **Stronger than claimed:** the logs **append across restarts** — 41 startup banners — so "zero notices" is a
  result over **41 boots**, not over one process lifetime. That is a wider net than §1 originally asserted.
- **Weaker than it looks:** the process **restarts**, and each restart builds a fresh `Registry` — clearing
  `nonReplyReported` and every agent's `lastProgressAt`/`currentTurnId`. A turn must therefore accumulate its
  >180 s of silence **inside a single boot**. This does not favour W1 or W2, but it **constrains S2**: a restart
  mid-run silently truncates the very silence being measured. **S2 must record boot boundaries** so a
  distribution is never computed across a restart without saying so.

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
{"ts":"2026-08-13T14:24:31.123Z","agentId":"worker-1","turnId":"…","reason":"quiet","silentForMs":184200,"transport":"attached"}
```

`reason`, `silentForMs`, `agentId` and `turnId` come straight off the notice. `transport` **does not** — see
immediately below. `teamId` was in the first revision and has been **removed**.

### 3a. Where `transport` comes from — the F1 correction, and read it before writing any code

**The notice does not carry `transport`, and the first revision of this plan demanded it anyway.**
`AgentNonReplyNotice` (`packages/contracts/src/types.ts:161-169`) is exactly
`{agentId, reason, silentForMs, turnId, observedAt}` — while §6 forbids touching the emit site and the taxonomy.
**The plan required an output it prohibited the means of producing.** That contradiction is resolved here, not
left to the implementer, because the two obvious ways out are both traps:

| Field | Route | Verdict |
|---|---|---|
| `transport` | `registry.getAgent(id).transport` at the **handler** in `server.ts`, where `registry` is already in scope | **ADOPTED**, with the two hazards below made explicit |
| `teamId` | not on the agent at all — it lives on `TeamTask` (`types.ts:321`), with **no agent→team reverse lookup** in the registry | **DROPPED.** It appears in no bar and in no S3 output; an undescribed membership scan is not worth it for a field nothing consumes |

**Hazard 1 — `getAgent` THROWS on a miss.** `registry.ts:1251` is `if (!agent) throw new Error(...)` (the method
opens at `:1249`) — **not** an `undefined` return. The handler runs synchronously inside the sweep (§4, B5), so a lookup miss is not a lost
field — it is a **crash**. Resolve defensively: catch, or read `getAgents()`/the map without the throwing
accessor. **Never let the lookup escape the guard.**

**Hazard 2 — `transport` is OPTIONAL on the agent** (`transport?: AgentTransport`), so it can be legitimately
`undefined` on a successful lookup. **Record it as `null`/absent and count it as its own bucket in S3.** Do not
default it to a transport, and do not drop the line: a notice whose transport is unknown is still a notice, and
silently attributing it to the wrong bucket is precisely the attached-vs-in-process confusion that
`transport` is here to prevent (BL-120).

**Why keep `transport` at all, given the cost.** Because the distribution is uninterpretable without it. The
whole BL-120 arc turned on attached-vs-in-process being confused; a distribution that cannot be split by
transport would invite exactly that error again. The cost is one guarded lookup.

**Where it writes.** A path defaulting to something stable and **outside the repo** (see §8 q1). It must not
land in a git worktree — a spike that pollutes `git status` teaches the wrong habit and would trip the hygiene
checks at close.

**The path is a CONSTRUCTOR ARGUMENT with a default — not an env-only knob.** B1 requires the sink to work with
*no* env configuration, and the tests must not write to the real path; those two collide unless the path is
injectable. An env override may exist **on top of** the default, but the default must be live when nothing is
set, or B1 is unmeetable by construction.

**It appends.** `createWriteStream(path, { flags: 'a' })`. See B7 — this is the one place the house precedent
must **not** be copied.

## 4. Bars — each with the mutation that must turn it red

| # | Bar | Mutation that must turn it red |
|---|---|---|
| **B1** | A notice emitted with **no** env configuration at all produces a line in the sink | make the sink construction conditional on any env var |
| **B2** | The line's `silentForMs` and `reason` **equal** the notice's own fields | write a recomputed or rounded value |
| **B3** | `awaiting-input` and `quiet` are **both** recorded and distinguishable | filter either out at the sink |
| **B4** | **Nothing propagates, still.** The sink is a pure reader — no status change, `handleAgentFailure` never called | give the sink any return value the sweep acts on |
| **B5** | **No throw from anywhere in the sink path escapes** — bad path, no permission, a failed `transport` lookup, or an unserializable payload. The sweep completes and the process survives | let any of those throw uncaught |
| **B6** | The distribution artifact is derivable from the sink alone — no other source needed | — (procedural: the artifact is produced from the file) |
| **B7** | **A restart does not truncate.** Lines written before a restart are still present after one | open the stream with `flags: 'w'` |

**B1 is the bar this item is about. B5 is the one that can hurt you, and it was scoped too narrowly.**

**B5 — widened at Gate 1 (F4), and the reason is worse than "a lost measurement."** The handler at
`server.ts:1301` is a plain `registry.on(...)` listener. Node invokes listeners **synchronously inside
`emit()`** — which is inside `checkIdleAgents()` (`registry.ts:1000`), which is inside
`setInterval(() => this.checkIdleAgents(), 30000)` (`registry.ts:226`). **There is no `try`/`catch` anywhere on
that path.** An uncaught throw in a timer callback takes down the **live orchestrator**. Worse, the throw would
land *after* `this.nonReplyReported.set(id, key)` (`registry.ts:1019`), so the dedup has already recorded the
notice as reported and the retry is suppressed — data loss stacked on a crash. It also aborts the loop for
every agent not yet visited in that pass.
**Therefore: the guard sits at the HANDLER, not only inside the sink module** — the `transport` lookup from §3a
happens at the handler, outside the sink, and an unguarded sink is no protection against it.

**B7 — added at Gate 1 (F3), because the nearest precedent gets this wrong.** The obvious model to copy is
`SessionRecorder`, which opens with **`createWriteStream(filePath, { flags: 'w' })`** —
`packages/observability/src/recordings/session-recorder.ts:17`. That **truncates on every construction**. This
is not a hypothetical: the live unit shows **41 startup banners**, it restarted between this plan's first
revision and its correction, and **S2's own procedure includes a restart**. Copying the house pattern would
erase the measurement at the exact moment the spike is deployed to collect it.

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
existing `agent_non_reply` handler — **including a guarded, read-only `transport` lookup there per §3a** · the
new artifact under `design/`.

**May NOT touch:** `classifySilence` (`registry.ts:903`) — **expect a 0-line diff** · the emit site and its
dedup (`registry.ts:1000-1029`) · `AgentNonReplyNotice` and `AgentNonReplyReason` and the fault taxonomy ·
`agentIdleTimeoutMs` — **the threshold is what we are measuring, not tuning** · anything on the path to
`setAgentStatus`.

**The fence and §3a agree, deliberately.** The `transport` lookup is a **read** performed at the handler in
`server.ts` — inside the "may touch" surface. It is **not** a licence to add the field to the notice: enriching
`AgentNonReplyNotice` would be the cleaner design and it is **out of scope here**, because it moves a contract
type for an observability spike. If the sink outlives the spike (§8 q4), **that** is when to propose it.

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

## 8. Open questions — dispositions after Gate 1

1. **Sink path** — **SETTLED at Gate 1 (planner's call, PO may overturn): outside the repo, under
   `~/.agenttalk/`.** It survives worktree cleanup and cannot pollute a task branch. **The mechanism was the
   real question and it is now in §3a:** the path is a **constructor argument with a live default**, not an env
   knob, because B1 ("works with no env configuration") and testability ("tests must not write to the real
   path") are otherwise unsatisfiable together.
2. **How much traffic is enough for S2?** — **stop at 20 notices or 3 real multi-agent runs, whichever comes
   first**, reported as-is even if thin. **Confirmed at Gate 1**, and the point of fixing it now is that it is
   fixed *before* anyone sees a result. A thin honest distribution beats a padded one.
3. **Does S2 need genuinely heterogeneous providers?** — **No; single-provider suffices.** Confirmed at Gate 1
   against the code: `activateAgent` (`registry.ts:341`) starts an `InProcessAgentDriver` for **both**
   transports — the branch is `registry.ts:382`, and only the `Completer` differs — so the `transport` axis is
   exercised without a second vendor.
   Cheaper, and the vendor is not the dimension this distribution is cut on.
4. **Should the sink stay permanently, or be removed at T3c's close?** — **STILL OPEN, and it is a PO call that
   wants taking now, not at T3c's close.** It decides whether S1 is spike scaffolding or a supported artifact,
   which changes how much the implementer invests in it. **Planner's recommendation: it stays** — a detector
   whose output is not recorded is the exact defect this item exists to retire, and removing the sink would
   restore that defect the day the spike ends.

## 9. What Gate 1 changed, and why it is recorded rather than quietly fixed

Gate 1 was a **self-review**: I authored this plan and, as the sole available agent under the resource-scarcity
fallback, also held the plan-reviewer seat. The independence default (`Plan Reviewer ≠ Planner`,
`AGENT.md → FIRST ENTRY POINT`) was therefore **not** satisfied, and this section exists so the next reader can
weigh the gate accordingly rather than take "Gate 1 passed" at face value.

| # | Finding | Correction |
|---|---|---|
| **F1** | §3 mandated `transport` **and** `teamId`; the notice carries neither, and §6 forbade the emit-site change that would supply them — **the plan required an output it prohibited the means of producing** | **§3a** added: `transport` resolved by a guarded lookup at the handler (both hazards named); `teamId` **dropped** |
| **F2** | §1 verified the build claim against a **stale April artifact** where the greps return `0` — a cite that refutes a true statement | §1 cite corrected to `packages/runtime-core/dist/...`, resolution path shown, and the error kept on the record |
| **F3** | "append-only" was stated but never pinned, while the nearest precedent (`SessionRecorder`) opens with `flags: 'w'` and **truncates** | **B7** added; §3a pins `flags: 'a'`; the precedent explicitly marked as the one not to copy |
| **F4** | B5 covered only *write* failure, but the handler runs synchronously inside an **unguarded `setInterval`** — any throw crashes the live orchestrator | B5 widened to any throw on the sink path; guard placed at the **handler** |
| **F5** | §1's uptime line was stale, and uptime was the weaker framing | Refreshed; replaced with the **41-boot log span**, and §2 gained the restart constraint on S2 |

**The through-line, which is the same one BL-124 is about.** F1 and F2 are both instruments aimed at the wrong
target: a specimen line asserting fields nobody had checked existed, and a grep run against a file that was not
the one running. Neither would have announced itself — a wrong cite returns a confident number, exactly as
`recorder?.record(...)` returned a confident nothing. **F2 in particular was a live near-miss:** the next
checker to follow that cite would have concluded the running build predates T3a and re-opened a confound this
plan had correctly closed.
