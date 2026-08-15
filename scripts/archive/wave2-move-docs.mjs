#!/usr/bin/env node
/**
 * BL-144 Wave 2, one-shot: move durable docs into the module that owns them, and rewrite every
 * citation to them in the same commit. Archived beside Wave 1's splitter — it is a record of how
 * the move was made, not a tool anyone runs again.
 *
 * Conservation this preserves, and how:
 *   - every citation is rewritten repo-wide over TRACKED files, so `docs:check` reports 0 newly broken;
 *   - the citation baseline's 43 entries are re-KEYED, never added to — a citer that moves keeps its
 *     entry under the new path, so the register cannot silently grow during a migration;
 *   - each module.json gains the docs it now owns, so `modules:check` stays total and disjoint.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });

/**
 * The classification. Two destinations, and the rule is the doc's own lifecycle — the classifier
 * [[BL-142]] established ("do NOT invent a third proxy"), with one honest refinement it forced:
 *
 *   DURABLE  reference / operative / living  -> the owning module
 *   PENDING  a proposal or plan still awaiting a decision or a gate -> ALSO the owning module
 *   EPISODIC resolved, applied, superseded, or the ledger of a closed task -> design/archive/
 *
 * The refinement is the PENDING row. BL-142's two-way split reads "Draft for review" as episodic,
 * which is right for a draft that has been *decided* and wrong for one that has not: archiving an
 * undecided proposal buries an open question, and Wave 0's rule is that archived documents are
 * never edited again. A pending doc is not history. Its own Status line already says which it is.
 */
const MOVES = {
  governance: [
    'collaboration-workflow.md',      // Status: Operative — the source of truth for our working method
    'implementer-pitfalls.md',        // living case law behind the Rules of Engagement
    'logbook.md',                     // append-only durable cross-cutting findings
    'reprime-mechanism.md',           // Status: Operative reference
    'testlog.md',                     // "Durable index of validation runs"
    'self-hosting-program-draft.md',  // program reference, still cited by live backlog items
    'research-agenda.md',             // "research seed" — open questions, not a closed record
    'agent-rating-signal-note.md',    // STUB with a stated trigger to revisit — pending, not history
    'scope-fences-design-note.md',    // DRAFT, altitude only, awaiting a backlog gate — pending
    'tester-seat-proposal.md',        // "Status: LIVE — PO-ratified"
  ],
  containment: [
    'worktree-discipline.md',         // "adopted convention" — in force
    'launch-and-monitor-runbook.md',  // the operator seat's LIVE launch contract
    'hmp-commission-plan.md',         // PLAN awaiting Gate 1 — pending
    'brief-authoring-rung-plan.md',   // DRAFT, gate 1 not held — pending
    'meter-cap-cluster-plan.md',      // awaiting Gate 1 + a PO decision — pending
    'http-launcher-proposal.md',      // "IMPLEMENTED — pending Gate 2 review" — pending
  ],
  'agent-runtime': [
    'llm-client-architecture.md',     // Status: reference doc
    'live-test-models.md',            // Status: Living reference
    'bl028-plan.md',                  // BL-028 open, 1 of 3 phases merged — live
    'bl028-t3b-plan.md',              // the phase still to come — live
  ],
  'team-orchestration': [
    'planning-protocol.md',           // message-type reference
    'planning-protocol-diagrams.md',  // Status: Reference
    'decision-api-agents-for-coordination.md', // Status: ACCEPTED, Reversible — a live decision record
  ],
  'mcp-transport': ['attach-chat-runbook.md'],   // live operator runbook for attach mode
  relay: [
    'hmp-bidirectional-relay.md',     // PROPOSAL, not adopted — an open question, not history
    'hmp-session-submission.md',      // PROPOSAL, not adopted — same
    'outbound-pointer-relay-plan.md', // Gate 1 not held — pending
  ],
  'consensus-lab': ['arbiter-consensus-draft.md'], // ideation capture, not gate-approved — pending
  'orchestrator-host': [
    'architecture.md',                // BL-142 named this one explicitly: seven weeks cold and DURABLE.
    'implementation.md',              // the implementation spec it pairs with
  ],
};

/** Resolved, applied, or the ledger of a task that closed. Wave 0's rule: never edited again. */
const ARCHIVE = [
  'bl134-plan.md',                        // BL-134 merged 5f8f068 — resolved
  'bl134-implementation.md',              // its ledger, closed with it
  'backlog-gate-2026-08-05.md',           // a dated gate record
  'agent-md-relay-authority-amendment.md',// "✅ APPLIED the same day" — the amendment is live in AGENT.md
];

const renames = [];
for (const [mod, docs] of Object.entries(MOVES))
  for (const d of docs) renames.push([`design/${d}`, `modules/${mod}/docs/${d}`]);
for (const d of ARCHIVE) renames.push([`design/${d}`, `design/archive/${d}`]);

// 1 — move
for (const [from, to] of renames) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  git('mv', from, to);
}

// 2 — rewrite every citation, over TRACKED files only (the gate's own universe).
//     Longest-first so no path is a prefix of another being rewritten in the same pass.
const map = new Map(renames);
const ordered = [...map.keys()].sort((a, b) => b.length - a.length);
let edits = 0;
for (const rel of git('ls-files').trim().split('\n')) {
  if (!/\.(md|ts|tsx|mjs|json)$/.test(rel) || rel.includes('node_modules')) continue;
  let text;
  try {
    text = fs.readFileSync(rel, 'utf8');
  } catch {
    continue;
  }
  // ⚠️ AS RUN, THIS LOOP HAD A DEFECT, AND IT IS RECORDED RATHER THAN QUIETLY PATCHED, because the
  // rule it broke is stated in this file's own header. It rewrote citations INSIDE
  // `design/archive/**` — 28 files. Wave 0's rule is that an archived document is never edited
  // again: a reference that has gone stale there is CORRECT AS HISTORY ("the plan cited the file
  // that existed then"), and repairing it falsifies the record. The 28 were reverted before the
  // commit; only the four documents genuinely ARRIVING in the archive are changed. The guard below
  // is what should have been here from the start — and note that the citation gate could never have
  // caught this, because `design/archive/**` is CITER_EXEMPT and so is never scanned at all.
  if (/^design\/archive\//.test(rel) || /^scripts\/archive\//.test(rel)) continue;
  let out = text;
  for (const from of ordered) {
    // Boundary-anchored, exactly like the gates: never rewrite a path rooted in another repo.
    out = out.replace(new RegExp(`(?<![\\w./-])${from.replace(/[.]/g, '\\.')}`, 'g'), map.get(from));
  }
  if (out !== text) {
    fs.writeFileSync(rel, out);
    edits++;
  }
}

// 3 — re-key the citation baseline. A citer that moved keeps its entry; the register must NOT grow.
const bp = 'design/doc-citations-baseline.json';
const base = JSON.parse(fs.readFileSync(bp, 'utf8'));
const before = base.known.length;
base.known = base.known
  .map((k) => {
    const [citer, target] = k.split(' -> ');
    return `${map.get(citer) ?? citer} -> ${map.get(target) ?? target}`;
  })
  .sort();
if (base.known.length !== before) throw new Error(`baseline changed size ${before} -> ${base.known.length}`);
fs.writeFileSync(bp, JSON.stringify(base, null, 2) + '\n');

// 4 — each module records the docs it now owns.
for (const [mod, docs] of Object.entries(MOVES)) {
  const mf = `modules/${mod}/module.json`;
  const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
  j.docs = docs.map((d) => `modules/${mod}/docs/${d}`).sort();
  fs.writeFileSync(mf, JSON.stringify(j, null, 2) + '\n');
}

console.log(`moved ${renames.length} docs (${renames.length - ARCHIVE.length} to modules, ${ARCHIVE.length} archived)`);
console.log(`rewrote citations in ${edits} files; baseline re-keyed, still ${base.known.length} entries`);
