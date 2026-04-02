/**
 * Tree Search for Complex Tasks — Types & Interfaces
 *
 * This module defines the core types for the tree search system.
 * Tree search enables multi-approach exploration for complex tasks,
 * where different approaches are tried in parallel and the best
 * result is selected.
 */
/**
 * Default configuration values
 */
export const DEFAULT_TREE_SEARCH_CONFIG = {
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
//# sourceMappingURL=types.js.map