/**
 * Tests for knowledge validator — type-specific validation rules.
 */

import { describe, it, expect } from "vitest";
import {
  validateSpecies,
  validateRegulation,
  validateTechnique,
  validateLocation,
  validateEquipment,
  validateFull,
} from "../../src/knowledge/validator.js";
import type { KnowledgeEntry } from "../../src/knowledge/pipeline.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(type: KnowledgeEntry["type"], content: Record<string, unknown>): KnowledgeEntry {
  return {
    id: "test-id",
    type,
    content: JSON.stringify(content),
    metadata: {
      type,
      source: "test",
      confidence: 0.8,
      tags: [],
    },
    createdAt: new Date().toISOString(),
    validated: false,
  };
}

// ─── Species ──────────────────────────────────────────────────────────────────

describe("validateSpecies", () => {
  it("passes for complete species entry", () => {
    const entry = makeEntry("species", {
      scientificName: "Lutjanus campechanus",
      commonName: "Red Snapper",
      images: ["snapper-photo.jpg"],
    });
    expect(validateSpecies(entry).valid).toBe(true);
  });

  it("fails without scientificName", () => {
    const entry = makeEntry("species", {
      commonName: "Red Snapper",
      images: ["photo.jpg"],
    });
    const result = validateSpecies(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("scientificName");
  });

  it("fails without commonName", () => {
    const entry = makeEntry("species", {
      scientificName: "Lutjanus campechanus",
      images: ["photo.jpg"],
    });
    const result = validateSpecies(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("commonName");
  });

  it("fails without images", () => {
    const entry = makeEntry("species", {
      scientificName: "Lutjanus campechanus",
      commonName: "Red Snapper",
      images: [],
    });
    const result = validateSpecies(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("image");
  });

  it("fails when content is not valid JSON", () => {
    const entry = makeEntry("species", {});
    entry.content = "not json";
    const result = validateSpecies(entry);
    expect(result.valid).toBe(false);
  });
});

// ─── Regulation ───────────────────────────────────────────────────────────────

describe("validateRegulation", () => {
  it("passes for complete regulation entry", () => {
    const entry = makeEntry("regulation", {
      jurisdiction: "US Federal",
      effectiveDate: "2025-01-01",
      sourceUrl: "https://example.com/regulation",
    });
    expect(validateRegulation(entry).valid).toBe(true);
  });

  it("fails without jurisdiction", () => {
    const entry = makeEntry("regulation", {
      effectiveDate: "2025-01-01",
      sourceUrl: "https://example.com/reg",
    });
    const result = validateRegulation(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("jurisdiction");
  });

  it("fails without effectiveDate", () => {
    const entry = makeEntry("regulation", {
      jurisdiction: "State of Alaska",
      sourceUrl: "https://example.com/reg",
    });
    const result = validateRegulation(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("effectiveDate");
  });

  it("fails without sourceUrl", () => {
    const entry = makeEntry("regulation", {
      jurisdiction: "US Federal",
      effectiveDate: "2025-01-01",
    });
    const result = validateRegulation(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("sourceUrl");
  });
});

// ─── Technique ────────────────────────────────────────────────────────────────

describe("validateTechnique", () => {
  it("passes for complete technique entry", () => {
    const entry = makeEntry("technique", {
      difficulty: "intermediate",
      equipment: ["rod", "reel", "tackle"],
    });
    expect(validateTechnique(entry).valid).toBe(true);
  });

  it("fails with invalid difficulty", () => {
    const entry = makeEntry("technique", {
      difficulty: "easy",
      equipment: ["rod"],
    });
    const result = validateTechnique(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("difficulty");
  });

  it("fails without equipment list", () => {
    const entry = makeEntry("technique", {
      difficulty: "beginner",
      equipment: [],
    });
    const result = validateTechnique(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("equipment");
  });

  it("accepts all valid difficulty levels", () => {
    for (const level of ["beginner", "intermediate", "advanced", "expert"]) {
      const entry = makeEntry("technique", {
        difficulty: level,
        equipment: ["rod"],
      });
      expect(validateTechnique(entry).valid).toBe(true);
    }
  });
});

// ─── Location ─────────────────────────────────────────────────────────────────

describe("validateLocation", () => {
  it("passes with name and description", () => {
    const entry = makeEntry("location", {
      name: "Gulf of Mexico",
      description: "Warm waters off the southern US coast",
    });
    expect(validateLocation(entry).valid).toBe(true);
  });

  it("passes with name and coordinates", () => {
    const entry = makeEntry("location", {
      name: "Marina",
      coordinates: [29.5, -90.0],
    });
    expect(validateLocation(entry).valid).toBe(true);
  });

  it("fails without name", () => {
    const entry = makeEntry("location", {
      description: "Some place",
    });
    const result = validateLocation(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("name");
  });

  it("fails without description or coordinates", () => {
    const entry = makeEntry("location", { name: "Place" });
    const result = validateLocation(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("description");
  });
});

// ─── Equipment ────────────────────────────────────────────────────────────────

describe("validateEquipment", () => {
  it("passes with name and category", () => {
    const entry = makeEntry("equipment", {
      name: "Penn Battle II",
      category: "spinning reel",
    });
    expect(validateEquipment(entry).valid).toBe(true);
  });

  it("fails without name", () => {
    const entry = makeEntry("equipment", { category: "reel" });
    const result = validateEquipment(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("name");
  });

  it("fails without category", () => {
    const entry = makeEntry("equipment", { name: "Rod" });
    const result = validateEquipment(entry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("category");
  });
});

// ─── Full validation ──────────────────────────────────────────────────────────

describe("validateFull", () => {
  it("combines base and type-specific errors", () => {
    const entry: KnowledgeEntry = {
      id: "test",
      type: "species",
      content: "{}",
      metadata: {
        type: "species",
        source: "test",
        confidence: 0.05,
        tags: [],
      },
      createdAt: new Date().toISOString(),
      validated: false,
    };

    const result = validateFull(entry);
    expect(result.valid).toBe(false);
    // Base error: confidence
    expect(result.errors.some(e => e.includes("confidence"))).toBe(true);
    // Type error: missing species fields
    expect(result.errors.some(e => e.includes("scientificName"))).toBe(true);
  });

  it("passes when all rules are satisfied", () => {
    const entry = makeEntry("species", {
      scientificName: "Thunnus albacares",
      commonName: "Yellowfin Tuna",
      images: ["tuna.jpg"],
    });
    expect(validateFull(entry).valid).toBe(true);
  });
});
