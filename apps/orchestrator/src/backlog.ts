/**
 * Structured backlog parser (M13).
 *
 * The backlog stays the single source of truth and stays hand-writable prose. It lives as
 * `design/backlog/` — one file per concern, read in filename order — having outgrown a single
 * 8,946-line `design/backlog.md`; both layouts are read (see `defaultBacklogPath`).
 * Each item may carry a machine-readable header as an HTML comment:
 *
 *   <!-- @item
 *   id: BL-001
 *   status: todo
 *   date: 2026-06-20
 *   epic: M07
 *   tags: [live-smoke, quota-blocked]
 *   -->
 *   - **The item title** — the existing prose bullet, unchanged…
 *
 * The parser reads ONLY the header (deterministic) and captures the prose bullet as
 * `bodyMarkdown`. It is best-effort and non-fatal: a malformed item is reported in
 * `warnings`, never thrown. The header is authoritative for the API; where the header
 * disagrees with the prose `[STATUS]` tag, a drift warning is emitted (LB-47 discipline).
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

export type BacklogStatus = 'todo' | 'doing' | 'deferred' | 'done' | 'dropped';

/**
 * Whether an item may be handed to an agent autonomously (BL-093).
 *
 * `human-only` is the DEFAULT and the fallback for any unrecognised value — this parser
 * fails CLOSED. An item that does not say it is eligible is not eligible, so shipping the
 * field cannot retroactively make the existing backlog autonomously workable, and a typo
 * hides an item rather than releasing it.
 */
export type Autonomy = 'eligible' | 'human-only' | 'po-decision';

export interface BacklogItem {
  id: string;
  status: string; // one of BacklogStatus when valid; raw value kept even if unknown
  date: string | null;
  epic: string | null;
  promotedTo: string | null;
  tags: string[];
  /** Ids that must be done/dropped before this item may start. Default []. */
  blockedBy: string[];
  /** Autonomous-selection eligibility. Default 'human-only' (fail closed). */
  autonomy: Autonomy;
  title: string;
  bodyMarkdown: string;
}

export interface BacklogParseResult {
  items: BacklogItem[];
  warnings: string[];
}

const VALID_STATUS = new Set<string>(['todo', 'doing', 'deferred', 'done', 'dropped']);
const VALID_AUTONOMY = new Set<string>(['eligible', 'human-only', 'po-decision']);
const DEFAULT_AUTONOMY: Autonomy = 'human-only';

const ITEM_OPEN = '<!-- @item';
const HEADER_END = '-->';
const SENTINEL = '*(add new items above this line)*';

/** True for a line that ends an item body (next item / section heading / sentinel). */
function isBodyBoundary(line: string): boolean {
  const t = line.trimStart();
  return (
    t.startsWith(ITEM_OPEN) ||
    t.startsWith('## ') ||
    t.startsWith('### ') ||
    t.includes(SENTINEL)
  );
}

/** Parse a `[a, b, c]` (or `[]`) list value into a trimmed string array. */
function parseTagList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalise a header value: `null`/empty → null. */
function nullable(v: string): string | null {
  const t = v.trim();
  return t === '' || t.toLowerCase() === 'null' ? null : t;
}

/** Derive a short title from the first bold span of the body, else its first words. */
function deriveTitle(body: string): string {
  // Drop the leading bullet + `[status …]` tag so a bold span inside it isn't mistaken
  // for the title (e.g. "[… **renamed per §3e**] — **Real Title**").
  //
  // BL-085: `[^\]]*` ended at the FIRST `]`, which is the inner `]` of a `[[BL-nnn]]`
  // wiki-link — extremely common in a status tag ("sibling of [[BL-041]]"). Everything after
  // that link stayed in the body, so bold text inside the tag became the title, silently and
  // with zero warnings. So allow whole `[[…]]` groups inside the tag. The lenient original is
  // kept as a fallback for any tag holding an unbalanced single bracket, which the strict
  // pattern would decline to match at all — that way this can only ever fix a title, never
  // take one away.
  const WIKI_AWARE_TAG = /^\s*-\s*\[(?:\[\[[^\]]*\]\]|[^[\]])*\]/;
  const stripped = WIKI_AWARE_TAG.test(body)
    ? body.replace(WIKI_AWARE_TAG, '')
    : body.replace(/^\s*-\s*\[[^\]]*\]/, '');
  const bold = stripped.match(/\*\*(.+?)\*\*/s);
  const raw =
    bold && bold[1]
      ? bold[1]
      : (stripped.split('\n').find((l) => l.trim().length > 0) ?? '')
          .replace(/^[-*]\s*/, '')
          .replace(/^\[[^\]]*\]\s*/, '');
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned.length > 80 ? cleaned.slice(0, 77) + '…' : cleaned || '(untitled)';
}

/** The leading `[status …]` token of the prose bullet, for drift detection. */
function proseStatusToken(body: string): string | null {
  const m = body.match(/^\s*-\s*\[([^\]]+)\]/);
  if (!m || !m[1]) return null;
  // e.g. "promoted→M11 (…)", "open · deferred", "absorbed→M08-T4" → first word
  const first = m[1].trim().split(/[\s·→]/)[0];
  return first ? first.toLowerCase() : null;
}

export function parseBacklog(markdown: string): BacklogParseResult {
  const lines = markdown.split('\n');
  const at = (n: number): string => lines[n] ?? '';

  // Pre-mark lines inside ``` fenced code blocks (delimiters included) so an @item
  // example embedded in documentation is never parsed as a real item.
  const inFence: boolean[] = new Array(lines.length).fill(false);
  let fence = false;
  for (let n = 0; n < lines.length; n++) {
    if (at(n).trimStart().startsWith('```')) {
      inFence[n] = true;
      fence = !fence;
    } else {
      inFence[n] = fence;
    }
  }
  const boundary = (n: number): boolean => isBodyBoundary(at(n)) && !inFence[n];

  const items: BacklogItem[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    if (!inFence[i] && at(i).trimStart().startsWith(ITEM_OPEN)) {
      const headerStart = i + 1;
      // Collect header lines until the closing `-->`.
      let j = headerStart;
      const header: Record<string, string> = {};
      let closed = false;
      while (j < lines.length) {
        if (at(j).trim().includes(HEADER_END)) {
          closed = true;
          break;
        }
        const kv = at(j).match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
        if (kv) header[kv[1]!.toLowerCase()] = kv[2]!;
        j++;
      }
      if (!closed) {
        warnings.push(`Unterminated @item header at line ${i + 1} (no closing "-->")`);
        i = j;
        continue;
      }

      // Body: from the line after `-->` up to the next boundary.
      let k = j + 1;
      const bodyLines: string[] = [];
      while (k < lines.length && !boundary(k)) {
        bodyLines.push(at(k));
        k++;
      }
      const bodyMarkdown = bodyLines.join('\n').trim();

      // Validate + assemble.
      const id = (header.id ?? '').trim();
      if (!id) {
        warnings.push(`@item at line ${i + 1} has no "id" — skipped`);
        i = k;
        continue;
      }
      if (seenIds.has(id)) {
        warnings.push(`Duplicate backlog id "${id}" at line ${i + 1}`);
      }
      seenIds.add(id);

      const status = (header.status ?? '').trim();
      if (!VALID_STATUS.has(status)) {
        warnings.push(`Item "${id}" has unknown status "${status || '(empty)'}"`);
      }

      const drift = proseStatusToken(bodyMarkdown);
      if (drift && status && drift !== status) {
        warnings.push(
          `Item "${id}" drift: header status "${status}" ≠ prose "[${drift}…]"`,
        );
      }

      // BL-093. Both fields are optional; both fail closed. `blocked_by` shares `tags`'
      // list syntax, so it reuses the same parser rather than growing a second one.
      const blockedBy = parseTagList(header.blocked_by ?? '');
      const rawAutonomy = (header.autonomy ?? '').trim();
      let autonomy: Autonomy = DEFAULT_AUTONOMY;
      if (rawAutonomy) {
        if (VALID_AUTONOMY.has(rawAutonomy)) {
          autonomy = rawAutonomy as Autonomy;
        } else {
          warnings.push(
            `Item "${id}" has unknown autonomy "${rawAutonomy}" — treated as "${DEFAULT_AUTONOMY}"`,
          );
        }
      }
      if (blockedBy.includes(id)) {
        warnings.push(`Item "${id}" lists itself in blocked_by`);
      }

      items.push({
        id,
        status,
        date: nullable(header.date ?? ''),
        epic: nullable(header.epic ?? ''),
        promotedTo: nullable(header.promoted_to ?? ''),
        tags: parseTagList(header.tags ?? ''),
        blockedBy,
        autonomy,
        title: header.title?.trim() || deriveTitle(bodyMarkdown),
        bodyMarkdown,
      });

      i = k;
      continue;
    }
    i++;
  }

  return { items, warnings };
}

/**
 * The default dashboard view: the live queue only (`doing` + `todo`).
 * `done`, `dropped`, and `deferred` are filtered out (use `?all=true` for the full set).
 * Unknown statuses stay visible — a typo'd state should surface, not vanish.
 */
export function activeBacklogItems(items: BacklogItem[]): BacklogItem[] {
  return items.filter((i) => i.status !== 'done' && i.status !== 'dropped' && i.status !== 'deferred');
}

/** A blocker is RESOLVED once the item it names is `done` or `dropped`. */
function isResolved(blockerId: string, byId: Map<string, BacklogItem>): boolean {
  const b = byId.get(blockerId);
  if (!b) return false; // unknown id → unresolved, so a typo hides rather than releases
  return b.status === 'done' || b.status === 'dropped';
}

/**
 * The items that are WORKABLE: `todo`, with every blocker resolved. Nothing else.
 *
 * BL-134 removed the `autonomy === 'eligible'` clause. Read why before adding it back.
 *
 * `autonomy` was a READINESS field wearing an AUTHORIZATION field's clothes. All three of its
 * values describe how ready an item is — `eligible` = specified, `human-only` = under-specified,
 * `po-decision` = a question rather than a task — and **none describes who may touch it.** Because
 * it *read* as fail-closed governance, typing `eligible` felt like granting a privilege, so it was
 * done one item at a time with a pin-test ritual. That was the complexity the PO reported, and it
 * was buying nothing here: this function populates an API view and two reports. **It launches
 * nothing.**
 *
 * Readiness is now carried by `blocked_by`, which is strictly better at the job: it names its
 * reason as a filed item, it releases itself when the blocker closes, and a dangling id fails
 * `backlog:check`. `human-only` named nothing and expired never.
 *
 * WHAT ACTUALLY STOPS AN AGENT BEING HANDED WORK is Gate B, not this predicate: a PO-authorized
 * `design/po/<run>.authorized` at the commissioned sha, single-use via the launch ledger, written
 * by `relay-approve.mjs approve <token>` alone (BL-137). **Workable is not launchable.**
 *
 * The recursion guard this canNOT enforce is Gate B's too: `findsLaunchInstruction` scans the brief
 * AND the goal the worker actually receives (BL-136). It never belonged here — recursion is a
 * property of the brief, not of the item.
 *
 * Still fails closed where it should: `doing` is excluded (someone already has it), and an
 * unresolvable or dangling blocker id keeps the item back.
 */
export function workableBacklogItems(items: BacklogItem[]): BacklogItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return items.filter((i) => i.status === 'todo' && i.blockedBy.every((b) => isResolved(b, byId)));
}

/**
 * Walk up from cwd to locate the backlog (CJS/ESM agnostic).
 *
 * Two layouts are supported, and the DIRECTORY wins where both exist:
 *   - `design/backlog/`   — one file per concern (the layout since the overhaul)
 *   - `design/backlog.md` — the original single file
 *
 * The legacy path is kept deliberately, not as dead code: `parseBacklog` is a pure
 * function of a string, so a caller holding one file must keep working unchanged —
 * every existing test constructs a single document and passes it directly.
 */
export function defaultBacklogPath(): string {
  let dir = process.cwd();
  for (let hops = 0; hops < 10; hops++) {
    const asDir = join(dir, 'design', 'backlog');
    if (existsSync(asDir) && statSync(asDir).isDirectory()) return asDir;
    const asFile = join(dir, 'design', 'backlog.md');
    if (existsSync(asFile)) return asFile;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), 'design', 'backlog.md');
}

/**
 * Read every `*.md` under a backlog directory, in filename order, as one document.
 *
 * Concatenation is sound rather than convenient: `parseBacklog` carries NO state across
 * an item boundary, and its only file-global construct — the ``` fence map — is rebuilt
 * per call. The `*(add new items above this line)*` sentinel is a *body* boundary
 * (`isBodyBoundary`), never a parse terminator, so one per file is harmless.
 *
 * Filenames therefore carry the ordering, which is why they are numerically prefixed.
 */
function readBacklogDir(dir: string): string {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

/** Read + parse the on-disk backlog — a directory or a single file. Missing → empty + warning. */
export function readBacklog(path: string = defaultBacklogPath()): BacklogParseResult {
  if (!existsSync(path)) {
    return { items: [], warnings: [`backlog not found at ${path}`] };
  }
  const markdown = statSync(path).isDirectory() ? readBacklogDir(path) : readFileSync(path, 'utf8');
  return parseBacklog(markdown);
}
