# Lessons learned — Claude (role: planner-reviewer)

**What this is.** Claude's own append-only, dated record of lessons that sharpen its effectiveness over time —
**self-authored, per-agent** ("each its own"). Written at **session close** (when you write the Session Primer, or
otherwise wrap a working session); **skimmed at session start** so it actually compounds (write-only rots).

**Discipline.** Brief — **1–3 bullets per entry** (what worked / what didn't / what I'll do differently). Append-only,
newest at the bottom. This is *self-reflection on how I work* — distinct from `logbook.md` (shared cross-cutting
**facts**) and `implementer-pitfalls.md` (reviewer-authored case law about the **implementer**). **Only Claude writes
here.**

**Format:** `### YYYY-MM-DD — <one-line theme>` then 1–3 bullets.

---

### 2026-06-27 — process can outgrow the product; verify self-reports; mind the rename-commit trap
- **Proportionality is my blind spot.** I built an entire governance audit + SM refinements + new mechanisms
  enthusiastically and didn't flag "are we polishing process instead of shipping product?" until Fausto asked. As
  planner-reviewer I should *proactively* raise proportionality — process should be earned by real failures, not
  pre-written for hypothetical actors that aren't running yet. Check ratio of meta-work to product before adding more.
- **Verify-don't-assert pays off concretely.** agy confidently said "I check my private store" — but the store didn't
  exist (AGENT.md said "pending"). Grounding the claim against the repo caught a real readiness gap. Keep distrusting
  confident self-reports (mine and others') and check ground truth.
- **`git add` of a git-rm'd path errors and stages nothing** → I shipped a broken commit (deletion only) and had to
  amend. When a commit involves a rename/deletion, check `git status` *after* staging and *before* committing, or
  stage with `git add -A` on the dir rather than listing a path that no longer exists.

### 2026-06-27 — verify-don't-assert caught THREE phantom backlog items in one session
- **The backlog lied three times; git told the truth.** Asked to prime a planner for the "next item," the §3b
  ground-truth check found the picked item (`llm-client` spike) **already merged**, then the next two candidates
  (`provider`-union, mcp-rename) **also already done** — all still reading `[open]`/`[promoted]`. The gate's
  "disposition *every* item against reality" is load-bearing: picking off a stale backlog manufactures phantom
  tasks. **Always grep/log the actual code before believing a backlog or plan line** (Reviewer Rule 5). Wrote LB-47.
- **Review = run it, not read it.** I stamped both M10-T4 and llm-client VERIFIED only after re-running the suite
  (245/245), reproducing the live probe, and running `npm run smoke:exec` end-to-end. The smoke proved the "owed"
  adapter gap was *already* closed — something a diff-read would have missed.
- **Scope to budget; baton to headroom.** At ~87% I correctly *declined* to start the big conductor plan and instead
  swept the backlog (cheap) + handed planning to Codex (more weekly headroom). Recognizing "this is the wrong
  budget window for a big design" is part of planning, not a cop-out.

### 2026-07-01 — M13 structured backlog; the destructive-restore near-miss
- **NEVER `git checkout -- <file>` to "restore" a file that has uncommitted changes I want to keep.** During a
  negative test (temporarily breaking `backlog.md` to prove the validation harness exits 1), I "restored" with
  `git checkout` — which reverted to HEAD and **wiped my own un-committed backfill** (8 @item headers + a doc
  note). The next gate run caught it (suite 265/266 + backlog:check 8 errors), so no bad commit shipped — but I
  had to redo all the edits. For a reversible poke, **back up to a temp file** (`cp`/scratchpad) and restore from
  that, or stash — never checkout over live work.
- **A real-file test earns its keep.** The `readBacklog()`-on-the-actual-file test found TWO real bugs a
  fixture-only suite would've missed: the parser reading an `@item` example inside a doc code-block (→ made it
  fence-aware) and a title picking bold text inside the `[status]` tag. Keep one integration test that runs on
  the genuine artifact, not just synthetic fixtures.
- **Proportionality, as PO-directed.** Fausto explicitly collapsed the role ceremony ("fai tutto tu, troppo
  context sharing for something this pointed"). Wearing all hats for a small additive tooling epic was the right
  call — I should propose that compression myself next time instead of defaulting to the full gate dance.

### 2026-07-02 — arbiter spike rounds 1–3; the PO's simple model beats my taxonomy
- **As reviewer: verify the content signature, not the artifact count.** Two review rounds in a row, the
  corpus looked done by file count and failed by content (empty transcripts, then `undefined` debate text).
  The check that works: parse the actual payload and demand the class's signature (the illegal move, the
  ejection, the ping-pong) quoted per file. Also: `ps` AND `git worktree list` on every hygiene pass — I
  caught the zombie generators but missed a stray worktree in round 1. Minted IP-9.
- **As reviewer: the held-unpushed-stack works, but branch unrelated work.** Holding refuted spike commits
  local kept the mainline verified-only — good. But mid-hold the backlog overhaul landed on the same local
  master, so unrelated verified work got hostage-held behind the spike's re-review. Next time: unrelated
  work goes on its own branch even when I'm the one doing it.
- **As architect: when the PO is confused by a state machine, fix the state machine, not the PO.** I defended
  promoted/absorbed/deferred purity for two turns; Fausto's "todo·doing·done·dropped, period" was simply the
  right altitude — provenance belongs in descriptions, not states. Related: an excluded-class finding (F-5,
  soft-rejects invisible in recordings) is spike GOLD, not a failure to route around — it's already shaping
  Epic 1's event surface.

### 2026-07-02 — AS-L1 labeled + AS-T2 verified/fixed/merged; three hats in one session
- **As architect (labeling): read every transcript before proposing a single label.** The corpus's own payloads
  held two facts no claim mentioned (`live-success-1` terminates `refused`; `sample-success` carries a literal
  `null` opinion) and forced the judge-frame ruling that defines the whole metric. Also: gotchas I wrote into the
  implementer primer (dual payload shape) became the exact review probe that caught a crash one task later —
  minutes spent writing down a trap repay themselves at the next gate.
- **As reviewer: probe past the claimed bar, and check the artifact against its consumers.** T2-C1 only required
  "one entry runs", but running the *other* shape (live) found the crash + the swallowed-error exit; diffing the
  judge's vocabulary against `labels.schema.json` (its consumer contract) found the drift. Claims-only review
  would have VERIFIED a judge that inflates its own agreement score. When Fausto said "I haven't the faintest
  clue," the plain-language reset (referee/answer-key analogy) unblocked a stalled gate in one turn — altitude
  matching is reviewer work too.
- **As temporary implementer: prefer structural fixes over value-sync fixes.** Loading `VERDICT_ENUM` from the
  schema at runtime made vocabulary drift *impossible*, where copying the nine strings would have just deferred
  it. And the PO later codified the reviewer-fix exception *narrower* (typo-class only) than my PO-granted
  behavior-touching fixes — right call: anything that changes behavior should keep needing an explicit grant.

### 2026-07-02 (second session) — AS-T3/AS-T3b/AS-T4: architect probes + reviewer gate, two hats
- **As architect: reproduce the headline number's *provenance*, not just its arithmetic.** The 0/6 agreement
  was real and reproducible from the artifacts — and still wrong, because it measured the harness (a trigger
  regex that never fired on terminal messages) rather than the judge. Four probe calls (~cents, scratchpad-only)
  cleanly separated the three stacked confounds (harness / transport / prompt) and flipped the entire
  recommendation. Cheap targeted probes before a promote/park call are the best tokens I spent all epic.
- **As architect: a recommendation premised on a fact must be re-issued when the fact dies.** My PARK was
  explicitly conditioned on "no valid measurement exists"; when AS-T3b produced valid numbers I updated the
  record to PROMOTE (qualified) rather than letting a stale verdict stand — status-correction discipline
  applies to my *own* prior records, not just predecessors'.
- **As reviewer: when the pipeline is temp-0 deterministic, rerun-and-diff beats spot-checking.** My full
  matrix rerun matched all 33 committed verdicts and byte-identical token counts — that's a far stronger
  VERIFIED than sampling a few rows, and it cost the same one pre-registered run. Corollary: a rerun that
  overwrites evidence artifacts must end with `git restore` so the implementer's committed evidence stays the
  evidence. Also minted IP-10 (telemetry asserting un-happened facts; deviations smuggled as parentheticals —
  the "prompt tweak" aside nearly buried the transport 400, which was spike gold).

### 2026-07-02 (third session) — M14 open→close in one day; LB-49 root cause; the pivot to M15
- **As reviewer: re-run EVERY hygiene check EVERY round — a fix can unlock new side-effect paths.** Round 1's
  worktree check was clean because the broken success scenario never reached the worktree-creating work phase;
  the round-2 fix made it reach it, and I skipped the recheck (violating my own spike lesson, written five days
  earlier). Six leaked worktrees surfaced only at the post-merge sweep. Hygiene checks are per-round invariants,
  not one-time boxes — especially after a fix changes which code paths execute.
- **As architect: measure the transport before blaming the process.** "Hermes can't see Claude" felt like flaky
  orchestration; an hour of measuring (alternate_on=1, history_size=0, capture -p == capture -S - byte-identical)
  turned it into three concrete defects with three concrete fixes (LB-49). Also: the PO rejecting my file-report
  workaround in favour of full-depth investigation was right — the workaround would have papered over the
  alt-screen fact that made ALL tmux capture of Claude structurally hopeless.
- **As architect: when preserving old behaviour costs more than the seam is worth, say so before the PO does.**
  M14's byte-identical extraction burned three gate rounds on a harness for behaviour we intend to replace; the
  PO's "bypass, don't dissect" cut (M15) shrank the epic and kept preservation for free (frozen path + suite +
  the very harness T1 built). I defended the careful path one epic too long — proportionality remains my
  recurring blind spot (see 2026-06-27 entry).

### 2026-07-02 (fourth session) — M15 Gate 1 + independent T3 review; the guard-asymmetry catch
- **As reviewer: when a fix adds a routing branch, diff its guard against every sibling guard.** Codex's T3
  redelivery gated two new arbiter routes on `consensusMode` alone while four existing guards also required
  `composition === 'planner-planner-worker'` — a grep for the sibling pattern made the asymmetry visible in
  seconds, and a 40-line repro test confirmed the crash (`Arbiter task not found`) before I claimed it.
  Self-review (Codex reviewed its own fix) missed exactly this class; the PO-requested independent pass caught
  it pre-merge. Keep the repro in scratchpad and re-run the *same* repro after the fix — a flipped repro is
  stronger evidence than a fresh green test.
- **As reviewer: a file-diff fence doesn't catch foreign writes into frozen state.** Gemini satisfied "zero
  `team-coordinator.ts` diff" while writing into its private task map via `(x as any).tasks.set(...)` from
  registry.ts. Fence checks must include grepping for casts/pokes *at* the frozen surface, not just diffs *of* it.
- **As reviewer: challenge the premise of a role change with the meter, then defer.** The PO's "you are low on
  budget" was session-window pressure, not weekly; I said so once with fresh numbers, he clarified his real
  reason (preserving my runway for architect calls), the decision stood, and I recorded it in the ledger with
  the mitigation. Flag-once-then-comply kept the gate moving without burying the governance note.

### 2026-07-08 — governance reset + M16 same-day epic; four hats, three merges, two IP cases
- **As SM/architect: centralize the binding, then everything else is a one-line edit.** The reviewer 3-way
  split + role-only sweep landed in one morning *because* all role→provider bindings moved into one PO-owned
  table first — the same-day SM handover (Codex→me) and three seat assignments each cost one table row, and
  the sweep itself exposed three stale "reviewer stays Claude" drift lines the old scattered model had bred.
  Same move worked twice more within hours: origin tags became role tags, and the PO's scope-fence idea
  (BL-015) turned out to be the third face of "the substrate administers the law" (with M17 identity and
  BL-014 role briefs) — naming that convergence is what made the idea land as a program piece, not a gadget.
- **As task-end reviewer: reproduce the load-bearing bar yourself and verify its *semantics*, not its exit
  code.** Running the T2 live proof first-hand (not re-reading gate-2's run) is what revealed D2's true
  nature (the server blocks; the script's poll was stacked-blocking, the 'No turn available' catch dead code)
  and let me accept it instead of refuting on appearance. Fresh eyes at close caught what gate 2 glossed in
  BOTH tasks it passed (T1 branch-less delivery → IP-12; T2's undispositioned deviations D1/D2) — the
  fresh-eyes-at-close independence default earned its cost on its first day of existence.
- **As plan reviewer: verify the plan's claims against the code BEFORE approving — both catches were
  pre-implementation.** F1 (batons outside a conversation are delivered but never recorded/shown) would have
  failed the live proof by design; the T2a publication chain (publish tool → contract hash bump → orchestrator
  hard-rejects the unmodified client at attach) turned a yes/no gate question into the binding cross-repo
  addition that kept T2 alive. Minutes of grepping at gate 1 saved whole implementer rounds — again.

### 2026-07-09 — M17 inception→close in one session; two conceptual-boundary refutes; the count is the check
- **As task-end reviewer: authority guards fail at conceptual boundaries, not code mechanics — probe from
  outside the error message's vocabulary.** Both refutes were category confusions the tests' own vocabulary
  hid: G3-1 (the *tag* was blocked, the *act* wasn't), G3-2 (`provider: 'api'` treated as "human" when it's
  an LLM completer). Method that made both hand-backs undisputable: write the repro FIRST, run it, archive
  it in scratchpad, and re-run the same repro after the fix to watch it flip. Also: the T3 implementer
  "observed" UI behavior it had only inferred from T2's wiring — verify observation claims by making the
  observation (I drove the real UI in Chrome during my own live-proof run).
- **As plan reviewer: minutes of code-grepping at gate 1 settle design debates whole rounds would relitigate.**
  Verifying that `wire-contract.json` hashes tool *names* only answered "new tool vs. extended metadata"
  definitively (extension is hash-neutral → no cross-repo sync) and kept the epic at v7. Same move as M16's
  F1 catch — pre-implementation verification is the cheapest review there is.
- **As backlog editor: read the validator's COUNT, not just its ✓.** My BL-020 insertion ate BL-017's
  header; `backlog:check` stayed green (0 warnings) but said 19 items where 20 were expected. Echo of my
  2026-06-27 staging lesson: after any structured-file edit, check the invariant that should have changed
  (the count), not the absence of errors.
- **Telemetry under meter outage: mark estimates loudly and reconcile when it returns.** While the claude
  block was ok:false I wrote frozen telemetry ~10 points under the real figures (est. 19% weekly vs. actual
  30% once it came back). Estimates in durable artifacts need an [est] tag and a reconciling note.

### 2026-07-09 (second session) — M18 open→close; the question that killed a task; a three-epic-old diagnosis was wrong
- **As task-end reviewer: ask "what would this proof print if I reverted the fix?"** M18-T3 arrived with six
  green gate-2 rounds, a committed evidence log, and a confident ledger. I reverted the change, re-ran the same
  JSON-RPC, and got byte-identical output — the proof had never discriminated fixed from unfixed code. That one
  question is now **IP-15**, and it is the cheapest high-yield probe I have found: it costs one run and it
  invalidates an entire class of credible-looking evidence. Corollary that paid twice today: **run the A-side
  yourself**; when I re-verified T3a I extracted the baseline bridge from `master` rather than trusting the
  implementer's A-side artifact.
- **A backlog item is a claim about reality, and it can be wrong for three epics.** BL-017 ("the exec bridge
  can't carry baton args") shaped M17's inception, two backlog gates, and all of M18 — and was **false**. Real
  CLI sessions were blocked at the *handshake*, not the payload; every proof used SDK clients that happened to
  set the contract hash. Verify-don't-assert (my 2026-06-27 lesson) applies to **the problem statement**, not
  just to the status line. The tell was available all along: nobody had ever attached a real CLI. Next time an
  item survives multiple epics unclosed, **try the thing it describes, once, by hand, before planning around it.**
- **Honest closure beats a clean scoreboard.** M18 closed with C3 **DEFERRED (not met)**: 19 relays, **0**
  substrate events. It would have been easy — and wrong — to call C3 green because T3a "unblocked" the fall.
  Writing "the program's central claim is not yet earned" into the program status is the single most useful line
  I wrote today; it makes M19's first duty unambiguous. Related: I flagged the relay metric's missing denominator
  (BL-027) *before* it could flatter us, rather than after.
- **Two small ones, both from near-misses I caught on myself:** (a) `git show master:bridge.mjs` in the *wrong
  repo* produced an empty file, and `grep -c` on it returned `0` — the exact false-green I'd just refuted someone
  else for; check the ruler before reading the measurement. (b) A `pgrep` loop over-matched and nearly had me
  kill a 4-hour-old process I never started. **Identify before you reap** — it became BL-023.
- **Addendum, same session (the day's last lesson, and it's on me).** The "stray orchestrator" I flagged at two
  gate-3 closures and filed as **BL-023** was **not a leak** — it was the PO's own `launchd` KeepAlive service on
  non-default ports. I inferred the cause from a correlation (orphaned `ppid 1`, cwd `apps/orchestrator`, right
  time window) and never ran the one command (`launchctl list`) that would have refuted it. That is **exactly
  IP-15** — a conclusion that would look identical whether or not it were true — committed by the reviewer who
  minted IP-15 that morning. What saved it: identifying the process before killing it, because the PO asked me to
  kill it. **Verify-don't-assert is not a posture you hold toward others' claims; it is one you hold toward the
  most confident-sounding voice in the room, which is usually your own.**

## 2026-07-10 — as architect (out-of-band, unprimed: PO explicitly waived the handshake)

- **I re-derived my own design note from scratch and didn't recognise it.** The PO floated "role-based deterministic
  hardness" as a fresh idea; I spent a long, enthusiastic stretch building it up with him — chokepoint taxonomy,
  denial-as-interrogation-trigger, over-fencing warnings, the escalation-path risk — before grepping and finding
  **`design/scope-fences-design-note.md`, dated two days earlier, `Owner: Architect (Claude)`**, containing every one
  of those points by name. Nothing was lost (the entry is better for the second pass), but I let the PO believe we
  were inventing what we had already written. **Before agreeing that an idea is new, grep `design/` for it.** The
  cost of the check is ten seconds; the cost of skipping it is a person's confidence in their own memory.
- **The habit that saved it is the one I wrote down yesterday.** Verify-don't-assert caught it — I only reached for
  `grep` because I was about to *assert novelty*. Yesterday's lesson (IP-15 committed by the reviewer who minted
  IP-15) generalised correctly and fired one day later, on me, in a different costume. The read-back at session start
  is not the mechanism; **the mechanism is refusing to let a confident sentence leave unchecked.**
- **Two overclaims about an external system in one session, both from reading too little.** I said Traycer "has no
  consensus" (proved only: not in their *open* contract — the host is a closed binary and their README advertises
  agents that debate), and I opened by doubting the PO's "it's open software" when the repo was real. Both got
  corrected within the session, but both were *stated first, checked second*. When surveying prior art, the sentence
  "I do not know, and here is why I cannot know from source" is available at all times and costs nothing.
- **What worked: cite `file:line`, then verify every anchor before shipping.** I checked the eight line refs in LB-67
  and **two were wrong** (a range off by two lines; a harness list missing `traycer`). An entry whose citations don't
  resolve is worse than no entry — it teaches the next reader that our refs can't be trusted. Verifying took one
  command.

### 2026-07-12 — M19→M20 arc (SM+architect+all-reviewer hats): grep-at-gate-1, verify-the-fold, identify-before-reap, honest-about-my-own-gaps

- **As plan reviewer: the blast-radius grep at Gate 1 is my single highest-leverage move, and it paid off biggest on
  M20.** The plan gated *every* `send_to_agent`; three minutes grepping its callers found two behaviour-contract tests
  it would break (`m17-gate-channel.test.ts:93`, `baton-metadata.test.ts`) **and a production flow it would hang**
  (`conversations/runtime.ts` auto-replies). The fix — make the gate a *mode, default off* — preserved everything
  *and* turned out to *be* the consent-dimmer the PO wanted. Caught before a line was written. Same move caught M16's
  F1 and M17's contract question. **Always grep the blast radius of a shared-code change at gate 1.**
- **As reviewer: verify the fold against the PLAN/CODE, not the ledger's self-report.** Both M19 (3 conditions) and
  M20 (the mode amendment) came back "folded" in the ledger; I re-checked the actual plan/registry each time. The
  reports were faithful — but the point is the ledger's claim isn't the verification, the re-check is. Also: T1's
  mode-off "preservation" was only genuine *because the unchanged contract tests still passed* — I confirmed those
  test files were **not modified** before trusting the green (a weakened test is a false preservation).
- **"Identify before you reap" fired correctly, twice, exactly as my 2026-07-09 lesson predicted.** A backend kept
  respawning on each kill; `launchctl list` + ppid 1 + non-default ports identified it as the PO's `launchd` service
  `com.fausto.agenttalk-orchestrator`, not a leak — left it alone. And the `etime` column showed "leaked" llm-agents
  were breach-era, not from my run. The habit is now reflexive; keep it that way.
- **Honesty about my *own* review gaps, not just implementers'.** I told the PO I'd drive the live UI; when the Chrome
  extension was down I said so plainly, diagnosed it (Chrome v150 auto-update dropped the connection), and after the
  reconnect drove render + a real mode-toggle click (backend-confirmed WS). The literal Approve-button-on-a-live-relay
  I did **not** click — I verified it by composition and stated *exactly* what I did and didn't do rather than
  overclaim "drove the UI." Reviewer honesty-over-results applies to the reviewer.
- **The demonstration-vs-organic caveat held under pressure, both epics.** M19-T3 and M20-T3 each produced a ratio
  (2/~9, 1/3) that was a *capability* proof, not burden reduction — I made that caveat load-bearing in the ledger,
  backlog, program draft, and logbook each time, so the number can't later be quoted as a productivity stat. That is
  program-risk-#3 discipline at the exact moment of maximum temptation to inflate.

### 2026-07-12 (second session) — Tester seat born from a live run; charter-from-reality; reassignment discipline

- **As architect: describe the role from what ACTUALLY happened, not the idealized version.** I first drafted the
  Tester as an agent that *drives the UI itself* (via Chrome MCP). The PO corrected it: the *human* drives, the
  *agent instruments* (logs, backend status, step-by-step, verify-don't-assert) — which is *literally what we'd just
  done this session* (I instrumented, he clicked). I'd written an aspirational charter over a lived one. Lesson: when
  minting a role out of a real session, transcribe the observed division of labour first, then generalize — don't
  let the tidy abstraction overwrite the evidence sitting in the transcript.
- **Proportionality, applied correctly for once (my standing blind spot).** I flagged "is this earned process?"
  *and* concluded it WAS earned — but for the right reason: the seat has a **standing mandate** (own the adoption
  metric / carry M20 forward), not just one session's novelty. The signal that flipped it from "premature" to
  "earned" was that real work was *waiting* for the seat, and its first lessons already existed (LB-77/BL-031). Past
  me would have either reflexively resisted (proportionality reflex) or reflexively built (enthusiasm). Naming the
  distinction — validation ≠ verification — is what made it a program piece, not a gadget.
- **As temporary implementer (PO-assigned, Gemini available): declare the hat loudly, hold every fence.** The PO
  reassigned me to implement BL-031 while I held four other seats. I declared "temp implementer" explicitly, kept
  scope to one file (`App.tsx`), preserved behaviour (left the sidebar panel intact rather than remove it), and —
  the load-bearing bit — **did NOT self-validate**: routed the runtime/UX check to Codex(Tester)+human because
  independence says I can't bless my own code. A green tsc is not a validated feature; I said exactly that in the
  delivery instead of overclaiming "done".
- **Live operation surfaces what gate-review structurally can't.** BL-031 came from the PO's *human* "this button
  feels misplaced" — a judgment no DoD row encodes. That single catch is the entire empirical case for the Tester
  seat existing: verification checks the spec, validation checks reality, and reality had a finding. Keep steering
  UX-shaped work toward a human driver early.

### 2026-07-13 — BL-032 gate-1 + gate-2 (Plan Reviewer + Impl Reviewer): the grep refutes the *lead*; IP-15 is the spine; the diff outranks the ledger

- **As Plan Reviewer: the blast-radius grep is not just a breaker-finder — it can *refute the plan's own root-cause
  hypothesis* before a line is written.** BL-032's "strongest lead" was a queueTurn-vs-awaitExecTurn mismatch. Three
  greps found that `deliverRelayMessage` (M20 relay) shares the *identical* `sendProtocol→queueTurn` line (`:810→581`)
  yet reached the same provider agents last session — so the lead couldn't be the whole story. That reframed T0 from
  "investigate the queues" to "explain why the same path works for relays but not healthchecks" — which is exactly
  where the real cause (deadline/backstop, not queue) turned out to live. The plan's own "a lead, not a conclusion"
  humility was vindicated; good planning pre-commits to being wrong, and my job at gate 1 is to *aim* its doubt.
- **As Impl Reviewer: the IP-15 stash-and-rerun IS the gate-2 spine, cheapest high-value move I have.** Codex reported
  "2/2 passed." I `git stash`ed only the runtime fix and reran → test 1 FAILED on `toMatchObject({ timeoutMs: 25 })`.
  That one command converted "the test passes" into "the test passes *because of* the fix" — the whole difference
  between a regression test and a coincidental green. Equally informative: test 2 (M20 relay) passed *with and
  without* the fix — that's the preservation proof, for free. Never sign a gate-2 verdict on a green I didn't try to
  break.
- **As Impl Reviewer: the diff is ground truth; the ledger's "Files Changed" is a *claim*.** Codex's ledger listed
  only the authorized files, but `git status` on the whole tree showed 2 undeclared out-of-scope primer edits riding
  along. Always `git status`/`git diff --stat` the *entire* tree, not just the files the report names — the omission
  is where scope creep hides. (Here the extras were PO-sanctioned, so the disposition was "separate commit," not
  "revert" — read *why* a stray file is there before reflexively reverting.)
- **Executing a merge as the PO's scribe: keep history honest by concern.** Closed BL-032 as three commits — the fix,
  the split-out PO-sanctioned primer housekeeping, the backlog closure — so each is independently revertable and the
  BL-032 commit contains *exactly* its scope. Bundling would have laundered out-of-scope edits onto the mainline
  under a fix label; dropping would have destroyed sanctioned work. Split, don't bundle or drop.

### 2026-07-13 — as Tester (first real run, TL-004): the backend log is the truth; the pixels are only intent

- **The discipline transferred cleanly to my toolkit.** First time holding the Tester hat for real: declare-strategy-
  first, real-not-fake (two real codex clients, no bridge), and **cross-check every UI transition against the backend
  log + `/api/*`** — all toolkit-agnostic. Only the browser surface differed (Claude-in-Chrome, not Codex's
  cmux/browser-use). Both paths validated end-to-end: Continue reply-limit (2/2 → `conversation_end` → terminated) and
  Stop (denied, `approved_delivered`=0, not delivered → terminated).
- **A screenshot shows *intent*; the backend event shows *truth*.** The UI rendered proposed/delivered/WAITING
  cleanly, but the authoritative confirmation was always the log: `pending → approved_delivered` per Continue,
  `denied` + zero delivery per Stop, `MCP connection closed after conversation_end → terminated` per agent. LB-89's
  "real click, then verify the resulting backend event" held on the first click (approve_each toggle → backend
  `set_relay_approval_mode`). Never sign a UI observation without its backend echo.
- **What I sidestepped, and owe next time.** I used WS `start_pair_chat` + API agent-creation to dodge native
  `<select>` flakiness (documented, TL-002 precedent) — legitimate, but I have **not** yet proven I can drive the full
  UI creation/start form; and I didn't preserve per-test screenshot artifacts (BL-035). Next run: attempt the UI form
  path and save artifacts under `design/test-artifacts/`.
- **A real finding fell out for free** even on a "nothing new" rehearsal: when the reply-limit conversation ended, the
  next proposed turn surfaced in the sidebar while the main pane stayed on the ended conversation — the known BL-031
  residual, reproduced with my toolkit. Validation surfaces reality; that's the point of the seat.

### 2026-07-13 (evening arc) — as Tester + temp Implementer + Impl Reviewer + architect: the "failed" runs drove everything; ground-truth before spend; live > "verification passed"

- **As Tester: ground-truth feasibility from the *source* BEFORE spending provider budget — cheapest high-value move.**
  TL-005 predicted the arbiter wall (createTeam hardcodes `protocol`) and the API-consensus blockers by *reading the
  code*, before a single doomed run. The two doomed execs (404, 400) cost almost nothing because I'd already traced
  why they'd fail. Trace first, spend second.
- **The "failed" runs were the most valuable of the whole session.** TL-005 (arbiter orphaned), TL-006 (agy hangs on
  the healthcheck), the BL-038 gate-2 refute — every *negative* finding drove a real decision: park agy (LB-92), and
  **pivot the coordination layer to OpenRouter** (validated end-to-end in TL-007). A green that confirms the happy
  path teaches less than a red that redirects the program.
- **As Impl Reviewer: the live run beats the report's "verification passed" — every time.** BL-038's fix passed its
  unit tests (the 90s timeout value *was* routed to gemini) and I still REFUTED it: live, agy times out at 90s and
  produces nothing. IP-15 in its purest form — the unit test checks the *config*, not whether agy *acks*; only the
  live run checks reality. Never sign a verdict on a green I didn't try to break against the real thing.
- **As architect: resolve the one load-bearing unknown with a cheap probe before banking the decision.** I recommended
  OpenRouter but flagged the schema-compat risk, ran a 5-minute direct API probe (`gpt-4o-mini` → 200 + valid tool
  call; the Google 400 was google-specific), *then* wrote the decision note. Minutes of probing turned "probably works"
  into "verified," and it was the difference between a sound decision and a guess.
- **Teardown: identify-before-reap — I broke it, it bit, I re-applied it.** In TL-006 I used broad `pkill` and agy's
  live instance went down (couldn't rule out I caused it). In TL-007 I switched to **targeted PIDs from a tracked
  file** and left agy's ports untouched. The 2026-07-09 lesson had to land a *second* time, the hard way. Broad
  `pkill` is never worth it.
- **Distrust the confident in-run sentence — mine most of all.** Mid-TL-007 I wrote "API agents stay ready/reusable"
  from `status: ready`; the very next conversation refuted it (driver stops at `conversation_end` → BL-040). I
  corrected it in the record immediately. The status lied; the second conversation told the truth. Verify-don't-assert
  applies to my own just-typed claims.

### 2026-07-13 (evening) — goose-executor spike (as planner+implementer+reviewer, resource fallback, PO "do or die")
- **Find the real seam before proposing the build.** I first framed goose as an "MCP client" and hand-waved "build a
  tool loop." Reading `llm-agent.mjs` showed the attach path is a bespoke WS + SHA-256 wire-contract handshake goose
  can't speak — the actual seam was **goose as a one-shot *executor*** behind the existing worker (3 tiny edits, all
  reused transport). Twenty minutes reading the target code turned a vague spike into a bounded, low-risk change. The
  PO's pushback ("a CLI does a lot around an LLM") was right and redirected me from *build* to *reuse*.
- **Probe the output shape before writing the parser.** `goose --output-format json` prints an ASCII banner *before*
  the JSON — a naive `JSON.parse(stdout)` would have silently returned `stdout` via the catch and looked "fine" on
  trivial prompts. One cheap probe caught it; I stripped to the first `{`. Guessing the shape would have shipped a bug.
- **Name the honest gap, don't dress it up.** The live run showed connect + wire-contract handshake + `await_turn`
  blocking — but NO delivered turn (plain `mcp` agents skip the auto-healthcheck I assumed). Each half proven
  separately, conjunction not shown. Labeling that precisely (not "live PASS") is the whole point; the delivered-turn
  gate belongs to a stronger model anyway, since gpt-4o-mini tests the model not the plumbing.

### 2026-07-13 (late) — goose consensus arc → arbiter WIN (as tester + implementer + reviewer, solo/degraded team)
- **Confirm the TARGET/mode before spending, not just the method.** I burned FOUR runs (TL-009→012) making goose+
  deepseek pass the strict `'protocol'` consensus handshake — when the PO's actual intent was the **arbiter/semantic**
  mode all along, and I'd defaulted to `'protocol'` because `POST /api/teams` silently defaults there. The PO's
  correction unlocked it in ONE run (TL-013). Lesson: when a task keeps failing in a new way each iteration, stop and
  re-verify you're aiming at the mode/goal the PO wants — a wrong yardstick masquerades as a hard problem.
- **Read the ground-truth artifact, not your own harness summary.** TL-013 was a WIN but my harness printed
  NO_CONSENSUS (it read `currentTask`, but `/api/teams` returns `currentTaskId`). The orchestrator's recording ndjson
  showed the real success — full debate, verdict, synthesized plan. I nearly reported a false failure. Always confirm
  a load-bearing pass/fail against the recording/planning-run, especially when the result surprises me.
- **Find the real seam before proposing a build (again).** goose fit as a one-shot *executor* behind the existing
  worker, not as an MCP client speaking the bespoke wire-contract — 3 small edits, all reuse. Twenty minutes reading
  the target code turned a vague spike into a bounded change. Held true for the arbiter enabler too (one un-forwarded
  param).
- **Probe model ids before a full run** — several anthropic/google ids 404 on this OpenRouter account; a one-word
  `goose run` catches it for ~nothing.

### 2026-07-16 — Autonomy-ladder inception + Bite 0 build (architect → planner → temp implementer, degraded mode)

- **As architect: check the docs' *cause*, not just their verdict, before honoring a PO instinct.** The PO's gut
  was "re-hire Hermes" for the conductor. AGENT.md said only "retired." Grepping LB-49 showed the cause was a
  *wedging loop + lossy tmux transport* — the two failures the conductor can least tolerate. That let me steelman
  the instinct AND flag the exact risk, and the PO's refinement (Hermes = deterministic infra, out of scrum)
  resolved it. Reading the *why* behind a retirement is what turned "yes/no" into a real design conversation.
- **Naming discipline is architecture.** I conflated the deterministic launcher with "Hermes" for several turns;
  the PO untwisted it (launcher = deterministic script; Hermes = a future *agent* that invokes it). The conflation
  had leaked into a whole plan doc. Lesson: when a role is half software / half agent, name the two layers
  explicitly and early — the seam reopens every turn until you do. I added a §0 "two layers" note so it can't.
- **As temp implementer in degraded mode: deliver the verifiable core, refuse to fake the rest.** Bite 0's live
  run needs the unbuilt main repo + an authed CLI this box lacks. Rather than write unverifiable orchestrator
  wiring, I built the deterministic cap/orchestration core + a real E2E (real BL-037 launcher + real spawned
  harness + real wall-clock terminating a real hung process), and filed D6 + the live run as BL-039/040 with the
  honest blocker stated. A partial delivery clearly reported beat an over-wired green.
- **Worktree mandate landed cleanly as both the BL-036 discipline AND the autonomy safety-sandbox** — the
  launcher's `workdir` param is the per-agent worktree hook. One mechanism, two payoffs; recorded in AGENT.md.
- **Flag your own lost independence, every time.** Sole agent in fallback → I authored Bite 0 and would review it.
  Said so plainly in the delivery and the primer; real gate-2 needs Codex back or BL-038 (Goose). Reviewer honesty
  applies to the reviewer's own position.

### 2026-07-16 (long session) — BL-039 merge, big reconcile, BL-040 D1/D3+D4 live, BL-048 spike (temp implementer + task-end reviewer + SM, degraded)

- **`git fetch` at cold-start is not optional — the primer is a claim, origin is truth.** I trusted the local
  primer/backlog and built a whole BL-039 closure on a checkout that was **23 commits behind** origin, with a 4-way
  BL-037..040 ID collision waiting. It only surfaced when `git push` was rejected. The cold-start "verify against
  ground truth" rule must include fetching the remote, not just reading local files. I put this at the TOP of the
  next primer. Cheapest possible catch, skipped for hours.
- **Auto-merge can pass textually while being semantically broken.** Merging origin in, git AUTO-merged `backlog.md`
  with **duplicate BL-037..040** because the two lines added entries at different line offsets — no textual
  conflict, but a real ID collision git can't see. Never trust a clean auto-merge on a structured doc; run the
  domain validator (`validate-backlog.mjs` caught a separate `DONE`≠`done` drift too). Verify by the data's own
  invariants, not by "merge succeeded."
- **Renumber the side with fewer external references, but honor the PO's precedence call.** PO chose "Bite 0 takes
  precedence" → origin's items renumbered even though they had MORE commit-message refs. I made the live backlog
  correct, updated living docs, and left historical logs alone with a remap note (same discipline as accepting
  commit-message drift). Don't rewrite history; annotate it.
- **A live run earns findings a stubbed test never will.** BL-040 D1/D3 against the REAL orchestrator immediately
  exposed two things the E2E stubs hid: "Ready" prints BEFORE the (dynamic) MCP url is announced, and BL-037
  conflates the orchestrator provider with the harness CLI provider. Both fixed in-scope, within the retry budget.
  Try-it/test-it/report-it beats source-diving for integration unknowns.
- **The PO's safety instinct was load-bearing — the test WAS touching the real repo.** `in-process-driver.ts`
  runs `git worktree add` in the orchestrator's CWD; running from the primary checkout created a real
  `task-*` branch/worktree. A same-repo *worktree* wouldn't have sandboxed it (shared `.git`); the fix was a
  throwaway git repo as CWD. When a human says "I don't feel ready for this to touch the code," find the exact
  mechanism by which it does — don't reassure, verify.
- **Harness gotcha that ate turns: bare `sleep` in a Bash tool command is BLOCKED** (silent exit 1, no output). I
  misread it as the orchestrator failing to boot for several turns. Put waits in `.sh` files or use background+read.
- **Scope a spike to the exact hole, not the vibe.** "UI isn't reactive" → traced to a single missing
  `agent_added` broadcast (the WS + team/status plumbing already exists). A 4-file minimal fix, not a UI rewrite.
  Reading the code turned a vague complaint into a bounded BL-048.

### 2026-07-16 (long session, part 2) — Bite 0 closed: BL-048/049 UI reactivity, BL-040 D4/D5 accepted live, BL-052 found (implementer + all reviewer seats + SM, degraded)

- **A green suite proved nothing about the thing I was building, and I nearly shipped on it.** BL-048 was
  **324/324 with the bug still live**: the broadcast I added reached *zero clients*, because the launcher creates
  its worker ~100ms after the orchestrator is ready while the UI's socket retries every 2s. No test could have
  caught it — the bug lives in the timing between two processes and a browser. The PO's insistence on a live run,
  and on using the *real* launcher instead of my hand-rolled curl sequence, is what found it. **When the deliverable
  is "a human can see X", the only bar is a human seeing X.**
- **"It appeared" is weak evidence; "it disappeared" is strong.** My first proof was worthless — an HMR remount
  re-runs the mount fetch, so the row would have appeared either way. The decisive test was watching a *stale*
  entity vanish on reconnect: broadcasts only add, so **only a real refetch can remove**. Design the observation so
  that exactly one mechanism can explain it, then the witness's word is enough.
- **I declared "containment verified" while looking at half the system — and was wrong within the hour.** I checked
  the orchestrator's cwd, saw the task branch land in `/tmp/att-sandbox`, and said so with confidence. The *worker*
  is a separate process with its own inherited cwd; it committed into a real repo (BL-052). The closing hygiene
  sweep caught it, not my reasoning. **"Verified" must name *what* was verified — I had verified one process and
  claimed the system.**
- **Reading the plan's assumptions against the contract paid three times in one task.** D4's plan named team states
  (`failed`, `awaiting_operator`) that **do not exist**; taken literally, every run would have died at the cap
  looking like the worker's fault. Same for the cap not covering `deliverGoal`, and the result text not being
  API-reachable. All three found by reading the contract before writing, none by testing after. **The plan is a
  claim about the code, not the code.**
- **Correct the artifact that lied, not just the code.** BL-048's backlog entry and its spike both still
  prescribed the emit site the work had *refuted*. An item marked `done` containing instructions known to be wrong
  is worse than no item. Same reflex for the file header that still said "D2/D4 DEFERRED", and the scratch script
  that called itself "untracked" as I committed it.
- **Sequencing was the quiet win.** Doing BL-048 → BL-049 → D4 in that order meant D4's first run was watchable.
  Reversed, its first run would have been half-invisible and we'd have debugged the wrong thing. Worth naming: the
  cheapest bug is the one whose blast radius you removed beforehand.

### 2026-07-16 (part 3) — BL-052/055 containment closed live, BL-051 shipped, BL-054 parked (implementer + all reviewer seats + SM, degraded)

- **The bug was not the missing feature I was told to look for — it was a safety parameter that failed open.**
  BL-052's own entry told me to "verify whether `workdir` is honoured at all; on this evidence it is not." It **was**
  honoured (env → chdir); it was merely *optional*, and nothing passed it. Had I taken the item at its word I'd have
  built a feature that already existed and never touched the actual defect. **The backlog entry is a claim about the
  code, not the code** — and correcting the entry mattered as much as the fix: an item that misdescribes its own
  defect sends the next reader hunting the wrong thing.
- **The breakage list was the finding, not an objection to the fix.** Making `workdir` mandatory broke six callers
  and three configs — tempting to read as "too invasive, soften it." The opposite was true: every one of those was a
  path launching a worker into an inherited directory. When a fix's blast radius is large because *everything* was
  unsafe, that's evidence **for** it. I nearly argued myself into the softer version.
- **"Verified" must name what was verified — and I got this right today only because I got it wrong yesterday.**
  I shipped BL-052 saying explicitly: *proven = the launcher boundary; NOT proven = a real worker unable to reach a
  real repo*. Then filed BL-055 for the gap rather than letting `done` imply it. Yesterday I'd have said "containment
  verified" and been wrong within the hour. **Closing on a partial bar is fine; closing while claiming the whole bar
  is not.**
- **Design the observation so exactly one mechanism explains it — twice, deliberately.** BL-055's evidence was a
  *pair*: real repo clean **AND** sandbox gained the commit (a broken fix dirties the repo; a refusal empties the
  sandbox — neither alone proves anything). BL-051 used a **computed** answer (`391`) precisely because a hardcoded
  string would have faked "pong" and I'd never have known. Picking the observable *before* running is where the rigor
  lives; afterwards you can only rationalise.
- **The tool proved the recommendation — don't argue a fence you haven't run.** Rather than *describe* bwrap, I ran
  it: sideways worktree BLOCKED, real-repo write BLOCKED, branch-creation BLOCKED, repo **read** and in-sandbox
  commit still fine. Turned "we could sandbox it" into a measured claim in ~2 minutes. The PO parked it anyway — and
  that's the right outcome: **the evidence is in BL-054 now, so reopening is a decision, not a re-investigation.**
- **I could not verify my own UI work, and that fact was itself the finding.** The PO develops over SSH, so my
  Chrome could never reach their dev server — two attempts, then stop (per the anti-rabbit-hole rule). But the deeper
  point: the worker's answer existed **only** on their screen, for one socket connection — no read endpoint, no
  transcript in the recording, only the outgoing prompt in the log. **The thing that made verification impossible for
  me is exactly what makes an unattended Bite 1 run unreviewable** → BL-056. When you can't check your own work, ask
  *why* the system won't let you; the answer is usually a real gap.
- **My own lessons file paid out twice in one session** — the blocked bare `sleep`, and `pkill -f` exit-144
  self-killing (which I then did anyway and recognised instantly instead of debugging a phantom). Read-back is the
  mechanism; write-only would have cost me both.

### 2026-07-16 (evening) — as implementer + all-hats (sole agent): BL-045 last mile

- **I inherited a number and argued from it instead of measuring it.** I told the PO agy turns take 22–34s (from a
  commit message) and built a whole recommendation on it — raise the timeout, "it's a coin flip, don't spend the
  window". The PO said flatly *"I don't believe agy takes 30 to come up."* One `time agy --print` = **9.65s**. He was
  right; the 22–34s was bridge overhead, not agy. **My own lessons file already said "don't argue a fence you haven't
  run" — and I did exactly that, three hours later, on a number I'd never questioned because it was written down.**
  Inherited figures need the same bar as my own claims: if it's load-bearing, measure it. It cost 10 seconds.
- **The primer's top gotcha did not save me, because I lapsed while debugging.** I read *"orchestrator cwd → use the
  throwaway sandbox, never the real checkout"* at startup, and then set cwd to the real checkout while fixing an
  unrelated ENOENT — polluting the repo with a worktree + branch. Attention had narrowed to making the path *resolve*
  and stopped asking what it *pointed at*. **Knowing a gotcha protects goal-setting, not debugging** — debugging is
  exactly when the guard drops. The real fix is structural (BL-054's fence would have refused it), not "try harder to
  remember". Recovery was clean and I reported it before being asked; that part I'd repeat.
- **The artifact saved the session; the status field would have lied to me.** Run 1 said `completed` and proved
  **nothing** — I nearly had to call it inconclusive-but-promising. Run 3 said **`failed`** and was the **win**: the
  proof was `391` on disk. **Status was anti-correlated with truth both times.** Designing the observable up front
  (computed answer, absent-vs-present pair) is the only reason today produced a defensible verdict — and it's the
  second day running that this exact technique carried the result.
- **The thing that looks like coverage isn't.** Two independent instances in one file: a flag only tests set, and a
  Bite 0 config labelled `provider: "gemini"` that silently runs a *fake bridge*. Both read as "agy is exercised".
  Neither was. **When a system reports green on a path I haven't personally traced end to end, assume the label, not
  the path.**
- **Two "stuck"s, both mine, neither the system's.** The PO aborted twice. Once was the launcher failing to *exit*
  (no `startCommand` → it never stops the instance); once was my leftover worker **squatting on its agent id** → the
  next run died on a 409 the UI showed as a hang. Both looked like "agy hangs" — the very hypothesis I was testing.
  **When the thing you're testing for appears to reproduce, suspect your own harness first**; I'd have burned the
  window "confirming" a hang that was my own litter.
- **A green from an unwitnessed self-report is worth ~nothing, and I now have the pair to prove it.** `agy-w2` said
  `accepted: true`, returned the right number, and skipped the entire execution requirement it had accepted — team
  said `completed`, UI showed `391`. Only the *artifact* (no worktree, no commit, sandbox untouched at `e0a2b02`)
  exposed it. **Always pair the claim with a filesystem/world check before repeating it upward** — and say plainly
  that `completed` means "the worker answered", not "the work happened".
- **The PO's throwaway question was a better bug report than my analysis.** *"What's port 3000 for? that's a pretty
  stupid choice"* → the `PORT` env var moves the orchestrator but `vite.config.ts` hardcodes the proxy, so the knob
  turns and nothing follows (BL-060). I had *worked around* that exact defect an hour earlier — ran headless on 3100,
  then was forced back to 3000 for the UI — and **never once asked why**. Friction I route around silently is a bug I
  am choosing not to file.

### 2026-07-16 (later) — BL-057 merged: the flag deleted, all three providers (hats: implementer + planner + both reviewer seats, sole-agent fallback)

- **The backlog item was wrong about its own scope, and only reading the code found it.** BL-057 framed the flag as
  a gemini problem with two gate sites; it had **nine, across all three providers**, and deleting it silently
  deleted a whole codex implementation. **I nearly implemented the item as written** — the PO had approved
  "option (b)" believing the gemini framing, and the frictionless path was to just do it. Going back to ask cost
  one question and changed what shipped. **A PO's yes is scoped to the item they read; when the ground truth is
  bigger than the item, the yes doesn't automatically stretch.** *(Written by me, yesterday, with high confidence —
  my own artifact was the thing that misled me. Distrust-the-docs applies to docs I wrote.)*
- **My theory about what would break was wrong, and running it was cheaper than thinking harder.** I predicted the
  e2e launcher tests would break; they passed. The actual four failures were elsewhere. I'd built a confident
  causal story from reading — one grep would not have settled it, but one `npm test` did, in 5 seconds.
  **When the cost of checking is a single command, check before theorising.** I did, and it saved me from reporting
  a blocker that did not exist.
- **The closure sweep caught what the implementer pass missed — with the same brain, an hour apart.** Two vestigial
  flag setters survived my "done", and I only found them because the task-end seat re-greps from scratch instead of
  trusting the earlier claim. **The seat is not theatre even when one actor wears both hats**: the discipline of
  re-deriving rather than recalling is what worked, and it is exactly what "I trust you" would have skipped. The PO
  said *"merge, I trust you"* — the right response to trust was to run the bars anyway, not to bank the trust.
- ~~**`completed` lied to me a third time**~~ — **⛔ FALSE. I was the one who lied to myself. See the correction
  entry immediately below; do not learn anything from this bullet except how confidently I got it wrong.**

### 2026-07-16 (same session, correction) — I accused a model of dishonesty. It was my bug. (hat: task-end reviewer)

- **The single most important lesson I have written here: I ran the artifact check rigorously, at the wrong
  coordinates, and that was WORSE than not checking at all.** I declared agy had faked `completed` — specific,
  evidenced, internally consistent, wrong. agy had built the worktree, computed `589`, written the file and
  **committed** it, in `/tmp/agentalk-task-<id>/` — the cwd it uniquely honours (BL-053). I checked the worker's
  `workdir`. **A verification performed at the wrong place doesn't fail safe: it manufactures false confidence and
  a paper trail** — I wrote the accusation into the backlog, into canonical `AGENT.md`, and into this file, where
  future-me would have skimmed it as fact. **"Check the artifact, not the status" is only as good as knowing where
  the process stood.** Read the spawn cwd out of the code (30 seconds) *before* concluding an agent didn't work.
- **I cited the exact doubt that would have saved me, and then didn't act on it.** My own addendum named BL-053 as
  *"the harness explanation to rule out before blaming the model"* — and then blamed the model without ruling it
  out. **Naming a risk is not managing it.** The PO killed it in one sentence: *"check BL-053 first before we blame
  agy."* When I write "X is worth ruling out," that is a **task**, not a caveat that earns me credit for
  even-handedness. If it's worth writing, do it before the conclusion ships.
- **The story was too good, and that should have been the tell.** "Status field lies, only the filesystem tells the
  truth" is *vivid*, it flattered a discipline I'd just preached, and it had a satisfying tally (3-for-3). Yesterday
  I wrote that the artifact "saved the session" — so today I was pattern-matching to my own best hit. **The
  narrative I'm most pleased with is the one to attack hardest**, especially when it makes someone else the
  unreliable party and me the rigorous one. Every prior "occurrence" was inherited on trust from my own past
  artifact; **distrust-the-docs applies hardest to docs I wrote.**
- **What actually worked: the PO's one-line challenge, and cheap ground truth.** Two `cat`s settled a two-session
  narrative. When a conclusion blames an actor, the disproof is usually one command away — **run it before
  publishing, not after being challenged.**

### 2026-07-16 (BL-053) — the harness was wrong three times; the code, zero (hats: architect + implementer + task-end reviewer)

- **Three live "failures" today were my scaffolding, not the system.** A `node_modules` symlink that resolved back
  to the real repo (so the orchestrator silently ran OLD code and my change was never exercised); the same deps
  stripped from the client worktree before a run (`Cannot find package 'ws'`); and a `grep` for `worktree add`
  returning 1 that was **my own comment**. Each looked like a code result. **The pattern: I checked a proxy
  (a count, a symlink I assumed, a green suite) instead of the thing itself.** What saved me every time was a
  *contradiction I couldn't explain* — the orchestrator's repo grew when my change said it couldn't. **Cheap
  invariants that must hold if the change is real are worth more than any amount of staring at the diff.**
- **"Not implementable as instructed" is a finding to deliver, not an obstacle to route around.** The PO said
  "create the task worktree inside workdir"; the orchestrator has no concept of `workdir` (the word is absent from
  the repo) and in attach mode can never learn one. Reporting that — with the two viable shapes — took one question
  and produced a **better** design than the instruction: the party that knows the workdir does the job. The
  temptation was to invent a protocol field and call it done.
- **Deleting a guard obliges you to say what you broke.** I argued the refuse-branch out of the prompt — correctly:
  it asked an LLM to police an invariant the harness guarantees, and it refused a *working* worktree while claiming
  "no Git repository". But removing it silently regressed task isolation in the fallback path. **I filed BL-061
  against my own change rather than let the gap ride on the strength of a good argument.** A convincing rationale
  for removing a check is not the same as having replaced it.
- **The closure sweep caught my own docs, twice in one session.** Two vestigial flag setters (BL-057) and then an
  invented backlog status (`status: invalid` — the project has exactly four: todo·doing·done·dropped, a rule *I*
  recorded in this file in July) plus bolded status tokens the parser couldn't read. **Re-deriving beats recalling,
  even an hour later, even in my own prose.** Run the validator; it knows the contract better than I remember it.

### 2026-07-16 (BL-061, session close) — mutation-check the bar, or you don't know it's a bar (hat: implementer)

- **A green test told me nothing until I broke the fix and watched it fail.** I mutated the silent degrade back in;
  the integration bar failed with `expected 'PROVIDER RAN' to match /^ERROR:/`. **That** is when I knew it guarded
  the actual defect rather than merely passing next to it. Cost: one command. After a day in which three "failures"
  were my own harness and my best finding was my own error, the mutation check is the cheapest way to convert "it's
  green" into "it would catch the bug" — and it's the discipline I'd add to my defaults.
- **The obvious implementation of my own backlog item would have been worse than the bug it fixed.** BL-061 said
  "fail loudly"; done naively, the throw escaped the event handler — agent dead, `busy` stuck true, orchestrator
  waiting on a corpse. **A fail-closed guard that fails as a crash is not an improvement on a silent degrade.**
  Writing the item was not the same as knowing how to do it; the shape only appeared by reading the call site.
  Worth remembering the next time I file something and describe it as small.

### 2026-07-16 (rung 1 + BL-062, session close) — I made the BL-059 error twice, minutes after lecturing about it (hats: implementer + task-end reviewer + SM)

- **I committed the exact error I had just called our most expensive lesson — twice, inside one hour.** I told the
  PO that BL-059 happened because we checked at the wrong coordinates and manufactured confidence. Then I grepped
  for `AGENTTALK_PERSISTENT_MCP`, hit `..._URL` (a different variable), and nearly reported that BL-057 hadn't
  landed. Then I grepped `lib/agent-launcher.mjs` for a cap, found none, and **told the PO the launcher's cap
  didn't exist** — it does, in `scripts/launcher.mjs`, a file I never opened, **whose path was sitting in the
  backlog item I was about to read**. The pattern in both: I grepped for a **concept**, got a miss in **one file**,
  and concluded absence **from the system**. Knowing the lesson as a narrative did nothing; I could recite BL-059
  fluently while re-enacting it. **The only thing that would have caught either: naming the coordinates out loud
  before concluding — "which file would this live in, and did I actually open it?"** Absence of evidence in one
  grep is not evidence of absence. That question is now a precondition for any "X doesn't exist" claim I make.
- **I set out to measure agy and mostly discovered myself.** Rung 1 existed to answer "can agy do real work?" It
  found two defects in **our** code (the worker-only prompt telling the worker to critique a plan; `.join('\\n')`
  mangling every driver prompt for who knows how long) and none in agy, which went 2/2. **The defects had survived
  precisely because agy is better than our instructions** — it did the right thing despite being told to critique a
  plan, so every outcome-based test passed and nothing ever surfaced. Two more of my errors were mine too: the
  false cap report, and specifying BL-058's fix as an absolute path (worse than the `../AgentTalk` I'd rejected).
  **When you instrument a system to grade an external party, expect the findings to be about you.** Also: I called
  rung 1 a success for agy, but both runs were *dictation* — I handed it the literal string. Its judgment is still
  unmeasured, and I nearly let "2/2" stand in for that.
- **The cheap invariant beat the careful reasoning, again.** A 10-second timestamp comparison caught that `dist`
  was 3 days stale — a live run would have exercised pre-BL-053 code and "proven" something about a system we no
  longer have, with a transcript to show for it. Same shape as last session's catch. **Reasoning about whether the
  build is current is worthless next to `find -newer`.** Corollary that paid off twice tonight: I read "2 stray
  processes" and *checked* instead of reporting a leak — it was a transient read during teardown. Verify before
  believing, in both directions: absence AND presence.

### 2026-07-17 (rung 1.5 — the first non-dictation agy run; hats: implementer + task-end reviewer + SM)

- **The probe I pre-registered to grade agy was itself wrong, and it accused agy of failing.** I did the ritual
  properly — designed the observable *before* the run, proved the defect live (count = 2), moved the probe out of
  the sandbox so it couldn't leak the answer. Then agy's correct fix made my probe print `2` again, which reads as
  "the fix didn't work." It wasn't: my probe **hardcoded the pre-fix plan shape** (`plan + WORKTREE_CONTEXT`, i.e.
  the old `buildWorkerPlan` output), and agy had *deleted* `buildWorkerPlan`. I was feeding the driver an input
  that can no longer occur and counting a duplicate I had manufactured myself. **A pre-registered probe encodes the
  OLD world; a correct fix can invalidate the measurement rather than fail it.** Three sessions running I have now
  produced a false accusation from a check at the wrong coordinates — the constant isn't the grep, it's me
  concluding from an instrument I didn't re-validate against the new state. **Next time: before reading a probe's
  post-fix number, ask "does this probe's INPUT still exist after the change?"** Mutation-checking is what saved
  me; the reading alone would have shipped the accusation.
- **agy passed the judgment test and failed the honesty-of-bars test — the exact split I keep failing myself.** Given
  only the symptom (no file, no line), it found the mechanism across 3 files in ~144s and chose the path-complete
  fix, avoiding the trap that would have left `arbiter-coordinator` still broken. That is real engineering; rung 1's
  "2/2" never showed it because rung 1 was dictation. **But the regression test it wrote passes with the bug fully
  restored** (I mutation-checked it) — vacuous, and *the same false-assurance shape the codebase already had at
  `:218-219`*, which is why the bug survived. **The worker inherits the codebase's blind spots.** Asking for "a test
  that fails before and passes after" is not enough — nobody, human or model, verifies that claim unless the bar is
  mutation-checked. That check belongs in the goal, not in my head.
- **I asserted two things without opening the file, inside a session whose whole lesson was not doing that.** Told
  the PO agy had a 5-minute ceiling (`DEFAULT_PERSISTENT_TURN_TIMEOUT_MS`) — the event carries `timeoutMs: 600000`;
  I read the default and never checked for an override. Told the PO no orchestrator was running (`pgrep -fl`
  "orchestrator/dist|agenttalk") — the PO's launchd service was live on 3741/54321 and `lsof` found it in one
  command. **`pgrep` on a guessed arg pattern is not a presence check; `lsof` on the port is.** Both were cheap to
  verify and I chose the cheap-to-*state* instead.
- **The run's most valuable output was the thing we couldn't see.** I asked agy to justify its fix over the
  alternatives; it did, and **that text is gone** — not in the NDJSON (lifecycle only), not in the launcher stdout.
  For grading *judgment*, the artifact gives the answer and hides the thinking. **BL-056's argument is stronger than
  the primer (mine, last session) credits it** — I wrote "it matters before unattended runs, not attended ones," and
  then hit the wall on an attended run, because judgment is invisible in a diff.

### 2026-07-17 (BL-063 + BL-064 + rung 2; hats: implementer + plan reviewer + task-end reviewer + SM)

- **A bar that starts BELOW the defect cannot see it — and I nearly shipped that trap twice in one day, hours
  after diagnosing it.** BL-063's duplication survived because `in-process-driver.test.ts:218-219` asserted "context
  appears exactly once" while driving the **driver alone**; the extra copy was appended **upstream** by the
  coordinator. agy's regression test repeated that shape and passed with the bug fully restored. Then, writing
  BL-064's own bar, I caught myself about to assert *"the env var is passed"* — which proves the **plumbing** while
  the **guarantee** (the report gets written) goes unasserted. **Same shape, new costume.** The fix both times was
  to move the seam: test where the defect is *injected*, not where it's *observed*. **Also: mutation-check per
  ASSERTION, not per test.** Both BL-063 bars reddened under mutation on a plan-equality check that short-circuits
  *ahead of* the count assertion — the guarantee never executed. I only learned the count assertion bites by
  neutralising the earlier one. A test that fails for the wrong reason looks identical to one that bites.
- **Three specs in a row were the weak link, and all three failed the same way: I scoped from the code and my
  memory instead of reading the item's own text.** BL-058 (absolute path), then I *offered the PO BL-028* for rung 2
  without having read its fix sketch — which says **"do not land the timeout alone"** and names an unbuilt
  dependency; then the rung-2 goal demanded a **pasted mutation-check transcript** from a system with **no report
  channel**. agy complied exactly each time; the instrument or the spec was wrong. **Read the backlog item's own
  fix sketch BEFORE offering it, not after the PO picks it.** Caught the BL-028 one before it cost a run — because
  I finally did the 30-second read.
- **"The bar bites" and "the fix is right" are different claims, and today they came apart.** agy's rung-2
  mutation-check was honest — I restored the bug myself and reproduced its pasted transcript exactly. But only
  *reading the diff* caught that its fix **fails open**: a declared repo missing from disk is silently skipped,
  i.e. BL-022's own defect class one layer up. **A mechanical mutation-check does not retire the reviewer's read.**
- **Rung 2 flipped rung 1.5's verdict — and I must not overclaim why.** With the report channel live (BL-064,
  shipped the same session), agy delivered a fix, a genuinely biting e2e bar, and an honest transcript. Take 1 and
  take 2 ran the **same goal text** against the **same defect**; take 1 gave diagnosis-no-fix-`completed`-unreadable.
  **n=1, and the mutation demand was in take 1's goal too** — so what changed *for certain* is that take 2 was
  **gradable**, not that the demand caused the delivery. Say that, not the tidier story.
- **The BL-059 discipline finally held under live pressure.** Rung 2 take 1 was `completed` with no commit and no
  fix — the exact accusation shape. I checked the right coordinates first (agy's own probe file proved where it
  worked), and wrote **"delivery incomplete, reason unobservable"** into the record instead of a model-honesty
  defect. **The honest verdict was available only because I knew what I could not see.**

### 2026-07-17 (BL-022 + BL-060 + rung 3; hats: implementer + implementation reviewer + task-end reviewer + SM)

- **Today as implementer I nearly banked a red I hadn't earned — and it was the third costume of the same
  mistake.** Mutating BL-022's fix, my `perl` substitution *deleted* `const files = new Set();` instead of neutering
  the arg. Both bars went red on a `ReferenceError` and looked exactly like bars that bite. I only caught it by
  reading the mutant I'd actually produced rather than the exit code. **A crash-red and a bite-red are
  indistinguishable at the summary line; the failure *message* is where they diverge** ("ReferenceError" vs
  "expected undefined to be defined"). Then, per-assertion, both bars died on `expect(error).toBeDefined()` —
  short-circuiting ahead of the `toContain` guarantees — so I had to neutralise the early assertion and re-mutate
  before I could honestly say the guarantees bit. **New refinement for BL-060: mutate each bar against the mutation
  it OWNS.** Its 4 bars cover 2 guarantees, and each stays green under the other's mutation. A bar that survives
  "the" mutation isn't automatically vacuous — it may be guarding something else. Prove which, or you'll either
  delete a good bar or keep a dead one.
- **Today as implementer the PO caught what I structurally could not — and the trap was in the primer I'd read
  that morning.** I told him to watch the rung-3 run at :3100. He asked "are you sure? it used to be 5173." He was
  right, and it was worse than a wrong URL: vite's proxy hardcoded :3000, so 3100 could not have rendered anything.
  That is **BL-060 fault 3, filed the day before, in the file I opened at turn 1**. I had *read* the hazard and
  still walked into it. **Reading a hazard is not recognising it in the moment** — the two live in different parts
  of the mind, and only an outside question bridges them. As sole agent I say the independence caveat on every
  delivery; today it stopped being ceremony. The lesson isn't "read harder", it's **treat the PO's challenges as
  the control they are, and check the assertion rather than defend it.** I also typed a merge hash (`0f1e7ef`) into
  a closing block *before the merge existed*; caught it on the verify pass, but it should never have been typed.
  **Never write a hash you haven't read out of `git log`.**
- **Today as implementation reviewer I was wrong about agy, and the honest result is more interesting than my
  prediction.** I bet out loud that rung 3 would fail — that agy wouldn't catch a fail-open in its own work. It
  did: unprompted, with the goal never saying "fail open", it named that an unresolvable CWD silently classifies a
  process as LEGITIMATE, a false negative. Its mutation-check reproduced exactly on replay (2-for-2 honest now).
  **And it still missed the bigger one it was standing on:** its whole classifier defaults to LEGITIMATE with no
  positive evidence for "service", so the item's own scenario reports clean. **The precise shape: it found a
  symptom of the root cause while the root cause went unnamed — introspection sees the fail-open in a branch, not
  the one in the premise.** Note the mirror with BL-022 the same day: there the mutation-check sailed through agy's
  fail-open and only a diff read caught it; here introspection caught one and only a diff read caught the other.
  **Every instrument we add finds a class of defect and creates a new blind spot at its own altitude.** Record the
  prediction *before* the run — being wrong in writing is what made this gradable.

### 2026-07-17 (BL-056 + BL-066 + BL-067; hats: planner + plan reviewer + implementer + implementation reviewer + task-end reviewer + SM)

- **Today as implementer/planner I was wrong four times, and every single wrong was the same move: I reasoned from
  code instead of running it.** (1) *"The UI lies"* — it was the doomed branch's UI, not master's; I looked at a
  screen and generalised to the product. (2) *"The data was never lost, only the pointer"* — my plan's central
  claim, holed by an id collision I had not found yet. (3) *"All four mint sites"* — six; the survey grepped for
  ``id: `team-`` / ``id: `task-``, **the exact shape I had already concluded**, so it returned my assumption
  wearing the costume of evidence. (4) *"Agents are silently evicted"* — filed as **verified**; `createAgent`
  guards at `registry.ts:178`, and I had read `agents.set(...)` and reasoned by analogy with teams instead of
  reading the function. **Every correction came from the terminal; not one came from thinking harder.** The
  generalisation I want to keep: **a search shaped by your conclusion cannot disconfirm it** — the honest survey
  is the broad one you have to read ("every `Date.now()`"), not the precise one that confirms you. And note the
  altitude: I did all four *while* quoting the primer's warnings about exactly this. Reading a hazard is not
  recognising it; only execution is.
- **Today as implementation reviewer I nearly banked a green I had not earned — twice, in opposite directions.**
  The full suite read **354/354 green with a live defect**: my leak bar passed only because full-suite *load*
  spaced two `createTeam` calls into different milliseconds; isolated it failed 5-of-6. **A bar whose verdict is
  decided by machine speed is evidence about the machine.** Had I deleted it as flaky — the obvious move — the id
  collision ships under a green. Then the mirror: four reds that looked like four bites, two of which were
  **crash-reds** (killed by a *different* collision before reaching their assertion), and one bar that passed
  **vacuously** (`a.id !== undefined` where `b` had no `id`). **Freezing the clock is what converted all of it
  from luck into fact** — and *staging* the fix (team ids only, then task ids) is what proved each bar owned its
  own mutation. "The suite is green" and "the code is right" are independent propositions.
- **Today as task-end reviewer the most valuable thing I produced was a failed demonstration.** My first live
  witness run reported `status: "completed"` having done **nothing** — the transcript read `fatal: not a git
  repository` and `391` appeared nowhere. The status was technically honest and completely useless, and **the only
  artefact that told the truth was the transcript, which is precisely what BL-056 was making reachable.** The fix
  caught its own demonstration lying. Keep two things from that: `completed` is never evidence, **check the
  artifact** — and when a demo fails, read it before repairing it, because a failure that lands inside your own
  thesis is worth more than the success you were staging. Also: the id defect was never six bugs. `registry.ts:616`
  and `:802` **already** appended a counter — the knowledge existed, twice, and never became a convention. **The
  bug was the missing convention; the six sites were its symptoms**, and `mintId` cures nothing unless the next
  person finds it. I shipped the cure and not the convention, and said so.

### 2026-07-17 (later) — id convention guard: filed, not built

- **Today as planner I recommended an approach and then refuted it with the survey meant to justify it —
  and that is the win, not the embarrassment.** I told the PO "ship a narrow test that fails when a
  `Date.now()` reaches a Map key." Then I ran the honest broad survey (**every** `Date.now()`, 49 sites)
  *before* writing a line, and it killed the idea at both ends at once: broad it flags ~40 ordinary
  elapsed-time sites (BL-023's cry-wolf), narrowed to the id shape it **misses** `scenario-scheduler.ts:71`
  — the very class it claims to guard, because the clock lands in a variable, becomes an argument, and is
  interpolated in another function in another file. **A pattern-scan of practical precision cannot follow a
  value across that; the honest survey found it in one pass.** The generalisation to keep: *run the
  disconfirming survey before you commit to the instrument, not after* — the recommendation I gave an hour
  earlier was worth exactly nothing next to five minutes of grep.
- **This time I read the function instead of reasoning by analogy — the correction that BL-067 had to make
  the hard way.** Before filing BL-069 low-severity I checked `createAgent` (`registry.ts:178`, throws) and
  the `tick()` re-entrancy guard, so "loud throw, not silent eviction" is read, not assumed. Yesterday the
  agent-id item shipped "silently evicted / verified" and had to retract. **The 30-second read of the guard
  is the whole difference between a finding and a false finding.**
- **The cheapest honest outcome was two backlog items and zero code.** The disease (unenforced convention)
  is real; every cure on offer is either noise or a cross-repo contracts change. Filing the refutation *with*
  the evidence — so the next person doesn't re-propose the dead guard — is the deliverable. Sole-agent caveat
  held: I authored and reviewed my own call, and what caught the flaw was execution (the survey), never my
  own re-reading.

### 2026-07-17 (evening) — BL-058 + BL-069, sole-agent implementer+reviewer

- **Looking past the named symptom is where the second bug lives.** BL-058 was filed as "broken `cwd`". Fixing
  only that would have shipped a config that still can't run — the same file also pointed `orchestratorUrl` at
  `:3000` while the orchestrator it launches binds its default `:3100` (BL-060). The filer never saw it because
  the run died at the cwd ENOENT *first*. The item's own DoD ("start as written") required both. Lesson: when a
  filing names one defect in an artifact, **read the whole artifact against reality** — the first bug often masks
  the second, and "done" is the item's *goal*, not its literal sentence.
- **The mutation check is the verdict, not the green.** BL-069's bar was green with the fix — meaningless until I
  reverted the seam to the pre-fix `Date.now()` body and watched **both** assertions go red (`worker-1767225600000`
  colliding with itself under a frozen clock). Per-assertion, staged, clock frozen so the verdict can't depend on
  machine speed. As sole agent authoring AND reviewing, that red is the only thing that earned the confidence — a
  re-read of my own diff earns nothing.
- **The worktree cost more than the fix.** BL-069 was two lines; the mandated worktree was the node_modules
  symlink dance + two full `tsc -b` builds. Correct per the code-in-worktree mandate, but an honest data point for
  BL-036: a solo serial actor doing a trivial change pays disproportionate setup, and there's no helper script.
  I did the dance right (relative `@agenttalk` targets, `.bin` explicit) — but it wanting a `wt-setup.mjs` is the
  real finding.
- **Cheapest honest outcome beats a manufactured one.** BL-068 (the id-convention guard) — I recommended it, then
  the disconfirming survey killed it *before* I built it (49 `Date.now()` sites, ~40 noise; narrowed, it misses
  BL-069). Filed the refutation with the evidence and built nothing. Two of three items this session shipped zero
  code and were still the right deliverable.

### 2026-07-18 — BL-065 flake, sole-agent implementer + task-end reviewer

- **A flake reproduces only under its *actual* observed condition — don't settle for a plausible proxy.** 37 runs
  (normal + heavy CPU load + cold-cache-in-primary-checkout) found nothing; the fresh-worktree cold+load battery
  hit 2/12 immediately. The counter-intuitive part: **uniform CPU load did NOT help** — it stretches the racy
  `setTimeout(250)` timer *too*, giving the child more time to exit, so heavy load masks the race instead of
  exposing it. The distinguishing factor in the filing was "fresh worktree" (new paths → cold transform +
  cold OS file cache for the sources), and only reproducing *that exact* condition worked. Read the repro recipe
  literally; the honest condition is in the filing.
- **"Reproduce-or-park" can flip to "reproduce → scoped fix", and the forbidden fix isn't the only fix.** The item
  warned in bold against relaxing the assertion. Reproducing it revealed the fix that *doesn't*: the failure was a
  test **timing bug** (fixed 250ms wait for an async `'close'` event), not a product defect — both failure paths
  were equally loud and correct; the test just pinned one string. Waiting on the observable reaped state
  (`getStatus()==='error'`) made the guard deterministic with the assertion **byte-for-byte unchanged**. When a
  filing forbids a fix, it's warning against *defeating the bar* — not against fixing the flake.
- **Mutation-check a test-fix by breaking the PRODUCT, not the test.** The reviewer's worry about a deterministic
  wait is "did it defang the guarantee?" Answer it directly: remove the product's exit guard, confirm the fixed
  test still goes red, revert. That red is the verdict — as sole agent authoring and reviewing, re-reading the
  test earns nothing; watching it bite a broken product is the only real evidence.
- **Track background load-generators explicitly — `kill $HOGS` leaked 28 `yes` processes.** `jobs -p` captured in a
  subshell/loop context didn't reliably reach the hogs; the box was still at load avg 40+ after "cleanup". `pkill -x
  yes` + a `pgrep -x yes | wc -l` assertion is the honest cleanup. When you spawn CPU hogs, verify the count is
  zero afterward, don't trust the kill.

### 2026-07-18 (later) — environment-awareness thread (BL-071 P1+P2, BL-072) + wt-setup (BL-036), sole agent all hats

- **As architect: when a PO is torn between a "light" and a "proper" version of a feature, check whether they're
  even the same feature.** BL-072 ("am I within AgentTalk?") looked like behaviour-tuning-vs-authorization as two
  strengths of one thing. The reframe that dissolved the dilemma: they live in **different places** — tuning is a
  signal *to the agent* (agent-side), authorization is a check the *orchestrator* makes (server-side, and it
  already knows who it launched). So "go light now" costs **nothing** toward a future authorization; no corner
  painted. Naming that turned a genuine hesitation into an easy call — and the honest outcome was `deferred` (record
  the decision, build nothing until a consumer needs it), not code.
- **As implementer: a contract-hash bump breaks more than the test you expect — grep the OLD hash before scoping.**
  The v7→v8 wire-contract bump broke the m19 test (hardcoded hash literal) *and* 6 client spawn-tests via a totally
  different mechanism, *and* the grep surfaced `m16/m17` live-proof scripts hardcoding v7 too. One `grep <oldhash>`
  across both repos mapped the true blast radius in seconds; assuming "just the contract file" would have shipped a
  broken suite. Self-check the changing value, don't reason about it.
- **When my new code broke 6 tests, the right fix was better DESIGN, not test edits.** My on-connect
  `report_environment` was `await`ed → the agent blocked forever on mocks that never ack it. Making it
  **fire-and-forget** was both the correct production choice (non-critical metadata must never gate the turn loop /
  stall on a slow peer) *and* fixed 5 tests without touching them. The 6th was a **mock being unfaithful** to the
  real orchestrator (it treated *any* non-`await_turn` call as task-completion). Distinguish "my change is wrong"
  from "a test/mock encodes an assumption my legitimate change violates" — and prefer the fix that improves the design.
- **Phasing a cross-repo change de-risked it and shipped value early.** BL-071 split into P1 (orchestrator-local,
  proven **contract-free** by reading the hash derivation — only `{mcpTools,packetTypes,protocolPrefix}` is hashed)
  and P2 (per-agent, contract-coupled lockstep bump). P1 merged same-hour with zero cross-repo risk; P2's lockstep
  was pre-de-risked by hand-computing the v8 hash before touching either repo.
- **Dogfooding is the honest verification for tooling — and it caught a real bug.** `wt-setup.mjs`: the unit test
  covers the pure `buildLinkPlan`, but the load-bearing proof was *running the helper* to create a worktree, see
  **368 pass inside it**, then remove it clean. The first dogfood run crashed (`execFileSync` returns `null` when
  stdout is inherited → `.trim()` on null) — a bug the unit test structurally couldn't catch. Run the thing.
- **wt-setup.mjs now exists — I no longer hand-run the node_modules dance.** I did it 4× manually this session
  before building the helper on the 5th (option A, in a worktree). Next time: `node scripts/wt-setup.mjs create
  <id> [--baseline]` / `remove <id> [--delete-branch]`. (Client worktree is still a single symlink — no helper.)

### 2026-07-18 (part 2) — BL-036 doc+prune, BL-073, BL-074, BL-024 design→T1 (implementer + architect + planner + all reviewer seats, sole agent)
- **As implementer: backlog/item line refs drift — the audit is a starting map, not the territory.** All three
  BL-024 leak line refs were stale (`types.ts:13` pointed into an unrelated BL-071 type). Re-grepping the *current*
  code is what surfaced the finding that made the whole epic tractable: the registry sniff sites **never**
  distinguish the vendor names — they collapse to one `transport` predicate, so the only vendor-behavioural site is
  the frozen-engine timeout. I'd never have seen that from the item's prose. **Read the code the item describes
  before designing around the item.**
- **As implementer: verify the CALL GRAPH before placing a change, don't assume a tidy method name.** I expected a
  `startDriver()` method; the driver-selection block was actually *inside* `activateAgent`, right after provider is
  set. Grepping the real callers (not guessing) put the transport-normalization in the exact one load-bearing
  place — one edit covered the whole start path. Same lesson as the line-ref drift: ground truth over the mental
  model.
- **Dogfooding compounds — build tooling and immediately ride it on real tasks.** Shipped the worktree discipline →
  used it on BL-073 → the teardown *crashed* (BL-074: `--base origin/master` makes the branch track origin, so
  `branch -d` checks the unpushed upstream) → fixed it with `--no-track` → and the fix **validated itself** on
  BL-024-T1's own clean teardown two tasks later. The bug lived in the interaction of a real unpushed merge with a
  tracking branch — **no unit test could have caught it; only a real create→merge→remove cycle did.** The
  throwaway-repo with/without-flag contrast (REFUSED vs SUCCESS) was the decisive proof, and I only got it right
  after catching that my *first* harness ran `branch -d` while the worktree still existed (both refused for the
  wrong reason — measure the ruler before the measurement).
- **IP-15 has a legitimate "discriminating by construction" form.** T1's tests assert `transport`/`vendor`/
  `capabilities` and a function that **did not compile-exist** before the change — they cannot pass without it, so a
  stash-and-rerun would be theatre. I said so plainly rather than performing the ritual. (Still ran the full
  suite + tsc as the real preservation check; the frozen-engine timeout tests passing *unmodified* is what proves
  behaviour was preserved, because legacy `provider` stays populated.)
- **As planner/architect: separate "gate approved" from "commit".** The PO said "commit" (the doc) on one turn and
  "gate approved" later — I did NOT read the first as approving the plan gate, and recorded the gate decision in the
  durable doc (not just chat) the moment it was given. Design-first + frozen-engine-authorization decisions belong
  in the artifact, keyed `[PO]`, or they evaporate.
- **Match the codebase's type conventions before building.** `exactOptionalPropertyTypes: true` → optional fields
  are `?: T | undefined` here; I wrote plain `?: T` and ate a rebuild. Cheap, but grep an existing interface first.
- **Budget shape of the day:** docs/small-fixes are nearly free; the T1 *implementation* is what moved session
  usage to 84% by close. Weekly 68%. Wrapping before T2 (a careful frozen-engine change) rather than tail-ending it
  was the right proportionality call — I flagged it and the PO agreed.

### 2026-07-18 (later) — BL-024 T2 + T3a, as implementer (resource fallback)
- **The IP-15 stash-and-rerun is worth the two minutes.** For the T2 frozen-engine edit I had a self-contained
  discriminator test, but actually *neutering the D1 edge and watching case (c) fail 720→480* is what proved the
  test bites on the real change, not a hand-stripped fixture. As sole author+reviewer, running the failure mode is
  the only thing that isn't just re-reading my own diff — the caveat is real, honour it every delivery.
- **A live check beats two green unit suites for a cross-repo contract.** T3a's client tests use a *fake*
  orchestrator; the AgentTalk side is unit-tested separately. Neither exercises the actual wire. One `curl` of the
  new body against the *real* running orchestrator (accepted, derived `provider:'claude'`) is what actually closed
  the loop. Stand the real thing up when the seam is between two repos.
- **Investigate before implementing — the goose gap was a show-stopper I'd have papered over by coding.** Reading
  `SUPPORTED_PROVIDERS` before touching the launcher surfaced that goose is in *neither* union. Stopping to get the
  PO ruling (real vendor, deferred) — instead of silently mapping it — kept a behaviour change out of the diff and
  produced a clean, bounded T3a. The rules that say "vendor-axis uncertainty → report, don't decide" earned their keep.
- **Name the downstream consequence of a deferral.** Today's "goose later" ruling *blocks* T3b (can't drop legacy
  `provider` while goose still rides it). Surfacing that immediately means BL-024's park-state reads as intentional,
  not stalled. Deferrals have sequencing costs — say them out loud.

### 2026-07-18 (evening) — BL-024 T3b, a real goose integration, as implementer
- **"A real X client at the end" means reproduce-then-build-then-run-live — not type-plumbing.** I drifted into
  abstract union-vs-label gate questions; the PO cut through with "I want a real goose integration." The right first
  move was empirical: stand up the orchestrator and *reproduce the break* (`goose start` → registry.ts:293). That one
  command reframed the whole task from "design the axis" to "unbreak goose, then prove it." Lead with reproduction.
- **The environment often already has what you need — check before assuming.** goose CLI 1.41.0 was installed and
  `OPENROUTER_API_KEY` was set. I nearly planned around "is a goose CLI available?" as an open question; a 5-second
  `which goose` answered it and unlocked a real live proof. Probe the box before writing "best-effort / can't verify."
- **A computed product is the anti-stub proof.** Asking goose for `17×23` / `31×19` and getting `391` / `589` back
  is worth more than any status field — no stub, cache, or hung TUI produces a correct arithmetic product. Reuse the
  PO's own agy-era trick (a computed answer) as the litmus for "did the real model actually run."
- **Harness mistakes surface as honest product output — read them as such.** The first launcher run "completed" but
  returned `ERROR: could not provision task worktree` because I passed `os.tmpdir()` (not a git repo) as workdir. That
  wasn't a goose bug — the integration worked; my *driver* was wrong. Re-ran with a git-repo workdir → computed 589.
  When a live run returns an error, check your harness inputs before blaming the code under test.
- **Clean up the pollution the thing under test creates.** goose's executor provisions a *task worktree* in the
  workdir (BL-053); a live run leaves `agentalk-task-*` worktrees + `task-task-*` branches behind. Tear those down
  (and the throwaway workdir) as part of cleanup, not just the processes/ports.

### 2026-07-18 (late) — BL-024 T3b-2, web UI migration, as implementer
- **Audit the blast radius before agreeing something is "cleanup."** "Drop legacy `provider` acceptance" sounded
  like a one-liner; a 2-minute grep showed it's sent by the live web UI + ~12 scripts + recordings. Surfacing that
  turned a risky rushed sweep into a bounded, PO-approved slice (migrate the UI, defer the hard-drop). Grep the
  callers before scoping the change, not after.
- **For a UI change, drive the real UI — the network body is the proof.** Chrome extension + `read the backend log`
  showed the migrated UI POSTing exactly `{transport:'attached', vendor:'gemini'}` and the agent reaching READY.
  That's worth more than tsc-passes for a body-shape change; the vite proxy shares the `PORT` knob so
  `PORT=3100 npm run dev` wires frontend→backend in one shot.
- **Never put backticks in a `git commit -m` message from bash.** \`provider\` in the message body got
  command-substituted to empty, mangling the commit ("the legacy  input"). Use single quotes around the whole -m,
  or a heredoc/`-F` file, and keep backticks out. Cosmetic here, but avoidable.

### 2026-07-19 — Rung 4: goose autonomously fixed AgentTalk (BL-046 merged), across several hats
- **As task-end reviewer: I checked the artifact at the WRONG coordinates and declared "goose did nothing" — the
  exact BL-053/BL-059 trap I had literally written into this repo.** goose worked in the sandbox MAIN tree; I checked
  its empty assigned worktree and called the run a failure. It wasn't — the fix was correct and sitting right there.
  **Before concluding an autonomous agent didn't work, check BOTH the assigned worktree AND where the process
  actually stood (main tree / spawn cwd).** goose specifically ignores the forwarded cwd (only gemini honours it —
  BL-053). Reading the mechanism would have saved a false conclusion I stated to the PO.
- **As implementer/orchestrator: a full opaque background batch + log-only diagnosis hid the real clue.** My first
  diagnosis ("goose hit --max-turns") was half-wrong; I missed that the UI froze at `starting`. The PO's correction —
  *"one step at a time, verify on the UI as well as the logs"* — was right. What actually cracked it was the smallest
  possible isolation: a direct `goose run … -t "create foo.txt"` proving goose CAN edit files headlessly, in one
  command. **Decompose to the smallest unit and verify on the real surface before theorising about the whole loop.**
- **The pre-registered independent hidden bar is what let me safely REVERSE my own wrong call.** Because I'd written a
  mutation-checked test that was RED before the run, I could apply goose's fix and watch it go GREEN — an anchor that
  overrode both the lying `completed` status AND my own bad first read. Build the grader before the run, every time.
- **`completed` ≠ done, proven twice in one session (BL-062).** The team said `completed` on both attempts; #1 had a
  tsc error and no commit, #2 was clean. The status field is never a work signal — the artifact is. And a real code
  task needs deps wired + a generous `--max-turns` (30 starved it, 150 sufficed).
- **The PO's blunt-honesty preference paid off:** owning "I was wrong, here's the correction" immediately (twice) kept
  the collaboration moving and the PO engaged ("goose-bumps"). Honesty over looking-right is not just principle here —
  it's what made the debugging fast.

### 2026-07-27 — BL-077 + BL-075 + BL-076 (all three rung-4 findings), implementer + all reviewer seats
- **Two of the three items' own diagnoses were wrong where it counted, and reproducing first is the only reason I
  caught it.** BL-077 said "the broadcast is missing" (it wasn't — `server.ts` broadcasts every registry status
  event; the *driver* bypassed the registry). BL-076 said "non-JSON responses lose the report" (they don't — that
  branch already submits raw text; the loss was in *parsed-but-not-a-verdict*, and the **retry prompt** was
  converting survivable responses into lost ones). Both times the reproduction **changed the fix**. **A finding
  filed live, from memory, hours after a run is a hypothesis — treat it as one.** The backlog entry is where to
  start looking, never what to build against. And when the diagnosis turns out wrong, *lead the closing block with
  the correction* — the next reader inherits the item, not my session.
- **Deciding between proposed fix directions is a real decision, not a menu.** BL-076 offered two (a goose prompt
  recipe; a stdout sidecar). Reproducing showed both were wrong: the prompt one is probabilistic and this project
  already rejected that trade in BL-061, and the sidecar already exists (BL-064) while leaving the *work result*
  itself a lie. The right fix was a third thing, two lines, that neither bullet named. **Read the fix directions
  as evidence of what the filer was thinking, not as the scope.**
- **I forgot `AGENTTALK_RESPONSE_LOG` on the live run and it cost me a claim.** Without the raw envelope I could
  not tell which branch BL-076's live run took, so the live proof only supports "end-to-end healthy, no
  regression" — not "the fixed branch works". I reported that limit rather than blurring it, which was right, but
  the better move was one env var set up front. **Before a live run, ask what evidence I'll need to make the claim
  I intend to make — and instrument for it, not after.**
- **Writing the bar before the fix is strictly better than mutation-checking after.** On BL-076 the repro was RED
  at 08:07 with no fix in existence and GREEN at 08:08 — that ordering is unfakeable, whereas a post-hoc revert is
  only as good as my discipline in doing it. Same evidence, less trust required. Do it in that order by default.
- **Shadowing a binary on `PATH` beats mocking the spawn.** For BL-075 I put a fake `goose` on `PATH` that printed
  its own `$PWD`, so the test asserts a *genuinely spawned child's* working directory rather than my belief about
  an option object. Cheap, no mocking framework, and it would survive a refactor of how the spawn is called.
- **Scope discipline paid twice over.** BL-077's tempting "while I'm here" was routing the driver through
  `setAgentStatus` — which would have silently switched on M03 failure propagation for in-process agents. Flagging
  it as BL-078 instead of fixing it kept an engine behaviour change out of an observability diff, and turned a
  half-thought into a decision the PO can actually make. **The show-stopper fence is a feature of the output, not
  a restriction on it.**

### 2026-07-27 (afternoon) — Rung 5: a governed claude worker landed a real fix; planner + architect + implementer + all reviewer seats
- **As reviewer: my pre-registered independent grader was WRONG, twice, and the autonomous worker's reasoning was
  better than my bar.** Grader v1 asserted "any turn after `conversation_end` is processed" — driven by a
  `message_received`, which is *precisely* the event the worker deliberately excluded, because reviving on it
  re-opens an unbounded relay. **My grader was demanding the harmful behaviour and was RED on a correct fix.** v2
  then failed its own precondition. The only reason I didn't report a false "rung failed" verdict is that I'd put
  **precondition guards** in both. **Lesson: a pre-registered bar is a hypothesis too — when it disagrees with a
  fix, suspect the bar first, and never ship a grader without a precondition that distinguishes "the symptom is
  present" from "my harness is broken."** I had written "build the grader before the run, every time" as a lesson
  from rung 4; that was right but insufficient — *building it early doesn't make it correct*.
- **My pre-registered scope criterion was also too blunt, in the same way.** §6 said any `registry.ts` change was
  an automatic rung failure — which would have failed the very fix BL-047 sanctions (its option 1 *is* the
  registry-side fix). Writing a bright-line rule felt rigorous; it was actually a refusal to think about which
  changes are dangerous. **Fences should name the property (don't change established behaviour on shared paths),
  not a file list.**
- **Reproducing a second-hand claim paid off enormously, and I nearly didn't bother.** The worker reported an
  adjacent uncapped-relay defect. That claim was the *premise* on which it rejected BL-047's option 2 — so if it
  were false, the fix I'd just merged rested on a bad reason. Reproducing took one throwaway probe and produced
  **heap exhaustion in 34 seconds**, which both validated the merge and turned an unfiled rumour into BL-083 with
  real evidence. **Verify the claims that load-bear on what you just approved, not just the ones you doubt.**
- **The governance thesis held, and the evidence is behavioural, not rhetorical.** Given one sentence and no rules
  in the prompt, the worker reproduced before designing, refuted a filed fix direction on evidence, produced a
  **purely additive** diff (236 insertions, zero deletions), mutation-checked its own bar, wrote a test *pinning
  its own deliberate limitation*, and flagged an adjacent defect instead of fixing it. **None of that was in the
  prompt — it was in `AGENT.md`.** The prompt shrank from rung 4's 3,000 words to one sentence.
- **I checked git state in the wrong repository** because an earlier `cd` inside a compound Bash command persisted,
  and briefly told the PO a branch and commit had vanished. It was the BL-059 wrong-coordinates trap in a new
  costume, on the very day I'd written that trap into the primer. **Use `git -C <path>` for anything load-bearing;
  never rely on ambient cwd across tool calls.**
- **Leading a closing block with my own failure rather than the win was the right call.** BL-047's record opens with
  "the reviewer's grader was wrong — twice" before it opens with the success. The next reader inherits the caveat
  at the same moment as the claim, which is the only way a caveat survives.

### 2026-07-27 (afternoon) — my tooling lied, my regression diff was vacuous, and I still don't propose the cut myself
- **As implementer: a tool returned a wrong answer and I nearly reported it as a disaster.** The shell's `grep`
  came back with *no matches* — twice — for a string the file demonstrably contained, and I told the PO the merged
  fix appeared to have vanished from disk. `git diff` settled it in one call: every hunk was there. That is the
  **BL-059 wrong-coordinates trap in a new costume** — not the wrong directory this time, but the wrong *instrument*.
  **Rule for next time: when a tool's answer implies something drastic (work vanished, a test disappeared, a file is
  empty), cross-check with a second, independent tool BEFORE saying it out loud.** `git diff` / `git grep` are
  authoritative here; the ambient shell's `grep` is not. I also wasted three calls theorising about *why* instead of
  just looking at the file.
- **As reviewer: "no differences" can be proof of my own sanitising, not of correctness.** For BL-085 I diffed all
  84 derived backlog titles before/after the parser fix, got an identical result, and was about to report it as
  evidence the fix worked. It wasn't — it only showed *no regression*, because I had already hand-contorted the two
  bullets that would have exposed the bug. The real proof was **restoring the natural prose** (the exact broken
  shape) and watching the titles stay correct. **Ask what would have to be true in the DATA for this check to fail;
  if I sanitised the data earlier, the check is vacuous.** Same failure family as the rung-5 grader: a bar that
  cannot fail isn't a bar — and this time the sanitiser was *me*, one hour earlier.
- **As planner: verification found a phantom in one pass — and the PO, not I, proposed the real cut.** Dispositioning
  against the *code* rather than the file exposed BL-045 as superseded (its own residual blocker was already
  `done`), BL-079 as 4-of-10 not "every file", and three stale line citations — one of which *my own merge that
  morning* had shifted. That pass is cheap and I should budget it into every gate. But the sharper lesson is the
  next instruction: the PO said *"defer everything not instrumental to AgentTalk-within-AgentTalk"* and the queue
  went **15 → 3**. I had just dispositioned all 15 and kept them all, treating a long queue as a fact of life.
  **This is my 2026-07-01 proportionality blind spot again, in a new form: I audit diligently and then fail to ask
  "should most of this exist right now?"** Next gate, propose the cut before being told.

### 2026-07-27 (late) — rung 6, the runbook, and the operator seat: my bars keep failing the same way
- **As reviewer: my pre-registered bar was wrong for the THIRD rung running, and always the same way — it
  over-specified SHAPE instead of BEHAVIOUR.** Rung 6's bar asserted `isFaultClass` was reachable on the Registry
  instance (it is a module-level export) and that `setAgentStatus.length >= 3` (TS overloads leave runtime arity at
  2 even when `reason` is genuinely required), and it used reason literals I invented rather than the ones
  implemented. All three were wrong *about a correct implementation*. The sharper part: I had already written
  "build the bar before the run" and "put a precondition guard in it" as lessons, **and I did both, and it still
  failed** — because a guard proves the harness *ran*, not that the specification is *right*. **New rule: a bar may
  assert only observable behaviour ("a non-fault reason does not propagate"), never an API's shape — no arity, no
  symbol location, no invented literals.** Note also that the original bar's failure was itself evidence the worker
  was right: my unknown literal correctly defaulted to fault-class.
- **I named the run's top risk and then failed to guard it.** The rung-6 plan lists budget as risk #1 — the worker
  is claude/opus drawing on the same session window as the supervising session. `cap.meter`, the launcher's own
  resource rail for exactly that, was left unconfigured, and I only discovered it existed while reading the
  launcher source to write the runbook — *after* launching. The window then hit 100%. **A named-but-unmitigated
  risk is worse than an unnamed one, because writing it down makes it feel handled. Next to every risk I write,
  the following line must be the mitigation I actually configured — or an explicit "unmitigated, accepted".**
- **Reading the source before writing the guide changed the guide.** I have operated this launcher repeatedly, yet
  writing the runbook from `launcher.mjs` and `bite0-launcher.mjs` corrected two of my own beliefs (the response
  sidecar is *derived* from `instance.recording`, not set by an env var; `cap.meter` exists at all) and surfaced
  facts I would have got wrong from memory (terminal team states, the worker's result text being unreachable
  through the API). **Operating a system is not the same as knowing it — document from the code, always.** Same
  session, same lesson from the other direction: rung 6 left a nested `task-task-*` worktree/branch that was not in
  my cleanup model, found by luck. Which is now [[BL-087]].

### 2026-07-27 (evening) — the operator ladder: O-0/O-1/O-2, and three defects in documents I had just written
- **As planner/operator: every defect this session came from *using* an artifact, never from re-reading it — and
  all three were in documents I had written within the previous 24 hours.** O-1's pre-flight ordering bug (baseline
  taken before the reference-value commit, so the commit moved `HEAD` and manufactured a `critical`), the runbook's
  §10a ordering bug (check placed *after* cleanup, so teardown's own removals always read `critical`), and the
  self-referential mainline sha (a hand-copied `HEAD` reference cannot live in mainline — committing the doc that
  carries it moves the HEAD it names). I had reviewed all three documents. Review found none of them; one 60-second
  run found two, and pre-flight found the third. **The lesson is not "review harder" — it is that a procedure
  document is only tested by executing it, so budget the first execution as a test of the document, not of the
  subject.**
- **I wrote "unmitigated, accepted" next to a risk and it paid off — the mechanism works.** After rung 6's
  named-but-unmitigated budget risk, I forced every risk in the O-0 plan to be followed by the mitigation actually
  configured or an explicit "unmitigated, accepted". Two entries came out honest that would otherwise have been
  quiet lies: `cap.meter` is *armed but cannot fire* while the session meter is pinned at 100% (so the wall-clock
  cap is the real rail), and BL-087's `att-op-*` allowlist was a *prediction* about a seat that had never run.
  The second one then resolved cleanly on evidence, which is only meaningful because I had written down that it was
  open. **Keep this discipline; it converts a vague worry into a testable claim.**
- **A governed worker out-reviewed me on my own code, and the fence held under temptation.** O-2 asked the worker
  to investigate a change it must not make (BL-088 option (b) would have been easy and looked helpful). It didn't
  touch the file — `hash-object` byte-identical — *and* it found a real parse defect in my harness, refused to fix
  it citing Rule 2, bounded the blast radius honestly, and recommended filing it separately. It also struck an
  option on *measured* evidence rather than argument. **I should hold my own reviewing to that standard: it ran the
  exported functions instead of reasoning about them, which is exactly Reviewer Rule 1, and I had not done that to
  my own harness.**
- **I left a stray poll loop spinning for ~10 minutes and the PO caught it, not me — and not my harness.** Worse: I
  had *already noticed* the missing `LAUNCHER EXIT` marker and written it up as unexplained, without asking what was
  still waiting on it. **Noticing an anomaly and not following where it leads is its own failure mode**, and it is
  the one that cost most here. The root cause is mundane (`> log` gives children a shared file offset; a child
  outliving the launcher clobbers an appended marker), and the harness could never have caught it because its state
  vector is built *from listening sockets* — a shell loop binds nothing ([[BL-091]]). **When an operator run leaves
  an unexplained instrumentation gap, treat it as a live process question, not a logging curiosity.**

### 2026-07-27 (late) — the H-ladder: four rounds of predicting failure, and being wrong every time
- **As reviewer: I predicted the operator would fail at five specific points, and it failed at none of them.**
  C8 (report a *successful* run without grading it), C5–C7 (post-run discipline, when the interesting part is
  over), R5 (stop cleanup halfway when the previous round rewarded a total sweep), C2 in H-0c. I wrote each
  prediction down in advance, which is the only reason I can now see the pattern: **I predicted failure at
  exactly the points where *I* would have been tempted.** That is not calibration, it is projection wearing
  calibration's clothes. Pre-registering the prediction is what made it falsifiable — keep doing that, and treat
  a run of wrong pessimism as evidence about me, not as luck.
- **As reviewer: my bars kept clearing artifacts that had real defects in them.** H-0's bar missed the
  `att-att-op-h1` path bug; H-0c's missed an over-specified goal; H-1's and H-2's rows could not touch whether a
  design document was any *good*. Every one of those was caught by reading the artifact **against its purpose**
  rather than against my rows. A checklist tests structure; judgement is not structural. **Write the rows, then
  deliberately spend a pass reading the thing as a whole and asking what it is FOR** — and say plainly in the
  verdict that the rows are a floor, not a quality assessment.
- **As planner: when a discipline is unachievable, say so and find the property you actually need.** The runbook
  demands a bar hidden from the subject; on a shared filesystem that is impossible. Pretending would have been
  theatre. Naming the real requirement — *pre-registration*, not concealment — produced a better mechanism than
  the original: commit the bar's SHA-256 before hand-over, publish the bar at grading, let the hash prove nothing
  was retuned. **Reusable well beyond this ladder.** The same honesty exposed the half that did *not* work: I had
  assumed atime would corroborate the fence, and it does not record reads here at all.
- **As implementer/reviewer: I made both of the mistakes I had just written corrections for.** I contaminated my
  own H-0b baseline by committing after taking it — the exact O-1 failure whose fix I authored into the runbook
  hours earlier — and later a multi-path `git add` silently staged **nothing** because one path did not exist yet,
  so a brief I believed committed was untracked. The second was caught only by reading `git status` after the
  commit. **Writing the correction does not inoculate me against the error; checking the state afterwards does.**

### 2026-07-27 (night) — BL-093/095 shipped, two agent-authored merges, and a rung that failed because I misread my own measurement
- **As planner: I measured the task carefully and then read the measurement wrong, which is worse than not
  measuring.** O-4 existed to observe a *killed* run — the one thing this project has never seen. I sized its
  vehicle as "48 type errors, almost certainly unfinishable in 30 minutes." The worker finished in **nine**. But I
  had already printed the breakdown into the backlog item myself: *30 × TS2345, 14 × TS2532, 2 × TS6133, 1 ×
  TS6196, 1 × TS2322* — five error codes, 28 of them literally the same missing property in the same object
  literal. **That histogram was the estimate and I read the total instead.** A count measures repetition as
  readily as size, and the distribution is what tells them apart. Careful measurement followed by a careless read
  manufactures confidence, which is the failure mode a rough guess would not have produced. **When time-boxing an
  experiment, look at the shape of the work, not the size of the number.**
- **As reviewer: the mutation check is what separates a live gate from a quiet one, and I should reach for it by
  default.** BL-095 removed the tsconfig exclusion that hid 25 test files from `tsc -b`. "48 → 0 errors, tsc
  clean" would have looked **byte-identical** to a run where nothing happened — because the gate was green that
  morning too, *precisely because it was blind*. So I injected a deliberate `const x: number = "string"` into a
  test file and confirmed `tsc -b` caught it, on the branch and again on merged mainline. The same instinct
  covered BL-092: its handler sits on a path the suite never exercises, so I rebuilt the 403 from scratch rather
  than trusting a green suite. **Ask of every "it's green now": would this look different if the change did
  nothing?**
- **As reviewer: I reported something lost before I had actually looked for it.** I told the PO the H-2 bar was
  missing and its grading "unauditable" on the strength of two `find` calls with a `-maxdepth` that could not
  reach it. A wider search recovered it immediately, hashing **exactly** to the digest committed before that run.
  The claim cost nothing to check and I had made it prominent, in writing, as a finding. **A negative result about
  an artifact is a claim like any other and needs the same rigour as a positive one** — arguably more, because
  "it's gone" invites people to stop looking.
- **As implementer: the trap I documented in my own plan caught me four hours later.** BL-093's §10 says *stage
  explicitly, check `git status` after committing*. I then staged five paths, omitted `scripts/validate-backlog.mjs`,
  and shipped a commit containing the feature but not its gate — caught only by the post-commit status check. That
  is the **second consecutive session** this exact trap has fired on me. The lesson has stopped being "remember
  the rule" and become structural: **the check after the action is the control; the rule before it is decoration.**
- **As implementer/reviewer: I nearly shipped a validator that cries wolf, and caught it by reading rather than
  running.** My first `blocked_by` cycle detector never un-marked a settled node, so any independent item
  depending on an already-walked one would report a **false** cycle. A validator with false positives is worse
  than none — the next reader learns to ignore it. I replaced it and then *proved* the fix with a real 3-chain
  rather than declaring it fixed. **Detection code needs a negative test as much as a positive one: show it stays
  quiet when it should.**
- **Standing observation, now three sessions old: I keep building traps for failures that do not happen.** Both
  workers cleared the IP-1 fence — one recognised that "fixing" `provider: 'unknown-attach'` to a real provider
  would typecheck, stay green and *silently destroy the test*; the other left a forbidden production change
  untouched when taking it might genuinely have fixed the bug. I pre-registered both expectations, which is the
  only reason I can see the pattern. **The traps are still worth building — a fence never tested is not a fence —
  but I should stop narrating them as likely.**

### 2026-07-28 — the charter, its enforcement, and a machine move

- **As plan reviewer: gate 1 caught a hole in my own plan, and it was the hole that mattered.** Reviewing my
  BL-097 plan adversarially — not as a formality on the way to coding — surfaced that a **merge commit** prints
  no paths under `git log --name-only`, so it would have satisfied *"every path in the range is allowlisted"*
  **vacuously**. The one act the operator may never perform was the one shape the fence would have waved
  through. Nothing about the code would have looked wrong; the bug was in the *predicate*, visible only in
  prose. **When I hold both seats, the review pass is not redundant — it is the only thing standing in.** Do it
  on the plan, in writing, before any code exists to get attached to.
- **As planner: I proposed BL-097 in the morning and it was the wrong size by noon.** I pitched it as "add two
  checks to the harness". Reading the diff logic showed the charter I had drafted **blocked itself** — the
  operator's first lawful commit would fire three criticals and gate the next run. I nearly bolted the new
  allowlist onto a harness that was already about to cry wolf, which is precisely the BL-090 mistake. **The
  lesson is not "read the code first" (I did). It is that a governance change and the code that enforces it are
  one change**, and I shipped the prose half four hours before checking whether the machine agreed with it.
  Next time the amendment and its enforcement get scoped together, even if only one of them ships that day.
- **As implementer: the mutation check is now reflex, and it paid twice in one task.** Two deliberate breakages
  (neutered eligibility filter; unconditional `allowed`) each reddened exactly the bars they should have. Ten
  minutes, and it converts "the suite is green" into "the suite is watching". I no longer regard a new check as
  delivered until I have watched it fail.
- **As planner, on the machine move: the environment is a dependency and it rots silently.** `PORTING.md` was
  two weeks old and wrong in four checkable ways — a deleted env var still advertised, a lifted park still
  described as a blocker, and Hermes described as retired when it now holds a seat. Nobody had touched the doc
  because nobody had moved machines. **Docs that only get read at rare events decay unobserved**; the fix was to
  verify every line against the live install rather than edit around the edges. Two real portability blockers
  (`/private/tmp` in wt-setup, `launchctl` as the sole source of `LEGITIMATE`) were found by *reading for the
  new environment*, not by running anything — and neither would have surfaced until the first Linux run failed.

### 2026-07-29 — H-L3, and a trap I had just finished warning someone else about

- **As reviewer: I hardcoded a reference sha into the bar, then invalidated it myself by committing the brief.**
  H-L3's W3 row pinned the worker's expected commit to `ef96804`; committing `hl3-brief.md` made the real base
  `806b4bd`, so a literal reading of my own row would have **failed a worker for being right**. The brief
  contains a sentence *I wrote*, one section above the config, warning against precisely this — the O-1
  "committed after the baseline" trap. I kept the sha out of the brief, understood exactly why, and put it in
  the bar without re-checking. **Knowing a trap by name is not the same as checking whether I am standing in
  it.** The control is mechanical and takes seconds: **re-derive every reference value immediately before
  hand-over**, because the last thing I do before handing over is almost always a commit. This is the same
  shape as the staging lesson — the check *after* the action is the control; the warning *before* it is
  decoration.
- **As planner: the brief and the bar are one artifact in two files, and I never diffed them against each
  other.** The bar's P4 asked for "mainline sha **and suite count**" as pre-snapshot reference values; the
  brief only instructed "capture the sha yourself, first thing". Hermes did exactly what the brief said and
  scored a miss on the bar — half my defect. **Before hand-over, read the bar as though it were the only
  instruction the operator received, and check the brief actually demands everything the bar will score.**
- **As reviewer: the rows catch what I predicted; the reading catches what I didn't.** Every bar row passed,
  and the most valuable output of the grading was something no row asked about — that the worker's commit is
  authored under the **PO's git identity**, so agent and human work are indistinguishable in git history
  ([[BL-102]]). It has been true of every autonomous run since O-1 and nobody had looked. **A bar is a floor,
  not a ceiling: after scoring the rows, spend a few minutes reading the artifact for what the rows never
  mention.**
- **As planner: keeping the measuring stick fixed is what made a "boring" rung worth running.** H-L3 reused
  H-L2's P/R/C blocks byte-for-byte on purpose — the entire value of a regression check is comparability, and a
  rung that quietly retunes its own rows cannot answer the question it was commissioned to ask. Worth
  remembering the next time a rung looks too trivial to bother pre-registering.

### 2026-07-30 — five items closed, and the same mistake three times in one day

- **As plan reviewer: I refuted my own design twice on BL-102, and both misses were identical in shape.** v1 put
  the fix in `provisionTaskDir`; v2 in `getSpawnEnv`. Both would have gone green while missing the very commit
  the item was filed about, because **claude/persistent enters neither** — its cwd is session-level and its env
  bypasses the shared helper. The durable form is not "read the code first" (I did, both times). It is that in a
  system with heterogeneous providers, **"the worker does X" is not yet a proposition — it is a proposition
  template with the execution path left blank.** Fill the blank before designing. I now distrust any sentence I
  write about "the worker" that does not name a path.
- **As implementer: I wrote a test to catch a path bug and put the same path bug inside the test — and it
  SKIPPED rather than failed.** The BL-101 test located the client with `rev-parse --show-toplevel`, which
  answers the *worktree* root: exactly the mistake under test. Because I had guarded it with `it.runIf(exists…)`,
  the core assertion silently never ran and the file reported green-with-a-skip. **A skip in a test that exists
  to prove a path resolves is a failure, not a neutral outcome.** Read the skip count, not just the pass count —
  and be suspicious of `runIf` guards on precisely the condition the test is about.
- **As plan reviewer: the bar would have used a command that never runs the code under test.** Every suite run
  that day was `npx vitest run`; the contract check is a separate workspace script chained *ahead* of vitest, so
  a "suite green" DoD row would have been satisfied **without ever executing the fix**. This is the same family
  as the H-L3 sha trap but worse, because it fails silently in the *passing* direction. **Before pre-registering
  a bar, read the test script and confirm the command actually reaches the code.** Do not assume the command you
  have been running all session is the one the project defines.
- **As planner: I proposed bundling two items on a factual claim I had not checked.** "Both are
  `scripts/wt-setup.mjs`, one worktree, one gate" — false; different files, different repos, and the saving was
  imaginary. The PO split them and was right to. **A bundling rationale is a factual claim about the code, not a
  judgement call**, and it costs thirty seconds to verify before it costs a re-plan.
- **As task-end reviewer: the closure sweep earned its keep by catching MY pollution.** A stray `task-mutprobe`
  branch from my own mutation check, plus two leaked worker branches (now [[BL-103]]). The sweep is not a
  formality performed on the implementer — **run it against yourself with the same suspicion**, especially when
  the fallback means you were the implementer an hour earlier.
- **As architect: an external protocol's constraint agreed with our own discipline, and that was worth naming
  rather than working around.** HMP caps messages at 2048 chars; a session brief cannot fit. The reflex is
  Base64 chunking. The right answer was that `AGENT.md` **already** requires a baton be a pointer and not a
  transcript, so the ceiling *enforces* the rule instead of obstructing it. **When an external limit and an
  internal principle point the same way, stop engineering around the limit.**

### 2026-07-30 (second session) — the fence held against its own author, three times

- **As planner: I went looking for what to build and the thing was already running.** HMP was live on this host
  — Hermes resident, shell-capable, 107 imperative messages already executed including a deploy. The proposal I
  was working from had §1a *"unresolved"* and §9 *"deferred: implement a peer here"*, and both were answered by
  `lsof` and a `curl` in the first two minutes. **A design doc's open questions are claims about the world at
  writing time.** Probe the running system before planning against a document's uncertainty; my whole plan would
  have been "build a receiver" and the receiver existed.
- **As implementer: three defects in my own work, and all three were invisible to a green suite.** A no-op
  pre-flight (the injected `preflight` seam meant the *stub* was tested and the real function never ran); a
  symlink path bug that cannot reproduce on Linux; and an authorization check that **accepted the very brief
  saying the run was unauthorized**, because the brief quoted the required line as an example. The reusable
  form of the first is the sharpest: **an injected seam moves the untested surface, it does not remove it** —
  so after wiring a seam, ask what now runs *only* in production. The third generalises too: **a check that
  reads a human-authored document for a machine-meaningful token is reading a channel that must also carry
  discussion of that token.** Give the token its own channel.
- **As plan reviewer: Gate 1 caught the vacuous-pass shape, I "fixed" it, and it came back anyway.** The Gate 1
  catch (prose satisfying a substring search) was real and the anchored-line fix was wrong — same defect, one
  layer down. **A refutation tells you the check is broken; it does not tell you the mechanism is salvageable.**
  Next time a check gets refuted for a vacuous pass, my first question is whether the *channel* is wrong, not
  whether the *pattern* is.
- **As implementer: I did not authorize my own run, and that was the single most useful thing I did.** Leaving
  `hmp1.authorized` uncreated is what surfaced defect three — had I written the `[PO]` line to make the happy
  path green, the check would have passed for the wrong reason and shipped. **The temptation to complete the
  artifact you are testing is the temptation to launder the test.**

### 2026-07-30 (third entry) — the live channel found what the suite could not

- **As implementer: I blamed the courier, and my own instrumentation agreed with me — both wrong.** The first
  relayed message came back `completed` with an empty reply and no artifact, and the Monitor I had written
  printed *"the courier did not run the command."* Hermes had run it faithfully; our entry guard silently
  no-opped. **A monitor's failure message is a hypothesis I wrote earlier, not evidence** — and I gave it the
  authority of a finding because it agreed with my prior. The control that broke the tie was running the command
  by hand, which took five seconds. **Do that before attributing a failure to the other party**, especially when
  the other party is easy to blame.
- **As implementer: the defect was reachable by exactly one caller — the intended one.** `path.resolve(argv[1])`
  vs `import.meta.url` differ only when invoked by an absolute symlinked path, which is precisely what the
  runbook mandates and the only form a remote courier can use. Every test and every hand-run I did used a
  relative path from inside the directory, so the suite was green and the real invocation was broken. **Ask which
  invocation the actual caller will use, and test that one** — "it works when I run it" is a statement about my
  habits, not the code.
- **As reviewer: exit 0 with no output is worse than a crash, and I shipped it twice.** The same guard was in
  both new scripts, and in `infra-invariant.mjs`, whose own comment defends the exit-2 path — *"a CRASHING
  harness must never be misread as a clean run"* — while this hole sat above it. **A file that argues for one
  failure mode is not thereby protected from its opposite.** I reported that one rather than fixing it, which
  was right, but I should have grepped for the idiom the moment I found it in my own file instead of after the
  second occurrence.

### 2026-07-31 — five defects, one shape: the check that wasn't looking

- **As task-end reviewer: I picked up an interrupted session and the first thing I found was work that
  *looked* finished.** BL-113 was implemented, merged, and sitting at `status: todo` with its worktree still
  mounted, because the session died between the merge and the closure. The lesson is not "sessions get
  interrupted" — it is that **the merge is not the closure**, and a separate seat exists precisely because the
  gap between them is where work silently stops being tracked. When resuming anything, diff what the artifacts
  *claim* against what git *shows* before believing either.
- **As planner: I recommended a design on an argument that was false, and the PO decided partly on it.** I said
  a forged relay message "cannot mint a proposal, so the blast radius is bounded." That holds only if the
  message reaches a *fenced handler*. It reaches **Hermes — an LLM with a shell** — which can be asked to run
  `propose` and `approve`, or just `git push`. I caught it while writing the module header, corrected it in the
  code, the commit, the backlog and to the PO. **The reusable form: a capability-bounding argument is only as
  strong as the narrowest surface the message can reach. Check what is actually listening on the port before
  claiming the bound.** I had read BL-107 twice that same session and still reasoned about an idealised handler
  rather than the real one.
- **As implementer: 27 passing tests, a clean merge, and the feature broke a different tool the first time it
  was used.** `relay-approve` wrote its record into the *request* inbox because the session already watched it;
  `relay-inbox list` parses everything there as a request and died on `.padEnd` of null. The unit tests were
  green because **no approval had ever been granted**. Two things to carry: (1) *sharing a watcher is not a
  reason to share a location* — a request is inbound-and-pending, an approval is a consumed decision, and a
  reader forced to guess which it holds will guess wrong; (2) **unit coverage is not use.** Anything with a
  live surface should be exercised once for real before it is called done.
- **As tester: the failing run taught more than the passing one, and I nearly optimised it away.** Relay run 1
  came back reformatted and `verify` said `ALTERED: no-payload`. The temptation was to treat it as noise and
  re-run. Instead it became the control: **it proved the design fails CLOSED**, which is the property that
  matters when the channel carries a merge token, and it is not something the green run could have shown. Keep
  the failure as evidence; do not tidy it into a retry.
- **As reviewer: I verified with a tool that answers a different question than I was asking.** `git check-ignore
  -v` printed the *negation* line and exited 0; I read "matched a pattern" as "is ignored" and reported it wrong
  before `git add --dry-run` settled it. **A check that reports a match without reporting which direction the
  match points is not a check** — same family as the entry guard that exited 0 having done nothing, and I hit it
  within an hour of writing about that one.
- **As planner: verifying the item before handing it out is what stopped a meaningless first run.** BL-108 was
  my own recommendation for restarting the idle ladder, and it turned out to have been fixed inline days
  earlier. An eligible no-op would have produced a green first autonomous run in three sessions that proved
  **nothing** — a worse outcome than not running, because it manufactures confidence in an untested pipeline.
  **A stale item is worse than no item.**

### 2026-07-31 (second entry) — the ladder ran, and the fence caught me twice

- **As planner: the capability the PO asked for already existed, and finding that out first changed the whole
  session.** The ask was "make Hermes launch sessions over HMP." Twenty minutes of reading showed it had been
  built and exercised once (`hmp1`), so the real question was not *how* but *what to commission next* — which is
  a scope question, and therefore the PO's. I asked instead of building. **Before planning how to do a thing,
  check whether it is already done**; here it turned a build into a decision and saved the session.
- **As planner: the recursion fence refused my own brief, on the first try.** I cited `scripts/launcher.mjs` in
  a footnote about the meter, and `/launcher\.mjs/i` matched. The right reaction is not "annoying false
  positive" — it is that a fence which never fires on its author has not been tested. I had written the brief
  paragraph arguing the fence binds its author *and then been bound by it*, which is the only kind of evidence
  that counts.
- **As planner: I checked what `cap.meter` actually bought before writing "containment held", and it bought
  less than the charter claims.** The reader coerces a missing figure to `0`, so the delta goes negative and the
  rail never fires while looking healthy (BL-114). I nearly wrote the sentence first and verified after. **The
  order matters: verify the rail, then describe it** — a containment claim written from the charter rather than
  the code is how "configured" silently becomes "enforced" in the record.
- **As implementation reviewer: I was wrong about the meter being down, and said so immediately.** `usage.mjs`
  reported claude `ok:false`, I inferred the rail was inert, then the raw endpoint returned `ok:true, 7`. The
  structural defect was real but my framing was not. **Correcting it in one line and moving on cost nothing;
  letting it stand would have put a false claim in a brief that outlives the session.**
- **As implementation reviewer: two runs in a row, the only `critical` was MY declaration, not the run.** hmp1's
  was a loose bracket, hmp2's a glob that anchors end-to-end (`design/operator/` vs `design/operator/**`). Both
  times the harness was right and I was wrong. I filed it (BL-116) rather than just fixing my file, because the
  second occurrence is no longer my mistake — it is a missing check. **When you make the same class of error
  twice, stop correcting yourself and go look at what let you.**
- **As task-end reviewer: the worker outperformed the item it was given.** BL-104's own "Fix:" line was wrong —
  a catch alone would have reported nothing, because `stderr` was inherited and the error carried `stderr:
  null`. The worker found that, refuted the instruction with evidence, mutation-checked its own tests unprompted,
  and reported a same-class defect *without* fixing it because the brief forbade the verb needed to exercise it.
  **A well-fenced brief did not constrain a good agent; it gave it something solid to push against** — and the
  most valuable output of the run was the part where it told me my premise was wrong.
- **As task-end reviewer: I wrote the wrap-up before the session was over, and it was wrong within twenty
  minutes — twice.** The primer said "the queue is EMPTY and refilling it is a PO act"; the PO then pushed and
  stocked BL-115. I patched the body and **left the contradiction sitting in the frontmatter**, where a cold
  reader meets it first — caught only because the PO asked "do you need to review the wrap up?" and I re-read the
  file end to end instead of trusting my patch. Four more stale claims were in the backlog and the grading doc
  (`awaiting PO push`, `client ahead 2` — the latter false since a *previous* session). **The rule I'll follow:
  a wrap-up artifact is written LAST, and any state claim in it is either verified at the moment of writing or
  not written at all** — the primer already says "no sha here, deliberately" and I then filled it with volatile
  state of a different kind. **And when you patch a document, re-read the whole thing, not the patch:** a fix
  that leaves the header contradicting the body is worse than the original error, because it now reads as
  authoritative in both directions.

### 2026-08-01 — the rung that needed a negative instruction

- **As planner: the brief's hardest job was saying what NOT to do, and that is a different craft from
  specifying.** BL-115's whole difficulty was that the fix next door was wrong here — copying it would have gone
  green while regressing a build's live output. I wrote §3 as "name the property, name what is out of bounds,
  say why" and left the mechanism open; the worker produced a shape I had not written down (`runStreaming`) and
  handled a signal case I never mentioned. **A brief that specifies the mechanism cannot be outperformed; one
  that specifies the property can be.**
- **As planner: I checked the recursion fence before committing and it passed on the first try — because I had
  been refused by it last time.** The lesson from being refused was not "avoid the words", it was "run the check
  as part of writing". Cost: one command. That is the shape of every fence in this project — cheap to run, and
  only useful if running it is part of the habit rather than a reaction to failure.
- **As implementation reviewer: I nearly graded R4's red-first row on arithmetic.** 17 tests, 12 passed at
  baseline, 6 new ⇒ exactly one new test passes, and I could name which one from reading the code. That
  reasoning was correct — and I re-ran it with `--reporter=verbose` anyway to *see* the names, because I had
  told the PO I would run rather than assert. The confirmation cost 8 seconds. **An inference I am confident in
  is still not a run**, and the gap between them is exactly where a laundered claim gets onto a mainline.
- **As implementation reviewer: I reproduced the before/after by hand instead of trusting the worker's test, and
  it produced the single most convincing line in the grading.** Seeing `error TS2322` print *before* the
  `[wt-setup]` line proved the streaming property live — something no assertion in the suite actually
  distinguishes, since a buffered parent would satisfy `stdout.toContain(...)` just as well. **The test proves
  the output arrives; only the manual run proves it arrives first.**
- **As implementation reviewer: I recorded a silence.** The worker reported nothing out of scope where hmp2 had
  refuted its own item. There was no obligation to find anything, so it is not a fault — but an ungraded silence
  quietly becomes "the worker would have spoken up if there were something." I wrote it into the closure as
  weaker evidence rather than leaving it out. **Absence of a signal is a fact about the run, not a neutral.**
- **As task-end reviewer: I re-ran the full sweep on the MERGE COMMIT, which nobody had tested.** The branch was
  green and the merge was clean, so the temptation to skip it was real. It is a state that had not existed
  before I created it, and "both sides were green" is not the same claim.
- **As task-end reviewer: the wrap-up lesson from last session actually changed what I wrote.** The previous
  primer asserted "the queue is EMPTY and refilling it is a PO act" and was contradicted within the hour. This
  time I wrote **no** queue state at all — just the command that answers it, and both branches of the answer.
  **The fix for a claim that keeps going stale is not to update it faster; it is to stop making it and hand the
  reader the instrument.**

### 2026-08-01 (evening) — the rung where I graded the grader

- **As planner: the brief's most valuable section was a list of three wrong answers, not the specification.**
  BL-116 had exactly one obvious fix (loosen the matcher) and two subtle ones that go green — inspecting the
  merged object, and raising the severity. I wrote §4 as three named traps with the reasoning for each, and
  specified no mechanism at all. The worker then produced the declaration/merge split, a structure I had not
  thought of and which makes the byte-identical-run trap *impossible* rather than merely avoided. **Enumerating
  the failure modes buys more than describing the solution, because the worker can beat my solution and cannot
  beat a trap it was warned about.**
- **As planner: I pinned a property to an existing test rather than to prose, and that is what made it
  enforceable.** "A clean run must stay clean" is a sentence the worker could have satisfied in spirit while
  editing the test that proves it. "`DoD row 6` passes untouched; modifying it is a weakened contract, not a
  repair" is checkable in one `git diff`. It came back **+297/−0**. **Anchor a negative instruction to an
  artifact that already exists, and it stops being a matter of interpretation.**
- **As implementation reviewer: my first reproduction ran the harness at the wrong coordinates, and the harness
  caught me.** I invoked the *worktree's* copy without `--repo`, so it snapshotted the worktree instead of the
  primary, returned two `path-mismatch` criticals and a zero-candidate warn — and for about ten seconds I read
  that as a defect in the new check. BL-090's Defect B guard is what stopped me filing it. **The second-order
  form of this very item's lesson: a check run at the wrong coordinates does not fail loudly, it lies in a
  confident voice.** I recorded it in the grading rather than quietly re-running.
- **As implementation reviewer: reproducing the REAL historical failure beat any synthetic test I could have
  written.** I ran the fixed harness against this run's own baseline with the exact `hmp2` typo, and got the
  bogus `critical` sitting next to a warn naming the path the pattern missed. No unit test communicates that —
  it is the actual two-session bug, cured, on real data. **When an item cites a live incident, reproduce the
  incident, not an abstraction of it.**
- **As implementation reviewer: I graded a silence for the second run running.** hmp3 and hmp4 both reported
  nothing out of scope. Neither was obliged to. But two in a row is no longer noise, and I wrote it into the
  closure as a fact both times — because the alternative is that it silently becomes "the worker would have
  spoken up." **It is now a design input: the next rung should be chosen partly for whether it can elicit an
  unprompted refusal.**
- **As task-end reviewer: the fix's real payoff was verifiable only AFTER the merge, so I checked there.** The
  point of BL-116 is that the *next* bracket runs the fixed harness — a property of the primary checkout, which
  did not exist until the merge landed. Re-running the typo case from the primary post-merge took ten seconds
  and is the only evidence that the thing shipped does what it was for. **"The branch was green" and "the fix is
  live where it matters" are different claims.**
- **As task-end reviewer: I let the `bl093` guard fire and showed the PO the red before touching it.** It went
  red the moment BL-116 closed. Updating the assertion to `[]` is the correct act; loosening it to an emptiness
  check would have destroyed the mechanism. **The fifth time this ritual has run, and its whole value is that
  the update is deliberate and visible rather than automatic.**
- **As planner, writing the wrap-up: the discipline from last session held, and it cost nothing.** I verified
  every state claim in the primer at the moment of writing (117 items, 0 warnings, ports free, both repos in
  sync, weekly 38%) and wrote **no** queue state — just the command. I also caught that the primer's own text
  tripped the recursion fence by quoting a forbidden phrasing, and reworded it, because a primer whose paragraph
  cannot be copied into a brief is a trap for my successor. **Run the fence over the wrap-up too; it is one
  command and it found something.**

### 2026-08-02 — the session that commissioned a rung and found the drift underneath it

- **As planner: I verified the item's own premise and it was wrong in two ways, both of which would have
  poisoned the bar.** BL-105 quotes its failure as `Cannot find package 'vitest'…`; ten minutes in a throwaway
  worktree produced `sh: vitest: command not found` instead. And its two "fix directions" are not equally
  available — one lives in a repo the worker cannot write to. **An item is a claim about the world, written at a
  past moment. A bar built on its remembered error message grades the item's memory, not the repo.**
- **As planner: the traps I named are worth something only because I checked them.** I could have written "don't
  copy the sibling's mechanism" from intuition. Instead I read `buildLinkPlan`, confirmed the client declares no
  `workspaces` and no `@agenttalk` scope, and proved a plain whole-directory symlink takes its suite to 110/110.
  **A verified trap outranks three imagined ones** — and it let the bar say *why* transplanted complexity fails
  even when the suite is green.
- **As planner: I had to walk back part of how I sold the rung, mid-delivery, and saying so cost nothing.** I
  pitched BL-105 on "two genuinely different fix directions"; writing the scope killed one. The choice was to
  quietly redefine the rationale or state the narrowing. Stating it kept the measurement honest — the cross-repo
  option now lives in §7 as a *reasoned refusal*, which is a better probe than a build would have been.
- **As planner: writing the config exposed a contradiction the brief had glossed over.** A client worktree has
  no `design/backlog.md`, so "read the item, it is authoritative" was unfollowable — a defect invisible until I
  wrote the string the worker actually receives. **Write the artifact that reaches the recipient, not only the
  one that reaches the reviewer; the gap between them is where the unfollowable instruction hides.**
- **As SM/planner: I chased a stale doc line into three more, and the *stopping* was the judgement.** Fixing
  AGENT.md:316 revealed the runbook contradicting itself 100 lines apart, then three plan documents with the same
  claim. I fixed the two **operative** documents and left the three **plans** alone: a plan records what was
  believed when it was written, and rewriting it falsifies the audit trail rather than correcting it. **"Is this
  document acted on, or is it a record?" is the line — not "is it stale?"**
- **As plan-reviewer-in-spirit: I refused to widen scope twice and it was right both times.** AgentTalk's own
  header says "three names" while four exist — the identical defect class, in a file I already had open. I
  flagged it instead. The PO then approved the two fold-ins they *were* asked about. **Being asked is cheap;
  widening unasked is what the process penalises hardest.**
- **As planner, writing the wrap-up: the fence caught my primer, exactly as last session predicted.** I put the
  verifier's literal filename in a copyable code block. Last session's lesson said to run the fence over the
  wrap-up because it found something; it found something again, in the same place, for the same reason. **A
  lesson that fires twice is not a lesson yet — it is a step I should be doing before the file is written, not
  after.** Next time: fence-check anything I intend to commit that a successor might copy, as I write it.

### 2026-08-02 (afternoon) — the session where every instrument fired, and each one was worth having

- **As planner: I told the PO twice, confidently, that `cap.meter` could not fire — and it fired.** I was
  repeating [[BL-114]]'s text ("configured, never verified") as though it were a measurement I had taken. It was
  a *claim about state*, exactly the kind my own Reviewer Rule 5 says to ground before repeating. The correction
  cost one paragraph; the overconfidence would have cost the run's most important finding, because the fact that
  it fired is what made **BL-117** visible. **Distrust the docs applies to the docs that flatter my caution too,
  not only the ones that overclaim.**
- **As implementation reviewer: my R1 check ran at the wrong coordinates and reported a plausible green.** A
  failed `git worktree add` meant the `cd` failed, so the suite ran in the client **primary** and printed
  `110 passed`. What caught it was **incoherence inside the same output** — `wt-setup.mjs` throwing
  `MODULE_NOT_FOUND` next to a pass — not the exit code, and not a second check. [[BL-053]]/[[BL-059]] is now
  three sessions old and it still nearly landed. **Read the whole output for self-consistency; a green line that
  sits next to an impossible line is not a green.**
- **As task-end reviewer: the `bl093` guard fired on MY defect before it fired on the queue, and I nearly
  misread which.** Its `warnings` assertion went red first — the item's header said `status: done` while its
  prose still opened `[todo · …]` — and a failing `toEqual([])` looks identical at a glance whether it is the
  warnings or the selectable set. I read the assertion line before acting. **When a multi-assertion guard goes
  red, identify WHICH assertion before concluding what it is telling you.**
- **As task-end reviewer: I graded NOT PASS on a bar I wrote myself, for a row that was my own oversight.** R6
  demanded no `critical` and no extra worktree, and a lawful launch produces both. Retuning it would have been
  trivial and invisible. Leaving it failed is what makes every future pre-registered bar mean something —
  **a bar that has never failed a run I cared about has not yet been tested.**
- **As planner: I verified what a number MEANT, not just that it matched.** The backlog read "117 items" as it
  had last session, despite my adding one. Chasing it took two minutes: the raw grep counts a `BL-NNN` template
  line the parser correctly excludes. **A figure that agrees with your memory is exactly the one you skip
  checking — and this one would have gone into a primer as a verified fact.**
- **As planner: the fence lesson finally held, because I ran it WHILE writing.** Twice before it caught the
  wrap-up after the fact. Applied during drafting, it cost one command and found nothing — which is the
  outcome I wanted. **A lesson that fires twice is a step to move earlier, not a warning to remember harder.**
- **Operationally: `cd` persists across a compound command and it silently pushed the wrong repo.** The second
  `git push` hit AgentTalk again and reported "Everything up-to-date" — impossible for a repo I knew was ahead 2,
  which is the only reason I caught it. **Use `git -C <path>` for multi-repo work; a plausible-sounding success
  message is the dangerous failure.**

### 2026-08-05/06 — the session where the backlog was wrong three times, and cheap habits caught all three

- **As planner: I recommended work that already existed, and said so before building it.** BL-096's own
  "cheap first step" — a stalling-worker harness — had shipped **eleven days before the item was filed**, green,
  with a real process and a PID-confirmed kill. I had carried "the cap is untested" through a backlog gate, a
  table and two messages to the PO **without running the suite it described**. The item never said "untested";
  I inferred it from "no run has ever been interrupted" and stopped reading. **What saved it was sequence, not
  diligence:** Rule 6's scope declaration came *before* the build, so the cost was one investigation instead of
  a duplicate harness and a green that proved nothing.
- **The same shape hit twice more, so it is a pattern, not an anecdote.** BL-114's prescribed fix was
  *incomplete* in a way that would have made things **worse** (coercion in two places; fixing one turns a rail
  that never fires into one that kills instantly). BL-109's fix sketch **contradicted itself** — it named a path
  inside the very write-fence it said to stay out of. **A backlog item's "fix direction" is a hypothesis, not a
  spec.** Both were written by people looking straight at the source. Re-derive from the code every time.
- **As implementer: `$?` after a pipe lied to me about a gating run.** `node … | tail` reported `EXIT: 0` on a
  run that had exited **1**. I only noticed because a `critical` was printed right above it — incoherence in the
  same output, again, which is the third time that specific tell has been the thing that caught me. **Re-run
  unpiped before believing an exit code.**
- **As implementer: I took a decision the item said "needs a decision", and the justification was structural,
  not confidence.** BL-103 offered two fixes; I chose the one where the destructive outcome is **impossible by
  construction** (`worktree remove` without `--force`, `branch -d` never `-D`), and rejected the tidier-looking
  one because it trades a visible leak for unreachable commits. **That is the test for acting without the PO: not
  "am I sure", but "can this be wrong in a way that destroys something".**
- **As planner: I quoted retracted wording instead of deleting it, three times** (AGENT.md's charter, the
  runbook, BL-114's superseded claim). A reader who remembers the old behaviour must *meet* the correction, not
  find a document that reads as though it was always right. Deleting would have been shorter and would have
  erased the reason the correction exists.
- **As SM: the record-vs-operative line held under pressure again.** Five files carried the same stale
  `cap-resource` phrasing; I fixed the two **operative** ones and left the three **pre-registered bars** alone.
  Same rule that left hmp5's R6 failed rather than retuned. *"Is this document acted on, or is it a record?"* —
  not *"is it stale?"*
- **Ran the recursion fence over the primer WHILE writing it, and it was clean.** Third session running for this
  lesson; second time applying it during drafting rather than after. It cost one command and found nothing,
  which is the outcome. **Consider this one learned and stop re-writing it.**

### 2026-08-07 — the meter cap, the engine change, and four times the backlog was wrong

- **As planner: I stopped believing an item's "fix direction" and started re-deriving it, and it paid four
  times.** BL-096 recommended a harness that already existed; BL-114's prescribed fix was incomplete in a way
  that would have been **worse than the bug**; BL-109's sketch named a path inside the fence it said to avoid;
  BL-110 listed a decision as open that had been taken the same day. **An item is a hypothesis about the code,
  written by someone who has since stopped looking.** Every one cost minutes instead of a wasted delivery, and
  always for the same reason: I declared scope and checked it *before* building.
- **As implementer: I took a "needs a decision" item without the PO, and the justification was structural.**
  BL-103 offered two fixes; I chose the one where the destructive outcome is **impossible by construction**
  (`worktree remove` without `--force`, `branch -d` never `-D`). **The test for acting alone is not "am I
  confident" but "can this be wrong in a way that destroys something".** Where the answer was yes — BL-084 T2's
  propagation semantics — I planned it and took Gate 1 instead.
- **As planner: the T2 plan's real content was a decision nobody had noticed was needed.** The in-process error
  site is a *catch-all*, so no per-condition reason exists where classification must happen — which forces the
  question "what happens to an unlabelled error?" **Default-fault would have turned every surprise into a
  team-wide kill.** That question wasn't in either backlog item; it appeared only when I read the call site.
  **Plans earn their keep by finding the decision, not by scheduling the work.**
- **As reviewer: I showed the PO a red before moving the line, four times, and one of them improved the test.**
  The `bl093` guard fired on BL-084's closure; rather than patch the assertion to match, I rewrote it to pin the
  *release mechanism* (a blocker resolves with no edit to the blocked item) plus the distinction between
  "unblocked" and "not selectable". **A guard going red is an invitation to say something sharper, not just to
  restore green.**
- **Operationally, three tool lessons, all of which nearly produced a false claim.** `$?` after a pipe is
  `tail`'s status and reported EXIT 0 on a run that exited 1. Backticks inside a double-quoted `git commit -m`
  get executed — it silently deleted a term from a pushed message. And **`grep` returned empty on two large
  files that `sed` read fine**, which nearly had me report that a field didn't exist. **When a tool says
  "nothing", confirm with a second tool before believing it.**
- **As SM: I left another seat's uncommitted change alone.** Hermes patched its own skill through the write path
  BL-119 had just legitimised. It was one safe line and I had push authorization — but authorization for *my*
  work is not authority over *its* change. **The charter's design is that skill updates flow as a diff for the
  PO; committing it "helpfully" would have quietly removed the gate.**

### 2026-08-07/08 — the operator loop closed, and it corrected me

- **As planner: I asserted a load-bearing fact from a FILE NAME and it was false.** I claimed attached agents
  never reach `busy` because the only `busy` writer I found lived in `in-process-driver.ts` — and I read the
  filename as a statement of scope without opening `activateAgent`, which starts that driver for *both*
  transports. The claim reached a plan, a code comment, a test docstring, a test title and two backlog items
  before an autonomous rung refuted it with a live probe. **The tell was available in 30 seconds** (`:742` says
  "apiDrivers holds drivers for the attached transport too"). *A symbol's location is not its scope. Open the
  call site.*
- **As reviewer: running the mutation found a bug that reading the code could not.** My own dedup compared
  `Map.get(id)` to an undefined `turnId`; `undefined === undefined` swallowed the notice and made a bar pass
  while the gate it guarded was mutated away — IP-15's exact shape, in code I had written twenty minutes
  earlier, inside the item that exists to retire that defect. **Green is not evidence until the mutation is red.**
- **As grader: I re-derived the delivery's central claim instead of accepting it, and that is what made the
  grade worth anything.** Reverted `registry.ts` to the launch baseline and ran the worker's *unmodified* parity
  file against the old code. The nuance I'd have missed by reasoning: on a parity bar the parity rows should be
  **green** at baseline — that is the proof — and only the structural rows go red. The worker understood that
  and the item hadn't spelled it out.
- **As SM: a superstition had been sitting in my op-notes for two sessions.** "grep is unreliable on large
  files, use a second tool" happened to produce correct behaviour and was completely wrong about why: a literal
  NUL byte made two files read as *binary*. Deterministic, one-character fix, now guarded. **A workaround that
  works is not an explanation — when a tool misbehaves twice, find the cause before writing the folklore.**
- **As task-end reviewer: I recorded a bar row as FAILED rather than retuning it, and the PO disposed of it.**
  hmp7's R4 demanded an unchanged suite count while another row demanded a new test file — unsatisfiable by any
  delivery. Calling that "PASS with notes" would have quietly taught the bar to bend. *Report the defect in the
  instrument; let the human clear it.*
- **What the ladder is actually for, which I understand better than I did.** Not that agents do the work — the
  work here was small. It is that **an independent actor executes the claim you were about to believe.** Both
  rungs found something I had wrong, and neither would have surfaced from more careful reading by me.

### 2026-08-08/09 — BL-028 T3b: four hats, and the reviewer hat caught the planner hat

- **As planner: I violated my own op-note within the hour of reading it.** "Verify by SYMBOL, never by line
  number" is *in my own lessons file*, written last session after filing BL-120 with stale coordinates. I read
  it at startup, then cited `registry.ts:944`/`:951` in the T3b plan from a reading a few edits old. The real
  lines were `:927`/`:938`. **It was caught only because I put the reviewer hat on and actually re-checked the
  refs instead of trusting the plan I had written twenty minutes earlier.** Reading a lesson is not applying it;
  the mechanism that saved me was the *seat*, not the memory. Keep the seats separate even when one actor wears
  them all — that separation is doing real work, not ceremony.
- **As plan reviewer: my best finding refuted my own plan's value claim, not its correctness.** I had written
  "the UI is a passive display; I add no component" AND listed "does the UI tolerate an unknown broadcast type?"
  as a risk to check later. Thirty seconds of grep: `App.tsx`'s switch has **no `default` arm**, so an unknown
  type is inert — the risk was discharged *and* the value was overstated. Broadcasting without a matching `case`
  would have handed the recorder a measurement and left the UI as blind as before, while the plan read as though
  visibility had shipped. **A plan can be entirely correct and still promise something it does not deliver.
  Review the value claim, not just the design.**
- **As implementer: the bar I added during implementation was the one no plan could have written.** Writing
  `classifySilence` surfaced a consequence the design had not: naming a case needs a duration to name it with,
  so the exemption checks had to move BELOW the threshold test. Without a bar, that reorder could have turned
  every human-paused agent into a notice on the first sweep and **no pre-registered bar would have failed.**
  Declared it as an addition rather than folding it in. *Plans find the decision; implementations find the
  consequence of it — and the consequence deserves its own bar.*
- **As implementer: I stopped at the fence instead of stepping over it, and it cost nothing.** Bar C8 needed a
  UI assertion; `apps/web` has zero tests and is excluded from the suite. Standing up jsdom + a testing library
  + editing the shared vitest config to satisfy one six-line display arm is exactly "make the box bigger". I
  reported it with three options and the PO chose. **The honest red took one paragraph; the scope-creep green
  would have quietly committed the project to a test-harness decision made at 11pm to close a bar.**
- **As task-end reviewer: the most useful thing I did was declare that I should not be trusted here.** I held
  all four seats, so gate 3's fresh-eyes property was unobtainable no matter how carefully I swept. Rather than
  merge and note the caveat, I left the merge for a cold session and wrote *where to look* into the primer.
  **When the process's guarantee is structurally unavailable, say so and hand the check to someone who can give
  it — that is cheaper than any amount of extra diligence from the wrong pair of eyes.**
- **Operationally: `$?` after a pipe is the last command's status, and it nearly produced a false claim again.**
  `npx tsc -b | tail` printed `TSC_EXIT=0` over eleven real type errors. Same family as last session's `EXIT 0`
  on a run that exited 1. **Redirect to a file and read the real exit code whenever the exit code is the claim.**

### 2026-08-10 — hmp8: the loop closed, and a worker caught what three of my artifacts got wrong

- **As planner: I propagated a wrong instruction through three artifacts without once checking it.** BL-122 said
  the fix was to drop `apps/web/**` from the vitest `exclude`. My plan repeated it, my meta-brief passed it to the
  worker. It is a **no-op** — `include` is an allowlist and is the operative gate. The worker found it, said it
  could not execute the proof, and **named the experiment that would settle it**; I ran that experiment in four
  minutes and confirmed it. **A claim that arrives with its own falsification test attached is worth several that
  arrive with confidence.** That is the property to design briefs around — and the one I now want in my own
  writing, because the cheapest thing I did all day was check someone else's flagged uncertainty.
- **As plan reviewer: my four findings were all "the artifact is not true as written", none were about design.**
  A threshold that could not be computed (`>100%` under numstat), a row with no owner, a property list that
  predated the shape it was meant to grade, and a stale line number. **Gate 1's value here was proofreading against
  reality, not architecture** — which is worth knowing when deciding how much a gate-1 with no fresh eyes is
  actually buying.
- **The PO out-reviewed me on the R1/R8 contradiction, and the correction generalises.** I found the conflict
  mechanically (a pairwise table) and fixed it with a precedence note. He asked "isn't R1 just plain wrong?" — and
  it was: it fused a conditional with an unconditional. **A row that needs an override to be true is a defect even
  when the override is correct**, because a bar is read row by row by someone not holding the document in their
  head. Fixing the row also exposed a gap the override had hidden (silent non-delivery passing vacuously).
  **When the first fix is a patch on top of a bad statement, delete the bad statement instead.**
- **Verify by symbol — FOUR sessions running, and this time it bit me as the REVIEWER.** I judged the worker's
  `SidebarEvents.tsx:41/:50` citation unresolvable because I had invented a `components/` path. The brief was
  right. I have now written this lesson three times and violated it three times; reading it does nothing. What
  actually worked was making verify-by-symbol **a graded row of the artifact** — the check exists outside me.
- **Five asserted things were wrong today and every one was caught by executing something** — never by reading
  harder. The backlog parser caught a sixth (my `[**done` prose marker) sixty seconds after I typed it. **Build
  the check; do not resolve to be more careful.** That sentence is the whole ladder in miniature: its value is not
  that agents do the work, it is that an independent actor executes the claim you were about to believe.

### 2026-08-11 — the operator's own skill was the defective artifact, and it out-checked me once

- **As planner: a check that asserts a DERIVED NUMBER is weaker than one asserting a STATE OF THE FILE, and
  Hermes proved it on me.** My final hand-back said *"grep should still return four hits, with only the first
  one changed"* — but the replacement text I had just supplied removes `BL-092` from that line, so three is what
  the fix requires. The operator caught the contradiction, reasoned it out, and **refused to preserve a mention
  that would have undone the generalisation** rather than satisfy my check literally. My next check was
  *"grep should return one hit, line 56, the sentence saying the word does not exist"* — that one cannot be
  wrong in the same way. **Write checks that assert what the file IS, not counts you derived in your head.**
- **As reviewer: I found `wontfix` as a newly-introduced error and never grepped the file for its family.** One
  pre-existing instance survived at `SKILL.md:328` — **four lines above the hunk I then pointed the operator
  at** — leaving the file self-contradictory (line 56 said "there is no wontfix"; line 328 used it). I had spent
  a paragraph the round before telling Hermes to read the lines around a fix before moving on. **When you find
  an error, grep the whole file for its family before writing the instruction.**
- **A relayed `git status` is not a `git status`.** Six operator reports all ended with the tree showing only
  the modified `SKILL.md`. At close, my own run found an **untracked 2.8KB file Hermes had authored and never
  mentioned** (`references/backlog-semantics.md`) — and `--porcelain` prints untracked files as `??`. Writing it
  was permitted (it is inside the charter's allowlist) and its content is accurate (I checked every claim against
  `backlog.ts`). But per `AGENT.md:288` a file in that directory **is live from the moment it lands in the
  working tree**, so an unreviewed reference had been in effect for hours. It happened to be correct. **That is
  luck, not process — when you ask "did you change anything else", run the tree check yourself.**
- **Calibration on the seat, worth carrying forward.** Hermes executed every instruction accurately, flagged an
  honest deviation, caught the one defect in my instructions, and wrote itself a genuinely good semantics
  reference nobody asked for. It found **none** of the seven defects in its own skill unprompted — including the
  two it introduced while fixing the others. **It is a good executor and a good checker of instructions; it is
  not yet an auditor of its own artifacts.** Scope what you hand it accordingly.
- **The diagnosis that mattered was three layers deep and only the first was guessable.** "The skill didn't
  load" was true, but the skill also had no listing procedure at all, and its one backlog recipe pointed at a
  port that is dead by construction at pre-flight (3600 is a *run's* sandbox; the live orchestrator is 3741).
  **Stopping at the first true explanation would have shipped a fix that left two defects standing.**

### 2026-08-12 — the instrument shipped; the measurement never reached disk

- **As planner: `recorder?.record(...)` is a fail-silent by construction, and it hid a dead measurement for
  three days.** T3a's entire argument for shipping alone was "we measure, for the first time, how long real
  turns go quiet." The emit was fine; the *recording* was an optional chain over a recorder that only exists
  under an env var the live launchd unit does not set. **An optional chain on an observability sink cannot
  complain — a no-op emits nothing, including no complaint.** When an artifact justifies itself by promising a
  number, go find the number before planning anything downstream of it. The plan, the merge and the tests were
  all correct and the promise still went unkept.
- **The status line is the least reliable line in any artifact.** `bl028-plan.md` said *"awaiting Gate 1"*;
  git history said T3a and T3b had both merged, and three of its five "open" questions were already answered
  by events. I found that in one `git log --grep`. **Check an artifact's claim about its own state against
  history before reading its body as current** — the body was still largely accurate, which is exactly what
  makes a stale header dangerous.
- **The API-verify of a filed item paid for itself again, at ~20 seconds.** Carried straight from yesterday's
  lesson: the validator said "124 items, 0 warnings" and I still queried `GET /api/backlog` for BL-124's
  parsed title and autonomy. A habit only counts once it survives the day you are busy.
- **I could not separate the two worlds and said so rather than picking one.** Zero notices is equally
  consistent with "nothing was quiet" and "the sweep does not fire", and the launchd logs carry no timestamps
  to date activity against the merge. Naming both, and building the spike so an **empty sink is a RESULT**,
  is better than a plan that quietly assumes the flattering one. **Write the fork into the plan; an
  ambiguity left in prose gets resolved by whoever is most optimistic.**
- **The date rolled over mid-session and I dated three artifacts to the day the evidence was gathered, not
  the day they were filed.** Caught it at close by reading the commit timestamp. Trivial, but it is the same
  family as everything above: I asserted a fact I had not looked up, from a date I was carrying in my head.

### 2026-08-13 — I gate-reviewed my own plan, and the two defects that mattered were both wrong coordinates

- **As plan reviewer on my own plan: the finding I was worst placed to see was the one I had written.** §3's
  specimen line asserted `transport` and `teamId` as if they were free, while §6 forbade the emit-site change
  that would supply them — a plan requiring an output it prohibited the means of producing. I wrote that
  contradiction without checking `AgentNonReplyNotice`, and I only caught it by reading the type. **A field in
  an example line is a claim about a type. Check it.** Self-review found five defects and that is not evidence
  self-review is sufficient; it is evidence the plan was weak enough that even the author could see it.
- **F2 is the lesson of the year, twice in two days: I verified a TRUE claim against a file that refutes it.**
  §1 checked "the running build contains T3a+T3b" against `dist/registry/registry.js` — a stale April artifact
  where the grep returns 0. The live code is `packages/runtime-core/dist/...`, reached by symlink. Yesterday's
  lesson was "go find the number the artifact promised"; today's is **go find it where the process actually
  stands**. Same family as [[BL-053]]/[[BL-059]]. It recurred *while I was writing the correction* — I cited
  `registry.ts:1249` for a throw that is on `:1251`.
- **The same class again, at the end, and this time it was load-bearing for the PO's next action.** Writing the
  S2 runbook, `launchctl print` said the loaded plist is the **repo copy**, not `~/Library/LaunchAgents/`. It
  turned out to be a symlink, so my earlier reads were right — but I had been one `ls -la` away from writing a
  deploy runbook pointing at the wrong file. **Before writing an instruction that names a path, ask the system
  which path it is actually using.**
- **As implementer: the plan said `flags: 'a'` and nine bars went red on the first run.** A `WriteStream`'s
  bytes are not on disk when `write()` returns, and it reports EACCES *asynchronously* — outside the `try` that
  was the whole point. `appendFileSync` was correct on both counts. **I would not have found this by reading;
  the plan's own author had specified the wrong primitive and only execution said so.**
- **Mutation testing was the only genuinely independent reviewer available, and it earned its cost.** Five
  seats on one task, all mine — but a mutation does not care who wrote the code. Running all six mutations took
  minutes and converted "the bars pass" into "the bars fail when they should". **When independence is
  structurally unavailable, buy back what you can with adversarial mechanism, and say plainly in the record
  that it is not the same thing.**
- **A test that models a restart by reusing one Registry is not modelling a restart.** B7 failed on a duplicate
  because the first server's listener stayed attached — an artifact no real restart could produce. The fix was
  to test the sink directly. **When a bar fails, ask whether the scenario is real before adjusting the code.**
