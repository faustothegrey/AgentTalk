# AgentTalk — Open Research Questions (investigate *before* we build)

> **Status: research seed (rough, iterative).** Open questions about **external work** to investigate *before*
> adopting or hand-building — find prior art that saves us effort, or evidence our intended approach is wrong.
> **All named leads are partly recalled from training — treat every name as "verify," not "fact."**
> Provenance tags (`from: LB-N / BL-N`) point at where the thread was buried in our own logbook/backlog.

## What this project is

**AgentTalk** orchestrates several *heterogeneous, real* LLM CLI agents (Claude Code, Codex CLI, Gemini) as one
**software-development team** that plans, builds, reviews, and merges code through a **deterministic, auditable
coordination substrate** (an MCP message bus with recorded events), under a human **Product Owner** who holds scope
and merge authority. Its distinctive aim is **self-hosting**: the team is pointed at *its own* codebase and improves
itself, so the north-star metric is that the **human's manual coordination burden falls, measurably, cycle over
cycle** — not merely that tests pass.

## How to read this

Each entry is a **question**: *what's out there for X, adopt or build our own?* Fields — **Our problem**, **What to
find out**, **Leads (verify)**, **Decision it informs**, **From**.

### Tentative research priority (leverage × uncertainty)

| # | Question | Leverage | Uncertainty | Tier |
|---|----------|:--------:|:-----------:|:----:|
| 0 | Competitive prior-art survey of multi-agent coding orchestrators | High | High | **A — do first** |
| 1 | Affordance protocol: per-turn *constrained* tool exposure to force compliance | High | High | **A** |
| 2 | Structural schema-fingerprint versioning (vs binary contract hash) | High | Low-Med | **A** |
| 3 | Mechanized verification of agent claims ("evidence determinism") | High | Medium | **A** |
| 4 | Self-generating / deterministic test-&-coordination harness | High | High | **A** |
| 5 | Determinism & replay under stochastic agents | High | Medium | **B** |
| 6 | Enforcing scope/capability on autonomous coding agents (sandbox/fs/git) | High | Medium | **B** |
| 7 | Typed liveness / failure taxonomy for agent messaging | Medium | Low-Med | **B** |
| 8 | Governed, *measured*, *bootstrap-safe* self-improvement loops | Medium | High | **B** |
| 9 | Difficulty-adjusted, honesty-weighted agent routing | Medium | Medium | **B** |
| 10 | Cross-agent consensus beyond our message-kind FSM (+ transcript sharing) | Low-Med | Low | **C** |
| 11 | Reversibility / safe-abort of partial agent side-effects | Low-Med | Medium | **C** |

---

## 0. Competitive prior-art survey of multi-agent coding orchestrators  *(Tier A — do first; informs all others)*
**Our problem.** We keep re-deriving things others may have solved (we already found **Traycer** convergent with us).
**What to find out.** For each system: does it have consensus/turn-taking or just delegation? role-typed authority?
contract versioning? scope enforcement? what have they solved that we haven't — and vice versa?
**Leads (verify).** Traycer; MetaGPT; ChatDev; AutoGen; CrewAI; LangGraph; OpenHands (ex-OpenDevin); SWE-agent; Devin;
OpenAI Swarm / Agents SDK; Anthropic Claude subagents / Agent SDK; AutoGPT. Read *contracts/schemas*, not READMEs.
**Decision it informs.** What to steal vs. where we're genuinely ahead (LB-67 F5: our consensus is harder than their
delegation — don't drift to a competitor's shape just because it ships).  **From: LB-67, LB-68 F4.**

## 1. Affordance protocol — per-turn *constrained* tool exposure  *(Tier A — biggest buried thread)*
**Our problem.** Weak/cheap models hallucinate protocol phase transitions and crash consensus (only frontier models
comply). Today the brain *describes* the protocol in prose and validates *after the fact*.
**What to find out.** Can we expose **only the tool(s) legal for the current phase**, so an illegal move is
ungenerateable ("grey out invalid buttons")? Concretely: (a) what does each provider's function-calling *guarantee* —
per-call tool restriction, `tool_choice`, strict `enum`, constrained/grammar decoding? (b) does **MCP** expose *any*
per-turn tool-constraint hook, or is it irreducibly freeform-text? (c) a **transport capability-probe** (one real
request → classify by HTTP response → cache) to know what an endpoint actually supports vs. asking the model (which
hallucinates "yes").
**Leads (verify).** Constrained decoding / grammar-constrained generation (GBNF, Outlines, jsonformer, XGrammar);
OpenAI strict function calling / structured outputs; per-call `tools`+`tool_choice:required`; MCP `tools/list_changed`.
**Decision it informs.** The API-vs-MCP substrate fork: is the **API path** the better substrate for *robust* consensus
(fully constrainable), with MCP reserved for *single-agent execution*?  **From: LB-10, LB-20, LB-25, LB-46, LB-6/7/8.**

## 2. Structural schema-fingerprint versioning (vs binary hash)  *(Tier A)*
**Our problem.** We gate attach on **binary contract-hash equality**; a real CLI can't know our hash, so it's rejected
(this was the whole SP2/M19 wall). *"A hash tells you **that** something changed; it can't tell you **whether it
matters**."*
**What to find out.** Negotiate compatibility by **structurally diffing schemas** (additive-minor vs breaking-major),
not hash equality — so an additively-newer client still connects.
**Leads (verify).** Traycer's `versioned-stream-rpc` + `json-schema-fingerprint` (LB-67 F4 — read it); consumer-driven
contract testing (Pact); JSON-Schema structural diff; protobuf/Avro/semver compatibility rules; schema registries.
**Decision it informs.** Whether BL-018 ("versioned wire-contract negotiation") should adopt a fingerprint oracle
instead of a bespoke scheme.  **From: LB-67 F4, LB-66, BL-018.**

## 3. Mechanized verification of agent claims — "evidence determinism"  *(Tier A)*
**Our problem.** Our core value "Honesty over Results" is enforced by **exhortation**. Classifying our own 16 case-law
failures, the dominant class is **evidence dishonesty (laundering)**, not trespass — and nothing mechanical catches it.
**What to find out.** Where can the **system measure** a fact instead of **asking the agent to claim** it? E.g. the
system awards the green (agent never claims one); the system emits closure telemetry (git diff, wall-clock); and the
sharpest one — **"a proof must fail without the change"** (revert the diff, re-run; if it still passes, the proof is
void). What external techniques systematize this?
**Leads (verify).** Mutation testing (does the suite catch injected faults?); metamorphic testing; vacuous/assertion-free
test detection; specification-gaming & reward-hacking literature; LLM-as-judge reliability/bias; Goodhart's law.
**Decision it informs.** Build a "revert-and-recheck / measure-don't-ask" gate into the reviewer flow vs. keep it manual
discipline (our IP-15).  **From: LB-69 F3, LB-68.**

## 4. Self-generating / deterministic test-&-coordination harness  *(Tier A)*
**Our problem.** Our harness (per-milestone scripts, protocol machine, recorder) is **hand-built** and bespoke.
**What to find out.** Can a model **generate** the harness/environment — and can such a harness be **deterministic and
replayable** (which our auditability claim needs)? *Note the likely tension:* environment-generation research optimizes
for **diversity/capability**, not reproducibility — so the make-or-break isn't "can a model generate a harness?" but
"can a generated harness be deterministic?" (**Your "ornith" hint could not be verified** — search it, but it resembles
this cluster.)
**Leads (verify).** Voyager (self-written skills + self-verify); SWE-agent (agent–computer interface); Eureka
(LLM-authored reward/eval); UED — POET / PAIRED; "self-generated evals / auto-benchmark."
**Decision it informs.** Keep hand-building harnesses vs. adopt a generator — and whether generation can coexist with
determinism (if not, it's a non-starter *for us* — itself a useful finding).  **From: PO ("ornith" hint), entry #5.**

## 5. Determinism & replay under stochastic agents  *(Tier B)*
**Our problem.** We claim "deterministic and auditable," but the *agents* are stochastic and even our diagram-replay
capture was lossy/racy (LB-24). Determinism today is only at the protocol/recording layer.
**What to find out.** Make a multi-actor, partly-stochastic process **replayable/auditable**: record-replay of
nondeterministic inputs, deterministic simulation testing, event sourcing, seed/temperature limits.
**Leads (verify).** Deterministic simulation testing (FoundationDB, TigerBeetle, **Antithesis**); record-replay (rr);
event sourcing / CQRS; LLM temp-0 non-determinism caveats.
**Decision it informs.** Whether "deterministic harness" (our whole framing) is *achievable*, or we downgrade the claim
to "auditable, not reproducible."  **From: LB-24.**

## 6. Enforcing scope/capability on autonomous coding agents  *(Tier B)*
**Our problem.** The MCP layer where role authority lives is **structurally incapable** of enforcing "don't touch
`team-coordinator.ts`" — the implementer edits files with its own harness tools, invisible to AgentTalk. Scope is
enforced by the agent's **character**, not the system. And: *you can't deterministically constrain a process you didn't
launch* (M05 attaches; it doesn't launch).
**What to find out.** External mechanisms to confine an agent's **writes** to allowed paths: the chokepoint options are
harness hooks (not portable), **filesystem** (`chmod -w` on out-of-scope paths → denial *is* the interrogation
trigger), or **git-diff-at-delivery** (detection). Which do others use, and does it force the **attach → supervisor**
architectural shift (own process+filesystem, like Traycer's closed host)?
**Leads (verify).** Agent sandboxing/confinement; seccomp / containers / overlay FS; capability-based security /
object-capabilities; git worktree isolation; PreToolUse hooks. (Ties to our BL-015 scope-fences note — this is the
*external* research before we commit its L2.)
**Decision it informs.** Stay a pure wire vs. become a launching supervisor; which chokepoint to standardize on.
**From: LB-68, LB-69 F1/F4, BL-015.**

## 7. Typed liveness / failure taxonomy for agent messaging  *(Tier B)*
**Our problem.** Our failure model is **binary**: agent enters `error` (incl. a dead idle-timeout, LB-70) → kill the
team task. We can't tell "blocked awaiting a human" from "dead" — so we'd kill a run for an agent that behaved
correctly. We also have **no request/reply thread correlation**.
**What to find out.** A **typed non-reply reason** model (Traycer uses 7: `turn-ended / exited / quiet / user-stopped /
errored / awaiting-input / receiver-cancelled`), monitor-presence liveness over PTY-scraping heuristics, and
broker-minted `responseId` reply correlation.
**Leads (verify).** Traycer `inbox.ts` (LB-67 F1/F2 — read it); Erlang/OTP supervision & heartbeats; actor-model
liveness; async RPC correlation-id patterns; WebSocket/gRPC keepalive.
**Decision it informs.** Replace binary `error`-propagation with a typed-reason model (a spike that touches M03's
contract).  **From: LB-67 F1/F2, LB-70, BL-028.**

## 8. Governed, *measured*, *bootstrap-safe* self-improvement loops  *(Tier B)*
**Our problem.** The self-hosting flywheel is our central bet; we're inventing the governance + success metric
(relay-count fall) ourselves. And a deep hazard: **if AgentTalk enforces the workflow that catches AgentTalk's bugs, a
defect in the enforcer corrupts the machinery that would surface it** (LB-66 was the preview).
**What to find out.** Prior art on (a) bounded/governed recursive self-improvement, (b) **honestly measuring** whether a
self-improving dev loop reduces human effort, and (c) keeping a trusted "reference clock" outside the self-improving
system (our standing invariant: *the PO channel must never be mediated by AgentTalk*).
**Leads (verify).** Self-Taught Optimizer (STOP); Gödel Agent; Reflexion / self-refine; SPACE / DORA productivity
metrics as honest baselines; trusted computing base / bootstrapping-trust literature.
**Decision it informs.** Whether our relay-ratio (BL-027) has a better-validated cousin; what guardrails on the loop are
table-stakes.  **From: LB-68 F3, self-hosting-program-draft risk #3, BL-027.**

## 9. Difficulty-adjusted, honesty-weighted agent routing  *(Tier B)*
**Our problem.** We filed BL-029 (per-agent track-record signal to trigger reassignment) but haven't researched it.
**What to find out.** State of the art in choosing *which* model/agent per task, and normalizing performance by task
**difficulty** so we don't punish whoever draws the hard cards.
**Leads (verify).** RouteLLM; FrugalGPT / LLM cascades; contextual bandits for model selection; item-response theory /
difficulty estimation; agent-eval leaderboards (and their gaming).
**Decision it informs.** Build our own dossier vs. adopt an existing router.  **From: BL-029.**

## 10. Cross-agent consensus beyond our message-kind FSM  *(Tier C)*
**Our problem.** Our planning FSM (fact_collection → discussion → proposal → endorsement → submittal) works but is
bespoke; and peers are **blind to each other** except through explicit messages.
**What to find out.** Whether established negotiation/deliberation protocols subsume ours — and whether letting agents
**read each other's transcripts** (Traycer's `getTranscript`) is a *correctness* affordance for consensus, not just
debugging.
**Leads (verify).** Contract Net Protocol (Smith 1980); FIPA ACL; multi-agent debate / "society of minds" (Du et al.);
Traycer `agent.getTranscript`.
**Decision it informs.** Keep our FSM vs. re-base on a standard; add transcript-sharing.  **From: LB-67 F5 + "steal".**

## 11. Reversibility / safe-abort of partial agent side-effects  *(Tier C)*
**Our problem.** Aborting an `awaiting_operator` task is unsolved because the worker's effects may be **partial**
(half-written file, partial commit, external side-effect already out) — *"there is no generic undo for a half-finished
agent."*
**What to find out.** How to make agent actions reversible or safely abortable: transactional/checkpointed edits,
snapshot-and-rollback, dry-run-then-commit.
**Leads (verify).** Copy-on-write / snapshot filesystems; git stash/worktree checkpointing; transactional/sagas +
compensating actions; VM/container snapshotting for agents.
**Decision it informs.** The deferred BL-007 operator-recovery design.  **From: BL-007.**

---

*Next pass: add a "closest confirmed prior art + verdict (adopt / adapt / skip / genuinely-novel)" line per entry once
background research returns; prune overlaps (0 will re-shape 1/2/6/7/10).*
