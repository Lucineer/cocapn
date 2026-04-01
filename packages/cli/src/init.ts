/**
 * cocapn init — Universal project initializer.
 *
 * Usage: npx cocapn init [template]
 * Templates: personal, business, maker, dm, fishing, blank
 * Creates: package.json, cocapn.json, soul.md, README.md, src/index.ts, CI workflow
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export const TEMPLATES = ['personal', 'business', 'maker', 'dm', 'fishing', 'blank'] as const;
export type Template = (typeof TEMPLATES)[number];

interface InitOptions {
  name: string;
  description?: string;
  template?: Template;
  apiKey?: string;
}

const SOULS: Record<Template, string> = {
  personal: 'I am a personal assistant. I remember everything about my user and help them stay organized.',
  business: 'I am a business agent. I track projects, deadlines, and help with decisions.',
  maker: 'I am a maker companion. I help with code, designs, and shipping products.',
  dm: 'I am a Dungeon Master. I run TTRPG campaigns, track characters, and narrate adventures.',
  fishing: 'I am a fishing log. I track catches, weather, tides, and help plan trips.',
  blank: 'I am a blank agent. Teach me who I should be.',
};

/** Initialize a new cocapn project. Returns list of created files/artifacts. */
export function initProject(opts: InitOptions, dir: string = process.cwd()): string[] {
  const name = opts.name;
  const tpl = opts.template ?? 'personal';
  const log: string[] = [];

  // package.json
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name, version: '0.1.0', type: 'module', main: 'src/index.ts',
    scripts: { start: 'cocapn', dev: 'cocapn --web', build: 'tsc' },
  }, null, 2) + '\n');
  log.push('package.json');

  // cocapn.json
  const config: Record<string, unknown> = { mode: 'private', port: 3100, llm: { provider: 'deepseek' } };
  if (opts.apiKey) (config.llm as Record<string, unknown>).apiKey = opts.apiKey;
  writeFileSync(join(dir, 'cocapn.json'), JSON.stringify(config, null, 2) + '\n');
  log.push('cocapn.json');

  // soul.md
  writeFileSync(join(dir, 'soul.md'),
    `---\nname: ${name}\ntone: friendly\nmodel: deepseek\n---\n\n${SOULS[tpl]}\n`);
  log.push('soul.md');

  // README.md
  writeFileSync(join(dir, 'README.md'),
    `# ${name}\n\n${opts.description ?? `A cocapn agent (${tpl} template).`}\n\n## Getting Started\n\n\`\`\`bash\nexport DEEPSEEK_API_KEY=your-key\ncocapn\n\`\`\`\n`);
  log.push('README.md');

  // src/index.ts
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'index.ts'),
    `// ${name} — powered by cocapn\nexport const name = '${name}';\n`);
  log.push('src/index.ts');

  // .github/workflows/ci.yml
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'),
    `name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: 22 }\n      - run: npm install\n      - run: npm test\n`);
  log.push('.github/workflows/ci.yml');

  // .gitignore
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n.cocapn/\n');

  // Git init
  try {
    if (!existsSync(join(dir, '.git'))) {
      execSync('git init', { cwd: dir, stdio: 'pipe', timeout: 5000 });
      execSync('git add .', { cwd: dir, stdio: 'pipe', timeout: 5000 });
      execSync(`git commit -m "init: cocapn ${tpl} project" --author="Superinstance <agent@cocapn.dev>"`,
        { cwd: dir, stdio: 'pipe', timeout: 10000 });
      log.push('git initialized');
    }
  } catch { log.push('git init (skipped)'); }

  return log;
}

/** Print next-steps to stdout */
export function printNextSteps(name: string): void {
  console.log(`\n  ${name} is alive!\n`);
  console.log('  Next steps:');
  console.log('    export DEEPSEEK_API_KEY=your-key');
  console.log('    cocapn              # terminal chat');
  console.log('    cocapn --web        # web chat (localhost:3100)\n');
}
