/**
 * Tests for TestRunner
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TestRunner } from "../../src/testing/index.js";
import { spawn } from "child_process";

// Mock spawn to avoid actually running vitest in tests
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("TestRunner", () => {
  const repoRoot = "/tmp/test-cocapn";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runTestFile", () => {
    it("should run a single test file and parse results", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              // Simulate JSON output from vitest
              handler(JSON.stringify({
                testResults: [
                  { status: "passed", name: "should pass" },
                  { status: "failed", name: "should fail", failureMessages: ["Error: Expected true to be false"] },
                ],
              }));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(0); // Exit code 0
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runTestFile("tests/example.test.ts");

      expect(result.testFile).toBe("tests/example.test.ts");
      expect(result.total).toBeGreaterThan(0);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["vitest", "run", "tests/example.test.ts", "--reporter=json"],
        expect.objectContaining({
          cwd: repoRoot,
        })
      );
    });

    it("should handle spawn errors gracefully", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, handler) => {
          if (event === "error") {
            handler(new Error("spawn failed"));
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runTestFile("tests/example.test.ts");

      expect(result.failed).toBe(1);
      expect(result.total).toBe(1);
      expect(result.failures[0].name).toBe("vitest-spawn-error");
    });

    it("should parse text output when JSON is not available", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              // Simulate text output from vitest
              handler("✓ src/example.test.ts (2)\n  ✓ should pass (1)\n  ✗ should fail (1)\n");
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(1); // Exit code 1 (some tests failed)
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runTestFile("tests/example.test.ts");

      expect(result.testFile).toBe("tests/example.test.ts");
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe("runAllTests", () => {
    it("should run all tests and aggregate results", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              // Simulate JSON output from vitest
              handler(JSON.stringify({
                testResults: [
                  {
                    name: "tests/foo.test.ts",
                    assertionResults: [
                      { status: "passed", fullName: "foo should pass" },
                      { status: "passed", fullName: "foo should pass again" },
                    ],
                  },
                  {
                    name: "tests/bar.test.ts",
                    assertionResults: [
                      { status: "passed", fullName: "bar should pass" },
                      { status: "failed", fullName: "bar should fail", failureMessages: ["Error: Expected X"] },
                    ],
                  },
                ],
              }));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(1); // Exit code 1 (some tests failed)
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runAllTests();

      expect(result.total).toBe(4);
      expect(result.passed).toBe(3);
      expect(result.failed).toBe(1);
      expect(result.files.length).toBe(2);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["vitest", "run", "--reporter=json"],
        expect.objectContaining({
          cwd: repoRoot,
        })
      );
    });

    it("should handle empty test results", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              handler("");
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(0);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runAllTests();

      expect(result.total).toBe(0);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should handle spawn errors for all tests", async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, handler) => {
          if (event === "error") {
            handler(new Error("vitest not found"));
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runAllTests();

      expect(result.failed).toBe(1);
      expect(result.total).toBe(1);
      expect(result.files[0].failures[0].name).toBe("vitest-spawn-error");
    });
  });

  describe("result parsing", () => {
    it("should extract failure details from test results", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              handler(JSON.stringify({
                testResults: [
                  {
                    status: "failed",
                    name: "should handle errors",
                    fullName: "should handle errors",
                    failureMessages: [
                      "Error: Expected 42 to be 24",
                      "  at test.ts:10:15",
                    ],
                  },
                ],
              }));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(1);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runTestFile("tests/failing.test.ts");

      expect(result.failed).toBe(1);
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].name).toBe("should handle errors");
      expect(result.failures[0].error).toContain("Expected 42 to be 24");
    });

    it("should handle multiple test files", async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === "data") {
              handler(JSON.stringify({
                testResults: [
                  {
                    name: "tests/a.test.ts",
                    assertionResults: [
                      { status: "passed", fullName: "a test 1" },
                      { status: "passed", fullName: "a test 2" },
                    ],
                  },
                  {
                    name: "tests/b.test.ts",
                    assertionResults: [
                      { status: "passed", fullName: "b test 1" },
                    ],
                  },
                  {
                    name: "tests/c.test.ts",
                    assertionResults: [
                      { status: "failed", fullName: "c test 1", failureMessages: ["Error"] },
                    ],
                  },
                ],
              }));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === "close") {
            handler(1);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const runner = new TestRunner(repoRoot);
      const result = await runner.runAllTests();

      expect(result.files.length).toBe(3);
      expect(result.files[0].file).toBe("tests/a.test.ts");
      expect(result.files[0].passed).toBe(2);
      expect(result.files[2].failed).toBe(1);
    });
  });
});
