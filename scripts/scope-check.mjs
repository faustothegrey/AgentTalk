#!/usr/bin/env node

/**
 * M18-T1 Scope Check
 * Parses the active task's @scope manifest from the design ledgers and compares
 * changed paths against `allowed`, `forbidden`, and `free` globs.
 *
 * USAGE — who runs it, and when (BL-015 L0, detective layer):
 *   node scripts/scope-check.mjs
 * Run from anywhere in the repo, on the task branch. It resolves the active
 * branch, finds the `@scope` manifest for that branch in `design/*.md` (the
 * task's ledger section), and checks every changed path — committed since
 * `master...HEAD` (falling back to `origin/master...HEAD` when no local
 * `master` exists, e.g. CI), plus staged/unstaged/untracked worktree files.
 * Exit 0 = all changes in-scope; exit 1 = violations listed, one per line.
 *
 *   - IMPLEMENTER: run it as part of the Rule-5 self-check, BEFORE claiming
 *     done — a non-zero exit is either a file to revert or a scope
 *     conversation to have at the gate, never a manifest to widen (IP-14).
 *   - IMPLEMENTATION REVIEWER (gate 2): run it on the delivered branch each
 *     round; a violation is REFUTE evidence.
 *   - TASK-END REVIEWER (gate 3): run it in the closure sweep alongside the
 *     pollution checks.
 * On `master`/`main` it exits 0 without checking (no task manifest applies).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function globToRegex(glob) {
  // Simple glob to regex converter
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*\*\//g, '___DOUBLE_STAR_SLASH___')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/___DOUBLE_STAR_SLASH___/g, '(.*\\/)?')
    .replace(/___DOUBLE_STAR___/g, '.*');

  // Assume full path match from repo root
  return new RegExp(`^${escaped}$`);
}

function getActiveBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
}

function getChangedFiles() {
  const files = new Set();
  try {
    const output = execSync('git diff --name-only master...HEAD', { cwd: repoRoot, encoding: 'utf-8' });
    output.split('\n').filter(Boolean).forEach(f => files.add(f));
  } catch (err) {
    try {
      const output = execSync('git diff --name-only origin/master...HEAD', { cwd: repoRoot, encoding: 'utf-8' });
      output.split('\n').filter(Boolean).forEach(f => files.add(f));
    } catch (e) {
      // Fallback to local unstaged/staged files if not tracking master
    }
  }

  // Also add untracked and unstaged/staged files in the working directory
  const statusOutput = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf-8' });
  statusOutput.split('\n').filter(Boolean).forEach(line => {
    let file = line.substring(3).trim();
    if (file.includes(' -> ')) {
      file = file.split(' -> ')[1];
    }
    if (file) files.add(file);
  });

  return Array.from(files);
}

function findTaskScope(branchName) {
  const designDir = path.join(repoRoot, 'design');
  const files = fs.readdirSync(designDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(designDir, file), 'utf-8');

    if (!content.includes(branchName)) continue;

    // Split into sections by heading
    const sections = content.split(/^## /m);
    for (const section of sections) {
      if (section.includes(`\`${branchName}\``) || section.includes(`Branch: ${branchName}`)) {
        // Extract the @scope block
        const match = section.match(/```yaml\n@scope:\n([\s\S]*?)```/);
        if (match) {
          return parseScopeYaml(match[1]);
        }
      }
    }
  }
  return null;
}

function parseScopeYaml(yamlStr) {
  const scope = { allowed: [], forbidden: [], free: [] };
  let currentKey = null;

  for (const line of yamlStr.split('\n')) {
    const matchKey = line.match(/^\s+(allowed|forbidden|free):/);
    if (matchKey) {
      currentKey = matchKey[1];
      continue;
    }

    // Match array items like `- "glob"` or `- 'glob'` or `- glob`
    const matchItem = line.match(/^\s+-\s+(?:"([^"]+)"|'([^']+)'|([^"'\s]+))/);
    if (matchItem && currentKey) {
      const val = matchItem[1] || matchItem[2] || matchItem[3];
      scope[currentKey].push(val);
    }
  }
  return scope;
}

function matchGlobs(filePath, globs) {
  return globs.some(glob => globToRegex(glob).test(filePath));
}

function main() {
  console.log('--- Scope Check ---');
  const branchName = getActiveBranch();
  console.log(`Active branch: ${branchName}`);

  if (branchName === 'master' || branchName === 'main') {
    console.log('On main branch, skipping scope check.');
    process.exit(0);
  }

  const scope = findTaskScope(branchName);
  if (!scope) {
    console.error(`❌ Could not find @scope manifest for branch ${branchName} in design/*.md`);
    process.exit(1);
  }

  console.log('Scope manifest found:');
  console.log(`  Allowed:   ${scope.allowed.length} patterns`);
  console.log(`  Forbidden: ${scope.forbidden.length} patterns`);
  console.log(`  Free:      ${scope.free.length} patterns`);

  const changedFiles = getChangedFiles();
  console.log(`\nChanged files (${changedFiles.length}):`);

  let hasViolation = false;

  for (const file of changedFiles) {
    if (matchGlobs(file, scope.forbidden)) {
      console.error(`❌ [FORBIDDEN] ${file}`);
      hasViolation = true;
    } else if (matchGlobs(file, scope.free)) {
      console.log(`✅ [FREE]      ${file}`);
    } else if (matchGlobs(file, scope.allowed)) {
      console.log(`✅ [ALLOWED]   ${file}`);
    } else {
      console.error(`❌ [OUT OF SCOPE] ${file} (not matched by free or allowed)`);
      hasViolation = true;
    }
  }

  if (hasViolation) {
    console.error('\n❌ Scope check failed! Out-of-scope files were touched.');
    process.exit(1);
  } else {
    console.log('\n✅ Scope check passed. All changed files are in-scope.');
    process.exit(0);
  }
}

// Export for unit tests
export { globToRegex, parseScopeYaml, matchGlobs };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
