import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject, printNextSteps, TEMPLATES } from '../src/init.js';
import type { Template } from '../src/init.js';

const uid = () => Math.random().toString(36).slice(2);

describe('initProject', () => {
  let testDir: string;
  beforeEach(() => { testDir = join(tmpdir(), `cocapn-init-${uid()}`); mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { try { rmSync(testDir, { recursive: true, force: true }); } catch {} });

  it('creates all required files', () => {
    const log = initProject({ name: 'test-app', template: 'personal' }, testDir);
    expect(log).toContain('package.json');
    expect(log).toContain('cocapn.json');
    expect(log).toContain('soul.md');
    expect(log).toContain('README.md');
    expect(log).toContain('src/index.ts');
    expect(log).toContain('.github/workflows/ci.yml');
  });

  it('creates valid package.json', () => {
    initProject({ name: 'test-app', template: 'personal' }, testDir);
    const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('test-app');
    expect(pkg.type).toBe('module');
    expect(pkg.scripts.start).toBe('cocapn');
  });

  it('creates valid cocapn.json', () => {
    initProject({ name: 'test-app', template: 'personal' }, testDir);
    const cfg = JSON.parse(readFileSync(join(testDir, 'cocapn.json'), 'utf-8'));
    expect(cfg.mode).toBe('private');
    expect(cfg.port).toBe(3100);
    expect(cfg.llm.provider).toBe('deepseek');
  });

  it('includes API key in config when provided', () => {
    initProject({ name: 'test-app', template: 'personal', apiKey: 'sk-test' }, testDir);
    const cfg = JSON.parse(readFileSync(join(testDir, 'cocapn.json'), 'utf-8'));
    expect(cfg.llm.apiKey).toBe('sk-test');
  });

  it('creates soul.md with template personality', () => {
    initProject({ name: 'test-app', template: 'dm' }, testDir);
    const soul = readFileSync(join(testDir, 'soul.md'), 'utf-8');
    expect(soul).toContain('name: test-app');
    expect(soul).toContain('Dungeon Master');
  });

  it('creates src/index.ts', () => {
    initProject({ name: 'test-app' }, testDir);
    const src = readFileSync(join(testDir, 'src', 'index.ts'), 'utf-8');
    expect(src).toContain('test-app');
  });

  it('creates CI workflow', () => {
    initProject({ name: 'test-app' }, testDir);
    const ci = readFileSync(join(testDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(ci).toContain('npm test');
  });

  it('creates git repo with initial commit', () => {
    const log = initProject({ name: 'test-app', template: 'personal' }, testDir);
    expect(log).toContain('git initialized');
    expect(existsSync(join(testDir, '.git'))).toBe(true);
  });

  it('skips git if already initialized', () => {
    initProject({ name: 'test-app' }, testDir);
    const log2 = initProject({ name: 'test-app' }, testDir);
    expect(log2).not.toContain('git initialized');
  });

  it('uses description in README when provided', () => {
    initProject({ name: 'test-app', description: 'A cool app' }, testDir);
    const readme = readFileSync(join(testDir, 'README.md'), 'utf-8');
    expect(readme).toContain('A cool app');
  });

  it('all templates work', () => {
    for (const tpl of TEMPLATES) {
      const dir = join(testDir, tpl);
      mkdirSync(dir, { recursive: true });
      const log = initProject({ name: `test-${tpl}`, template: tpl as Template }, dir);
      expect(log).toContain('package.json');
      expect(log).toContain('soul.md');
      const soul = readFileSync(join(dir, 'soul.md'), 'utf-8');
      expect(soul.length).toBeGreaterThan(0);
    }
  });
});

describe('printNextSteps', () => {
  it('does not throw', () => {
    // Capture console.log output
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    printNextSteps('test-app');
    console.log = orig;
    expect(logs.some(l => l.includes('test-app'))).toBe(true);
    expect(logs.some(l => l.includes('DEEPSEEK_API_KEY'))).toBe(true);
  });
});
