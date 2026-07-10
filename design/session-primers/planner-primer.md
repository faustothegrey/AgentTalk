---
role: planner
key: 20260710-1152-d50242
written: 2026-07-10 by Claude (architect + SM), after the M19 backlog gate sat by the PO + architect together
---

This is your session primer.

**Your first unit of work is a SPIKE, not the epic.** If you have seen an earlier primer sending you at "M19-T0,"
it was wrong — the architect wrote it before convening the backlog gate, and the gate corrected it. See §4.

## 1. What AgentTalk is

A multi-agent orchestration substrate: an MCP server over which independently-launched coding agents
(claude · codex · gemini) attach, take turns, exchange messages, reach consensus on a plan, and hand work between
roles. The **self-hosting program** is the project's central bet: *AgentTalk should carry the very coordination
that builds AgentTalk, and the loop should get measurably cheaper.* That claim is **not yet earned** — §4.

## 2. Roles

Planner (**you**) · three reviewer seats (**plan** reviewer = gate 1, approves your plan; **implementation**
reviewer = gate 2; **task-end** reviewer = gate 3, independent closure sweep + the merge) · implementer ·
architect · Scrum Master · **Product Owner = Fausto, the human** — apex authority, owner of
scope/direction/epics/merges. Independence defaults: no self-review; task-end reviewer ≠ implementation reviewer.

**No agent names here.** Bindings live in exactly one place: `AGENT.md` → **📌 DEFAULT ROLE ASSIGNMENTS**. Read it.
(2026-07-10: the PO confirmed the defaults stand.) You author plans; you do **not** implement and do **not** approve
them. Check the table for any second hat you hold, and declare every one.

## 3. Workflow and sources of truth

`design/collaboration-workflow.md` is the method. Read **§3e** before you name anything (see §4 for why).
- `design/backlog.md` — the ordered task list (28 items; `npm run backlog:check`). Exactly one item is `doing`.
- `design/logbook.md` — cross-cutting technical facts (`LB-N`). **LB-70 and LB-71 are today's; read both.**
- `design/implementer-pitfalls.md` — reviewer-authored case law (`IP-1 … IP-16`).
- `design/self-hosting-program-draft.md` — the program this serves.
- `design/arbiter-shadow-spike-plan.md` / `-implementation.md` — **precedent: what a spike's doc pair looks like.**
- `AGENT.md` — the law: ⛔ Implementer and ⛔ Reviewer Rules of Engagement, primer handshake, origin tags.

State lives in the ledger, never in chat.

## 4. Where we are: **plan SP2.** M19 comes after, and is planned against SP2's answer.

**M18 closed 2026-07-09 with its central claim unproven.** It proved the *capability* — a real CLI attaches and
carries `baton` + `workflowEvent` (C6 VERIFIED; merges `e1a4346` / client `9af84c7`; independent A/B at gate 3) —
and produced **zero uses of it**. C3 **DEFERRED ⛔** (PO-signed): 19 relays, **0 substrate events**, all epic.
Nothing is missing from the code. The gap is adoption: the terminal was easier.

**C3's reopen condition, PO-signed and now due — this is what M19 must discharge:**

> *the next epic must carry **at least one real role→role gate or baton over the substrate** (a recorded
> `workflow_gate_event` from an attached real CLI session doing actual coordination, **not a proof**), and report
> the **ratio** — substrate-carried hand-offs ÷ total hand-offs — beside the raw relay count (**BL-027**, now `doing`).*

**M19's goal (PO + architect, 2026-07-10):** *AgentTalk improving itself.* In the PO's words: **"find one file you
agents agree to refactor, and refactor it. Nothing more."** The refactor target is **constrained to the AgentTalk
repo** (PO, 2026-07-10 — see BL-022 in §6).

**But M19 is not yours to plan yet.** The 2026-07-10 backlog gate (PO + architect, LB-71) ruled:

- **A spike is `SP<N>` — numbered globally, independent of any epic, read-only/probe/docs, zero production code**
  (`collaboration-workflow.md:287-290`). It gets its own doc pair. It is **not** a task inside an epic.
- **This spike runs *before* M19 is planned.** Its answer determines M19-T1's shape: if the consensus protocol
  survives across real attached CLIs, T1 reaches agreement through consensus; if not, T1 reaches agreement through
  plain batons. Planning the epic first would force a **conditional plan** hedging on the exact unknown the spike
  exists to remove. Workflow:523 permits isolated zero-risk spikes to start early.

**Your task: author `design/spike2-consensus-real-cli-plan.md`.**

> **SP2 — Consensus over real attached CLI sessions.** *Does the existing consensus protocol
> (`fact_collection → discussion → proposal`) survive across two real attached CLIs?* It has **only ever** been
> demonstrated on SDK / in-process substrates (LB-66 Finding 2) — our most defensible capability is our least
> proven one. **Zero production code.** The deliverable is an **answer**; a park recommendation is a valid
> successful outcome, exactly as it was for the arbiter spike.

Three obligations the gate placed on SP2 (§6 explains each — they are not optional):
1. **Record each attached agent's `provider` value** as a first-class observation.
2. **Do not use `scripts/m17-live-gate-proof.mjs`** as evidence.
3. **Emit the attach ritual as a runbook** (a docs deliverable — free, since you must perform it anyway).

## 5. Verify this primer before you trust it

It is a claim about state, written by the agent who will also take **gate 1 on your plan**. Read it adversarially.
Ground every load-bearing line: the M18 ledger's **EPIC CLOSURE** and C3 row, `git log`, `collaboration-workflow.md`
§3e, the backlog states. If a merged claim isn't in git, or C3's wording differs from §4, **say so prominently**
rather than repeating me. The last primer I wrote sent you at the wrong target; a primer that disagrees with ground
truth is itself the finding I most want.

## 6. Op notes — what will actually bite you

- **BL-024 is load-bearing for SP2, and it is subtle.** `team-coordinator.ts:977-986` bumps the **fact-collection
  timeout** on `if (team.provider === 'gemini')` — *a vendor name changes protocol timing inside the frozen engine*,
  and `fact_collection` is the first phase SP2 measures. It is **unknown** which `provider` value a real attached CLI
  carries: the union is `'api'|'mcp'|'gemini'|'claude'|'codex'` (`packages/contracts/src/types.ts:13`) and admits
  both a transport and a vendor. That ambiguity already caused the M17 G3-2 refute. **SP2 cannot interpret its own
  result without recording this.** Recording is a spike act; **fixing it is not** — out of scope for SP2 and M19.
- **`scripts/m17-live-gate-proof.mjs` can print `LIVE SMOKE PASSED` with no recorder attached** — it asserts against
  a *committed* NDJSON rather than the run's own recorder output (M17 finding **G2-1**, still open; it printed a
  spurious FAILED during the M18-T2 gate-3 run). **Do not build evidence on it.** See BL-025.
- **A recorded event is not proof an agent produced it.** M18-T3 shipped a green live proof that **passed identically
  on the unfixed code** and survived six gate-2 rounds (**IP-15**) — its log could not distinguish an agent that
  *chose* the envelope from a bridge that *stapled it on*. Whatever you plan, ask: **"what would this print if the
  thing I'm testing were absent?"** M19's DoD will have to answer that for `workflow_gate_event`.
- **The idle timeout is dead code — and that is *why* a slow real-CLI conversation is safe.** `agentIdleTimeoutMs:
  180000` is configured and swept every 30s, but `lastProgressAt` is declared, read, and **never written**, so
  `hasAgentTimedOut()` always returns false (`registry.ts:663`). See **LB-70** / **BL-028**. **Do not fix it** — it is
  filed, it is shared engine code (RoE Rule 2), and it must land together with the typed non-reply `reason`.
- **Attaching a real CLI is a hand-assembled ritual** (**BL-026**) — done ad hoc four times in M18, with a
  `creating`-state trap for anyone who forgets `POST /api/agents/:id/start`. You will do it a fifth time. Write it down.
- **`scope-check` is single-repo blind** (**BL-022**): it diffs only the AgentTalk tree, so a task touching
  `agentalk-mcp-client` is unfenced while reporting green. Hence the PO's constraint on M19-T1's target repo.
- **The orchestrator has no write path.** `grep` the engine for `write_file|edit_file|writeFile` → nothing. The
  implementer edits with its **own harness tools**; those edits never cross the wire. The substrate carries
  coordination, not edits. Don't plan around enforcing scope on writes.
- **`workflowEvent` is optional on `send_to_agent`** (required = `['to','payload']`). An agent cannot *lie* about its
  role — the registry refuses a mismatched `fromRole` and emits `workflow_gate_attempt {result:'refused'}` — but it
  can simply not say. The gate **notarizes claims; it does not govern acts** (LB-68).
- **Standing invariant: the PO's channel is never mediated by AgentTalk** (LB-68 F3). Self-hosting consumes
  **agent→agent** batons. The manual terminal baton is not an interim workaround — it is the **reference clock**.
- **Parked, not dropped, and out of both SP2 and M19:** typed non-reply `reason` · thread-correlated `send_to_agent` ·
  queue-and-replay on attach · truncation-recovery reads · structural-fingerprint contract negotiation ·
  role→capability enforcement (**BL-015, deferred — read the ⚠️ block on that item before ever planning it**) ·
  role-skill injection (**BL-014, deferred**) · the four evidence-determinism mechanisms.
- **`IP-9` is ambiguous in any citation written before 2026-07-10** — two entries shared the id; one is now `IP-16`.
  Resolve by context; do not chase the stale references (PO ruling).
- **Budget:** poll `node scripts/usage.mjs` at start — best-effort, **never blocking** (the `claude` block is often
  `ok:false`, LB-11). 2026-07-10 ~11:50 CEST: claude weekly 9%, codex weekly 1%, antigravity 38% (5h).

## 7. What to do now

Per the cold-start contract: **gather context, verify it against the repo, report your understanding, and STOP.**
No plan, no branch, no runs. Consuming this key in your private key store — outside the repo — is the only write
permitted in this window.

Then, once the SM greenlights (the PO may override at any time): author `design/spike2-consensus-real-cli-plan.md`
with spec + DoD rows, model the doc pair on the arbiter spike, and hand it to the **plan reviewer** for gate 1.
**Zero production code. The deliverable is an answer.** And hold the PO's line — *nothing more.*
