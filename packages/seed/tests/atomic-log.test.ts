import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LogStore, ulid } from '../src/atomic-log.js';
import type { LogEntry } from '../src/atomic-log.js';

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'cocapn-log-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// ── ULID ──────────────────────────────────────────────────────────────────────

describe('ulid', () => {
  it('generates a 26-character string', () => {
    const id = ulid();
    expect(id).toHaveLength(26);
  });

  it('is monotonically increasing', () => {
    const ids = [ulid(1000), ulid(1001), ulid(1002)];
    expect(ids[0] < ids[1]).toBe(true);
    expect(ids[1] < ids[2]).toBe(true);
  });

  it('handles same-millisecond by incrementing', () => {
    const a = ulid(5000);
    const b = ulid(5000);
    expect(a < b).toBe(true);
  });
});

// ── LogStore: append ──────────────────────────────────────────────────────────

describe('LogStore.append', () => {
  it('appends an entry and returns it with generated id', () => {
    const store = new LogStore(testDir, 'test-vessel');
    const entry = store.append({
      author: 'captain',
      type: 'message',
      channel: 'chat',
      content: 'Hello, world',
    });
    expect(entry.id).toBeDefined();
    expect(entry.vessel).toBe('test-vessel');
    expect(entry.timestamp).toBeTypeOf('number');
    expect(entry.content).toBe('Hello, world');
  });

  it('accepts optional fields', () => {
    const store = new LogStore(testDir);
    const entry = store.append({
      author: 'a2a',
      type: 'handoff',
      channel: 'fleet',
      content: 'handoff data',
      tags: ['important', 'fleet'],
      trust: 0.8,
      ttl: 3600000,
    });
    expect(entry.tags).toEqual(['important', 'fleet']);
    expect(entry.trust).toBe(0.8);
    expect(entry.ttl).toBe(3600000);
  });

  it('persists to a daily JSONL file', () => {
    const store = new LogStore(testDir, 'vessel');
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'first' });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'second' });

    const today = new Date().toISOString().slice(0, 10);
    const filePath = join(testDir, '.cocapn', 'log', `${today}.jsonl`);
    expect(existsSync(filePath)).toBe(true);

    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]) as LogEntry;
    expect(first.content).toBe('first');
  });

  it('updates the index', () => {
    const store = new LogStore(testDir, 'vessel');
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'hi' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'started' });

    const idx = store.getIndex();
    expect(idx.totalEntries).toBe(2);
    expect(idx.channelCounts.chat).toBe(1);
    expect(idx.channelCounts.system).toBe(1);
    expect(idx.typeCounts.message).toBe(1);
    expect(idx.typeCounts.event).toBe(1);
    expect(idx.authorCounts.captain).toBe(1);
    expect(idx.authorCounts.system).toBe(1);
    expect(idx.oldestTimestamp).not.toBeNull();
    expect(idx.newestTimestamp).not.toBeNull();
  });
});

// ── LogStore: query ───────────────────────────────────────────────────────────

describe('LogStore.query', () => {
  it('returns all entries with empty query', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'a' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'b' });
    expect(store.query()).toHaveLength(2);
  });

  it('filters by type', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'msg' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'evt' });
    expect(store.query({ type: 'message' })).toHaveLength(1);
  });

  it('filters by channel', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'hi' });
    store.append({ author: 'captain', type: 'message', channel: 'git', content: 'commit' });
    expect(store.query({ channel: 'chat' })).toHaveLength(1);
  });

  it('filters by author', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'a' });
    store.append({ author: 'cocapn', type: 'message', channel: 'chat', content: 'b' });
    expect(store.query({ author: 'captain' })).toHaveLength(1);
  });

  it('filters by tags', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'a', tags: ['important'] });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'b', tags: ['trivial'] });
    expect(store.query({ tags: ['important'] })).toHaveLength(1);
  });

  it('filters by date range', () => {
    const store = new LogStore(testDir);
    const old = Date.now() - 3 * 86400000;
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'old', timestamp: old });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'new' });
    const results = store.query({ from: Date.now() - 86400000 });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('new');
  });

  it('limits results', () => {
    const store = new LogStore(testDir);
    for (let i = 0; i < 10; i++) {
      store.append({ author: 'captain', type: 'message', channel: 'chat', content: `msg-${i}` });
    }
    expect(store.query({ limit: 3 })).toHaveLength(3);
  });
});

// ── LogStore: search ──────────────────────────────────────────────────────────

describe('LogStore.search', () => {
  it('finds entries by full-text search', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'The weather is sunny today' });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'Deploy succeeded' });
    expect(store.search('weather')).toHaveLength(1);
    expect(store.search('weather')[0].content).toContain('sunny');
  });

  it('is case-insensitive', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'UPPERCASE test' });
    expect(store.search('uppercase')).toHaveLength(1);
  });
});

// ── LogStore: get ─────────────────────────────────────────────────────────────

describe('LogStore.get', () => {
  it('retrieves an entry by id', () => {
    const store = new LogStore(testDir);
    const entry = store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'find me' });
    const found = store.get(entry.id);
    expect(found).toBeDefined();
    expect(found!.content).toBe('find me');
  });

  it('returns undefined for unknown id', () => {
    const store = new LogStore(testDir);
    expect(store.get('nonexistent')).toBeUndefined();
  });
});

// ── LogStore: export ──────────────────────────────────────────────────────────

describe('LogStore.export', () => {
  it('exports to JSON', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'hello' });
    const json = store.export('json');
    const parsed = JSON.parse(json) as LogEntry[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe('hello');
  });

  it('exports to JSONL', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'line1' });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'line2' });
    const jsonl = store.export('jsonl');
    const lines = jsonl.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).content).toBe('line1');
  });

  it('exports to markdown', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'hello', tags: ['greeting'] });
    const md = store.export('markdown');
    expect(md).toContain('# Atomic Log Export');
    expect(md).toContain('**Author**: captain');
    expect(md).toContain('**Tags**: greeting');
    expect(md).toContain('hello');
  });

  it('exports with query filter', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'visible' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'hidden' });
    const json = store.export('json', { author: 'captain' });
    const parsed = JSON.parse(json) as LogEntry[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].author).toBe('captain');
  });
});

// ── LogStore: stats ───────────────────────────────────────────────────────────

describe('LogStore.stats', () => {
  it('computes correct stats', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'a' });
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'b' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'c' });

    const s = store.stats();
    expect(s.totalEntries).toBe(3);
    expect(s.channelDistribution.chat).toBe(2);
    expect(s.channelDistribution.system).toBe(1);
    expect(s.typeDistribution.message).toBe(2);
    expect(s.activeAuthors.captain).toBe(2);
    expect(s.oldestEntry).not.toBeNull();
    expect(s.newestEntry).not.toBeNull();
  });

  it('returns empty stats for empty log', () => {
    const store = new LogStore(testDir);
    const s = store.stats();
    expect(s.totalEntries).toBe(0);
    expect(s.oldestEntry).toBeNull();
  });
});

// ── LogStore: archive ─────────────────────────────────────────────────────────

describe('LogStore.archive', () => {
  it('moves old entries to archive', () => {
    const store = new LogStore(testDir, 'vessel');
    const oldTs = Date.now() - 31 * 86400000;
    // Inject entry into index with old date
    const oldDay = new Date(oldTs).toISOString().slice(0, 10);
    const fileName = `${oldDay}.jsonl`;
    const filePath = join(testDir, '.cocapn', 'log', fileName);

    const oldEntry = { id: ulid(oldTs), vessel: 'vessel', timestamp: oldTs, author: 'captain' as const, type: 'message' as const, channel: 'chat', content: 'old entry' };
    writeFileSync(filePath, JSON.stringify(oldEntry) + '\n', 'utf-8');

    // Update index manually
    const idx = store.getIndex();
    idx.dailyFiles[oldDay] = fileName;
    idx.totalEntries = 1;
    // Write the index manually since we bypassed append
    writeFileSync(join(testDir, '.cocapn', 'log', 'index.json'), JSON.stringify({ ...idx, channelCounts: { chat: 1 }, typeCounts: { message: 1 }, authorCounts: { captain: 1 }, dateCounts: { [oldDay]: 1 }, oldestTimestamp: oldTs, newestTimestamp: oldTs }, null, 2), 'utf-8');

    // Re-create store to pick up modified index
    const store2 = new LogStore(testDir, 'vessel');
    const count = store2.archive();
    expect(count).toBe(1);

    // Old file should be gone from log dir
    expect(!existsSync(filePath)).toBe(true);
    // Should exist in archive
    const archivePath = join(testDir, '.cocapn', 'log', 'archive', fileName);
    expect(existsSync(archivePath)).toBe(true);
  });
});

// ── LogStore: compact ─────────────────────────────────────────────────────────

describe('LogStore.compact', () => {
  it('compacts old entries into summaries', () => {
    const store = new LogStore(testDir, 'vessel');
    const oldTs = Date.now() - 31 * 86400000;
    const oldDay = new Date(oldTs).toISOString().slice(0, 10);
    const fileName = `${oldDay}.jsonl`;
    const filePath = join(testDir, '.cocapn', 'log', fileName);

    // Write 5 entries for old day
    const entries = [];
    for (let i = 0; i < 5; i++) {
      entries.push(JSON.stringify({ id: ulid(oldTs + i), vessel: 'vessel', timestamp: oldTs + i, author: 'captain', type: 'message', channel: 'chat', content: `msg-${i}` }));
    }
    writeFileSync(filePath, entries.join('\n') + '\n', 'utf-8');

    // Update index
    writeFileSync(join(testDir, '.cocapn', 'log', 'index.json'), JSON.stringify({
      dailyFiles: { [oldDay]: fileName },
      totalEntries: 5,
      channelCounts: { chat: 5 },
      typeCounts: { message: 5 },
      authorCounts: { captain: 5 },
      dateCounts: { [oldDay]: 5 },
      oldestTimestamp: oldTs,
      newestTimestamp: oldTs + 4,
    }, null, 2), 'utf-8');

    const store2 = new LogStore(testDir, 'vessel');
    const compacted = store2.compact();
    expect(compacted).toBe(4); // 5 entries → 1 summary

    const remaining = store2.query({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe('state');
    expect(remaining[0].content).toContain('Compacted 5 entries');
  });
});

// ── LogStore: handoff ─────────────────────────────────────────────────────────

describe('LogStore.handoff', () => {
  it('creates a handoff package', () => {
    const store = new LogStore(testDir, 'my-vessel');
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'hello' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'deployed' });

    const pkg = store.handoff();
    expect(pkg.vessel).toBe('my-vessel');
    expect(pkg.entryCount).toBe(2);
    expect(pkg.entries).toHaveLength(2);
    expect(pkg.summary).toContain('my-vessel');
    expect(pkg.summary).toContain('2 entries');
    expect(pkg.createdAt).toBeTypeOf('number');
  });

  it('handoff respects query filters', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'visible' });
    store.append({ author: 'system', type: 'event', channel: 'system', content: 'hidden' });

    const pkg = store.handoff({ channel: 'chat' });
    expect(pkg.entryCount).toBe(1);
    expect(pkg.entries[0].content).toBe('visible');
  });
});

// ── LogStore: clear ───────────────────────────────────────────────────────────

describe('LogStore.clear', () => {
  it('removes all entries and resets index', () => {
    const store = new LogStore(testDir);
    store.append({ author: 'captain', type: 'message', channel: 'chat', content: 'gone' });
    expect(store.query()).toHaveLength(1);

    store.clear();
    expect(store.query()).toHaveLength(0);
    const idx = store.getIndex();
    expect(idx.totalEntries).toBe(0);
  });
});

// ── LogStore: persistence ─────────────────────────────────────────────────────

describe('LogStore persistence', () => {
  it('survives recreation', () => {
    const store = new LogStore(testDir, 'persist-test');
    store.append({ author: 'captain', type: 'decision', channel: 'planning', content: 'decided to use JSONL' });

    const store2 = new LogStore(testDir, 'persist-test');
    const results = store2.query({ type: 'decision' });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('decided to use JSONL');
  });
});

// ── LogStore: TTL expiry ──────────────────────────────────────────────────────

describe('LogStore TTL', () => {
  it('stores TTL without affecting queries', () => {
    const store = new LogStore(testDir);
    const entry = store.append({ author: 'system', type: 'metric', channel: 'sensor', content: '{"temp": 22.5}', ttl: 60000 });
    expect(entry.ttl).toBe(60000);
    const found = store.get(entry.id);
    expect(found!.ttl).toBe(60000);
  });
});
