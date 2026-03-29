/**
 * Tree Search for Complex Tasks — Main Orchestrator
 *
 * This module ties together the experiment manager, approach generator,
 * and executor to provide a complete tree search system for complex tasks.
 *
 * The tree search explores multiple approaches in parallel, evaluates them,
 * and returns the best result.
 */

import { ExperimentManager } from './manager.js';
import { ApproachGenerator } from './approach-generator.js';
import { TreeSearchExecutor } from './executor.js';
import type {
  TreeSearchConfig,
  TreeSearchResult,
  TreeNode,
  TreeNodeResult,
} from './types.js';

/**
 * Tree Search Orchestrator — coordinates the entire search process
 *
 * This class is responsible for:
 * - Generating initial approaches for a task
 * - Managing the search tree via ExperimentManager
 * - Executing approaches via TreeSearchExecutor
 * - Evaluating and pruning branches
 * - Returning the best result
 *
 * Flow:
 * 1. Generate 2-3 approaches
 * 2. Create tree with initial branches
 * 3. While not complete:
 *    a. Pick best node to explore (best-first)
 *    b. Execute approach
 *    c. Evaluate result
 *    d. Prune low-scoring branches
 *    e. Branch if promising (generate sub-approaches)
 * 4. Return best result
 */
export class TreeSearch {
  private manager: ExperimentManager;
  private generator: ApproachGenerator;
  private executor: TreeSearchExecutor;
  private repoRoot: string;

  constructor(repoRoot: string, config?: Partial<TreeSearchConfig>) {
    this.repoRoot = repoRoot;
    this.manager = new ExperimentManager(config);
    this.generator = new ApproachGenerator();
    this.executor = new TreeSearchExecutor({ repoRoot });
  }

  /**
   * Run a tree search for the given task
   *
   * @param task - The task to solve
   * @param options - Optional configuration overrides
   * @returns Promise resolving to the search result
   */
  async search(
    task: string,
    options?: Partial<TreeSearchConfig>
  ): Promise<TreeSearchResult> {
    const startTime = Date.now();

    // Generate initial approaches
    const initialResult = await this.generator.generateApproaches(task, 3);
    const approaches = initialResult.approaches;

    // Create root node and initial branches
    this.manager.createRoot(task, 'Root task');
    const rootNode = this.manager.getAllNodes()[0];
    this.manager.branchApproaches(rootNode.id, approaches);

    let totalTokensUsed = initialResult.tokensUsed;
    let maxDepthReached = 0;

    // Main search loop
    while (!this.manager.isComplete()) {
      // Get next node to explore
      const node = this.manager.getNextToExplore();
      if (!node) {
        break; // No more nodes to explore
      }

      // Mark as running
      this.manager.markRunning(node.id);

      // Track max depth
      if (node.depth > maxDepthReached) {
        maxDepthReached = node.depth;
      }

      // Execute the approach
      const result = await this.executor.executeApproach(
        task,
        node.approach,
        this.repoRoot
      );

      totalTokensUsed += result.tokenCost;

      // Evaluate the result
      this.manager.evaluate(node.id, result);

      // Prune low-scoring branches
      this.manager.prune();

      // Generate sub-approaches if enabled and node is promising
      const config = this.manager.getConfig();
      if (config.enableBranching && result.success && (node.score || 0) > config.pruningThreshold) {
        try {
          const subResult = await this.generator.generateApproaches(
            task,
            2,
            `Parent approach: ${node.approach}`
          );
          totalTokensUsed += subResult.tokensUsed;

          this.manager.branchApproaches(node.id, subResult.approaches);
        } catch (error) {
          // Branching failed (e.g., max depth reached) - continue search
          // This is expected behavior, not an error
        }
      }
    }

    // Get best result
    let bestNode = this.manager.getBestResult();
    if (!bestNode) {
      // No successful result - get the last failed node
      const failedNodes = this.manager.getNodesByStatus('failed');
      if (failedNodes.length > 0) {
        bestNode = failedNodes[0];
      } else {
        throw new Error('Search completed but no results found');
      }
    }

    // Compile final result
    const allNodes = this.manager.getAllNodes();
    const prunedNodes = this.manager.getNodesByStatus('pruned');
    const endTime = Date.now();

    const searchResult: TreeSearchResult = {
      bestNode,
      allNodes,
      prunedNodes,
      totalTokensUsed,
      totalTime: endTime - startTime,
      nodesExplored: this.manager.stats().explored,
      maxDepthReached,
    };

    return searchResult;
  }

  /**
   * Get current search statistics
   *
   * @returns Current search statistics
   */
  getStats() {
    return this.manager.stats();
  }

  /**
   * Set a mock approach generator response (for testing)
   *
   * @param response - Mock response to return
   */
  setMockGeneratorResponse(response: { approaches: string[]; tokensUsed: number }): void {
    this.generator.setMockResponse(response);
  }

  /**
   * Set a mock executor result (for testing)
   *
   * @param result - Mock result to return
   */
  setMockExecutorResult(result: TreeNodeResult): void {
    this.executor.setMockResult({ result });
  }

  /**
   * Reset the search state
   */
  reset(): void {
    this.manager.reset();
  }
}

// Export all types and classes
export * from './types.js';
export { ExperimentManager } from './manager.js';
export { ApproachGenerator } from './approach-generator.js';
export { TreeSearchExecutor } from './executor.js';
