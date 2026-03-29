/**
 * Test Runner — runs vitest tests and parses results.
 *
 * Can run:
 * - Individual test files
 * - Full test suite
 *
 * Parses vitest JSON output to extract pass/fail counts and failure details.
 */

import { spawn } from "child_process";

export interface TestRunResult {
  testFile: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  failures: Array<{ name: string; error: string }>;
}

export interface AllTestsResult {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  files: Array<{
    file: string;
    passed: number;
    failed: number;
    total: number;
    duration: number;
    failures: Array<{ name: string; error: string }>;
  }>;
}

/**
 * Test Runner class
 */
export class TestRunner {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Run tests for a single file.
   */
  async runTestFile(testFile: string): Promise<TestRunResult> {
    const relativePath = testFile.replace(this.repoRoot, "").replace(/^\//, "");

    return new Promise((resolve) => {
      const vitest = spawn("npx", ["vitest", "run", relativePath, "--reporter=json"], {
        cwd: this.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      vitest.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      vitest.on("close", (code) => {
        const result = this.parseVitestOutput(stdout, stderr, testFile);
        resolve(result);
      });

      vitest.on("error", (err) => {
        resolve({
          testFile,
          passed: 0,
          failed: 1,
          total: 1,
          duration: 0,
          failures: [{
            name: "vitest-spawn-error",
            error: err.message,
          }],
        });
      });
    });
  }

  /**
   * Run all tests in the repo.
   */
  async runAllTests(): Promise<AllTestsResult> {
    return new Promise((resolve) => {
      const vitest = spawn("npx", ["vitest", "run", "--reporter=json"], {
        cwd: this.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      vitest.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      vitest.on("close", (code) => {
        const result = this.parseAllTestsOutput(stdout, stderr);
        resolve(result);
      });

      vitest.on("error", (err) => {
        resolve({
          passed: 0,
          failed: 1,
          total: 1,
          duration: 0,
          files: [{
            file: "all",
            passed: 0,
            failed: 1,
            total: 1,
            duration: 0,
            failures: [{
              name: "vitest-spawn-error",
              error: err.message,
            }],
          }],
        });
      });
    });
  }

  /**
   * Parse vitest JSON output for a single test file.
   */
  private parseVitestOutput(stdout: string, stderr: string, testFile: string): TestRunResult {
    try {
      // Try to parse JSON output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return this.extractTestResult(data, testFile);
      }

      // Fallback: parse text output
      return this.parseTextOutput(stdout, testFile);
    } catch (err) {
      return {
        testFile,
        passed: 0,
        failed: 1,
        total: 1,
        duration: 0,
        failures: [{
          name: "parse-error",
          error: err instanceof Error ? err.message : String(err),
        }],
      };
    }
  }

  /**
   * Parse vitest JSON output for all tests.
   */
  private parseAllTestsOutput(stdout: string, stderr: string): AllTestsResult {
    try {
      // Try to parse JSON output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return this.extractAllTestsResult(data);
      }

      // Fallback: parse text output
      return this.parseAllTextOutput(stdout);
    } catch (err) {
      return {
        passed: 0,
        failed: 1,
        total: 1,
        duration: 0,
        files: [{
          file: "all",
          passed: 0,
          failed: 1,
          total: 1,
          duration: 0,
          failures: [{
            name: "parse-error",
            error: err instanceof Error ? err.message : String(err),
          }],
        }],
      };
    }
  }

  /**
   * Extract test result from vitest JSON data.
   */
  private extractTestResult(data: any, testFile: string): TestRunResult {
    const failures: Array<{ name: string; error: string }> = [];

    let passed = 0;
    let failed = 0;

    if (data.testResults && Array.isArray(data.testResults)) {
      for (const result of data.testResults) {
        if (result.status === "passed") {
          passed++;
        } else if (result.status === "failed") {
          failed++;
          failures.push({
            name: result.name || result.fullName || "unknown",
            error: result.failureMessages?.join("\n") || "Unknown error",
          });
        }
      }
    }

    return {
      testFile,
      passed,
      failed,
      total: passed + failed,
      duration: 0, // Duration not available in all formats
      failures,
    };
  }

  /**
   * Extract all tests result from vitest JSON data.
   */
  private extractAllTestsResult(data: any): AllTestsResult {
    const files: Array<{
      file: string;
      passed: number;
      failed: number;
      total: number;
      duration: number;
      failures: Array<{ name: string; error: string }>;
    }> = [];

    let totalPassed = 0;
    let totalFailed = 0;

    if (data.testResults && Array.isArray(data.testResults)) {
      for (const fileResult of data.testResults) {
        const filePassed = (fileResult.assertionResults || []).filter(
          (r: any) => r.status === "passed"
        ).length;
        const fileFailed = (fileResult.assertionResults || []).filter(
          (r: any) => r.status === "failed"
        ).length;

        const failures: Array<{ name: string; error: string }> = [];
        for (const result of fileResult.assertionResults || []) {
          if (result.status === "failed") {
            failures.push({
              name: result.fullName || result.name || "unknown",
              error: result.failureMessages?.join("\n") || "Unknown error",
            });
          }
        }

        files.push({
          file: fileResult.name || "unknown",
          passed: filePassed,
          failed: fileFailed,
          total: filePassed + fileFailed,
          duration: 0,
          failures,
        });

        totalPassed += filePassed;
        totalFailed += fileFailed;
      }
    }

    return {
      passed: totalPassed,
      failed: totalFailed,
      total: totalPassed + totalFailed,
      duration: 0,
      files,
    };
  }

  /**
   * Fallback: parse vitest text output for a single file.
   */
  private parseTextOutput(stdout: string, testFile: string): TestRunResult {
    const passed = (stdout.match(/✓/g) || []).length;
    const failed = (stdout.match(/✗/g) || []).length;

    const failures: Array<{ name: string; error: string }> = [];

    // Extract error messages
    const errorMatches = stdout.matchAll(/FAIL\s+(.+?)\n([\s\S]+?)(?=\n\n|\nPASS|$)/g);
    for (const match of errorMatches) {
      failures.push({
        name: match[1] || "unknown",
        error: match[2]?.trim() || "Unknown error",
      });
    }

    return {
      testFile,
      passed,
      failed,
      total: passed + failed,
      duration: 0,
      failures,
    };
  }

  /**
   * Fallback: parse vitest text output for all tests.
   */
  private parseAllTextOutput(stdout: string): AllTestsResult {
    const passed = (stdout.match(/✓/g) || []).length;
    const failed = (stdout.match(/✗/g) || []).length;

    return {
      passed,
      failed,
      total: passed + failed,
      duration: 0,
      files: [{
        file: "all",
        passed,
        failed,
        total: passed + failed,
        duration: 0,
        failures: [],
      }],
    };
  }
}
