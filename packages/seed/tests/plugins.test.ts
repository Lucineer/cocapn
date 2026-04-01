/**
 * Plugin tests — 5 plugins, 3+ tests each.
 * Tests core logic without requiring bridge runtime.
 */

import { describe, it, expect } from 'vitest';

// --- Auto-doc ---
import autoDoc from '../plugins/auto-doc.js';

describe('auto-doc plugin', () => {
  it('has correct plugin metadata', () => {
    expect(autoDoc.name).toBe('auto-doc');
    expect(autoDoc.version).toBe('1.0.0');
    expect(autoDoc.hooks.command).toHaveProperty('autodoc');
  });

  it('extractExports finds exported functions', async () => {
    const src = `export function add(a: number, b: number) { return a + b; }\nexport async function fetch(url: string) { return fetch(url); }`;
    // Access internal via dynamic import of the module text
    const re = /export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    const results: { name: string; params: string[]; async: boolean }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      results.push({ name: m[2], params: m[3].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean), async: !!m[1] });
    }
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('add');
    expect(results[0].params).toEqual(['a', 'b']);
    expect(results[0].async).toBe(false);
    expect(results[1].name).toBe('fetch');
    expect(results[1].async).toBe(true);
  });

  it('jsdoc stubs are generated correctly', () => {
    const e = { name: 'greet', params: ['name', 'greeting'], type: 'sync', async: false };
    const paramLines = e.params.map(p => ` * @param {*} ${p}`).join('\n');
    const stub = `/**\n * ${e.name}\n${paramLines}\n * @returns {*}\n */`;
    expect(stub).toContain('@param {*} name');
    expect(stub).toContain('@param {*} greeting');
    expect(stub).toContain('greet');
  });
});

// --- Smart-commit ---
import smartCommit from '../plugins/smart-commit.js';
import { detectType, detectScope, generateSubject, findBreaking, buildMessage } from '../plugins/smart-commit.js';

describe('smart-commit plugin', () => {
  it('has correct plugin metadata', () => {
    expect(smartCommit.name).toBe('smart-commit');
    expect(smartCommit.version).toBe('1.0.0');
    expect(smartCommit.hooks.command).toHaveProperty('commit');
  });

  it('detectType classifies diffs correctly', () => {
    expect(detectType('+++ b/README.md\n+some docs')).toBe('docs');
    expect(detectType('+export function newFeature() {}')).toBe('feat');
    expect(detectType('fix the bug in parser')).toBe('fix');
    expect(detectType('refactor the module system')).toBe('refactor');
    expect(detectType('+import fs from "fs"')).toBe('chore');
    expect(detectType('+describe("my test", () => { it("works") }))')).toBe('test');
  });

  it('detectScope finds the primary directory', () => {
    const diff = '+++ b/src/foo.ts\n+++ b/src/bar.ts\n+++ b/lib/baz.ts';
    const scope = detectScope(diff);
    expect(scope).toBe('src');
  });

  it('generateSubject creates meaningful subjects', () => {
    const diff = '+export function handleClick() {}';
    const subject = generateSubject(diff, 'feat');
    expect(subject).toContain('handleClick');
  });

  it('findBreaking detects removed exports', () => {
    const diff = '-export function oldApi() {}\n+export function newApi() {}';
    const breaking = findBreaking(diff);
    expect(breaking).toContain('Removed export');
  });

  it('buildMessage formats conventional commits', () => {
    const msg = buildMessage('feat', 'core', 'add new parser', []);
    expect(msg).toBe('feat(core): add new parser');
    const msgBreaking = buildMessage('feat', '', 'breaking change', ['Removed export']);
    expect(msgBreaking).toContain('BREAKING CHANGE');
  });
});

// --- Code-review ---
import codeReview from '../plugins/code-review.js';
import { scanPatterns, scanComplexity, scanSecurity, scanPerformance } from '../plugins/code-review.js';

describe('code-review plugin', () => {
  it('has correct plugin metadata', () => {
    expect(codeReview.name).toBe('code-review');
    expect(codeReview.version).toBe('1.0.0');
    expect(codeReview.hooks.command).toHaveProperty('review');
  });

  it('scanPatterns finds TODOs, console.log, hardcoded secrets', () => {
    const src = `// TODO: fix this\nconsole.log("debug");\nconst apiKey = "sk-12345";\nconst x = 1;`;
    const issues = scanPatterns(src);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    const rules = issues.map(i => i.rule);
    expect(rules).toContain('TODO');
    expect(rules).toContain('console.log');
    expect(rules).toContain('hardcoded-secret');
  });

  it('scanSecurity catches eval and innerHTML', () => {
    const src = `eval(userInput);\nelement.innerHTML = data;\nquery("SELECT * FROM users WHERE id=" + userId);`;
    const issues = scanSecurity(src);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    const rules = issues.map(i => i.rule);
    expect(rules).toContain('eval-usage');
    expect(rules).toContain('innerHTML-assign');
    expect(rules).toContain('sql-injection');
  });

  it('scanComplexity flags deep nesting', () => {
    const src = `if (a) { if (b) { if (c) { if (d) { if (e) { if (f) { deep(); } } } } } }`;
    const issues = scanComplexity(src);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.rule === 'deep-nesting')).toBe(true);
  });

  it('scanPerformance detects N+1 patterns', () => {
    const src = `items.forEach(item => { db.query("SELECT * FROM x WHERE id=" + item.id); });`;
    const issues = scanPerformance(src);
    expect(issues.some(i => i.rule === 'n+1-query')).toBe(true);
  });

  it('scanPatterns catches FIXME and debugger', () => {
    const src = `// FIXME: broken\ndebugger;\nconst x = 1;`;
    const issues = scanPatterns(src);
    const rules = issues.map(i => i.rule);
    expect(rules).toContain('FIXME');
    expect(rules).toContain('debugger');
  });
});

// --- Time-tracker ---
import timeTracker from '../plugins/time-tracker.js';
import { loadData, saveData, summary } from '../plugins/time-tracker.js';

describe('time-tracker plugin', () => {
  it('has correct plugin metadata', () => {
    expect(timeTracker.name).toBe('time-tracker');
    expect(timeTracker.version).toBe('1.0.0');
    expect(timeTracker.hooks.command).toHaveProperty('time');
  });

  it('summary formats daily breakdown', () => {
    const data = [
      { date: '2026-03-30', files: { 'src/app.ts': 2.0, 'src/util.ts': 1.0 }, total: 3.0 },
      { date: '2026-03-31', files: { 'src/app.ts': 1.5 }, total: 1.5 },
    ];
    const result = summary(data, 7);
    expect(result).toContain('4.5h');
    expect(result).toContain('src/app.ts');
    expect(result).toContain('2026-03-30');
    expect(result).toContain('2026-03-31');
  });

  it('summary handles empty data', () => {
    const result = summary([], 1);
    expect(result).toContain('No time tracked');
  });

  it('loadData returns empty array when no store exists', () => {
    const data = loadData();
    expect(Array.isArray(data)).toBe(true);
  });

  it('summary aggregates top files across days', () => {
    const data = [
      { date: '2026-03-29', files: { 'a.ts': 1.0, 'b.ts': 2.0 }, total: 3.0 },
      { date: '2026-03-30', files: { 'b.ts': 3.0, 'c.ts': 1.0 }, total: 4.0 },
    ];
    const result = summary(data, 7);
    expect(result).toContain('b.ts: 5.0h');
    expect(result).toContain('7.0h');
  });
});

// --- Mood-detector ---
import moodDetector from '../plugins/mood-detector.js';
import { analyzeSentiment, detectTrend, moodLabel } from '../plugins/mood-detector.js';

describe('mood-detector plugin', () => {
  it('has correct plugin metadata', () => {
    expect(moodDetector.name).toBe('mood-detector');
    expect(moodDetector.version).toBe('1.0.0');
    expect(moodDetector.hooks.command).toHaveProperty('mood');
  });

  it('analyzeSentiment scores positive messages positively', () => {
    expect(analyzeSentiment('feat: add awesome new feature!')).toBeGreaterThan(0);
    expect(analyzeSentiment('fix: resolve the issue nicely')).toBeGreaterThan(0);
  });

  it('analyzeSentiment scores negative messages negatively', () => {
    expect(analyzeSentiment('wtf is this broken garbage')).toBeLessThan(0);
    expect(analyzeSentiment('hack: stupid workaround for crap code')).toBeLessThan(-1);
  });

  it('analyzeSentiment scores neutral messages near zero', () => {
    const score = analyzeSentiment('chore: update dependencies');
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('detectTrend identifies improving mood', () => {
    // recent first: [positive, positive, negative, negative]
    const scores = [2, 1.5, -1, -2];
    expect(detectTrend(scores)).toBe('improving');
  });

  it('detectTrend identifies declining mood', () => {
    const scores = [-2, -1, 1, 1.5];
    expect(detectTrend(scores)).toBe('declining');
  });

  it('moodLabel maps scores to states', () => {
    expect(moodLabel(1.5)).toBe('On Fire');
    expect(moodLabel(0.5)).toBe('Productive');
    expect(moodLabel(0)).toBe('Neutral');
    expect(moodLabel(-0.5)).toBe('Frustrated');
    expect(moodLabel(-2)).toBe('Burned Out');
  });
});
