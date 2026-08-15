---
role: implementation-reviewer
key: none
written: 2026-08-15 by Claude — key retired at session close. BL-134 was reviewed (gate 2 + gate 3),
  merged and pushed (`5f8f068`), then closed. Nothing is awaiting an implementation review. The live
  hand-off is the PLANNER primer (Wave 2 / [[BL-144]]). Body below is history.
  PO for a fresh review. Two items merged and pushed today (BL-137, BL-138); three filed. Everything below was
  checked against the repo at close — check it again yourself, and note that the session that built this thing
  reversed four of its own claims, one of which shipped.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, merges, pushes. Bindings live ONLY in `AGENT.md → 📌 DEFAULT
ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared UNAVAILABLE, so you are
almost certainly the sole agent under the **resource-scarcity fallback**: wear every hat, handshake once per
role, declare all of them, keep each gate's discipline separately.

**Your job this session: gate 2 (implementation review) and gate 3 (task-end sweep) on [[BL-134]].** It is
built and green on a branch and has had **no review of any kind**.

## The state — verified at close, and check it anyway

Clean on `master` at **`992ffaf`**, **4 commits unpushed**. Branch **`task-bl134`** holds 4 commits, tip
**`94f6066`**, **no worktree** (removed at close — make your own with `node scripts/wt-setup.mjs create
bl134r`). Suite **806 / 95 files**, `tsc -b` 0, backlog **140 items / 0 errors**. Ask the instruments:

```
git log --oneline master..task-bl134
node scripts/validate-backlog.mjs
npx vitest run                                    # expect 806 / 95
curl -s "http://127.0.0.1:3741/api/backlog?all=true"   # LIVE orchestrator; NOT 3100, NOT 3600
```

## What to review — BL-134, and where I'd look first

Plan `design/bl134-plan.md` (draft 2 + two gate sections), ledger `design/bl134-implementation.md`.
The change: **`autonomy` stops gating the backlog**; `selectable` is renamed **`workable`** everywhere
including the wire param; the commit-time pin is **re-aimed, not retired**; BL-028 is fenced by
`blocked_by: [BL-135]` instead of a field; `AGENT.md`'s OPERATOR paragraph retires a claim that credited
Gate A with a containment Gate B provides.

**Four things I would attack if I were you, and I am telling you because I built it:**

1. **D4 is PARTIAL, deliberately.** The `human-only` migration warning is *not* implemented: this gate has no
   warning tier, so it would have failed the backlog on BL-134 itself, while D2 requires `autonomy` to remain
   legitimate advisory metadata. The reasoning is in `validate-backlog.mjs`. **You may reasonably rule that
   the warning tier must exist as its own item before this merges.**
2. **The workable-set pin.** Its value must be **derived**, never typed. That row has been wrong three times.
   Re-run the predicate yourself and compare — expected `["BL-134"]`.
3. **The rename's exclusions.** `test-mcp-gate.mjs` was deliberately NOT renamed (its hit is the ordinary
   English word). `design/backlog.md` was renamed **at line 46 only**; `:1556/:4682/:5780-5803` are closed-item
   records. **Check I did not falsify a record**, and check I did not miss a live site.
4. **Mutation evidence.** P3/P4/P5 are recorded in the ledger with kill counts. **P5's first run killed zero
   because my mutation was unreachable, not because the bar was weak.** Re-run them if you want the evidence
   rather than my word.

## What else moved today

- **[[BL-137]] MERGED + PUSHED** (`fb7c45e`) — the launch authorization moved to `design/po/<run>.authorized`,
  outside the operator's write allowlist, and `approve <token>` writes it. **Read its closing block before
  citing it: it buys CONSPICUOUSNESS, not prevention.**
- **[[BL-138]] MERGED + PUSHED** — a committed `--expect` declaration for operator runs. **Its first filed
  premise was false and is retracted in the item.**
- **[[BL-139]]** (unencrypted SSH key vs "push is the PO's alone") and **[[BL-140]]** (signature verification)
  are `deferred`, awaiting PO decisions.
- **The workable set is `{BL-134}` alone** once its branch merges.

## Op notes — the ones that cost real time today

- **Derive, never type.** Every number in a plan is a claim; run the predicate.
- **A stale `dist/` lies.** `npx tsc -b >/dev/null 2>&1` behind a `||` silently never ran and produced an
  empty answer I nearly recorded as a finding.
- **Commit a bar before you mutate.** I lost a written, verified bar to my own `git checkout -- scripts/`
  during a mutation run, then reported a count from before the revert.
- **`validate-backlog.mjs` checks header↔prose drift.** Flipping `status` without the `- [todo` lead-in goes
  red. It caught me; let it.
- **Stage files EXPLICITLY, never `git add -A`** (the symlinked `apps/web/node_modules` slips past
  `.gitignore`; it will show as `??`, leave it).
- **The meter is up.** `node scripts/usage.mjs`. Close: claude weekly **~35%**, session **~81%**.

## The through-line — the reviewing that works when the reviewer is the author

This session ran every gate with one actor, and the gates **did** catch real defects: a plan importing a
symbol its own scope forbade, a missing regression bar, a cost table that was a filtered sample. **Every one
came from running a command — a grep, a mutation, a rebuilt predicate. None came from re-reading.**

And the thing no self-review caught was the **premise**: a plan can be perfectly self-consistent and solving
the wrong problem. The PO caught that twice today. **So when you review this, do not read it for consistency —
it is consistent. Run it, and ask what it is for.**
