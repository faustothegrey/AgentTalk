# Spike — Structured backlog: a machine-readable item format for API + UI

**Status:** 📋 **PROPOSED — not started** (Claude, planner/architect, 2026-07-01). Exploratory design only;
**zero production code** in this spike (per §3e, spikes are read-only/probe/docs). Awaiting PO review before any
implementation task is promoted out of it.
**Author:** Claude, 2026-07-01.
**Type:** format/tooling spike (data-shape + parser + read API for `design/backlog.md`).
**Requested by:** Fausto (PO), 2026-07-01 — *"render the backlog with a defined structure so it can be exposed via
API and get a UI on top, without upending everything."*
**Decision already taken (PO, 2026-07-01):** **Option B** — a machine-readable header per item, prose body kept
as-is; **`backlog.md` stays the single source of truth** and stays hand-writable. (Options A "parse the free prose"
and C "YAML-as-truth, generate the markdown" were considered and rejected — A is fragile, C upends the §3b human
workflow.)

---

## 1. Why

`design/backlog.md` is a governed workflow artifact (§3b — the "backlog gate": every open item is dispositioned
before opening a new macro unit). Today it is **rich human/agent prose**: the header declares an entry format
(`- [STATUS] YYYY-MM-DD — <what> — <why>`), but real items far exceed it — nested sub-bullets, embedded decisions,
`Source:` lines, telemetry blocks, `<!-- STALE -->` HTML comments, gate-record tables, archived `✅ DONE` sections.

Fausto wants to **expose the backlog via an API and build a UI over it** (filter/sort by status, epic, tags; read
the full item). Parsing the free prose reliably is not feasible (Option A). The chosen path (Option B) adds a small
**machine-readable header to each item** while leaving the prose body untouched, so:

- the parser reads **only** the structured header (100% reliable), and
- the prose stays the source of truth for humans and agents (the §3b workflow is preserved).

## 2. Goal & non-goals

**Goal.**
- A per-item **structured header** (stable schema) embedded in `backlog.md` as an HTML comment, invisible in
  normal markdown rendering, hand-writable, and not disruptive to how agents edit the file.
- A small **parser** (`scripts/backlog-parse.mjs`, ~50–80 lines) that emits a JSON array of items
  (`{id, status, date, epic, tags, promoted_to, title, body_markdown, body_html}`).
- A **read-only API** surface (`GET /backlog`, `GET /backlog/:id`) returning that JSON — additive, no change to
  existing endpoints.
- One documented **format convention** so future items are written structured, added to the workflow doc.

**Non-goals (this spike).**
- ❌ Any production code — the spike is docs only; the parser/API land as a **promoted task**, not here.
- ❌ Write API / editing the backlog through the UI (read-only first; write is a separate, later question — it
  collides with the §3b hand-edit + gate discipline and needs its own design).
- ❌ Converting the whole file in one shot — migration is incremental (see §6).
- ❌ Modelling the non-item content (gate-record tables, `✅ DONE` archive sections) as items — they stay prose;
  the parser skips anything without an item header.
- ❌ Changing the source of truth (Option C). `backlog.md` remains canonical.

## 3. The item schema

Each backlog **Item** carries these fields. Only `id` + `status` are required; the rest are optional and default
sensibly, so a hand-written item stays cheap.

| Field         | Type / values                                                      | Required | Notes |
|---------------|--------------------------------------------------------------------|----------|-------|
| `id`          | `BL-<NNN>` (stable, never reused)                                  | ✅       | Backlog-local id, independent of epic/task ids. |
| `status`      | `open · parked · promoted · absorbed · dropped · done`             | ✅       | Same vocabulary as today's `[STATUS]` line. |
| `date`        | `YYYY-MM-DD`                                                       | –        | Item creation date (today's leading date). |
| `epic`        | `M08` / `M11` / `null`                                             | –        | Owning/target epic if any. |
| `promoted_to` | free string (`M11`, `spike-name`) / `null`                        | –        | The `→X` in `promoted→X`/`absorbed→X`. |
| `tags`        | `[string]`                                                         | –        | Free labels for UI filtering (`worktree`, `consensus`…). |
| `title`       | derived from the first bold span of the body if omitted           | –        | Short human title for the card. |

**Derived (parser-computed, not stored):** `body_markdown` (everything after the header up to the next item or
section boundary) and `body_html` (rendered). The card shows `title` + `status` + `epic` + `tags`; expanding shows
`body_html`.

## 4. The on-disk format (Option B)

The header is a **single HTML comment** immediately above the existing bullet. Invisible in rendered markdown,
trivial to hand-write, and the prose below is **exactly today's item, unchanged**:

````markdown
<!-- @item
id: BL-042
status: open
date: 2026-06-21
epic: M08
tags: [worktree, worker-prompt]
-->
- **Worker-prompt worktree cleanup (FIND-T3b2-1)** — the worker prompt (`in-process-driver.ts`
  `handleTeamWorkAssign`) still tells agy *"you must use strictly `git worktree`…"* while the orchestrator
  already runs the worker inside a per-task worktree… *(rest of the existing prose, verbatim)*
````

**Why an HTML comment and not YAML frontmatter or a fenced block:**
- invisible in GitHub/most renderers → the file still reads cleanly as prose today;
- one unambiguous open token (`<!-- @item`) the parser locks onto → no heuristic guessing;
- agents keep writing the prose bullet exactly as now; the only new habit is "prepend a 6-line comment."

**Body boundary rule (parser):** an item's body runs from the bullet after its `@item` header until the next
`<!-- @item` **or** the next `##`/`###` section heading **or** the `*(add new items above this line)*` sentinel —
whichever comes first. Content with no preceding `@item` header (intro, gate tables, `✅ DONE` archives) is **not**
an item and is skipped.

## 5. Parser + API shape

**Parser** — `scripts/backlog-parse.mjs`:
- read `design/backlog.md`, scan for `<!-- @item … -->` blocks, YAML-parse each header (a tiny, whitelisted
  key set — not arbitrary YAML), capture the body per the boundary rule, render `body_html` (reuse whatever
  markdown lib the app already has; else `marked`).
- **Validation:** unknown status → warn+skip; duplicate `id` → warn; missing required field → warn. The parser is
  **best-effort and non-fatal** — a malformed item is reported, never crashes the run (mirrors the project's
  resource-monitor "never blocking" ethos).
- output: `[{id, status, date, epic, promoted_to, tags, title, body_markdown, body_html}]`.

**API** (additive, read-only) — most-likely home is the orchestrator app that already serves the web UI:
```
GET /backlog            → { items: [ …parsed… ], generated_at }
GET /backlog/:id        → { …one item… }   (404 if unknown id)
```
Two impl options for how the API gets the JSON (decide at promotion):
- **(a) on-demand parse** — the endpoint runs the parser per request (simplest; file is tiny, ~300 lines).
- **(b) build-step artifact** — a `npm run backlog:build` writes `backlog.json`; the API serves the file, a
  watcher regenerates on change (decouples API from the parser, better if the UI is a separate static app).

Recommendation: **(a)** to start — the file is small, zero caching complexity, always fresh.

## 6. Migration plan (incremental — no big-bang)

1. **Land the format + parser + API** against the **current file unchanged** — with zero `@item` headers the API
   simply returns `[]`. Non-breaking by construction.
2. **Backfill headers incrementally.** Add `@item` headers to the live `[open]`/`[deferred]`/`[parked]` items
   first (there are only a handful of genuinely-open ones). Archived `✅ DONE` blocks can stay header-less
   forever, or get `status: done` headers later if the UI wants a history view.
3. **Fold the header write into the §3b gate.** When the backlog gate dispositions items, it also ensures each
   touched item has/updates its header — so structure accretes exactly where humans already look. Add one line to
   the workflow doc (§3b) documenting the item format.
4. The legacy `- [STATUS] …` prose line and the new header **coexist** — the header is authoritative for the API,
   the prose stays the human record. No item is rewritten beyond prepending its comment.

## 7. Risks & honesty notes

- **This is a workflow-format change to a governed artifact (§3b).** It is a **PO/process decision** (Fausto has
  taken it), and it should be recorded in `collaboration-workflow.md §3b` so agents write the new format. Until
  backfilled, the API under-reports (only headered items appear) — acceptable and clearly communicated.
- **Dual source of truth risk (header vs prose `[STATUS]`).** Two places can disagree (e.g. header `status: open`
  but prose says `[done]`). Mitigation: the **header wins for the API**; a lint in the parser can warn on
  divergence so the gate catches drift (LB-style staleness discipline).
- **No write path yet.** The UI is read-only; editing still happens by hand in the markdown (preserves §3b). A
  write API is explicitly deferred — it reopens the gate/hand-edit tension and needs its own spike.
- **Id allocation.** `BL-<NNN>` needs a monotonic source; simplest is "max existing +1", computed by the parser
  and surfaced when a human adds an item. No central registry needed.

## 8. Open questions for the PO / review

1. **API home** — bolt `GET /backlog` onto the existing orchestrator web server, or a tiny separate read service?
2. **Parse-on-demand (6a) vs build artifact (6b)** — recommend on-demand; confirm.
3. **`id` scheme** — `BL-<NNN>` monotonic as proposed, or reuse existing in-text ids (`FIND-…`, `IP-…`, `M08-T4`)
   where present? (Recommend a dedicated `BL-` id so the backlog id is stable even as an item promotes.)
4. **Do archived `✅ DONE` sections get headers** (history view in the UI), or stay header-less prose forever?
5. **Which markdown renderer** for `body_html` — reuse the app's existing one, or add `marked` as a leaf dep?

## 9. If approved — the promoted task (not part of this spike)

On PO go, this promotes to a single implementer task (Gemini, or the standing-conditional reassignment if Gemini
is unavailable), roughly:
- `scripts/backlog-parse.mjs` + unit tests (fixtures: a well-formed item, a malformed header, a header-less section
  → assert skip/warn/parse);
- `GET /backlog` + `GET /backlog/:id` endpoints + a test;
- backfill `@item` headers onto the current open items;
- one `§3b` line documenting the format.

DoD rows + branch (`<epic>-t<N>-backlog-api` per §3e) get authored in the owning epic's `implementation.md` at
promotion. **Nothing here is built until the PO approves and a planner writes the plan.**

---

*Spike is docs-only. No branch, no code, no tests were created for it (per §3e). — Claude, 2026-07-01.*
