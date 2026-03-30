/**
 * KnowledgePipeline — in-memory knowledge store with CRUD, query, and export.
 *
 * Each entry is typed (species, regulation, technique, location, equipment)
 * and carries metadata including confidence and tags. Designed to be extended
 * by GitKnowledgePipeline for versioned persistence.
 */

import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnowledgeType = 'species' | 'regulation' | 'technique' | 'location' | 'equipment';

export interface KnowledgeMeta {
  type: KnowledgeType;
  source: string;
  confidence: number;
  tags: string[];
}

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  content: string;
  embedding?: number[];
  metadata: KnowledgeMeta;
  createdAt: string;
  validated: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface KnowledgeStats {
  entries: number;
  byType: Record<string, number>;
  lastUpdated: number;
}

// ─── KnowledgePipeline ───────────────────────────────────────────────────────

export class KnowledgePipeline {
  protected entries: Map<string, KnowledgeEntry> = new Map();

  /**
   * Ingest a new knowledge entry from raw content and metadata.
   * Returns the created entry with a generated ID and timestamp.
   */
  async ingest(_file: Buffer, metadata: KnowledgeMeta): Promise<KnowledgeEntry> {
    const content = _file.toString("utf-8");
    const id = randomUUID();
    const entry: KnowledgeEntry = {
      id,
      type: metadata.type,
      content,
      metadata,
      createdAt: new Date().toISOString(),
      validated: false,
    };
    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Query entries by text match against content and tags.
   * Searches case-insensitively. Returns up to `limit` results.
   */
  async query(text: string, limit = 10): Promise<KnowledgeEntry[]> {
    const lower = text.toLowerCase();
    const results: KnowledgeEntry[] = [];

    for (const entry of this.entries.values()) {
      const contentMatch = entry.content.toLowerCase().includes(lower);
      const tagMatch = entry.metadata.tags.some(t => t.toLowerCase().includes(lower));
      const sourceMatch = entry.metadata.source.toLowerCase().includes(lower);
      if (contentMatch || tagMatch || sourceMatch) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Validate a knowledge entry against type-specific rules.
   */
  validate(entry: KnowledgeEntry): ValidationResult {
    const errors: string[] = [];

    if (!entry.type) {
      errors.push("missing required field: type");
    }
    if (!entry.content || entry.content.trim().length === 0) {
      errors.push("missing required field: content");
    }
    if (entry.metadata.confidence < 0.1) {
      errors.push("confidence must be >= 0.1");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export all entries in the specified format.
   */
  async export(format: 'jsonl' | 'json' | 'csv'): Promise<Buffer> {
    const all = Array.from(this.entries.values());

    switch (format) {
      case 'jsonl': {
        const lines = all.map(e => JSON.stringify(e));
        return Buffer.from(lines.join("\n") + "\n", "utf-8");
      }
      case 'json': {
        return Buffer.from(JSON.stringify(all, null, 2), "utf-8");
      }
      case 'csv': {
        const header = "id,type,content,source,confidence,tags,createdAt,validated";
        const rows = all.map(e => {
          const tags = e.metadata.tags.map(t => `"${t}"`).join(";");
          const content = `"${e.content.replace(/"/g, '""')}"`;
          const source = `"${e.metadata.source.replace(/"/g, '""')}"`;
          return `${e.id},${e.type},${content},${source},${e.metadata.confidence},${tags},${e.createdAt},${e.validated}`;
        });
        return Buffer.from([header, ...rows].join("\n") + "\n", "utf-8");
      }
    }
  }

  /**
   * Return aggregate statistics about the knowledge store.
   */
  stats(): KnowledgeStats {
    const byType: Record<string, number> = {};
    let lastUpdated = 0;

    for (const entry of this.entries.values()) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      const ts = new Date(entry.createdAt).getTime();
      if (ts > lastUpdated) lastUpdated = ts;
    }

    return {
      entries: this.entries.size,
      byType,
      lastUpdated,
    };
  }

  // ─── Internal helpers (exposed for subclasses) ────────────────────────────

  /** Get a single entry by ID. */
  getEntry(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  /** Get all entries. */
  getAllEntries(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  /** Store an entry (used by GitKnowledgePipeline when loading from disk). */
  setEntry(entry: KnowledgeEntry): void {
    this.entries.set(entry.id, entry);
  }

  /** Delete an entry by ID. Returns true if it existed. */
  deleteEntry(id: string): boolean {
    return this.entries.delete(id);
  }
}
