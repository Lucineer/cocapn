/**
 * Fleet Registry
 *
 * Manages fleet registration, agent discovery, and heartbeat tracking.
 * This is an in-memory implementation; production should use AdmiralDO.
 */
import type { Fleet, FleetAgent, FleetTask, AgentStatus, FleetRole, AuditLog, FleetConfig } from './types.js';
export declare class FleetRegistry {
    private storage;
    private config;
    private heartbeatTimers;
    private deadAgentTimers;
    constructor(config?: Partial<FleetConfig>);
    /**
     * Create a new fleet
     */
    createFleet(name: string, leaderId: string, topology?: Fleet['topology']): Fleet;
    /**
     * Get fleet by ID
     */
    getFleet(fleetId: string): Fleet | undefined;
    /**
     * Get all fleets
     */
    getAllFleets(): Fleet[];
    /**
     * Update fleet
     */
    updateFleet(fleetId: string, updates: Partial<Fleet>): Fleet | undefined;
    /**
     * Delete fleet
     */
    deleteFleet(fleetId: string): boolean;
    /**
     * Register agent to fleet (creates new fleet or joins existing)
     */
    registerAgent(agentId: string, agentCard: {
        name: string;
        url: string;
    }, capabilities: {
        skills: string[];
        modules?: string[];
        compute?: any;
        leadershipPriority?: number;
    }, desiredFleetId?: string, preferredRole?: FleetRole): {
        fleetId: string;
        role: FleetRole;
        leaderId: string;
        peers: FleetAgent[];
    };
    /**
     * Unregister agent from fleet
     */
    unregisterAgent(agentId: string): boolean;
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
    updateHeartbeat(agentId: string, status: AgentStatus, currentTaskId?: string, load?: number): boolean;
    /**
     * Start heartbeat monitoring for agent
     */
    private startHeartbeatMonitoring;
    /**
     * Reset heartbeat timers after successful heartbeat
     */
    private resetHeartbeatTimers;
    /**
     * Handle heartbeat timeout (mark agent as degraded)
     */
    private handleHeartbeatTimeout;
    /**
     * Handle dead agent (mark as offline and reassign tasks)
     */
    private handleDeadAgent;
    /**
     * Create task
     */
    createTask(task: Omit<FleetTask, 'id' | 'createdAt' | 'retryCount'>): FleetTask;
    /**
     * Get task by ID
     */
    getTask(taskId: string): FleetTask | undefined;
    /**
     * Update task
     */
    updateTask(taskId: string, updates: Partial<FleetTask>): FleetTask | undefined;
    /**
     * Get tasks for agent
     */
    getAgentTasks(agentId: string): FleetTask[];
    /**
     * Get all tasks for fleet
     */
    getFleetTasks(fleetId: string): FleetTask[];
    /**
     * Check for duplicate task
     */
    checkDuplicate(fingerprint: string): boolean;
    /**
     * Register task fingerprint
     */
    registerTaskFingerprint(fingerprint: string, agentId: string): void;
    /**
     * Mark task fingerprint as complete
     */
    completeTaskFingerprint(fingerprint: string): void;
    /**
     * Add audit log entry
     */
    addAuditLog(log: AuditLog): void;
    /**
     * Get audit logs for fleet
     */
    getAuditLogs(fleetId: string, limit?: number): AuditLog[];
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
export declare const fleetRegistry: FleetRegistry;
//# sourceMappingURL=fleet-registry.d.ts.map