/**
 * Code-review plugin — /review [path]
 * Reviews code: common issues, complexity, security scan, performance hints.
 * Hook: command, scans files or staged changes.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

export default {
  name: 'code-review',
  version: '1.0.0',
  hooks: {
    command: {
      async review(args: string) {
        const target = args.trim();
        const files = target ? [target] : getStagedFiles();
        if (!files.length) return 'No files to review. Stage files or pass a path.';
        const results = files.filter(f => existsSync(f)).map(reviewFile);
        return results.join('\n\n') || 'No reviewable files found.';
      },
    },
  },
};

function getStagedFiles(): string[] {
  return execSync('git diff --cached --name-only -- "*.ts" "*.js" "*.tsx" "*.jsx"', { encoding: 'utf-8', timeout: 5000 }).trim().split('\n').filter(Boolean);
}

interface ReviewResult { file: string; issues: Issue[] }
interface Issue { severity: 'error' | 'warn' | 'info'; line: number; rule: string; message: string }

export function reviewFile(filePath: string): string {
  const src = readFileSync(filePath, 'utf-8');
  const issues: Issue[] = [...scanPatterns(src), ...scanComplexity(src), ...scanSecurity(src), ...scanPerformance(src)];
  if (!issues.length) return `## ${filePath}\nNo issues found.`;
  const grouped = issues.sort((a, b) => a.line - b.line);
  const lines = grouped.map(i => `  ${i.severity === 'error' ? 'X' : i.severity === 'warn' ? '!' : 'i'} L${i.line}: [${i.rule}] ${i.message}`);
  return `## ${filePath}\n${lines.join('\n')}`;
}

export function scanPatterns(src: string): Issue[] {
  const issues: Issue[] = [];
  const patterns: [RegExp, string, 'warn' | 'info'][] = [
    [/\/\/\s*TODO/i, 'TODO', 'info'], [/\/\/\s*FIXME/i, 'FIXME', 'warn'],
    [/console\.(log|debug|info)\(/, 'console.log', 'warn'],
    [/(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]+['"]/i, 'hardcoded-secret', 'error'],
    [/debugger\s*;/, 'debugger', 'warn'],
  ];
  patterns.forEach(([re, rule, severity]) => {
    src.split('\n').forEach((line, i) => { if (re.test(line)) issues.push({ severity, line: i + 1, rule, message: line.trim() }); });
  });
  return issues;
}

export function scanComplexity(src: string): Issue[] {
  const issues: Issue[] = [];
  src.split('\n').forEach((line, i) => {
    let depth = 0;
    for (const ch of line) { if (ch === '{' || ch === '(') depth++; }
    if (depth > 5) issues.push({ severity: 'warn', line: i + 1, rule: 'deep-nesting', message: `Nesting depth ${depth} (max 5)` });
  });
  return issues;
}

export function scanSecurity(src: string): Issue[] {
  const issues: Issue[] = [];
  const patterns: [RegExp, string][] = [
    [/\beval\s*\(/, 'eval-usage'], [/\.innerHTML\s*=/, 'innerHTML-assign'],
    [/SELECT\s+.*\+|INSERT\s+.*\+|UPDATE\s+.*\+|DELETE\s+.*\+/i, 'sql-injection'],
    [/exec\s*\(\s*`[^`]*\$\{/, 'command-injection'],
    [/new\s+Function\s*\(/, 'dynamic-function'],
    [/document\.write\s*\(/, 'document-write'],
  ];
  patterns.forEach(([re, rule]) => {
    src.split('\n').forEach((line, i) => { if (re.test(line)) issues.push({ severity: 'error' as const, line: i + 1, rule, message: line.trim() }); });
  });
  return issues;
}

export function scanPerformance(src: string): Issue[] {
  const issues: Issue[] = [];
  src.split('\n').forEach((line, i) => {
    if (/\.forEach\s*\([\s\S]*?(await|\.query|\.fetch|\.find|\.select)/i.test(line))
      issues.push({ severity: 'warn', line: i + 1, rule: 'n+1-query', message: 'Possible N+1 query in loop' });
    if (/for\s*\(.*;\s*\d{4,}\s*;/.test(line))
      issues.push({ severity: 'info', line: i + 1, rule: 'large-loop', message: 'Large loop iteration count' });
  });
  return issues;
}
