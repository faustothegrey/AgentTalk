import { describe, it, expect } from 'vitest';
import { globToRegex, parseScopeYaml, matchGlobs } from '../scope-check.mjs';

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
});
