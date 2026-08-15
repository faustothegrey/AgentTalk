#!/usr/bin/env node
/**
 * Deterministic backlog structure gate (M13).
 *
 * Run it every time the backlog changes:  `npm run backlog:check`
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
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readBacklog } from '../apps/orchestrator/dist/backlog.js';
import { isMainModule } from './lib/is-main.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// The backlog is a DIRECTORY since Wave 1 (`design/backlog/`, one file per concern), and was a
// single `design/backlog.md` before it. Both are read, the directory winning — the same rule
// `defaultBacklogPath()` applies, kept in step deliberately: this validator and the parser
// disagreeing about WHERE the backlog is would be a silent pass on a file nobody serves.
const backlogDir = join(repoRoot, 'design', 'backlog');
const backlogPath =
  existsSync(backlogDir) && statSync(backlogDir).isDirectory()
    ? backlogDir
    : join(repoRoot, 'design', 'backlog.md');

/** The whole backlog as one document, whichever layout is on disk. */
function backlogText() {
  if (statSync(backlogPath).isDirectory()) {
    return readdirSync(backlogPath)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => readFileSync(join(backlogPath, f), 'utf8'))
      .join('\n');
  }
  return readFileSync(backlogPath, 'utf8');
}

const ID_RE = /^BL-\d{3,}$/;
const INACTIVE = new Set(['done', 'dropped']); // need no header

/**
 * Ids whose `@item` header EXPLICITLY declares `autonomy: human-only`.
 *
 * This exists because the parser's `DEFAULT_AUTONOMY` is `human-only`, so a parsed item cannot tell
 * an authored fence from an absent field — and after BL-134 retired the fence, "absent" is the
 * CORRECT way to file an item. Keying the advisory on the parsed value warned on every properly
 * filed item, i.e. it fired on doing the right thing. Caught by running it, not by reading it.
 *
 * Scanning the raw text is why `collectFindings` takes it: only the document knows what was written.
 */
export function explicitlyHumanOnly(text) {
  const ids = new Set();
  for (const block of text.split('<!-- @item').slice(1)) {
    const header = block.split('-->')[0] ?? '';
    const id = header.match(/^\s*id:\s*(\S+)/m)?.[1];
    if (id && /^\s*autonomy:\s*human-only\b/m.test(header)) ids.add(id);
  }
  return ids;
}

/**
 * Collect findings, split by SEVERITY. Pure over its inputs so it can be tested without a repo.
 *
 * `errors` fail the run. `warns` are advisory and do NOT — that distinction is the whole of BL-143,
 * and it exists because a gate with only one severity cannot advise, only forbid. BL-134 hit the
 * wall directly: its D4 wanted to flag `human-only` items left over from a retired fence, but with
 * every finding fatal that check would have failed the backlog on BL-134's own delivery, while D2
 * simultaneously required `autonomy` to remain legitimate advisory metadata. A field that is allowed
 * to be present cannot make the document invalid by being present. So D4 shipped as an honest
 * PARTIAL, on condition this tier was filed. This is that tier, and D4's second half now works.
 */
export function collectFindings(items, parserWarnings, text) {
  const errors = [];
  const warns = [];
  const authoredHumanOnly = explicitlyHumanOnly(text);

  // 1. Any parser warning is a structural failure — a header we could not read is not advisory.
  for (const w of parserWarnings) errors.push(`parser: ${w}`);

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
    // filters on status anyway. DEMOTED to a warning by BL-143 now that a tier exists: it is
    // exactly the "worth saying, not worth failing over" case the tier was built for.
    if (it.autonomy === 'eligible' && it.status !== 'todo') {
      warns.push(
        `item "${it.id}": autonomy "eligible" on a "${it.status}" item (only todo is workable)`,
      );
    }
    // BL-134 — `po-decision` is RETIRED as a value: a question is not a task, so such an item
    // belongs in `status: deferred` where it leaves the workable set for a stated reason. Existing
    // done/deferred items keep the value deliberately — it is history, and rewriting closed metadata
    // to match new vocabulary falsifies the record. Only a LIVE item is worth correcting.
    if (it.autonomy === 'po-decision' && it.status === 'todo') {
      errors.push(
        `item "${it.id}": autonomy "po-decision" on a todo item — BL-134 retired that value. ` +
          `If its resolution IS a PO call, set status: deferred (a question is not a task). ` +
          `If it is real work, drop the field and express any fence as blocked_by.`,
      );
    }
    // BL-134 D4, second half — NOW IMPLEMENTED, as a WARNING (BL-143). A `todo` item carrying
    // `human-only` with every blocker resolved is a leftover from the fence BL-134 retired: the
    // field names no reason and expires never, and `blocked_by` is the replacement that does both.
    //
    // It is advisory and MUST stay advisory. `human-only` is legitimate metadata under BL-134's D2,
    // so a field allowed to be present cannot make the document invalid by being present — which is
    // precisely why this could not ship until a warn tier existed. Contrast `po-decision` above,
    // which IS an error: that value was RETIRED, so it is invalid vocabulary, not a stale fence.
  if (authoredHumanOnly.has(it.id) && it.status === 'todo') {
      const unresolved = it.blockedBy.filter((d) => {
        const b = byId.get(d);
        return !b || !['done', 'dropped'].includes(b.status);
      });
      if (unresolved.length === 0) {
        warns.push(
          `item "${it.id}": autonomy "human-only" on an unblocked todo item — BL-134 retired that ` +
            `fence. If something really holds it, say what: blocked_by: [BL-NNN]. Advisory only.`,
        );
      }
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
  // Read the TEXT WE WERE GIVEN, never the repo. Calling `backlogText()` here made the function
  // impure and was caught by its own first test run: every fixture picked up the real backlog's
  // bullets and produced 20 phantom errors. A "pure" function that reaches for global state is
  // worse than an honestly impure one, because its tests look meaningful and are not.
  const lines = text.split('\n');
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

  return { errors, warns };
}

// Report.
//
// `--strict` promotes warnings to failures. It is opt-in rather than the default because the
// tier exists to let the gate ADVISE, and a warning that always fails the build is an error
// wearing a different word. Offered so a future CI job can tighten without a code change.
function main(argv) {
  const strict = argv.includes('--strict');
  const { items, warnings } = readBacklog(backlogPath);
  const { errors, warns } = collectFindings(items, warnings, backlogText());
  const where = backlogPath.replace(repoRoot + '/', '');

  for (const w of warns) console.error(`  ! ${w}`);

  if (errors.length > 0) {
    console.error(`✗ backlog structure INVALID — ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error(`\nParsed ${items.length} item(s) from ${where}.`);
    return 1;
  }

  if (strict && warns.length > 0) {
    console.error(`✗ ${warns.length} warning(s), and --strict was passed.`);
    return 1;
  }

  // The count is DERIVED. It read "0 warnings" as a literal until BL-143 — true only because
  // every finding was an error, and a sentence that would have kept saying "0" once it stopped
  // being true. A hardcoded number in a gate's success line is a small lie waiting for a reason.
  console.log(
    `✓ backlog structure OK — ${items.length} item(s), ${warns.length} warning(s).`,
  );
  for (const it of items) {
    console.log(`  ${it.id}  ${it.status.padEnd(9)} ${it.title.slice(0, 56)}`);
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exit(main(process.argv.slice(2)));
