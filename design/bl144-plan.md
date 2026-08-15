# BL-144 — Wave 2: modules that own their code, their docs, and their backlog slice

**Status:** DRAFT — awaiting Gate 1. **Planner:** Claude (sole-agent resource-scarcity fallback).
**Written:** 2026-08-15. **Item:** [[BL-144]] (`design/backlog/85-governance.md`).
**Predecessors:** Wave 0 (`0b8bee5`, evict episodic records), Wave 1 (`b12c0ee`, backlog → directory),
[[BL-141]] (`npm run docs:check`), [[BL-142]] (citation disposition), [[BL-143]] (backlog gate tiers).

---

## 1. What Wave 2 is actually for

The PO's diagnosis, and the measurements behind it, both say the same thing: **the code was already
decomposed** — 8 packages, 2 apps, a clean DAG, zero boundary escapes — and **the collapse was entirely
in the artifacts describing the work**, which had no modules, no dependency graph, no dead-code
elimination and no CI. Waves 0 and 1 gave the artifacts the first two. [[BL-141]] gave them the fourth.

So Wave 2's product is **ownership**: every piece of code and every durable document belongs to exactly
one named module, that ownership is declared in a file, and a gate proves it. That is what unlocks
[[BL-141]]'s deferred ambitious half — *a module may cite only its own module, its declared code
dependencies, and `governance/`* — which was parked precisely because "BL-144's module layout" did not
exist yet.

## 2. Two planning findings that change BL-144 as filed

BL-144 says *"move code into `modules/`, carrying its durable docs and backlog slice with it."*
Reading the code before planning against that sentence turned up two reasons to amend it. Both are
recorded here rather than absorbed silently, because the item's own text invited the challenge.

### Finding 1 — the backlog must NOT disperse into modules. It is a containment fence.

`design/backlog/**` is not merely where the backlog lives. It is a **path in the operator seat's write
allowlist** — the narrow, fenced surface on which a seat holding *no authority* is permitted to file
items. It is named as such in six places:

| Site | What it does |
|---|---|
| `AGENT.md:207` | the OPERATOR charter's write fence |
| `AGENT.md:251` | prefers `GET /api/backlog` "over parsing `design/backlog/**`" |
| `AGENT.md:315` | the path allowlist proper — "Nothing else." |
| `design/operator-seat/SKILL.md:25` | the live instruction the seat actually reads |
| `scripts/infra-invariant.mjs:83` | the allowlist comment |
| `scripts/infra-invariant.mjs:918` | the operator-write carve-out |

Dispersing the backlog to `modules/<name>/backlog.md` forces that fence to either **widen to
`modules/**`** — which is where durable law and code manifests would then live, handing the operator a
write path over the project's governance — or **shrink to nothing**, removing the seat's ability to file
at all. Neither is acceptable, and neither is in BL-144's scope.

**Decision: the backlog stays at `design/backlog/`.** A module *owns* its slice by **declaring** it
(`backlog: "40-backlog.md"`), not by relocating it. Ownership is the product; adjacency is one possible
means, and here it is the one that costs a safety property. This also preserves, untouched, the two
parsers Wave 1 put in step (`readBacklog()` and `infra-invariant.mjs`'s `readBacklogText`), the BL-097
drift bar that pins *where*, `check-doc-citations.mjs`'s exclusion, and `operator-run.expect.json`.

### Finding 2 — code does not move either, and the reason is the same shape.

BL-144's cheapest-first ordering (`backlog/` "imports `fs` and `path` and nothing else") reads as an
argument that moving code is cheap. It is cheap for *that file*. It is not cheap in general: the code
is a **TypeScript project-references build** (`tsconfig.base.json`, per-package `tsconfig.json`, npm
workspaces), so moving a package rewrites the build graph — and Implementer Rule 2 makes any
non-trivial change to shared build wiring a show-stopper, not a chore.

**Verified at Gate 1 rather than asserted, because the first draft of this paragraph cited the build
loosely and would have rested a refusal on a vague claim:** root `tsconfig.json` declares **9 project
references**; **6** per-package `tsconfig.json` files declare their own; `tsconfig.base.json` carries
`compilerOptions.paths` aliases; and `package.json` `workspaces` is `["apps/*", "packages/*"]` — a
two-glob list under which a `modules/*` location is **not a workspace at all**. So relocating one
package rewrites four coupled things, none of which Wave 2 needs rewritten.

More to the point, it buys nothing Wave 2 needs. The value BL-144 names is *"nothing forces a reader
touching the code to touch the claim."* **A gate forces that; a directory only invites it.** A manifest
that declares `code: ["packages/mcp-transport/**"]` and is checked for total, non-overlapping coverage
goes **red** when a code path appears that no module claims — which is exactly the forcing function,
available without touching a build graph that currently works.

**Decision: `modules/<name>/` holds the manifest, the module's durable docs, and its README charter.
Code stays where it is and is *claimed* by glob.** If a later wave proves the boundaries are right and
wants physical adjacency, it can move code with the manifest already telling it what belongs together.

> **What this plan therefore delivers, stated plainly so it cannot be oversold:** a declared,
> gated ownership graph over code and docs, plus the durable-doc relocation. It does **not** relocate
> code and it does **not** relocate the backlog. Both refusals are argued above; neither is a deferral
> for convenience.

## 3. The module set

Derived from Wave 1's backlog taxonomy — that concern split is already merged and has survived three
tasks, so it is the project's existing, tested vocabulary rather than a new one invented here.

| Module | Owns (code) | Backlog slice |
|---|---|---|
| `team-orchestration` | `packages/runtime-core/src/{registry,conversations,protocol}`, `packages/runtime-scenarios` | `10-team-orchestration.md` |
| `agent-runtime` | `packages/runtime-core/src/agents`, `packages/llm-client` | `20-agent-runtime.md` |
| `mcp-transport` | `packages/mcp-transport`, `packages/mcp-exec-server` | `30-mcp-transport.md` |
| `backlog` | `apps/orchestrator/src/backlog.ts`, `scripts/validate-backlog.mjs` | `40-backlog.md` |
| `containment` | `scripts/{infra-invariant,hmp-commission,wt-setup,scope-check}.mjs`, `design/operator-seat/**` | `50-containment.md` |
| `relay` | `scripts/relay-*.mjs` | `60-relay.md` |
| `consensus-lab` | `scripts/arbiter-*.mjs` | `70-consensus-lab.md` |
| `host-ui` | `apps/web` | `80-host-ui.md` |
| `governance` | `scripts/check-doc-citations.mjs` | `85-governance.md` |
| `orchestrator-host` | `apps/orchestrator` (less `backlog.ts`) | — |
| `contracts` | `packages/contracts`, `packages/runtime-core/src/shared` | — |
| `observability` | `packages/observability`, `scripts/usage.mjs` | — |
| `integrations` | `packages/integration-google-drive` | — |

Three modules own no backlog slice. That is recorded as `backlog: null`, not papered over: it is a true
statement that nothing is currently filed against them.

## 4. Deliverables

### T1 — the manifest format and the gate *(code; conservation: coverage + uniqueness)*

`modules/<name>/module.json`:

```jsonc
{
  "name": "backlog",
  "summary": "one line",
  "code":    ["apps/orchestrator/src/backlog.ts", "scripts/validate-backlog.mjs"],
  "docs":    ["design/…"],            // durable docs, filled in T2
  "backlog": "40-backlog.md",         // a filename under design/backlog/, or null
  "deps":    ["contracts"]            // module names
}
```

`scripts/check-modules.mjs`, wired as `npm run modules:check`, asserting:

1. every `module.json` parses; names unique and equal to the directory name;
2. `deps` resolve to existing modules; **the dep graph is acyclic**;
3. `backlog` names a file that exists under `design/backlog/`; no two modules claim the same slice;
4. **coverage** — every tracked path in the universe matches ≥1 module's `code` globs, or is on an
   explicit, commented `UNOWNED` list;
5. **uniqueness** — no tracked path matches two modules' `code` globs;
6. `docs` entries exist, and no doc is claimed twice.

Universe = tracked files under `apps/`, `packages/`, `scripts/` excluding `**/__tests__/**`,
`**/dist/**`, `scripts/archive/**`, and non-source assets. The exclusions are declared in the script
with a reason each, and the `UNOWNED` list is a *visible debt register*, in the ratchet style
[[BL-141]] established.

**Path matching uses a path-boundary matcher, never a substring.** This is [[BL-142]]'s bug, committed
by an author who had read the warning the same day. A bar plants the `apps/vendor/…` case explicitly.

**Retry budget:** coverage-gate green — max 3. Suite green — max 2.

### T2 — durable docs move into their module *(docs; conservation: citation parity)*

For each of the 34 top-level `design/*.md`: classify **durable** vs **episodic** by the doc's own
`Status:` line — the classifier [[BL-142]] established, and *"do NOT invent a third proxy."*
Durable → `modules/<owner>/docs/`. Episodic → `design/archive/`.

**⛔ Corrected at Gate 1 — the first draft said "20 of 34 declare a `Status:`; 14 declare nothing."
That was backwards, and the number was manufactured by a sloppy matcher.** A case-insensitive
`^\s*status` grep matched *mid-document prose* in `logbook.md` ("status vocabulary") and `testlog.md`
("status, `/api/agents` final states"). Re-run anchored to a real declaration in the first 40 lines:
**14 of 34 pre-existing docs declare a `Status:`; 20 declare nothing.**

**That inverts T2's cost profile, which is why it matters and is not a typo.** The classifier
[[BL-142]] recommended is the right one — but it covers a **minority** of the corpus, so T2 is
**~14 mechanical and ~20 judgment**, not the reverse. And it is fragile at the edges: `bl028-plan.md`
opens with `**Author:** / **Date:**` and no `Status:` at all, while carrying a bolded status sentence
further down. **The 20 undeclared docs are read individually**, the call recorded in the ledger with a
one-line reason each. They are not batch-moved and not batch-archived.

*(This is the fourth time in this overhaul that a stated figure was wrong and the conclusion around it
survived. It was caught here only because Gate 1 re-ran it. See `design/lessons/claude-lessons.md`.)*

**PROMOTION is the un-automatable step and gets its own commit.** A load-bearing durable claim buried
inside an episodic doc is lost the moment that doc moves to `archive/`. Every promotion is a separate,
reviewable commit citing the source document and the claim — never riding along inside a move commit.

Conservation per commit: `npm run docs:check` reports **676 checked / 0 newly broken / 43 carried**,
before and after. Any newly-broken citation is a defect in the move, not an acceptable cost.

### T3 — `AGENT.md` splits — **NOT IN THIS DELIVERY. STOP AND ASK THE PO.**

BL-144 says `AGENT.md` splits last, ~150 lines of cross-cutting law staying in `governance/`. That is
correct and it is still not something to do under a standing grant, for a reason specific to this file:
**`AGENT.md` is the file every agent auto-loads at turn 1**, through three names on a case-insensitive
filesystem. Splitting it changes what every actor in the project reads before it does anything — the
single highest-blast-radius edit available here, and a governance change, which the grant explicitly
does not cover (*"it does not make you the PO"*).

T3 is therefore delivered as a **written proposal with the split mapped line-range by line-range**, and
the PO decides. The grant removes the permission step for ordinary work; this is not ordinary work.

## 5. Definition of Done

| # | Row | Bar |
|---|---|---|
| 1 | Manifests exist for all 13 modules, names match directories | `modules:check` green |
| 2 | Dep graph acyclic; every dep resolves | `modules:check` green |
| 3 | Coverage: every in-universe tracked path owned, or on the commented `UNOWNED` register | `modules:check` green |
| 4 | Uniqueness: no path owned twice | `modules:check` green |
| 5 | Backlog slices claimed at most once; all resolve under `design/backlog/` | `modules:check` green |
| 6 | Path matching is boundary-anchored, with a planted `apps/vendor/…` bar | test file, red without the fix |
| 7 | `modules:check` runs in the suite against the **real** repo, not only fixtures | test file |
| 8 | Durable docs relocated; every one owned by exactly one module | `modules:check` green |
| 9 | Citation parity across every doc-move commit | `docs:check` 676 / 0 / 43 |
| 10 | Backlog untouched: 144 items, `workable == ["BL-144"]`, all six fence sites unchanged | parse equality + `git diff` |
| 11 | Full regression | `tsc -b` 0, suite ≥ 838 |
| 12 | T3 delivered as a proposal, not an edit; `AGENT.md` unmodified except its own citations | `git diff AGENT.md` |

## 6. Risks, named up front

- **The gate manufactures its own findings.** [[BL-141]]'s lesson: *a checker with a false-positive rate
  is worse than no checker.* Mitigation: verify one instance of every finding class **by hand** before
  reporting it, and plant a bar for the substring trap.
- **A doc-move breaks a live instruction.** Wave 1 did exactly this to the operator's SKILL.md, and only
  [[BL-142]] caught it, because *instructions are not citations* and citation parity cannot see them.
  Mitigation: any doc named by an operational runbook or skill is checked **by reading the instruction
  and running it**, both directions, before its move commit.
- **Ownership disputes look like coverage failures.** Where two modules plausibly own a path, the gate
  will say "owned twice" and the temptation is to widen a glob. That is the scope-creep-green shape.
  Record the dispute in the ledger and pick one owner with a reason.
- **Budget.** Session at ~39% at plan time. T2 is the long pole; if the window closes mid-T2, the
  delivery stops at the last green doc-move commit, which is complete on its own terms.

## 7. What this plan explicitly does NOT do

New repositories (BL-144, deliberate — [[BL-086]] priced one cross-repo split in duplicated governance);
code relocation (§2, Finding 2); backlog relocation (§2, Finding 1); `AGENT.md` edits (§4, T3);
anything touching `autonomy` / workable→launchable, which the PO's grant explicitly does not reach.
