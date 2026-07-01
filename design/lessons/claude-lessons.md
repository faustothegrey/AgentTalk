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
