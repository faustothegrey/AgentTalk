# Backlog — team-orchestration

Open items owned by the **team-orchestration** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-068
status: deferred
date: 2026-07-17
epic: null
tags: [engine, ids, convention, enforcement, refuted-approach, contracts, cross-repo]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the cross-repo contract change becomes PO scope · **the disease behind BL-066/BL-067; the six sites were its symptoms** · the obvious guard is **REFUTED by its own survey** — read that before proposing it again · the cure with teeth is a **cross-repo contract change** = PO scope call · PO chose "file the findings, build nothing" 2026-07-17] — **The id convention is unenforced, and the obvious guard does not work.** `mintId(prefix)` (`registry/ids.ts`) is now the convention. **Nothing makes the next person find it.**

  **The disease (BL-067's closing finding, restated because it outlives both fixes).** `registry.ts:616` (`` `msg-${Date.now()}-${this.outboundMessageSeq}` ``) and `:802` (`` `pending-relay-${Date.now()}-${++this.pendingRelaySeq}` ``) **already appended a counter** before BL-066 existed. Two people hit this defect, solved it locally, and **it never became a convention** — so it was re-introduced six times. **It was never six bugs; it was a missing convention.** `mintId` cures the six sites and cures the class only if the next person finds it.

  **The proposed guard — a test that scans source for a `Date.now()` reaching an id — is REFUTED, before implementation, by the survey that was meant to justify it (2026-07-17).** It fails at both ends at once:

  1. **Broad, it cries wolf.** There are **49 `Date.now()` sites** in source (`packages`/`apps`/`scripts`, excluding tests/dist). **~40 are ordinary elapsed-time arithmetic** — deadlines, cutoffs, `Date.now() - startedAt`, `new Date(Date.now() + intervalSeconds*1000)`. A scan that flags them is [[BL-023]]'s *"a check that cries wolf gets disabled"* on day one — one item removed from the thing it is trying to prevent.
  2. **Narrowed to the id shape, it leaks — and it leaks on this very class.** `scenario-scheduler.ts:71` assigns `Date.now()` to a **variable** (`runSuffix`), passes it as an **argument**, and interpolates it in a **different function** (`:119`, `` `${agent.id}-${suffix}` ``). **No pattern-scan of practical precision follows that.** See [[BL-069]] — filed separately, and found only by the broad survey.

  **So the instrument is noisy at one end and blind at the other, and the site it misses is exactly the class it claims to guard.** Note the provenance: this refutation exists because the survey was run **before** the code, and run **broadly** ("every `Date.now()`") rather than shaped to its conclusion — which is precisely the discipline [[BL-067]] was filed to establish.

  **The cure with teeth: branded id types.** `mintId` returns `TeamId`; `Team.id: TeamId`; then `` id: `team-${Date.now()}` `` **fails to compile**. `tsc` becomes the thing that tells the next person — no wolf to cry, and it follows values through variables and across files, which is the leak above. **Two honest limits, both read out of the code rather than assumed:**
  - **It cannot cover agent ids.** `server.ts:604` — `const agentId = id || (provider ? mintId(...) : mintId('agent'))`. **External ids are legitimate for agents by design** (attach mode, `POST /api/agents`, scenario JSON). Branding covers **team/task/conversation only**; BL-069's site stays uncovered.
  - **It is a cross-repo contract change.** The id types live in **`packages/contracts/src/types.ts`** — shared with **`agentalk-mcp-client`** and **`apps/web`**. That is not a narrow test; it is the contract surface, with the contract-hash coupling that comes with it.
  - It also introduces its own escape hatch (`asTeamId(s)`) at external boundaries. Misusable — but **explicitly and greppably** so, unlike today's silent default.

  **Where it stands.** The greenlit thing should not be built; the thing that would work is bigger than the greenlight. **PO scope call.** Reopen trigger regardless: **if a seventh id site is ever introduced**, or if `packages/contracts` is opened for another reason, this is the moment to take it.

<!-- @item
id: BL-024
status: deferred
date: 2026-07-09
epic: null
tags: [architecture, brain, types, friction-m18]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: the brain`s client-shape leak actually blocks a change (adding a provider or transport) · **M18 C7 friction item** — PO asked "is the brain shielded from client shape?"; audit says no.
  **M19 inception candidate**, pairs naturally with BL-014/BL-015-L2] — **The brain leaks client shape: `AgentProvider`
  conflates transport with vendor** — `packages/contracts/src/types.ts:13` is
  `'api' | 'mcp' | 'gemini' | 'claude' | 'codex'` — two shapes and three vendors in one union. It already caused
  the M17 G3-2 refute (`provider: 'api'` read as "the human channel"). Two more leaks: `team-coordinator.ts:977-986`
  bumps the fact-collection timeout `if (team.provider === 'gemini')` — **a vendor name changes protocol timing
  inside the frozen engine**; `registry.ts:239-259` selects driver/completer by provider rather than behind a
  factory. The *law* (authority, routing) is genuinely shape-blind and survives audit; the *plumbing* is not.
  **Evidence:** **LB-65** (full audit with line refs). Fix sketch: `transport` (`attached` | `in-process`) ×
  `vendor`; move the timeout to per-agent capability metadata; factory for driver selection.
  **⚠️ 2026-07-10 backlog gate — this item is load-bearing for SP2 and nobody had noticed.** SP2's whole subject is
  running `fact_collection → discussion → proposal` across two **real attached CLIs** — and the `provider === 'gemini'`
  branch above **changes the timing of `fact_collection` itself, inside the frozen engine**. It is unknown what
  `provider` value a real attached CLI carries (`'mcp'`? the vendor name?); the union admits both, and that ambiguity
  already caused the M17 G3-2 refute. **SP2 must RECORD each attached agent's `provider` value as a first-class
  observation** — the spike cannot interpret its own result without it. Recording is a spike act (read-only);
  **fixing this is not, and is out of scope for SP2 and M19.**
  **2026-07-11 M19 gate — SP2 CONFIRMED it: both real CLI candidates registered `provider:mcp`** (14 recorder events,
  0 vendor-shaped). Disposition **unchanged — stays a recorded constraint, NOT folded into M19** (planner pushback,
  architect-adopted; consistent with the 2026-07-10 out-of-scope ruling). M19 records `provider:mcp` and works within it.
  **UPDATE (2026-07-18) — DESIGN DOC written (architect): `design/archive/bl024-provider-split-design.md`.** Ground-truth
  re-audit (line refs had drifted): the 3 leaks confirmed at `types.ts:31`, `team-coordinator.ts:1004-1017`,
  `registry.ts:246/249/360/597`. **Key finding:** the registry sniff sites never distinguish the vendor names from
  `'mcp'` — they collapse to one **transport** predicate (in-process vs attached); the *only* vendor-behavioural
  site is the frozen-engine gemini timeout (leak #2). Proposed: `transport:'in-process'|'attached'` on the engine,
  `vendor`/`capabilities` at the edge, timeout → per-agent capability metadata (kills leak #2). Phasing T1 (type+edge,
  no engine change) · T2 (frozen-engine slice) · T3 (client cutover). **GATE PASSED (PO, 2026-07-18):** all four §8
  questions decided per recommendations, incl. **explicit authorization for the T2 frozen-engine edit** (byte-identical
  timeout + IP-15 proof obligation). See the design doc for the recorded decisions.
  **UPDATE (2026-07-18) — T1 MERGED (`5dfab83`, branch `task-BL-024-T1`, PO-gated).** Plan: `design/archive/bl024-t1-plan.md`
  (gate approved). Additive type+edge, **engine untouched**: `AgentTransport`/`AgentVendor`/`AgentCapabilities` +
  pure `normalizeAgentKind` (contracts); Agent record carries the new axes alongside the still-populated legacy
  `provider`/`providerName`; registry driver selection now keyed on `transport`; `POST /api/agents` accepts the new
  shape. `team-coordinator.ts` (frozen) untouched → gemini timeout byte-identical. tsc clean, suite **389/389** (372
  + 17 new), wire-contract hash unchanged. **Item stays `todo` — T2 next:** move the fact-collection timeout out of
  the frozen engine into the per-agent `capabilities` metadata (authorized; byte-identical + IP-15 proof); then T3
  (client cutover + legacy `provider` drop). Follow-up noted: add `contracts` to the vitest `include`.
  **UPDATE (2026-07-18) — T2 MERGED (`0375ecd` on branch `task-BL-024-T2`, merge `8375387`, PO-gated).** Plan:
  `design/archive/bl024-t2-plan.md` (gate approved with recommendations). The frozen `getFactCollectionTimeoutMs` is now
  **vendor-blind** — reads only `capabilities.factCollectionTimeoutMs` (team + members); no `team.provider`/
  `agent.providerName === 'gemini'` sniff remains in the coordinator. **D1:** `normalizeAgentKind` closes the
  `provider:'mcp'`+`providerName:'gemini'` gap (caps present iff the agent would have triggered the old 720s bump);
  all T1 outputs unchanged. **D2:** `Team.capabilities` added, populated in the `registry.createTeam` wrapper (frozen
  file's diff limited to the one §8-Q1-authorized function). Dead `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS` const
  removed (contracts twin remains). **IP-15 proof:** new fact-collection-timeout test pins exact ms (720s for cases
  a/b/c incl. the `mcp`+`providerName` gap, 480s default) and the discriminator fails if the edge injection is
  reverted (**manually verified** via stash-and-rerun: neutering D1 → case (c) 720→480 fail, then restored). tsc
  clean, suite **398/398** (389 + 9 new, existing tests unmodified), wire-contract hash **v8 unchanged**. **Item
  stays `todo` — T3 next:** client cutover (send `{transport,vendor}`) + drop the legacy `provider` acceptance
  (cross-repo). Not pushed at merge time — awaiting the PO's `push` word.
  **UPDATE (2026-07-18) — T3 SPLIT into T3a/T3b (PO-approved); T3a MERGED + PUSHED.** Plan: `design/archive/bl024-t3-plan.md`
  (§4 flag-day rationale; §7b gate decisions). **T3a** (client `agentalk-mcp-client` @ merge `3612511`, feat `71fb867`):
  `agent-launcher` cuts over to `{transport:'attached', vendor}` for `gemini/claude/codex`; **server needs no change**
  (`activateAgent` re-derives from the stored provider; `/api/agents` already accepts the new shape since T1). Client
  suite **85/85**; **live cross-repo check** — the real orchestrator accepted the new body and derived `provider:'claude'`.
  **`goose` ruling (PO):** goose is a **real vendor** but its axis mapping is **deferred** ("not now") — it is in neither
  `AgentVendor` nor the legacy `AgentProvider` union, so T3a **keeps goose on the legacy `provider` path** (pinned by a
  new test); sending `transport` would force it to opaque `'mcp'`, a behaviour change needing the deferred reverse-map
  design. **Consequence: T3b (legacy-`provider` drop) is BLOCKED on the goose-as-vendor spec** — you cannot remove
  legacy acceptance while goose is the sole remaining user of it. **Item stays `todo` — T3b pending the goose spec**
  (union + reverse-map for goose, then drop legacy acceptance + fixture/recordings sweep).
  **UPDATE (2026-07-18) — goose spec GREENLIT (PO, reversing "not now") + T3b MERGED + PUSHED (cross-repo).** Plan:
  `design/archive/bl024-t3b-plan.md`. **The PO's aim was "a real goose client at the end" — achieved and LIVE-PROVEN.** goose
  was fully broken (start failed at `registry.ts:293`); now it is a first-class vendor. AgentTalk (`92bd383`, merge of
  `d0f7a99`): `AgentVendor`/`AgentProvider` += `'goose'` (serialization label post-T2), symmetric `normalizeAgentKind`
  case (→ `attached`), server validates `vendor:'goose'`; goose gets **no** capability (default fact-collection
  timeout, not the gemini bump). Client (`79b6268`, merge of `9d9bf5d`): goose cuts over to `{transport,vendor,model}`;
  **model is a REQUIRED companion for goose** (a harness over an OpenRouter model) — launcher rejects goose-with-no-model
  (400) and `provider-runtime` drops the silent `openai/gpt-4o-mini` default; claude/gemini/codex keep theirs.
  **Live proof:** real goose CLI 1.41.0 over OpenRouter attached over MCP and returned **computed** products —
  `17×23=391` (direct) and `31×19=589` (through the real launcher's cutover path). AgentTalk **401/401**, client
  **86/86**, tsc clean, no wire-contract hash change.
  **UPDATE (2026-07-18) — T3b-2 (part) MERGED + PUSHED: web UI cut over.** Audit found the legacy `provider` input is
  a real migration, not a cleanup — sent by the **live web UI**, ~12 scripts, and recordings. PO call: **migrate the
  web UI now, defer the hard-drop.** AgentTalk `2d0bdb8` (merge of `c74a8ee`): `App.tsx` create/start POSTs
  (`handleCreateAgent`, `handleAutostartChat`, `handleAutostartTeam`) send `{transport:'attached', vendor}`.
  **Live-proven through the real UI** (Chrome): created a Gemini agent → backend received
  `{transport:'attached', vendor:'gemini'}` → agent READY. Suite 401/401, web tsc clean. Server still accepts legacy
  input (unchanged). **Item stays `todo` — DEFERRED remainder (own future task):** the server **hard-drop** of legacy
  `provider` input (`/api/agents` create+start, `/api/teams`) + migrate the **~12 scripts** (`test-live-*.mjs`, m07/m14/m17
  smokes) + a **read-side recordings shim** (`planning_runs/*.json`); **keep** `agent.provider` as a derived
  serialization field and DON'T delete the `AgentProvider` type; leave `isUsageCaptureProvider` alone (different axis).
  Plan: `design/archive/bl024-t3b-plan.md` §2/§4.

<!-- @item
id: BL-028
status: todo
date: 2026-07-10
epic: null
tags: [engine, m03, dead-code, false-claim, fault-tolerance]
blocked_by: [BL-084, BL-135]
autonomy: human-only
-->
- [todo · **dead mechanism + false feature claim; found while scoping M19, PO-approved to file 2026-07-10**] —
  **The idle timeout has never been able to fire** — `agentIdleTimeoutMs: 180000` is configured
  (`registry/config.ts:12`) and swept every 30s (`registry.ts:155`), but `hasAgentTimedOut()` short-circuits on
  `if (!agent.lastProgressAt) return false` (`registry.ts:663`) and **`lastProgressAt` is never assigned** —
  declared at `agents/agent.ts:28`, read twice, written nowhere in either repo (exhaustive grep incl. dynamic
  write paths). Doubly dead: only `status === 'busy'` agents are swept at all. **Consequence:** a *hung* agent is
  never detected. Clean disconnect → `terminated` (M05) and explicit `error` propagation both still work; it is
  wedging that goes unseen — verbatim the Hermes failure mode (LB-49). **No test covers it**: the only idle test
  (`__tests__/team-worker-effect-fence.test.ts:70-71`) asserts the *exemption* predicate, so it passes identically
  whether the timeout works or not — **IP-15 in our own suite**, shipped by M08-T3, which added a guard against a
  timeout that could not occur. `AGENT.md`'s M03 "including idle timeouts" claim corrected 2026-07-10.
  **Evidence:** LB-70. **Not a blocker for M19** (the sweep cannot kill a slow real-CLI conversation — we are
  accidentally immune). **Fix sketch — and the ordering is load-bearing:** do **not** land the timeout alone. The
  moment the sweep goes live, an agent paused `awaiting-input` (blocked on a human) is observationally identical to
  a dead one and M03 kills the team task for an agent that behaved correctly. Land it **together with** the typed
  non-reply `reason` from LB-67 Finding 1 (`turn-ended · exited · quiet · user-stopped · errored · awaiting-input ·
  receiver-cancelled`). One piece of work, not two.

  **2026-07-27 — that "one piece of work" is now filed as [[BL-084]], and this item depends on it.** The BL-078
  decision brief (`design/archive/bl078-decision.md`) found the *same* missing primitive from the other direction:
  `error` is one undifferentiated bucket, so neither the idle timeout (here) nor driver-path propagation
  (BL-078) can land alone. **Do the typed reason once, in BL-084; then this item and BL-078 both close on top of
  it.** Status left `todo` rather than `deferred` — a PO call, worth making at the next backlog gate.

  **⚠️ 2026-08-07 — T3a MERGED (`f6c7655`), and the "doubly dead" diagnosis above is INCOMPLETE — read this
  before planning T3b/T3c.** Plan: `modules/agent-runtime/docs/bl028-plan.md` (PO ratified the three-phase shape; T3c still open).
  **⛔ THE PARAGRAPH THAT STOOD HERE IS RETRACTED (2026-08-07, same day) — it claimed a "THIRD deadness":
  that on the attached transport an agent essentially never reaches `status === 'busy'`, so writing
  `lastProgressAt` would have revived the sweep for in-process agents only. THAT WAS FALSE.**
  `activateAgent` (`registry.ts:377`) starts an `InProcessAgentDriver` for **both** transports — only the
  `Completer` differs — and that driver sets `busy` on every turn it pulls (`in-process-driver.ts:118`). An
  attached agent goes `ready → busy` with **no disconnect**; reproduced by live probe twice. The error was
  reading a **file name** as a statement of scope. **This item's original "doubly dead" diagnosis was correct;
  my correction to it was the mistake.** Refuted by the hmp6 run investigating [[BL-120]] — an item that
  paragraph produced. Evidence: `design/archive/bl120-attached-busy-investigation.md` §2.2; retraction in
  `modules/agent-runtime/docs/bl028-plan.md` §2.
  **What still stands:** the gate T3a shipped is `currentTurnId` ("an obligation is outstanding"), which is a
  sharper question than "is this agent busy" and is the one the sweep asks. It was **argued from a false
  premise, not built on one** — no behaviour is affected, and no assertion changed.
  **What T3a does NOT do — do not read the merge as closing the item.** The sweep is **advisory**: it emits
  `agent_non_reply` (`reason: 'quiet'`) and has **no path to `setAgentStatus` at all**. `idle-timeout` keeps its
  fault-class row **with no caller**, exactly as `conversation-start-failed` did between BL-084 T1 and T2.
  **Nothing detects a hung agent yet** — T3a makes silence *visible*, deliberately not fatal, because `quiet` is
  also what a working agent mid-turn looks like and a real CLI routinely exceeds the 180s default on one honest
  turn (LB-67 Finding 1: our own prior art demoted this exact signal to advisory). **Remaining: T3b** — the
  non-reply vocabulary, whose seven names now exist in `contracts/types.ts` but are **unwired**; a name there is
  *not* a claim the condition is detected — **and T3c**, escalation via an unanswered healthcheck (a *positive*
  test, separately gated). **PO decision §9 q2 is still open: should the sweep ever kill at all?**
  **Telemetry (T3a delivery):**
  - task:        BL-028 T3a
  - wall-clock:  2026-08-07 10:12 → 11:07 (~55m, including the plan)
  - budget:      weekly 16%→17% (Δ ~1%), session 24%→41% (Δ ~17%)
  - gate:        tsc 0, suite 722/722 (86 files; baseline 711/711 / 84 recorded before any edit), wire contract
                 v8 verified + client alignment, pollution clean, `team-coordinator.ts` 0-line diff
  - diff:        6 files, +419/-18; commits `67ca156` `a935c53`, merge `f6c7655`
  - outcome:     MERGED ✅ — item stays `todo` (1 of 3 phases)

  **✅ 2026-08-08 — T3b DELIVERED. 2 of 3 phases done; the item stays `todo` for T3c.**
  Plan: `modules/agent-runtime/docs/bl028-t3b-plan.md` (Gate 1 approved with two PO decisions recorded in §8b).

  **What T3b changed.** `quietForMs` became `classifySilence` and now returns
  `{reason, silentForMs} | undefined`: the old `number | undefined` conflated **three** facts behind one
  `undefined` — nobody is waiting, a human is in the loop, and silent-but-under-threshold — and you cannot name
  `awaiting-input` through a channel that has already erased the distinction. The two human-in-the-loop pauses
  (fact-collection, `awaiting_operator`) are now **reported as `awaiting-input`** instead of silently returning.
  They are returned rather than swallowed deliberately: **a suppressed exemption is a decision T3c would be
  structurally unable to make.** The dedup key gained the reason (`<turnId>::<reason>`), so a turn whose reason
  *changes* speaks again.
  **Nothing gained a path to `setAgentStatus`** — bar C4 pins that for **both** reasons, with the mutation run.

  **The advisory also had no READER, which is what the plan found and the phasing note had not.** A repo-wide
  search across **both** repos returned exactly one consumer of `agent_non_reply`: T3a's own test. So the
  distribution T3c's threshold is supposed to be derived from was going to stdout and nowhere else. `server.ts`
  now records it (`recorder.record('runtime', …)`) and broadcasts it, following the `workflow_gate_attempt`
  precedent, and `App.tsx` has the matching `case` arm — **without which the broadcast would have been dropped
  silently, since that switch has no `default`.** Contract-safe: `wire-contract.json`'s hashed `data` is exactly
  `{mcpTools, packetTypes, protocolPrefix}` (verified at the artifact, v8), so no attached client is affected.

  **B5's behaviour contract CHANGED, with explicit PO approval** — from *"fact-collection and awaiting_operator
  still suppress"* to *"…are reported as `awaiting-input`, and still kill nobody"*. Put to the PO as a
  contract change rather than folded in (CLAUDE.md's tests-are-contracts rule). The property the bar protects is
  unchanged; T3a bought it with silence, T3b buys it with a name.

  **⚠️ Bar C8 is NOT delivered — accepted `not-checked` by the PO, not worked around.** C8 was "the UI arm
  renders the reason". `vitest.config.ts:29` **excludes `apps/web/**`** and the package carries no test
  dependency, so no UI assertion is possible; satisfying it meant standing up web test infrastructure and editing
  shared test config, outside the task's fence. The arm's *input* is proven (C7: a real connected WebSocket
  client receives the notice intact); its *rendering* is not. **To be verified by eye on the next live run.**
  Filed as its own item → [[BL-122]].

  **Bars: C1–C6 + C9 (runtime-core), C7 (orchestrator). All NINE mutations were RUN and each turned its own bar
  red** — not asserted, executed; the summary is in the plan's delivery record. **C9 was not pre-registered**:
  writing the classifier surfaced a consequence the plan had missed (naming a case needs a duration, so the
  exemption checks had to move *below* the threshold test), and without a bar that reorder could have turned
  every human-paused agent into a notice on the first sweep with no planned bar failing. Declared as an addition.

  **Still open after T3b — unchanged and deliberate:** **nothing detects a hung agent.** T3c (escalation via an
  *unanswered healthcheck* — a positive test, not silence) is separately gated, and **PO question §9 q2 is still
  open: should the sweep ever kill at all?** A detector that only reports is a legitimate end state. T3b's new
  recorder is what makes that question answerable with measured numbers instead of a guess.

  **Telemetry (T3b delivery):**
  - task:        BL-028 T3b
  - wall-clock:  2026-08-08 17:23 → 23:0x (~5h40m elapsed, including the plan, Gate 1 and the mutation runs)
  - budget:      claude weekly 27%→31% (Δ ~4%), session 0%→0% (window reset mid-task, so the session figure is
                 not meaningful for this task — the weekly delta is the honest number)
  - gate:        tsc **0**, suite **743/743 (89 files)** — baseline recorded before any edit was 733/733 (87);
                 +10 = exactly the two new bar files. Pollution: one task worktree, no stray processes.
  - diff:        6 files (4 modified, 2 new), +123/-35 in the modified set; commit `64cdfea` on
                 `task-BL-028-T3b`
  - outcome:     **MERGED ✅ `9ba8197` — PUSHED** (PO-authorized 2026-08-09) — item stays `todo` (2 of 3
                 phases; T3c remains, and §9 q2 is still open)
  - ⚠️ note:     gate 3's fresh-eyes property was **NOT obtained** — one actor held planner, plan reviewer,
                 implementer and task-end reviewer under the resource-scarcity fallback. The primer had left
                 this merge for a cold session for exactly that reason; the **PO overrode that and authorized
                 the merge directly**, which is the PO's call. Recorded rather than glossed. Post-merge gate
                 re-run on the merge result: tsc **0**, suite **743/743 (89 files)**.

  **⛔ 2026-08-14 — T3c's PREMISE IS GONE. Do not let it proceed on the old framing.** ([[BL-124]] S3; filed
  with [[BL-130]].) T3c was scoped as *"derive the escalation threshold from the measured distribution"*, and
  T3b's closing note above says the new recorder *"is what makes that question answerable with measured numbers
  instead of a guess."* **There is no distribution, and there was never going to be one.** S3 drove real traffic
  at the live instance and the sink stayed empty — not because the system is healthy, but because **the detector
  cannot fire on any turn class as deployed**: an `exec_rpc` turn carries no obligation id, so `classifySilence`'s
  `currentTurnId` gate returns `undefined` forever ([[BL-127]]), and where an id *does* exist the 120s
  `DEFAULT_EXEC_TIMEOUT_MS` tears the turn down before the 180s threshold matures ([[BL-128]]). A worker held an
  obligation in unbroken silence for **233 s** and produced no notice **and no `console.warn`** — and
  `registry.ts:1028` warns unconditionally immediately before the emit, so the failure is upstream of the sink.
  **T3b's recorder and sink are fine; they have simply never been exercised.** Artifact:
  `design/archive/bl124-s3-distribution.md`.
  **What this changes for T3c:** the number was never the blocker. **Its real precondition is now "a sweep that
  can observe an exec turn"** — i.e. BL-127 and BL-128, which are coupled (fixing either alone leaves the
  detector dead) and are a **PO scope call**, both being shared engine code under the show-stopper fence.
  **§9 q2 ("should the sweep ever kill at all?") is untouched by this** and remains open — but it cannot be
  answered from measurement until something can be measured.
  *(`blocked_by` deliberately left as `[BL-084]` — adding BL-127/BL-128 is a sequencing act, which is the
  SM/PO's, not this note's.)*

  **✅ UPDATE, same day — the precondition named above is SATISFIED, and merged: `29a87c9`.**
  [[BL-127]] and [[BL-128]] are fixed, gate-2 verified and gate-3 closed on mainline.
  *(**This sentence has now been wrong twice, in opposite directions, and the second time was mine.** It was
  committed as "are fixed and merged" while the work sat unmerged on a branch — false. Gate 2 corrected it to
  "the merge is gate 3's and has not happened" — true when written, and made false forty minutes later by the
  gate-3 merge, **by the same reviewer who wrote it**. Both errors are one error: a sentence that asserts merge
  state from a vantage point that cannot see it. **The fix that finally holds is the sha** — `29a87c9` is
  checkable and cannot go stale, where "merged" and "not merged" both rot. [[BL-130]]'s lesson, learned the
  expensive way, twice.)*
  An exec turn now carries an obligation and gives it back, and every exec path forwards a deadline
  that outlives the threshold. **The sweep can observe an exec turn.** T3c's real blocker is
  therefore gone —
  but read the next sentence before scheduling it. **We still have no distribution, and now we have something
  better than the old plan: a detector that can produce one.** The honest sequence is (1) let the instrument run
  against real traffic, (2) *then* ask what threshold the data supports. Do not re-derive T3c's old framing from
  this update; the number was never the blocker and still is not.
  **⚠️ AND THE INSTRUMENT IS NOT RUNNING YET — checked 2026-08-14 21:5x, do not skip this before scheduling
  T3c.** The fix is merged (`29a87c9`, 14 Aug **21:47**). The live orchestrator is **pid 89437, port 3741,
  started 13 Aug 21:07** — *a day before the merge*. **So the deployed sweep is still structurally blind: it
  is running the exact pre-[[BL-127]] code whose blindness [[BL-124]] S3 measured.** Anyone who reads "the
  sweep can observe an exec turn" and then goes looking at the live instance for notices will find zero and
  reach S3's conclusion a second time, for a reason that is no longer true.

  **The next action on this item is therefore an OPERATIONAL one, not a coding one: redeploy, then drive real
  traffic, then look.** Deliberately NOT done here — restarting the PO's live service discards whatever team
  state it holds (including the hung `team-1786704512290-3` that [[BL-129]] documents), and that is a call for
  the PO or the operator seat, not something to slip into a backlog sweep.

  **✅ 2026-08-15 07:47 — REDEPLOYED, PO-authorized. STEP (1) IS DONE; the warning above is now HISTORY.**
  And the warning's own evidence had already gone stale before it was acted on, which is worth more than the
  fix: **pid 89437 no longer existed.** The service had been restarted at 14 Aug 23:28 (pid 673) — *after*
  every merge — so "started a day before the merge" was false within hours of being written. **The conclusion
  survived anyway, for a different and checkable reason: the process was restarted without a rebuild.**
  Measured before touching anything: `packages/runtime-core/dist/registry/registry.js` was built 14 Aug
  **21:48**, one minute after `29a87c9` — so [[BL-127]]/[[BL-128]] *were* deployed — while `exec-timeout`
  ([[BL-129]], merged 22:57) and `team_no_progress` ([[BL-133]], merged 23:18) were **absent from `dist`
  entirely**, present only in `src`. **A restart is not a redeploy.**
  Now: `tsc -b` exit 0, `launchctl kickstart`, **pid 7121, started 15 Aug 07:47:19**, `/api/teams` `[]`,
  backlog parsing clean. All four fixes are running for the first time. The restart cost nothing — teams and
  agents were **both empty** before it, so the "discards live team state" objection had already lapsed (the
  hung `team-1786704512290-3` was lost at the 23:28 restart, not this one).
  **Step (2) — drive real traffic — is NOT done.** The sink `~/.agenttalk/agent-non-reply.jsonl` is still
  **absent**, and that zero is now a *clean baseline* rather than an unknown: the sink is always-on and wired
  (`server.ts:1329`, `NonReplySink` constructed unconditionally at `:83`), the detector can now observe an
  exec turn, and **there has simply been no traffic** — `/api/teams` and `/api/agents` both `[]`. *"Zero is
  not a measurement until you know why it is zero"* — this time we know why.
  **T3c's own blocker is now NAMED rather than asserted:** §9 q2 is filed as [[BL-135]], and per [[BL-134]]
  this item should carry `blocked_by: [BL-135]` — a self-releasing dependency in place of a bare
  `autonomy: human-only`. That edit is BL-134's D5, after gate 1; it is **not** made here.

  **§9 q2 — "should the sweep ever kill at all?" — remains open and is untouched by this work.** The sweep is
  still advisory; nothing gained a path to `setAgentStatus`, and BL-127's bar B4 pins that.

<!-- @item
id: BL-135
status: deferred
date: 2026-08-15
epic: null
tags: [bl-028, engine, detector, hang, po-decision, m03]
autonomy: po-decision
-->
- [deferred · **PO DECISION — split out of [[BL-028]] §9 q2 at the planner's direction 2026-08-15, so the
  question fencing that item is a NAMED, self-releasing dependency instead of a bare `autonomy: human-only`** ·
  **filed `todo`, corrected to `deferred` at [[BL-134]]'s gate 1 the same hour — see the closing note**] —
  **Should the idle sweep ever KILL, or is a detector that only reports a legitimate end state?**
  The question has been open and explicitly untouched since [[BL-028]] T3a (`f6c7655`, 2026-08-07) and was
  restated at T3b's close: *"A detector that only reports is a legitimate end state."* Today the sweep emits
  `agent_non_reply` and has **no path to `setAgentStatus` at all** — BL-127's bar B4 pins that, deliberately.
  **Why it cannot be answered yet, and why that is the point:** the honest sequence has always been (1) let the
  instrument run against real traffic, (2) *then* ask what the data supports. As of 2026-08-15 07:47 the
  instrument is finally **deployed and running** (pid 7121; [[BL-127]]/[[BL-128]] were in the build, [[BL-129]]
  and [[BL-133]] were merged-but-never-compiled until this rebuild), and the sink
  `~/.agenttalk/agent-non-reply.jsonl` is **absent — a clean zero baseline, with zero traffic to explain it**.
  **The competing considerations, so whoever answers has them in one place:** killing on silence risks
  destroying a working agent mid-turn — a real CLI routinely exceeds the 180s default on one honest turn
  (LB-67 Finding 1 demoted this exact signal to advisory once already), and `handleAgentFailure` requests
  shutdown of **every other team member**, so a false positive is team-wide. Not killing leaves the wall clock
  as the only anti-hang rail. [[BL-133]]'s advisory team-progress predicate now makes a wedge *observable*
  without a kill, which is LB-96's relaxation condition (1) — **satisfied, and deliberately not acted on**.
  **This item exists to be the blocker on the front of [[BL-028]], and to disappear the moment it is answered.**
  **⛔ WHY `deferred` AND NOT `todo` — corrected at [[BL-134]]'s gate 1, hours after filing.** It was filed
  `todo`, which under BL-134's proposed predicate (`todo` + blockers resolved, `autonomy` ignored) would have
  made **this question workable — i.e. proposable to an agent.** That exposed a real hole in BL-134's design
  and not merely a typo: `eligible`/`human-only` are *readiness* levels that collapse into "is it blocked",
  but **`po-decision` is not a readiness level at all** — it asserts the item is *not a task*. That is a
  difference of **kind**, which this schema expresses through `status`. **Resolution, zero new machinery:** a
  question is `deferred` + `tags: [po-decision]`. `isResolved` (`backlog.ts:255-259`) counts only
  `done`/`dropped` as resolved, so **a `deferred` blocker still fences its dependents** — [[BL-028]] stays
  fenced exactly as intended. And `deferred` is *honest* here rather than a workaround: the standing sequence
  is "let the instrument run, **then** ask what the data supports", so this question genuinely is parked
  pending evidence. **The planner filed this item and wrote the predicate that would have released it, in the
  same session** — the fix and the defect have the same author, which is what gate 1 exists for.


*(add new items above this line)*
