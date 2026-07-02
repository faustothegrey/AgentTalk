/**
 * Structured backlog parser (M13).
 *
 * `design/backlog.md` stays the single source of truth and stays hand-writable prose.
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
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';

export type BacklogStatus = 'todo' | 'doing' | 'done' | 'dropped';

export interface BacklogItem {
  id: string;
  status: string; // one of BacklogStatus when valid; raw value kept even if unknown
  date: string | null;
  epic: string | null;
  promotedTo: string | null;
  tags: string[];
  title: string;
  bodyMarkdown: string;
}

export interface BacklogParseResult {
  items: BacklogItem[];
  warnings: string[];
}

const VALID_STATUS = new Set<string>(['todo', 'doing', 'done', 'dropped']);

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
  const stripped = body.replace(/^\s*-\s*\[[^\]]*\]/, '');
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

      items.push({
        id,
        status,
        date: nullable(header.date ?? ''),
        epic: nullable(header.epic ?? ''),
        promotedTo: nullable(header.promoted_to ?? ''),
        tags: parseTagList(header.tags ?? ''),
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

/** Walk up from cwd to locate `design/backlog.md` (CJS/ESM agnostic). */
export function defaultBacklogPath(): string {
  let dir = process.cwd();
  for (let hops = 0; hops < 10; hops++) {
    const candidate = join(dir, 'design', 'backlog.md');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), 'design', 'backlog.md');
}

/** Read + parse the on-disk backlog. Missing file → empty result + a warning. */
export function readBacklog(path: string = defaultBacklogPath()): BacklogParseResult {
  if (!existsSync(path)) {
    return { items: [], warnings: [`backlog.md not found at ${path}`] };
  }
  return parseBacklog(readFileSync(path, 'utf8'));
}
