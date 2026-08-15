# BL-137 — authorization becomes conspicuous and light; the fence claim gets retired instead of relocated

**Status:** rewritten after gate 1 REFUTED the first draft; awaiting re-gate
**Planner:** Claude, 2026-08-15 (draft 2)
**Item:** [[BL-137]] · **Blocks:** [[BL-134]]
**PO direction:** *"make this process lighter"* → *"plan BL-137 with the propose/approve flow"* → *"rethink the plan"*

---

## 0. What the rethink changed — read this before the rest

Draft 1 proposed options **(a)+(c)** and called moving the file a fence. Gate 1 refuted it on two internal
contradictions. The rethink then killed something bigger than either finding: **the premise.**

| Draft 1 | Draft 2 |
|---|---|
| Moving the path is the fence | **No artifact-based scheme can fence a local shell-holder.** Moving the path buys **conspicuousness**, which is detection, not prevention — and that is worth having under its true name |
| Options (a)+(c) | **(a) only.** `<run>.requested` is dropped, not deferred — §4.3 argues it buys a name for something that already exists |
| §10 quietly conceded "not enforcement" | The concession is now the **spine**: the primary deliverable is retiring two false claims, not relocating a file |
| Option (b) silently out of scope | **Filed as its own item** with its real cost, so it is a PO decision rather than a planner's omission |

---

## 1. The hypothesis I tested and killed — `origin/master` as the anchor

Before rewriting, one idea deserved a check, because if it worked it beat everything else in the item:
`CHARTER.authorizedRef` is **local** `master` (`hmp-commission.mjs:83`). AGENT.md says, repeatedly and in
bold, that **push is the PO's alone, "absolutely and without exception."** So anchoring authorization to
`origin/master` would express, in code, a boundary the governance already claims — and a fence made of an
existing credential boundary costs nothing to maintain.

**It does not hold on this machine, and I checked rather than reasoned:**

- `~/.ssh/id_rsa` is an **unencrypted** PEM private key (`-----BEGIN RSA PRIVATE KEY-----`, no `ENCRYPTED`
  header)
- `ssh-add -l` → *"The agent has no identities"* — so git reads that key file directly
- Hermes runs as the same user, so it can push with the same key

**Verdict: dead.** There is no credential boundary between the operator and `origin`. It also costs a network
round trip and makes the flow heavier, which fights the PO's actual ask.

**But killing it produced the finding the rest of this plan rests on** (and a second one, §11.2).

---

## 2. The honest threat model — stated first, so nothing downstream can overstate itself

The operator holds a shell as the repo's owner. Therefore it can write **any path**, commit to **local
master**, push to **origin**, and write the approval store. It follows that:

> **No file location, no directory, no store, and no git ref can prevent a defecting operator from
> authorizing its own run. Only a secret it cannot read can — and none exists on this machine today.**

Everything in this plan is therefore aimed at the failure modes that are **real here**, which are not
defection:

1. **Accident and drift.** `SKILL.md:422-428` says *"do not 'helpfully' commit it"* — that wording exists
   because the temptation is live. A seat trying to be useful is the likely writer, not a hostile one.
2. **False safety claims.** `hmp-commission.mjs:38` (comment) and AGENT.md both assert a PO-only
   authorization. Per BL-136's lesson, a false fence is **worse than no fence, because it retires the
   reader's vigilance.** This is the actual harm, and it is the one this plan primarily fixes.

## 3. Conspicuousness — the property that is real, under its true name

`design/operator/**` is the directory the operator writes **routinely and lawfully**. An `.authorized` file
there is indistinguishable, in a listing or a diff, from the seat's own ordinary output. Move it to
`design/po/` — a directory **nothing else writes** — and an unauthorized write stops being camouflaged.

**And this is not merely aesthetic, because the detection machinery already exists and works:**
`classifyHeadMove` (`infra-invariant.mjs:408`) compares paths written during a bracketed run against
`allowWritePaths` and reports anything unmatched as **foreign** (`:431`, `:864-865`). It is dormant only
because operator configs declare nothing — `allowWritePaths: []` (`:92`), which early-returns at `:410`.

So the honest chain is: **(a) makes the write conspicuous → a declared `allowWritePaths` makes it a finding
inside the bracket.** Prevention, no. Detection with an existing mechanism, yes. That distinction is the whole
point of this draft.

---

## 4. The design

### 4.1 The act (the PO's actual ask — lightness)

`approve <token>` is the authorization. The script writes and commits `design/po/<run>.authorized`; the PO
never touches a path. Flow unchanged from draft 1 and still correct:

```
  Hermes   prepares brief + config + bar, commits ──────────────────► sha X
             └─ relay-approve propose --action launch --run <run>   (captures master@X, mints token)
                          │
  PO       "approve 07f3" │  ← one word, any channel (Origin Tag rule 5)
                          ▼
  approve  re-resolves master; moved? → refused: sha-moved
             ├─ commits design/po/<run>.authorized ───────────────► sha Y (= X + 1)
             └─ THEN marks the token used                            (§4.4)
                          │
  Hermes   commissions at Y → verifier reads design/po/<run>.authorized @ Y ✅
```

### 4.2 The claims that get retired (the primary deliverable)

- `hmp-commission.mjs:38` — *"it makes the PO's merge the authorization act"* → replaced with what is true:
  the authorization is a **discrete, sha-bound, single-use, conspicuously-located** act whose integrity rests
  on the operator observing its instructions, **not** on a mechanism.
- `AGENT.md` → OPERATOR → Visibility — add `.authorized` to the "may NEVER write" table (BL-137 noted its
  absence), name `design/po/**` as not-writable, and state plainly that the fence is **behavioural**.
- `SKILL.md:422-428` — keep the prohibition, drop *"tell the PO exactly what to commit"* (now: tell them the
  token).

### 4.3 `<run>.requested` is dropped, not deferred — resolving gate-1 F2 by deletion

Draft 1 claimed option (c). Gate 1 found nothing implemented it. The right resolution is **deletion, not
construction**: the operator *already* writes the brief, the config and the bar into `design/operator/**`, and
those **are** the proposal. A `.requested` file adds a filename for something that exists, gates nothing, and
would have to be kept in sync with the artifacts it summarises. The two-party structure is made legible by the
**directory split** (§3), which costs one line instead of a new artifact and a new sync obligation.

### 4.4 Commit before burn — resolving gate-1 F3

`git()` (`relay-approve.mjs:116-122`) swallows every failure and returns `null`; the token is marked used at
`:207`. So the naive order returns `ok: true` on a silent commit failure. **Order: commit → verify it landed →
only then mark used.** `announce()`'s swallow-and-continue (`:230-250`) is correct for a *notification* and
must **not** be extended to the commit: a missing note is cosmetic, a missing authorization is the act not
having happened.

---

## 5. Change items

| # | File | Change |
|---|---|---|
| C1 | `hmp-commission.mjs` | `authorizationPathFor` → `design/po/<run>.authorized` (`:179`) **and `export` `RUN_ID` (`:87`)** — the export is required by C3 and is named here explicitly (gate-1 F1) |
| C2 | `relay-approve.mjs:95` | `ACTIONS` gains `'launch'` |
| C3 | `relay-approve.mjs` `propose` | accept `--run`; required iff `action === 'launch'`; validate with the **imported** `RUN_ID`; record gains `run`; `branch` defaults to `master` |
| C4 | `relay-approve.mjs` `approve` | on a `launch` record: write + commit the file, **verify the commit**, then mark used (§4.4). Import **only** `authorizationLineFor`, `authorizationPathFor`, `RUN_ID` — both modules export `primaryRoot` (gate-1 F4) |
| C5 | `hmp-commission.mjs:38` | retire the false comment (§4.2). Comment only |
| C6 | `AGENT.md` | `.authorized` into the never-write table; `design/po/**`; "behavioural, not enforced" stated plainly |
| C7 | `SKILL.md` (`:140-142`, `:149`, `:275-282`, `:422-428`) | new path; token instead of "what to commit" |
| C8 | `infra-invariant.mjs:83` comment | restate the charter list with the `design/po/**` exclusion. **Comment only — `allowWritePaths` stays `[]`** (populating it is §11.1) |

**Refusal ordering is load-bearing — in BOTH files** (primer op-note; BL-136's own near-miss; re-gate G2).

- `hmp-commission.mjs`: C1 changes *which path* `NO_PO_AUTHORIZATION` names and must **not** move the check's
  position — `:330` `BRIEF_NOT_COMMITTED` → `:339`/`:342` `NO_PO_AUTHORIZATION` → `:346`
  `RECURSIVE_COMMISSION`, verified at gate 1.
- `relay-approve.mjs` `propose` is **equally order-sensitive and C3 edits it**: `:147` `!action` → `:148`
  `!branch` → `:149` `ACTIONS.includes` → `:151` `!sha`. **The `branch` default for `launch` MUST be applied
  after the `ACTIONS.includes` check**, not before. Applied earlier it changes which refusal an invalid action
  with no branch reports (`bad-action` instead of `missing-field`). No existing bar breaks either way —
  `:82` supplies a branch — which is exactly why an implementer could move it without noticing, and why the
  constraint is written here rather than discovered later.

## 6. Scope

**May touch:** `scripts/hmp-commission.mjs` (C1, C5 — **two** named edits, nothing else),
`scripts/relay-approve.mjs`, both test files, `AGENT.md`, `design/operator-seat/SKILL.md`,
`scripts/infra-invariant.mjs` (comment at `:83` only), `design/backlog.md`.

**May NOT touch:** `LAUNCH_PATTERNS` / the recursion fence (BL-136, byte-identical); `isAncestorOf`;
`CHARTER.authorizedRef` (§1 killed that idea — do not revive it mid-implementation); `allowWritePaths`; the
`REFUSAL` enum values; any other refusal's position or text; `bite0-launcher.mjs`; anything under `src/`; the
nine historical `design/operator/hmp[1-9].authorized` files (spent records; rewriting history buys nothing).

**Worktree MANDATE:** `node scripts/wt-setup.mjs create bl137`; stage explicitly, never `git add -A`.

## 7. Test contracts that change

| Test | Today | After |
|---|---|---|
| `hmp-commission.test.mjs:208` | `toBe('design/operator/hmp1.authorized')` | `'design/po/hmp1.authorized'` — **the contract row**; it moves deliberately |
| `:83`, `:475`, `:494`, `:535`, `:593` | fixtures at the old path | new path (fixtures, not contracts) |
| `:173-204` `isAuthorizationFile` | content semantics | **unchanged** — content is not what this item touches |
| **`relay-approve.test.mjs:84`** | `expect(ACTIONS).toEqual(['merge','push'])` | **`['merge','push','launch']` — THE SECOND CONTRACT ROW.** It pins the action allowlist exactly, so C2 turns it red *by design*. It is the twin of `:208` and draft 2 missed it (re-gate G1) |
| `relay-approve.test.mjs` (rest of 29) | `merge`/`push` | add `launch` cases; every **other** existing bar stays green unchanged |

**Baseline, run at gate 1: `npx vitest run` both files → 83 passed (83), 5.02s.**

## 8. Bars — each must fail before the change and pass after

- **B1** `authorizationPathFor` is under `design/po/`, not `design/operator/`
- **B2** happy path passes at the new path
- **B3** a file at the **old** path and nothing at the new one refuses `no-po-authorization` *(proves the fence
  moved rather than widened)*
- **B4** `propose --action launch` without `--run` refuses `missing-field`; a malformed run id refuses on shape
- **B5** `approve` writes exactly `authorizationLineFor(run)` and the commit touches **exactly one path**
- **B6** a moved branch refuses `sha-moved` **and writes no file** — refusal precedes the write
- **B7** re-approving refuses `already-used`; no second write or commit
- **B8** `merge`/`push` proposals are unaffected — no `run`, no file
- **B9** *(gate-1 F3)* **a failing commit makes `approve` report a refusal, not `ok: true`, and does not burn
  the token**
- **B10** `RUN_ID` is importable and the two modules agree on which run ids are valid *(a run id `propose`
  accepts but the commission would refuse is a defect)*

**Mutation discipline** — the only step last session that produced knowledge I did not already assume: mutate
each of C1–C4 and confirm **each kills exactly its own bars**. B6, B7 and B9 are ordering claims, the class
that most easily passes vacuously.

## 9. Definition of Done

| # | Row | Verified by |
|---|---|---|
| D1 | Authorization resolves outside every allowlisted operator path | B1 + grep `infra-invariant.mjs:83` |
| D2 | Old-path authorization no longer authorizes | B3 |
| D3 | `approve` is the only producer of the file | B5 + grep: no other `*.authorized` writer in `scripts/` |
| D4 | The authorize commit adds exactly one file | B5 |
| D5 | Refusal precedes any write; a failed commit never reports success | B6, B9 |
| D6 | `merge`/`push` byte-unchanged | B8 + full `relay-approve.test.mjs` green |
| D7 | No refusal changed position or text except `NO_PO_AUTHORIZATION`'s path detail | full `hmp-commission.test.mjs` green + diff review |
| D8 | **Every retired claim is actually retired** — `hmp-commission.mjs:38`, AGENT.md's table, SKILL.md | read the diff; grep for the old assertions |
| D9 | The word "fence"/"prevents" appears nowhere describing (a) | read the diff — §2 is the contract |
| D10 | `tsc -b` 0, full suite green | run it, record the count |

**D9 is not pedantry.** This plan's entire premise is that mislabelling detection as prevention is the defect
BL-137 reports. Committing that error while fixing it is the failure shape this project has now recorded three
times.

## 10. What this does **not** fix

- **A defecting operator.** §2. It can write `design/po/`, commit, and push — the SSH key is unencrypted and
  agent-less (§1). Only a secret it cannot read would change this.
- **Enforcement.** `allowWritePaths` stays `[]`; nothing mechanically prevents any write. §3's detection is
  *available*, not *switched on* — that is §11.1.
- **Live proof.** No Hermes-authored `.authorized` has gone through a real commission. Bars are unit-level.
  BL-137's honest limit carries forward unchanged.
- **[[BL-107]].** Out of scope and untouched.

## 11. Items to file alongside this plan

1. **Populate `allowWritePaths` for operator runs** — turns §3's conspicuousness into an actual bracketed
   finding using machinery that already exists (`classifyHeadMove`, `:408`). This is BL-119's residue (its
   option (d), deliberately unfiled at the time) and it is now load-bearing for this plan's honesty.
2. **`~/.ssh/id_rsa` is unencrypted and the agent holds no identities**, so *"push is the PO's alone,
   absolutely and without exception"* has **no mechanical backing** on this machine — any process running as
   the repo owner can push. Common on a personal dev box and **not** a crisis; filed because AGENT.md states
   that boundary in bold in several places, and it is the same fence-in-prose shape this item is about. **PO
   call, not a planner's.**
3. **Option (b), signature verification** — the only option that would actually fence a shell-holder. Real
   cost: a signing key and **a passphrase typed per approval**, which trades away exactly the lightness the PO
   asked for. Filed so it stays a decision rather than an omission.

## 12. Open questions for re-gate

- **q1** `design/po/` or `design/authorizations/`? Assumed `design/po/`. Under §3 the criterion is now sharper:
  a directory **nothing else writes**, so the name should not invite future use. *(PO call.)*
- **q2** Confirm `approve` **commits** (not just writes). §4.4 assumes it, and it means a script commits to
  master on the PO's word. *(PO call.)*
- **q3** Is retiring the `hmp-commission.mjs:38` comment (C5) in scope, or a separate change? It is the item's
  primary harm, so this plan says in scope — but it is an edit to a file otherwise held to one line.
- **q4** Does dropping `.requested` (§4.3) lose anything the reviewer values? Draft 1's q4 asked whether to
  *gate* on it; this asks whether to *build* it at all.
- **q5** Does this unblock [[BL-134]] §5? My read: **partly, and differently than draft 1 claimed.** §5 may
  describe the act as per-run, sha-bound, single-use and conspicuous — but it may **not** imply "only the PO
  can produce it," because §2 says that is false. BL-134's D6 needs recomputing regardless.

---

## 13. Gate 1 findings (plan reviewer, 2026-08-15) — dispositions

Verdict on draft 1 was **REFUTED ❌**. Independence **absent** (same actor as planner, resource-scarcity
fallback) — declared, not mitigated. All four findings are disposed of below; nothing open vanished silently.

| # | Finding | Disposition |
|---|---|---|
| **F1** | C3 imports `RUN_ID`, which is not exported (`:87` bare `const` under an exported `:86`); §6 forbade the edit | **ACCEPTED** → C1 now names the export explicitly; §6 permits two named edits; **B10** pins that both modules agree |
| **F2** | Title claimed (a)+(c); nothing implemented (c) | **ACCEPTED, resolved by deletion** → §4.3 drops `.requested` with an argument, rather than building it to match a title. Title corrected |
| **F3** | `git()` swallows failures; token burned before the commit is verified → silent `ok: true` | **ACCEPTED** → §4.4 sets commit-before-burn; **B9** added; D5 pins it |
| **F4** | Both modules export `primaryRoot` | **ACCEPTED** → C4 specifies named imports only |

**Verified-good at gate 1, carried forward** (re-run, not re-asserted): path `:179` · allowlist
`infra-invariant.mjs:83` · **no committer/signature check in 661 lines** · refusal ordering `:330→:339/:342→:346` ·
`.gitignore:37` · `ACTIONS` frozen `:95` · `:208` contract row · `SKILL.md:422-428` · side-effect-free import ·
**baseline 83/83 green**.

**What gate 1 did not catch, and the rethink did:** the premise. Both findings were *internal consistency*
defects — the reviewer checked whether the plan agreed with itself and with the code, and never asked whether
moving a file fences anything. **A plan can be perfectly consistent and still be solving the wrong problem**,
and no amount of the same actor re-reading it was going to surface that. The PO's "rethink" did.

## 14. Re-gate (plan reviewer, 2026-08-15) — **APPROVED ✅, corrections applied**

PO settled q1 (`design/po/`) and q2 (`approve` commits). Draft 2's design is sound and its honesty sections are
load-bearing and correct. Two defects found and **fixed in this commit** before implementation starts; both
were plan text, not design.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| **G1** | §7 claimed *"every existing bar stays green unchanged"* for `relay-approve.test.mjs`. **False.** `:84` asserts `expect(ACTIONS).toEqual(['merge','push'])` — C2 turns it red by design. It is a **contract** row, the exact twin of `:208`, which the plan *did* flag | **BLOCK-class** — an undeclared contract change is how a red test gets "fixed" by weakening instead of recognised as a declared move | **FIXED** — §7 now names `:84` as the second contract row |
| **G2** | *"Refusal ordering is load-bearing"* was scoped to `hmp-commission.mjs` only, while C3 edits `propose`'s equally order-sensitive guard sequence. The `branch` default's insertion point silently decides whether an invalid action reports `bad-action` or `missing-field` | substantive | **FIXED** — §5 now constrains both files and names the insertion point |

**Checked and cleared (not findings):**

- **The crash window in commit-before-burn is safe, and fails closed.** If the process dies after the commit
  but before the token is marked used, a retry re-resolves `master` — now at `Y` — and refuses `sha-moved`.
  The authorization exists but is unusable without a fresh proposal. Correct behaviour; worth knowing before
  someone "fixes" it.
- **`relay-approve.test.mjs:78`** already asserts the store is *not* under `design/operator` — the codebase
  independently reached the same directory-separation reasoning as §3, which is corroboration rather than a
  finding.
- **No test pins `AGENT.md`'s charter prose**, so C6 breaks nothing. (`hmp-commission.test.mjs:341` only
  asserts the file *exists*, as a primary-checkout probe; `:68`/`:531` write a fixture `CLAUDE.md` for the
  governance bar. Neither reads the charter.)
- **Baseline still 83/83** — `git diff --stat 6f1c3e8..HEAD -- scripts/ src/` is empty, so no code has moved
  since the gate-1 run.

**Independence: still absent.** Same actor as the planner. Both re-gate findings came from *running greps
against the test files* rather than re-reading the plan — which is the only part of this review that does not
depend on who wrote it.

**Cleared for implementation.** Worktree `bl137`; C1–C8; bars B1–B10 with the mutation run; §10 must survive
the implementation unsoftened.
