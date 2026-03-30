/**
 * Knowledge validator — type-specific validation rules for knowledge entries.
 *
 * Each knowledge type has additional required fields beyond the base rules
 * (type, content, confidence >= 0.1) enforced by KnowledgePipeline.validate().
 */

import type { KnowledgeEntry, ValidationResult } from "./pipeline.js";

// ─── Validation rules ────────────────────────────────────────────────────────

interface ContentField {
  [key: string]: unknown;
}

function parseContent(entry: KnowledgeEntry): ContentField {
  try {
    return JSON.parse(entry.content);
  } catch {
    return {};
  }
}

function errorsOf(...checks: [boolean, string][]): string[] {
  return checks.filter(([ok]) => !ok).map(([, msg]) => msg);
}

/** Validate a species entry: requires scientific name, common name, image reference. */
export function validateSpecies(entry: KnowledgeEntry): ValidationResult {
  const data = parseContent(entry);
  const errors = errorsOf(
    [typeof data.scientificName === "string" && data.scientificName.trim().length > 0, "species entry requires 'scientificName'"],
    [typeof data.commonName === "string" && data.commonName.trim().length > 0, "species entry requires 'commonName'"],
    [Array.isArray(data.images) && data.images.length > 0, "species entry requires at least one image reference in 'images'"],
  );
  return { valid: errors.length === 0, errors };
}

/** Validate a regulation entry: requires jurisdiction, effective date, source URL. */
export function validateRegulation(entry: KnowledgeEntry): ValidationResult {
  const data = parseContent(entry);
  const errors = errorsOf(
    [typeof data.jurisdiction === "string" && data.jurisdiction.trim().length > 0, "regulation entry requires 'jurisdiction'"],
    [typeof data.effectiveDate === "string" && data.effectiveDate.trim().length > 0, "regulation entry requires 'effectiveDate'"],
    [typeof data.sourceUrl === "string" && data.sourceUrl.trim().length > 0, "regulation entry requires 'sourceUrl'"],
  );
  return { valid: errors.length === 0, errors };
}

/** Validate a technique entry: requires difficulty level, equipment list. */
export function validateTechnique(entry: KnowledgeEntry): ValidationResult {
  const data = parseContent(entry);
  const errors = errorsOf(
    [typeof data.difficulty === "string" && ["beginner", "intermediate", "advanced", "expert"].includes(data.difficulty), "technique entry requires 'difficulty' (beginner|intermediate|advanced|expert)"],
    [Array.isArray(data.equipment) && data.equipment.length > 0, "technique entry requires 'equipment' list"],
  );
  return { valid: errors.length === 0, errors };
}

/** Validate a location entry: requires name and coordinates or description. */
export function validateLocation(entry: KnowledgeEntry): ValidationResult {
  const data = parseContent(entry);
  const errors = errorsOf(
    [typeof data.name === "string" && data.name.trim().length > 0, "location entry requires 'name'"],
    [(typeof data.description === "string" && data.description.trim().length > 0) || (Array.isArray(data.coordinates) && data.coordinates.length === 2), "location entry requires 'description' or 'coordinates'"],
  );
  return { valid: errors.length === 0, errors };
}

/** Validate an equipment entry: requires name and category. */
export function validateEquipment(entry: KnowledgeEntry): ValidationResult {
  const data = parseContent(entry);
  const errors = errorsOf(
    [typeof data.name === "string" && data.name.trim().length > 0, "equipment entry requires 'name'"],
    [typeof data.category === "string" && data.category.trim().length > 0, "equipment entry requires 'category'"],
  );
  return { valid: errors.length === 0, errors };
}

/**
 * Full validation: base rules + type-specific rules.
 */
export function validateFull(entry: KnowledgeEntry): ValidationResult {
  const baseErrors: string[] = [];

  if (!entry.type) baseErrors.push("missing required field: type");
  if (!entry.content || entry.content.trim().length === 0) baseErrors.push("missing required field: content");
  if (entry.metadata.confidence < 0.1) baseErrors.push("confidence must be >= 0.1");

  let typeResult: ValidationResult = { valid: true, errors: [] };

  switch (entry.type) {
    case 'species':    typeResult = validateSpecies(entry);    break;
    case 'regulation': typeResult = validateRegulation(entry); break;
    case 'technique':  typeResult = validateTechnique(entry);  break;
    case 'location':   typeResult = validateLocation(entry);   break;
    case 'equipment':  typeResult = validateEquipment(entry);  break;
  }

  const allErrors = [...baseErrors, ...typeResult.errors];
  return { valid: allErrors.length === 0, errors: allErrors };
}
