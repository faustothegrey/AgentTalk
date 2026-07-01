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

// 3. Coverage — every active top-level bullet must be a parsed (headered) item.
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
