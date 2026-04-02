/**
 * Tree Search Experiment Manager
 *
 * The ExperimentManager doesn't do work — it directs work. It manages
 * the search tree, decides which branches to explore, evaluates results,
 * and prunes low-performing branches.
 */
import { DEFAULT_TREE_SEARCH_CONFIG } from './types.js';
/**
 * ExperimentManager — manages the search tree and exploration strategy
 *
 * This class is responsible for:
 * - Creating and managing tree nodes
 * - Selecting the next node to explore (best-first strategy)
 * - Evaluating completed nodes and calculating scores
 * - Pruning low-scoring branches
 * - Tracking search statistics
 */
export class ExperimentManager {
    tree;
    config;
    nodeCounter = 0;
    constructor(config) {
        this.tree = new Map();
        this.config = { ...DEFAULT_TREE_SEARCH_CONFIG, ...config };
    }
    /**
     * Create a root node for the initial task
     *
     * @param task - The task to solve
     * @param approach - Description of the approach (optional, defaults to "Solve directly")
     * @returns The created root node
     */
    createRoot(task, approach = 'Solve directly') {
        const nodeId = this.generateNodeId();
        const node = {
            id: nodeId,
            parentId: null,
            task,
            approach,
            status: 'pending',
            children: [],
            depth: 0,
            tokensUsed: 0,
            createdAt: new Date().toISOString(),
        };
        this.tree.set(nodeId, node);
        return node;
    }
    /**
     * Create multiple child nodes with different approaches
     *
     * @param parentId - ID of the parent node
     * @param approaches - Array of approach descriptions
     * @returns Array of created child nodes
     */
    branchApproaches(parentId, approaches) {
        const parent = this.tree.get(parentId);
        if (!parent) {
            throw new Error(`Parent node not found: ${parentId}`);
        }
        // Check depth limit
        if (parent.depth >= this.config.maxDepth) {
            throw new Error(`Maximum depth ${this.config.maxDepth} reached`);
        }
        // Check node limit
        if (this.tree.size >= this.config.maxNodes) {
            throw new Error(`Maximum nodes ${this.config.maxNodes} reached`);
        }
        const newNodes = [];
        for (const approach of approaches) {
            const nodeId = this.generateNodeId();
            const node = {
                id: nodeId,
                parentId,
                task: parent.task, // Inherit task from parent
                approach,
                status: 'pending',
                children: [],
                depth: parent.depth + 1,
                tokensUsed: 0,
                createdAt: new Date().toISOString(),
            };
            this.tree.set(nodeId, node);
            parent.children.push(nodeId);
            newNodes.push(node);
        }
        return newNodes;
    }
    /**
     * Get the next node to explore using best-first selection
     *
     * Selection priority:
     * 1. Pending nodes with highest score (if parent has score)
     * 2. Pending nodes at shallowest depth
     * 3. Oldest pending nodes (by creation time)
     *
     * @returns The next node to explore, or null if no pending nodes exist
     */
    getNextToExplore() {
        const pendingNodes = Array.from(this.tree.values()).filter((n) => n.status === 'pending');
        if (pendingNodes.length === 0) {
            return null;
        }
        // Sort by:
        // 1. Parent score (descending - prioritize high-scoring branches)
        // 2. Depth (ascending - prefer shallow nodes)
        // 3. Creation time (ascending - older nodes first)
        pendingNodes.sort((a, b) => {
            const aParentScore = this.getParentScore(a);
            const bParentScore = this.getParentScore(b);
            if (aParentScore !== bParentScore) {
                return bParentScore - aParentScore; // Higher parent score first
            }
            if (a.depth !== b.depth) {
                return a.depth - b.depth; // Shallower depth first
            }
            return a.createdAt.localeCompare(b.createdAt); // Older nodes first
        });
        return pendingNodes[0];
    }
    /**
     * Evaluate a completed node and calculate its score
     *
     * Score is calculated as weighted sum of:
     * - Test pass rate (weight: config.evaluationCriteria.testPassRate)
     * - Code quality score (weight: config.evaluationCriteria.codeQuality)
     * - Token efficiency (weight: config.evaluationCriteria.tokenEfficiency)
     *
     * Token efficiency is inversely proportional to token cost.
     *
     * @param nodeId - ID of the node to evaluate
     * @param result - The execution result
     */
    evaluate(nodeId, result) {
        const node = this.tree.get(nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }
        // Update node status and result
        node.status = result.success ? 'completed' : 'failed';
        node.result = result;
        node.tokensUsed = result.tokenCost;
        node.completedAt = new Date().toISOString();
        // Calculate score
        if (result.success) {
            // Token efficiency: normalize to 0-1 (1.0 = 0 tokens, 0.0 = 100k+ tokens)
            const tokenEfficiency = Math.max(0, 1 - result.tokenCost / 100000);
            node.score =
                result.testPassRate * this.config.evaluationCriteria.testPassRate +
                    result.codeQualityScore * this.config.evaluationCriteria.codeQuality +
                    tokenEfficiency * this.config.evaluationCriteria.tokenEfficiency;
        }
        else {
            // Failed nodes get a score of 0
            node.score = 0;
        }
    }
    /**
     * Prune branches below the threshold score
     *
     * Prunes all pending nodes in subtrees rooted at nodes
     * with scores below the pruning threshold.
     *
     * @returns Array of IDs of pruned nodes
     */
    prune() {
        const pruned = [];
        const threshold = this.config.pruningThreshold;
        // Find nodes below threshold
        const belowThreshold = Array.from(this.tree.values()).filter((n) => n.score !== undefined && n.score < threshold && n.status === 'completed');
        // For each low-scoring node, prune its pending descendants
        for (const node of belowThreshold) {
            const descendants = this.getPendingDescendants(node.id);
            for (const descId of descendants) {
                const descNode = this.tree.get(descId);
                if (descNode) {
                    descNode.status = 'pruned';
                    pruned.push(descId);
                }
            }
        }
        return pruned;
    }
    /**
     * Get the node with the best result
     *
     * @returns The node with the highest score, or null if no completed nodes
     */
    getBestResult() {
        const completedNodes = Array.from(this.tree.values()).filter((n) => n.status === 'completed' && n.score !== undefined);
        if (completedNodes.length === 0) {
            return null;
        }
        return completedNodes.reduce((best, current) => {
            return (current.score || 0) > (best.score || 0) ? current : best;
        });
    }
    /**
     * Check if the search is complete
     *
     * Search is complete when:
     * - No pending nodes remain, OR
     * - A node exceeds the success threshold
     *
     * @returns true if search is complete, false otherwise
     */
    isComplete() {
        const pendingNodes = Array.from(this.tree.values()).filter((n) => n.status === 'pending');
        if (pendingNodes.length === 0) {
            return true;
        }
        // Check if we have a successful node
        const bestNode = this.getBestResult();
        if (bestNode && bestNode.score && bestNode.score >= this.config.successThreshold) {
            return true;
        }
        return false;
    }
    /**
     * Get current search statistics
     *
     * @returns Statistics about the search state
     */
    stats() {
        const nodes = Array.from(this.tree.values());
        const explored = nodes.filter((n) => n.status === 'completed' || n.status === 'failed').length;
        const pruned = nodes.filter((n) => n.status === 'pruned').length;
        const running = nodes.filter((n) => n.status === 'running').length;
        const pending = nodes.filter((n) => n.status === 'pending').length;
        const bestNode = this.getBestResult();
        return {
            totalNodes: nodes.length,
            explored,
            pruned,
            running,
            pending,
            bestScore: bestNode?.score,
            bestNodeId: bestNode?.id,
        };
    }
    /**
     * Get a node by ID
     *
     * @param nodeId - ID of the node to get
     * @returns The node, or undefined if not found
     */
    getNode(nodeId) {
        return this.tree.get(nodeId);
    }
    /**
     * Get all nodes in the tree
     *
     * @returns Array of all nodes
     */
    getAllNodes() {
        return Array.from(this.tree.values());
    }
    /**
     * Get all nodes with a specific status
     *
     * @param status - The status to filter by
     * @returns Array of nodes with the given status
     */
    getNodesByStatus(status) {
        return Array.from(this.tree.values()).filter((n) => n.status === status);
    }
    /**
     * Mark a node as running
     *
     * @param nodeId - ID of the node to mark
     */
    markRunning(nodeId) {
        const node = this.tree.get(nodeId);
        if (node) {
            node.status = 'running';
        }
    }
    /**
     * Get the configuration
     *
     * @returns The current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Reset the manager (clear all nodes)
     */
    reset() {
        this.tree.clear();
        this.nodeCounter = 0;
    }
    /**
     * Generate a unique node ID
     *
     * @returns A unique node ID
     */
    generateNodeId() {
        return `node_${Date.now()}_${this.nodeCounter++}`;
    }
    /**
     * Get the score of a node's parent
     *
     * @param node - The node to get parent score for
     * @returns The parent's score, or 0 if no parent or parent has no score
     */
    getParentScore(node) {
        if (!node.parentId) {
            return 0;
        }
        const parent = this.tree.get(node.parentId);
        return parent?.score || 0;
    }
    /**
     * Get all pending descendants of a node
     *
     * @param nodeId - ID of the node to get descendants for
     * @returns Array of descendant IDs that are pending
     */
    getPendingDescendants(nodeId) {
        const pending = [];
        const toVisit = [nodeId];
        while (toVisit.length > 0) {
            const currentId = toVisit.pop();
            const node = this.tree.get(currentId);
            if (node?.status === 'pending') {
                pending.push(currentId);
            }
            // Add children to visit
            if (node) {
                toVisit.push(...node.children);
            }
        }
        return pending;
    }
}
//# sourceMappingURL=manager.js.map