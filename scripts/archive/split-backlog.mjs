/**
 * One-shot Wave-1 splitter: `design/backlog.md` -> `design/backlog/*.md`.
 *
 * The document is NOT a flat item list. It interleaves three things:
 *   1. a preamble (schema docs, with a ``` fenced @item example that must never parse),
 *   2. dated `### Backlog gate` / `### PO directive` prose — episodic decision RECORDS,
 *   3. the items themselves, grouped under status headings that this split makes redundant.
 *
 * So it cuts at unfenced `<!-- @item` boundaries, then splits each chunk again at the first
 * unfenced heading: the part before is the item (header + body, exactly as `parseBacklog`
 * defines a body — up to the next boundary), the part from the heading on is prose that
 * belonged to the following section, not to the item.
 *
 * CORRECTNESS BAR: every input line lands in exactly one output file, and the count is
 * asserted. Not "it looks right" — conserved.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(repoRoot, 'design', 'backlog.md');
const OUT = join(repoRoot, 'design', 'backlog');

/** id -> module file. Assigned by READING each open item, not by tag-matching. */
const MODULE = {
  'team-orchestration': ['BL-028', 'BL-135', 'BL-068', 'BL-024'],
  'agent-runtime': ['BL-072'],
  'mcp-transport': ['BL-070', 'BL-034', 'BL-038', 'BL-079'],
  backlog: ['BL-134'],
  containment: ['BL-091', 'BL-054', 'BL-098', 'BL-140', 'BL-005', 'BL-007'],
  relay: ['BL-107', 'BL-112', 'BL-139'],
  'consensus-lab': ['BL-010', 'BL-044', 'BL-042', 'BL-043'],
  'host-ui': ['BL-050', 'BL-035', 'BL-025'],
  governance: ['BL-016', 'BL-029', 'BL-015', 'BL-014'],
};
const ORDER = [
  ['10', 'team-orchestration'],
  ['20', 'agent-runtime'],
  ['30', 'mcp-transport'],
  ['40', 'backlog'],
  ['50', 'containment'],
  ['60', 'relay'],
  ['70', 'consensus-lab'],
  ['80', 'host-ui'],
  ['85', 'governance'],
];
const moduleOf = (id) => {
  for (const [m, ids] of Object.entries(MODULE)) if (ids.includes(id)) return m;
  return null;
};

const lines = readFileSync(SRC, 'utf8').split('\n');

// Fence map — identical rule to parseBacklog, so a fenced example is never treated as an item.
const inFence = new Array(lines.length).fill(false);
let fence = false;
for (let n = 0; n < lines.length; n++) {
  if ((lines[n] ?? '').trimStart().startsWith('```')) {
    inFence[n] = true;
    fence = !fence;
  } else inFence[n] = fence;
}
const isItemStart = (n) => !inFence[n] && (lines[n] ?? '').startsWith('<!-- @item');
const isHeading = (n) => {
  const t = (lines[n] ?? '').trimStart();
  return !inFence[n] && (t.startsWith('## ') || t.startsWith('### '));
};

// Cut into [preamble, ...chunks] at unfenced item starts.
const starts = [];
for (let n = 0; n < lines.length; n++) if (isItemStart(n)) starts.push(n);

const preamble = lines.slice(0, starts[0]);
const buckets = { guide: [...preamble], closed: [] };
for (const [, m] of ORDER) buckets[m] = [];

let assigned = preamble.length;
for (let s = 0; s < starts.length; s++) {
  const from = starts[s];
  const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
  // Where does this item's own text stop? At the first heading after its start.
  let cut = to;
  for (let n = from + 1; n < to; n++)
    if (isHeading(n)) {
      cut = n;
      break;
    }
  const itemLines = lines.slice(from, cut);
  const trailingProse = lines.slice(cut, to);

  const idLine = itemLines.find((l) => /^id:\s*/.test(l));
  const id = idLine ? idLine.replace(/^id:\s*/, '').trim() : null;
  const statusLine = itemLines.find((l) => /^status:\s*/.test(l));
  const status = statusLine ? statusLine.replace(/^status:\s*/, '').trim() : '';

  const mod = id ? moduleOf(id) : null;
  const target = mod ?? (['done', 'dropped'].includes(status) ? 'closed' : 'guide');
  buckets[target].push(...itemLines);
  // Prose between an item and the next belongs to the document's narrative, not the item.
  buckets.guide.push(...trailingProse);
  assigned += itemLines.length + trailingProse.length;
}

if (assigned !== lines.length) {
  console.error(`LINE CONSERVATION FAILED: in ${lines.length}, out ${assigned}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const header = (title, note) =>
  [`# ${title}`, '', note, '', '<!-- Split from design/backlog.md (Wave 1). -->', ''].join('\n');

writeFileSync(join(OUT, '00-guide.md'), buckets.guide.join('\n') + '\n');
for (const [num, m] of ORDER) {
  const body = buckets[m];
  if (!body.length) continue;
  writeFileSync(
    join(OUT, `${num}-${m}.md`),
    header(
      `Backlog — ${m}`,
      `Open items owned by the **${m}** module. Closed items live in \`90-closed.md\`.`,
    ) +
      body.join('\n') +
      '\n\n*(add new items above this line)*\n',
  );
}
writeFileSync(
  join(OUT, '90-closed.md'),
  header(
    'Backlog — closed',
    'Every `done` and `dropped` item, kept whole: they are cited constantly by `[[BL-xxx]]` links and are the project’s memory.',
  ) +
    buckets.closed.join('\n') +
    '\n',
);

console.log(`line conservation OK: ${lines.length} in, ${assigned} out`);
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(20)} ${v.length} lines`);
