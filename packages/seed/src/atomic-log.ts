/**
 * Atomic Log — the universal data structure for cocapn.
 *
 * Every vessel shares one data structure: a diary entry, a code commit,
 * a dice roll, a sensor reading — all the same underlying LogEntry.
 *
 * Persistence: .cocapn/log/ as JSONL files (one per day).
 * Index: .cocapn/log/index.json for fast queries.
 * Archive: entries older than 30 days move to .cocapn/log/archive/.
 *
 * Zero dependencies. Uses only Node.js built-ins.
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  readdirSync, appendFileSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  vessel: string;
  timestamp: number;
  author: 'captain' | 'cocapn' | 'system' | 'a2a';
  type: 'message' | 'command' | 'event' | 'state' | 'metric' | 'decision' | 'handoff';
  channel: string;
  content: string;
  context?: LogEntry[];
  tags?: string[];
  trust?: number;
  ttl?: number;
}

export interface LogQuery {
  type?: LogEntry['type'];
  channel?: string;
  author?: LogEntry['author'];
  tags?: string[];
  from?: number;
  to?: number;
  text?: string;
  limit?: number;
}

export interface LogStats {
  totalEntries: number;
  entriesPerDay: Record<string, number>;
  channelDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  activeAuthors: Record<string, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export interface LogIndex {
  /** Map from date string (YYYY-MM-DD) to JSONL filename */
  dailyFiles: Record<string, string>;
  /** Total entry count */
  totalEntries: number;
  /** Channel → entry count */
  channelCounts: Record<string, number>;
  /** Type → entry count */
  typeCounts: Record<string, number>;
  /** Author → entry count */
  authorCounts: Record<string, number>;
  /** Date → entry count */
  dateCounts: Record<string, number>;
  /** Oldest timestamp in the active log */
  oldestTimestamp: number | null;
  /** Newest timestamp in the active log */
  newestTimestamp: number | null;
}

export interface HandoffPackage {
  vessel: string;
  createdAt: number;
  entryCount: number;
  entries: LogEntry[];
  summary: string;
}

export type ExportFormat = 'json' | 'jsonl' | 'markdown';

// ─── ULID Generator ────────────────────────────────────────────────────────────

const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_TIME_LEN = 10;
const ULID_RANDOM_LEN = 16;

let lastUlidTime = 0;
let lastUlidRandom: number[] = [];

function encodeUlidTime(ts: number): string {
  let time = ts;
  let out = '';
  for (let i = ULID_TIME_LEN; i > 0; i--) {
    const mod = time % 32;
    out = ULID_ENCODING[mod] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function generateUlidRandom(): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < ULID_RANDOM_LEN; i++) {
    bytes.push(Math.floor(Math.random() * 32));
  }
  return bytes;
}

function incrementRandom(random: number[]): number[] {
  const result = [...random];
  let carry = true;
  for (let i = result.length - 1; i >= 0 && carry; i--) {
    result[i]++;
    if (result[i] >= 32) {
      result[i] = 0;
    } else {
      carry = false;
    }
  }
  return result;
}

export function ulid(timestamp?: number): string {
  const ts = timestamp ?? Date.now();
  let random: number[];

  if (ts === lastUlidTime) {
    random = incrementRandom(lastUlidRandom);
  } else {
    random = generateUlidRandom();
  }

  lastUlidTime = ts;
  lastUlidRandom = random;

  return encodeUlidTime(ts) + random.map(b => ULID_ENCODING[b]).join('');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dailyFileName(ts: number): string {
  return `${dayKey(ts)}.jsonl`;
}

const ARCHIVE_DAYS = 30;

// ─── LogStore ──────────────────────────────────────────────────────────────────

export class LogStore {
  private logDir: string;
  private archiveDir: string;
  private indexPath: string;
  private index: LogIndex;
  private vessel: string;

  constructor(repoDir: string, vessel?: string) {
    this.vessel = vessel ?? repoDir.split('/').pop() ?? 'unknown';
    this.logDir = join(repoDir, '.cocapn', 'log');
    this.archiveDir = join(this.logDir, 'archive');
    this.indexPath = join(this.logDir, 'index.json');

    if (!existsSync(this.logDir)) mkdirSync(this.logDir, { recursive: true });
    if (!existsSync(this.archiveDir)) mkdirSync(this.archiveDir, { recursive: true });

    this.index = this.loadIndex();
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  /** Append an entry to the log. Returns the created entry. */
  append(partial: Omit<LogEntry, 'id' | 'timestamp' | 'vessel'> & { id?: string; timestamp?: number; vessel?: string }): LogEntry {
    const now = Date.now();
    const entry: LogEntry = {
      id: partial.id ?? ulid(now),
      vessel: partial.vessel ?? this.vessel,
      timestamp: partial.timestamp ?? now,
      author: partial.author,
      type: partial.type,
      channel: partial.channel,
      content: partial.content,
      ...(partial.context ? { context: partial.context } : {}),
      ...(partial.tags ? { tags: partial.tags } : {}),
      ...(partial.trust !== undefined ? { trust: partial.trust } : {}),
      ...(partial.ttl !== undefined ? { ttl: partial.ttl } : {}),
    };

    const day = dayKey(entry.timestamp);
    const fileName = dailyFileName(entry.timestamp);
    const filePath = join(this.logDir, fileName);

    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');

    this.index.dailyFiles[day] = fileName;
    this.index.totalEntries++;
    this.index.channelCounts[entry.channel] = (this.index.channelCounts[entry.channel] ?? 0) + 1;
    this.index.typeCounts[entry.type] = (this.index.typeCounts[entry.type] ?? 0) + 1;
    this.index.authorCounts[entry.author] = (this.index.authorCounts[entry.author] ?? 0) + 1;
    this.index.dateCounts[day] = (this.index.dateCounts[day] ?? 0) + 1;
    if (this.index.oldestTimestamp === null || entry.timestamp < this.index.oldestTimestamp) {
      this.index.oldestTimestamp = entry.timestamp;
    }
    this.index.newestTimestamp = entry.timestamp;
    this.saveIndex();

    return entry;
  }

  /** Query entries with filters. */
  query(q: LogQuery = {}): LogEntry[] {
    const candidates = this.entriesForRange(q.from, q.to);
    let results = candidates;

    if (q.type) results = results.filter(e => e.type === q.type);
    if (q.channel) results = results.filter(e => e.channel === q.channel);
    if (q.author) results = results.filter(e => e.author === q.author);
    if (q.tags && q.tags.length > 0) {
      results = results.filter(e => e.tags && q.tags!.some(t => e.tags!.includes(t)));
    }
    if (q.text) {
      const lower = q.text.toLowerCase();
      results = results.filter(e => e.content.toLowerCase().includes(lower));
    }

    results.sort((a, b) => a.timestamp - b.timestamp);

    if (q.limit && results.length > q.limit) {
      results = results.slice(-q.limit);
    }

    return results;
  }

  /** Full-text search across all entries. */
  search(text: string, limit?: number): LogEntry[] {
    return this.query({ text, limit });
  }

  /** Get a single entry by ID. */
  get(id: string): LogEntry | undefined {
    const entries = this.query({});
    return entries.find(e => e.id === id);
  }

  /** Move entries older than 30 days to archive. Returns count archived. */
  archive(): number {
    const cutoff = Date.now() - ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
    let archived = 0;

    for (const [day, fileName] of Object.entries(this.index.dailyFiles)) {
      const dayTs = new Date(day).getTime();
      if (dayTs >= cutoff) continue;

      const srcPath = join(this.logDir, fileName);
      if (!existsSync(srcPath)) continue;

      const destPath = join(this.archiveDir, fileName);
      const entries = this.readJsonl(srcPath);

      // Write to archive
      this.writeJsonl(destPath, entries);

      // Update index: remove archived day
      delete this.index.dailyFiles[day];
      const removed = entries.length;
      this.index.totalEntries -= removed;
      delete this.index.dateCounts[day];
      this.index.oldestTimestamp = this.recomputeOldest();

      unlinkSync(srcPath);
      archived += removed;
    }

    if (archived > 0) this.saveIndex();
    return archived;
  }

  /** Export entries to JSON, JSONL, or markdown. */
  export(format: ExportFormat, query?: LogQuery): string {
    const entries = this.query(query ?? {});

    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);
      case 'jsonl':
        return entries.map(e => JSON.stringify(e)).join('\n');
      case 'markdown': {
        const lines = ['# Atomic Log Export', '', `Vessel: ${this.vessel}`, `Exported: ${new Date().toISOString()}`, `Entries: ${entries.length}`, ''];
        for (const e of entries) {
          const ts = new Date(e.timestamp).toISOString();
          lines.push(`## [${e.type}] ${ts}`);
          lines.push(`- **Author**: ${e.author}`);
          lines.push(`- **Channel**: ${e.channel}`);
          if (e.tags && e.tags.length > 0) lines.push(`- **Tags**: ${e.tags.join(', ')}`);
          if (e.trust !== undefined) lines.push(`- **Trust**: ${e.trust}`);
          lines.push('', e.content, '');
        }
        return lines.join('\n');
      }
    }
  }

  /** Compact: merge entries from old days into daily summaries. */
  compact(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let compacted = 0;

    for (const [day, fileName] of Object.entries(this.index.dailyFiles)) {
      const dayTs = new Date(day).getTime();
      if (dayTs >= cutoff) continue;

      const filePath = join(this.logDir, fileName);
      if (!existsSync(filePath)) continue;

      const entries = this.readJsonl(filePath);
      if (entries.length <= 1) continue;

      const summary = this.summarizeEntries(entries);
      writeFileSync(filePath, JSON.stringify(summary) + '\n', 'utf-8');

      const diff = entries.length - 1;
      this.index.totalEntries -= diff;
      this.index.dateCounts[day] = 1;
      compacted += diff;
    }

    if (compacted > 0) this.saveIndex();
    return compacted;
  }

  /** Compute stats over active (non-archived) entries. */
  stats(): LogStats {
    const entries = this.query({});
    const stats: LogStats = {
      totalEntries: entries.length,
      entriesPerDay: {},
      channelDistribution: {},
      typeDistribution: {},
      activeAuthors: {},
      oldestEntry: null,
      newestEntry: null,
    };

    for (const e of entries) {
      const day = dayKey(e.timestamp);
      stats.entriesPerDay[day] = (stats.entriesPerDay[day] ?? 0) + 1;
      stats.channelDistribution[e.channel] = (stats.channelDistribution[e.channel] ?? 0) + 1;
      stats.typeDistribution[e.type] = (stats.typeDistribution[e.type] ?? 0) + 1;
      stats.activeAuthors[e.author] = (stats.activeAuthors[e.author] ?? 0) + 1;
      if (stats.oldestEntry === null || e.timestamp < stats.oldestEntry) stats.oldestEntry = e.timestamp;
      if (stats.newestEntry === null || e.timestamp > stats.newestEntry) stats.newestEntry = e.timestamp;
    }

    return stats;
  }

  /** Create a handoff package from log entries for A2A transfer. */
  handoff(query?: LogQuery): HandoffPackage {
    const entries = this.query(query ?? {});
    const channels = [...new Set(entries.map(e => e.channel))];
    const types = [...new Set(entries.map(e => e.type))];
    const summary = [
      `Handoff from ${this.vessel}: ${entries.length} entries across ${channels.length} channels (${channels.join(', ')}).`,
      `Types: ${types.join(', ')}.`,
      `Spanning ${entries.length > 0 ? new Date(entries[0].timestamp).toISOString() : 'empty'} to ${entries.length > 0 ? new Date(entries[entries.length - 1].timestamp).toISOString() : 'empty'}.`,
    ].join(' ');

    return {
      vessel: this.vessel,
      createdAt: Date.now(),
      entryCount: entries.length,
      entries,
      summary,
    };
  }

  /** Get the current index (for inspection/testing). */
  getIndex(): LogIndex {
    return { ...this.index };
  }

  /** Purge all entries and reset. For testing. */
  clear(): void {
    const files = readdirSync(this.logDir).filter(f => f.endsWith('.jsonl'));
    for (const f of files) {
      try { unlinkSync(join(this.logDir, f)); } catch { /* skip */ }
    }
    const archiveFiles = existsSync(this.archiveDir)
      ? readdirSync(this.archiveDir).filter(f => f.endsWith('.jsonl'))
      : [];
    for (const f of archiveFiles) {
      try { unlinkSync(join(this.archiveDir, f)); } catch { /* skip */ }
    }
    this.index = this.emptyIndex();
    this.saveIndex();
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private emptyIndex(): LogIndex {
    return {
      dailyFiles: {},
      totalEntries: 0,
      channelCounts: {},
      typeCounts: {},
      authorCounts: {},
      dateCounts: {},
      oldestTimestamp: null,
      newestTimestamp: null,
    };
  }

  private loadIndex(): LogIndex {
    if (!existsSync(this.indexPath)) return this.emptyIndex();
    try {
      return JSON.parse(readFileSync(this.indexPath, 'utf-8')) as LogIndex;
    } catch {
      return this.emptyIndex();
    }
  }

  private saveIndex(): void {
    writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  /** Read all JSONL entries from files in a date range. */
  private entriesForRange(from?: number, to?: number): LogEntry[] {
    const entries: LogEntry[] = [];
    const days = Object.keys(this.index.dailyFiles);

    for (const day of days) {
      const dayTs = new Date(day + 'T00:00:00Z').getTime();
      if (from && dayTs + 86400000 < from) continue;
      if (to && dayTs > to) continue;

      const fileName = this.index.dailyFiles[day];
      const filePath = join(this.logDir, fileName);
      if (!existsSync(filePath)) continue;

      let dayEntries = this.readJsonl(filePath);

      // Filter by timestamp within the day
      if (from || to) {
        dayEntries = dayEntries.filter(e => {
          if (from && e.timestamp < from) return false;
          if (to && e.timestamp > to) return false;
          return true;
        });
      }

      entries.push(...dayEntries);
    }

    return entries;
  }

  /** Read entries from a JSONL file. */
  private readJsonl(filePath: string): LogEntry[] {
    try {
      const raw = readFileSync(filePath, 'utf-8').trim();
      if (!raw) return [];
      return raw.split('\n').filter(Boolean).map(line => JSON.parse(line) as LogEntry);
    } catch {
      return [];
    }
  }

  /** Write entries to a JSONL file. */
  private writeJsonl(filePath: string, entries: LogEntry[]): void {
    writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
  }

  /** Summarize multiple entries into a single compact entry. */
  private summarizeEntries(entries: LogEntry[]): LogEntry {
    const first = entries[0];
    const last = entries[entries.length - 1];
    const channels = [...new Set(entries.map(e => e.channel))];
    const types = [...new Set(entries.map(e => e.type))];
    const authors = [...new Set(entries.map(e => e.author))];
    const allTags = [...new Set(entries.flatMap(e => e.tags ?? []))];

    return {
      id: ulid(first.timestamp),
      vessel: first.vessel,
      timestamp: first.timestamp,
      author: 'system',
      type: 'state',
      channel: channels.join(','),
      content: `[Compacted ${entries.length} entries] Channels: ${channels.join(', ')}. Types: ${types.join(', ')}. Authors: ${authors.join(', ')}. Span: ${new Date(first.timestamp).toISOString()} – ${new Date(last.timestamp).toISOString()}`,
      tags: allTags.length > 0 ? allTags : undefined,
    };
  }

  /** Recompute oldest timestamp from remaining daily files. */
  private recomputeOldest(): number | null {
    let oldest: number | null = null;
    for (const day of Object.keys(this.index.dailyFiles)) {
      const dayTs = new Date(day + 'T00:00:00Z').getTime();
      if (oldest === null || dayTs < oldest) oldest = dayTs;
    }
    return oldest;
  }
}
