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
 * CROSS-REPO (BL-022): a manifest may declare sibling repos as `../<repo>/...`
 * globs; each distinct `../<repo>` prefix is inspected too, and its paths are
 * reported with that prefix. A declared repo that is missing from disk — or is
 * not a readable git repo — is a hard failure, never a skip: skipping it would
 * leave it unfenced while the check reported green. Note the residual: only
 * DECLARED repos are seen, so an undeclared repo is unfenced while green.
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

function declaredRepos(scope) {
  // The manifest declares sibling repos as `../<repo>/...` globs. Every distinct
  // `../<repo>` prefix is a repo this fence must inspect; '.' is always inspected.
  const repos = new Set(['.']);
  if (!scope) return repos;

  const allGlobs = [...(scope.allowed || []), ...(scope.forbidden || []), ...(scope.free || [])];
  for (const glob of allGlobs) {
    if (!glob.startsWith('../')) continue;
    const parts = glob.split('/');
    if (parts.length >= 2) repos.add(`${parts[0]}/${parts[1]}`);
  }
  return repos;
}

function getChangedFiles(scope) {
  const files = new Set();
  const missing = [];

  for (const repoRel of declaredRepos(scope)) {
    const targetCwd = path.resolve(repoRoot, repoRel);

    // A declared repo that is not on disk cannot be inspected. Fail hard rather
    // than skip it: skipping would leave it unfenced while the check reports
    // green — the exact defect this fence exists to prevent (BL-022).
    if (!fs.existsSync(targetCwd)) {
      missing.push(repoRel);
      continue;
    }

    const prefix = repoRel === '.' ? '' : `${repoRel}/`;

    try {
      const output = execSync('git diff --name-only master...HEAD', { cwd: targetCwd, encoding: 'utf-8', stdio: 'pipe' });
      output.split('\n').filter(Boolean).forEach(f => files.add(`${prefix}${f}`));
    } catch (err) {
      try {
        const output = execSync('git diff --name-only origin/master...HEAD', { cwd: targetCwd, encoding: 'utf-8', stdio: 'pipe' });
        output.split('\n').filter(Boolean).forEach(f => files.add(`${prefix}${f}`));
      } catch (e) {
        // No master/origin-master to diff against (e.g. a fresh repo): the
        // working-tree status below still reports this repo's changes.
      }
    }

    // Also add untracked and unstaged/staged files in the working directory.
    // A failure here means the path is not a readable git repo at all, which
    // would leave it unfenced — surface it instead of swallowing it.
    let statusOutput;
    try {
      statusOutput = execSync('git status --porcelain', { cwd: targetCwd, encoding: 'utf-8', stdio: 'pipe' });
    } catch (e) {
      console.error(`\n❌ Declared repository is not a readable git repository: ${repoRel} (${targetCwd})`);
      console.error(`   git status failed: ${e.message.trim()}`);
      console.error('   The fence cannot inspect it, so it cannot report green.');
      process.exit(1);
    }
    statusOutput.split('\n').filter(Boolean).forEach(line => {
      let file = line.substring(3).trim();
      if (file.includes(' -> ')) {
        file = file.split(' -> ')[1];
      }
      if (file) files.add(`${prefix}${file}`);
    });
  }

  if (missing.length > 0) {
    console.error(`\n❌ Declared repositor${missing.length === 1 ? 'y is' : 'ies are'} not on disk:`);
    for (const repoRel of missing) {
      console.error(`   ${repoRel} → ${path.resolve(repoRoot, repoRel)}`);
    }
    console.error('\nThe scope manifest declares paths in it, so the fence cannot verify those paths');
    console.error('were left alone. Refusing rather than skipping: a skipped repo is unfenced while');
    console.error('the check reports green. Clone it beside this repo, or drop it from the manifest.');
    console.error('\nNote: this fence only sees repos the manifest DECLARES. A repo you never declare');
    console.error('stays invisible to it — an undeclared repo is unfenced while green.');
    process.exit(1);
  }

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

  const changedFiles = getChangedFiles(scope);
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
