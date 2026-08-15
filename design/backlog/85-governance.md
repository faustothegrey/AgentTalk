# Backlog — governance

Open items owned by the **governance** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-016
status: deferred
date: 2026-07-08
epic: null
tags: [workflow, scrum-master, retrospective, growth]
-->
- [deferred · PO hint 2026-07-08, explicitly NOT operational — deferred by the PO to a more mature phase to
  avoid process bloat; reopen condition: PO calls it, OR an IP class recurs despite existing mechanisms] —
  **SM growth function — event-triggered micro-retrospectives** — extend SM duty 2 one step: *close the
  learning loop*. On a real event only (a REFUTE, a late-caught deviation, an IP mint) the SM runs a short
  evidence-anchored debrief **with** the erring agent — its reasoning at the time first, then a proposed
  *mechanism* (not a resolution) — dialogic, never a reprimand. Key reframe (architect): agents don't persist,
  so "growth" = improving the **artifacts the next instance reads** (elicited lessons in the agent's own
  words — agy's M16 close proved unguided reflection skips the behavioral lesson) and the **system around the
  agents** (root causes are often ours: e.g. the claim template has no mandatory "Deviations:" field — that's
  what let D1/D2 go unfiled). Guards: evidence-anchored to avoid contrition theater; each agent still writes
  only its own lessons file (SM elicits, never writes it for them); yardstick = **IP-class recurrence rate**.
  Third instrument of one theme: fences enforce (BL-015), briefs instruct (BL-014), **debriefs adapt**.
  Trial informally at the next real REFUTE before any doc change.

<!-- @item
id: BL-029
status: deferred
date: 2026-07-11
epic: null
tags: [process, governance, reassignment, rating, sm, honesty]
-->
- [deferred · PARKED 2026-07-27 — PO directive: not instrumental to "AgentTalk within AgentTalk". Reopen: more than one agent is in the loop again (the goal states a single agent is fine for now) · **earned by a real failure, not pre-written: filed after the SP2 attach breach, PO-approved 2026-07-11**]
  — **No signal tells the SM *when* to reassign an under-performing agent** — the reassignment *authority* is fully
  specified (SM owns it, LB-34; standing conditional reassignment, LB-38; PO overrides) but the **trigger** is a
  gut call. When the SM judged Gemini "over-matched" on SP2 and proposed swapping in Codex, that call rested on
  *vibes*, not a durable, auditable per-agent record. **Gap:** a **per-agent capability / track-record signal** the
  SM reads to decide reassignment (and inception assignment). **The raw signal already exists, un-aggregated** —
  `implementer-pitfalls.md` (reviewer-authored failure case law), per-task closure telemetry + verdict rows
  (`*-implementation.md`: VERIFIED-first-pass vs. REFUTED-and-redelivered), and per-agent `lessons/*.md`. This item
  is to **aggregate them into a reviewer-fed, never-self-fed per-agent dossier.** **Four hazards the design must
  answer (else it does harm):** (1) **attribution is known-broken** — same reason we run agents serially
  (per-provider meter, not per-actor); a miss may be the plan's / environment's / an impossible task's fault, not
  the agent's; (2) **difficulty confound** — SP2 is the trap: Gemini's "miss" may be a task that is *impossible
  in-scope* (the fence forbids the `bridge.mjs` edit the attach needs), so it must **normalize by task
  difficulty/feasibility**; (3) **honesty-gaming — the load-bearing one** — rating on "green" incentivises exactly
  the scope-creep-green the *Honesty over Results* section forbids, so it must **reward an honest RED and penalise a
  scope-creep GREEN**, i.e. rate *scope discipline + honesty*, not pass/fail; (4) **sample size** — N=1 is noise; a
  *pattern* of breaches counts, a single one should not tank a rating. **Not an ELO number** — a lightweight dossier
  in the project's own idiom. **Evidence:** SP2 breach + revert (`design/archive/spike2-consensus-real-cli-implementation.md`
  2026-07-11 finding); grep confirms no prior rating mechanism exists (all repo "capability" hits are *transport*
  capability, not competence). **Stub:** `design/agent-rating-signal-note.md`. **Deferred:** revisit when M19 yields
  more data points — nothing to implement yet.

<!-- @item
id: BL-015
status: deferred
date: 2026-07-08
epic: null
tags: [self-hosting, scope-fence, governance, harness]
-->
- [deferred · **DEFERRED at the 2026-07-10 backlog gate (PO + architect, sitting together)**. **PO ruling
  (2026-07-10): governance moves to a *ranking* model, not a fencing one** — "external agent unfaithfulness is
  uncontrollable by definition; we'll have a ranking system. If the agent is not fit for the role, just flip
  do-not-use." L1/L2 are therefore not the road. **Reopen condition:** *when the ranking system needs a
  detection signal a fence would supply, or on explicit PO revisit.*
  **⚠️ TWO FACTS ANY FUTURE PLANNER MUST READ FIRST (LB-69, 2026-07-10) — this item is not safe to plan as
  written:** (1) **an ownership hole**: this item's non-goals defer authority/identity enforcement to M17
  (`scope-fences-design-note.md:72`), but M17 only refuses a *falsely-labelled* `workflowEvent` — and
  `workflowEvent` is **optional** on `send_to_agent` (`mcp-tools.ts:74`, required = `['to','payload']`). M17
  governs the truthfulness of a **claim**; it never binds a **role** to a **capability**. **Neither document
  owns role→capability enforcement, and each believes the other does.** (2) **L2 contradicts M05**: L2 assumes
  "launch machinery provisions the task branch + a fenced worktree," but M05's founding premise is that provider
  MCPs are **externally launched by the operator**. *You cannot deterministically constrain a process you did not
  launch.* L2 therefore requires attach mode to grow a **launched** variant — i.e. AgentTalk becomes a supervisor
  owning process + filesystem, not merely a wire. That is precisely the road Traycer took, and their host is the
  **closed** half of their repo (LB-67). **This is an unnamed architectural decision, and it is the PO's.**
  **Also (LB-69 Finding 2, empirical):** classifying all 16 `IP-N` cases against a deterministic file fence gives
  **3 prevented** (IP-5, IP-6, IP-12) and **≥7 untouched** (IP-1, IP-2, IP-3, IP-4/IP-8, IP-13, IP-15). The
  untouched column is not "did a forbidden thing" — it is "**said a false thing**." Our dominant failure class is
  **evidence dishonesty**, which no fence at any tier touches. This item's own principle 4 ("necessary, not
  sufficient") is thereby quantified. · was: todo · **L0 absorbed into M18-T1 at the 2026-07-09 gate (BL-021)** — the guinea-pig shakedown epic; item
  stays open for L1/L2, which share the M19 gate with BL-014 · PO+Architect, 2026-07-08 (mid-M16) —
  evidence-driven from a live violation] — **Deterministic scope fences — machine-readable per-task
  scope manifest + layered enforcement** — move the implementer scope fence from *policy* (prose RoE +
  self-discipline) to *mechanism* (the environment refuses or loudly flags out-of-scope acts). Design note:
  `design/scope-fences-design-note.md`. **Evidence:**
  during M16-T2a an implementer found a real bug, spec'd the fix, then made changes beyond task scope
  (acknowledged after); same failure class as IP-2 / IP-9 / IP-12 / IP-13 — different agents, same broken
  behavioral rule. **Policy source already exists:** each ledger task's "Allowed/Forbidden surfaces" prose —
  formalize it as a per-task scope manifest (allowed/forbidden globs). **Layered shape (build in order):**
  **L0** manifest + `scope-check` script diffing the tree against it (detective; run at implementer Rule-5
  self-check, gates, CI — ≈a day, candidate M18 rider); **L1** provider-level preventive guards (e.g. Claude
  Code PreToolUse hook blocking out-of-manifest writes; per-provider, weakest portability); **L2**
  substrate-administered: the baton carries the manifest, the launch machinery provisions a fenced worktree
  (kills IP-12 as a side effect), violations become recorded runtime events the flywheel counts —
  **two halves of one thing with BL-014 role-skill injection: the seat's law, served AND enforced at attach —
  gate them together (M19).** **Design principles (binding):** stopping must be cheaper than proceeding (the
  fence message IS the deviation-report template); fences amended only at gates (the T2a flow, made physical);
  fence product code, keep tests/scratch free; file fences are necessary-not-sufficient (semantic pokes like
  the M15 `as any` and IP-13 mock-arounds remain reviewer work). Also consider a time/tool-call circuit
  breaker as backstop (proxy signal — rank below file fences).

<!-- @item
id: BL-014
status: deferred
date: 2026-07-08
epic: null
tags: [self-hosting, role-skill, governance]
-->
- [deferred · **DEFERRED at the 2026-07-10 backlog gate (PO + architect, sitting together)** — the re-gate its
  own note called for has now happened: M17 closed and delivered the session→identity→role mapping, so this
  item became rulable, and the ruling is *not yet*. **Reason:** serving role briefs over the substrate is
  premature while the substrate has carried **zero** real role→role hand-offs (M18 closed with 0 substrate
  events; C3 DEFERRED). Build the channel's first real use before administering governance over it.
  **Reopen condition:** *after M19 demonstrates that the substrate carries actual coordination (C3's reopen
  condition met — ≥1 recorded `workflow_gate_event` from a real attached CLI doing real work, plus the
  BL-027 ratio).* · was: todo · M19 candidate — ruled at the 2026-07-08 gate (options were M18 rider / M19
  candidate / parked); re-gate after M17 delivers the session→identity→role mapping] — **Role-skill injection — brain-served
  role briefs at attach** — condense the scrum workflow (roles, gates, batons, origin tags, Rules of
  Engagement, primer handshake) into a brief the substrate serves at attach time: "you are `<role>`; here
  is your law" — versioned from the repo, identical for every provider, recorded like any message. Rides
  M17's session→identity→role mapping; would collapse primer-handshake drift (the brain knows what's fresh)
  and administer the 2026-07-08 role-only governance model (`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`) over
  the channel instead of per-CLI context files. Source: PO idea 2026-07-02 + architect read,
  `design/self-hosting-program-draft.md` §Candidate.


*(add new items above this line)*
