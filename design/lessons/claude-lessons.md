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
