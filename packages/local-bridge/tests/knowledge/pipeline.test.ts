/**
 * Tests for KnowledgePipeline — CRUD, query, export, stats.
 */

import { describe, it, expect } from "vitest";
import { KnowledgePipeline, type KnowledgeMeta } from "../../src/knowledge/pipeline.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMeta(overrides: Partial<KnowledgeMeta> = {}): KnowledgeMeta {
  return {
    type: "species",
    source: "test-observation",
    confidence: 0.8,
    tags: ["fish", "saltwater"],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("KnowledgePipeline", () => {
  describe("ingest", () => {
    it("creates an entry with generated ID and timestamp", async () => {
      const pipeline = new KnowledgePipeline();
      const entry = await pipeline.ingest(
        Buffer.from(JSON.stringify({ name: "Red Snapper" })),
        makeMeta(),
      );

      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.type).toBe("species");
      expect(entry.content).toContain("Red Snapper");
      expect(entry.createdAt).toBeDefined();
      expect(entry.validated).toBe(false);
    });

    it("stores entry retrievable by ID", async () => {
      const pipeline = new KnowledgePipeline();
      const entry = await pipeline.ingest(
        Buffer.from("some content"),
        makeMeta(),
      );

      expect(pipeline.getEntry(entry.id)).toBeDefined();
      expect(pipeline.getEntry(entry.id)!.id).toBe(entry.id);
    });

    it("handles all five knowledge types", async () => {
      const pipeline = new KnowledgePipeline();
      const types = ["species", "regulation", "technique", "location", "equipment"] as const;

      for (const type of types) {
        const entry = await pipeline.ingest(
          Buffer.from("content"),
          makeMeta({ type }),
        );
        expect(entry.type).toBe(type);
      }

      expect(pipeline.stats().entries).toBe(5);
    });
  });

  describe("query", () => {
    it("finds entries by content text match", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("Pacific Halibut is a flatfish"), makeMeta({ tags: [] }));
      await pipeline.ingest(Buffer.from("Atlantic Cod is a groundfish"), makeMeta({ tags: [] }));

      const results = await pipeline.query("Pacific");
      expect(results).toHaveLength(1);
      expect(results[0]!.content).toContain("Pacific Halibut");
    });

    it("finds entries by tag match", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("content A"), makeMeta({ tags: ["tuna", "pelagic"] }));
      await pipeline.ingest(Buffer.from("content B"), makeMeta({ tags: ["snapper", "reef"] }));

      const results = await pipeline.query("pelagic");
      expect(results).toHaveLength(1);
      expect(results[0]!.metadata.tags).toContain("pelagic");
    });

    it("finds entries by source match", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("content A"), makeMeta({ source: "NOAA-report-2025" }));

      const results = await pipeline.query("NOAA");
      expect(results).toHaveLength(1);
    });

    it("respects limit parameter", async () => {
      const pipeline = new KnowledgePipeline();
      for (let i = 0; i < 5; i++) {
        await pipeline.ingest(Buffer.from(`fish entry ${i}`), makeMeta({ tags: [`tag${i}`] }));
      }

      const results = await pipeline.query("fish", 2);
      expect(results).toHaveLength(2);
    });

    it("returns empty array when no match", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("some content"), makeMeta());

      const results = await pipeline.query("nonexistent");
      expect(results).toHaveLength(0);
    });

    it("is case-insensitive", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("PACIFIC Salmon"), makeMeta({ tags: [] }));

      expect((await pipeline.query("pacific")).length).toBe(1);
      expect((await pipeline.query("PACIFIC")).length).toBe(1);
    });
  });

  describe("validate", () => {
    it("passes for valid entry", () => {
      const pipeline = new KnowledgePipeline();
      const entry = {
        id: "test",
        type: "species" as const,
        content: "some content",
        metadata: makeMeta(),
        createdAt: new Date().toISOString(),
        validated: false,
      };

      expect(pipeline.validate(entry).valid).toBe(true);
    });

    it("fails when type is missing", () => {
      const pipeline = new KnowledgePipeline();
      const entry = {
        id: "test",
        type: "" as unknown as "species",
        content: "content",
        metadata: makeMeta(),
        createdAt: new Date().toISOString(),
        validated: false,
      };

      const result = pipeline.validate(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("missing required field: type");
    });

    it("fails when content is empty", () => {
      const pipeline = new KnowledgePipeline();
      const entry = {
        id: "test",
        type: "species" as const,
        content: "",
        metadata: makeMeta(),
        createdAt: new Date().toISOString(),
        validated: false,
      };

      const result = pipeline.validate(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("missing required field: content");
    });

    it("fails when confidence is below 0.1", () => {
      const pipeline = new KnowledgePipeline();
      const entry = {
        id: "test",
        type: "species" as const,
        content: "content",
        metadata: makeMeta({ confidence: 0.05 }),
        createdAt: new Date().toISOString(),
        validated: false,
      };

      const result = pipeline.validate(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("confidence must be >= 0.1");
    });

    it("passes at confidence exactly 0.1", () => {
      const pipeline = new KnowledgePipeline();
      const entry = {
        id: "test",
        type: "species" as const,
        content: "content",
        metadata: makeMeta({ confidence: 0.1 }),
        createdAt: new Date().toISOString(),
        validated: false,
      };

      expect(pipeline.validate(entry).valid).toBe(true);
    });
  });

  describe("export", () => {
    it("exports as JSONL", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("entry 1"), makeMeta());
      await pipeline.ingest(Buffer.from("entry 2"), makeMeta());

      const buf = await pipeline.export("jsonl");
      const lines = buf.toString("utf-8").trim().split("\n");
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it("exports as JSON array", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("entry 1"), makeMeta());

      const buf = await pipeline.export("json");
      const parsed = JSON.parse(buf.toString("utf-8"));
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it("exports as CSV with header", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("salmon data"), makeMeta());

      const buf = await pipeline.export("csv");
      const lines = buf.toString("utf-8").trim().split("\n");
      expect(lines[0]).toBe("id,type,content,source,confidence,tags,createdAt,validated");
      expect(lines).toHaveLength(2);
    });

    it("exports empty store gracefully", async () => {
      const pipeline = new KnowledgePipeline();

      const jsonBuf = await pipeline.export("json");
      expect(JSON.parse(jsonBuf.toString("utf-8"))).toEqual([]);

      const jsonlBuf = await pipeline.export("jsonl");
      expect(jsonlBuf.toString("utf-8").trim()).toBe("");

      const csvBuf = await pipeline.export("csv");
      const lines = csvBuf.toString("utf-8").trim().split("\n");
      expect(lines).toHaveLength(1); // header only
    });
  });

  describe("stats", () => {
    it("returns zero counts for empty store", () => {
      const pipeline = new KnowledgePipeline();
      const stats = pipeline.stats();

      expect(stats.entries).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.lastUpdated).toBe(0);
    });

    it("counts entries by type", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("a"), makeMeta());
      await pipeline.ingest(Buffer.from("b"), makeMeta());
      await pipeline.ingest(Buffer.from("c"), makeMeta({ type: "regulation" }));

      const stats = pipeline.stats();
      expect(stats.entries).toBe(3);
      expect(stats.byType.species).toBe(2);
      expect(stats.byType.regulation).toBe(1);
    });

    it("reports lastUpdated as most recent timestamp", async () => {
      const pipeline = new KnowledgePipeline();
      await pipeline.ingest(Buffer.from("first"), makeMeta());

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10));
      await pipeline.ingest(Buffer.from("second"), makeMeta());

      const stats = pipeline.stats();
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe("deleteEntry", () => {
    it("removes entry from store", async () => {
      const pipeline = new KnowledgePipeline();
      const entry = await pipeline.ingest(Buffer.from("content"), makeMeta());
      expect(pipeline.stats().entries).toBe(1);

      const deleted = pipeline.deleteEntry(entry.id);
      expect(deleted).toBe(true);
      expect(pipeline.stats().entries).toBe(0);
    });

    it("returns false for nonexistent ID", () => {
      const pipeline = new KnowledgePipeline();
      expect(pipeline.deleteEntry("nonexistent")).toBe(false);
    });
  });
});
