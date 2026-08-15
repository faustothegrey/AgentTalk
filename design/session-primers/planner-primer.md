---
role: planner
key: 20260815-2312-a4f9d2
written: 2026-08-15 by Claude at session close — the PO declared the project collapsing under its own
  weight and opened a DEEP OVERHAUL. Waves 0 and 1 are MERGED AND PUSHED. Wave 2 is filed as
  [[BL-144]] and is the judgment-heavy remainder — it needs you. Everything below was checked against
  the repo at close; check it again yourself.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy /
goose) as one software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`,
and coordinate through a planner→implementer→reviewer workflow under a human Product Owner. Stated
overarching goal, restated by the PO this session: **automated development of some sort.**

**Roles.** Human = PO (Fausto): scope, direction, merges, pushes. Bindings live ONLY in `AGENT.md →
📌 DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared
UNAVAILABLE, so you are almost certainly the sole agent under the **resource-scarcity fallback**:
wear every hat, handshake once per role, declare all of them, keep each gate's discipline separately.

## ⚠️ Read this before anything else: the PO's standing grant

The PO said, verbatim: *"go ahead full steam. Stop only when you need my opinion not a ceremonial
allowance. I pre approve all commit and merges and push. This is no normal development phase but a
deep overhaul. In my discernment, no way to avoid it and no way to go back."*

**That grant is real and it is narrow in one specific way: it removes the PERMISSION step, not the
VERIFICATION step.** What kept it safe this session was that every wave carried its own *mechanical*
proof. **With the gates relaxed, the bars get stricter, not looser.** If you cannot state a
conservation property your change preserves, you are not ready to use the grant.

The grant is the PO's and can be withdrawn by the PO. Do not extend it by analogy to anything else —
it does not touch `autonomy`/workable→launchable, and it does not make you the PO.

## The state — verified at close, check it anyway

Clean on `master` at **`2cfcc00`**, **pushed** (0 ahead / 0 behind). No worktrees but the primary.
Suite **825 / 96 files**, `tsc -b` 0, backlog **144 items / 0 warnings**, `docs:check` **780 citations
/ 0 newly broken / 69 carried**. Ask the instruments:

```
git log --oneline -1 && git status --short
npx tsc -b && npx vitest run                     # expect 825 / 96
node scripts/validate-backlog.mjs                # expect 144 / 0
npm run docs:check                               # expect 780 / 0 newly broken / 69 carried
node -e 'const{readBacklog,workableBacklogItems}=require("./apps/orchestrator/dist/backlog.js");
         console.log(workableBacklogItems(readBacklog().items).map(i=>i.id))'
```

## What happened this session

**[[BL-134]] reviewed, merged, pushed, closed** (`5f8f068`). `autonomy` no longer gates the backlog;
`selectable` → `workable` everywhere including the wire param. Gate 2 found one real defect — a live
doc in the operator's own skill named `?selectable=true`, which `server.ts:258` no longer reads, so
it returned the **open queue at HTTP 200**. Fixed under the Rule 6 zero-risk exception.

**Wave 0 — evict episodic records** (`0b8bee5`). `design/` 143 → **53** top-level files; 91 records to
`design/archive/`; 8 dead provers to `scripts/archive/`. **Archived, never deleted** — they are cited
by durable docs. 421 citations rewritten. **Verified by baseline: 1,727 citations / 131 unresolved,
identical before and after.**

**Wave 1 — the backlog becomes a directory** (`b12c0ee`). `design/backlog.md` (8,946 lines) →
`design/backlog/*.md`, one file per concern, read in **filename order** (hence numeric prefixes).
**Proven identical: 140 items, ZERO items differing in any field, same workable set.** Both parsers
learned the new location in step — `readBacklog()` and the dependency-free mirror in
`infra-invariant.mjs` (`readBacklogText`) — and the BL-097 drift bar now pins **where** as well as how.

**Four follow-ups filed** (`979891c`), which **refilled the workable queue**. Then **[[BL-141]] was
BUILT and CLOSED** (`npm run docs:check` — a ratchet over 780 citations, 69-entry debt register).
**Workable now: `["BL-143","BL-142","BL-144"]`.**

**⚠️ Read [[BL-142]]'s correction block before citing it.** Its headline finding was FALSE — the
checker matched substrings, so paths rooted in the *client* repo read as missing from this one. Nine
of the first sixteen findings were noise. Fixed (`2cfcc00`), retracted in the item, two bars pin it.
**The durable lesson: a checker with a false-positive rate is worse than no checker.**

## Your job: plan [[BL-144]] — Wave 2, and it is the hard one

Waves 0 and 1 were mechanical and provable. **Wave 2 is neither.** The unit is a *module* owning its
code, its durable docs and its backlog slice together. Start with **`backlog/`** (imports `fs` and
`path` and nothing else — proves the pattern at near-zero cost), then **`containment/`** (~11k lines,
almost pure docs, and the largest mass in the project).

**Three things I would put in the plan and would want challenged:**

1. **The one un-automatable task is PROMOTION.** A load-bearing durable claim buried inside an
   episodic doc is lost the moment it moves. Telling the two apart is exactly the judgment the whole
   scheme exists to make explicit — do not let it ride along inside a mechanical commit.
2. **`AGENT.md` splits LAST**, and it is 999 lines with **24 correction markers**. Those markers exist
   because it asserts things about files it does not sit beside. ~150 lines of genuinely cross-cutting
   law stay in `governance/`; the rest goes to the module whose code it constrains.
3. **NOT new repositories** — deliberately. [[BL-086]] already showed what one cross-repo split costs
   in duplicated governance. Modules give every seam without eight `AGENT.md` files to keep true.

**[[BL-141]] is shovel-ready and needs no plan** — the resolver already exists (it is the check that
verified Wave 0); it needs to become a gate, excluding `__tests__` (their "paths" are fixtures for
pure matchers) and allowlisting deliberate non-existence (`session-primers/CLAUDE.md`, which LB-12
says must NEVER exist).

## Op notes — the ones that cost real time today

- **Assert a conservation property; do not inspect a diff.** Line conservation (8,955 in / 8,955 out),
  citation parity against a **master baseline**, field-level parse equality. Each cost one command and
  each is worth more than reading 90 files.
- **A count of zero is a claim about your instrument first.** A shell rewrite loop reported 0
  substitutions; the real answer was **330**. Redone in node. Shell quoting is where this class lives.
- **Check the exit status, not that a pipeline printed something.** An `&&` chain let a commit through
  whose message claimed `806/806` while the suite was red. Amended — but I asserted a green I had not read.
- **`git worktree remove` BEFORE `git branch -D`**, or the delete fails with the branch still checked out.
- **Stage files EXPLICITLY, never `git add -A`** (`apps/web/node_modules` is a symlink that slips past
  `.gitignore`; it shows as `??` — leave it).
- **`validate-backlog.mjs` checks header↔prose drift.** Flipping `status` without matching the `- [status`
  lead-in goes red. It caught me; let it.
- **Budget: session hit 100%** at close (weekly 37%, resets Aug 19). That is why Wave 2 was not started
  rather than started badly. `node scripts/usage.mjs`.

## The through-line

The PO's diagnosis was right, and the measurements sharpened it rather than softening it: the **code**
was already decomposed (clean DAG, zero boundary escapes) — the collapse was entirely in the artifacts
*describing* the work, which had no modules, no dependency graph, no dead-code elimination and no CI.
Waves 0 and 1 gave them the first two. **[[BL-141]] and [[BL-144]] are the other two.**

And the standing risk is unchanged and worth stating plainly, because it is now larger, not smaller:
**one actor held every seat, and the PO has pre-approved the merges.** Every claim in this primer is
therefore a claim you should verify rather than inherit.
