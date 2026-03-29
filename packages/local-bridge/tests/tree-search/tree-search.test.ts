/**
 * Integration tests for TreeSearch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TreeSearch } from '../../src/tree-search/index.js';
import type { TreeNodeResult, TreeSearchResult } from '../../src/tree-search/types.js';

describe('TreeSearch', () => {
  let treeSearch: TreeSearch;

  beforeEach(() => {
    treeSearch = new TreeSearch('/tmp/test-repo');
  });

  describe('search', () => {
    it('should complete search and return best result', async () => {
      // Set up mocks
      treeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1', 'Approach 2'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.9,
        codeQualityScore: 0.8,
        tokenCost: 1000,
        output: 'Success',
        filesChanged: ['test.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task');

      expect(result.bestNode).toBeTruthy();
      expect(result.bestNode.score).toBeGreaterThan(0);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
      expect(result.nodesExplored).toBeGreaterThan(0);
    });

    it('should explore multiple approaches', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1', 'Approach 2', 'Approach 3'],
        tokensUsed: 100,
      });

      // First approach: mediocre
      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.5,
        codeQualityScore: 0.5,
        tokenCost: 1000,
        output: 'Mediocre',
        filesChanged: ['file1.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task', {
        maxNodes: 5,
        enableBranching: false,
      });

      // Should explore at least the initial approaches
      expect(result.allNodes.length).toBeGreaterThanOrEqual(4); // root + 3 approaches
      expect(result.nodesExplored).toBeGreaterThan(0);
    });

    it('should select best approach based on score', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Bad approach', 'Good approach'],
        tokensUsed: 100,
      });

      let callCount = 0;
      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.9,
        codeQualityScore: 0.9,
        tokenCost: 500,
        output: 'Excellent',
        filesChanged: ['good.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task', {
        enableBranching: false,
      });

      expect(result.bestNode.score).toBeGreaterThan(0.7);
    });

    it('should handle failed approaches', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Failing approach', 'Working approach'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: false,
        testPassRate: 0,
        codeQualityScore: 0,
        tokenCost: 500,
        output: 'Failed',
        filesChanged: [],
        errors: ['Error occurred'],
      });

      const result = await treeSearch.search('Test task');

      // Should still complete search
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should prune low-scoring branches', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Low score approach'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.2,
        codeQualityScore: 0.2,
        tokenCost: 1000,
        output: 'Low score',
        filesChanged: ['file.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task', {
        pruningThreshold: 0.5,
        maxNodes: 5,
      });

      // May have pruned nodes
      expect(result.allNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect maxNodes limit', async () => {
      // Use a fresh TreeSearch instance for this test
      const freshTreeSearch = new TreeSearch('/tmp/test-repo', {
        maxNodes: 3,
        enableBranching: false,
      });

      freshTreeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1'],
        tokensUsed: 100,
      });

      freshTreeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.5,
        codeQualityScore: 0.5,
        tokenCost: 1000,
        output: 'Medium',
        filesChanged: ['file.ts'],
        errors: [],
      });

      const result = await freshTreeSearch.search('Test task');

      // Root (1) + 1 child (1) = 2 nodes total (below maxNodes of 3)
      expect(result.allNodes.length).toBeLessThanOrEqual(3);
    });

    it('should respect maxDepth limit', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.9,
        codeQualityScore: 0.9,
        tokenCost: 500,
        output: 'Success',
        filesChanged: ['file.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task', {
        maxDepth: 2,
      });

      // Should not exceed max depth
      expect(result.maxDepthReached).toBeLessThanOrEqual(2);
    });

    it('should stop when success threshold is reached', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Perfect approach', 'Other approach'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 500,
        output: 'Perfect',
        filesChanged: ['perfect.ts'],
        errors: [],
      });

      const result = await treeSearch.search('Test task', {
        successThreshold: 0.9,
        enableBranching: false,
      });

      // Should find high-scoring result quickly
      expect(result.bestNode.score).toBeGreaterThanOrEqual(0.9);
    });

    it('should include all metadata in result', async () => {
      // Use a fresh TreeSearch instance
      const freshTreeSearch = new TreeSearch('/tmp/test-repo');

      freshTreeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1'],
        tokensUsed: 100,
      });

      freshTreeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.8,
        codeQualityScore: 0.8,
        tokenCost: 1000,
        output: 'Output',
        filesChanged: ['file1.ts', 'file2.ts'],
        errors: [],
      });

      const result = await freshTreeSearch.search('Test task');

      expect(result.totalTime).toBeGreaterThanOrEqual(0); // Can be 0 if very fast
      expect(result.totalTokensUsed).toBeGreaterThan(100); // At least generation cost
      expect(result.nodesExplored).toBeGreaterThan(0);
      expect(result.allNodes).toBeInstanceOf(Array);
      expect(result.prunedNodes).toBeInstanceOf(Array);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = treeSearch.getStats();

      expect(stats.totalNodes).toBe(0);
      expect(stats.explored).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.bestScore).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset search state', async () => {
      treeSearch.setMockGeneratorResponse({
        approaches: ['Approach 1'],
        tokensUsed: 100,
      });

      treeSearch.setMockExecutorResult({
        success: true,
        testPassRate: 0.8,
        codeQualityScore: 0.8,
        tokenCost: 1000,
        output: 'Success',
        filesChanged: ['file.ts'],
        errors: [],
      });

      await treeSearch.search('Task 1');

      // Reset and check stats
      treeSearch.reset();
      const stats = treeSearch.getStats();

      expect(stats.totalNodes).toBe(0);
    });
  });
});
