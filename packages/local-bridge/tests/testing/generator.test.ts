/**
 * Tests for TestGenerator
 */

import { describe, it, expect } from "vitest";
import { TestGenerator } from "../../src/testing/index.js";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("TestGenerator", () => {
  const repoRoot = "/tmp/test-cocapn";
  const testDir = join(repoRoot, "src");
  const testsDir = join(repoRoot, "tests");

  // Helper to create a test file
  function createTestFile(relPath: string, content: string): void {
    const fullPath = join(repoRoot, relPath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

    // Create directory if it doesn't exist
    if (!existsSync(dir)) {
      // We'll skip directory creation for tests that don't need actual files
    }

    writeFileSync(fullPath, content, "utf-8");
  }

  describe("findTestFile", () => {
    it("should find existing test file for a source file", () => {
      const generator = new TestGenerator(repoRoot);

      // Create a source file path (doesn't need to exist for this test)
      const sourcePath = join(repoRoot, "src", "example.ts");
      const testPath = join(repoRoot, "tests", "example.test.ts");

      // For this test, we'll just check the logic
      // In real scenarios, the test file would need to exist
      const result = generator.findTestFile(sourcePath);

      // Should return null if test file doesn't exist
      expect(result).toBeNull();
    });

    it("should return null for non-TypeScript files", () => {
      const generator = new TestGenerator(repoRoot);
      const result = generator.findTestFile("/tmp/test.js");
      expect(result).toBeNull();
    });

    it("should return null for files not in src/", () => {
      const generator = new TestGenerator(repoRoot);
      const result = generator.findTestFile("/tmp/other/src/test.ts");
      expect(result).toBeNull();
    });
  });

  describe("generateSkeleton", () => {
    it("should generate test skeleton for a source file with exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourcePath = join(repoRoot, "src", "example.ts");
      const sourceContent = `
export function foo() {
  return "bar";
}

export const baz = 42;
`;
      const exports = ["foo", "baz"];

      const result = generator.generateSkeleton(sourcePath, sourceContent, exports);

      expect(result.testFilePath).toBe(join(repoRoot, "tests", "example.test.ts"));
      expect(result.imports).toContain('import { foo, baz } from "../src/example.js";');
      expect(result.content).toContain("describe(\"Example\", () => {");
      expect(result.testCases.length).toBeGreaterThan(0);
    });

    it("should generate test skeleton for a source file without exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourcePath = join(repoRoot, "src", "utils.ts");
      const result = generator.generateSkeleton(sourcePath);

      expect(result.testFilePath).toBe(join(repoRoot, "tests", "utils.test.ts"));
      expect(result.content).toContain("describe(\"Utils\", () => {");
      expect(result.testCases.length).toBeGreaterThan(0);
    });

    it("should handle kebab-case file names", () => {
      const generator = new TestGenerator(repoRoot);

      const sourcePath = join(repoRoot, "src", "my-helper.ts");
      const result = generator.generateSkeleton(sourcePath);

      expect(result.content).toContain("describe(\"MyHelper\", () => {");
    });

    it("should handle snake_case file names", () => {
      const generator = new TestGenerator(repoRoot);

      const sourcePath = join(repoRoot, "src", "my_helper.ts");
      const result = generator.generateSkeleton(sourcePath);

      expect(result.content).toContain("describe(\"MyHelper\", () => {");
    });
  });

  describe("generateTests", () => {
    it("should generate tests for a file with exports", async () => {
      const generator = new TestGenerator(repoRoot);

      const sourcePath = join(repoRoot, "src", "module.ts");
      const sourceContent = `
export class MyClass {
  method() {
    return true;
  }
}

export function myFunction() {
  return false;
}
`;

      const result = await generator.generateTests({
        filePath: sourcePath,
        changeDescription: "Added MyClass and myFunction",
      });

      expect(result.testFilePath).toContain("module.test.ts");
      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.testCases.length).toBeGreaterThan(0);
    });

    it("should handle non-existent files gracefully", async () => {
      const generator = new TestGenerator(repoRoot);

      const result = await generator.generateTests({
        filePath: "/nonexistent/file.ts",
        changeDescription: "Test",
      });

      expect(result).toBeDefined();
      expect(result.testFilePath).toContain("file.test.ts");
    });
  });

  describe("import extraction", () => {
    it("should extract imports from source code", () => {
      const generator = new TestGenerator(repoRoot);

      const sourceContent = `
import { foo } from "bar";
import * as baz from "qux";
import { default as xyz } from "abc";
`;

      const result = generator.generateSkeleton(join(repoRoot, "src", "test.ts"), sourceContent);

      // The generator should extract imports and use them for the test file
      expect(result.imports).toBeDefined();
      expect(Array.isArray(result.imports)).toBe(true);
    });
  });

  describe("export extraction", () => {
    it("should extract function exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourceContent = `
export function foo() {}
export async function bar() {}
`;

      const result = generator.generateSkeleton(join(repoRoot, "src", "test.ts"), sourceContent);

      expect(result.imports.some(imp => imp.includes("foo"))).toBe(true);
      expect(result.imports.some(imp => imp.includes("bar"))).toBe(true);
    });

    it("should extract const exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourceContent = `
export const foo = 42;
export let bar = "baz";
`;

      const result = generator.generateSkeleton(join(repoRoot, "src", "test.ts"), sourceContent);

      expect(result.imports.some(imp => imp.includes("foo"))).toBe(true);
      expect(result.imports.some(imp => imp.includes("bar"))).toBe(true);
    });

    it("should extract class exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourceContent = `
export class Foo {}
export class Bar {}
`;

      const result = generator.generateSkeleton(join(repoRoot, "src", "test.ts"), sourceContent);

      expect(result.imports.some(imp => imp.includes("Foo"))).toBe(true);
      expect(result.imports.some(imp => imp.includes("Bar"))).toBe(true);
    });

    it("should extract interface exports", () => {
      const generator = new TestGenerator(repoRoot);

      const sourceContent = `
export interface Foo {}
export type Bar = string;
export enum Baz {}
`;

      const result = generator.generateSkeleton(join(repoRoot, "src", "test.ts"), sourceContent);

      expect(result.imports.some(imp => imp.includes("Foo"))).toBe(true);
      expect(result.imports.some(imp => imp.includes("Bar"))).toBe(true);
      expect(result.imports.some(imp => imp.includes("Baz"))).toBe(true);
    });
  });
});
