/**
 * Tree Search for Complex Tasks — Types & Interfaces
 *
 * This module defines the core types for the tree search system.
 * Tree search enables multi-approach exploration for complex tasks,
 * where different approaches are tried in parallel and the best
 * result is selected.
 */

/**
 * Possible states for a tree node during search
 */
export type TreeNodeStatus =
  | 'pending'     // Not yet explored
  | 'running'     // Currently being executed
  | 'completed'   // Successfully completed
  | 'failed'      // Failed with errors
  | 'pruned';     // Pruned from search tree

/**
 * A single node in the search tree
 *
 * Each node represents one approach to solving a task or subtask.
 */
export interface TreeNode {
  /** Unique node identifier (UUID) */
  id: string;
  /** Parent node ID (null for root nodes) */
  parentId: string | null;
  /** The task or subtask this node addresses */
  task: string;
  /** Description of the approach being taken */
  approach: string;
  /** Current status of this node */
  status: TreeNodeStatus;
  /** Result of execution (populated when completed/failed) */
  result?: TreeNodeResult;
  /** IDs of child nodes */
  children: string[];
  /** Depth in the search tree (0 = root) */
  depth: number;
  /** Overall score (0-1), higher is better */
  score?: number;
  /** Total tokens used for this node */
  tokensUsed: number;
  /** ISO timestamp when node was created */
  createdAt: string;
  /** ISO timestamp when node completed (undefined if pending/running) */
  completedAt?: string;
}

/**
 * Result of executing a tree node approach
 */
export interface TreeNodeResult {
  /** Whether the approach succeeded */
  success: boolean;
  /** Test pass rate (0-1), 1.0 = all tests pass */
  testPassRate: number;
  /** Code quality score (0-1), based on lint/style/type-check */
  codeQualityScore: number;
  /** Total token cost for this approach */
  tokenCost: number;
  /** Human-readable output summary */
  output: string;
  /** Files that were changed/created */
  filesChanged: string[];
  /** Error messages (empty if success) */
  errors: string[];
}

/**
 * Configuration for tree search execution
 */
export interface TreeSearchConfig {
  /** Maximum number of parallel workers (default: 2) */
  maxWorkers: number;
  /** Maximum depth of search tree (default: 5) */
  maxDepth: number;
  /** Maximum total nodes to explore (default: 21) */
  maxNodes: number;
  /** Weights for scoring criteria */
  evaluationCriteria: {
    /** Weight for test pass rate (0-1) */
    testPassRate: number;
    /** Weight for code quality score (0-1) */
    codeQuality: number;
    /** Weight for token efficiency (0-1) */
    tokenEfficiency: number;
  };
  /** Prune branches with scores below this threshold (0-1) */
  pruningThreshold: number;
  /** Minimum score to consider search "successful" (0-1) */
  successThreshold: number;
  /** Whether to generate sub-approaches for promising nodes */
  enableBranching: boolean;
}

/**
 * Final result of a tree search operation
 */
export interface TreeSearchResult {
  /** The best node found during search */
  bestNode: TreeNode;
  /** All nodes that were explored */
  allNodes: TreeNode[];
  /** Nodes that were pruned during search */
  prunedNodes: TreeNode[];
  /** Total tokens used across all nodes */
  totalTokensUsed: number;
  /** Total search time in milliseconds */
  totalTime: number;
  /** Number of nodes explored */
  nodesExplored: number;
  /** Maximum depth reached */
  maxDepthReached: number;
}

/**
 * Statistics about the current search state
 */
export interface TreeSearchStats {
  /** Total nodes in tree */
  totalNodes: number;
  /** Number of nodes that have been explored (completed/failed) */
  explored: number;
  /** Number of nodes that were pruned */
  pruned: number;
  /** Number of nodes currently running */
  running: number;
  /** Number of nodes pending exploration */
  pending: number;
  /** Best score found so far (0-1, undefined if none completed) */
  bestScore?: number;
  /** ID of the best node (undefined if none completed) */
  bestNodeId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_TREE_SEARCH_CONFIG: TreeSearchConfig = {
  maxWorkers: 2,
  maxDepth: 5,
  maxNodes: 21,
  evaluationCriteria: {
    testPassRate: 0.4,
    codeQuality: 0.3,
    tokenEfficiency: 0.3,
  },
  pruningThreshold: 0.3,
  successThreshold: 0.8,
  enableBranching: true,
};
