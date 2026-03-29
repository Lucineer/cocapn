/**
 * Test Generator — automatically generates test skeletons for TypeScript files.
 *
 * After an agent edits a .ts file, the generator:
 * 1. Checks if a test file exists
 * 2. If not, generates a skeleton test file
 * 3. Returns the test file path
 *
 * This is a stub implementation — the real version would use an LLM to
 * generate actual test cases based on the code change.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export interface TestGenerationRequest {
  /** The source file that was changed (absolute path) */
  filePath: string;
  /** Description of what was changed */
  changeDescription: string;
  /** Existing test file for this source (if known) */
  existingTestFile?: string;
}

export interface GeneratedTest {
  testFilePath: string;
  content: string;
  imports: string[];
  testCases: string[];
}

/**
 * Test Generator class
 */
export class TestGenerator {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Find the test file for a given source file.
   * Convention: src/foo/bar.ts → tests/foo/bar.test.ts
   */
  findTestFile(sourcePath: string): string | null {
    if (!sourcePath.endsWith(".ts")) {
      return null;
    }

    // Convert absolute path to relative from repo root
    const relativePath = sourcePath.replace(this.repoRoot, "").replace(/^\//, "");

    // Replace src/ with tests/ and .ts with .test.ts
    if (relativePath.startsWith("src/")) {
      const testPath = relativePath.replace("src/", "tests/").replace(".ts", ".test.ts");
      const absoluteTestPath = join(this.repoRoot, testPath);

      if (existsSync(absoluteTestPath)) {
        return absoluteTestPath;
      }
    }

    return null;
  }

  /**
   * Generate test cases for a change.
   * This is a stub — returns a skeleton test file.
   * Real implementation would use LLM to generate test cases.
   */
  async generateTests(request: TestGenerationRequest): Promise<GeneratedTest> {
    const { filePath, changeDescription } = request;

    // Read the source file to understand what to test
    const sourceContent = existsSync(filePath)
      ? readFileSync(filePath, "utf-8")
      : "";

    // Extract imports and exports from source
    const imports = this.extractImports(sourceContent);
    const exports = this.extractExports(sourceContent);

    // Generate test skeleton
    const skeleton = this.generateSkeleton(filePath, sourceContent, exports);

    return skeleton;
  }

  /**
   * Generate a test skeleton (no LLM needed).
   * Creates describe/it blocks with TODO placeholders.
   */
  generateSkeleton(
    sourcePath: string,
    sourceContent?: string,
    exports?: string[]
  ): GeneratedTest {
    const testFilePath = this.getTestPathForSource(sourcePath);
    const relativePath = sourcePath.replace(this.repoRoot, "").replace(/^\//, "");

    const imports: string[] = [];
    const testCases: string[] = [];

    // Extract exports if not provided
    if (!exports && sourceContent) {
      exports = this.extractExports(sourceContent);
    }

    // Generate import statement based on relative path
    const importPath = relativePath.replace(".ts", ".js");
    imports.push(`import { ${exports?.join(", ") || "/* exports */"} } from "../${importPath}";`);

    // Generate describe block based on file name
    const fileName = relativePath.split("/").pop()?.replace(".ts", "") || "module";
    const describeName = this.toPascalCase(fileName);

    // Generate test cases for each export
    if (exports && exports.length > 0) {
      exports.forEach(exp => {
        const testName = `should handle ${exp} correctly`;
        testCases.push(`  it("${testName}", () => {`);
        testCases.push(`    // TODO: Implement test for ${exp}`);
        testCases.push(`    expect(true).toBe(true);`);
        testCases.push(`  });`);
      });
    } else {
      testCases.push(`  it("should pass", () => {`);
      testCases.push(`    // TODO: Implement test`);
      testCases.push(`    expect(true).toBe(true);`);
      testCases.push(`  });`);
    }

    // Build the full test file content
    const content = this.buildTestFile(describeName, imports, testCases);

    return {
      testFilePath,
      content,
      imports,
      testCases,
    };
  }

  /**
   * Get the test file path for a source file.
   * Convention: src/foo/bar.ts → tests/foo/bar.test.ts
   */
  private getTestPathForSource(sourcePath: string): string {
    const relativePath = sourcePath.replace(this.repoRoot, "").replace(/^\//, "");

    if (relativePath.startsWith("src/")) {
      const testPath = relativePath.replace("src/", "tests/").replace(".ts", ".test.ts");
      return join(this.repoRoot, testPath);
    }

    // Fallback: same directory with .test.ts suffix
    return sourcePath.replace(".ts", ".test.ts");
  }

  /**
   * Extract imports from source code.
   */
  private extractImports(sourceContent: string): string[] {
    const imports: string[] = [];
    const importRegex = /^import\s+(?:(?:\{[^}]*\}|\*)\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm;

    let match;
    while ((match = importRegex.exec(sourceContent)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Extract exports from source code.
   */
  private extractExports(sourceContent: string): string[] {
    const exports: string[] = [];

    // export function foo
    const functionRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    // export const foo
    const constRegex = /export\s+(?:const|let|var)\s+(\w+)/g;
    while ((match = constRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    // export class Foo
    const classRegex = /export\s+class\s+(\w+)/g;
    while ((match = classRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    // export enum Foo
    const enumRegex = /export\s+enum\s+(\w+)/g;
    while ((match = enumRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    // export interface Foo
    const interfaceRegex = /export\s+interface\s+(\w+)/g;
    while ((match = interfaceRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    // export type Foo
    const typeRegex = /export\s+type\s+(\w+)/g;
    while ((match = typeRegex.exec(sourceContent)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  /**
   * Convert kebab-case or snake_case to PascalCase.
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\s/g, "");
  }

  /**
   * Build the full test file content.
   */
  private buildTestFile(describeName: string, imports: string[], testCases: string[]): string {
    const importSection = imports.map(imp => `${imp};`).join("\n");
    const testSection = testCases.join("\n");

    return `${importSection}

describe("${describeName}", () => {
${testSection}
});
`;
  }
}
