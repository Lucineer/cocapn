/**
 * FILE_EDIT handler — write content to a file within the repo and auto-commit.
 *
 * Expects: { type: "FILE_EDIT", id, path, content }
 * Emits:   { type: "FILE_EDIT_RESULT", id, ok, path?, error? }
 *
 * Security: Path is sanitized to prevent escaping the repo root.
 *
 * Post-Edit Hook:
 * - After editing a .ts file, automatically generates test skeleton if needed
 * - Runs the test file and reports results
 */

import { WebSocket } from "ws";
import { writeFileSync, existsSync } from "fs";
import type { TypedHandler, HandlerContext } from "./types.js";
import type { TypedMessage } from "../ws/types.js";
import { sanitizeRepoPath, SanitizationError } from "../utils/path-sanitizer.js";
import { TestGenerator, TestRunner } from "../testing/index.js";

/** FILE_EDIT — write file + auto-commit. Path sandboxed to repo root. */
export const handleFileEdit: TypedHandler = async (
  ws: WebSocket,
  _clientId: string,
  msg: TypedMessage,
  ctx: HandlerContext,
): Promise<void> => {
  const relPath = msg["path"] as string | undefined;
  const content = msg["content"] as string | undefined;

  if (!relPath || content === undefined) {
    ctx.sender.typed(ws, { type: "FILE_EDIT_RESULT", id: msg.id, ok: false, error: "COCAPN-052: Missing path or content - Provide both 'path' and 'content' when editing files" });
    return;
  }

  let absPath: string;
  try {
    absPath = sanitizeRepoPath(relPath, ctx.repoRoot);
  } catch (err) {
    const detail = err instanceof SanitizationError ? err.message : "Invalid path";
    ctx.audit.log({
      action: "file.edit",
      agent: undefined,
      user: undefined,
      command: undefined,
      files: [relPath],
      result: "denied",
      detail,
      durationMs: undefined,
    });
    ctx.sender.typed(ws, { type: "FILE_EDIT_RESULT", id: msg.id, ok: false, error: detail });
    return;
  }

  const finish = ctx.audit.start({
    action: "file.edit",
    agent: undefined,
    user: undefined,
    command: undefined,
    files: [relPath],
  });

  try {
    writeFileSync(absPath, content, "utf8");
    const filename = relPath.split("/").pop() ?? relPath;
    await ctx.sync.commitFile(filename);
    finish("ok");
    ctx.sender.typed(ws, { type: "FILE_EDIT_RESULT", id: msg.id, ok: true, path: relPath });

    // Post-edit hook: Generate and run tests for .ts files
    if (absPath.endsWith(".ts")) {
      await handlePostEditTesting(absPath, ctx, ws);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finish("error", message);
    ctx.sender.typed(ws, {
      type: "FILE_EDIT_RESULT",
      id: msg.id,
      ok: false,
      error: message,
    });
  }
};

/**
 * Post-edit test generation and execution.
 * - Generates test skeleton if no test file exists
 * - Runs the test file and reports results
 */
async function handlePostEditTesting(
  sourcePath: string,
  ctx: HandlerContext,
  ws: WebSocket
): Promise<void> {
  try {
    const testGenerator = new TestGenerator(ctx.repoRoot);
    const testRunner = new TestRunner(ctx.repoRoot);

    // Check if test file exists
    const existingTestFile = testGenerator.findTestFile(sourcePath);

    if (!existingTestFile) {
      // No test file exists — generate skeleton
      const generated = await testGenerator.generateTests({
        filePath: sourcePath,
        changeDescription: "File edited",
      });

      // Save the generated test file
      // Note: We use the test file path from the generator
      // but don't commit it yet — let the user review first
      ctx.sender.typed(ws, {
        type: "TEST_STATUS",
        id: `test-gen-${Date.now()}`,
        status: "generated",
        testFile: generated.testFilePath,
        message: "Test skeleton generated — please review and implement tests",
      });
    } else {
      // Test file exists — run it
      const results = await testRunner.runTestFile(existingTestFile);

      // Log results in token tracker if available
      if (ctx.tokenTracker) {
        ctx.tokenTracker.addTestRun({
          file: existingTestFile,
          passed: results.passed,
          failed: results.failed,
          total: results.total,
          duration: results.duration,
        });
      }

      // Report results
      if (results.failed > 0) {
        ctx.sender.typed(ws, {
          type: "TEST_STATUS",
          id: `test-run-${Date.now()}`,
          status: "failed",
          testFile: existingTestFile,
          results: {
            passed: results.passed,
            failed: results.failed,
            total: results.total,
            failures: results.failures,
          },
          message: `Tests failed: ${results.failed}/${results.total}`,
        });
      } else {
        ctx.sender.typed(ws, {
          type: "TEST_STATUS",
          id: `test-run-${Date.now()}`,
          status: "passed",
          testFile: existingTestFile,
          results: {
            passed: results.passed,
            failed: results.failed,
            total: results.total,
            failures: [],
          },
          message: `All tests passed: ${results.passed}/${results.total}`,
        });
      }
    }
  } catch (err) {
    // Don't fail the file edit if test generation fails
    const message = err instanceof Error ? err.message : String(err);
    ctx.sender.typed(ws, {
      type: "TEST_STATUS",
      id: `test-error-${Date.now()}`,
      status: "error",
      message: `Test generation failed: ${message}`,
    });
  }
}
