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
  capability, not competence). **Stub:** `modules/governance/docs/agent-rating-signal-note.md`. **Deferred:** revisit when M19 yields
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
  `modules/governance/docs/scope-fences-design-note.md`. **Evidence:**
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
  `modules/governance/docs/self-hosting-program-draft.md` §Candidate.


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
status: done
date: 2026-08-15
epic: null
tags: [docs, governance, rot, operator, agent-md, fence-in-prose]
-->
- [done 2026-08-15 · register 78 → 43 · the operator's broken fallback FIXED · **filed 2026-08-15 · found by [[BL-141]]'s resolver · PRE-EXISTING, verified present at
  `289fa07` before the overhaul touched anything**] —
  **69 citations from live documents do not resolve — but read the retraction first.**

  **⛔ CORRECTION 2026-08-15, hours after filing, by the author: THIS ITEM'S HEADLINE CLAIM WAS
  FALSE, and it was the most alarming line in it.** It read: *"`modules/containment/docs/launch-and-monitor-runbook.md`
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

  **Disposition is per-citation and needed a human — done 2026-08-15. What it actually found:**

  **1. A live operational defect, created by Wave 1 and missed by it.** `operator-seat/SKILL.md` told the
  seat to fall back to a single backlog *file* when port 3741 does not answer, and gave a literal
  `grep … design/backlog.md | grep status:` command. Wave 1 replaced that file with a directory. Verified
  both directions rather than assumed: the old command emits `No such file or directory` on **stderr** and
  returns **empty stdout** — so an operator reading the pipeline's output sees an empty result set, and
  reporting "no backlog items" is one careless step away. Fixed at three sites (`grep -r` over the
  directory), plus the skill's own write-allowlist line and its description.

  **2. `AGENT.md`'s Milestone 05 evidence claim: pointers rotted, evidence intact.** It cited two harnesses
  as paths in THIS repo. Neither ever lived there: the attach harness was at the CLIENT repo's root (2
  commits, deleted), the smoke was under this repo's `scripts/` (3 commits, deleted). **The claim itself is
  NOT impeached** — that was this correction's own first draft and it was wrong, for the second time in one
  item. Both artifacts existed and were deleted in the ordinary course. Corrected in place, naming the files
  without a dead path.

  **3. Live primers and `worktree-discipline.md`** pointed at the pre-Wave-1 backlog path; fixed.

  **Then a finding about Wave 0 itself: it UNDER-ARCHIVED, and the classifier was the reason.** Filename
  patterns missed two whole classes — topic-named episodic docs (the `mcp-*` planning set, the four-document
  `agy`/`claude` protocol debate) and `*-spike.md` suffix forms, since the pattern only matched `^spike`.
  Eighteen more docs archived, citation parity proven (`fresh = 0`). `design/` top-level: **143 → 34** across
  the session.

  **⚠️ The load-bearing lesson, and it is an input to [[BL-144]]: neither filename NOR date classifies
  lifecycle.** `modules/orchestrator-host/docs/architecture.md` is frozen at 2026-06-25 and is DURABLE — it needs updating, not
  burying; archiving it by staleness would have been exactly wrong. **What does classify is already in the
  corpus: the docs declare themselves in their own `Status:` line.** *"Resolved"*, *"Draft for review"*,
  *"Verification note"* are episodic; *"reference doc"*, *"Operative reference"*, *"Living reference"* are
  durable. Wave 2 should read that line rather than invent a third proxy.

  **Residual: 43 entries, deliberately left**, and none is a live instruction. 35 × `design/backlog.md`
  (historical mentions, including this overhaul's own "was a single file before" notes), 6 ×
  `scripts/launcher.mjs` (bare mentions of the CLIENT's launcher in dated plan/gate records — ambiguous,
  not dangling), and two genuine one-offs: a never-written `arbiter-shadow-corpus/README.md` reference and
  `bl091-investigation.md`. The ratchet holds them; [[BL-141]]'s gate fails on anything new.



<!-- @item
id: BL-144
status: done
date: 2026-08-15
epic: null
tags: [overhaul, wave2, modules, colocation, architecture, docs]
-->
- [done 2026-08-15 · `modules/` exists and is gated · `npm run modules:check` · design/ top level
  36 → 2 · **two deviations from this item's own text, both argued not absorbed; the AGENT.md
  split is deliberately NOT done and went to the PO as a proposal** · **filed 2026-08-15 · Wave 2 of the overhaul · waves 0 and 1 are MERGED (`0b8bee5`,
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

  **Use the `Status:` line as the lifecycle classifier — do NOT invent a third proxy.** [[BL-142]]
  established that filename patterns and staleness BOTH misclassify: `modules/orchestrator-host/docs/architecture.md` is seven
  weeks cold and durable. The docs already declare themselves — *"Resolved"* / *"Draft for review"* /
  *"Verification note"* are episodic; *"reference doc"* / *"Operative reference"* / *"Living reference"*
  are durable. Where a doc declares nothing, that is the signal a human must read it.

  **Deliberately NOT in scope: new repositories.** Modules give every seam without eight `AGENT.md`
  files to keep true, and [[BL-086]] already showed what one cross-repo split costs in duplicated
  governance. Extract a repo only when something outside actually consumes a module.

  Analysis and measurements behind this: the overhaul artifact published 2026-08-15.

  **CLOSED 2026-08-15.** `modules/` exists: 13 modules, `npm run modules:check` proving ownership
  **total** (every source file claimed) and **disjoint** (none claimed twice), 115/116 owned with one
  entry on a commented UNOWNED register. 34 documents left `design/`'s top level — 30 to the module
  that owns them, 4 to the archive — leaving only this task's own live plan and ledger. Plan and
  ledger: `design/bl144-plan.md`, `design/bl144-implementation.md`.

  **Two deviations from the text above, decided at Gate 1 and recorded loudly rather than absorbed:**

  1. **The backlog did NOT move.** `design/backlog/**` is not merely a location — it is a path in the
     **operator seat's write allowlist**, named at six sites. Dispersing it under `modules/` would
     force that fence to widen across the module tree, where durable law now lives, or strip the seat
     of its ability to file at all. A module owns its slice by **naming** it in `backlog:`.
  2. **The code did NOT move.** The build is a project-references graph — 9 root references, 6
     package-level, `paths` aliases, and a `["apps/*","packages/*"]` workspace list under which
     `modules/*` is not a workspace. Relocation rewrites four coupled things for no gain that Wave 2
     needs: **a gate forces a reader to touch the claim; a directory only invites it.**

  **The AGENT.md split is deliberately NOT done** — it is what every agent auto-loads at turn 1, so
  it is governance, which the PO's standing overhaul grant explicitly does not cover. It shipped as a
  measured proposal instead, and **the measurement inverted this item's own prescription**: all ten
  correction markers sit in three of fifteen sections, and the other twelve — 556 lines — have never
  needed one. Law does not rot; claims about code rot. ~300 lines should leave, not ~880. The PO's
  decision is [[BL-145]].

  **Three defects the gates caught during the build, each recorded rather than quietly fixed:** the
  ownership gate reported all 115 files unowned on its first run (one typo — `m.code` where the
  wrapper is `{name,dir,raw}`; volume is not evidence); it then **caught its own author**, because
  `check-modules.mjs` was untracked when the T1 suite ran and so escaped its own coverage check,
  exactly as [[BL-141]] shipped red; and the doc migration rewrote citations **inside
  `design/archive/`**, breaking Wave 0's never-edit-the-archive rule that the migration script's own
  header states — 28 files reverted before the commit, and the citation gate could never have caught
  it because the archive is `CITER_EXEMPT`.


<!-- @item
id: BL-145
status: done
date: 2026-08-15
epic: null
tags: [governance, agent-md, overhaul, wave2, po-decision]
-->
- [done 2026-08-15 · **DECIDED `[PO]`: NO SPLIT — "fix the three sections in place."** · all three
  sections fixed and merged · `AGENT.md` **1,033 → 1,001 lines, 10 correction markers → 0** · filed by
  [[BL-144]] T3] —
  **`AGENT.md` does NOT split. The three corrected sections get fixed where they are.**

  `AGENT.md` is what every agent auto-loads at turn 1, through three names on a case-insensitive
  filesystem. Changing it changes what every actor reads before it acts, so it sits outside the
  standing overhaul grant by construction.

  The proposal is `modules/governance/docs/agent-md-split-proposal.md`, and its finding is that
  [[BL-144]]'s prescription was **backwards**. Measured: 1,033 lines in 15 sections; **all ten**
  correction markers in three of them (operator charter 5, milestone Key Features 4, role
  assignments 1); the other twelve, **556 lines**, have never carried one. So the split should be
  ~300 lines out and ~730 staying — not the ~150-stays the item assumed.

  **Three questions for the PO**, the first being the real one:

  1. **Does the split happen at all?** A defensible answer is *no* — fix the three corrected sections
     in place and leave the file whole. The proposal does not assume its own conclusion.
  2. The milestone Key Features: **archive, or keep as a dated appendix?** Either way, the three live
     behavioural facts buried in them (transport-asymmetric propagation, nothing detects a hung
     agent, the wall clock is the only anti-hang rail) get **promoted first**, with their own
     citations. That promotion is the un-automatable step and must not ride a mechanical commit.
  3. The per-agent **op-notes**: split from the role table, or stay beside it?

  **`[PO]` DECISION, 2026-08-15: option 1 — no split. Fix the three sections in place.** Questions 2
  and 3 fall away with it: nothing moves, so nothing needs a destination.

  **What the fix turned out to be, and it is not what "fix the corrections" sounds like.** Verifying
  every factual claim in the three sections against the code first showed they have **three different
  diseases**, so one remedy would have been wrong for two of them:

  | Section | Markers | Diagnosis |
  |---|---|---|
  | Milestone Key Features | 4 | **Stale citations** — four wrong line numbers, and a **self-contradiction** (see below) |
  | Role assignments (agy op-note) | 1 | A 46-line strikethrough stack burying its own live content |
  | OPERATOR charter | 5 | **Claims verified ACCURATE** — the disease is stratification, not falsehood |

  **The remedy the evidence pointed to: cite a file and a SYMBOL, never a line number.** Every stale
  citation these sections accumulated was a line number, and every one rotted silently while the
  symbol stayed findable — `registry.ts:489`/`:513` (really 580/604), `:890` (981), `:929` (994),
  `completer.ts:10` (12). Adopted as the sharpened form of the 2026-08-14 citation rule.

  **⚠️ The serious find: the M03 section's closing sentence contradicted its own body, in the
  dangerous direction.** It read *"nothing detects a hung agent, and an errored in-process agent does
  not stop its team; the wall-clock cap is the only anti-hang rail"* — while the paragraph ten lines
  above it already recorded [[BL-129]] making `exec-timeout` fault-class. Checked against
  `FAULT_CLASS_BY_REASON` (`registry.ts`): `exec-timeout: true`. **Both halves were false.** An exec
  turn IS torn down at `DEFAULT_EXEC_TIMEOUT_MS` (`completer.ts`, 120s) and DOES propagate. A reader
  trusting that sentence would believe no rail existed. Rewritten to state the three real mechanisms
  and their boundaries.

  **DONE (merged):** the milestone sections — now *"What the milestones established — and what is
  actually true now"*, stating current truth once instead of four stacked corrections — and the agy
  op-note, compressed 46 → 36 lines with the durable *"never read `completed` as 'the work was done'
  — check the artifact, at the coordinates where the process actually stood"* lesson preserved
  verbatim.

  **DONE — the OPERATOR charter, 226 → 178 lines.** Every claim in it had been **verified accurate**
  (`classifyHeadMove` in `infra-invariant.mjs`, `authorizationPathFor` → `design/po/**` in
  `hmp-commission.mjs`, the three ports — **3100** code default, **3741** live, **3600** operator
  sandbox — `cap.meter` mandatory, `cap.wallClockMs` the only terminating rail), so this was
  **compression, not correction**, and the risk was dropping an obligation rather than repeating a
  falsehood. Its five correction markers are gone; the two whose *retraction is itself the lesson* are
  kept as one-line notes — [[BL-123]] (the seat "cannot commit and cannot push" was false **and
  contradicted the allowlist nine lines below it**, without anyone noticing the two sentences could not
  both be true) and [[BL-134]] (`autonomy` was a **readiness** field misread as an **authorization**
  one; the real fence is Gate B, and it is **detection, not prevention**).

  **Conservation held by hand:** 72 normative lines before, 53 after, and each of the 21 distinct
  obligations in the original checked for a successor. **One was genuinely missing on the first pass**
  — the rationale that `bl093-backlog-selectable.test.ts` is pinned at *commit* time because the
  invariant harness only runs around operator runs, which would leave every ordinary commit unguarded.
  Restored before commit. That is precisely what the inventory exists to catch.

  **Result across the whole item: `AGENT.md` 1,033 → 1,001 lines with 10 correction markers → 0.** The
  file every agent auto-loads at turn 1 now states what is true once, rather than stating it four times
  with three retractions.

  **Conservation used, since prose has no line-count or parse-equality property:** a normative-statement
  inventory (`scripts/archive/bl145-normative-inventory.mjs`) taken before and after — 294 lines
  carrying an obligation across the file, 123 of them in the three sections — with every obligation in
  a rewritten section dispositioned by hand.


*(add new items above this line)*
