# Milestone 09 — MCP-vocabulary removal (`mcp` → `api`/`mcp`) — Plan

**Status:** **PLAN — drafted, awaiting review/approval. NOT started.** Planner = Claude. Scope re-surveyed
against current code 2026-06-24 (post-M08; the 2026-06-22 backlog survey predates the monorepo split and its
file paths are stale — this plan supersedes those paths).

**Milestone framing:** promoted from the backlog item *"Rename `mcp` → `mcp`/`api`"* (assessed 2026-06-22).
Fausto reprioritised this **ahead of consensus/protocol robustness** (2026-06-24, "change of heart"). Proposed
numbering: **this = M09**; the former M09 (consensus/protocol robustness, spike-led) **moves to M10**. That
former milestone was only ever a *label* (never opened/planned), so the renumber is low-churn — **confirm the
numbering before merge.**

**Source:** backlog `design/backlog.md` (mcp→mcp/api item + `provider`-union item); decisions Fausto↔Claude
2026-06-22 and 2026-06-24.

---

## 1. Goal & rationale

Drop the **"mcp" vocabulary** from the codebase. An agent client is exactly one of:
- **`api`** — in-process (the orchestrator drives an API provider directly), or
- **`mcp`** — externally launched, attaches over MCP (the old `mcp` / exec-RPC / attach path).

The taxonomy `api` vs `mcp` matches M05/M07 attach-mode and the sibling `agentalk-mcp-client` repo. The
`gemini`/`claude`/`codex` provider values **stay** (they carry no "mcp" string; their own taxonomy debt is a
separate backlog item). This is a **naming/clarity** milestone — **behaviour must be preserved byte-for-byte**.

```
BEFORE  agent provider: string (untyped)        AFTER  provider: AgentProvider (union)
  'api'      ── in-process                         'api'    (unchanged)
  'mcp' ── exec-RPC / MCP attach   ───────►    'mcp'    ← the rename
  'gemini' / 'claude' / 'codex'  ── model identity, LEFT AS-IS (separate item)
```

## 2. Settled decisions

| # | Decision | Choice (Fausto) |
|---|---|---|
| D1 | Sequencing / de-risk | **Union-type `provider` FIRST**, then flip the value — compiler-safe |
| D2 | `provider:'mcp'` value | → **`'mcp'`** |
| D3 | Identifier form | **`McpCompleter` / `McpError`** (drop "exec") |
| D4 | `scenario-runner.ts` (app's own MCP entrypoint — a *different* "mcp") | → **`scenario-runner.ts`** |
| D5 | `gemini`/`claude`/`codex` values | **leave** (separate taxonomy-debt item) |
| D6 | Docs + history | **REVISED 2026-06-25 (Fausto):** **zero** `mcp`/`Mcp` anywhere — rewrite **all** `design/*.md` incl. historical ledgers/logbook to `mcp` (findings stay true under the new name), **delete** the `spikes/*.mjs`, and **squash git history** at milestone close so no commit-message/diff trace remains. **No retained-mention note.** Supersedes the original "keep git history by design". Sole exceptions: **third-party names** (e.g. the `google-gemini/gemini-mcp` URL) and the **self-referential M09/backlog docs** that must name the old token to describe the rename (resolved at close — see open item). |

## 3. The two-axes caveat (critical — do not conflate)

There are **two unrelated `provider` fields**:
- **Agent provider** — `agent.provider?: string` (`agents/agent.ts:29`), the `api`/`mcp`/`gemini`/… axis.
  **This is the rename target.**
- **API-vendor provider** — `ApiProvider` in `agents/api-client.ts` (`openrouter`/`nous`/`google`). **Already a
  typed union; OUT OF SCOPE.** Do not touch.

The new union (`AgentProvider`) types the **agent** axis only.

## 4. Scope — verified sites (current paths)

**IN scope:**
- **Discriminant (the one behaviour-relevant site):** `registry/registry.ts:210, 322` — branches the turn path
  (`awaitExecTurn()` vs `awaitTurn()`) on `provider === 'mcp'`.
- **Agent-provider type sites (for the union):** `agents/agent.ts:29`, `registry/registry.ts:137,182,663`,
  `registry/team-coordinator.ts:134`, `runtime-scenarios/src/scenarios/types.ts:5` (and any sites tsc surfaces).
- **Identifiers:** `McpCompleter` (16) / `McpError` (23) in `agents/completer.ts`,
  `agents/in-process-driver.ts`, + tests `agents/__tests__/completer.test.ts`,
  `agents/__tests__/in-process-driver.test.ts`.
- **`'mcp'` string** also in pkg tests `registry/__tests__/mcp-agent.test.ts`,
  `mcp-noresend.test.ts`, `team-mcp-consensus.test.ts`; and scripts `test-mcp-provider.mjs`,
  `test-mcp-gate.mjs`, `m07-t3b2-live-worker.mjs`, `test-live-gate.mjs`.
- **Filenames:** the 3 pkg test files + 2 scripts above (rename + import fixups), and `scenario-runner.ts`.
- **`scenario-runner.ts` → `scenario-runner.ts`:** + `apps/orchestrator/package.json:9` + `npm run scenario` chain.
- **Docs:** the `design/*.md` set that mentions `mcp` / `Mcp*` / `scenario-runner` (content only).

**OUT of scope (do NOT touch):**
- `api-client.ts` `ApiProvider` and `apps/web/src/api/client.ts` — these are **"client"**/API-vendor, not "mcp".
- `gemini`/`claude`/`codex` values (D5). **Third-party names** (the `google-gemini/gemini-mcp` URL).

> **⚠️ Scope-gap found 2026-06-25 (T7 sweep) — RESOLVED.** This §4 survey listed `scripts/` but **omitted
> `spikes/`** — so T2's value-flip never reached `spikes/m07-t3-*.mjs`, which still passed `provider:'mcp'`.
> **Resolution (Fausto, 2026-06-25): the 5 spike scripts were deleted** (M07-T3 session-memory probes; findings
> already preserved in logbook LB-2…LB-5 + the M07 ledger; recoverable via git history). The gap is closed by
> removal, not by flipping the value.

## 5. Task breakdown & sequencing

- **T1 — Type the agent provider as a union (prerequisite, D1).** Define
  `type AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex'` (in `contracts` or `agent.ts`), change
  the agent-axis `provider?: string` sites to `provider?: AgentProvider`. Fix whatever tsc flags. **Behaviour
  unchanged**; value still `'mcp'` at this point. Gate: `tsc -b` 0, full suite green. *Independently
  valuable; mergeable on its own.*
- **T2 — Flip the value `'mcp' → 'mcp'` (D2).** With the union in place, change the member and let the
  compiler enumerate every site (discriminant branches, tests, scripts). Update the union to
  `'api' | 'mcp' | 'gemini' | 'claude' | 'codex'`.
- **T3 — Rename identifiers `Mcp* → Mcp*` (D3).** tsc-guarded rename across `completer.ts`,
  `in-process-driver.ts`, tests.
- **T4 — Rename files** (3 pkg tests + 2 scripts) + fix imports/refs.
- **T5 — `scenario-runner.ts → scenario-runner.ts` (D4)** + `package.json:9` + `npm run scenario` chain + doc refs.
- **T6 — Docs + history rewrite (D6, REVISED).** Rewrite **all** `design/*.md` (incl. historical M07/M08
  ledgers + logbook) so `mcp`/`Mcp` → `mcp`/`Mcp` — **zero** mentions, no retained-note. **Done so far
  (2026-06-25):** spikes deleted; safe historical set rewritten (M07/M08 ledgers+plans, logbook,
  implementer-pitfalls, test/script comments) — 158 lines, 0 remaining there. **Left:** the self-referential docs
  (M09 plan/ledger, backlog M09 item, primer) — resolved at close per the open item; the `mcp-capability-assessment.md`
  filename → T-file-rename; `git` trace → squash at close.
- **T7 — Full `mcp` vocabulary sweep & verification gate (Fausto, 2026-06-25).** A *broader* audit than the
  `mcp`/`Mcp`-only checks above: sweep the **whole project** (code **incl. inline comments**, docs, scripts,
  **and `spikes/`**) for the character sequences **`mcp `** (mcp + space) and **`mcp-`**, classify every hit, and
  drive it to **zero except an explicit, documented retained-allowlist** (history/old-name references — e.g.
  `types.ts:11`'s "was 'mcp'", git-log mentions by design per D6, and the milestone's own doc filenames). This
  is the closing **verification gate** for M09. Catches what the narrow grep misses: fixture/agent-name strings
  (`mcp-agent-1`/`mcp-worker-1`/`mcp-planner-1`), the **`spikes/*.mjs` that still carry `provider:'mcp'`** (see
  §4 scope-gap note), and stray prose. **Baseline at creation (2026-06-25, post-T3-on-branch):** ~225 real hits —
  173 `.md`, 20 `.ts`, 32 `.mjs`; 5 code filenames + 3 doc filenames. Decide per-class: rename vs intentionally-retain.

Order: **T1 → (T2, T3 together) → T4 → T5 → T6 → T7 (gate).** T1 is separately confirmable/mergeable (it's the only
step with a type-system footprint beyond pure renaming). Each task: `tsc -b` 0 + full suite green before the next.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Untyped magic-string discriminant → missed site silently misroutes an agent | **T1 union typing first** makes every site compiler-visible (D1) |
| Conflating the two `provider` axes (agent vs API-vendor) | §3 — touch only `AgentProvider`; leave `ApiProvider` |
| Renaming "client" files by mistake | Explicit OUT list (§4); grep `mcp`/`Mcp`, not loose `mcp` |
| Behaviour drift in the discriminant | tests are behaviour contracts — rename test *names/files*, never their assertions; suite must stay byte-for-byte green |
| Tests touching the worker/consensus provisioning path pollute the repo (LB-9) | keep the existing `execSync`/`existsSync` mocks; check `git worktree`/`git branch`/`/tmp` after runs |

## 7. Definition of Done

1. `tsc -b` clean; **full suite green with the same test count** (renamed tests, **unchanged assertions**).
2. `grep -rn "mcp\|Mcp" packages apps scripts --include=*.ts --include=*.mjs --include=*.json`
   (excluding `dist`/`node_modules`) returns **nothing** — except where intentionally retained.
2b. **(T7, broadened)** A whole-project sweep for **`mcp `** and **`mcp-`** — `git grep -nE 'mcp |mcp-'`
   (excl. `node_modules`/`dist`/`package-lock`, **incl. `spikes/` and inline comments**) — returns **nothing
   outside the documented retained-allowlist** (history/old-name refs, git-log by D6, milestone doc filenames).
3. `scenario-runner` gone from source + `package.json`; `npm run scenario` still works.
4. `design/*.md` content carries **no** `mcp`/`Mcp*`/`scenario-runner` — **including historical entries**
   (D6 REVISED: history rewritten, not excepted) — save the third-party `gemini-mcp` URL and the self-referential
   docs resolved at close. Git trace removed by the close squash.
5. **No behaviour change** — the discriminant routes identically; verified by the unchanged suite.
6. Repo clean post-test-runs (no `/tmp/agentalk-*`, no stray `task-*` branches/worktrees — LB-9).

## 8. Open items (confirm before/at merge)

- **✅ RESOLVED — all legacy-token prose removed (Fausto, 2026-06-25).** The earlier "self-referential docs" and
  "generic legacy prose" questions are settled: **literal/maximal** — every legacy token becomes `mcp`/`MCP`
  everywhere (docs incl. history, AGENT.md, diagrams, fixtures, identifiers, **and self-referential before→after**),
  accepting the accuracy gap (the before/after now reads "old `'mcp'` → new `'mcp'`"; the externally-launched value
  is simply named `'mcp'`). **Sole surviving `cli`:** the functional `google-gemini/gemini-cli` GitHub URLs
  (renaming = dead 404). Git-log trace removed by the **close squash**.
- **✅ DONE — file/identifier renames:** `mcp-capability-assessment.md`, the `mcp-*` test files + `test-mcp-*`
  scripts (T4), `scenario-runner.ts` (T5), the milestone docs themselves (`milestone09-mcp-vocabulary-removal-*`),
  and agent-name fixtures (`mcp-worker-1` etc.).
- **Milestone numbering** — accept M09 = this, consensus/robustness → M10? (low-churn; confirm.) *(still open)*
- **✅ Union location** — settled at T1: lives in `@agenttalk/contracts` (`provider` crosses the package boundary).
