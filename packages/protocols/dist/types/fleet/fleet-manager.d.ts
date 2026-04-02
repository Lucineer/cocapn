/**
 * Fleet Manager
 *
 * Manages fleet lifecycle, task distribution, and leader election.
 */
import type { Fleet, FleetAgent, FleetTask, FleetRole, DecompositionStrategy, FleetConfig } from './types.js';
import { FleetRegistry } from './fleet-registry.js';
import { TaskSplitter } from './task-splitter.js';
export declare class FleetManager {
    private registry;
    private splitter;
    private config;
    constructor(registry?: FleetRegistry, splitter?: TaskSplitter, config?: Partial<FleetConfig>);
    /**
     * Create a new fleet
     */
    createFleet(name: string, initialLeaderId: string, topology?: Fleet['topology']): Fleet;
    /**
     * Join an existing fleet
     */
    joinFleet(fleetId: string, agentInfo: {
        id: string;
        name: string;
        url: string;
        skills: string[];
        leadershipPriority?: number;
    }, preferredRole?: FleetRole): FleetAgent;
    /**
     * Leave a fleet
     */
    leaveFleet(agentId: string): boolean;
    /**
     * Get fleet by ID
     */
    getFleet(fleetId: string): Fleet | undefined;
    /**
     * Get all fleets
     */
    getAllFleets(): Fleet[];
    /**
     * Assign task to best-fit agent in fleet
     */
    assignTask(fleetId: string, task: Omit<FleetTask, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>): FleetTask;
    /**
     * Split complex task into subtasks and assign them
     */
    splitAndAssign(fleetId: string, description: string, strategy: DecompositionStrategy, input: any, priority?: number): {
        parentTask: FleetTask;
        subtasks: FleetTask[];
    };
    /**
     * Get task status
     */
    getTaskStatus(taskId: string): FleetTask | undefined;
    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: FleetTask['status'], result?: any): FleetTask | undefined;
    /**
     * Redistribute tasks from dead/offline agents
     */
    redistributeTasks(fleetId: string): number;
    /**
     * Elect new leader for fleet
     */
    leaderElection(fleetId: string): FleetAgent | undefined;
    /**
     * Handle leader failure (elect new leader)
     */
    handleLeaderFailure(fleetId: string): FleetAgent | undefined;
    /**
     * Get agent by ID
     */
    getAgent(agentId: string): FleetAgent | undefined;
    /**
     * Get all agents in fleet
     */
    getFleetAgents(fleetId: string): FleetAgent[];
    /**
     * Update agent heartbeat
     */
    updateHeartbeat(agentId: string, status: FleetAgent['status'], currentTaskId?: string, load?: number): boolean;
    /**
     * Merge subtask results
     */
    mergeSubtaskResults(parentTaskId: string, results: Array<{
        subtaskId: string;
        result: any;
    }>, mergeStrategy: 'concat' | 'vote' | 'quorum' | 'custom'): {
        success: boolean;
        result?: any;
        errors: string[];
    };
    /**
     * Get underlying registry
     */
    getRegistry(): FleetRegistry;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
export declare const fleetManager: FleetManager;
//# sourceMappingURL=fleet-manager.d.ts.map