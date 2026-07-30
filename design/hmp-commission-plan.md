# HMP commissioning — the mechanised fence, and the first channel proof

**Status:** PLAN — awaiting Gate 1 (plan review) and the PO's go on T2's live launch.
**Planner:** Claude, 2026-07-30. **Supersedes the open questions in** `design/hmp-session-submission.md` §8
for decisions 1–3; decisions 4–5 are answered below as findings, not proposals.
**PO decisions taken 2026-07-30, in session:** harden before wiring the launch verb · the first commission
must be one that *cannot write* · authorization is a **per-run `[PO]` line** in a committed brief.

> **The one-line shape.** Hermes is never given the launcher. It is given **one** command — a verifier that
> launches on success and refuses otherwise — so the §4 verification is not a step Hermes performs but the only
> entry point that exists.

---

## 0. What changed since the proposal was written

`hmp-session-submission.md` was written blind to the running system. Four of its premises now resolve:

| Proposal | Ground truth (2026-07-30, this Mac) |
|---|---|
| §1a *"Where does the operator process run?"* — **Unresolved** | **Resolved.** Hermes is resident here as `peer128`, up 2d03h, `bind: 0.0.0.0:18643`, gateway adapter live. |
| §9 *"Implementing an HMP peer on this host — deferred"* | **Moot.** The peer exists. `/hmp/send`, `/hmp/send_and_wait`, `/hmp/poll/{id}` all serve. |
| §4 *"HMP is unauthenticated… trivially forgeable by any host on the LAN"* — a threat model | **Live configuration**, not a hypothesis: `allow_all_peers: true`, `host: 0.0.0.0`, no shared secret. `adapter.py:223` returns `None` before any check. |
| Implicitly: Hermes would need a launch capability built | **Already has one.** `toolsets: [hermes-cli]` (shell), `max_turns: 90`, `gateway_timeout: 1800`. It has executed 107 imperative HMP messages, including `DEPLOY … download ZIP … install`. |

**So this plan builds no capability. It builds the fence around a capability that is already live** — which is
the same shape as [[BL-097]], where the operator's write surface existed and the work was making it checkable.

## 1. The transport exposure — filed, not fixed (and why)

`~/.hermes/config.yaml:597-612` exposes a shell-capable agent to the LAN unauthenticated. Both obvious levers
break a **live three-peer cluster** that sends to this host (`peer70` 88 msgs, `peer84` 12, `peer106` 7):

- `host: 127.0.0.1` → all three peers lose reach.
- `HMP_SHARED_SECRET` → all three 403 until each is updated, and `peer70` (coordinator, `192.168.178.70:8643`)
  is **currently unreachable**, so it cannot be updated now.

**This is a PO decision about the PO's own infrastructure, outside both repos.** Filed as **[[BL-107]]**. It is
*not* a precondition of this plan: §4's check is launch-class-only, so it hardens the launch path while the
other peers' ping/chat/deploy traffic is untouched.

## 2. T1 — `scripts/hmp-commission.mjs`, the only entry point

**The design decision that matters.** §4 says *"the receiver MUST, before doing anything else, verify…"*. Hermes
is an LLM with a shell; a rule of that form is **behavioural** — exactly what BL-097 was filed to end. So the
verification is not written as a rule for Hermes to follow. It is written as **the only command Hermes is told**,
and it fails closed.

```
node /abs/AgentTalk/scripts/hmp-commission.mjs --text-file <path>
  → exit 0  : all checks passed, harness snapshot taken, launcher exec'd
  → exit !=0: "refused: <reason>" on stdout, nothing launched
```

### Checks, in order, all fail-closed

| # | Check | Refusal reason |
|---|---|---|
| 1 | Parse `AGENTTALK-RUN \| run= \| brief= \| repo-sha= \| bar-sha256= \| port= \| sandbox=`. Unknown or missing field ⇒ refuse. | `malformed-commission` |
| 2 | **Read the brief from the git object store at `repo-sha`** — `git cat-file blob <sha>:<relpath>` — never from the working tree. | `brief-not-committed` |
| 3 | The brief (as read from git) contains an **exact anchored authorization line** (§2a). | `no-po-authorization` |
| 4 | Bar file, also read at `repo-sha`, hashes to `bar-sha256`. | `bar-hash-mismatch` |
| 5 | `port === 3600` and `sandbox` matches `att-op-*`. | `charter-mismatch` |
| 6 | Recursion fence — the brief's goal contains no launch instruction. | `recursive-commission` |
| 7 | A **fresh** `infra-invariant.mjs` pre-flight reports no `critical` (§2b). | `critical-outstanding` |
| 8 | This `run` id has no prior launch in `design/operator/.hmp-launched.json`. | `already-launched` |

**Check 2 is stronger than §4 as written.** §4 step 1 says *"confirm the file exists and is committed"* — which a
dirty working tree satisfies while the commission means something else. Reading the blob at `repo-sha` makes the
committed text the *only* text. Same for check 4: hashing the working file would let the bar be retuned after
results, which is the exact thing `bar-sha256` exists to prevent.

### 2a. Gate 1 amendment — the `[PO]` line must be a format, not a phrase

**Refuted as first drafted.** *"Contains a line matching `[PO]` authorization naming this run id"* is satisfiable
by prose that says the opposite: a brief containing *"this run has no `[PO]` authorization for hmp1"* matches a
substring check on `[PO]` + the run id. That is the BL-097 merge-commit failure recurring — a check satisfied
**vacuously**, waving through the one thing it exists to stop.

The authorization is therefore an **exact, anchored, single-line format**, matched on its own line,
whitespace-normalised, and nothing else: `[PO] AUTHORIZED-RUN: <run-id>`.

**Required negative test:** a brief that contains both `[PO]` and the run id in a non-authorizing sentence MUST
refuse with `no-po-authorization`. Without that test this amendment is a comment.

### 2a′. Implementation refutation — the anchored line authorized its own denial

**§2a above was still the wrong mechanism, and this was found by RUNNING the CLI, not by reading it.** The
anchored check **accepted `design/operator/hmp1-brief.md`** — a document whose entire purpose is to state that the
run is **not** authorized — because that brief **quotes** the required line in a fenced block to document what the
PO must add. A line-anchored matcher cannot distinguish an example from the real thing.

**No regex rescues this.** Strip code fences and an indented block quotes the line; strip those and a blockquote
does. The mechanism was wrong, not the pattern.

**Resolution:** authorization is a **discrete file**, `design/operator/<run>.authorized`, whose **entire**
committed content must equal the line. Quotation is then harmless by construction, and the brief can describe the
format in prose without authorizing itself. It also turns "the PO authorized run X" into a discrete, diffable,
committed act rather than a sentence buried in a document — which is what §4 was reaching for.

**The generalisable form, since this is three-for-three today:** *a check that reads a **human-authored document**
for a **machine-meaningful token** is reading a channel that must also carry discussion **of** that token.* Give
the token its own channel. The same shape as BL-097's merge commit and BL-094's file-instead-of-property.

**Verified live**, in a throwaway clone, all three stages: no `.authorized` ⇒ `no-po-authorization`; the PO's
file committed to `master` ⇒ `accepted`; the bar retuned afterwards ⇒ `bar-hash-mismatch`.

### 2b. Gate 1 amendment — check 7 was unimplementable as written

**Refuted.** *"No **uncleared** `critical` outstanding"* presumes a persisted PO-disposition store. There is
none: `infra-invariant.mjs` computes severity per run, and the only escape valve is the
`AGENTTALK_SWEEP_DECLARED` **env** var (`:57`). "Uncleared" has nowhere to live.

Two honest options; **take (a)** — inventing a disposition store is a separate item, not a rider on this one:

- **(a)** Check 7 runs a **fresh** pre-flight and refuses on any `critical` **now**. Checkable today, no new state.
  PO disposition stays out-of-band, exactly as the charter has it (*"only the PO may dispose"*).
- **(b)** Introduce a cleared-findings file. More faithful to the charter's wording, and out of scope here.

Consequence to state plainly: a `critical` the PO has *already* dispositioned still blocks until the underlying
condition is gone. That is the fail-closed direction, so it is the right way to be wrong. **Filed as [[BL-109]].**

### 2c. Gate 1 amendment — how does Hermes know to run the verifier at all?

**The hole that would have sunk the whole thing, found before any code existed.** The proposal's §3 assumed a
receiver that *"applies §4 to these"* — i.e. code with a dispatch table. **The live receiver is an LLM**, and
`AGENTTALK-RUN | run=… | brief=…` is not an instruction to run anything. Hermes would receive a line of
`key=value` pairs and have to guess. Meanwhile this plan's own scope declares `~/.hermes/**` **read-only** — so a
standing routine or `SOUL.md` entry is not available to us either. As drafted, the plan was internally
contradictory and T2 could not have worked.

**Resolution: the command goes in the message.** The budget is ~300 of 2048 bytes; there is room.

```
AGENTTALK-RUN | run=hmp1 | brief=<abs> | repo-sha=<40hex> | bar-sha256=<64hex> | port=3600 | sandbox=att-op-hmp1
RUN EXACTLY THIS, NOTHING ELSE: node /abs/AgentTalk/scripts/hmp-commission.mjs --text-file <abs-of-this-message>
Do not launch anything yourself. Relay the command's stdout verbatim as your reply.
```

This keeps `~/.hermes/**` untouched, needs no standing grant on the Hermes side, and is self-describing to a
cold receiver — the same reasoning that makes a Session Primer self-contained.

**It does not make the message trustworthy, and it is not trying to.** A forger could name a different command —
but that is the transport exposure ([[BL-107]]), which no verifier can fix. §4's repo anchor was never a claim
that messages are authentic; it is the claim that **a launch which took the lawful path is verifiable after the
fact**. Keep those two apart when grading.

### The honest limit — stated, not buried

**This is a fence, not a sandbox.** Hermes has a shell and could discover and run `launcher.mjs` directly. What
this buys is that the lawful path is the *only* documented one, any bypass is visibly off-script, and every
lawful launch leaves a verifiable trail anchored in a commit. That is the same honest limit `AGENT.md` already
states about the operator write fence — behavioural at the edge, mechanical in the middle. **Do not describe this
as containment.**

### Scope

**May touch:** `scripts/hmp-commission.mjs` (new) · `scripts/__tests__/hmp-commission.test.mjs` (new) ·
`design/operator/hmp1-brief.md`, `design/operator/hmp1-bar.md` (new) · `design/backlog.md` (file BL-107, BL-108) ·
`design/launch-and-monitor-runbook.md` (**one** correction, §5).
**May NOT touch:** the launcher · `scripts/infra-invariant.mjs` · `packages/**` · `apps/**` ·
`~/.hermes/**` (the PO's install — read-only, always) · anything in the client repo.

### DoD (each row needs a recorded run)

| # | Row |
|---|---|
| 1 | `npx tsc -b` → 0 |
| 2 | **`npm test`** (not bare vitest — it chains the contract check first) → green, and the **skip count read**, not just passes |
| 3 | Each of the 8 refusals has a test that asserts the specific reason string and that **no launch occurred** |
| 4 | A well-formed commission against a committed brief + matching bar reaches the launch step (launcher stubbed) |
| 5 | **Mutation check per check:** neuter checks 2, 3, 4 and 6 one at a time; each must redden a named test. A check never watched to fail is a decoration. |
| 6 | `git status` clean after commit; `git worktree list` shows no leak |

**Worktree, per the MANDATE:** `node scripts/wt-setup.mjs create hmp1 --base master --root /tmp`.
**`--root /tmp` is required on this Mac** — see §5.

## 3. T2 — the first commission: a run that cannot write

Blocked on T1 merged **and** an explicit `[PO]` go, separately from T1's.

The brief's goal must name a **property, not a file** — the root cause of BL-094's miss. Goal: *report the
current `HEAD` sha and the suite's pass/skip counts; change no files.* The bar, pre-registered and **proven red
before launching**:

1. The worker's worktree `git status` is clean and `HEAD` is unmoved — *the property*, checked at **both**
   coordinates (`<workdir>` and `<workdir>/agentalk-task-<id>/`), because for `claude` the work lands in the
   parent. State what is at each.
2. The response sidecar contains a HEAD sha equal to the real one, and counts equal to a run we perform
   independently.
3. `/hmp/poll/{message_id}` returned an ack, and that ack is recorded as **evidence about the channel only**.

> **`completed` over HMP means the message was answered.** Both the protocol's own law (*"Notificato ≠
> Allineato"*) and this project's say the same thing. Grade the artifact, at the coordinates where the process
> actually stood — today's BL-102 baseline reported `completed` with an **empty** worktree.

**Do not let T2's success be read as evidence that long runs work.** It is a channel proof, minutes long.
[[BL-096]] stands untouched.

## 4. Answers to the proposal's remaining decisions

- **§8.3 — `from` allowlist?** Recommend **yes eventually, no now**: `allow_all_peers: true` is cluster-wide, so
  narrowing it belongs to BL-107, not here. Documented as a speed bump, never a control.
- **§8.4 — fallback to `:8642`?** **No fallback for launch-class.** One auditable channel; if HMP is down the run
  waits. Confirmed sensible now that `:8642` is a second live listener on this host.
- **§8.5 — does the receiver need an HMP endpoint here?** Answered by evidence: **it already has one.**

## 5. One runbook correction, in scope

`launch-and-monitor-runbook.md:22` reads *"Default root is `os.tmpdir()` … `/tmp` on this box, so `--root` is no
longer needed on Linux."* Written on the Linux box. Here `os.tmpdir()` is `/var/folders/n1/…/T`, so worktrees
land where a `/tmp/att-op-*` sweep and the harness allowlist do not look. The line becomes platform-explicit.
Filed as **[[BL-108]]** if Gate 1 judges it out of scope.

## 5a. Gate 1 verdict — APPROVED WITH AMENDMENTS

**Plan Reviewer: Claude, 2026-07-30** (same actor as the Planner, under the PO-declared resource-scarcity
fallback; the seats' disciplines kept separately, and the pass was run adversarially before any code existed).

| # | Finding | Disposition |
|---|---|---|
| 1 | Check 3 was satisfiable by non-authorizing prose — a **vacuous** pass on the one act the fence exists to stop | **REFUTED** → §2a: anchored format + a required negative test |
| 2 | Check 7 presumed a disposition store that does not exist — **unimplementable** | **REFUTED** → §2b option (a); [[BL-109]] filed for the store |
| 3 | Nothing told Hermes to run the verifier, and the plan's own scope forbade the fix | **REFUTED** → §2c: the command travels in the message |
| 4 | `cap.meter` was a risk-table row, not a check — the charter calls it **mandatory** | **ACCEPTED** → promoted to **check 9**, `missing-cap-meter` |
| 5 | §5's runbook correction: in scope or not? | **In scope.** It will bite this task's own first worktree; leaving it stale to preserve a scope boundary would be theatre. One line. |

**Approved to implement T1.** T2's live launch needs a separate `[PO]` go.

## 5b. T1 delivered — implementation record, including three self-caught defects

**Branch `task-hmp1`** (worktree `/private/tmp/att-hmp1`), three commits, **not merged** — the merge is the PO's.

| DoD | Verdict |
|---|---|
| 1 · `npx tsc -b` → 0 | **VERIFIED ✅** exit 0 |
| 2 · `npm test` green, **skip count read** | **VERIFIED ✅** 561/561 across 78 files, **0 skipped** (523/77 baseline + 38) |
| 3 · every refusal has a bar asserting its reason and no launch | **VERIFIED ✅** 13 refusal reasons, each pinned |
| 4 · a lawful commission reaches the launch step | **VERIFIED ✅** live in a throwaway clone: `accepted` + `launch: NOT WIRED` |
| 5 · mutation check per check | **VERIFIED ✅** 8 mutations, each reddened only its own named bar, each reverted |
| 6 · `git status` clean, no worktree leak | **VERIFIED ✅** one expected `?? apps/web/node_modules` (wt-setup's symlink) |

**Three defects found in my own work, all by running rather than reading — recorded because the pattern is the
point:**

1. **`realPreflight` was a no-op.** It counted the word "critical" in `infra-invariant snapshot` output; `snapshot`
   emits no findings, so check 7 could never fire. **Every bar still passed**, because `verifyCommission` takes
   `preflight` as a parameter and the *stub* was what got tested. **An injected seam moves the untested surface, it
   does not remove it.** Now uses `check-orchestrator-ports.mjs` with the runner injected one level lower.
2. **A brief inside the repo was refused `brief-outside-repo`** — `/tmp` is a symlink to `/private/tmp` on macOS,
   so the repo root resolved real while the commissioned path stayed symlinked. **Would not reproduce on Linux.**
   Fourth path-resolution defect in this project in three days.
3. **§2a′ above** — the anchored authorization line accepted its own denial.

**Deviations from the plan as written, for the record:** the check list grew from 9 to **13** (all narrower and
fail-closed: `brief-outside-repo`, `sha-not-a-commit`, `sha-not-on-master`, `config-not-committed`); the bar and
config paths became **conventions** rather than message fields, removing degrees of freedom a forger could vary;
and `sha-not-on-master` was added, which is the check that does real work against a LAN forger and makes the PO's
merge the authorization act.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Hermes bypasses the verifier and calls the launcher directly | Not preventable (§2, honest limit). Detectable: a launch with no verifier record. T2's grading checks for the record. |
| A launch runs on the same provider pool as this session | `cap.meter` is **mandatory** per the charter — a named-but-unmitigated budget risk already cost a full session window. Verifier check: refuse a config without it. *(Add as check 9 if Gate 1 agrees.)* |
| The stub router grades a phantom | `hmp-worker-router.py` marks anything non-`ping` `completed` with `'ricevuto e processato'`. It polls a **different DB** than the gateway writes. Grade from `hmp_gateway_plugin/messages.db`. |
| Worktree lands under `/var/folders` and escapes the sweep | §5 + `--root /tmp` in every command in this plan. |
