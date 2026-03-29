/**
 * Tests for ExperimentManager
 */

import { describe, it, expect } from 'vitest';
import { ExperimentManager } from '../../src/tree-search/manager.js';
import type { TreeNodeResult } from '../../src/tree-search/types.js';

describe('ExperimentManager', () => {
  describe('createRoot', () => {
    it('should create a root node with default approach', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      expect(root.id).toBeTruthy();
      expect(root.task).toBe('Test task');
      expect(root.approach).toBe('Solve directly');
      expect(root.parentId).toBeNull();
      expect(root.depth).toBe(0);
      expect(root.status).toBe('pending');
      expect(root.children).toEqual([]);
      expect(root.tokensUsed).toBe(0);
    });

    it('should create a root node with custom approach', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task', 'Custom approach');

      expect(root.approach).toBe('Custom approach');
    });

    it('should add root node to tree', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      expect(manager.getAllNodes()).toHaveLength(1);
      expect(manager.getNode(root.id)).toEqual(root);
    });
  });

  describe('branchApproaches', () => {
    it('should create child nodes from approaches', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      const approaches = ['Approach 1', 'Approach 2'];
      const children = manager.branchApproaches(root.id, approaches);

      expect(children).toHaveLength(2);
      expect(children[0].approach).toBe('Approach 1');
      expect(children[1].approach).toBe('Approach 2');
      expect(children[0].parentId).toBe(root.id);
      expect(children[0].depth).toBe(1);
    });

    it('should add children to parent', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      const approaches = ['Approach 1', 'Approach 2'];
      manager.branchApproaches(root.id, approaches);

      const updatedRoot = manager.getNode(root.id);
      expect(updatedRoot?.children).toHaveLength(2);
    });

    it('should throw if parent node not found', () => {
      const manager = new ExperimentManager();
      expect(() => {
        manager.branchApproaches('nonexistent', ['Approach 1']);
      }).toThrow('Parent node not found');
    });

    it('should throw if max depth reached', () => {
      const manager = new ExperimentManager({ maxDepth: 2 });
      const root = manager.createRoot('Test task');
      const child1 = manager.branchApproaches(root.id, ['Approach 1'])[0];
      const child2 = manager.branchApproaches(child1.id, ['Approach 2'])[0];

      expect(() => {
        manager.branchApproaches(child2.id, ['Approach 3']);
      }).toThrow('Maximum depth');
    });

    it('should throw if max nodes reached', () => {
      const manager = new ExperimentManager({ maxNodes: 3 });
      const root = manager.createRoot('Test task'); // 1 node
      manager.branchApproaches(root.id, ['Approach 1', 'Approach 2']); // +2 = 3 nodes

      // Adding another node should fail (would exceed maxNodes)
      expect(() => {
        manager.branchApproaches(root.id, ['Approach 3']);
      }).toThrow('Maximum nodes');
    });
  });

  describe('getNextToExplore', () => {
    it('should return null if no pending nodes', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      // Mark root as completed
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 1000,
        output: 'Done',
        filesChanged: [],
        errors: [],
      });

      expect(manager.getNextToExplore()).toBeNull();
    });

    it('should return pending node', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      manager.branchApproaches(root.id, ['Approach 1', 'Approach 2']);

      const next = manager.getNextToExplore();
      expect(next).toBeTruthy();
      expect(next?.status).toBe('pending');
    });

    it('should prioritize shallow nodes over deep nodes', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      const child1 = manager.branchApproaches(root.id, ['Approach 1', 'Approach 2'])[0];
      const grandchild = manager.branchApproaches(child1.id, ['Deep approach'])[0];

      // Mark root as completed so children are considered
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 100,
        output: 'Root done',
        filesChanged: [],
        errors: [],
      });

      const next = manager.getNextToExplore();
      // Should prefer the other child at depth 1 over the grandchild at depth 2
      expect(next?.depth).toBe(1);
    });
  });

  describe('evaluate', () => {
    it('should mark node as completed on success', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      const result: TreeNodeResult = {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 0.9,
        tokenCost: 1000,
        output: 'Success',
        filesChanged: ['test.ts'],
        errors: [],
      };

      manager.evaluate(root.id, result);

      const updated = manager.getNode(root.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.result).toEqual(result);
      expect(updated?.tokensUsed).toBe(1000);
    });

    it('should mark node as failed on failure', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      const result: TreeNodeResult = {
        success: false,
        testPassRate: 0.0,
        codeQualityScore: 0.0,
        tokenCost: 500,
        output: 'Failed',
        filesChanged: [],
        errors: ['Error occurred'],
      };

      manager.evaluate(root.id, result);

      const updated = manager.getNode(root.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.score).toBe(0);
    });

    it('should calculate score for successful node', () => {
      const manager = new ExperimentManager({
        evaluationCriteria: {
          testPassRate: 0.5,
          codeQuality: 0.3,
          tokenEfficiency: 0.2,
        },
      });
      const root = manager.createRoot('Test task');

      const result: TreeNodeResult = {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 0.8,
        tokenCost: 1000,
        output: 'Success',
        filesChanged: [],
        errors: [],
      };

      manager.evaluate(root.id, result);

      const updated = manager.getNode(root.id);
      // Score = 1.0 * 0.5 + 0.8 * 0.3 + 0.99 * 0.2 ≈ 0.896
      expect(updated?.score).toBeGreaterThan(0.8);
      expect(updated?.score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('prune', () => {
    it('should prune pending nodes below threshold', () => {
      const manager = new ExperimentManager({
        pruningThreshold: 0.5,
      });
      const root = manager.createRoot('Test task');
      const child1 = manager.branchApproaches(root.id, ['Approach 1'])[0];
      const child2 = manager.branchApproaches(root.id, ['Approach 2'])[0];

      // Mark root with low score (below 0.3 threshold)
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 0.2,
        codeQualityScore: 0.2,
        tokenCost: 1000,
        output: 'Low score',
        filesChanged: [],
        errors: [],
      });

      const pruned = manager.prune();

      // Children should be pruned
      expect(pruned.length).toBe(2);
      expect(pruned).toContain(child1.id);
      expect(pruned).toContain(child2.id);

      const updatedChild1 = manager.getNode(child1.id);
      expect(updatedChild1?.status).toBe('pruned');
    });

    it('should not prune nodes above threshold', () => {
      const manager = new ExperimentManager({
        pruningThreshold: 0.5,
      });
      const root = manager.createRoot('Test task');
      manager.branchApproaches(root.id, ['Approach 1', 'Approach 2']);

      // Mark root with high score
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 0.9,
        codeQualityScore: 0.9,
        tokenCost: 1000,
        output: 'High score',
        filesChanged: [],
        errors: [],
      });

      const pruned = manager.prune();

      // No nodes should be pruned
      expect(pruned).toHaveLength(0);
    });
  });

  describe('getBestResult', () => {
    it('should return null if no completed nodes', () => {
      const manager = new ExperimentManager();
      manager.createRoot('Test task');

      expect(manager.getBestResult()).toBeNull();
    });

    it('should return the node with highest score', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      const child1 = manager.branchApproaches(root.id, ['Approach 1'])[0];
      const child2 = manager.branchApproaches(root.id, ['Approach 2'])[0];

      // Mark child1 with lower score
      manager.evaluate(child1.id, {
        success: true,
        testPassRate: 0.5,
        codeQualityScore: 0.5,
        tokenCost: 1000,
        output: 'Mediocre',
        filesChanged: [],
        errors: [],
      });

      // Mark child2 with higher score
      manager.evaluate(child2.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 1000,
        output: 'Excellent',
        filesChanged: [],
        errors: [],
      });

      const best = manager.getBestResult();
      expect(best?.id).toBe(child2.id);
    });
  });

  describe('isComplete', () => {
    it('should return true if no pending nodes', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      manager.evaluate(root.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 1000,
        output: 'Done',
        filesChanged: [],
        errors: [],
      });

      expect(manager.isComplete()).toBe(true);
    });

    it('should return true if success threshold exceeded', () => {
      const manager = new ExperimentManager({
        successThreshold: 0.8,
      });
      const root = manager.createRoot('Test task');
      manager.branchApproaches(root.id, ['Approach 1']);

      // Mark root with high score
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 1000,
        output: 'Success',
        filesChanged: [],
        errors: [],
      });

      expect(manager.isComplete()).toBe(true);
    });

    it('should return false if pending nodes exist and threshold not met', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      manager.branchApproaches(root.id, ['Approach 1']);

      expect(manager.isComplete()).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return correct statistics', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');
      const child1 = manager.branchApproaches(root.id, ['Approach 1', 'Approach 2'])[0];
      const child2 = manager.branchApproaches(root.id, ['Approach 3'])[0];

      // Mark root as completed
      manager.evaluate(root.id, {
        success: true,
        testPassRate: 1.0,
        codeQualityScore: 1.0,
        tokenCost: 1000,
        output: 'Done',
        filesChanged: [],
        errors: [],
      });

      // Mark child1 as failed
      manager.evaluate(child1.id, {
        success: false,
        testPassRate: 0.0,
        codeQualityScore: 0.0,
        tokenCost: 500,
        output: 'Failed',
        filesChanged: [],
        errors: ['Error'],
      });

      const stats = manager.stats();

      expect(stats.totalNodes).toBe(4); // root + 3 children
      expect(stats.explored).toBe(2); // root + child1
      expect(stats.pending).toBe(2); // child2 + Approach 2
      expect(stats.bestScore).toBeGreaterThan(0);
    });
  });

  describe('markRunning', () => {
    it('should mark node as running', () => {
      const manager = new ExperimentManager();
      const root = manager.createRoot('Test task');

      manager.markRunning(root.id);

      const updated = manager.getNode(root.id);
      expect(updated?.status).toBe('running');
    });
  });

  describe('reset', () => {
    it('should clear all nodes', () => {
      const manager = new ExperimentManager();
      manager.createRoot('Test task');
      manager.branchApproaches(manager.getAllNodes()[0].id, ['Approach 1']);

      manager.reset();

      expect(manager.getAllNodes()).toHaveLength(0);
    });
  });
});
