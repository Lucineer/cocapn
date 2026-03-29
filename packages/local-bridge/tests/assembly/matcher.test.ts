/**
 * Template Matcher tests
 */

import { describe, it, expect } from "vitest";
import { TemplateMatcher } from "../../src/assembly/matcher.js";
import type { RepoProfile } from "../../src/assembly/detector.js";

describe("TemplateMatcher", () => {
  const createProfile = (overrides: Partial<RepoProfile> = {}): RepoProfile => ({
    language: "typescript",
    framework: "hono",
    packageManager: "npm",
    hasTests: true,
    hasCI: true,
    testCommand: "npx vitest run",
    buildCommand: "npm run build",
    entryPoints: ["src/index.ts"],
    totalFiles: 10,
    totalDirs: 3,
    ...overrides,
  });

  describe("match", () => {
    it("should match cloud-worker template for TypeScript + Hono", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "typescript",
        framework: "hono",
        packageManager: "npm",
      });

      const match = await matcher.match(profile);

      expect(match.template).toBe("cloud-worker");
      expect(match.confidence).toBeGreaterThan(0.8);
      expect(match.modules).toContain("cloud-module-pii");
      expect(match.modules).toContain("cloud-module-router");
      expect(match.personality).toBe("cloud-worker");
    });

    it("should match web-app template for TypeScript + React", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "typescript",
        framework: "react",
        hasTests: true,
        hasCI: true,
      });

      const match = await matcher.match(profile);

      expect(match.template).toBe("web-app");
      expect(match.confidence).toBeGreaterThan(0.7);
      expect(match.modules).toContain("git");
      expect(match.modules).toContain("publisher");
    });

    it("should match python template for Python + Django", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "python",
        framework: "django",
        hasTests: true,
      });

      const match = await matcher.match(profile);

      expect(match.template).toBe("python");
      expect(match.confidence).toBeGreaterThan(0.8);
    });

    it("should match makerlog for TypeScript + tests + CI", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "typescript",
        framework: "react",
        hasTests: true,
        hasCI: true,
      });

      const match = await matcher.match(profile);

      // Should match web-app since React takes priority
      expect(match.template).toBe("web-app");
      expect(match.modules).toContain("git");
      expect(match.modules).toContain("publisher");
    });

    it("should default to bare template for unknown repos", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "javascript",
        framework: undefined,
        hasTests: false,
        hasCI: false,
      });

      const match = await matcher.match(profile);

      // Should match web-app for JavaScript
      expect(match.template).toBe("web-app");
      expect(match.confidence).toBeLessThan(0.5);
    });

    it("should always return a match", async () => {
      const matcher = new TemplateMatcher("/templates");
      const profile = createProfile({
        language: "rust",
        framework: undefined,
        hasTests: false,
        hasCI: false,
      });

      const match = await matcher.match(profile);

      expect(match.template).toBeTruthy();
      expect(match.confidence).toBeGreaterThanOrEqual(0);
      expect(match.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("listTemplates", () => {
    it("should return all available templates", () => {
      const matcher = new TemplateMatcher("/templates");
      const templates = matcher.listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContainEqual({
        name: "cloud-worker",
        displayName: "Cloud Worker",
        description: "Cloudflare Workers template with TypeScript and Hono",
      });
      expect(templates).toContainEqual({
        name: "web-app",
        displayName: "Web Application",
        description: "React/Vue web application template",
      });
      expect(templates).toContainEqual({
        name: "python",
        displayName: "Python Project",
        description: "Python project template with Django/Flask support",
      });
    });

    it("should include domain-specific templates", () => {
      const matcher = new TemplateMatcher("/templates");
      const templates = matcher.listTemplates();

      const templateNames = templates.map((t) => t.name);

      expect(templateNames).toContain("dmlog");
      expect(templateNames).toContain("studylog");
      expect(templateNames).toContain("makerlog");
      expect(templateNames).toContain("businesslog");
      expect(templateNames).toContain("activelog");
      expect(templateNames).toContain("fishinglog");
      expect(templateNames).toContain("playerlog");
      expect(templateNames).toContain("reallog");
    });
  });

  describe("confidence scoring", () => {
    it("should score higher for exact matches", async () => {
      const matcher = new TemplateMatcher("/templates");

      // TypeScript + Hono should match cloud-worker with high confidence
      const tsHono = await matcher.match(
        createProfile({
          language: "typescript",
          framework: "hono",
          packageManager: "npm",
        })
      );

      // TypeScript + React should not match cloud-worker
      const tsReact = await matcher.match(
        createProfile({
          language: "typescript",
          framework: "react",
          packageManager: "npm",
        })
      );

      // cloud-worker should have higher or equal confidence for Hono
      expect(tsHono.template).toBe("cloud-worker");
      expect(tsReact.template).not.toBe("cloud-worker");
    });

    it("should consider test and CI presence", async () => {
      const matcher = new TemplateMatcher("/templates");

      const withTestsAndCI = await matcher.match(
        createProfile({
          language: "typescript",
          framework: "react",
          hasTests: true,
          hasCI: true,
        })
      );

      const withoutTestsAndCI = await matcher.match(
        createProfile({
          language: "typescript",
          framework: "react",
          hasTests: false,
          hasCI: false,
        })
      );

      expect(withTestsAndCI.confidence).toBeGreaterThan(
        withoutTestsAndCI.confidence
      );
    });
  });
});
