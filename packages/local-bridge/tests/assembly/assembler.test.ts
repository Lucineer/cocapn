/**
 * Self Assembler tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { SelfAssembler } from "../../src/assembly/assembler.js";
import type { RepoProfile } from "../../src/assembly/detector.js";
import type { TemplateMatch } from "../../src/assembly/matcher.js";

describe("SelfAssembler", () => {
  const testDir = "/tmp/cocapn-test-assembler";

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("assemble", () => {
    it("should successfully assemble a TypeScript repo", async () => {
      // Create a basic TypeScript repo
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "test-repo",
          dependencies: {
            hono: "^4.0.0",
          },
        })
      );

      writeFileSync(join(testDir, "tsconfig.json"), "{}");

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.success).toBe(true);
      expect(result.profile.language).toBe("typescript");
      expect(result.template.template).toBe("cloud-worker");
      expect(result.duration).toBeGreaterThan(0);
      expect(Array.isArray(result.modules)).toBe(true);
      expect(Array.isArray(result.skills)).toBe(true);
      expect(result.config).toBeDefined();
    });

    it("should handle empty repositories", async () => {
      // Create an empty directory
      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.success).toBe(true);
      expect(result.template.template).toBeTruthy(); // Should still match something
      // Empty dir will be detected based on cocapn package.json context
      expect(result.profile.language).toBeTruthy();
    });

    it("should return error on invalid path", async () => {
      // Create a directory with invalid content
      mkdirSync(join(testDir, "invalid"), { recursive: true });

      // Create assembler with invalid path
      const assembler = new SelfAssembler("/nonexistent/path");
      const result = await assembler.assemble();

      // Should still complete, but with fallback
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should complete assembly quickly", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ name: "test" })
      );

      const assembler = new SelfAssembler(testDir);
      const startTime = Date.now();
      const result = await assembler.assemble();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete in < 2s
      expect(result.duration).toBeLessThan(2000);
    });

    it("should generate valid configuration", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: { react: "^18.0.0" },
          scripts: { test: "vitest run", build: "vite build" },
        })
      );

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.config).toBeDefined();
      expect(result.config.language).toBeDefined();
      expect(result.config.template).toBeDefined();
      expect(result.config.personality).toBeDefined();
      expect(result.config.commands).toBeDefined();
      expect(result.config.router).toBeDefined();
      expect(result.config.memory).toBeDefined();
      expect(result.config.sync).toBeDefined();
      expect(result.config.assembledAt).toBeDefined();
    });
  });

  describe("discoverModules", () => {
    it("should find modules in node_modules/cocapn-modules", async () => {
      // Create node_modules/cocapn-modules/test-module/module.json
      const modulesDir = join(testDir, "node_modules", "cocapn-modules");
      mkdirSync(modulesDir, { recursive: true });
      mkdirSync(join(modulesDir, "test-module"), { recursive: true });
      writeFileSync(
        join(modulesDir, "test-module", "module.json"),
        JSON.stringify({ name: "test-module" })
      );

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.modules).toContain("test-module");
    });

    it("should find modules in local modules/ directory", async () => {
      // Create modules/test-module/module.yml
      const modulesDir = join(testDir, "modules");
      mkdirSync(modulesDir, { recursive: true });
      mkdirSync(join(modulesDir, "local-module"), { recursive: true });
      writeFileSync(
        join(modulesDir, "local-module", "module.yml"),
        "name: local-module\ntype: tool"
      );

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.modules).toContain("local-module");
    });

    it("should handle missing modules directories", async () => {
      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.modules).toEqual([]);
    });
  });

  describe("discoverSkills", () => {
    it("should find skill.json files", async () => {
      // Create cocapn/skills/test-skill/skill.json
      const skillsDir = join(testDir, "cocapn", "skills");
      mkdirSync(skillsDir, { recursive: true });
      mkdirSync(join(skillsDir, "test-skill"), { recursive: true });
      writeFileSync(
        join(skillsDir, "test-skill", "skill.json"),
        JSON.stringify({ name: "test-skill" })
      );

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.skills.length).toBeGreaterThan(0);
    });

    it("should handle missing skills directories", async () => {
      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(Array.isArray(result.skills)).toBe(true);
    });
  });

  describe("formatStatus", () => {
    it("should format successful assembly result", () => {
      const result: AssemblyResult = {
        profile: {
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
        },
        template: {
          template: "cloud-worker",
          confidence: 0.9,
          modules: ["cloud-module-pii"],
          personality: "cloud-worker",
          displayName: "Cloud Worker",
          description: "Cloudflare Workers template",
        },
        modules: ["git"],
        skills: [],
        config: {},
        duration: 123,
        success: true,
      };

      const formatted = SelfAssembler.formatStatus(result);

      expect(formatted).toContain("✅ Assembly complete");
      expect(formatted).toContain("Language: typescript");
      expect(formatted).toContain("Framework: hono");
      expect(formatted).toContain("cloud-worker");
      expect(formatted).toContain("90%");
      expect(formatted).toContain("123ms");
    });

    it("should format failed assembly result", () => {
      const result: AssemblyResult = {
        profile: {
          language: "unknown",
          packageManager: "npm",
          hasTests: false,
          hasCI: false,
          testCommand: "",
          entryPoints: [],
          totalFiles: 0,
          totalDirs: 0,
        },
        template: {
          template: "bare",
          confidence: 0,
          modules: [],
          personality: "generic",
          displayName: "Bare Setup",
          description: "Minimal cocapn setup",
        },
        modules: [],
        skills: [],
        config: {},
        duration: 10,
        success: false,
        error: "Test error",
      };

      const formatted = SelfAssembler.formatStatus(result);

      expect(formatted).toContain("❌ Assembly failed");
      expect(formatted).toContain("Test error");
    });
  });

  describe("integration", () => {
    it("should assemble real-world TypeScript project", async () => {
      // Create a realistic TypeScript project
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "real-ts-project",
          version: "1.0.0",
          dependencies: {
            hono: "^4.0.0",
            "@hono/node-server": "^1.0.0",
          },
          devDependencies: {
            typescript: "^5.0.0",
            vitest: "^1.0.0",
          },
          scripts: {
            test: "vitest run",
            build: "tsc",
            start: "node dist/index.js",
          },
        })
      );

      writeFileSync(
        join(testDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
          },
        })
      );

      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(
        join(testDir, "src", "index.ts"),
        'import { Hono } from "hono";\nconst app = new Hono();\nexport default app;'
      );
      writeFileSync(join(testDir, "src", "index.test.ts"), 'import { describe } from "vitest";');

      mkdirSync(join(testDir, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(testDir, ".github", "workflows", "ci.yml"),
        "name: CI\non: [push]"
      );

      const assembler = new SelfAssembler(testDir);
      const result = await assembler.assemble();

      expect(result.success).toBe(true);
      expect(result.profile.language).toBe("typescript");
      expect(result.profile.framework).toBe("hono");
      expect(result.profile.hasTests).toBe(true);
      expect(result.profile.hasCI).toBe(true);
      expect(result.template.template).toBe("cloud-worker");
      expect(result.template.confidence).toBeGreaterThan(0.8);
      expect(result.duration).toBeLessThan(2000);
    });
  });
});

// Helper types for tests
type AssemblyResult = {
  profile: RepoProfile;
  template: TemplateMatch;
  modules: string[];
  skills: string[];
  config: Record<string, unknown>;
  duration: number;
  success: boolean;
  error?: string;
};
