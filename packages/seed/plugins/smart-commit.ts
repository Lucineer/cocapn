/**
 * Smart-commit plugin — /commit
 * Analyzes staged changes, generates conventional commit messages.
 * Auto-detects type (feat/fix/docs/refactor), lists breaking changes.
 */

import { execSync } from 'node:child_process';

export default {
  name: 'smart-commit',
  version: '1.0.0',
  hooks: {
    command: {
      async commit(_args: string) {
        const staged = execSync('git diff --cached --stat', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (!staged) return 'Nothing staged. Run `git add` first.';
        const diff = execSync('git diff --cached', { encoding: 'utf-8', timeout: 10000 });
        const type = detectType(diff);
        const scope = detectScope(diff);
        const subject = generateSubject(diff, type);
        const breaking = findBreaking(diff);
        const msg = buildMessage(type, scope, subject, breaking);
        return `Proposed commit:\n\`\`\`\n${msg}\n\`\`\`\nFiles:\n${staged}\nRun \`/commit --yes\` to apply.`;
      },
    },
  },
};

export function detectType(diff: string): string {
  if (/^[\+\-].*\/README\.md|^[\+\-].*\.md\b/m.test(diff) && !/^[\+].*export\s+function/m.test(diff)) return 'docs';
  if (/fix|bug|patch|issue|resolve|close/i.test(diff.slice(0, 2000))) return 'fix';
  if (/refactor|rename|move|extract|simplify|cleanup/i.test(diff.slice(0, 2000))) return 'refactor';
  if (/test|spec|\.test\.|describe\(|it\(/i.test(diff.slice(0, 2000))) return 'test';
  if (/^[\+].*export\s+(function|class|interface|const)/m.test(diff)) return 'feat';
  return 'chore';
}

export function detectScope(diff: string): string {
  const files = diff.match(/^\+\+\+ b\/(.+)/gm) || [];
  const dirs = files.map(f => f.replace('+++ b/', '').split('/')[0]).filter(Boolean);
  const counts: Record<string, number> = {};
  dirs.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

export function generateSubject(diff: string, type: string): string {
  const fns = [...diff.matchAll(/^\+.*export\s+(?:async\s+)?function\s+(\w+)/gm)].map(m => m[1]);
  if (fns.length) return `add ${fns[0]}${fns.length > 1 ? ` +${fns.length - 1} more` : ''}`;
  const files = [...diff.matchAll(/^\+\+\+ b\/(.+)/gm)].map(m => m[1].split('/').pop()!);
  if (files.length) return `update ${files[0]}`;
  return `${type}: changes`;
}

export function findBreaking(diff: string): string[] {
  const breaking: string[] = [];
  if (/^[-+].*export\s+(function|class|interface)\s+/m.test(diff) && /^\-.*export\s+(function|class|interface)\s+/m.test(diff)) breaking.push('Removed export');
  if (/BREAKING/i.test(diff)) breaking.push('BREAKING marker in diff');
  return breaking;
}

export function buildMessage(type: string, scope: string, subject: string, breaking: string[]): string {
  const prefix = scope ? `${type}(${scope})` : type;
  let msg = `${prefix}: ${subject}`;
  if (breaking.length) msg += `\n\nBREAKING CHANGE:\n${breaking.map(b => `- ${b}`).join('\n')}`;
  return msg;
}
