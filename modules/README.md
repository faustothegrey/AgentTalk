# `modules/` — who owns what

**Status:** Operative reference (BL-144, Wave 2 of the overhaul, 2026-08-15).

Every source file in this repo belongs to exactly one module, and every module says so in its own
`module.json`. `npm run modules:check` proves it — **total** (nothing unowned) and **disjoint**
(nothing owned twice). If you add a file and nothing claims it, the gate goes red and names it.

## Why this exists

The project's collapse was never in the code. The code has had modules, a dependency graph, dead-code
elimination and CI all along — 8 packages, 2 apps, a clean DAG. **The artifacts describing the work
had none of the four.** Wave 0 evicted episodic records, Wave 1 split the backlog by concern,
[[BL-141]] gave the citation graph a linter, and this is the missing one: a declared boundary, so
that a document and the code it describes can be said to have drifted apart.

## Ownership is DECLARED, not physical — and the two refusals are deliberate

BL-144 as filed said *"move code into `modules/`, carrying its durable docs and backlog slice with
it."* Planning found two reasons not to, both argued in `design/bl144-plan.md` §2. They are recorded
here so a later reader does not "finish the job" and quietly undo them.

**The backlog does not move.** `design/backlog/**` is not just where the backlog lives — it is a path
in the **operator seat's write allowlist**, the fenced surface on which a seat holding no authority
may file items. It is named at six sites (`AGENT.md` ×3, `design/operator-seat/SKILL.md`,
`scripts/infra-invariant.mjs` ×2). Dispersing the backlog under `modules/` would force that fence to
widen across the module tree — where durable law lives — or to strip the seat of its ability to file.
A module owns its slice by **naming** it in `backlog:`.

**The code does not move.** The build is a project-references graph: root `tsconfig.json` declares 9
references, 6 packages declare their own, `tsconfig.base.json` carries `paths` aliases, and
`package.json` workspaces is `["apps/*", "packages/*"]` — under which `modules/*` would not be a
workspace at all. Relocation rewrites four coupled things Wave 2 does not need rewritten, and buys
nothing: **a gate forces a reader to touch the claim; a directory only invites it.**

If a later wave proves these boundaries are right and wants physical adjacency, the manifests will
already say what belongs together — which is the cheap half of that job, done.

## The manifest

```jsonc
{
  "name":    "backlog",                  // must equal the directory name
  "summary": "one line — a module nobody can describe in one line is not a module",
  "code":    ["apps/orchestrator/src/backlog.ts", "scripts/validate-backlog.mjs"],
  "docs":    [],                         // durable docs this module owns
  "backlog": "40-backlog.md",            // a file under design/backlog/, or null
  "deps":    []                          // module names; the graph must stay acyclic
}
```

Three glob forms, all **anchored at a path boundary**: `a/b/c.ts` (exact), `a/b/**` (beneath), and
`a/*.mjs` (one segment). The anchoring is the correctness of the whole gate — `packages/x/**` must
not match `packages/x-legacy/`, and nothing may match a vendored copy. That trap is documented
against itself in `scripts/infra-invariant.mjs`, and [[BL-141]]'s checker fell into it anyway,
manufacturing [[BL-142]]'s most alarming finding, which was simply false. A bar plants the case.

## The map

| Module | Backlog slice |
|---|---|
| [`agent-runtime`](./agent-runtime/) | `20-agent-runtime.md` |
| [`backlog`](./backlog/) | `40-backlog.md` |
| [`consensus-lab`](./consensus-lab/) | `70-consensus-lab.md` |
| [`containment`](./containment/) | `50-containment.md` |
| [`contracts`](./contracts/) | — |
| [`governance`](./governance/) | `85-governance.md` |
| [`host-ui`](./host-ui/) | `80-host-ui.md` |
| [`integrations`](./integrations/) | — |
| [`mcp-transport`](./mcp-transport/) | `30-mcp-transport.md` |
| [`observability`](./observability/) | — |
| [`orchestrator-host`](./orchestrator-host/) | — |
| [`relay`](./relay/) | `60-relay.md` |
| [`team-orchestration`](./team-orchestration/) | `10-team-orchestration.md` |

Nine of thirteen own a backlog slice; the module names come from Wave 1's concern split, which is the
project's existing tested vocabulary rather than a new one invented here. Four own none, and
`backlog: null` says that outright — **absence and "none" are different claims**, so the gate requires
the field even when it is empty.

## The UNOWNED register

`scripts/check-modules.mjs` carries a short list of files nothing owns, each with its reason in the
source. It is a **visible debt register** in the ratchet style [[BL-141]] established, not an amnesty:
an entry that names a file which no longer exists, or which a module has since claimed, produces a
warning telling you to drop it. An empty register is the goal.
