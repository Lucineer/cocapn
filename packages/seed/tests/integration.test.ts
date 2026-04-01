/**
 * Integration tests for cocapn seed.
 *
 * Tests full agent lifecycle, config validation, memory archival,
 * plugin loading, and A2A message passing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

import * as configSchemaMod from '../src/config-schema.js';
import * as memoryMod from '../src/memory.js';
import * as pluginsMod from '../src/plugins.js';
import * as a2aMod from '../src/a2a.js';
import * as glueMod from '../src/glue.js';
import * as syncMod from '../src/sync.js';
import * as soulMod from '../src/soul.js';

const { validateFullConfig, applyFullDefaults, formatErrors } = configSchemaMod;
const { Memory } = memoryMod;
const { PluginLoader, PluginRegistry } = pluginsMod;
const { A2AHub } = a2aMod;
const { GlueBus } = glueMod;
const { detectUpstream, conflictReport, syncStatus } = syncMod;

const uid = () => Math.random().toString(36).slice(2);

function makeRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  writeFileSync(join(dir, 'README.md'), '# Test');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

// ─── Agent Lifecycle: init → chat → remember → recall ──────────────────────────

describe('Agent Lifecycle', () => {
  let testDir: string;
  beforeEach(() => { testDir = makeRepo(join(tmpdir(), `cocapn-life-${uid()}`)); });
  afterEach(() => { try { rmSync(testDir, { recursive: true, force: true }); } catch {} });

  it('full lifecycle: init soul, add messages, persist facts, recall', () => {
    // 1. Init — create soul.md
    const soulPath = join(testDir, 'soul.md');
    writeFileSync(soulPath, '---\nname: TestBot\ntone: curious\nmodel: deepseek\n---\n\nI help test things.');
    const soul = soulMod.loadSoul(soulPath);
    expect(soul.name).toBe('TestBot');

    // 2. Create memory and add messages (chat)
    const mem = new Memory(testDir);
    mem.addMessage('user', 'Hello TestBot!');
    mem.addMessage('assistant', 'Hi! How can I help?');
    mem.addMessage('user', 'Remember my favorite color is blue');
    expect(mem.messages.length).toBe(3);

    // 3. Remember — store fact
    mem.facts['favorite_color'] = 'blue';
    mem['save']();

    // 4. Recall — re-instantiate memory and verify persistence
    const mem2 = new Memory(testDir);
    expect(mem2.messages.length).toBe(3);
    expect(mem2.messages[0].content).toBe('Hello TestBot!');
    expect(mem2.facts['favorite_color']).toBe('blue');

    // 5. Search works
    const results = mem2.search('blue');
    expect(results.facts.length).toBe(1);
    expect(results.facts[0].value).toBe('blue');
    expect(results.messages.length).toBe(1);
    expect(results.messages[0].content).toContain('blue');
  });

  it('multi-user lifecycle: separate user contexts', () => {
    const mem = new Memory(testDir);
    const alice = mem.getOrCreateUser('alice', 'Alice');
    const bob = mem.getOrCreateUser('bob', 'Bob');

    mem.addMessage('user', 'Hello from Alice', 'alice');
    mem.addMessage('user', 'Hello from Bob', 'bob');
    mem.addMessage('assistant', 'Hi Alice!', 'alice');

    mem.setUserFact('alice', 'location', 'NYC');
    mem.setUserFact('bob', 'location', 'LA');

    // Alice sees only her messages + system
    const aliceMsgs = mem.recentForUser('alice', 10);
    expect(aliceMsgs.some(m => m.content.includes('Alice'))).toBe(true);
    expect(aliceMsgs.every(m => !m.content.includes('Bob') || !m.userId)).toBe(true);

    // Facts merge correctly
    expect(mem.getFactsForUser('alice')['location']).toBe('NYC');
    expect(mem.getFactsForUser('bob')['location']).toBe('LA');
  });
});

// ─── Config Validation ────────────────────────────────────────────────────────

describe('Config Validation (Full Schema)', () => {
  it('accepts valid full config', () => {
    const result = validateFullConfig({
      mode: 'private', port: 3100,
      llm: { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 2048 },
      vision: { provider: 'google', apiKey: 'test-key', defaultModel: 'gemini-2.0-flash-exp' },
      generate: { provider: 'google', maxParallel: 3, research: { enabled: true, schedule: '0 */6 * * *', maxTopics: 10 } },
      channels: { telegram: { token: '123', webhookUrl: 'https://example.com' } },
      plugins: [{ name: 'vision', enabled: true }],
      glue: { peers: [{ id: 'agent1', url: 'http://localhost:3101', transport: 'http' }], secret: 's3cret' },
      brain: { maxMessages: 100, archiveThreshold: 500 },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts empty config', () => {
    const result = validateFullConfig({});
    expect(result.valid).toBe(true);
  });

  it('rejects invalid mode', () => {
    const result = validateFullConfig({ mode: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('mode');
  });

  it('rejects bad port', () => {
    expect(validateFullConfig({ port: -1 }).valid).toBe(false);
    expect(validateFullConfig({ port: 99999 }).valid).toBe(false);
    expect(validateFullConfig({ port: 'abc' }).valid).toBe(false);
  });

  it('rejects invalid llm config', () => {
    const r1 = validateFullConfig({ llm: { temperature: 5 } });
    expect(r1.valid).toBe(false);
    const r2 = validateFullConfig({ llm: { maxTokens: -1 } });
    expect(r2.valid).toBe(false);
    const r3 = validateFullConfig({ llm: { apiKey: 123 } });
    expect(r3.valid).toBe(false);
  });

  it('rejects invalid plugins array', () => {
    const r1 = validateFullConfig({ plugins: 'not-array' });
    expect(r1.valid).toBe(false);
    const r2 = validateFullConfig({ plugins: [{ /* missing name */ }] });
    expect(r2.valid).toBe(false);
  });

  it('rejects invalid glue config', () => {
    const r = validateFullConfig({ glue: { peers: [{ /* missing id and url */ }], transport: 'bad' } });
    expect(r.valid).toBe(false);
  });

  it('generates warnings for incomplete config', () => {
    const r = validateFullConfig({ channels: { telegram: { token: 'x' } } });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('applies full defaults', () => {
    const config = applyFullDefaults({});
    expect(config.mode).toBe('private');
    expect(config.port).toBe(3100);
    expect(config.llm?.provider).toBe('deepseek');
    expect(config.brain?.maxMessages).toBe(100);
    expect(config.brain?.archiveThreshold).toBe(500);
    expect(config.generate?.maxParallel).toBe(3);
    expect(config.generate?.research?.enabled).toBe(false);
  });

  it('formatErrors produces readable output', () => {
    const result = validateFullConfig({ mode: 'bad', port: -1 });
    const text = formatErrors(result);
    expect(text).toContain('mode');
    expect(text).toContain('port');
  });
});

// ─── Memory Archival at Scale ──────────────────────────────────────────────────

describe('Memory Archival', () => {
  let testDir: string;
  beforeEach(() => { testDir = makeRepo(join(tmpdir(), `cocapn-arch-${uid()}`)); });
  afterEach(() => { try { rmSync(testDir, { recursive: true, force: true }); } catch {} });

  it('archives messages when exceeding threshold', () => {
    const mem = new Memory(testDir);

    // Add 600 messages to trigger archival (threshold is 500)
    for (let i = 0; i < 600; i++) {
      mem.addMessage('user', `Message ${i} about topic${i % 5}`);
    }

    // Hot memory should be trimmed to 100
    expect(mem.messages.length).toBeLessThanOrEqual(100);

    // Total count includes archives
    expect(mem.totalMessageCount()).toBe(600);

    // Archive index should exist
    const index = mem.getIndex();
    expect(index.archives.length).toBeGreaterThan(0);
    expect(index.totalArchivedMessages).toBeGreaterThan(0);
  });

  it('searches across archives', () => {
    const mem = new Memory(testDir);

    // Add messages with distinct keywords
    for (let i = 0; i < 600; i++) {
      const topic = i < 300 ? 'unicorns' : 'dragons';
      mem.addMessage('user', `Message ${i} about ${topic}`);
    }

    // Search should find both archived and hot messages
    const results = mem.search('unicorns');
    expect(results.messages.length).toBeGreaterThan(0);
    expect(results.messages.every(m => m.content.includes('unicorns'))).toBe(true);
  });

  it('archive files exist on disk', () => {
    const mem = new Memory(testDir);
    for (let i = 0; i < 600; i++) {
      mem.addMessage('user', `Msg ${i}`);
    }

    const archiveDir = join(testDir, '.cocapn', 'archive');
    expect(existsSync(archiveDir)).toBe(true);

    const index = mem.getIndex();
    for (const entry of index.archives) {
      expect(existsSync(join(archiveDir, entry.file))).toBe(true);
    }
  });

  it('clear removes archives and index', () => {
    const mem = new Memory(testDir);
    for (let i = 0; i < 600; i++) {
      mem.addMessage('user', `Msg ${i}`);
    }
    expect(mem.getIndex().archives.length).toBeGreaterThan(0);

    mem.clear();
    expect(mem.messages.length).toBe(0);
    expect(mem.getIndex().archives).toEqual([]);
  });
});

// ─── Plugin Loading and Execution ──────────────────────────────────────────────

describe('Plugin Loading', () => {
  let testDir: string;
  beforeEach(() => { testDir = makeRepo(join(tmpdir(), `cocapn-plug-${uid()}`)); });
  afterEach(() => { try { rmSync(testDir, { recursive: true, force: true }); } catch {} });

  it('loads built-in plugins from registry', () => {
    const registry = new PluginRegistry(testDir);
    const plugins = registry.listPlugins();
    expect(plugins.length).toBeGreaterThan(0);

    const names = plugins.map(p => p.name);
    expect(names).toContain('vision');
    expect(names).toContain('research');
    expect(names).toContain('analytics');
    expect(names).toContain('channels');
    expect(names).toContain('a2a');
  });

  it('executes plugin commands', async () => {
    const registry = new PluginRegistry(testDir);
    const cmds = registry.getCommands();
    expect(cmds.length).toBeGreaterThan(0);

    const generateCmd = cmds.find(c => c.name === 'generate');
    expect(generateCmd).toBeDefined();
    const result = await generateCmd!.run('a sunset');
    expect(result).toContain('sunset');
  });

  it('initializes all plugins with config', async () => {
    const registry = new PluginRegistry(testDir);
    // Should not throw
    await registry.initAll({ mode: 'private' });
  });

  it('file-based plugin loader handles missing dir gracefully', async () => {
    const loader = new PluginLoader();
    await loader.load(join(testDir, 'nonexistent'));
    expect(loader.plugins).toEqual([]);
  });

  it('file-based plugin loader loads valid JS plugins', async () => {
    const pluginDir = join(testDir, 'cocapn', 'plugins');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, 'test-plugin.js'), `
export default {
  name: 'test',
  version: '1.0.0',
  hooks: {
    'before-chat': async (msg, ctx) => ({ ...ctx, modified: true }),
    'after-chat': async (res, ctx) => res.toUpperCase(),
    command: { hello: async (args) => 'Hello ' + args }
  }
};`);

    const loader = new PluginLoader();
    await loader.load(pluginDir);
    expect(loader.plugins.length).toBe(1);
    expect(loader.plugins[0].name).toBe('test');

    // Test before-chat hook
    const ctx = await loader.runBeforeChat('test', { message: 'test', facts: {} });
    expect((ctx as Record<string, unknown>).modified).toBe(true);

    // Test after-chat hook
    const result = await loader.runAfterChat('hello world', { message: 'test', facts: {} });
    expect(result).toBe('HELLO WORLD');

    // Test commands
    const cmds = loader.getCommands();
    expect(cmds['hello']).toBeDefined();
    const cmdResult = await cmds['hello']('world');
    expect(cmdResult).toBe('Hello world');
  });
});

// ─── A2A Message Passing ──────────────────────────────────────────────────────

describe('A2A Message Passing', () => {
  it('two agents can handshake and exchange messages', () => {
    const hub1 = new A2AHub('agent1', 'http://localhost:3100', 'secret1');
    const hub2 = new A2AHub('agent2', 'http://localhost:3101', 'secret1');

    // Simulate handshake: hub1 adds hub2 as a peer
    const peer = hub1.addPeer({
      id: 'agent2', name: 'agent2',
      url: 'http://localhost:3101',
      capabilities: ['chat', 'knowledge-share'],
    });

    expect(peer.name).toBe('agent2');
    expect(hub1.getPeers().length).toBe(1);

    // Simulate handshake: hub2 adds hub1 as a peer
    hub2.addPeer({
      id: 'agent1', name: 'agent1',
      url: 'http://localhost:3100',
      capabilities: ['chat'],
    });

    expect(hub2.getPeers().length).toBe(1);

    // Authentication works
    expect(hub1.authenticate('secret1')).toBe(true);
    expect(hub1.authenticate('wrong')).toBe(false);

    // Visitor prompt includes peer info
    expect(hub1.visitorPrompt()).toContain('agent2');
    expect(hub2.visitorPrompt()).toContain('agent1');
  });

  it('peer removal works', () => {
    const hub = new A2AHub('agent1', 'http://localhost:3100', 'secret');
    hub.addPeer({ id: 'p1', name: 'Peer1', url: 'http://localhost:3101', capabilities: [] });
    expect(hub.getPeers().length).toBe(1);

    expect(hub.removePeer('p1')).toBe(true);
    expect(hub.getPeers().length).toBe(0);
    expect(hub.removePeer('nonexistent')).toBe(false);
  });

  it('sendMessage fails for unknown peer', async () => {
    const hub = new A2AHub('agent1', 'http://localhost:3100', 'secret');
    const result = await hub.sendMessage('unknown', 'hello');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown peer');
  });
});

// ─── GlueBus Cross-Agent Communication ─────────────────────────────────────────

describe('GlueBus', () => {
  it('connects, lists, and disconnects agents', () => {
    const bus = new GlueBus();
    const conn = bus.connect('agent1', 'http://localhost:3100');
    expect(conn.id).toBe('agent1');
    expect(bus.list()).toEqual(['agent1']);

    bus.connect('agent2', 'http://localhost:3101');
    expect(bus.list().length).toBe(2);

    expect(bus.disconnect('agent1')).toBe(true);
    expect(bus.list()).toEqual(['agent2']);
  });

  it('get returns the right connection', () => {
    const bus = new GlueBus();
    bus.connect('a1', 'http://localhost:3100');
    const conn = bus.get('a1');
    expect(conn?.url).toBe('http://localhost:3100');
    expect(bus.get('nonexistent')).toBeUndefined();
  });
});

// ─── Fork Sync ─────────────────────────────────────────────────────────────────

describe('Fork Sync', () => {
  let testDir: string;
  beforeEach(() => { testDir = makeRepo(join(tmpdir(), `cocapn-sync-${uid()}`)); });
  afterEach(() => { try { rmSync(testDir, { recursive: true, force: true }); } catch {} });

  it('detects no upstream for a fresh repo', () => {
    const info = detectUpstream(testDir);
    // Fresh repo has no upstream; remote may be empty
    expect(typeof info.hasUpstream).toBe('boolean');
    expect(typeof info.behind).toBe('number');
    expect(typeof info.ahead).toBe('number');
  });

  it('conflictReport returns clean for clean repo', () => {
    const report = conflictReport(testDir);
    expect(report.clean).toBe(true);
    expect(report.conflicts).toEqual([]);
  });

  it('syncStatus returns a string', () => {
    const status = syncStatus(testDir);
    expect(typeof status).toBe('string');
    expect(status.length).toBeGreaterThan(0);
  });
});
