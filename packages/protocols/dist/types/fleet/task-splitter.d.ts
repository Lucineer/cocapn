/**
 * Fleet Task Splitter
 *
 * Decomposes complex tasks into subtasks and merges results.
 */
import type { Subtask, DecompositionStrategy, TaskSplitResult, MergeResult, FleetAgent, AgentScore, MergeStrategy } from './types.js';
export declare class TaskSplitter {
    /**
     * Split a complex task into subtasks based on decomposition strategy
     */
    splitTask(description: string, strategy: DecompositionStrategy, input?: any): TaskSplitResult;
    /**
     * Split task into parallel independent subtasks
     */
    private splitParallel;
    /**
     * Split task into sequential stages
     */
    private splitSequential;
    /**
     * Split task into map-reduce pattern
     */
    private splitMapReduce;
    /**
     * Merge results from multiple subtasks based on strategy
     */
    mergeResults(results: Array<{
        subtaskId: string;
        result: any;
    }>, mergeStrategy: MergeStrategy): MergeResult;
    /**
     * Concatenate all results
     */
    private mergeConcat;
    /**
     * Vote on best result (requires odd number of agents)
     */
    private mergeVote;
    /**
     * Require quorum (2/3 majority)
     */
    private mergeQuorum;
    /**
     * Custom merge (just return all results)
     */
    private mergeCustom;
    /**
     * Determine best-fit agent for a task
     */
    determineAgentFit(subtask: Subtask, agents: FleetAgent[]): AgentScore[];
    /**
     * Calculate score for agent-task match
     */
    private calculateScore;
    /**
     * Get human-readable reasons for score
     */
    private getScoreReasons;
    /**
     * Generate unique ID
     */
    private generateId;
}
export declare const taskSplitter: TaskSplitter;
//# sourceMappingURL=task-splitter.d.ts.map