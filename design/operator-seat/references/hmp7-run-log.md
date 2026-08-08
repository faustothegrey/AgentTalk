# hmp7 run log — FIRST engine-code rung, 2026-08-08 (preparation + launch phases)

Run `hmp7`, backlog item **BL-121** (delete the unreachable `busy` branch in `Registry`; rename
`setAgentBusyState(agent, busy)` → `markAgentIdle(agent)` — no boolean param, no dead branch, keep exactly the
reachable behaviour). **First rung whose worker changes engine code** — hmp1–hmp6 were read-only, client-repo,
or investigation. This run was PREPARED and STOPPED before launch (no `.authorized`, no commission line).

## Commission state (as prepared)

- Artifacts committed at `f1524aa` on master (only the 3 files staged; pre-existing dirty files untouched):
  `design/operator/hmp7-brief.md`, `design/operator/hmp7-bar.md`, `design/operator/hmp7.config.json`.
- **bar-sha256 (committed blob @ master, verifier's own `sha256()`):**
  `a16feaeb382dc99efc3fa25f0014e3861e381d895de88b4457434d23062ccebd`
- Config: `wallClockMs 5400000` (90 min — heavier than hmp6's 60 min investigation: rename + parity test +
  red-at-baseline proof + 722-test suite + `tsc -b`), meter `{url http://127.0.0.1:9899, provider claude,
  maxPercentDelta 20}` (warning-only since BL-117), recording `/tmp/att-op-hmp7-recording.json` (distinct from
  hmp1–6's `/tmp/att-op-hmpN-recording.json`), workdir `/tmp/att-op-hmp7` (branch `task-op-hmp7`), port 3600.
- Verify at launch: `git show <repo-sha>:design/operator/hmp7.authorized` → exactly `[PO] AUTHORIZED-RUN: hmp7`.
  The PO's authorize commit advances master past `f1524aa`; that new tip becomes the repo-sha.

## Backlog read (API path)

Backend was down (curl exit 7). Started it: `PORT=3600 npm run backend` (cwd `/Users/fausto/Software/AgentTalk`),
read `GET http://127.0.0.1:3600/api/backlog?selectable=true` → **exactly one item (BL-121)**, then **stopped the
backend** so port 3600 was free at launch. The invariant snapshot itself records `selectable: ['BL-121']`.

## Premise verified by SYMBOL at 0aefb2e (item insists; coordinates drift)

- `setAgentBusyState` decl `registry.ts:822`; **sole caller `:548`** (`send_to_agent`, `to === 'user'`, passes
  `false`); unreachable `busy ? 'busy' : 'ready'` at `:823`; BL-120 correction comment at `:888`.
- The two `busy` **producers** the rename must NOT disturb: `in-process-driver.ts:118`
  (`notifyAgentStatus(this.agent, 'busy')` every pulled turn) and reconnect restore `registry.ts:1380`
  (`agent.currentTurnId ? 'busy' : 'ready'`).
- `setAgentStatus` emits `status` unconditionally (`:290`); `updateAgentSessionStatus` guards on change before
  emitting `session_status` (`:835-845`) — the parity test must capture the ordered pair.

## Bar shape (new pattern — engine-code rung)

- **R2 = OBSERVABLE-EVENT PARITY, the deciding row**: identical ordered `status`/`session_status` sequences
  before vs after, from a `busy` agent AND a `ready` agent, asserted against **emitted events**, test proven
  red at the baseline.
- **R2c = the show-stopper, graded SUCCESS**: ANY event-sequence difference → worker STOPS and reports → that
  is a PASSED rung (item's own words: "reporting that is a *success*, not a failure"). Silence on parity fails
  the row for want of evidence.
- R3: no new `busy` producer; helper has no boolean param and no `'busy'` literal. R4: `tsc -b` 0; suite
  722/722, 86 files unchanged (assertion-line-count verification). R5: scope — only registry source, its tests,
  the new parity test; out-of-scope list (union narrowing, `sessionStatus` deletion, `apps/web/types.ts:46`,
  coordinators, `ALLOWED_TRANSITIONS`, `arbiter-coordinator.ts`) untouched. R8 graded: **deleted, not wired**
  (wiring = second producer next to ArbiterCoordinator's strict `=== 'ready'` gate + throwing transition table,
  M17 G3-4 / [[BL-020]]).

## Techniques that worked this run

1. **Bar sha256 from the committed blob, not the working tree** — `git cat-file blob master:design/operator/
   hmp7-bar.md` piped to the verifier's `sha256()`, run AFTER committing. Matches what `hmp-commission.mjs`
   hashes at repo-sha.
2. **`validateConfig` run for real** from the client repo cwd (`lib/bite0-launcher.mjs`) — returned `OK: true`.
3. **Recursion-fence scan run on the goal string inside the config too**, not just the brief — both `NONE (pass)`.
4. **Pre-existing dirty primary** (`.hmp-launched.json` M from hmp6's never-committed launch entry, SKILL.md M,
   untracked hmp6-run-log.md) — captured in the baseline snapshot, NOT committed with the artifacts, reported
   to the PO as pre-existing. The hmp6 ledger critical must be cleared by the PO before the next harness check.
5. **Worktree quirk**: `?? apps/web/node_modules` is a symlink to the primary's web node_modules (wt-setup
   wiring) — expected, never `git add -A`, not harness-visible.

## Pre-flight result (all 12 PASS)

Both repos built (`dist/` OK, `node_modules/` OK, `tsc -b` exit 0) · worktree `/tmp/att-op-hmp7/.git` exists ·
`CLAUDE.md -> AGENT.md` symlink · checkouts DIFFERENT · port 3600 FREE · claude v2.1.224 on PATH ·
`cap.meter` present · meter live `ok: True | session: 12% | weekly: 24%` · recording distinct · `runs/` exists
· goal 2 sentences no restated rules · BL-121 `todo`/selectable.

Reference values: worktree HEAD `f1524aa` = mainline HEAD `f1524aa`; harness blob
`34785b856d84480b2855212a7c4fb61016f88727`. Invariant snapshot `/tmp/att-invariant/hmp7-before.json`
(2026-08-08T06:46:28Z) — HEAD `f1524aa`, worktrees primary + `/private/tmp/att-op-hmp7` on `task-op-hmp7`,
ports only 9899 (meter), `selectable: ['BL-121']`.

## Launch phase (PO authorized; commission accepted 2026-08-08)

**PO pre-launch commits** (advancing master `f1524aa` → `c792a18f`): `3869e19` dispose(hmp6) accept the
launch-ledger critical; `dc6ffff` dispose drop the duplicate hmp6 entry; `c792a18f` authorize(hmp7) —
`design/operator/hmp7.authorized` = exactly `[PO] AUTHORIZED-RUN: hmp7`. **Master moved ⇒ re-snapshot
immediately before commissioning** (the O-1 trap; baseline refreshed at `c792a18f`).

- Commission: `AGENTTALK-RUN | run=hmp7 | brief=design/operator/hmp7-brief.md | repo-sha=c792a18f... |
  bar-sha256=a16feaeb... | port=3600 | sandbox=att-op-hmp7` → **accepted: launched pid 13691**.
- Worktree HEAD stayed at `f1524aa` (branch point) — fine: PO commits touched only dispositions/authorized,
  not backlog or registry; worker read BL-121 from its own workdir.
- NDJSON: `run-start` 07:00:26Z (goal verbatim, cap wallClockMs 5400000) · `agent-launched` 07:00:31Z (pid
  13779) · `goal-delivered` 07:00:31Z · `cap-warning` 07:12:32Z (`meter +21% ≥ 20%`, BL-117 warning-only,
  run continued) · `outcome: completed` 07:13:52Z · `task-worktrees-released` 07:13:52Z.
- **Wall-clock 13m 26s** (run-start → outcome), well under the 90-min cap.
- **Meter delta: session 12% → 35% (+23), weekly 24% → 26% (+2).** Worker's close telemetry (weekly 26%,
  session 35%) matched the operator's post-run curl exactly.
- **Invariant check: "No differences at all" — the expected ledger critical did NOT fire** because the ledger
  was already `M` at the refreshed baseline (hmp6's entry never committed; PO's dispose touched
  dispositions.json, not the ledger). Verified the replay guard directly: ledger `launched` now lists hmp7.
  Flagged the still-uncommitted ledger to the PO.
- **Process sweep clean; port 3600 free** after the run.
- **Partial cleanup** (write-run): parent worktree `/tmp/att-op-hmp7` + branch `task-op-hmp7` kept (the only
  copy of the deliverable); nested task worktree already released by the orchestrator; master unmoved at
  `c792a18f`.

## Worker outcome (observations only — no grading)

- Commit `b2a3b67` on `task-op-hmp7` at the **parent workdir**: `registry.ts` (+34/−10), `bl028-idle-
  advisory.test.ts` (+3 comment lines), new `bl121-idle-helper-parity.test.ts` (+251). `git diff --stat`
  vs launch baseline `f1524aa` = exactly those 3 files. Nested task worktree released empty.
- **Parity held — no event-sequence difference; show-stopper did NOT fire** (stated explicitly, not by
  silence). Decisive proof: ran the FINAL unmodified parity test file against stashed pre-change `registry.ts`
  (4 B1 rows green, 5 structural red) and against post-change (11/11 green) — identical frozen expectations
  on both trees.
- Parity test drives real `send_to_agent → user` through `Registry.handleMcpToolCall`, capturing ordered
  `status`/`session_status` events tagged by event name; frozen sequences: busy → `['session_status:ready',
  'status:ready']`, ready → `['session_status:ready']`, settled second call → `[]`, busy-after-settled →
  `['status:ready']`.
- Gates: `tsc -b` exit 0; suite **733/733, 87 files** (baseline 722/722, 86; +11 tests/+1 file all the new
  parity file; all 722 pre-existing still pass). Worker flagged the item's internal conflict ("unchanged at
  722/722" vs "a parity test exists") and the R3/B2 `'busy'` literal vs "only if it was busy" tension —
  resolved explicitly in-test with comments, not silently relaxed.
- R3: exactly one `busy` producer line remains in registry.ts (reconnect restore); driver untouched.
- R8 stated explicitly: wiring declined, branch deleted, reason written into the helper docblock.
- Out-of-scope respected: union narrowing (LB-66), `sessionStatus`, `apps/web/types.ts:46`, coordinators,
  `ALLOWED_TRANSITIONS`, `arbiter-coordinator.ts` untouched. Two stale prose references to the old symbol
  flagged but not fixed (`source-searchability.test.mjs:12`, `bl093-backlog-selectable.test.ts:274`).
- Retry budget: parity 2/3, source rows 2/2, tsc 1/2, suite 2/2 — no budget exceeded.
