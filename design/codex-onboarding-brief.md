# Codex onboarding brief — activating Codex as PLANNER-REVIEWER (first run)

> ⚠️ **ARCHIVED (2026-06-27) — one-time artifact, superseded by the normal primer flow.** Codex is onboarded
> (private key store seeded 2026-06-26; role-keyed handshake live). This brief is kept for historical rationale
> only; it is **not** live guidance. Its git ref (`master @ b409b97`), test baseline, and milestone notes are
> stale by design — for current state read `git log` + the active `*-implementation.md` ledger, and for the
> canonical cold-start contract read `AGENT.md → FIRST ENTRY POINT`.

**What this is.** The chat brief to paste to **Codex** on its first run in the repo, to activate it in the
**planner-reviewer** role (co-eligible with Claude — see `AGENT.md → FIRST ENTRY POINT`, role-keyed primers,
[[LB-29]]). Because the role-primer (`design/session-primers/planner-reviewer-primer.md`) currently carries
`key: none`, Codex's First Entry Point short-circuits to *"nothing fresh → proceed normally, the user briefs
you"* — so **this brief stands in for a populated cold-start primer** on the first run.

**Why no normal primer is needed first.** We bootstrap Codex directly: (1) its private key store is seeded at
`~/.codex/agenttalk-session-primer-key.json = { "consumed": [] }` (done 2026-06-26); (2) this brief gives it the
six primer ingredients. The store isn't even strictly required for this first task (`key: none` short-circuits
before the `consumed` check) — it just makes the **next real handoff** seamless. After that, the **normal flow
resumes**: whoever closes a planner-reviewer turn overwrites the role-primer body + mints a fresh header key, and
the next cold instance (Claude or Codex) runs the normal two-branch handshake.

**How to use.** Run `codex` **inside the AgentTalk repo** (so it auto-reads `AGENTS.md → AGENT.md`). After it
reports the empty-primer cold-start, paste the block below. Replace `[TASK]` if you want a different first task.

---

```
Sei la nuova istanza nel ruolo PLANNER-REVIEWER di AgentTalk. Hai già letto AGENTS.md
(→ AGENT.md, canonico) al turno 1 e il primer di ruolo era key:none, quindi niente
cold-start formale: ti briffo io qui. Prima di agire, LEGGI e VERIFICA — non fidarti
di questo brief alla cieca (è una *claim* sullo stato; conferma contro il repo).

== Cosa è AgentTalk ==
Orchestratore che coordina più agenti AI (provider in-process via API + agenti
MCP-attached lanciati esternamente) che collaborano via MCP attraverso un protocollo
di consenso (planner dibattono → submit plan → un worker esegue). Monorepo:
packages/* + apps/{orchestrator,web}. La logica semantica sta nel "brain" server-side
(packages/runtime-core/src/registry/team-coordinator.ts).

== Ruoli ==
Fausto = umano (scope, decisioni, relay). Planner-reviewer = Claude **o** Codex (tu) —
co-eleggibili, uno alla volta; la regola report-STOP-l'umano-decide evita collisioni.
Implementer = Gemini (attualmente fuori budget settimanale). Merge/closure sono
HUMAN-GATED (Fausto).

== Workflow / fonti di verità (leggile, non dedurle) ==
- design/collaboration-workflow.md  → il metodo, source of truth.
- AGENT.md → ⛔ IMPLEMENTER/REVIEWER RULES OF ENGAGEMENT + Honesty-over-Results
  (RILEGGILE prima di toccare codice) + design/implementer-pitfalls.md.
- Artefatti: *-plan.md (spec+DoD) · *-implementation.md (ledger) · design/backlog.md ·
  design/logbook.md (LB-N).

== Dove siamo (verifica con `git log` + i ledger) ==
- master @ b409b97 (o più recente). Lavoro recente (2026-06-26): mcp-exec-server live
  smoke col CLI reale (LB-27) · `npm run smoke:exec` · chat 1:1 live verificata web UI
  ⇄ agentalk-mcp-client → claude (LB-28, runbook design/attach-chat-runbook.md) ·
  **primer ri-keyed per RUOLO** (LB-29) — è il modello sotto cui operi ora.
- Epic precedente M10 (graded protocol brain + DiagramTalk): T1/T2/T4 merged; T3
  (single-tool consensus_respond, cross-repo) deferred. Ledger: design/milestone10-implementation.md.

== Dove vive lo stato ==
Riparti dai ledger + design/logbook.md (LB-27/28/29) + design/backlog.md, NON dalla chat.

== Op notes ==
- Gate: `npm run build` (tsc -b) e `npm test` (vitest, baseline 245/245). LB-9:
  planning_runs/ è gitignored e alcuni test ci scrivono — non è inquinamento.
- Gemini fuori budget → l'implementer di fatto sei tu o Claude, ma merge resta HUMAN-GATED.
- Branch dal master; NON pushare senza il via di Fausto.
- DiagramTalk e agentalk-mcp-client sono repo SEPARATI: solo lettura per verificare
  contratti, mai editare, relay via Fausto.

== PRIMO TASK ==
[TASK] Default consigliato (esercizio da reviewer, autoconsistente e ad alto valore):
fai una REVIEW del cambiamento "primer role-keyed" — leggi AGENT.md (First Entry Point
+ Session Primer + Re-priming) e LB-29, e cercane buchi/contraddizioni/edge-case
(es. due eleggibili che partono insieme, restart, bootstrap di Codex, primer body
storico ancora con vecchio linguaggio). Output: report di review con findings, SENZA
modificare nulla — poi aspetta il mio go.

REGOLA D'INGAGGIO PER QUESTO PRIMO TURNO: orientati, verifica contro il repo, e
RIPORTA la tua comprensione + i findings. NON scrivere codice, NON committare. STOP e
aspetta il mio via esplicito.
```

---

**Alternatives to `[TASK]`:** *plan* a backlog item (e.g. "unify protocol state-change event emission" —
`onPhaseChange` vs `onProtocolEvent`; or the `McpCompleter`→`ExecTransport` dedup), or *review* the recent
mcp-exec-server / live-chat work. This is a one-time onboarding artifact; once Codex is running in the role, the
normal session-primer flow (`AGENT.md`) takes over.
