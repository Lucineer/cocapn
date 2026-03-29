/**
 * Tree Search Executor Tests
 *
 * Tests for the TreeSearchExecutor class, which executes approaches
 * by spawning Claude Code and parsing results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TreeSearchExecutor } from '../../src/tree-search/executor.js';
import type { TreeNodeResult } from '../../src/tree-search/types.js';

// Mock child_process
const mockExec = vi.fn();
vi.mock('node:child_process', () => ({
  exec: vi.fn((...args) => mockExec(...args)),
}));

describe('TreeSearchExecutor', () => {
  let executor: TreeSearchExecutor;

  beforeEach(() => {
    executor = new TreeSearchExecutor();
    mockExec.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const exec = new TreeSearchExecutor();
      expect(exec).toBeDefined();
    });

    it('should accept custom options', () => {
      const exec = new TreeSearchExecutor({
        claudePath: '/custom/path/claude',
        model: 'claude-opus-4-6',
        timeout: 600000,
        maxTurns: 50,
      });
      expect(exec).toBeDefined();
    });
  });

  describe('executeApproach', () => {
    it('should execute approach and parse successful test results', async () => {
      const mockStdout = `
Running tests...

Test Files  1 passed (1)
     Tests  196 passed (196)
Start at 06:27:32

All tests passed!
      `;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        // git diff returns no changes
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach(
        'Implement feature X',
        'Use recursion to solve',
        '/tmp/repo'
      );

      expect(result.success).toBe(true);
      expect(result.testPassRate).toBe(1.0);
      expect(result.codeQualityScore).toBeGreaterThan(0.5);
      expect(result.filesChanged).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should parse test results with failures', async () => {
      const mockStdout = `
Running tests...

Test Files  1 failed (1)
     Tests  189 passed (196)
     Tests  7 failed (7)

FAIL tests/age-encryption.test.ts
      `;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach(
        'Implement feature Y',
        'Use iteration to solve',
        '/tmp/repo'
      );

      expect(result.success).toBe(true); // 7 failures is allowed for ARM64
      // The executor matches "196 passed" and "7 failed"
      // So pass rate = (196 - 7) / 196 = 189/196
      expect(result.testPassRate).toBeGreaterThan(0.95);
      expect(result.codeQualityScore).toBeGreaterThan(0);
    });

    it('should detect changed files via git diff', async () => {
      const mockStdout = 'Tests passed\n';
      const mockGitDiff = 'src/file1.ts\nsrc/file2.ts\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockGitDiff, stderr: '' });
      });

      const result = await executor.executeApproach(
        'Refactor code',
        'Extract functions',
        '/tmp/repo'
      );

      expect(result.filesChanged).toEqual(['src/file1.ts', 'src/file2.ts']);
    });

    it('should handle execution timeout', async () => {
      const timeoutError = new Error('Command timed out');
      timeoutError.killed = true;
      timeoutError.signal = 'SIGTERM';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(timeoutError, null);
      });

      const result = await executor.executeApproach(
        'Long task',
        'Slow approach',
        '/tmp/repo'
      );

      expect(result.success).toBe(false);
      expect(result.testPassRate).toBe(0);
      expect(result.errors).toContain('Command timed out');
    });

    it('should handle Claude Code not found', async () => {
      const notFoundError = new Error('spawn claude ENOENT');
      notFoundError.code = 'ENOENT';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(notFoundError, null);
      });

      const result = await executor.executeApproach(
        'Task',
        'Approach',
        '/tmp/repo'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('spawn claude ENOENT');
    });

    it('should include context in prompt when provided', async () => {
      const mockStdout = 'Tests passed\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        // Verify context is in the prompt
        expect(command).toContain('Context: Use TypeScript strict mode');
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await executor.executeApproach(
        'Task',
        'Approach',
        '/tmp/repo',
        'Use TypeScript strict mode'
      );
    });

    it('should estimate token cost from output length', async () => {
      const longOutput = 'x'.repeat(10000); // ~2500 tokens

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: longOutput, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach(
        'Task',
        'Approach',
        '/tmp/repo'
      );

      expect(result.tokenCost).toBe(2500);
    });

    it('should handle git diff errors gracefully', async () => {
      const mockStdout = 'Tests passed\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        // Git diff fails (not in git repo)
        callback(new Error('not a git repository'), null);
      });

      const result = await executor.executeApproach(
        'Task',
        'Approach',
        '/tmp/not-a-repo'
      );

      expect(result.filesChanged).toEqual([]);
      expect(result.success).toBe(true);
    });
  });

  describe('setMockResult', () => {
    it('should return mock result when set', async () => {
      const mockResult: TreeNodeResult = {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 0.9,
        tokenCost: 5000,
        output: 'Mock output',
        filesChanged: ['src/test.ts'],
        errors: [],
      };

      executor.setMockResult({ result: mockResult });

      const result = await executor.executeApproach(
        'Task',
        'Approach',
        '/tmp/repo'
      );

      expect(result).toEqual(mockResult);
      expect(mockExec).not.toHaveBeenCalled(); // Should not call exec
    });

    it('should clear mock result after use', async () => {
      const mockResult: TreeNodeResult = {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 0.9,
        tokenCost: 5000,
        output: 'Mock output',
        filesChanged: [],
        errors: [],
      };

      executor.setMockResult({ result: mockResult });

      // First call uses mock
      const result1 = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result1).toEqual(mockResult);

      // Set up mock for second call
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: 'Tests passed\n', stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      // Second call should not use mock (will call exec instead)
      const result2 = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result2).not.toEqual(mockResult);
      expect(result2.success).toBe(true);
    });
  });

  describe('code quality estimation', () => {
    it('should give higher score for passing tests', async () => {
      const mockStdout = '196 passed\nAll tests passed\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.codeQualityScore).toBeGreaterThan(0.6);
    });

    it('should give higher score for commits', async () => {
      const mockStdout = 'Tests passed\ncommitted changes\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.codeQualityScore).toBeGreaterThan(0.6);
    });

    it('should not penalize ARM64 test failures', async () => {
      const mockStdout = `
189 passed
7 failed
FAIL tests/age-encryption.test.ts
ARM64 platform issue
      `;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.codeQualityScore).toBeGreaterThan(0.5);
    });

    it('should give minimal score for empty output', async () => {
      const mockStdout = '';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      // Empty output gets base score of 0.5 + 0.1 (no FAIL) = 0.6
      expect(result.codeQualityScore).toBe(0.6);
    });

    it('should cap quality score at 1.0', async () => {
      const mockStdout = `
passed
committed
196 passed
ARM64 compatible
${'x'.repeat(1000)}
      `;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.codeQualityScore).toBeLessThanOrEqual(1.0);
    });
  });

  describe('custom executor options', () => {
    it('should use custom claude path', async () => {
      const customExec = new TreeSearchExecutor({
        claudePath: '/usr/local/bin/claude-custom',
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        expect(command).toContain('/usr/local/bin/claude-custom');
        callback(null, { stdout: 'Tests passed\n', stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await customExec.executeApproach('Task', 'Approach', '/tmp/repo');
    });

    it('should use custom model', async () => {
      const customExec = new TreeSearchExecutor({
        model: 'claude-opus-4-6',
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        expect(command).toContain('--model claude-opus-4-6');
        callback(null, { stdout: 'Tests passed\n', stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await customExec.executeApproach('Task', 'Approach', '/tmp/repo');
    });

    it('should use custom max turns', async () => {
      const customExec = new TreeSearchExecutor({
        maxTurns: 100,
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        expect(command).toContain('--max-turns 100');
        callback(null, { stdout: 'Tests passed\n', stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await customExec.executeApproach('Task', 'Approach', '/tmp/repo');
    });

    it('should use custom timeout', async () => {
      const customExec = new TreeSearchExecutor({
        timeout: 120000, // 2 minutes
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        expect(options.timeout).toBe(120000);
        callback(null, { stdout: 'Tests passed\n', stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await customExec.executeApproach('Task', 'Approach', '/tmp/repo');
    });
  });

  describe('error handling', () => {
    it('should handle stderr output', async () => {
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: 'Tests passed\n', stderr: 'Warning: deprecated API\n' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.errors).toContain('Warning: deprecated API\n');
    });

    it('should handle errors with stdout', async () => {
      const error = new Error('Execution failed') as any;
      error.stdout = 'Partial output before error\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(error, null);
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Partial output before error');
    });

    it('should handle errors without stdout', async () => {
      const error = new Error('Execution failed');

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(error, null);
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Execution failed');
    });
  });

  describe('test result parsing', () => {
    it('should handle no test results', async () => {
      const mockStdout = 'Code written, no tests run\n';

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      expect(result.testPassRate).toBe(0.5); // Default when no tests found
    });

    it('should parse various test output formats', async () => {
      const mockStdout = `
150 passed
5 failed
      `;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const result = await executor.executeApproach('Task', 'Approach', '/tmp/repo');
      // 150 total, 5 failed = 145/150 = 0.967
      expect(result.testPassRate).toBeCloseTo(145 / 150, 2);
    });
  });
});
