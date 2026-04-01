/**
 * Plugins — extensible plugin system for cocapn.
 *
 * Two layers:
 * 1. PluginLoader — loads JS files from cocapn/plugins/*.js (existing)
 * 2. PluginRegistry — named plugin loading, install, built-ins (new)
 *
 * Built-in plugins: vision, research, analytics, channels, a2a.
 * Plugin errors are caught and logged, never crash. Zero dependencies.
 */

import { existsSync, readdirSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatContext {
  message: string;
  facts: Record<string, string>;
  [key: string]: unknown;
}

/** Legacy plugin shape (file-based) */
export interface Plugin {
  name: string;
  version: string;
  hooks: {
    'before-chat'?: (message: string, context: ChatContext) => Promise<ChatContext>;
    'after-chat'?: (response: string, context: ChatContext) => Promise<string>;
    'command'?: Record<string, (args: string) => Promise<string>>;
    'periodic'?: () => Promise<void>;
  };
}

/** Extended plugin shape (registry-based) */
export interface Command { name: string; description: string; run: (args: string) => Promise<string>; }
export interface Route { method: string; path: string; handler: (req: unknown) => Promise<unknown>; }

export interface ExtPlugin {
  name: string;
  version: string;
  hooks: string[];
  commands?: Command[];
  api?: Route[];
  init?(config: Record<string, unknown>): Promise<void>;
}

// ─── Built-in plugins ──────────────────────────────────────────────────────────

const BUILT_INS: ExtPlugin[] = [
  {
    name: 'vision', version: '0.1.0', hooks: ['after-chat'],
    commands: [{ name: 'generate', description: 'Generate image', run: async (a) => `Generating: ${a}` }],
  },
  {
    name: 'research', version: '0.1.0', hooks: ['periodic'],
    commands: [{ name: 'research', description: 'Research a topic', run: async (a) => `Researching: ${a}` }],
  },
  {
    name: 'analytics', version: '0.1.0', hooks: ['after-chat', 'periodic'],
    commands: [{ name: 'analytics', description: 'Show usage stats', run: async () => 'Analytics: no data yet' }],
  },
  {
    name: 'channels', version: '0.1.0', hooks: ['before-chat', 'after-chat'],
    commands: [{ name: 'channels', description: 'List channels', run: async () => 'Channels: none' }],
  },
  {
    name: 'a2a', version: '0.1.0', hooks: ['before-chat'],
    commands: [
      { name: 'a2a-connect', description: 'Connect to agent', run: async (a) => `Connecting to ${a}` },
      { name: 'a2a-peers', description: 'List peers', run: async () => 'No peers' },
    ],
  },
];

// ─── PluginLoader (file-based, existing) ────────────────────────────────────────

export class PluginLoader {
  plugins: Plugin[] = [];
  private log: (msg: string) => void;

  constructor(log?: (msg: string) => void) {
    this.log = log ?? ((m: string) => console.info(`[cocapn:plugins] ${m}`));
  }

  async load(dir: string): Promise<void> {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    for (const file of files) {
      try {
        const mod = await import(pathToFileURL(join(dir, file)).href);
        const plugin: Plugin = mod.default ?? mod;
        if (!plugin.name || !plugin.hooks) throw new Error('Invalid plugin shape');
        this.plugins.push(plugin);
        this.log(`loaded ${plugin.name}@${plugin.version}`);
      } catch (err) {
        this.log(`failed to load ${file}: ${String(err)}`);
      }
    }
  }

  async runBeforeChat(message: string, context: ChatContext): Promise<ChatContext> {
    let ctx = context;
    for (const p of this.plugins) {
      if (!p.hooks['before-chat']) continue;
      try { ctx = await p.hooks['before-chat'](message, ctx); } catch (e) { this.log(`${p.name}: ${String(e)}`); }
    }
    return ctx;
  }

  async runAfterChat(response: string, context: ChatContext): Promise<string> {
    let res = response;
    for (const p of this.plugins) {
      if (!p.hooks['after-chat']) continue;
      try { res = await p.hooks['after-chat'](res, context); } catch (e) { this.log(`${p.name}: ${String(e)}`); }
    }
    return res;
  }

  getCommands(): Record<string, (args: string) => Promise<string>> {
    const cmds: Record<string, (args: string) => Promise<string>> = {};
    for (const p of this.plugins) {
      if (!p.hooks.command) continue;
      for (const [name, fn] of Object.entries(p.hooks.command)) {
        const pluginName = p.name;
        cmds[name] = async (args) => {
          try { return await fn(args); }
          catch (e) { return `[${pluginName}] error: ${String(e)}`; }
        };
      }
    }
    return cmds;
  }

  list(): Array<{ name: string; version: string; commands: string[] }> {
    return this.plugins.map(p => ({
      name: p.name, version: p.version,
      commands: p.hooks.command ? Object.keys(p.hooks.command) : [],
    }));
  }
}

// ─── PluginRegistry (named plugins, install, built-ins) ────────────────────────

export class PluginRegistry {
  private registry = new Map<string, ExtPlugin>();
  private repoDir: string;
  private log: (msg: string) => void;

  constructor(repoDir: string, log?: (msg: string) => void) {
    this.repoDir = repoDir;
    this.log = log ?? ((m: string) => console.info(`[cocapn:registry] ${m}`));
    for (const p of BUILT_INS) this.registry.set(p.name, p);
    this.loadManifest();
  }

  /** Load a plugin by name (built-in or installed) */
  loadPlugin(name: string): ExtPlugin | undefined {
    return this.registry.get(name);
  }

  /** List all available plugins */
  listPlugins(): Array<{ name: string; version: string; hooks: string[]; commands: number }> {
    return [...this.registry.values()].map(p => ({
      name: p.name, version: p.version, hooks: p.hooks,
      commands: p.commands?.length ?? 0,
    }));
  }

  /** Install a plugin from npm or git URL */
  async installPlugin(name: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const pluginDir = join(this.repoDir, 'cocapn', 'plugins');
      mkdirSync(pluginDir, { recursive: true });
      const target = name.startsWith('http') || name.includes('/') ? name : `cocapn-plugin-${name}`;
      execSync(`npm install --prefix ${pluginDir} ${target}`, { stdio: 'pipe', timeout: 60000 });
      this.log(`installed ${name}`);
      this.saveManifest();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /** Initialize all registered plugins */
  async initAll(config: Record<string, unknown>): Promise<void> {
    for (const [, plugin] of this.registry) {
      if (plugin.init) {
        try { await plugin.init(config); } catch (e) { this.log(`${plugin.name} init: ${String(e)}`); }
      }
    }
  }

  /** Get commands from all registered plugins */
  getCommands(): Command[] {
    return [...this.registry.values()].flatMap(p => p.commands ?? []);
  }

  /** Get API routes from all registered plugins */
  getRoutes(): Route[] {
    return [...this.registry.values()].flatMap(p => p.api ?? []);
  }

  /** Save manifest of installed plugins */
  private saveManifest(): void {
    const manifest = [...this.registry.values()].map(p => ({ name: p.name, version: p.version }));
    const dir = join(this.repoDir, 'cocapn');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plugins.json'), JSON.stringify(manifest, null, 2));
  }

  /** Load manifest from disk */
  private loadManifest(): void {
    const p = join(this.repoDir, 'cocapn', 'plugins.json');
    if (!existsSync(p)) return;
    try {
      const entries = JSON.parse(readFileSync(p, 'utf-8')) as Array<{ name: string; version: string }>;
      for (const e of entries) {
        if (!this.registry.has(e.name)) {
          this.registry.set(e.name, { name: e.name, version: e.version, hooks: [] });
        }
      }
    } catch { /* skip corrupt manifest */ }
  }
}
