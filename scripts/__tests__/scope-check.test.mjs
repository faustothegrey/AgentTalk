import { describe, it, expect } from 'vitest';
import { globToRegex, parseScopeYaml, matchGlobs } from '../scope-check.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// Stands up a real main repo (with the script copied in) whose manifest declares
// `siblingGlob`, and runs the script the way an implementer would. The seam is
// where the defect is injected — a sibling repo the fence must notice — not the
// glob matcher, which cannot see cross-repo blindness at all (BL-022).
function runScopeCheckWithSibling({ siblingGlob, createSibling }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-check-test-'));
  const mainRepo = path.join(tempDir, 'main-repo');
  fs.mkdirSync(mainRepo);

  if (createSibling) {
    const otherRepo = path.join(tempDir, 'other-repo');
    fs.mkdirSync(otherRepo);
    execSync('git init', { cwd: otherRepo, stdio: 'ignore' });
    fs.writeFileSync(path.join(otherRepo, 'README.md'), '# other repo');
    execSync('git add README.md', { cwd: otherRepo, stdio: 'ignore' });
    execSync('git commit -m "initial"', { cwd: otherRepo, stdio: 'ignore' });
    // The out-of-scope change the fence must catch.
    fs.writeFileSync(path.join(otherRepo, 'foo.js'), 'console.log("changed");');
  }

  fs.mkdirSync(path.join(mainRepo, 'design'));
  fs.mkdirSync(path.join(mainRepo, 'scripts'));
  fs.copyFileSync(
    path.join(repoRoot, 'scripts/scope-check.mjs'),
    path.join(mainRepo, 'scripts/scope-check.mjs')
  );

  const manifest = `
## \`test-branch\`
\`\`\`yaml
@scope:
  allowed:
    - design/**
    - ${siblingGlob}
\`\`\`
`;
  fs.writeFileSync(path.join(mainRepo, 'design', 'test.md'), manifest);
  execSync('git init', { cwd: mainRepo, stdio: 'ignore' });
  execSync('git add .', { cwd: mainRepo, stdio: 'ignore' });
  execSync('git commit -m "initial"', { cwd: mainRepo, stdio: 'ignore' });
  execSync('git checkout -b test-branch', { cwd: mainRepo, stdio: 'ignore' });

  let error;
  let output = '';
  try {
    output = execSync('node scripts/scope-check.mjs', { cwd: mainRepo, stdio: 'pipe' }).toString();
  } catch (err) {
    error = err;
    output = err.stdout.toString() + err.stderr.toString();
  }
  return { error, output };
}

describe('scope-check', () => {
  describe('globToRegex', () => {
    it('matches exact files', () => {
      const regex = globToRegex('package.json');
      expect(regex.test('package.json')).toBe(true);
      expect(regex.test('foo/package.json')).toBe(false);
    });

    it('matches * within a directory', () => {
      const regex = globToRegex('scripts/*.mjs');
      expect(regex.test('scripts/foo.mjs')).toBe(true);
      expect(regex.test('scripts/foo.js')).toBe(false);
      expect(regex.test('scripts/nested/foo.mjs')).toBe(false);
    });

    it('matches ** for nested directories', () => {
      const regex = globToRegex('packages/**/*.ts');
      expect(regex.test('packages/foo.ts')).toBe(true);
      expect(regex.test('packages/core/foo.ts')).toBe(true);
      expect(regex.test('packages/core/src/foo.ts')).toBe(true);
      expect(regex.test('foo.ts')).toBe(false);
    });
  });

  describe('parseScopeYaml', () => {
    it('parses valid yaml scope', () => {
      const yaml = `
@scope:
  allowed:
    - foo.js
    - "bar.js"
  forbidden:
    - src/**/*.ts
  free:
    - '*.md'
`;
      const result = parseScopeYaml(yaml);
      expect(result.allowed).toEqual(['foo.js', 'bar.js']);
      expect(result.forbidden).toEqual(['src/**/*.ts']);
      expect(result.free).toEqual(['*.md']);
    });
  });

  describe('matchGlobs', () => {
    it('matches against a list of globs', () => {
      const globs = ['foo.js', 'src/**/*.ts'];
      expect(matchGlobs('foo.js', globs)).toBe(true);
      expect(matchGlobs('src/index.ts', globs)).toBe(true);
      expect(matchGlobs('src/core/index.ts', globs)).toBe(true);
      expect(matchGlobs('bar.js', globs)).toBe(false);
    });
  });

  describe('e2e scope-check', () => {
    it('checks changes in other repositories declared in the scope manifest', () => {
      const { error, output } = runScopeCheckWithSibling({
        siblingGlob: '../other-repo/allowed.js',
        createSibling: true,
      });

      expect(error).toBeDefined();
      expect(output).toContain('❌ [OUT OF SCOPE] ../other-repo/foo.js');
    });

    it('fails hard when a declared repository is not on disk', () => {
      const { error, output } = runScopeCheckWithSibling({
        siblingGlob: '../other-repo/allowed.js',
        createSibling: false,
      });

      expect(error).toBeDefined();
      expect(output).toContain('not on disk');
      expect(output).toContain('../other-repo');
      // The refusal must not be mistakable for a pass.
      expect(output).not.toContain('✅ Scope check passed');
    });
  });
});
