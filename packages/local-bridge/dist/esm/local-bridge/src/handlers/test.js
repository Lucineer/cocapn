/**
 * Test handlers — WebSocket handlers for test generation and execution.
 *
 * Provides:
 * - RUN_TESTS: Run tests for a specific file or all tests
 * - GENERATE_TESTS: Generate test skeleton for a file
 * - TEST_STATUS: Get last test run results
 */
import { TestGenerator, TestRunner } from "../testing/index.js";
import { sanitizeRepoPath } from "../utils/path-sanitizer.js";
// Store last test run result globally (in production, use a proper state manager)
let lastTestRunResult = null;
/**
 * RUN_TESTS handler — run tests for a specific file or all tests.
 *
 * Expects: { type: "RUN_TESTS", id, file? }
 * Emits:   { type: "TEST_STATUS", id, status, testFile?, results?, message? }
 */
export const handleRunTests = async (ws, _clientId, msg, ctx) => {
    const file = msg["file"];
    const testRunner = new TestRunner(ctx.repoRoot);
    try {
        if (file) {
            // Run tests for a specific file
            const absPath = sanitizeRepoPath(file, ctx.repoRoot);
            const result = await testRunner.runTestFile(absPath);
            lastTestRunResult = {
                testFile: result.testFile,
                passed: result.passed,
                failed: result.failed,
                total: result.total,
                timestamp: new Date().toISOString(),
            };
            // Log in token tracker
            if (ctx.tokenTracker) {
                ctx.tokenTracker.addTestRun({
                    file: result.testFile,
                    passed: result.passed,
                    failed: result.failed,
                    total: result.total,
                    duration: result.duration,
                });
            }
            ctx.sender.typed(ws, {
                type: "TEST_STATUS",
                id: msg.id,
                status: result.failed > 0 ? "failed" : "passed",
                testFile: result.testFile,
                results: {
                    passed: result.passed,
                    failed: result.failed,
                    total: result.total,
                    failures: result.failures,
                },
                message: result.failed > 0
                    ? `Tests failed: ${result.failed}/${result.total}`
                    : `All tests passed: ${result.passed}/${result.total}`,
            });
        }
        else {
            // Run all tests
            const result = await testRunner.runAllTests();
            const totalPassed = result.passed;
            const totalFailed = result.failed;
            const total = result.total;
            // Log in token tracker
            if (ctx.tokenTracker) {
                ctx.tokenTracker.addTestRun({
                    file: "all",
                    passed: totalPassed,
                    failed: totalFailed,
                    total: total,
                    duration: result.duration,
                });
            }
            ctx.sender.typed(ws, {
                type: "TEST_STATUS",
                id: msg.id,
                status: totalFailed > 0 ? "failed" : "passed",
                testFile: "all",
                results: {
                    passed: totalPassed,
                    failed: totalFailed,
                    total: total,
                    failures: result.files.flatMap((f) => f.failures),
                },
                message: totalFailed > 0
                    ? `Tests failed: ${totalFailed}/${total}`
                    : `All tests passed: ${totalPassed}/${total}`,
            });
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "error",
            message: `Failed to run tests: ${message}`,
        });
    }
};
/**
 * GENERATE_TESTS handler — generate test skeleton for a file.
 *
 * Expects: { type: "GENERATE_TESTS", id, file }
 * Emits:   { type: "TEST_STATUS", id, status, testFile?, message? }
 */
export const handleGenerateTests = async (ws, _clientId, msg, ctx) => {
    const file = msg["file"];
    if (!file) {
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "error",
            message: "Missing file parameter",
        });
        return;
    }
    try {
        const absPath = sanitizeRepoPath(file, ctx.repoRoot);
        const testGenerator = new TestGenerator(ctx.repoRoot);
        const generated = await testGenerator.generateTests({
            filePath: absPath,
            changeDescription: "Manual test generation request",
        });
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "generated",
            testFile: generated.testFilePath,
            message: "Test skeleton generated — please review and implement tests",
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "error",
            message: `Failed to generate tests: ${message}`,
        });
    }
};
/**
 * TEST_STATUS handler — get last test run results.
 *
 * Expects: { type: "TEST_STATUS", id }
 * Emits:   { type: "TEST_STATUS", id, status, result? }
 */
export const handleTestStatus = async (ws, _clientId, msg, ctx) => {
    if (lastTestRunResult) {
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "ok",
            result: lastTestRunResult,
        });
    }
    else {
        ctx.sender.typed(ws, {
            type: "TEST_STATUS",
            id: msg.id,
            status: "not_found",
            message: "No test run results available",
        });
    }
};
//# sourceMappingURL=test.js.map