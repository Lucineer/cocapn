/**
 * Auto-doc plugin — /autodoc [path]
 * Generates documentation from code: JSDoc stubs, API docs, README TOC.
 * Hook: command, generates docs on demand or for changed files.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

export default {
  name: 'auto-doc',
  version: '1.0.0',
  hooks: {
    command: {
      async autodoc(args: string) {
        const target = args.trim();
        if (!target) return autoDocChanged();
        if (target === 'toc') return updateReadmeToc('.');
        if (target === 'api') return generateApiDocs('.');
        return generateForFile(target);
      },
    },
  },
};

function autoDocChanged(): string {
  const diff = execSync('git diff --name-only HEAD~1..HEAD -- "*.ts" "*.js"', { encoding: 'utf-8', timeout: 5000 }).trim();
  if (!diff) return 'No changed .ts/.js files in last commit.';
  const files = diff.split('\n').filter(Boolean);
  return files.map(f => generateForFile(f)).join('\n---\n');
}

function generateForFile(filePath: string): string {
  if (!existsSync(filePath)) return `File not found: ${filePath}`;
  const src = readFileSync(filePath, 'utf-8');
  const exports = extractExports(src);
  const jsdocStubs = exports.map(e => jsdocStub(e)).join('\n');
  const apiSection = exports.map(e => `- \`${e.name}(${e.params.join(', ')}\` — *${e.type}*`).join('\n');
  return `## ${filePath}\n### Exported functions\n${apiSection || '_No exported functions found_'}\n### JSDoc stubs\n\`\`\`ts\n${jsdocStubs || '// No functions to document'}\n\`\`\``;
}

interface ExportInfo { name: string; params: string[]; type: string; async: boolean }

function extractExports(src: string): ExportInfo[] {
  const results: ExportInfo[] = [];
  const re = /export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    results.push({ name: m[2], params: m[3].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean), type: m[1] ? 'async' : 'sync', async: !!m[1] });
  }
  return results;
}

function jsdocStub(e: ExportInfo): string {
  const paramLines = e.params.map(p => ` * @param {*} ${p}`).join('\n');
  return `/**\n * ${e.name}\n${paramLines}${paramLines ? '\n' : ''} * @returns {*}\n */\nexport ${e.async ? 'async ' : ''}function ${e.name}(${e.params.join(', ')}) {}`;
}

function updateReadmeToc(dir: string): string {
  const readme = `${dir}/README.md`;
  if (!existsSync(readme)) return 'No README.md found.';
  const md = readFileSync(readme, 'utf-8');
  const headings = [...md.matchAll(/^#{2,3}\s+(.+)$/gm)].map(m => m[1].trim());
  const toc = headings.map(h => {
    const indent = h.startsWith('#') ? '  ' : '';
    const link = h.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `${indent}- [${h.replace(/^#+\s*/, '')}](#${link})`;
  }).join('\n');
  const updated = md.replace(/<!-- TOC:START -->[\s\S]*?<!-- TOC:END -->/, `<!-- TOC:START -->\n${toc}\n<!-- TOC:END -->`);
  if (updated !== md) { writeFileSync(readme, updated); return `Updated README TOC (${headings.length} headings).`; }
  return `Found ${headings.length} headings. Add \`<!-- TOC:START --><!-- TOC:END -->\` markers to README.md.`;
}

function generateApiDocs(dir: string): string {
  const out = execSync(`grep -r "export function" ${dir} --include="*.ts" -l 2>/dev/null || true`, { encoding: 'utf-8', timeout: 5000 }).trim();
  if (!out) return 'No exported functions found.';
  return out.split('\n').filter(Boolean).map(f => generateForFile(f)).join('\n---\n');
}
