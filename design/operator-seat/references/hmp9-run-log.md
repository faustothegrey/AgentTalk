# hmp9 run log — first DOCS-ONLY rung, 2026-08-13

Run `hmp9`, backlog item **BL-125** — `design/archive/bl124-s2-deploy.md` §5 claims the non-reply sink writes a
`{"kind":"boot"}` line at every boot; it does not (the marker is emitted inside `NonReplySink`'s private
`write()` behind `bootPending`, and `write()` is reached only by a notice). **First docs-only rung** — one
file, one paragraph, and the paragraph is **half true**. The item was filed while executing the very document
it corrects (S2 deploy verification, 2026-08-13).

## Commission state

- PO pre-committed everything before the operator was involved: `2c1c1b8` prep(hmp9) = brief + bar + config;
  `94ecbae` authorize(hmp9) = `design/operator/hmp9.authorized` (`[PO] AUTHORIZED-RUN: hmp9`). Worktree
  `/private/tmp/att-op-hmp9` on `task-op-hmp9` branched at `2c1c1b8` — i.e. the worktree **predates** the
  authorize commit (this is the phantom-diff trap below).
- bar-sha256 from committed blob @ master: `45b6e2c2d4a254d7cce5207eb66939defd185ce70e8db978881b0a211b17db90`.
- Config: `wallClockMs 2400000` (40 min — docs-only, "generous for the work"), meter claude Δ20 (warning-only
  since BL-117), recording `/tmp/att-op-hmp9-recording.json`,
  `AGENTTALK_NON_REPLY_SINK_PATH=/tmp/att-op-hmp9-non-reply.jsonl` — **containment, not configuration**: the
  sink default is machine-global off `os.homedir()`, so an unredirected operator backend would append into the
  LIVE BL-124 measurement at `~/.agenttalk/agent-non-reply.jsonl`, indistinguishable from real traffic. First
  operator run for which this hazard exists (S1 deployed the sink to the live orchestrator the same day).

## Pre-flight (12/12 PASS) + commission

- All 12 checks passed; meter live `ok: True | session: 19% | weekly: 7%` (baseline recorded); BL-125
  selectable via API; `validateConfig` OK; recursion-fence `NONE (pass)` on the brief AND on the goal string
  inside the config (both must be scanned — hmp7 pattern).
- **Dry-run first**: `node scripts/hmp-commission.mjs --text-file <file> --dry-run` →
  `accepted: run=hmp9 … dry-run: verified only, nothing launched`, exit 0. Then the real commission →
  `accepted … launched: pid 16404`. The dry-run touches nothing (no ledger write, no launch) and catches a
  malformed line or stale bar hash before the replay guard is armed — do it every time.
- Reference values: worktree HEAD `2c1c1b8` · mainline HEAD `94ecbae` · harness blob `34785b85…`; invariant
  snapshot `/tmp/att-invariant/hmp9-before.json` as the LAST pre-launch action.

## Timeline (cap 40 min)

- `run-start` 19:52:34Z (goal verbatim) · `agent-launched` 19:52:38Z (pid 16488) · `goal-delivered` 19:52:38Z
- `outcome: completed` **19:55:18Z — wall-clock 2m44s** · `task-worktrees-released` 19:55:18Z (nested removed
  by the orchestrator). Docs-only runs are fast; a 40-min cap is generous.

## Worker outcome (observations only — no grading)

- Commit `4bdeae7` on `task-op-hmp9` at the **parent workdir**: `design/archive/bl124-s2-deploy.md` (+15/−3).
  `git diff --stat 2c1c1b8..4bdeae7` = **exactly one file**.
- Verified by SYMBOL (item + brief both insisted): `bootPending` consumed inside `write()`; `write()`'s only
  caller is `record()`; constructor opens nothing; the wiring comment above `new NonReplySink` in `server.ts`
  quoted ("Nothing is opened until a notice actually arrives"). Live corroboration independent of the brief:
  `~/.agenttalk` absent after the S1 deploy + restart — the state §5 declared impossible.
- Corrected **in place**, did not delete the half-true paragraph: boot line written on the **first notice** of
  a boot; consequence stated (a zero-notice boot leaves no boot line, absent `~/.agenttalk/` after a restart =
  expected state, not failed deploy); the per-boot reduction rule preserved (grep `reduce across` at the new
  line) + one new corollary (a zero-notice boot leaves no line to reduce across, so a restart can split the
  measurement without a visible marker).
- No show-stopper ("the document was wrong, not the code"). **No suite run** — declared explicitly as a named
  gap ("docs-only, nothing for tsc to exercise"), not claimed green.
- Out-of-scope, **reported not fixed**: §5's `tail -f ~/.agenttalk/agent-non-reply.jsonl` snippet fails with
  *No such file* on a fresh machine — flagged as worth a follow-up item.

## Operator-side pitfalls surfaced (all three added to SKILL.md)

1. **Phantom `.authorized` deletion in `master..<branch>` diffs.** `git diff master..task-op-hmp9` showed 2
   files including `design/operator/hmp9.authorized | 1 -` — a branch-point artifact: master advanced to the
   authorize commit AFTER the worktree branched, so the worker's branch legitimately lacks that file. Diffing
   against the recorded branch point (`2c1c1b8..4bdeae7`) = exactly 1 file. **Diff against the branch point,
   never against master.**
2. **Sidecar name.** Recording `/tmp/att-op-hmp9-recording.json` → sidecar
   `/tmp/att-op-hmp9-recording.json.responses.ndjson` — the FULL recording path including its `.json`
   extension, plus `.responses.ndjson`. First guess dropping the extension (`…-recording.responses.ndjson`)
   failed.
3. **Ledger `M` again.** `.hmp-launched.json` gained the hmp9 entry (uncommitted) — flag to the PO to commit
   before the next operator run. Harness check: exit 0, one expected INFO (`tracked-file-modified` ledger),
   no criticals, no warns.

## Cleanup (partial, write-run)

Nested task worktree already released by the orchestrator; `git worktree prune`; parent worktree +
`task-op-hmp9` kept (the only copy of the deliverable, awaiting PO merge). Port 3600 free; process sweep
clean. Ledger verified directly: `launched` lists hmp9.
