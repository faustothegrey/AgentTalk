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
- **`completed` lied to me a third time, and I had pre-committed to not believing it.** Run 2: `accepted: true`,
  correct 589, exit 0, **no file, no worktree, no commit**. Because I designed the observable *before* the run
  (fresh number, fresh path, verified absent), the lie was visible in one `cat`. **Even a correct answer in the
  payload proves nothing** — that's new, and worse than I'd internalised: I'd been treating "reported the right
  number" as partial evidence. It isn't. Only the filesystem is.
