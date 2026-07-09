# Lessons learned — Codex (role: planner-reviewer)

**What this is.** Codex's own append-only, dated record of lessons that sharpen its effectiveness over time —
**self-authored, per-agent** ("each its own"). Written at **session close** (when you write the Session Primer, or
otherwise wrap a working session); **skimmed at session start** so it actually compounds (write-only rots).

**Discipline.** Brief — **1–3 bullets per entry** (what worked / what didn't / what I'll do differently). Append-only,
newest at the bottom. This is *self-reflection on how I work* — distinct from `logbook.md` (shared cross-cutting
**facts**) and `implementer-pitfalls.md` (reviewer-authored case law about the **implementer**). **Only Codex writes
here.**

**Format:** `### YYYY-MM-DD — <one-line theme>` then 1–3 bullets.

---

### 2026-06-27 — Cold-start verification before baton
- The primer was slightly stale about the latest commit/ahead count; checking git before acting caught it without
  derailing the task.
- When reviewing governance docs, grep for numeric wording like "three duties" after adding a new duty; these are
  easy drift points even when the canonical rule is right.
- For Gemini handoff, write the approved scope into the role-primer and plan instead of relying on chat-only go/no-go.

### 2026-06-28 — Refresh consumed primer keys before stopping
- If I consume a fresh role-primer key but the user wants to stop immediately, mint a replacement primer key before
  closing so the next session still has a real cold-start handoff.
- Keep the refresh minimal and factual: update only the primer/own lessons, and preserve the active assignment
  without sliding into the underlying planning work.

### 2026-06-29 — Spike review and backlog status discipline
- When a backlog item has conflicting status text, privilege the most recent explicit human correction and the gate
  table over stale "selected next" wording; record the corrected disposition before planning further work.
- For exploratory spikes, keep the plan/document as the artifact and make the DoD reviewable without implying a code
  implementation; this fit the protocol-state-event unification question better than opening an epic.
- In review, verify both hook layers separately: immediate engine hooks (`onPhaseChange`/`onProtocolEvent`) and
  registry-level consumers (`team_planning_phase`/`team_protocol_event`) can have different "consumer" meanings.

### 2026-06-30 — Dual-role gate discipline under fallback
- As planner, leave no gate-level implementation decision open inside an approved plan; reviewer-me caught the T3
  API naming ambiguity only because I re-read the plan adversarially instead of rubber-stamping my own draft.
- As reviewer, check pollution beyond `git status`: ignored directories and worktrees can look suspicious, so verify
  timestamps/ignored state before calling them task pollution.
- When asked for a re-check after an existing VERIFIED ledger entry, append fresh evidence rather than relying on the
  previous verdict; it preserves the audit trail without pretending the old run is today's run.

### 2026-07-01 — Planner ideation capture
- As planner, when giving a POV on an architect/PO direction draft, keep it explicitly advisory and separate from
  gate-approved planning; this lets the idea mature without accidentally opening implementation scope.
- When closing after a side-track ideation update, the primer should preserve the real active epic pointer and call
  out that the ideation artifact opens no work by itself.

### 2026-07-02 — M15 dual-role closure and independent review
- As temporary implementer + reviewer, a green self-review still missed a narrow composition regression; when I hold
  multiple hats, I need to add adversarial tests for every sibling guard, not only the path I just fixed.
- As Scrum Master, keeping Claude's refutation intact and adding a follow-up fix record below it made the audit trail
  cleaner than rewriting the earlier verdict.
- Verification commands that allocate worker task worktrees need an immediate pollution check; identity `--check`
  can leave cleanup work even when it passes.

### 2026-07-08 — M16 live-proof review discipline
- For live attach proofs, verify the proof artifact and the harness lifecycle separately: a script can print PASS
  while still leaking client handles or relying on an operator-owned process.
- When a branch carries stale plan/status docs from an earlier scope amendment, fix the audit drift before closure;
  otherwise the diff stat and touched-file claim become less trustworthy than the code.
- Keep behavior changes out of proof harness support when possible: moving MCP provider selection into the proof
  script preserved the existing agent-creation API while still making the live proof deterministic.

### 2026-07-09 — M17 proof evidence must be run-bound
- A live proof is not proven by a committed NDJSON file unless the success predicate is tied to the current run;
  include a negative check such as "server has no recorder configured" to catch stale-evidence false positives.
- For authority metadata, verify the canonical vocabulary separately from role enforcement: a structurally accepted
  event can still be a bad proof if it smuggles a non-canonical tag like a reviewer origin tag.
- When reviewing proof-support code, scan for unrelated API response drift even if the main behavior passes; a
  proof helper can accidentally change product surface outside the task fence.
