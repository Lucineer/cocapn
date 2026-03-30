/**
 * Tests for cocapn memory command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  resolveMemoryPaths,
  loadAllEntries,
  loadEntriesByType,
  type MemoryEntry,
} from "../src/commands/memory.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const testDir = join(process.cwd(), ".test-memory-tmp");

function setupRepo(): void {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
  const memoryDir = join(testDir, "cocapn", "memory");
  const wikiDir = join(testDir, "cocapn", "wiki");
  mkdirSync(memoryDir, { recursive: true });
  mkdirSync(wikiDir, { recursive: true });

  writeFileSync(join(memoryDir, "facts.json"), JSON.stringify({
    "user.name": "Alice",
    "user.email": "alice@example.com",
    "private.phone": "555-1234",
    "knowledge.species.1": "salmon",
    "knowledge.species.2": "halibut",
  }));

  writeFileSync(join(memoryDir, "memories.json"), JSON.stringify([
    { id: "m1", content: "Alice prefers morning fishing trips", createdAt: "2026-03-30T10:00:00Z", confidence: 0.9 },
    { id: "m2", content: "Best bait for salmon is herring", createdAt: "2026-03-29T10:00:00Z", confidence: 0.8 },
  ]));

  writeFileSync(join(wikiDir, "guide.md"), "# Fishing Guide\n\nThis is a guide about fishing.");
  writeFileSync(join(wikiDir, "species.md"), "# Species\n\nCommon species in the area.");
}

function cleanupRepo(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

// ─── resolveMemoryPaths ─────────────────────────────────────────────────────

describe("resolveMemoryPaths", () => {
  beforeEach(() => setupRepo());
  afterEach(() => cleanupRepo());

  it("resolves paths from cocapn/memory and cocapn/wiki", () => {
    const result = resolveMemoryPaths(testDir);
    expect(result).not.toBeNull();
    expect(result!.memoryDir).toContain("cocapn/memory");
    expect(result!.wikiDir).toContain("cocapn/wiki");
  });

  it("returns null when no cocapn or memory directory exists", () => {
    cleanupRepo();
    const result = resolveMemoryPaths(testDir);
    expect(result).toBeNull();
  });
});

// ─── loadAllEntries ─────────────────────────────────────────────────────────

describe("loadAllEntries", () => {
  beforeEach(() => setupRepo());
  afterEach(() => cleanupRepo());

  it("loads facts, memories, and wiki entries", () => {
    const entries = loadAllEntries(testDir);
    expect(entries.length).toBe(9); // 5 facts + 2 memories + 2 wiki
  });

  it("categorizes facts and knowledge correctly", () => {
    const entries = loadAllEntries(testDir);
    const facts = entries.filter((e) => e.type === "fact");
    const knowledge = entries.filter((e) => e.type === "knowledge");
    expect(facts.length).toBe(3);
    expect(knowledge.length).toBe(2);
  });

  it("categorizes memories correctly", () => {
    const entries = loadAllEntries(testDir);
    const memories = entries.filter((e) => e.type === "memory");
    expect(memories.length).toBe(2);
    expect(memories[0].key).toBe("m1");
  });

  it("categorizes wiki pages correctly", () => {
    const entries = loadAllEntries(testDir);
    const wiki = entries.filter((e) => e.type === "wiki");
    expect(wiki.length).toBe(2);
    expect(wiki.some((e) => e.key === "guide")).toBe(true);
    expect(wiki.some((e) => e.key === "species")).toBe(true);
  });

  it("returns empty array when no memory directory", () => {
    cleanupRepo();
    const entries = loadAllEntries(testDir);
    expect(entries).toEqual([]);
  });
});

// ─── loadEntriesByType ──────────────────────────────────────────────────────

describe("loadEntriesByType", () => {
  beforeEach(() => setupRepo());
  afterEach(() => cleanupRepo());

  it("filters facts only", () => {
    const entries = loadEntriesByType(testDir, "facts");
    expect(entries.length).toBe(3);
    expect(entries.every((e) => e.type === "fact")).toBe(true);
  });

  it("filters knowledge only", () => {
    const entries = loadEntriesByType(testDir, "knowledge");
    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.type === "knowledge")).toBe(true);
  });

  it("filters memories only", () => {
    const entries = loadEntriesByType(testDir, "memories");
    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.type === "memory")).toBe(true);
  });

  it("filters wiki only", () => {
    const entries = loadEntriesByType(testDir, "wiki");
    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.type === "wiki")).toBe(true);
  });

  it("returns empty for unknown type", () => {
    const entries = loadEntriesByType(testDir, "unknown");
    expect(entries).toEqual([]);
  });

  it("returns empty when no memory dir", () => {
    cleanupRepo();
    const entries = loadEntriesByType(testDir, "facts");
    expect(entries).toEqual([]);
  });
});

// ─── Entry content ──────────────────────────────────────────────────────────

describe("entry content", () => {
  beforeEach(() => setupRepo());
  afterEach(() => cleanupRepo());

  it("fact values are strings", () => {
    const entries = loadEntriesByType(testDir, "facts");
    const name = entries.find((e) => e.key === "user.name");
    expect(name).toBeDefined();
    expect(name!.value).toBe("Alice");
  });

  it("knowledge fact values are strings", () => {
    const entries = loadEntriesByType(testDir, "knowledge");
    expect(entries[0].value).toBe("salmon");
  });

  it("memory entries include content", () => {
    const entries = loadEntriesByType(testDir, "memories");
    expect(entries[0].value).toContain("morning fishing");
  });

  it("wiki entries include full content", () => {
    const entries = loadEntriesByType(testDir, "wiki");
    const guide = entries.find((e) => e.key === "guide");
    expect(guide).toBeDefined();
    expect(guide!.value).toContain("Fishing Guide");
  });
});

// ─── JSON output shape ──────────────────────────────────────────────────────

describe("JSON output shape", () => {
  beforeEach(() => setupRepo());
  afterEach(() => cleanupRepo());

  it("entries have correct shape for serialization", () => {
    const entries = loadAllEntries(testDir);
    const json = JSON.stringify(entries);
    const parsed = JSON.parse(json) as MemoryEntry[];

    expect(parsed.length).toBe(9);
    for (const entry of parsed) {
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("key");
      expect(entry).toHaveProperty("value");
      expect(["fact", "memory", "wiki", "knowledge"]).toContain(entry.type);
    }
  });
});

// ─── Malformed files ────────────────────────────────────────────────────────

describe("malformed files", () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    const memoryDir = join(testDir, "cocapn", "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "facts.json"), "not json");
    writeFileSync(join(memoryDir, "memories.json"), "broken");
  });

  afterEach(() => cleanupRepo());

  it("returns empty entries for malformed JSON files", () => {
    const entries = loadAllEntries(testDir);
    expect(entries).toEqual([]);
  });
});

// ─── Empty memory files ─────────────────────────────────────────────────────

describe("empty memory files", () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    const memoryDir = join(testDir, "cocapn", "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "facts.json"), "{}");
    writeFileSync(join(memoryDir, "memories.json"), "[]");
  });

  afterEach(() => cleanupRepo());

  it("returns empty entries for empty objects/arrays", () => {
    const entries = loadAllEntries(testDir);
    expect(entries).toEqual([]);
  });
});
