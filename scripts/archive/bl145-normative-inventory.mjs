#!/usr/bin/env node
/**
 * BL-145 one-shot — the conservation instrument for rewriting `AGENT.md` in place.
 *
 * THE PROBLEM THIS SOLVES. The PO's decision was "do not split AGENT.md, fix the three sections in
 * place." Fixing prose in place is not like moving a file: there is no line conservation, no citation
 * parity, no parse equality. The failure mode is that a rule quietly stops being stated, and nobody
 * notices for weeks — which is how the three sections got into this condition to begin with.
 *
 * So the property asserted here is: **every NORMATIVE statement present before the rewrite is still
 * present after it.** Not the same words — the rewrite exists to change words — but the same
 * obligations, each one accounted for by hand against this inventory.
 *
 * It is deliberately OVER-INCLUSIVE. A false positive costs one line of reading; a false negative is
 * a rule that silently evaporated from the file every agent reads at turn 1. Tuned in that direction
 * on purpose.
 *
 *   node scripts/archive/bl145-normative-inventory.mjs <file> [--json]
 */
import fs from 'fs';

/**
 * Markers of obligation, permission and prohibition. Case-sensitive variants are listed separately
 * where this document uses capitals to mean emphasis (`MUST`, `NEVER`) as well as the plain word.
 */
const MARKERS = [
  'MUST', 'must not', 'must ', 'NEVER', 'never', 'MAY NOT', 'may never', 'may not', 'MAY', 'may ',
  'ALWAYS', 'always', 'required', 'REQUIRED', 'forbidden', 'FORBIDDEN', 'STOP', 'cannot', 'shall',
  'do not', 'Do not', 'DO NOT', 'does not', 'is not', 'only', 'ONLY', 'reserved to', 'needs `[PO]`',
  'binding', 'Binding', 'BINDING', 'prohibited', 'not permitted', 'no authority', 'mandatory',
  'MANDATORY', 'gate', 'GATE',
];

/** Strip markdown noise so a re-worded line still compares on its substance. */
const normalize = (s) =>
  s
    .replace(/[*_`~>#|]/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function inventory(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const hit = MARKERS.filter((m) => line.includes(m));
    if (!hit.length) return;
    const norm = normalize(line);
    if (norm.length < 12) return; // a bare heading carries no obligation
    out.push({ line: i + 1, markers: [...new Set(hit.map((h) => h.trim().toLowerCase()))], text: norm });
  });
  return out;
}

const [file, ...flags] = process.argv.slice(2);
const inv = inventory(fs.readFileSync(file, 'utf8'));
if (flags.includes('--json')) console.log(JSON.stringify(inv, null, 1));
else {
  for (const e of inv) console.log(`${String(e.line).padStart(5)}  ${e.text.slice(0, 150)}`);
  console.log(`\n${inv.length} normative lines in ${file}`);
}
