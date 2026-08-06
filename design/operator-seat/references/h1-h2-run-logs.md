# H-1 and H-2 run records — 2026-07-27

Record of the first two operator-launched runs in the AgentTalk H-ladder. Preserved so future
operator sessions have baseline timelines, budget readings, and artifact patterns to compare against.

---

## H-1 — read-only (total cleanup)

**Goal (verbatim):** "Report this repository's current HEAD commit sha and the total number of tests in the
suite, giving for each the exact command you ran and its actual output. Change no files."

**Config:**
- Worktree: `/private/tmp/att-op-h1` (from `wt-setup.mjs create op-h1`, branch `task-op-h1`)
- Port: 3600
- Provider: claude, model: opus
- Meter: session 46%, weekly 23%
- cap.wallClockMs: 900000 (15 min)
- Recording: `runs/h1-readonly-rerun.ndjson`

**Timeline:**
| Event | Time (UTC) | Delta |
|-------|------------|-------|
| run-start | 15:57:39 | — |
| goal-delivered | 15:57:42 | 3s |
| outcome completed | 15:58:32 | 50s |

**Worker's report:**
- HEAD: `cad7ba94` (docs(H-1): add the brief itself)
- Tests: **480 across 75 files**, all passing
- Show-stopper: `git status --porcelain` — zero tracked files modified
- Usage: 751 prompt tokens, 1926 completion tokens

**Harness check:** exit 0, two `info` (nested worktree + branch). No critical, no warn.

**Process sweep:** empty.

**Cleanup:** TOTAL — both nested and parent worktrees removed, both branches deleted.

---

## H-2 — write + commit (partial cleanup)

**Goal (verbatim):** "Investigate backlog item BL-092 — a latent flake in the BL-048 broadcast test where the
WebSocket handshake intermittently gets a 403 from a server that is not ours — and write a design document at
design/bl092-investigation.md weighing its recorded options and recommending one, with reasons. Commit that
document to your branch; change no code."

**Config:**
- Worktree: `/private/tmp/att-op-h2` (from `wt-setup.mjs create op-h2`, branch `task-op-h2`)
- Port: 3600
- Provider: claude, model: opus
- Meter: session 57%, weekly 24%
- cap.wallClockMs: 1200000 (20 min)
- Recording: `runs/h2-bl092-investigation.ndjson`

**Timeline:**
| Event | Time (UTC) | Delta |
|-------|------------|-------|
| run-start | 16:05:13 | — |
| goal-delivered | 16:05:15 | 2s |
| outcome completed | 16:10:36 | 5m 21s |

**Worker's report summary:**
Worker produced a 173-line design document at `design/bl092-investigation.md`, committed as `285e831` on
branch `task-op-h2`. Key findings (from the worker's own sidecar, repeated here only for reference):

1. **Refuted BL-092's leading hypothesis:** MCP server does not emit 403 (uses post-handshake close codes
   4001/4003/1008). Source of the 403 remains unidentified.
2. **Refuted option B:** dialing `server.address()` at connect time dials the same wrong listener — the
   option's premise is wrong.
3. **Option A off-target:** test dials the HTTP port, never the MCP port.
4. **Surfaced mechanism (not confirmed):** `server.listen(port)` no host → wildcard bind, test dials
   `127.0.0.1`, kernel routes by specificity. 700 trials produced 0 collisions — rare path.
5. **Recommendation: option D** — instrument `openSocket()` to catch `ws`'s `unexpected-response` event.
6. **Corrected two claims in BL-092's entry:** only 2 test files bind a listener (not "whole suite"), and
   binding `127.0.0.1` would break LAN UI access.

**Artifact location:** parent workdir only (`/private/tmp/att-op-h2/design/bl092-investigation.md`). Nested
`agentalk-task-*` worktree had no deliverable — matches runbook §8.4 (claude works in parent).

**Show-stopper fence:** `git diff --stat master...HEAD` → 1 file, +173. Harness blob hash unchanged.

**Harness check:** exit 0, two `info` (nested worktree + branch). No critical, no warn.

**Process sweep:** empty.

**Cleanup:** PARTIAL — nested worktree removed, parent worktree `att-op-h2` and branch `task-op-h2` left in
place (only copy of the deliverable).
