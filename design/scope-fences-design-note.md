# Deterministic Scope Fences — design note (BL-015)

**Status:** 🟡 DRAFT — altitude only; no code before a backlog gate slots it (PO+Architect, 2026-07-08).
**Owner:** Architect (Claude). **Origin:** PO idea, refined in session, mid-M16.
**Evidence:** M16-T2a out-of-scope changes (acknowledged) + case law IP-2 / IP-9 / IP-12 / IP-13 —
different agents, same broken *behavioral* rule.

## Thesis — move the fence from policy to mechanism

Today the implementer scope fence is prose (RoE Rule 2/3, per-task Allowed/Forbidden surfaces) enforced by
self-discipline at the exact moment discipline is weakest (mid-task, green in sight). Post-hoc review catches
violations at the gates — after tokens are burned and diffs entangled. The fix is the classic one: **the
environment refuses (or loudly flags) out-of-scope acts; the agent no longer has to be trusted to stop.**

```
   plan/ledger task section                      enforcement layers
  ┌──────────────────────────┐         ┌────────────────────────────────────┐
  │ Allowed/Forbidden prose  │ ──────► │ L0  scope-check script (detective) │
  │  + @scope manifest       │         │ L1  provider write-guards (prevent)│
  │  (allowed/forbidden      │         │ L2  substrate-administered fence   │
  │   globs, machine-read)   │         │     (baton-carried, recorded)      │
  └──────────────────────────┘         └────────────────────────────────────┘
        single policy source                escalating strength, built in order
```

## The manifest (policy source — exists already, formalize it)

Each ledger task already declares Allowed/Forbidden surfaces in prose. Add a machine-readable sibling, in the
ledger next to the task (single source, one home), using the proven M13 `@item`-header pattern:

```
<!-- @scope task: M16-T2a
allowed:   [packages/runtime-core/src/registry/registry.ts, packages/runtime-core/src/conversations/runtime.ts, ...]
forbidden: [packages/runtime-core/src/registry/team-coordinator.ts, ...]
free:      ["**/__tests__/**", "design/**", scratchpad]   # always writable — freedom inside the box
-->
```

Prose stays the human record; the header is authoritative for tooling; drift between them is a gate warning
(same discipline as `backlog:check`).

## The layers (build strictly in this order)

- **L0 — `scope-check` script (detective; ≈ a day; candidate M18 rider).** Parses the active task's `@scope`,
  diffs `git status`/`git diff --name-only` against the globs, exits non-zero with the violating paths. Run at
  the implementer's Rule-5 self-check, at gates 2/3, and in CI. Catches violations *within the session, before
  the claim* — no infrastructure.
- **L1 — provider write-guards (preventive; per-provider).** The agent's own harness refuses the write: Claude
  Code PreToolUse hook blocking Edit/Write outside the manifest; Codex/Gemini sandbox configs where available.
  Weakest portability — treat as best-effort hardening on top of L0, never the only fence.
- **L2 — substrate-administered (preventive + observable; rides the self-hosting ladder).** The baton carries
  the manifest; launch machinery provisions the task branch + a fenced worktree (kills IP-12 structurally);
  violations are **recorded runtime events** the flywheel counts like relays. **Gate L2 together with BL-014
  (role-skill injection) at M19: two halves of one thing — the seat's law, served AND enforced at attach.**
- *(Backstop, ranked below all file fences: a time/tool-call circuit breaker — interrupt after N minutes or M
  tool calls without a filed checkpoint. Proxy signal only; it cannot distinguish honest debugging from creep.)*

## Binding design principles

1. **Stopping must be cheaper than proceeding.** The refusal message IS the deviation-report template
   ("outside M16-T2a's fence — file a deviation row; here's the shape"). The violation moment becomes the
   report moment.
2. **Fences are amended only at gates.** The M16-T2a flow (hit wall → report → planner amendment → Gate 1
   ruling → manifest widened) is the *only* widening path — made physical, not changed.
3. **Freedom inside the box is sacred.** Tests, scratchpad, ledger stay writable (`free:` globs); over-fencing
   manufactures fake blockers and teaches agents to game the fence — strictly worse than today.
4. **Necessary, not sufficient.** File fences don't catch semantic pokes (M15's `as any` into frozen state
   from an allowed file) or mock-arounds (IP-13). The reviewer's grep-and-run duties are unchanged.

## Non-goals

No authority/identity enforcement (M17 owns that); no new UI; no changes to the 3-gate workflow itself; no
attempt to fence LLM *reasoning* — only its writes.
