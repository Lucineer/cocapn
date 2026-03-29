/**
 * Tests for ApproachGenerator
 */

import { describe, it, expect } from 'vitest';
import { ApproachGenerator } from '../../src/tree-search/approach-generator.js';

describe('ApproachGenerator', () => {
  describe('generateApproaches', () => {
    it('should generate approaches for test tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Write tests for auth module', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches[0]).toContain('test');
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should generate approaches for refactor tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Refactor the handler code', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches.some(a => a.includes('refactor') || a.includes('Extract'))).toBe(true);
    });

    it('should generate approaches for bug fix tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Fix the authentication bug', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches.some(a => a.includes('fix') || a.includes('bug'))).toBe(true);
    });

    it('should generate approaches for feature tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Add user profile feature', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches.some(a => a.includes('implement') || a.includes('feature'))).toBe(true);
    });

    it('should generate approaches for optimization tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Optimize database queries', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches.some(a => a.includes('optimize') || a.includes('Optimize'))).toBe(true);
    });

    it('should generate approaches for documentation tasks', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Document the API', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches.some(a => a.includes('document') || a.includes('docs'))).toBe(true);
    });

    it('should generate generic approaches for unknown task types', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Do something with the code', 3);

      expect(result.approaches).toHaveLength(3);
      expect(result.approaches).toContain('Solve the task directly');
    });

    it('should respect maxApproaches option', async () => {
      const generator = new ApproachGenerator({ maxApproaches: 2 });
      const result = await generator.generateApproaches('Write tests', 5);

      expect(result.approaches).toHaveLength(2);
    });

    it('should use mock response when set', async () => {
      const generator = new ApproachGenerator();
      generator.setMockResponse({
        approaches: ['Mock approach 1', 'Mock approach 2'],
        tokensUsed: 100,
      });

      const result = await generator.generateApproaches('Any task', 3);

      expect(result.approaches).toEqual(['Mock approach 1', 'Mock approach 2']);
      expect(result.tokensUsed).toBe(100);
    });

    it('should clear mock response after use', async () => {
      const generator = new ApproachGenerator();
      generator.setMockResponse({
        approaches: ['Mock approach'],
        tokensUsed: 100,
      });

      // First call uses mock
      const result1 = await generator.generateApproaches('Task 1', 1);
      expect(result1.approaches).toEqual(['Mock approach']);

      // Second call uses heuristic generation
      const result2 = await generator.generateApproaches('Write tests', 2);
      expect(result2.approaches).not.toEqual(['Mock approach']);
    });

    it('should include context in token estimation', async () => {
      const generator = new ApproachGenerator();
      const result1 = await generator.generateApproaches('Task', 1);
      const result2 = await generator.generateApproaches('Task', 1, 'Additional context about the task');

      expect(result2.tokensUsed).toBeGreaterThan(result1.tokensUsed);
    });

    it('should limit returned approaches to count parameter', async () => {
      const generator = new ApproachGenerator();
      const result = await generator.generateApproaches('Write tests', 1);

      expect(result.approaches).toHaveLength(1);
    });
  });
});
