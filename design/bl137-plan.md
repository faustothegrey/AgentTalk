# BL-137 — the authorization file leaves the operator's allowlist, and `approve <token>` becomes the act that writes it

**Status:** awaiting gate 1 (plan reviewer)
**Planner:** Claude, 2026-08-15
**Item:** [[BL-137]] · **Blocks:** [[BL-134]] · **Options taken:** (a) + (c), implemented via the existing
`scripts/relay-approve.mjs` propose/approve primitive
**PO direction, 2026-08-15:** *"I want to make this process lighter"* → *"plan BL-137 with the propose/approve flow"*

---

## 0. The change in one sentence

The PO's authorization act becomes **`approve <token>`**; the script — not the operator, and not the PO by
hand — writes and commits `design/po/<run>.authorized`, a path **outside the operator's write allowlist**,
which is what the commission verifier reads.

---

## 1. What BL-137 established — re-verified against the code, not the item

Every load-bearing claim below was re-read today at `b22017b`. Line numbers are code unless marked otherwise.

| Claim | Where it is true |
|---|---|
| Authorization resolves inside the operator's allowlist | `hmp-commission.mjs:179` → `design/operator/<run>.authorized`; allowlist at `infra-invariant.mjs:83` and `AGENT.md` → OPERATOR → Visibility |
| The verifier checks content and ancestry only | `hmp-commission.mjs:336-342` (blob at sha + `isAuthorizationFile`), `:323` (`isAncestorOf` local `master`) |
| No committer identity is checked anywhere | no `verify-commit`, author, committer or gpg call exists in `hmp-commission.mjs` (661 lines, grepped) |
| Authorization by an arbitrary committer is a **passing test today** | `hmp-commission.test.mjs:83` commits `hmp1.authorized`; the happy path accepts it |
| Nothing enforces the charter's allowlist | `infra-invariant.mjs:88-91`, in its own words — *"does NOT enforce the charter's allowlist, and nothing does"* (that is a comment; the behaviour is `allowWritePaths: []` at `:93`) |

**Two facts found today that the item does not record, and both matter to this design:**

1. **`SKILL.md:422-428` already instructs Hermes not to write the file** — *"Do not write the file yourself, do
   not bypass the verifier, do not 'helpfully' commit it."* So the intent is already documented and already
   unenforced. This is the BL-136 shape exactly: **the instruction exists, the fence does not.** It also means
   this plan does not introduce a new prohibition — it moves an existing one onto a path where the allowlist
   agrees with it.
2. **The approval store is already designed as the not-operator-writable half of a pair.**
   `relay-approve.mjs:216-219` (comment): *"A note under `design/operator/**` is courier-writable and the store
   is not — which is the whole reason they are different places."* The store is `.approvals/`
   (`relay-approve.mjs:108`), **gitignored** at `.gitignore:37`. That separation is the primitive this plan
   reuses rather than invents.

---

## 2. Why the file survives even though the approval is the act

The PO asked the sharp version of this: *"if I approve 07f3, why do I need the .authorized file?"* The answer
is that they are not two authorizations — the file is the one authorization, serialized into the only form the
verifier can read later. The two records are not interchangeable:

| `.approvals/<token>.json` | `design/po/<run>.authorized` |
|---|---|
| gitignored (`.gitignore:37`), local, mutable | git blob, read at the commissioned sha (`hmp-commission.mjs:337`) |
| not in history — nothing to diff or revert | diffable, attributable, revertible |
| records *"a token was approved"* | records *"**this tree** was authorized"* |

Deleting the file and pointing the verifier at the store would require committing the store and binding it to
the sha — at which point it **is** this file under another name. The artifact is the minimum shape the check
requires, not ceremony. **The PO never touches it: `approve` writes it.** If any step of the delivered flow asks
the PO to type a path, the delivery is wrong.

---

## 3. The flow, end to end

```
  Hermes   prepares brief + config + bar, commits on master ─────────────► sha X
             │                                          (design/operator/** — allowlisted)
             │
             ├─ writes design/operator/<run>.requested   (option c — the proposal record)
             │
             └─ node scripts/relay-approve.mjs propose --action launch --run <run>
                          │  captures master@X, mints token, TTL
                          ▼
  PO       "approve 07f3"          ← one word, any channel, per Origin Tag rule 5
                          │
                          ▼
  approve  re-resolves master. moved? → refused: sha-moved
             │  marks the record used (single-use)
             ├─ writes  design/po/<run>.authorized      ← NOT in the operator's allowlist
             └─ commits it on master ──────────────────────────────────► sha Y  (= X + 1 commit)
                          │
                          ▼
  Hermes   commissions at sha Y → verifyCommission reads design/po/<run>.authorized @ Y ✅
```

**Two parties, two directories, one keystroke from the PO.** The operator authors everything in
`design/operator/**`; the PO's approval is the only lawful producer of anything in `design/po/**`.

---

## 4. What changes in code — enumerated

| # | File | Change |
|---|---|---|
| C1 | `hmp-commission.mjs:179` | `authorizationPathFor` → `design/po/<run>.authorized`. **One line.** This is option (a) and it is the entire fence change. |
| C2 | `relay-approve.mjs:95` | `ACTIONS` gains `'launch'` (currently frozen `['merge','push']`) |
| C3 | `relay-approve.mjs` `propose` | accept `--run <id>`; **required when `action === 'launch'`, refused otherwise**. Validate against the same `RUN_ID` shape the commission uses (`hmp-commission.mjs:87`) — a run id the commission will later refuse must not be proposable. Record gains `run`. `branch` defaults to `master` for `launch`. |
| C4 | `relay-approve.mjs` `approve` | on a `launch` record, **after** the existing used/expired/sha-moved checks pass: write `design/po/<run>.authorized` with exactly `authorizationLineFor(run)`, and commit it. Import the line/path helpers from `hmp-commission.mjs` — **do not restate the string** (a second copy of a contract is a contract that drifts). |
| C5 | `AGENT.md` → OPERATOR → Visibility | name `design/po/**` as **not** writable; add `.authorized` to the "may NEVER write" table (BL-137 noted it is absent); correct the allowlist paragraph. |
| C6 | `SKILL.md` (5 sites: `:140-142`, `:149`, `:275-282`, `:422-428`) | new path; replace *"tell the PO exactly what to commit"* with *"tell the PO the token"*. |
| C7 | `infra-invariant.mjs:83` comment | the charter list it restates gains the `design/po/**` exclusion. Comment only — `allowWritePaths` stays `[]`. |

**Refusal ordering — the load-bearing constraint (primer op-note, and BL-136's own near-miss).** C1 changes
*which path* `NO_PO_AUTHORIZATION` names; it must **not** move the check's position in the sequence
(`hmp-commission.mjs:336-342`, in the world-state group, after `BRIEF_NOT_COMMITTED` and before
`RECURSIVE_COMMISSION`). Nothing executes until `pass()`, so ordering is purely diagnostic — which is why it
is free to get right and cheap to get wrong.

**Not in scope, deliberately:** no signature checking (that is option (b)), no migration of the nine historical
`design/operator/hmp[1-9].authorized` files — they are spent records of past runs, and rewriting history to
move them buys nothing.

---

## 5. The sha wrinkle — approval sha ≠ commission sha, by construction

The authorization file must exist **in the tree at the commissioned sha**, so writing it necessarily produces a
new commit. The PO approves `X`; the run commissions `Y = X + 1`. This is not a hole, but it must be pinned or
someone will later "fix" it:

**DoD row (D4 below): the authorize commit adds exactly one file and nothing else.** If `approve` ever commits
more than `design/po/<run>.authorized`, the PO approved a tree they were not shown, and `sha-moved` — the
refusal that exists precisely to prevent that (`relay-approve.mjs:203-206`) — has been defeated by the approval
step itself.

**SKILL.md:275-282 documents a related artifact** (the phantom `.authorized` deletion in `master..<branch>`
diffs, from the authorize commit landing after the branch point). Moving the path **does not fix that** — same
mechanism, different path shown. The section needs its path updated, not its advice.

---

## 6. Scope

**May touch:** `scripts/hmp-commission.mjs` (C1 only), `scripts/relay-approve.mjs` (C2–C4),
`scripts/__tests__/hmp-commission.test.mjs`, `scripts/__tests__/relay-approve.test.mjs`, `AGENT.md`,
`design/operator-seat/SKILL.md`, `scripts/infra-invariant.mjs` (comment at `:83` only), `design/backlog.md`.

**May NOT touch:** `LAUNCH_PATTERNS` and the recursion fence (BL-136 territory, byte-identical);
`isAncestorOf` / `CHARTER.authorizedRef`; `allowWritePaths`; the `REFUSAL` enum values; any other refusal's
position or reason; `bite0-launcher.mjs`; anything under `src/`.

**Worktree MANDATE:** code changes go in a per-task worktree (`node scripts/wt-setup.mjs create bl137`), stage
files **explicitly**, never `git add -A`.

---

## 7. Test contracts that change — enumerated, because they are contracts

| Test | Today | After |
|---|---|---|
| `hmp-commission.test.mjs:208` | `expect(authorizationPathFor(RUN)).toBe('design/operator/hmp1.authorized')` | `'design/po/hmp1.authorized'` — **this is the contract row**; it changes deliberately |
| `:83`, `:475`, `:494`, `:535`, `:593` | fixtures write `design/operator/<run>.authorized` | write `design/po/<run>.authorized` |
| `:173-204` (`isAuthorizationFile`) | content semantics | **unchanged** — content is not what this item touches |
| `relay-approve.test.mjs` | `merge`/`push` only | add `launch` cases; existing `merge`/`push` bars must stay green **unchanged** |

A fixture path is not a contract; **`:208` is.** Changing it is the visible edge of this plan and the reviewer
should see it move.

## 8. New bars — each must fail before the change and pass after

- **B1** `authorizationPathFor` returns a path under `design/po/`, and **not** under `design/operator/`.
- **B2** the full happy path passes with the file at the new path (fixtures moved).
- **B3** a file at the **old** path `design/operator/<run>.authorized`, and nothing at the new one, refuses
  `no-po-authorization`. *(The regression that proves the fence actually moved rather than widened.)*
- **B4** `propose --action launch` without `--run` refuses `missing-field`; with a malformed run id refuses on
  the run-id shape.
- **B5** `approve` on a `launch` token writes the file with **exactly** `authorizationLineFor(run)` and the
  commit touches **exactly one path** (§5 / D4).
- **B6** `approve` on a `launch` token whose branch moved refuses `sha-moved` **and writes no file** — the
  refusal must precede the write.
- **B7** a second `approve` of the same token refuses `already-used` and does not re-write or re-commit.
- **B8** existing `merge`/`push` proposals are unaffected (no `run`, no file written).

**Mutation discipline (the only step that produced knowledge last session):** after the bars are green, mutate
each of C1–C4 in turn and confirm **each mutation kills exactly its own bars** — particularly B6 and B7, which
are ordering claims and are the kind that most easily pass vacuously.

---

## 9. Definition of Done

| # | Row | Verified by |
|---|---|---|
| D1 | `authorizationPathFor` resolves outside every allowlisted operator path | B1 + grep of `infra-invariant.mjs:83` |
| D2 | Old-path authorization no longer authorizes | B3 |
| D3 | `approve <token>` is the only code path that produces the file | B5 + grep: no other writer of `*.authorized` in `scripts/` |
| D4 | The authorize commit adds exactly one file | B5 |
| D5 | A moved branch refuses **before** any write | B6 |
| D6 | `merge`/`push` behaviour is byte-unchanged | B8 + full `relay-approve.test.mjs` green |
| D7 | No refusal reason changed position or text except `NO_PO_AUTHORIZATION`'s path detail | full `hmp-commission.test.mjs` green + diff review |
| D8 | `AGENT.md`, `SKILL.md`, `infra-invariant.mjs:83` state the new path and `.authorized` appears in the "may NEVER write" table | read the diff |
| D9 | `tsc -b` 0, full suite green | run it, record the count |

---

## 10. What this does **not** fix — stated so it cannot be inferred

- **It does not stop a defecting Hermes.** The seat holds a shell; it can write `design/po/` regardless of any
  allowlist, and can commit to local `master`, which is what `:323` checks. **Only option (b), signature
  verification, survives that** — and it is not in this scope.
- **The fence remains behavioural, not mechanical.** `allowWritePaths` is `[]` and
  `infra-invariant.mjs:88-91` says nothing enforces the charter's allowlist. What changes is that the
  documented rule and the path layout **stop contradicting each other**. That is worth doing on BL-136's own
  logic — *a fence described in prose is worse than no fence, because it retires the reader's vigilance* — but
  it is a consistency fix, not an enforcement one, and must not be written up as the latter.
- **It is still not live-proven.** BL-137's honest limit carries forward: no Hermes-authored `.authorized` has
  been driven through a real commission, and this plan does not add one. The bars are unit-level.
- **It does not address [[BL-107]].** An attacker who can reach the HMP port already holds a shell and needs
  none of this. This is about the operator seat's *own* containment.

---

## 11. Open questions for gate 1

- **q1 — Should `approve` commit, or only write?** Plan assumes **commit** (C4): it makes `approve` the single
  producer, keeps the PO's act to one word, and the commit is what `:337` reads. The alternative — write, and
  let Hermes commit — reintroduces an operator step into the authorization path for no gain.
- **q2 — Bind the blob to the token?** e.g. `[PO] AUTHORIZED-RUN: <run> <token>`, with the verifier
  additionally requiring a used record in `.approvals/`. **Deliberately excluded**: it couples the verifier to
  non-git local state, adds a refusal reason, and buys nothing against a shell-holding operator (the store is
  no better fenced than the file). Offered so the exclusion is a decision, not an oversight.
- **q3 — Path name: `design/po/` or `design/authorizations/`?** Plan assumes `design/po/`. Neither exists
  today. `design/po/` reads as ownership, which is the property being asserted.
- **q4 — Does the verifier also require `design/operator/<run>.requested`** (option (c)'s legibility half)?
  Plan says **no** for now: it adds a refusal reason into an order-sensitive sequence for a documentation
  benefit. The `.requested` file is still written and still useful; it is just not a gate. Reviewer may
  disagree — it is the cheapest place to make the two-party structure machine-visible.
- **q5 — Does this fully unblock [[BL-134]] §5?** My read: yes for the wording *"per-run, sha-bound,
  single-use"* plus a fourth adjective that becomes **defensible as a rule** — but §5 must not claim
  enforcement. BL-134's D6 (stale workable-set row) needs recomputing regardless, independent of this item.

---

## 12. Gate 1 findings — plan reviewer, 2026-08-15

**VERDICT: REFUTED ❌ — not approvable as written.** Two plan-internal contradictions (F1, F2) and one
unspecified failure path (F3). All three are *plan* edits: no design is wrong, and no finding requires new
information. Re-gate after revision.

**Independence: ABSENT.** Same actor as the planner, under the resource-scarcity fallback. Declared, not
mitigated. Weigh the findings below accordingly — they were produced by re-running the claims, which is the
only part of this review that does not depend on the reviewer being a different person.

### Verified by running / reading — the plan earned these

| Plan claim | Verdict | Evidence |
|---|---|---|
| Path resolves inside the operator allowlist | VERIFIED ✅ | `hmp-commission.mjs:179`; allowlist `infra-invariant.mjs:83` |
| No committer/signature check anywhere | VERIFIED ✅ | grep `verify-commit\|committer\|author\|gpg\|sign` over all 661 lines — every hit is a comment or a refusal string |
| Refusal ordering: `BRIEF_NOT_COMMITTED` → `NO_PO_AUTHORIZATION` → `RECURSIVE_COMMISSION` | VERIFIED ✅ | `:330` → `:339`/`:342` → `:346` |
| `.approvals/` is gitignored | VERIFIED ✅ | `.gitignore:37` |
| `ACTIONS` frozen `['merge','push']` | VERIFIED ✅ | `relay-approve.mjs:95` |
| `:208` is the contract row for the path | VERIFIED ✅ | hardcodes `'design/operator/hmp1.authorized'` |
| `SKILL.md:422-428` already forbids Hermes writing the file | VERIFIED ✅ | read in full |
| No other writer of `*.authorized` exists in `scripts/` | VERIFIED ✅ | grep — only `hmp-commission.mjs` comments and `authorizationPathFor` |
| Baseline green before any change | VERIFIED ✅ | `npx vitest run` both files → **83 passed (83)**, 5.02s |
| Importing `hmp-commission.mjs` is side-effect-free | VERIFIED ✅ | CLI body sits behind an `isMainModule` guard at the file's tail |

### F1 — [BLOCK] C3 requires a change §6 forbids

C3 specifies validating `--run` *"against the same `RUN_ID` shape the commission uses (`hmp-commission.mjs:87`)."*
**`RUN_ID` is not exported.** `:86` is `export const REQUIRED_FIELDS`; `:87` is a bare `const RUN_ID` — the
adjacency is exactly what made the planner misread it. Exporting it is a **second** edit to
`hmp-commission.mjs`, but §6 scope reads *"May touch: `scripts/hmp-commission.mjs` (C1 only)"*.

**Fix:** widen C1 to *"C1 + export `RUN_ID`"* explicitly, in both the change table and §6. Do **not** take the
alternative of copying the regex into `relay-approve.mjs` — C4 itself argues against a second copy of a
contract, and it would be the same error one line later.

### F2 — [BLOCK] the plan does not implement what its title claims

The title and §0 say options **(a)+(c)**. §3's diagram shows Hermes writing `design/operator/<run>.requested`.
But **no change item C1–C7 produces that file, no bar B1–B8 covers it, and §6 never names it.** What the plan
actually delivers is **(a) plus a lighter authorization act** — which is worth doing, and is not (c).

This is the item's own thesis turned on its author: **a fence described in prose is not a fence, and neither is
a deliverable.** It also mis-reported to the PO, who was told "(a)+(c)".

**Fix — pick one, don't blur it:** (i) add a change item that writes `.requested`, a bar, and a scope line; or
(ii) retitle to *(a) + propose/approve*, and record (c) as **not built**, with q4 rewritten to ask whether it
should be. (ii) is the smaller, more honest change; (i) is defensible if the two-party structure should be
legible on disk from day one.

### F3 — [substantive] a failed commit is not a failed notification

C4 makes `approve` write **and commit**. Two existing behaviours collide with that and the plan is silent on
both:

- `git()` (`relay-approve.mjs:116-122`) **swallows every failure and returns `null`** — `stdio` discards
  stderr.
- `announce()` (`:230-250`) swallows deliberately, with a stated and correct reason: *"the approval itself
  already succeeded; a failed notification must not undo it."*

**That reasoning must not be extended to the commit.** If the commit silently fails, `approve` returns
`ok: true`, the PO believes they authorized, the token is already burned (`usedAt` is written at `:207`, before
`announce`), and the commission later refuses `no-po-authorization`. It fails **closed**, so it is safe — but
it is a *confusing* safe, and the PO's recourse (re-propose, because the token is spent) is undocumented.

**Fix:** specify the ordering explicitly — the commit must succeed **before** the token is marked used, or the
refusal must name the commit failure. Add a bar: **B9 — a failing commit makes `approve` report a refusal, not
`ok: true`, and does not burn the token.** Nothing in B1–B8 exercises this path.

### F4 — [minor] name collision on import

Both modules export `primaryRoot` (`relay-approve.mjs:127`, `hmp-commission.mjs:553`). C4's import must name
only `authorizationLineFor` and `authorizationPathFor`, or alias. Trivial — recorded so it is not rediscovered
at the keyboard.

### Not findings — checked and cleared

- **The sha wrinkle (§5)** is correctly identified and correctly pinned by D4. No defect.
- **§10's honesty** is adequate: it does not claim enforcement, and it carries BL-137's live-proof limit
  forward. This is the section most likely to be quietly softened during implementation — it must not be.
- **q2's exclusion** (token-in-blob) is reasoned, not an oversight, and I agree with the exclusion for the
  reason given: the store is no better fenced than the file.
