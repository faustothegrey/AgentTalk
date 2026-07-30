# BL-101 — the cross-repo contract check fail-opens in every worktree

**Status:** PLANNED, **Gate 1 APPROVED WITH AMENDMENTS** (§6) — ready to implement.
**Planner + Gate 1:** Claude, 2026-07-30 (resource-scarcity fallback; seats kept separately).
**Route not yet decided:** implement directly, or hand to a worker as the next autonomous rung — see §7.

---

## 1. The defect, and a live reproduction from today

`verifyClientAlignment` resolves the client contract as a **sibling of the script's own directory**
(`packages/contracts/scripts/verify-contract.js:28`). From the primary checkout that is
`/home/fausto/Software/agentalk-mcp-client` ✅. From a task worktree it is `/tmp/agentalk-mcp-client`, which does
not exist — and the code then **warns and returns** (`:36-43`), i.e. passes.

It fails **closed** only when `AGENTTALK_MCP_CLIENT_CONTRACT_PATH` is set. Unset — the normal case — a missing
client is a `warn` and a pass.

**Reproduced live 2026-07-30**, in the mirror direction, during BL-102's closure sweep from the client worktree
`/tmp/att-bl102c`:

```
Contract hash verified successfully (v8).
AgentTalk source wire contract not found; skipped source-alignment check.
```

**Why it matters more than a skipped check normally would.** The PO's MANDATE puts **all** code development in a
worktree, so the alignment check is off wherever anyone works and on only where nobody does. The failure it
guards is not hypothetical: the client sat **34 commits behind on wire contract v7 against the orchestrator's
v8**, which rejects the MCP handshake with `1008 Policy Violation` — silent until the handshake.

## 2. Ground truth (verified today, not inherited)

| Fact | Evidence |
|---|---|
| `git rev-parse --path-format=absolute --git-common-dir` returns the **primary**'s `.git` from both the primary and a worktree | probed: `/home/fausto/Software/AgentTalk/.git` in both cases |
| Plain `--git-common-dir` returns a **relative** `.git` from the primary | probed — **so the `--path-format=absolute` flag is load-bearing** |
| The check runs as the **first step of `npm test`** | `package.json:11` — `npm run test --workspace @agenttalk/contracts && vitest run` |
| **No test covers `verify-contract.js` in this repo** | exhaustive grep; the client has `contract-scripts.test.mjs`, AgentTalk has nothing |
| **The client has the exact mirror defect** | `agentalk-mcp-client/scripts/verify-contract.js:33,39-44` — same `__dirname`-relative resolve, same `existsSync` → warn → return |
| Both contracts are currently **v8 and aligned** | so a correct fix goes green today; staleness must be simulated to prove the bar |

## 3. Design — resolve from the primary checkout (item's option (a))

Replace `defaultClientContractPath()`'s `__dirname`-relative walk with:

1. `git rev-parse --path-format=absolute --git-common-dir` → `<primary>/.git`; take its `dirname` → the primary
   checkout root, **correct from inside a worktree**.
2. Sibling lookup from there: `<primary>/../agentalk-mcp-client/wire-contract.json`.
3. **Fall back to today's `__dirname`-relative path if git is unavailable or the command fails** (not a git
   repo, exported tarball, odd CI). The fallback must not throw.
4. `AGENTTALK_MCP_CLIENT_CONTRACT_PATH` keeps priority over everything, unchanged.

**Option (b) — invert the skip to fail-closed — is rejected**, and the item's own reasoning is right: alone it
would redden every worktree suite until someone sets an env var, which is how checks get disabled. (a) makes
the check *work* in worktrees instead of making it *shout* there.

**The residual fail-open is kept deliberately.** After (a), a genuinely absent client (someone cloned only
AgentTalk) still warns and passes. That is correct: the check's job is to catch *divergence*, not to mandate a
second repo. What changes is that the skip becomes **rare and true** instead of **routine and false**.

## 4. ⚠️ Consequence to accept before implementing, not discover after

**This couples every worktree's `npm test` to the state of a sibling repo.** Today the check never runs in
development; afterwards it does, so a genuinely stale client will **block all worktree development** until
someone syncs it — including an autonomous worker's suite run, for a defect it did not cause and cannot fix
(the client is a separate repo, and merges there are the PO's).

**That is the intended behaviour** — it is the whole point of catching v7/v8 before the handshake does — but it
is a real change in blast radius and the PO should accept it knowingly. The existing error message already names
the remedy (*"Run the client contract sync script…"*), which is what makes the block actionable rather than
mysterious.

## 5. DoD

| # | Row | Verified by |
|---|---|---|
| D1 | In a **fresh worktree**, the alignment check **runs** and reports success against the real client | `npm test` in the worktree → `Client contract alignment verified successfully.` — **NOT `npx vitest run`**, which skips the contract step entirely (see D5) |
| D2 | **The bar with teeth:** in that worktree, a **deliberately mismatched** client contract makes it **FAIL** | point `AGENTTALK_MCP_CLIENT_CONTRACT_PATH` at a doctored contract, or temporarily edit a copy → non-zero exit + `FATAL: … diverged` |
| D3 | The **primary checkout** behaves exactly as before | `npm test` in the primary → same output as today |
| D4 | Git-unavailable fallback does not throw | run the script with `PATH` stripped of git, or from a non-repo copy → falls back, no stack trace |
| D5 | Full suite green via **`npm test`** (not `npx vitest run`) — re-derive the count | `npm test` |
| D6 | New test coverage exists for the resolution logic — there is **none** today | a test that fails if resolution reverts to `__dirname`-relative |

**Mutation check (D2 *is* the mutation check, and it is the only row that proves anything).** A fail-open is
exactly the class where a green proves nothing: today's code "passes" in a worktree precisely by not looking.
**Watch it go red with a mismatched contract, or the fix is unverified.**

## 6. Gate 1 — plan-reviewer verdict

**APPROVED WITH AMENDMENTS** — Claude, plan-reviewer seat, 2026-07-30.

| # | Finding | Disposition |
|---|---|---|
| G1 | **The obvious bar would have been run with the wrong command.** Every suite run in this session used `npx vitest run`, which **does not execute the contract check at all** — it is a separate workspace script chained ahead of vitest (`package.json:11`). A DoD row saying "suite green" would have been satisfied without ever exercising the thing being fixed. | **Amended** — D1/D5 now specify `npm test` explicitly and say why. |
| G2 | **`--path-format=absolute` is load-bearing and was nearly omitted.** Plain `--git-common-dir` returns a *relative* `.git` from the primary; resolving that against the wrong cwd would silently reintroduce a path bug of the same family. | **Amended into §3.1**, with the probe recorded in §2. |
| G3 | **The plan understated the blast radius.** Making the check live means a stale client blocks *all* worktree development, including an autonomous worker's suite run for a defect it cannot fix. | **Amended — new §4.** Intended, but the PO accepts it knowingly rather than discovering it. |
| G4 | **No fallback ⇒ a new crash class.** `git rev-parse` throws outside a repo; the original code never did. | **Amended** — §3.3 requires a non-throwing fallback, pinned by D4. |
| G5 | **The client's mirror defect is real and out of the filed item's scope.** Verified at `agentalk-mcp-client/scripts/verify-contract.js:33`. | **Escalated, §7** — recommended as a separate branch/merge, **not bundled**. Bundling across repos is exactly the mistake made and corrected earlier today. |

**Checked and clear:** both contracts are v8 and aligned, so a correct fix passes today without any sync work —
which is *why* D2's deliberate mismatch is mandatory rather than optional.

## 7. Two decisions for the PO

1. **Scope — is the client mirror in or out?** Same defect, other repo, other merge. **Recommendation: file it
   separately and fix it next**, keeping this task single-repo. Bundling two repos into one task is precisely
   what went wrong with BL-100/BL-102 this morning.
2. **Route — who implements it?** It is bounded, test-local, touches no engine path, and arrives with a bar and
   a mutation check already written. **It is the strongest candidate for the next autonomous rung**, which would
   also un-idle the empty selectable queue and produce the first-ever worker commit authored under
   [[BL-102]]'s new identity. Marking it `autonomy: eligible` is a **PO act** and will redden
   `bl093-backlog-selectable.test.ts` by design — that red is the mechanism working.
