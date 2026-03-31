/**
 * Knowledge — flat-file knowledge base for cocapn.
 *
 * Stores entries with id, type, content, source, confidence, tags.
 * Search via keyword + tag + type matching.
 * Import from .md, .json, .txt files.
 *
 * Zero dependencies. Uses only Node.js built-ins.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  type: string;
  content: string;
  source: string;
  confidence: number;
  tags: string[];
  ts?: string;
}

// ─── Knowledge class ────────────────────────────────────────────────────────────

export class Knowledge {
  private path: string;
  private entries: KnowledgeEntry[] = [];

  constructor(repoDir: string) {
    const dir = join(repoDir, '.cocapn');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.path = join(dir, 'knowledge.json');
    this.entries = this.load();
  }

  save(entry: KnowledgeEntry): void {
    entry.ts = entry.ts ?? new Date().toISOString();
    const idx = this.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    else this.entries.push(entry);
    this.persist();
  }

  search(query: string, limit = 10): KnowledgeEntry[] {
    const q = query.toLowerCase();
    const words = q.split(/\W+/).filter(w => w.length > 3);
    const scored = this.entries.map(e => {
      let score = 0;
      const lower = e.content.toLowerCase();
      for (const w of words) { if (lower.includes(w)) score += 2; }
      for (const t of e.tags) {
        if (words.some(w => t.toLowerCase().includes(w))) score += 3;
        else if (t.toLowerCase() === q) score += 3;
      }
      if (words.some(w => e.type.toLowerCase().includes(w))) score += 1;
      return { entry: e, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.entry);
  }

  list(type?: string, limit = 50): KnowledgeEntry[] {
    let result = this.entries;
    if (type) result = result.filter(e => e.type === type);
    return result.slice(0, limit);
  }

  delete(id: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.id !== id);
    if (this.entries.length < before) { this.persist(); return true; }
    return false;
  }

  export(): KnowledgeEntry[] {
    return [...this.entries];
  }

  importFile(filePath: string): number {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const raw = readFileSync(filePath, 'utf-8');
    if (ext === 'json') return this.importJson(raw);
    if (ext === 'md') return this.importMarkdown(raw, filePath);
    if (ext === 'txt') return this.importText(raw, filePath);
    return 0;
  }

  clear(): void {
    this.entries = [];
    this.persist();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private importJson(raw: string): number {
    const data = JSON.parse(raw);
    const arr: KnowledgeEntry[] = Array.isArray(data) ? data : [data];
    let count = 0;
    for (const e of arr) {
      if (e.id && e.content) { this.save({ type: e.type ?? 'fact', source: e.source ?? 'import', confidence: e.confidence ?? 0.7, tags: e.tags ?? [], ...e }); count++; }
    }
    return count;
  }

  private importMarkdown(raw: string, filePath: string): number {
    let count = 0;
    const sections = raw.split(/^(#{1,3}\s+.+)$/m).filter(Boolean);
    let currentType = 'document';
    for (const section of sections) {
      const headerMatch = section.match(/^#{1,3}\s+(.+)/);
      if (headerMatch) { currentType = headerMatch[1].trim().toLowerCase().replace(/\W+/g, '-'); continue; }
      const paragraphs = section.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 10 && !p.startsWith('#'));
      for (const content of paragraphs) {
        this.save({ id: `md-${count}-${Date.now()}`, type: currentType, content, source: filePath, confidence: 0.6, tags: [currentType] });
        count++;
      }
    }
    return count;
  }

  private importText(raw: string, filePath: string): number {
    let count = 0;
    const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 10);
    for (const content of paragraphs) {
      this.save({ id: `txt-${count}-${Date.now()}`, type: 'text', content, source: filePath, confidence: 0.5, tags: [] });
      count++;
    }
    return count;
  }

  private load(): KnowledgeEntry[] {
    if (!existsSync(this.path)) return [];
    try { return JSON.parse(readFileSync(this.path, 'utf-8')) as KnowledgeEntry[]; }
    catch { return []; }
  }

  private persist(): void {
    writeFileSync(this.path, JSON.stringify(this.entries, null, 2), 'utf-8');
  }
}
