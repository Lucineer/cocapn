/**
 * Testing module — autonomous test generation and execution.
 *
 * Provides:
 * - TestGenerator: generates test skeletons for TypeScript files
 * - TestRunner: runs vitest tests and parses results
 *
 * This module is used by the FILE_EDIT handler to automatically generate
 * and run tests after code changes.
 */
export { TestGenerator } from "./generator.js";
export { TestRunner } from "./runner.js";
//# sourceMappingURL=index.js.map