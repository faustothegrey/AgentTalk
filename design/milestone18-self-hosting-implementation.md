# Milestone 18 - Self-hosting Implementation Ledger

**Status:** In Progress
**Program:** `design/self-hosting-program-draft.md`
**Plan:** `design/milestone18-self-hosting-plan.md`
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
**Task-end Reviewer:** Claude.

## M18-T1 - BL-015 L0: scope manifest and `scope-check`

**Status:** `doing` (Implementer: Gemini)
**Branch:** `task-M18-T1`

### Coordination Evidence

- **Substrate events recorded:**
  - (Pending T1 deliveries and Gates)
- **Terminal fallback rows:**
  - `2026-07-09` - `planner POV relay` (SM -> Planner) - Pre-T1 coordination (plan inception)
  - `2026-07-09` - `plan baton` (SM -> Planner) - Pre-T1 coordination (plan execution)
  - `2026-07-09` - `Gate-1 result relay` (SM -> Implementer) - Pre-T1 coordination (hand-off to Implementer)
- **Relay count:** 3 (seeded)
- **Proof pointer:** (Pending recordings)

### Rule 6/7 Declaration (Gemini, 2026-07-09)

**Scope:**
- Define a machine-readable `@scope` manifest syntax next to the task ledger section (defined below).
- Add `scripts/scope-check.mjs` script that parses the active task's manifest from the ledger and compares changed paths against `allowed`, `forbidden`, and `free` globs.
- Document how to run it in the script itself and/or ledger.
- Prove it catches out-of-scope paths and passes in-scope paths.
- **Hard fence:** Zero `runtime-core` production changes. No L1/L2 scope shapes (provider hooks, fenced worktrees, baton-carried manifests).

**Approach:**
1. Use `git diff --name-only origin/master...HEAD` to get the list of changed files in the current task branch.
2. Parse the active task's `@scope` manifest from this ledger file. A simple regex/string parser will extract `allowed`, `forbidden`, and `free` lists.
3. Convert the globs to regular expressions (handling `**` and `*`).
4. For each changed file:
   - If it matches `free`, it's allowed.
   - If it matches `forbidden`, reject immediately.
   - If it matches `allowed`, it's allowed.
   - If it matches neither `free` nor `allowed`, reject it.
5. Exit with 0 if all changed files are in-scope, or 1 if any out-of-scope files are found.

**Per-check Verification Budgets (M18-T1):**
| Check | Max attempts | Current |
|---|---:|---:|
| `scope-check` parser/unit tests | 3 | 0 |
| out-of-scope negative fixture/probe | 3 | 0 |
| in-scope/free-path positive fixture/probe | 3 | 0 |
| documentation/ledger manifest drift check | 2 | 0 |
| `npx tsc -b` | 2 | 0 |
| targeted relevant tests | 2 | 0 |
| full `npm test` | 1 | 0 |
| `node scripts/m14-identity-harness.mjs --check` | 1 | 0 |
| `npm run backlog:check` | 1 | 0 |
| `git diff --check && git diff --cached --check` | 2 | 0 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 | 0 |

### M18-T1 Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone18-self-hosting-implementation.md
    - scripts/scope-check.mjs
    - scripts/__tests__/scope-check.test.mjs
    - design/milestone18-self-hosting-plan.md
    - design/self-hosting-program-draft.md
    - design/backlog.md
  forbidden:
    - packages/runtime-core/src/**/*.ts
  free:
    - design/logbook.md
```
