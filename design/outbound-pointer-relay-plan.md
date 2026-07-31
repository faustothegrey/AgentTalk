# The outbound pointer relay — plan

**Parent:** [[BL-110]] step 2 (the return leg). **Planner:** Claude, 2026-07-31, under the resource-scarcity
fallback. **Gate 1 (plan review) has NOT been held** — see §7.

---

## 1. What this is, in one line

The PO, away from the desk, can already **ring the doorbell** ([[BL-110]] step 1, merged `5927762`). This adds
the other half: **a reply that says where to look**, in facts rather than prose.

## 2. Why it is buildable now, when the rest of BL-110 is not

| Blocker | Gates what | Gates this? |
|---|---|---|
| [[BL-107]] — HMP is unauthenticated | what a **forged inbound** message can make the session *do* | **No.** Nothing flows in. |
| `[PO-RELAY]` authority decision | which **inbound verbs** are binding | **No.** This emits; it obeys nothing. |
| `peer70` unreachable | the auth rollout | **No.** No cluster change. |

**An outbound message carries no authority, so there is nothing in this direction to forge.** That is the whole
reason it can be built today, and it is the same argument step 1 used: *prove the leg with traffic that cannot
hurt you.*

## 3. The design decision that shapes everything: pointers, not prose

[[BL-112]] is live and unfixed — the courier **silently excises a specific literal substring** from replies,
deterministically, mechanism unknown and inside the PO's Hermes install. Its own fix direction is the rule this
plan obeys:

> **no datum you need may depend on surviving the courier.**

Inbound survived BL-112 because the lost datum was derivable from committed config. **Transcript prose is not
derivable from anywhere** — so this relay never sends prose it authored. Every field is either a number, a
timestamp, a path, or *committed* text recoverable from the repo by its own sha.

### 3a. Two tells, because BL-112 fails *silently*

A dropped field must be **loud**. Two mechanisms, covering different failure shapes:

| Tell | Catches | Read by |
|---|---|---|
| **Line numbering** `1/7 … 7/7` | a whole field vanishing | **a human on a phone**, at a glance |
| **`digest:` over the payload** | excision *within* a line | a machine, later, from the artifact |

BL-112's observed behaviour was **within-line** (`…recording.json.NOPE` → `.NOPE`; the substring was cut and the
remainder survived), so the digest is the one that addresses the known defect. Numbering is cheap insurance
against a different shape, and it is the only tell that works in the moment for the actual user — **a PO on a
phone cannot run a verifier.** That limit is stated, not designed around.

Digest is computed over the payload lines **normalised** (trailing whitespace stripped, `\n`-joined) so an LLM
courier's benign reformatting does not false-positive. It is not a security mechanism and must not be described
as one — an excising courier could excise the digest too. It converts *silent* corruption into *detectable*
corruption, which is precisely what BL-112 complains is missing.

## 4. The payload

```
1/7 session: 5a0e75d4                      # which session; the JSONL exists at this id
2/7 branch:  master
3/7 head:    3084702 fix(infra): pin the launchd orchestrator's MCP port to 54321
4/7 tree:    0 modified, 0 untracked
5/7 sync:    ahead 0, behind 0
6/7 spoke:   2026-07-31T07:22:47Z (4m ago)
7/7 inbox:   0 pending
digest: a3f91c2e
```

**Every line is independently verifiable by the PO from the repo**, except `spoke`, which is verifiable from the
JSONL the PO owns. The commit subject (line 3) is prose — but *committed* prose, recoverable from its sha, which
is exactly what the derivability rule permits.

**`spoke` is the highest-value field and the cheapest.** The mtime/timestamp of the last assistant entry answers
*"is this session alive or wedged?"* without reading one word of content — no leak, no excision surface, and it
works on a session too wedged to cooperate. Note honestly: it does **not** make this a kill switch ([[BL-028]],
[[BL-096]]); it tells you a session is stuck, it cannot unstick it.

**Deliberately absent: any message body.** Not truncated, not summarised — absent. §6 makes that mechanical.

## 5. Scope

**Touch:**
- `scripts/relay-status.mjs` — new. Two commands: `emit` (prints the payload) and `verify` (reads a relayed
  payload on stdin, recomputes the digest, prints `intact` / `ALTERED`).
- `scripts/__tests__/relay-status.test.mjs` — new bars.
- `design/operator/relay-readonly-recipe.md` — add the courier message body for the outbound direction.

**Do NOT touch — and each has a reason:**
- **`scripts/relay-inbox.mjs`.** `report` is already in `READ_ONLY_VERBS` and currently only files a note. Making
  it *emit* would be a behaviour change to a merged, live-proven artifact — a **Rule 2 show-stopper**, not a
  refactor. A separate script keeps the diff additive and leaves that file's safety argument (*"`receive` writes
  a file and returns; that is all it can do"*) intact and still true.
- `READ_ONLY_VERBS` / `WRITE_VERBS` — widening the inbound allowlist is a governance act and is not in scope.
- `~/.hermes/**` — read-only to us; the courier is configured by the message it is handed, not by us.
- BL-107 / BL-110 / BL-112 dispositions — PO decisions.

**A new script in `scripts/` inherits [[BL-111]]'s BAR A for free** — `guardedScripts()` discovers subjects by
grepping for `isMainModule(import.meta.url)` (`scripts/__tests__/is-main-guard.test.mjs:30-35`, verified
2026-07-31). Use the shared helper and the symlink bar covers it with no new test. That is BL-111's payoff
arriving on schedule.

## 6. Definition of Done

| # | Row | How it is proven |
|---|---|---|
| 1 | `emit` prints all 7 numbered fields + digest | run it; assert shape |
| 2 | **`verify` accepts `emit`'s own output** | round-trip, in-process |
| 3 | **`verify` REPORTS ALTERED on a within-line excision** — the BL-112 shape | delete a known substring from a captured payload; assert `ALTERED`. **This is the load-bearing bar: it proves the mechanism, not merely that it runs.** |
| 4 | A dropped whole line is visible in the numbering | assert `n/7` monotonic and complete |
| 5 | **`emit` writes nothing** | snapshot the tree + `design/operator/` before and after; assert byte-identical. The read-only claim must be mechanical, not asserted. |
| 6 | **No transcript message body reaches the output** | seed a JSONL fixture with a distinctive sentinel string in a message body; assert the sentinel appears nowhere in `emit`'s output. This is the *fence*, and it must fail if someone later adds a "just a short summary" field. |
| 7 | Absent/corrupt JSONL degrades truthfully | fixture with no JSONL → `spoke: unknown`; **never crash, never invent a timestamp** |
| 8 | Runs through a symlinked absolute path | BL-111 BAR A, automatically (§5) |
| 9 | Recipe carries the exact courier message | doc row |
| 10 | Full suite green, no regression | `npm test` |

**Not in the DoD, deliberately:** a live HMP round trip. That needs the PO to send from a peer, so it is a
**separate, PO-driven validation** after merge — the same split step 1 used. Rows 1-10 are all provable locally.

## 7. Gates, and an honest declaration

I am the **Planner** here. Under the resource-scarcity fallback I am also the only available holder of **Plan
Reviewer**, and the independence default is *Plan Reviewer ≠ Planner*. The fallback permits one actor to hold
both **if declared loudly** — this is that declaration. **Gate 1 has not been held.** Options, PO's call:

1. **The PO reviews the plan directly** — cleanest; restores real independence at gate 1.
2. **I hold gate 1 in a separate declared pass**, applying Reviewer Rules 1/2/5 to this document.

Gate 2 (implementation review) and gate 3 (task-end + merge) follow normally; **the merge stays PO-gated and the
push stays the PO's.**

## 8. Estimate and risk

**Small** — one script of maybe 120 lines, seven bars, one doc section. No engine code, no shared logic, no
behaviour change to anything merged. The risk is not in the building; it is in **quietly letting prose back in**,
which is why row 6 is a sentinel test rather than a code-review promise.

**The one thing that could invalidate this plan:** if the PO decides outbound should carry the session's actual
words after all, the pointer design is the wrong shape and BL-112 becomes a hard precondition rather than a
mitigated one. That is a scope call and it is the PO's.
