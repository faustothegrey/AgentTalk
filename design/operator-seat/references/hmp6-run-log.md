# hmp6 run log — investigation rung, 2026-08-07

Run `hmp6`, backlog item **BL-120** (`setAgentBusyState(agent, true)` is unreachable, so an attached agent's
status never says `busy`). Investigation rung: deliverable is `design/bl120-attached-busy-investigation.md`,
committed to the task branch, **no code changed**.

## Commission (final, accepted)

```
AGENTTALK-RUN | run=hmp6 | brief=design/operator/hmp6-brief.md | repo-sha=2946e6f4936a11f9bad3f5f22b5303665581ebe1 | bar-sha256=8d8e98d1c9fe57cba82bf099111d07cf71753616e4700d0f19266183efa48476 | port=3600 | sandbox=att-op-hmp6
```

- Bar pre-registered sha256: `8d8e98d1c9fe57cba82bf099111d07cf71753616e4700d0f19266183efa48476`
- Verify pattern: `git show <repo-sha>:design/operator/hmp6.authorized` → exactly `[PO] AUTHORIZED-RUN: hmp6`
- Config: `wallClockMs 3600000` (60 min, set deliberately — read-only investigation), meter
  `{url http://127.0.0.1:9899, provider claude, maxPercentDelta 20}` (warning-only since BL-117),
  recording `/tmp/att-op-hmp6-recording.json`, workdir `/tmp/att-op-hmp6` (branch `task-op-hmp6`).

## Sequence (what worked)

1. Backlog via API — `curl http://127.0.0.1:3600/api/backlog?selectable=true` → exactly one item (BL-120).
   Backend was down; started it (`PORT=3600 npm run backend`, cwd AgentTalk), stopped it after the read.
2. Premise verified in code, not quoted — **coordinates had drifted** (item said `:533/:807-818/:1287`, actual
   `:548/:822-833/:1367`). PO later fixed the item (`0cd4c9c`) and advanced the worktree so the worker read the
   corrected backlog.
3. Worktree: `node scripts/wt-setup.mjs create op-hmp6 --base master --root /tmp` → `/tmp/att-op-hmp6`,
   CLAUDE.md→AGENT.md inherited.
4. Pre-flight: all 12 checks PASS. Meter baseline session 65% / weekly 20%.
5. **First launch attempt REFUSED**: `no-po-authorization` — PO had said "Authorized" in a message but the
   `.authorized` file was not committed at the repo-sha. Reported verbatim, did NOT write the file.
6. PO committed authorize `2946e6f`; re-snapshot (master had moved since the pre-flight baseline — the O-1
   trap); commission accepted; launched pid 33715.
7. Monitoring: `run-start` 12:05:10Z · `agent-launched` 12:05:14Z (pid 33799) · `goal-delivered` 12:05:14Z ·
   `outcome: completed` 12:14:44Z · `task-worktrees-released` 12:14:45Z. Wall-clock ≈ 9m34s. No cap-breach,
   no cap-warning. Port released; launcher and worker exited.

## Invariant harness (check BEFORE cleanup)

```
[CRITICAL] 1
  · tracked-file-modified: agenttalk: tracked file changed [M] — design/operator/.hmp-launched.json
```

This critical is EXPECTED on every launched run — the verifier's own `recordLaunch` writes the replay-guard
ledger at launch time. Operator-side activity, not worker activity. PO must clear it
(fingerprint `b0ddf98192bd` → `design/operator-dispositions.json`, committed) before the next operator run.
Process sweep: clean. Worktree list: primary `master` + `/private/tmp/att-op-hmp6` on `task-op-hmp6`
(partial cleanup — branch holds the deliverable for the PO gate).

## Worker outcome (observations only — no grading)

- Commit `0f7eb6a` on `task-op-hmp6`: ONE file, 280 insertions, at the **parent workdir**
  (`/tmp/att-op-hmp6/design/bl120-attached-busy-investigation.md`). Nested task worktree released empty.
- Worker's report (sidecar `/tmp/att-op-hmp6-recording.json.responses.ndjson`): scope declared (Rule 6),
  retry budget pre-registered; premise **half refuted with a live probe** — `setAgentBusyState`'s `true`
  branch IS unreachable and `sessionStatus` never becomes `busy`, BUT an attached agent's `status` DOES become
  `busy` via `InProcessAgentDriver.notifyAgentStatus` on every pulled turn (only the `Completer` differs), and
  the UI reads `agent.status` (already shows BUSY) while never reading `sessionStatus` (no `case
  'session_status'` in the web WS switch). Inventory: 21 readers of `agent.status`, 9 of `sessionStatus`,
  two load-bearing (ArbiterCoordinator strict `=== 'ready'`; ALLOWED_TRANSITIONS throws on illegal
  transition). Options O0–O4 weighed; recommendation **O2 — delete the dead branch and correct the record**,
  explicitly NOT implemented (Rule 2). Undetermined items stated in §7. Out-of-scope drift flagged not fixed
  (`apps/web/src/api/types.ts:46` `'reconnecting'` vs `'restarting'`).
- Diff quirk the worker flagged: `git diff master..task-op-hmp6` lists `design/operator/hmp6.authorized` as
  deleted — master moved past the branch point, not a worker change.

## Meter delta

Baseline session 65% / weekly 20% → post-run session 13% / weekly 21% (ok: True both times). Weekly +1pt; the
session figure falling is meter staleness/rollover — record as observed, do not explain. Worker's own reading
matched the operator's post-run curl (weekly 21%, session 13%).
