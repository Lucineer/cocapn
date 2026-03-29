/**
 * Tests for Tree Search A/B Testing Framework
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ABTestRunner,
  createABTestTask,
  createMockResult,
  type ABTestTask,
  type ABTestResult,
} from '../../src/tree-search/ab-test.js';

describe('ABTestRunner', () => {
  let runner: ABTestRunner;
  let mockBrain: any;

  beforeEach(() => {
    // Create a mock Brain
    mockBrain = {
      setFact: vi.fn().mockResolvedValue(undefined),
    };

    runner = new ABTestRunner({
      brain: mockBrain,
      storeResults: false, // Don't actually store in tests
    });
  });

  describe('createABTestTask', () => {
    it('should create a task with required fields', () => {
      const task = createABTestTask(
        'Add a new feature',
        '/tmp/repo',
        ['src/index.ts']
      );

      expect(task.id).toBeDefined();
      expect(task.description).toBe('Add a new feature');
      expect(task.repoRoot).toBe('/tmp/repo');
      expect(task.files).toEqual(['src/index.ts']);
      expect(task.expectedOutcome).toBe('Task completed successfully');
      expect(task.complexity).toBeUndefined();
    });

    it('should create a task with optional fields', () => {
      const task = createABTestTask(
        'Add a new feature',
        '/tmp/repo',
        ['src/index.ts'],
        'Feature works and tests pass',
        'complex'
      );

      expect(task.expectedOutcome).toBe('Feature works and tests pass');
      expect(task.complexity).toBe('complex');
    });
  });

  describe('createMockResult', () => {
    it('should create a mock successful result', () => {
      const result = createMockResult('single', true, 5000, 10000);

      expect(result.taskId).toBe('mock-task');
      expect(result.approach).toBe('single');
      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(5000);
      expect(result.duration).toBe(10000);
      expect(result.testPassRate).toBe(1.0);
      expect(result.codeQualityScore).toBe(0.8);
      expect(result.reworkNeeded).toBe(false);
      expect(result.errors).toEqual([]);
    });

    it('should create a mock failed result', () => {
      const result = createMockResult('tree', false, 10000, 20000);

      expect(result.success).toBe(false);
      expect(result.reworkNeeded).toBe(true);
      expect(result.errors).toEqual(['Mock failure']);
    });

    it('should create a mock with custom quality scores', () => {
      const result = createMockResult('single', true, 5000, 10000, 0.9, 0.7);

      expect(result.testPassRate).toBe(0.9);
      expect(result.codeQualityScore).toBe(0.7);
      expect(result.reworkNeeded).toBe(true); // testPassRate < 1.0
    });
  });

  describe('runSingle', () => {
    it('should return mock result when set', async () => {
      const mockResult = createMockResult('single', true, 5000, 10000);
      runner.setMockSingleResult(mockResult);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const result = await runner.runSingle(task);

      expect(result.taskId).toBe(task.id);
      expect(result.approach).toBe('single');
      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(5000);
      expect(result.duration).toBe(10000);
    });

    it('should use mock result only once', async () => {
      const mockResult = createMockResult('single', true, 5000, 10000);
      runner.setMockSingleResult(mockResult);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const result1 = await runner.runSingle(task);
      const result2 = await runner.runSingle(task);

      // First call uses mock
      expect(result1.tokensUsed).toBe(5000);

      // Second call should not use mock (would normally execute, but we'll get a different result structure)
      // Since we don't have a real executor, it will create a failure result
      expect(result2.success).toBe(false);
    });
  });

  describe('runTree', () => {
    it('should return mock result when set', async () => {
      const mockResult = createMockResult('tree', true, 12000, 30000);
      runner.setMockTreeResult(mockResult);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const result = await runner.runTree(task);

      expect(result.taskId).toBe(task.id);
      expect(result.approach).toBe('tree');
      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(12000);
      expect(result.duration).toBe(30000);
    });
  });

  describe('compare', () => {
    it('should compare single and tree results', async () => {
      const singleMock = createMockResult('single', true, 5000, 10000);
      const treeMock = createMockResult('tree', true, 12000, 30000);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      expect(summary.taskId).toBe(task.id);
      expect(summary.singleResult.approach).toBe('single');
      expect(summary.treeResult.approach).toBe('tree');
      expect(summary.singleAdvantage.length).toBeGreaterThan(0);
      expect(summary.singleAdvantage.some(a => a.metric === 'tokens')).toBe(true);
      expect(summary.singleAdvantage.some(a => a.metric === 'speed')).toBe(true);
    });

    it('should determine winner based on quality', async () => {
      // Single is faster/cheaper but tree is better quality
      const singleMock = createMockResult('single', true, 5000, 10000, 0.7, 0.6);
      const treeMock = createMockResult('tree', true, 12000, 30000, 0.95, 0.9);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      expect(summary.winner).toBe('tree');
      expect(summary.treeAdvantage.some(a => a.metric === 'quality')).toBe(true);
    });

    it('should declare single winner when tree fails', async () => {
      const singleMock = createMockResult('single', true, 5000, 10000);
      const treeMock = createMockResult('tree', false, 12000, 30000);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      expect(summary.winner).toBe('single');
      expect(summary.singleAdvantage.some(a => a.metric === 'success')).toBe(true);
    });

    it('should declare tree winner when single fails', async () => {
      const singleMock = createMockResult('single', false, 5000, 10000);
      const treeMock = createMockResult('tree', true, 12000, 30000);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      expect(summary.winner).toBe('tree');
      expect(summary.treeAdvantage.some(a => a.metric === 'success')).toBe(true);
    });

    it('should declare tie when quality difference is small', async () => {
      const singleMock = createMockResult('single', true, 5000, 10000, 0.8, 0.75);
      const treeMock = createMockResult('tree', true, 12000, 30000, 0.82, 0.77);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      expect(summary.winner).toBe('tie');
    });

    it('should calculate score difference correctly', async () => {
      const singleMock = createMockResult('single', true, 5000, 10000, 0.7, 0.6);
      const treeMock = createMockResult('tree', true, 12000, 30000, 0.95, 0.9);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      // Quality score: 0.6 * testPassRate + 0.4 * codeQualityScore
      const singleScore = 0.6 * 0.7 + 0.4 * 0.6; // 0.42 + 0.24 = 0.66
      const treeScore = 0.6 * 0.95 + 0.4 * 0.9; // 0.57 + 0.36 = 0.93
      const expectedDiff = ((treeScore - singleScore) / singleScore) * 100;

      expect(summary.scoreDifference).toBeCloseTo(expectedDiff, 1);
    });
  });

  describe('runBatch', () => {
    it('should run multiple tasks and return summaries', async () => {
      const tasks = [
        createABTestTask('Task 1', '/tmp/repo', []),
        createABTestTask('Task 2', '/tmp/repo', []),
        createABTestTask('Task 3', '/tmp/repo', []),
      ];

      // Set up mocks for each task
      runner.setMockSingleResult(createMockResult('single', true, 5000, 10000));
      runner.setMockTreeResult(createMockResult('tree', true, 12000, 30000));
      runner.setMockSingleResult(createMockResult('single', true, 5000, 10000));
      runner.setMockTreeResult(createMockResult('tree', true, 12000, 30000));
      runner.setMockSingleResult(createMockResult('single', true, 5000, 10000));
      runner.setMockTreeResult(createMockResult('tree', true, 12000, 30000));

      const results = await runner.runBatch(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].taskId).toBe(tasks[0].id);
      expect(results[1].taskId).toBe(tasks[1].id);
      expect(results[2].taskId).toBe(tasks[2].id);
    });

    it('should handle errors gracefully', async () => {
      const tasks = [
        createABTestTask('Task 1', '/tmp/repo', []),
        createABTestTask('Task 2', '/tmp/repo', []),
      ];

      // Only set mocks for first task
      runner.setMockSingleResult(createMockResult('single', true, 5000, 10000));
      runner.setMockTreeResult(createMockResult('tree', true, 12000, 30000));

      const results = await runner.runBatch(tasks);

      expect(results).toHaveLength(2);
      // First result should be valid
      expect(results[0].singleResult.success).toBe(true);
      // Second result should have errors
      expect(results[1].singleResult.success).toBe(false);
      expect(results[1].singleResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('aggregate', () => {
    it('should aggregate results correctly', () => {
      const results = [
        {
          taskId: '1',
          description: 'Task 1',
          singleResult: createMockResult('single', true, 5000, 10000, 0.8, 0.7),
          treeResult: createMockResult('tree', true, 12000, 30000, 0.9, 0.8),
          winner: 'tree' as const,
          singleAdvantage: [{ metric: 'tokens', value: 58.3, description: 'Single used 58.3% fewer tokens' }],
          treeAdvantage: [{ metric: 'quality', value: 15.4, description: 'Tree quality was 15.4% better' }],
          scoreDifference: 15.4,
        },
        {
          taskId: '2',
          description: 'Task 2',
          singleResult: createMockResult('single', true, 4500, 9000, 0.85, 0.75),
          treeResult: createMockResult('tree', true, 11000, 28000, 0.88, 0.82),
          winner: 'single' as const,
          singleAdvantage: [{ metric: 'tokens', value: 59.1, description: 'Single used 59.1% fewer tokens' }],
          treeAdvantage: [],
          scoreDifference: 5.3,
        },
        {
          taskId: '3',
          description: 'Task 3',
          singleResult: createMockResult('single', true, 6000, 12000, 0.75, 0.65),
          treeResult: createMockResult('tree', true, 13000, 32000, 0.92, 0.85),
          winner: 'tree' as const,
          singleAdvantage: [{ metric: 'tokens', value: 53.8, description: 'Single used 53.8% fewer tokens' }],
          treeAdvantage: [{ metric: 'quality', value: 20.0, description: 'Tree quality was 20.0% better' }],
          scoreDifference: 20.0,
        },
      ];

      const aggregate = runner.aggregate(results);

      expect(aggregate.totalTasks).toBe(3);
      expect(aggregate.singleWins).toBe(1);
      expect(aggregate.treeWins).toBe(2);
      expect(aggregate.ties).toBe(0);
      expect(aggregate.singleWinRate).toBeCloseTo(0.333, 2);
      expect(aggregate.treeWinRate).toBeCloseTo(0.667, 2);
      expect(aggregate.tieRate).toBe(0);

      // Check averages
      expect(aggregate.avgSingleTokens).toBeCloseTo((5000 + 4500 + 6000) / 3, 0);
      expect(aggregate.avgTreeTokens).toBeCloseTo((12000 + 11000 + 13000) / 3, 0);

      // Token difference should be negative (tree uses more)
      expect(aggregate.avgTokenDifference).toBeLessThan(0);

      // Duration difference should be negative (tree is slower)
      expect(aggregate.avgDurationDifference).toBeLessThan(0);

      // Quality difference should be positive (tree is better)
      expect(aggregate.avgCodeQualityDifference).toBeGreaterThan(0);

      expect(aggregate.conclusions.length).toBeGreaterThan(0);
    });

    it('should generate appropriate conclusions for single-dominated results', () => {
      const results = Array(10).fill(null).map((_, i) => ({
        taskId: String(i),
        description: `Task ${i}`,
        singleResult: createMockResult('single', true, 5000, 10000),
        treeResult: createMockResult('tree', true, 12000, 30000),
        winner: 'single' as const,
        singleAdvantage: [{ metric: 'tokens', value: 58.3, description: 'Single used fewer tokens' }],
        treeAdvantage: [],
        scoreDifference: -5,
      }));

      const aggregate = runner.aggregate(results);

      expect(aggregate.singleWins).toBe(10);
      expect(aggregate.singleWinRate).toBe(1.0);

      const hasSinglePreference = aggregate.conclusions.some(c =>
        c.toLowerCase().includes('single') && c.toLowerCase().includes('prefer')
      );
      expect(hasSinglePreference).toBe(true);
    });

    it('should generate appropriate conclusions for tree-dominated results', () => {
      const results = Array(10).fill(null).map((_, i) => ({
        taskId: String(i),
        description: `Task ${i}`,
        singleResult: createMockResult('single', true, 5000, 10000, 0.7, 0.6),
        treeResult: createMockResult('tree', true, 12000, 30000, 0.95, 0.9),
        winner: 'tree' as const,
        singleAdvantage: [],
        treeAdvantage: [{ metric: 'quality', value: 30, description: 'Tree quality was much better' }],
        scoreDifference: 30,
      }));

      const aggregate = runner.aggregate(results);

      expect(aggregate.treeWins).toBe(10);
      expect(aggregate.treeWinRate).toBe(1.0);

      const hasTreePreference = aggregate.conclusions.some(c =>
        c.toLowerCase().includes('tree') && (c.toLowerCase().includes('prefer') || c.toLowerCase().includes('use'))
      );
      expect(hasTreePreference).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate a markdown report', () => {
      const aggregate = {
        totalTasks: 10,
        singleWins: 6,
        treeWins: 3,
        ties: 1,
        singleWinRate: 0.6,
        treeWinRate: 0.3,
        tieRate: 0.1,
        avgSingleTokens: 5200,
        avgTreeTokens: 12100,
        avgTokenDifference: -132.7,
        avgSingleDuration: 15000,
        avgTreeDuration: 45000,
        avgDurationDifference: -200.0,
        avgSingleTestPassRate: 0.72,
        avgTreeTestPassRate: 0.81,
        avgTestPassRateDifference: 12.5,
        avgSingleCodeQuality: 0.75,
        avgTreeCodeQuality: 0.85,
        avgCodeQualityDifference: 13.3,
        singleSuccessRate: 0.8,
        treeSuccessRate: 0.9,
        conclusions: [
          'Tree search improves code quality by 13% - use for critical tasks',
          'Tree search uses 133% more tokens - use selectively',
        ],
      };

      const report = runner.generateReport(aggregate);

      expect(report).toContain('# Tree Search A/B Test Results');
      expect(report).toContain('**Tasks:** 10');
      expect(report).toContain('**Single-path wins:** 6 (60%)');
      expect(report).toContain('**Tree search wins:** 3 (30%)');
      expect(report).toContain('## Performance Metrics');
      expect(report).toContain('### Tokens');
      expect(report).toContain('5,200');
      expect(report).toContain('12,100');
      expect(report).toContain('## Conclusions');
      expect(report).toContain('## Recommendation');
    });

    it('should recommend tree search when it dominates', () => {
      const aggregate = {
        totalTasks: 10,
        singleWins: 2,
        treeWins: 8,
        ties: 0,
        singleWinRate: 0.2,
        treeWinRate: 0.8,
        tieRate: 0,
        avgSingleTokens: 5200,
        avgTreeTokens: 12100,
        avgTokenDifference: -132.7,
        avgSingleDuration: 15000,
        avgTreeDuration: 45000,
        avgDurationDifference: -200.0,
        avgSingleTestPassRate: 0.72,
        avgTreeTestPassRate: 0.81,
        avgTestPassRateDifference: 12.5,
        avgSingleCodeQuality: 0.75,
        avgTreeCodeQuality: 0.85,
        avgCodeQualityDifference: 13.3,
        singleSuccessRate: 0.8,
        treeSuccessRate: 0.9,
        conclusions: ['Tree search wins 80% of the time'],
      };

      const report = runner.generateReport(aggregate);

      expect(report).toContain('**Use tree search**');
    });

    it('should recommend single-path when it dominates', () => {
      const aggregate = {
        totalTasks: 10,
        singleWins: 8,
        treeWins: 2,
        ties: 0,
        singleWinRate: 0.8,
        treeWinRate: 0.2,
        tieRate: 0,
        avgSingleTokens: 5200,
        avgTreeTokens: 12100,
        avgTokenDifference: -132.7,
        avgSingleDuration: 15000,
        avgTreeDuration: 45000,
        avgDurationDifference: -200.0,
        avgSingleTestPassRate: 0.8,
        avgTreeTestPassRate: 0.82,
        avgTestPassRateDifference: 2.5,
        avgSingleCodeQuality: 0.8,
        avgTreeCodeQuality: 0.82,
        avgCodeQualityDifference: 2.5,
        singleSuccessRate: 0.9,
        treeSuccessRate: 0.9,
        conclusions: ['Single-path wins 80% of the time'],
      };

      const report = runner.generateReport(aggregate);

      expect(report).toContain('**Prefer single-path execution**');
    });

    it('should give nuanced recommendation when close', () => {
      const aggregate = {
        totalTasks: 10,
        singleWins: 4,
        treeWins: 4,
        ties: 2,
        singleWinRate: 0.4,
        treeWinRate: 0.4,
        tieRate: 0.2,
        avgSingleTokens: 5200,
        avgTreeTokens: 12100,
        avgTokenDifference: -132.7,
        avgSingleDuration: 15000,
        avgTreeDuration: 45000,
        avgDurationDifference: -200.0,
        avgSingleTestPassRate: 0.78,
        avgTreeTestPassRate: 0.82,
        avgTestPassRateDifference: 5.1,
        avgSingleCodeQuality: 0.78,
        avgTreeCodeQuality: 0.82,
        avgCodeQualityDifference: 5.1,
        singleSuccessRate: 0.85,
        treeSuccessRate: 0.9,
        conclusions: ['No clear winner'],
      };

      const report = runner.generateReport(aggregate);

      expect(report).toContain('No clear winner');
      expect(report).toContain('- **Simple tasks:** Use single-path');
      expect(report).toContain('- **Complex tasks:** Use tree search');
    });
  });

  describe('clearMocks', () => {
    it('should clear all mock results', async () => {
      runner.setMockSingleResult(createMockResult('single', true, 5000, 10000));
      runner.setMockTreeResult(createMockResult('tree', true, 12000, 30000));

      runner.clearMocks();

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const result = await runner.runSingle(task);

      // Should not use mock (will fail since we don't have a real executor)
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero token results', async () => {
      const singleMock = createMockResult('single', true, 0, 10000);
      const treeMock = createMockResult('tree', true, 0, 30000);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      // Should not divide by zero
      expect(summary.singleAdvantage.every(a => a.metric !== 'tokens')).toBe(true);
      expect(summary.treeAdvantage.every(a => a.metric !== 'tokens')).toBe(true);
    });

    it('should handle zero duration results', async () => {
      const singleMock = createMockResult('single', true, 5000, 0);
      const treeMock = createMockResult('tree', true, 12000, 0);

      runner.setMockSingleResult(singleMock);
      runner.setMockTreeResult(treeMock);

      const task = createABTestTask('Test task', '/tmp/repo', []);
      const summary = await runner.compare(task);

      // Should not divide by zero
      expect(summary.singleAdvantage.every(a => a.metric !== 'speed')).toBe(true);
      expect(summary.treeAdvantage.every(a => a.metric !== 'speed')).toBe(true);
    });

    it('should handle empty results array in aggregate', () => {
      const aggregate = runner.aggregate([]);

      expect(aggregate.totalTasks).toBe(0);
      expect(aggregate.singleWins).toBe(0);
      expect(aggregate.treeWins).toBe(0);
      expect(aggregate.singleWinRate).toBe(0);
      expect(aggregate.avgSingleTokens).toBe(0);
    });

    it('should handle all failed results in aggregate', () => {
      const results = [
        {
          taskId: '1',
          description: 'Task 1',
          singleResult: createMockResult('single', false, 5000, 10000),
          treeResult: createMockResult('tree', false, 12000, 30000),
          winner: 'tie' as const,
          singleAdvantage: [],
          treeAdvantage: [],
          scoreDifference: 0,
        },
      ];

      const aggregate = runner.aggregate(results);

      expect(aggregate.singleSuccessRate).toBe(0);
      expect(aggregate.treeSuccessRate).toBe(0);
      expect(aggregate.avgSingleTestPassRate).toBe(0);
      expect(aggregate.avgTreeTestPassRate).toBe(0);
    });
  });
});
