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


<!-- @item
id: BL-141
status: done
date: 2026-08-15
epic: null
tags: [docs, governance, linter, citations, overhaul, wave2]
-->
- [done 2026-08-15 · `npm run docs:check` · 806 citations gated, 78-entry debt register handed to [[BL-142]] · **filed during the Wave 0/1 overhaul, by the resolver written to verify those
  waves rather than by reading**] —
  **Docs are the primary artifact here and have no build. Give the citation graph a gate.**

  A one-off resolver written to prove Wave 0 moved 91 files without breaking a reference found
  **1,727 citations across the repo, 131 unresolved** — a number nobody could have known, because
  nothing has ever checked. The check is ~30 lines: walk every tracked `.md`/`.ts`/`.mjs`, extract
  `design/**.md` and `scripts/**.mjs` references, assert each resolves.

  **Scope note learned the hard way:** `__tests__` files must be EXCLUDED. Their "paths"
  (`design/x.md`, `design/operator/unauth-brief.md`) are fixtures fed to pure matchers, not
  citations — including them turns a real signal into noise, which is how the first count came out
  at 36 and the second at 131 for the same repo.

  This is the mechanical half of the overhaul's Rule 2 (a doc dependency graph, linted). The
  ambitious half — a module may cite only its own module, its declared code dependencies, and
  `governance/` — needs [[BL-144]]'s module layout to exist first. **This half does not, and is
  worth having on its own.** Wire it into `npm run backlog:check` or its own `docs:check`.

  Findings it already produced: [[BL-142]].


<!-- @item
id: BL-142
status: todo
date: 2026-08-15
epic: null
tags: [docs, governance, rot, operator, agent-md, fence-in-prose]
-->
- [todo · **filed 2026-08-15 · found by [[BL-141]]'s resolver · PRE-EXISTING, verified present at
  `289fa07` before the overhaul touched anything**] —
  **69 citations from live documents do not resolve — but read the retraction first.**

  **⛔ CORRECTION 2026-08-15, hours after filing, by the author: THIS ITEM'S HEADLINE CLAIM WAS
  FALSE, and it was the most alarming line in it.** It read: *"`design/launch-and-monitor-runbook.md`
  and `design/operator-seat/SKILL.md` both cite `scripts/launcher.mjs`, which is not in the repo —
  the operator seat's LIVE launch contract points at nothing."*

  **The launcher exists.** It lives in the client repo, and the runbook cites it *correctly*, by
  fully-qualified absolute path: `node /abs/path/to/agentalk-mcp-client/scripts/launcher.mjs`. The
  finding was manufactured by a **substring-matching bug in [[BL-141]]'s own checker**, which matched
  the trailing segment of a path rooted in another repository and then reported it missing from this
  one. Same for `explore-launch-worker.mjs`. Both are present in the client repo; both were verified
  by listing it.

  This is precisely the trap `infra-invariant.mjs` documents against itself — *"it would accept
  `apps/vendor/design/backlog.md`"* — committed by someone who had read that comment the same day.
  The checker now requires a path boundary, a bar pins the cross-repo case, and the register fell
  **78 → 69** on the fix alone.

  **The lesson is the item, not the count: a checker with a false-positive rate is worse than no
  checker.** It spends the reader's trust, and the real findings get discarded with the noise. Nine
  of the first sixteen "findings" were noise.

  **What survives the correction, verified per-path against git history and both repos:**

  - `scripts/test-attach-mode.mjs` (5 citers) — **existed here and was deleted** (3 commits in this
    repo's history). Cited by `AGENT.md` as Milestone 05's verification evidence.
  - `scripts/attach-harness.mjs` (5), `scripts/mcp-bridge.mjs` (3), `scripts/smoke-llm-agent.mjs` (2),
    `scripts/backlog-parse.mjs` (1) — **never committed at that path, in either repo.** `AGENT.md`
    cites the first as how attach mode was "**Verified**". A claim about evidence, pointing at a file
    that has never existed, is a different and more serious thing than a stale link.
  - `scripts/llm-agent.mjs` (1) — real, and explicable: it **moved to the client repo's root** (31
    commits here historically). The path is simply out of date.
  - `scripts/launcher.mjs` (7 remaining) — **not dangling, ambiguous.** These are bare mentions
    meaning the *client's* launcher without saying so. Arguably a doc defect (name the repo), not a
    broken pointer.
  - `design/backlog.md` (42) — mostly legitimate historical mentions created by Wave 1 itself
    ("was `design/backlog.md` before"). Cheap to sweep, low value.
  - `design/arbiter-shadow-corpus/README.md`, `design/bl091-investigation.md`, `scripts/lib/protocol.mjs`
    (1 each) — genuinely unresolved, uninvestigated.

  **Two are NOT defects and must not be "fixed":** `design/session-primers/claude.md` and
  `CLAUDE.md`, cited by `logbook.md` — LB-12 names them precisely as files that must NEVER exist
  (case-insensitive auto-slurp). They are on the checker's `NEVER_EXISTS` list.

  **Disposition is per-citation and needs a human:** a dead script may mean "renamed" (fix the
  pointer), "deleted" (delete the claim), or "never existed" (the claim was always false). Only the
  last is interesting, and only reading tells them apart.


<!-- @item
id: BL-144
status: todo
date: 2026-08-15
epic: null
tags: [overhaul, wave2, modules, colocation, architecture, docs]
-->
- [todo · **filed 2026-08-15 · Wave 2 of the overhaul · waves 0 and 1 are MERGED (`0b8bee5`,
  `b12c0ee`); this is the remainder and it is the judgment-heavy part**] —
  **Colocate: move code into `modules/`, carrying its durable docs and backlog slice with it.**

  Waves 0 and 1 were mechanical and are done: episodic records evicted to `design/archive/` (91
  files, ~22k lines), the backlog split into `design/backlog/` by concern. **Wave 2 is not
  mechanical** and should not be attempted as one commit.

  The unit: a module owns its code, the durable docs describing it, and its backlog file, together.
  Proposed order, cheapest-first — **start with `backlog/`**, which imports `fs` and `path` and
  nothing else, so it proves the pattern at near-zero cost; then `containment/`, the largest mass
  (~11k lines) and almost pure docs.

  `AGENT.md` splits LAST: ~150 lines of genuinely cross-cutting law stay in `governance/`, the rest
  distributes to the module whose code it constrains. That is the direct fix for its 24 correction
  markers — they exist because it asserts things about files it does not sit beside, so nothing
  forces a reader touching the code to touch the claim.

  **Deliberately NOT in scope: new repositories.** Modules give every seam without eight `AGENT.md`
  files to keep true, and [[BL-086]] already showed what one cross-repo split costs in duplicated
  governance. Extract a repo only when something outside actually consumes a module.

  Analysis and measurements behind this: the overhaul artifact published 2026-08-15.


*(add new items above this line)*
