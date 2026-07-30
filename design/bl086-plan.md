# BL-086 — governance for `agentalk-mcp-client`

**Status:** **DELIVERED on branch `task-BL-086` (`bada6a9`, client repo) — awaiting the PO's merge.** Gate 1
passed with amendments (§7); G1 escalated and **resolved by the PO in favour of inline rules**; §6's landing
question **resolved: branch, PO-merged.** All six DoD rows verified — see §4.1.
**Decision:** **option (b)** — a short client-specific `AGENT.md` that inherits the rules of engagement and
states its own scope. **Taken by the PO, 2026-07-30.** Options (a) wholesale symlink and (c) launcher-prompt
injection are closed; (c) additionally contradicts the standing file-inheritance decision.
**Planner:** Claude. **Gate 1 reviewer:** Claude (resource-scarcity fallback; plan-reviewer discipline kept
separately — see §7).

---

## 1. Ground truth (verified 2026-07-30, not inherited from the item text)

| Claim | Verified |
|---|---|
| No `AGENT.md` / `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` at the client root | ✅ only `README.md` + `attach-skill.md` |
| `.claude/` exists | ✅ — and contains **only an empty `worktrees/` dir**; nothing tracked (`git ls-files .claude` → empty) |
| The client is where the ladder's plumbing lives | ✅ launcher, executors, MCP bridge, `wire-contract.json` |
| Client `master` = `c7a5991`, in sync with origin | ✅ — tree dirty with `M package-lock.json` ([[BL-100]], PO's to land) |

**So the gap is total, not partial.** There is no file to amend and no prior decision to preserve.

**Incidental finding, out of scope, reported not fixed:** a stray worktree at
`/home/fausto/Software/wt-count-task` (branch `task-count-1-10000`, `4193a4e`). Outside `/tmp`, not `att-`
prefixed. Cleanup is the PO's call.

---

## 2. Two findings that shape the deliverable

These are the reason this plan is not "copy the rules across", and they are what Gate 1 should attack hardest.

### 2.1 — "Inherit by pointer" MUST NOT rest on a cross-repo path resolving

The obvious reading of (b) is: point at `../AgentTalk/AGENT.md` and inherit the rules by reference. **That
fails in exactly the environment where all development happens, and it fails silently.**

[[BL-101]] proved the shape this week, in the opposite direction: `verify-contract.js` resolves the client as a
sibling of the checkout, so from a worktree at `/tmp/att-<id>` it looks for `/tmp/agentalk-mcp-client`, finds
nothing, and **takes its fail-open branch**. Mirror it: a client worktree at `/tmp/att-<id>` whose `AGENT.md`
points at `../AgentTalk/AGENT.md` resolves to `/tmp/AgentTalk/AGENT.md` — absent. The worker reads a pointer to
nothing and proceeds ungoverned, which is the precise failure BL-086 exists to close.

Worse than uniformly broken: it is **intermittently correct.** The stray worktree above sits at
`/home/fausto/Software/wt-count-task`, whose `../AgentTalk` *does* resolve. So the pointer works from some
locations and not others — the failure mode that survives testing.

**Therefore: every rule that must bind is written INLINE in the client `AGENT.md`.** The pointer to this repo is
for *depth and context only* (workflow method, ledgers, epic history), and is phrased so a reader who cannot
reach it is still fully governed. **A worker must never need a second repo to know what it may not do.**

### 2.2 — The primer handshake MUST NOT be inherited (it would break the thing this enables)

`AGENT.md`'s First Entry Point makes a cold-start agent do a primer handshake and **STOP**. Copying that into
the client file would instruct every launched worker to halt before working — inverting the PO's own choice of
*"inherit the rules, skip the primer ritual"*, and contradicting **BL-082**, already merged in this very repo
(`c7a5991` — *launched workers exempt from the primer gate*).

**Therefore: no First Entry Point, no key store, no role primers in the client file.** It says so explicitly and
says why, so nobody "fixes the omission" later. This is the single most likely way to get (b) wrong, and it
would look like thoroughness.

---

## 3. Deliverable

**One file** — `agentalk-mcp-client/AGENT.md` — plus **two symlinks**, `AGENTS.md` and `CLAUDE.md`, mirroring
this repo's three-names-one-file convention. The symlinks are not cosmetic: [[BL-080]] proved a claude worker
picks the rules up through the `CLAUDE.md` name in headless `-p` mode, and that mechanism is the entire premise
of (b). `GEMINI.md` is deliberately omitted, matching this repo.

**⚠️ Known limit — inheritance is PROVEN for claude only.** BL-080's evidence covers claude in headless `-p`.
That codex reads `AGENTS.md` and gemini reads `GEMINI.md` is **assumed from convention, not verified here**, and
this repo has no `GEMINI.md` either — so consistency with AgentTalk is not the same as coverage. Since agy is
the default Implementer (currently PO-declared unavailable), this becomes load-bearing the moment it returns.
**Do not state or imply in the deliverable that all providers inherit.** Closing that gap is §8's follow-up, not
this task's scope.

### 3.1 — What goes in (inline, binding)

1. **A one-paragraph scope statement** — what this repo *is* (launcher, executors, MCP bridge, wire contract),
   and that it is the client half of AgentTalk.
2. **Honesty over Results** — the principles, in full. Report real output; never fix silently; an honest red
   beats a scope-creep green.
3. **The Implementer Rules of Engagement, all seven, in full.** Not summarised. These are the operational teeth
   and a paraphrase is a weakened contract.
4. **The show-stopper fence**, called out by name inside Rule 2 as it is here.
5. **The worktree MANDATE** — code changes happen in a per-task worktree; docs may be edited directly.
6. **Merge and push are the PO's.** The worker commits and stops.
7. **The vocabulary rule** — "launch", never "spawn".
8. **A pointer to this repo** for method and history, explicitly marked *context, not authority*, with the
   sentence that the rules above bind whether or not the pointer resolves.

### 3.2 — What is deliberately left out, and said so in the file

| Left out | Why |
|---|---|
| First Entry Point / primer handshake / key stores | §2.2 — would halt every launched worker; contradicts BL-082 |
| Role assignments table, the three reviewer seats, SM/PO/Architect charters | No epics, no ledger, no gates here; the seats live in AgentTalk |
| Milestone history, epic ledgers, backlog protocol | Not this repo's artifacts |
| Origin Tag Protocol | No baton is routed here |
| Resource-expenditure telemetry blocks | Closure telemetry attaches to an AgentTalk ledger entry |

Stating the omissions **in the file** is load-bearing: it converts "this file is incomplete" into "this file is
scoped", and stops a future reader from importing the primer gate out of tidiness.

---

## 4. Definition of Done

| # | Row | How it is verified |
|---|---|---|
| D1 | `AGENT.md` exists at the client root with §3.1's eight elements present | read the file |
| D2 | `AGENTS.md` and `CLAUDE.md` are symlinks to it; `git ls-files` shows all three tracked | `ls -l` + `git ls-files` |
| D3 | The seven Implementer Rules appear in full, not paraphrased | diff the rule text against `AGENT.md` |
| D4 | **No** primer/handshake/key-store instruction appears anywhere in the file | `grep -iE 'primer\|handshake\|key store\|First Entry'` → only the §3.2 exclusion note |
| D5 | No rule that binds is stated only by cross-repo reference | read §2.1's invariant against the file |
| D6 | The client suite still passes, and the working tree carries **no change beyond the three new files** | `npm test` in the client; `git status --porcelain` |

**⚠️ D6 has a known pre-existing red and must not be read literally.** The client tree is **already** dirty with
`M package-lock.json` ([[BL-100]], the PO's to land, §5 forbids touching it). A naive "tree is clean" row would
fail this task for a defect it did not cause — the [[H-L3]] trap verbatim, where a hardcoded reference value
failed a worker for being correct. **D6 passes when the diff is exactly the three new files plus that
pre-existing lockfile modification, and nothing else.**

**Mutation check for D5 — the one that makes this more than a decoration.** Copy the finished `AGENT.md` alone
into a scratch dir with no sibling `AgentTalk/`, read it there, and confirm a reader still learns every
non-negotiable. If anything binding evaporates, the pointer is load-bearing and §2.1 was violated.

**Note on D4's method.** The grep cannot be mechanical: the file *will* contain the words "primer" and
"handshake" inside its own exclusion note (§3.2). D4 passes on a **human reading** that every hit is an
exclusion, never an instruction. A row that looks automated but isn't is worse than one that admits it.

### 4.1 — Verification record (implementer, 2026-07-30, branch `task-BL-086` @ `bada6a9`)

| # | Verdict | Evidence |
|---|---|---|
| D1 | ✅ | `AGENT.md` at client root, all eight §3.1 elements present |
| D2 | ✅ | `git ls-files -s` → `AGENTS.md` and `CLAUDE.md` both mode **`120000`** (real symlinks) pointing at `AGENT.md`, all three tracked. **Mode checked deliberately:** had git stored them as `100644` regular files containing the text `AGENT.md`, the inheritance mechanism would break silently. |
| D3 | ✅ | seven rules present in full (`grep -cE '^\*\*[1-7]\. '` → 7), copied verbatim, not paraphrased |
| D4 | ✅ | two hits, both cleared on reading: `:48` is the *wire-contract* handshake (unrelated sense), `:106` is the exclusion note itself. **No primer instruction anywhere.** |
| D5 | ✅ | **mutation check run** — `AGENT.md` copied alone to a scratch dir with **no sibling `AgentTalk/`** (verified absent); all seven non-negotiable markers still readable. The pointer is not load-bearing. |
| D6 | ✅ | client suite **93/93 across 17 files** (5.68s). `git status --porcelain` after commit → **only** the pre-existing ` M package-lock.json`, unstaged and untouched per §5. Commit is exactly `3 files changed, 126 insertions(+)`. |

**Notes & deviations for the reviewer:** none. No file outside §3's three was created or modified; no client
code was touched; the BL-100 lockfile drift was left exactly as found.

---

## 5. Explicitly out of scope

- Any change to this repo's `AGENT.md`.
- The client `package-lock.json` drift ([[BL-100]], PO's to land) — **do not** resync it while working here; it
  would mix an unrelated change into the diff.
- The stray `wt-count-task` worktree.
- Any code change in the client repo.

---

## 6. Open question for the PO (does not block Gate 1)

**Branch or direct-on-master, in the client repo?** In AgentTalk, governance docs may be edited directly on
master and only code needs a worktree — but that permission is granted *by* the file this task is creating, so
the client repo does not yet have it. **Planner's recommendation: a branch, merged by you.** It costs one
gate and avoids setting the precedent that the client's first governance act was itself ungoverned. **Push
remains yours either way.**

---

## 7. Gate 1 — plan-reviewer verdict

**APPROVED WITH REQUIRED AMENDMENTS** — Claude, plan-reviewer seat, 2026-07-30. Five findings; four produced
amendments now folded into the plan above, one is escalated to the PO in §7.1 and does **not** block.

| # | Finding | Disposition |
|---|---|---|
| G1 | **The plan silently reinterprets the PO's own decision.** The backlog's option (b) says the client file *"inherits the rules of engagement **by pointer**"*. §2.1 replaces that with inline copy + a context-only pointer. The reasoning is sound and the failure it avoids is real — but the PO approved a wording this plan does not deliver. | **Escalated, §7.1.** Not a defect in the approach; a defect in letting the approach diverge from the approved words without saying so. |
| G2 | **Inheritance is proven for claude only** — the plan leaned on BL-080 as though it covered every provider. | **Amended** — §3 now carries the limit explicitly and forbids the deliverable from implying broader coverage. |
| G3 | **D6 would have failed correct work.** The client tree is already dirty with `M package-lock.json`, which §5 forbids touching — so "tree is clean" fails this task for BL-100's defect. This is the H-L3 trap repeating one day later. | **Amended** — D6 now pins the expected diff exactly and names the pre-existing modification. |
| G4 | **D4 looked mechanical and wasn't.** The file must contain "primer"/"handshake" in its own exclusion note, so the grep necessarily hits. | **Amended** — D4 now states it is a human reading. |
| G5 | **The plan verifies the artifact, never the mechanism.** Every DoD row checks the file's *content*; none proves a launched worker actually picks it up — and inheritance is the entire thesis. | **Accepted as scoped, follow-up named in §8.** Deferring is defensible (BL-080 proved the mechanism for claude, and a launch is an operator run), but leaving it unnamed would have let "the file exists" pass as "workers are governed". |

**Not found / checked and clear:** §2.2's primer exclusion is correct and load-bearing — verified against client
`c7a5991`, which merged BL-082 (*launched workers exempt from the primer gate*), so inheriting the handshake
would contradict an already-merged decision in the very repo being governed.

### 7.1 — Escalation to the PO (G1)

You approved **(b)** as the backlog states it: *inherit the rules of engagement **by pointer***. This plan
delivers the rules **inline**, with the pointer demoted to context. §2.1 is the reason — a pointer resolves
from the primary checkout and **silently evaporates in a worktree**, which is where the MANDATE puts all
development, and it is intermittently correct depending on where the worktree sits, so testing would not catch
it. **This is still option (b)** in the sense that matters — scoped rules of engagement, not option (a)'s
wholesale copy of roles, epics and primer — but it is not the mechanism the words describe. **Confirm the
substitution, or tell me to keep the pointer.**

---

## 8. Named follow-up (not this task)

**Verify the mechanism, not just the artifact (G5).** Launch a trivial worker in the client repo and have it
state, unprompted, what it may not do. That is the only check that proves inheritance rather than assuming it,
and it doubles as coverage for G2's unproven providers. Cheap as an operator rung; file it once this lands.
