#!/usr/bin/env node
/**
 * Deterministic backlog structure gate (M13).
 *
 * Run it every time `design/backlog.md` changes:  `npm run backlog:check`
 * (the npm script builds the parser first, then runs this).
 *
 * Fails (exit 1) on ANY structural defect:
 *   - parser warnings   — malformed/unterminated header, missing/duplicate id,
 *                         unknown status, header↔prose status drift;
 *   - bad id format     — ids must be BL-NNN;
 *   - coverage gap      — every ACTIVE bullet (status ∉ {done, dropped}) must carry
 *                         an <!-- @item --> header so it is API-serveable.
 *
 * Zero LLM, zero network — pure parse + assert. Reuses the real parser
 * (apps/orchestrator/src/backlog.ts) so the gate can never drift from the API.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readBacklog } from '../apps/orchestrator/dist/backlog.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const backlogPath = join(repoRoot, 'design', 'backlog.md');

const ID_RE = /^BL-\d{3,}$/;
const INACTIVE = new Set(['done', 'dropped']); // need no header

const { items, warnings } = readBacklog(backlogPath);
const errors = [];

// 1. Any parser warning is a structural failure.
for (const w of warnings) errors.push(`parser: ${w}`);

// 2. id format (uniqueness is already covered by a parser warning).
for (const it of items) {
  if (!ID_RE.test(it.id)) errors.push(`bad id format: "${it.id}" (expected BL-NNN)`);
}

// 3. BL-093 — the dependency graph must be sound. A dangling or circular `blocked_by`
//    silently UNBLOCKS an item (the parser fails closed, so it just disappears from the
//    workable set with no explanation), which is exactly the kind of quiet wrong answer
//    this gate exists to make loud.
const byId = new Map(items.map((it) => [it.id, it]));
for (const it of items) {
  for (const dep of it.blockedBy) {
    if (!byId.has(dep)) {
      errors.push(`item "${it.id}": blocked_by references unknown id "${dep}"`);
    }
    if (dep === it.id) {
      errors.push(`item "${it.id}": blocked_by references itself`);
    }
  }
  // `autonomy: eligible` on anything not `todo` is a mistake, not a hazard — the selector
  // filters on status anyway. Report it as an error so it gets corrected, since the gate
  // has no warning tier.
  if (it.autonomy === 'eligible' && it.status !== 'todo') {
    errors.push(
      `item "${it.id}": autonomy "eligible" on a "${it.status}" item (only todo is workable)`,
    );
  }
}

// Cycle detection over the blocked_by graph. Recursive three-colour DFS: `onPath` holds
// the CURRENT walk (a hit there is a real cycle), `settled` holds nodes whose whole subtree
// is clean (never re-walked). Keeping those two distinct is the point — an earlier draft
// used one marker, so a node left mid-walk looked like a cycle to any later root that
// depended on it. Chains here are 1-2 deep, so recursion is safe and legible.
const settled = new Set();
const onPath = new Set();
const reported = new Set();

function walk(id, path) {
  if (settled.has(id)) return;
  if (onPath.has(id)) {
    const cycle = [...path.slice(path.indexOf(id)), id].join(' → ');
    if (!reported.has(cycle)) {
      reported.add(cycle);
      errors.push(`blocked_by cycle: ${cycle}`);
    }
    return;
  }
  onPath.add(id);
  for (const dep of byId.get(id)?.blockedBy ?? []) {
    if (byId.has(dep)) walk(dep, [...path, id]); // dangling ids already reported above
  }
  onPath.delete(id);
  settled.add(id);
}

for (const it of items) walk(it.id, []);

// 4. Coverage — every active top-level bullet must be a parsed (headered) item.
const headeredBullets = new Set(
  items.map((it) => it.bodyMarkdown.split('\n')[0]?.trim()).filter(Boolean),
);
const lines = readFileSync(backlogPath, 'utf8').split('\n');
let inFence = false;
lines.forEach((line, idx) => {
  const t = line.trimStart();
  if (t.startsWith('```')) {
    inFence = !inFence;
    return;
  }
  if (inFence) return;
  const m = line.match(/^-\s*\[([^\]]+)\]/);
  if (!m) return;
  const status = m[1].trim().split(/[\s·→]/)[0].toLowerCase();
  if (INACTIVE.has(status)) return;
  if (!headeredBullets.has(line.trim())) {
    errors.push(
      `line ${idx + 1}: active item ("[${status}…]") has no <!-- @item --> header — ` +
        `add one (id: BL-NNN, status: ${status}) so it is API-serveable`,
    );
  }
});

// Report.
if (errors.length > 0) {
  console.error(`✗ backlog structure INVALID — ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nParsed ${items.length} item(s) from design/backlog.md.`);
  process.exit(1);
}

console.log(`✓ backlog structure OK — ${items.length} item(s), 0 warnings.`);
for (const it of items) {
  console.log(`  ${it.id}  ${it.status.padEnd(9)} ${it.title.slice(0, 56)}`);
}
