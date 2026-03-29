/**
 * Repo Detector — analyzes a repository to determine its tech stack
 *
 * Scans for:
 * - Language (file extensions)
 * - Framework (dependencies)
 * - Package manager (lock files)
 * - Testing setup
 * - CI/CD configuration
 * - Entry points
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface RepoProfile {
  /** Primary programming language */
  language: string;
  /** Framework (react, hono, express, etc.) */
  framework: string | undefined;
  /** Package manager (npm, pnpm, yarn) */
  packageManager: string;
  /** Whether tests are detected */
  hasTests: boolean;
  /** Whether CI/CD is configured */
  hasCI: boolean;
  /** Test command */
  testCommand: string;
  /** Build command */
  buildCommand: string | undefined;
  /** Main entry point files */
  entryPoints: string[];
  /** Total number of files */
  totalFiles: number;
  /** Total number of directories */
  totalDirs: number;
}

// Language detection by file extension
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  typescript: [/\.(ts|tsx)$/i, /^(tsconfig\.json)$/i],
  javascript: [/\.(js|jsx|cjs|mjs)$/i],
  python: [/\.py$/i, /^(requirements\.txt|pyproject\.toml|setup\.py)$/i],
  go: [/\.go$/i, /^go\.mod$/i],
  rust: [/\.rs$/i, /^Cargo\.toml$/i],
  java: [/\.(java|kt|groovy)$/i, /^(pom\.xml|build\.gradle)$/i],
};

// Framework detection by dependencies
const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  // TypeScript/JavaScript frameworks
  react: [/react/i, /react-dom/i, /next\.js/i, /gatsby/i],
  vue: [/vue/i, /nuxt/i],
  angular: [/@angular\//i],
  svelte: [/svelte/i],
  hono: [/hono/i],
  express: [/express/i],
  nestjs: [/@nestjs\//i],
  fastify: [/fastify/i],
  // Python frameworks
  django: [/django/i],
  flask: [/flask/i],
  fastapi: [/fastapi/i],
  // Go frameworks
  gin: [/gin-gonic/i],
  echo: [/echo/i],
  // Rust frameworks
  actix: [/actix-web/i],
  axum: [/axum/i],
};

// Test detection patterns
const TEST_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /\.test\.(ts|tsx)$/i,
    /\.spec\.(ts|tsx)$/i,
    /vitest/i,
    /jest/i,
  ],
  javascript: [
    /\.test\.(js|jsx)$/i,
    /\.spec\.(js|jsx)$/i,
    /vitest/i,
    /jest/i,
  ],
  python: [/test_.*\.py$/i, /.*_test\.py$/i, /pytest/i, /unittest/i],
  go: [/_test\.go$/i],
  rust: [/\[cfg\(test\)\]/i],
  java: [/.*Test\.java$/i],
};

// Test commands by language
const TEST_COMMANDS: Record<string, string> = {
  typescript: "npx vitest run",
  javascript: "npx vitest run",
  python: "pytest",
  go: "go test ./...",
  rust: "cargo test",
  java: "mvn test",
};

// Build commands by framework
const BUILD_COMMANDS: Record<string, string> = {
  next: "npm run build",
  react: "npm run build",
  vue: "npm run build",
  angular: "npm run build",
  svelte: "npm run build",
  hono: "npm run build",
  vite: "npm run build",
  webpack: "npm run build",
};

// CI/CD configuration files
const CI_PATTERNS = [
  /^\.github\/workflows\/.*\.ya?ml$/i,
  /^\.gitlab-ci\.ya?ml$/i,
  /^\.circleci\/config\.ya?ml$/i,
  /^jenkinsfile$/i,
  /^azure-pipelines\.ya?ml$/i,
  /^\.travis\.ya?ml$/i,
];

// Common entry point patterns
const ENTRY_POINT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^src\/index\.(ts|tsx)$/i,
    /^src\/main\.(ts|tsx)$/i,
    /^server\.(ts|tsx)$/i,
    /^app\.(ts|tsx)$/i,
    /^index\.(ts|tsx)$/i,
  ],
  javascript: [
    /^src\/index\.(js|jsx)$/i,
    /^src\/main\.(js|jsx)$/i,
    /^server\.(js|jsx)$/i,
    /^app\.(js|jsx)$/i,
    /^index\.(js|jsx)$/i,
  ],
  python: [/^src\/__main__\.py$/i, /^main\.py$/i, /^app\.py$/i],
  go: [/^main\.go$/i, /^cmd\/.*\/main\.go$/i],
  rust: [/^src\/main\.rs$/i],
  java: [/^src\/main\/java\/.*\/Main\.java$/i],
};

/**
 * Detects the tech stack profile of a repository
 */
export class RepoDetector {
  constructor(private repoRoot: string) {}

  /**
   * Analyze the repository and return a profile
   */
  async detect(): Promise<RepoProfile> {
    const packageJson = this.readPackageJson();
    const language = this.detectLanguage();
    const framework = this.detectFramework(language, packageJson);
    const packageManager = this.detectPackageManager();
    const hasTests = this.detectTests(language);
    const hasCI = this.detectCI();
    const testCommand = TEST_COMMANDS[language] || "";
    const buildCommand = this.detectBuildCommand(framework, packageJson);
    const entryPoints = this.detectEntryPoints(language);
    const { totalFiles, totalDirs } = this.countFilesAndDirs();

    return {
      language,
      framework,
      packageManager,
      hasTests,
      hasCI,
      testCommand,
      buildCommand,
      entryPoints,
      totalFiles,
      totalDirs,
    };
  }

  /**
   * Read package.json if it exists
   */
  private readPackageJson(): Record<string, unknown> | null {
    const pkgPath = join(this.repoRoot, "package.json");
    if (!existsSync(pkgPath)) return null;

    try {
      const content = readFileSync(pkgPath, "utf8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Detect the primary programming language
   */
  private detectLanguage(): string {
    const scores: Record<string, number> = {};

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      scores[lang] = this.countMatchingFiles(patterns);
    }

    // Return language with highest score
    const maxLang = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return maxLang?.[0] || "javascript";
  }

  /**
   * Count files matching patterns
   */
  private countMatchingFiles(patterns: RegExp[]): number {
    let count = 0;
    for (const pattern of patterns) {
      count += this.countFilesByPattern(pattern);
    }
    return count;
  }

  /**
   * Count files matching a specific pattern
   */
  private countFilesByPattern(pattern: RegExp): number {
    let count = 0;
    this.walkSync(this.repoRoot, (filePath) => {
      const relativePath = filePath.replace(this.repoRoot + "/", "");
      if (pattern.test(relativePath)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Walk directory tree synchronously
   */
  private walkSync(dir: string, callback: (filePath: string) => void): void {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules and other common dirs
      if (
        entry.isDirectory() &&
        !["node_modules", ".git", "dist", "build", "target", "__pycache__"].includes(
          entry.name
        )
      ) {
        this.walkSync(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }

  /**
   * Detect framework from dependencies
   */
  private detectFramework(
    language: string,
    packageJson: Record<string, unknown> | null
  ): string | undefined {
    if (language === "typescript" || language === "javascript") {
      const deps = {
        ...(packageJson?.dependencies as Record<string, string>),
        ...(packageJson?.devDependencies as Record<string, string>),
      };

      for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
        for (const pattern of patterns) {
          for (const depName of Object.keys(deps || {})) {
            if (pattern.test(depName)) {
              return framework;
            }
          }
        }
      }
    }

    // For Python, check for requirements.txt or pyproject.toml
    if (language === "python") {
      const requirementsPath = join(this.repoRoot, "requirements.txt");
      const pyprojectPath = join(this.repoRoot, "pyproject.toml");

      if (existsSync(requirementsPath)) {
        const content = readFileSync(requirementsPath, "utf8");
        for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
          for (const pattern of patterns) {
            if (pattern.test(content)) {
              return framework;
            }
          }
        }
      }

      if (existsSync(pyprojectPath)) {
        const content = readFileSync(pyprojectPath, "utf8");
        for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
          for (const pattern of patterns) {
            if (pattern.test(content)) {
              return framework;
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Detect package manager from lock files
   */
  private detectPackageManager(): string {
    if (existsSync(join(this.repoRoot, "package-lock.json"))) {
      return "npm";
    }
    if (existsSync(join(this.repoRoot, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(this.repoRoot, "yarn.lock"))) {
      return "yarn";
    }
    if (existsSync(join(this.repoRoot, "poetry.lock"))) {
      return "poetry";
    }
    if (existsSync(join(this.repoRoot, "Pipfile.lock"))) {
      return "pipenv";
    }
    if (existsSync(join(this.repoRoot, "go.sum"))) {
      return "go";
    }
    if (existsSync(join(this.repoRoot, "Cargo.lock"))) {
      return "cargo";
    }
    return "npm"; // default
  }

  /**
   * Detect if tests are present
   */
  private detectTests(language: string): boolean {
    const patterns: RegExp[] = TEST_PATTERNS[language] ?? TEST_PATTERNS.typescript;
    return this.countMatchingFiles(patterns) > 0;
  }

  /**
   * Detect CI/CD configuration
   */
  private detectCI(): boolean {
    for (const pattern of CI_PATTERNS) {
      if (this.countFilesByPattern(pattern) > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect build command from framework
   */
  private detectBuildCommand(
    framework: string | undefined,
    packageJson: Record<string, unknown> | null
  ): string | undefined {
    if (!framework) return undefined;

    // Check for framework-specific build commands
    const frameworkCmd = BUILD_COMMANDS[framework];
    if (frameworkCmd) return frameworkCmd;

    // Check package.json scripts
    const scripts = packageJson?.scripts as Record<string, string> | undefined;
    if (scripts?.build) {
      return "npm run build";
    }

    return undefined;
  }

  /**
   * Detect entry point files
   */
  private detectEntryPoints(language: string): string[] {
    const entryPoints: string[] = [];
    const patterns = this.getEntryPointPatterns(language);

    for (const pattern of patterns) {
      this.walkSync(this.repoRoot, (filePath) => {
        const relativePath = filePath.replace(this.repoRoot + "/", "");
        if (pattern.test(relativePath) && !entryPoints.includes(relativePath)) {
          entryPoints.push(relativePath);
        }
      });
    }

    return entryPoints;
  }

  /**
   * Safely get entry point patterns for a language
   */
  private getEntryPointPatterns(language: string): RegExp[] {
    return ENTRY_POINT_PATTERNS[language] || [];
  }

  /**
   * Count total files and directories
   */
  private countFilesAndDirs(): { totalFiles: number; totalDirs: number } {
    let totalFiles = 0;
    let totalDirs = 0;

    this.walkSync(this.repoRoot, (filePath) => {
      try {
        const stat = statSync(filePath);
        if (stat.isFile()) totalFiles++;
        if (stat.isDirectory()) totalDirs++;
      } catch {
        // Ignore errors
      }
    });

    return { totalFiles, totalDirs };
  }
}
