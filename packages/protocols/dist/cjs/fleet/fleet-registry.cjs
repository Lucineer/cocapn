"use strict";
/**
 * Fleet Registry
 *
 * Manages fleet registration, agent discovery, and heartbeat tracking.
 * This is an in-memory implementation; production should use AdmiralDO.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetRegistry = exports.FleetRegistry = void 0;
const types_js_1 = require("./types.cjs");
// ---------------------------------------------------------------------------
// Fleet Registry Class
// ---------------------------------------------------------------------------
class FleetRegistry {
    storage;
    config;
    heartbeatTimers;
    deadAgentTimers;
    constructor(config = {}) {
        this.storage = {
            fleets: new Map(),
            registrations: new Map(),
            agents: new Map(),
            tasks: new Map(),
            taskDedup: new Map(),
            auditLogs: [],
        };
        this.config = { ...types_js_1.DEFAULT_FLEET_CONFIG, ...config };
        this.heartbeatTimers = new Map();
        this.deadAgentTimers = new Map();
    }
    // ---------------------------------------------------------------------------
    // Fleet CRUD
    // ---------------------------------------------------------------------------
    /**
     * Create a new fleet
     */
    createFleet(name, leaderId, topology = 'star') {
        const fleetId = this.generateId('fleet');
        const now = Date.now();
        const fleet = {
            id: fleetId,
            name,
            leaderId,
            agents: [],
            tasks: [],
            topology,
            createdAt: now,
        };
        this.storage.fleets.set(fleetId, fleet);
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId,
            timestamp: now,
            actor: 'system',
            action: 'fleet.created',
            target: fleetId,
            details: { name, leaderId, topology },
        });
        return fleet;
    }
    /**
     * Get fleet by ID
     */
    getFleet(fleetId) {
        return this.storage.fleets.get(fleetId);
    }
    /**
     * Get all fleets
     */
    getAllFleets() {
        return Array.from(this.storage.fleets.values());
    }
    /**
     * Update fleet
     */
    updateFleet(fleetId, updates) {
        const fleet = this.storage.fleets.get(fleetId);
        if (!fleet)
            return undefined;
        const updated = { ...fleet, ...updates };
        this.storage.fleets.set(fleetId, updated);
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId,
            timestamp: Date.now(),
            actor: 'system',
            action: 'fleet.updated',
            target: fleetId,
            details: updates,
        });
        return updated;
    }
    /**
     * Delete fleet
     */
    deleteFleet(fleetId) {
        const fleet = this.storage.fleets.get(fleetId);
        if (!fleet)
            return false;
        // Remove all agents from fleet
        for (const agent of fleet.agents) {
            this.storage.registrations.delete(agent.id);
        }
        this.storage.fleets.delete(fleetId);
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId,
            timestamp: Date.now(),
            actor: 'system',
            action: 'fleet.deleted',
            target: fleetId,
            details: {},
        });
        return true;
    }
    // ---------------------------------------------------------------------------
    // Agent Registration
    // ---------------------------------------------------------------------------
    /**
     * Register agent to fleet (creates new fleet or joins existing)
     */
    registerAgent(agentId, agentCard, capabilities, desiredFleetId, preferredRole) {
        const now = Date.now();
        let fleetId;
        let role;
        if (desiredFleetId) {
            // Join existing fleet
            const fleet = this.storage.fleets.get(desiredFleetId);
            if (!fleet) {
                throw new Error(`Fleet not found: ${desiredFleetId}`);
            }
            fleetId = desiredFleetId;
            role = preferredRole || 'worker';
            // Add agent to fleet
            const agent = {
                id: agentId,
                name: agentCard.name,
                role,
                skills: capabilities.skills,
                status: 'idle',
                instanceUrl: agentCard.url,
                lastHeartbeat: now,
                load: 0,
                successRate: 1.0,
                uptime: 0,
            };
            fleet.agents.push(agent);
            this.storage.agents.set(agentId, agent);
            this.storage.registrations.set(agentId, {
                fleetId,
                agentId,
                role,
                capabilities: {
                    skills: capabilities.skills,
                    modules: capabilities.modules || [],
                    compute: capabilities.compute || {},
                    ...(capabilities.leadershipPriority !== undefined && { leadershipPriority: capabilities.leadershipPriority }),
                },
                endpoint: agentCard.url,
                lastSeen: now,
                status: 'idle',
            });
            // Start heartbeat monitoring
            this.startHeartbeatMonitoring(agentId, fleetId);
            this.addAuditLog({
                id: this.generateId('audit'),
                fleetId,
                timestamp: now,
                actor: agentId,
                action: 'agent.joined',
                target: fleetId,
                details: { role },
            });
            return {
                fleetId,
                role,
                leaderId: fleet.leaderId,
                peers: fleet.agents.filter(a => a.id !== agentId),
            };
        }
        else {
            // Create new fleet (first agent becomes leader)
            role = 'leader';
            fleetId = this.generateId('fleet');
            const fleet = this.createFleet(`fleet-${agentId}`, agentId, 'star');
            const agent = {
                id: agentId,
                name: agentCard.name,
                role,
                skills: capabilities.skills,
                status: 'idle',
                instanceUrl: agentCard.url,
                lastHeartbeat: now,
                load: 0,
                successRate: 1.0,
                uptime: 0,
            };
            fleet.agents.push(agent);
            this.storage.agents.set(agentId, agent);
            this.storage.registrations.set(agentId, {
                fleetId,
                agentId,
                role,
                capabilities: {
                    skills: capabilities.skills,
                    modules: capabilities.modules || [],
                    compute: capabilities.compute || {},
                    ...(capabilities.leadershipPriority !== undefined && { leadershipPriority: capabilities.leadershipPriority }),
                },
                endpoint: agentCard.url,
                lastSeen: now,
                status: 'idle',
            });
            // Start heartbeat monitoring
            this.startHeartbeatMonitoring(agentId, fleetId);
            this.addAuditLog({
                id: this.generateId('audit'),
                fleetId,
                timestamp: now,
                actor: agentId,
                action: 'agent.joined',
                target: fleetId,
                details: { role },
            });
            return {
                fleetId,
                role,
                leaderId: agentId,
                peers: [],
            };
        }
    }
    /**
     * Unregister agent from fleet
     */
    unregisterAgent(agentId) {
        const registration = this.storage.registrations.get(agentId);
        if (!registration)
            return false;
        const fleet = this.storage.fleets.get(registration.fleetId);
        if (!fleet)
            return false;
        // Remove from fleet's agent list
        fleet.agents = fleet.agents.filter(a => a.id !== agentId);
        // Clear timers
        const heartbeatTimer = this.heartbeatTimers.get(agentId);
        if (heartbeatTimer) {
            clearTimeout(heartbeatTimer);
            this.heartbeatTimers.delete(agentId);
        }
        const deadAgentTimer = this.deadAgentTimers.get(agentId);
        if (deadAgentTimer) {
            clearTimeout(deadAgentTimer);
            this.deadAgentTimers.delete(agentId);
        }
        // Remove from storage
        this.storage.registrations.delete(agentId);
        this.storage.agents.delete(agentId);
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId: registration.fleetId,
            timestamp: Date.now(),
            actor: agentId,
            action: 'agent.left',
            target: registration.fleetId,
            details: {},
        });
        return true;
    }
    /**
     * Get agent by ID
     */
    getAgent(agentId) {
        return this.storage.agents.get(agentId);
    }
    /**
     * Get all agents in fleet
     */
    getFleetAgents(fleetId) {
        const fleet = this.storage.fleets.get(fleetId);
        return fleet?.agents || [];
    }
    // ---------------------------------------------------------------------------
    // Heartbeat Tracking
    // ---------------------------------------------------------------------------
    /**
     * Update agent heartbeat
     */
    updateHeartbeat(agentId, status, currentTaskId, load = 0) {
        const agent = this.storage.agents.get(agentId);
        if (!agent)
            return false;
        const now = Date.now();
        agent.lastHeartbeat = now;
        agent.status = status;
        if (currentTaskId !== undefined) {
            agent.currentTask = currentTaskId;
        }
        agent.load = load;
        agent.uptime = Math.floor((now - (agent.lastHeartbeat - agent.uptime * 1000)) / 1000);
        const registration = this.storage.registrations.get(agentId);
        if (registration) {
            registration.lastSeen = now;
            registration.status = status;
        }
        // Reset timers
        this.resetHeartbeatTimers(agentId, agent);
        return true;
    }
    /**
     * Start heartbeat monitoring for agent
     */
    startHeartbeatMonitoring(agentId, fleetId) {
        const config = this.config;
        // Heartbeat timeout timer (degraded)
        const heartbeatTimer = setTimeout(() => {
            this.handleHeartbeatTimeout(agentId, fleetId, 'degraded');
        }, config.heartbeatTimeout);
        this.heartbeatTimers.set(agentId, heartbeatTimer);
        // Dead agent timer (offline)
        const deadAgentTimer = setTimeout(() => {
            this.handleDeadAgent(agentId, fleetId);
        }, config.deadAgentTimeout);
        this.deadAgentTimers.set(agentId, deadAgentTimer);
    }
    /**
     * Reset heartbeat timers after successful heartbeat
     */
    resetHeartbeatTimers(agentId, agent) {
        const config = this.config;
        // Clear existing timers
        const heartbeatTimer = this.heartbeatTimers.get(agentId);
        if (heartbeatTimer) {
            clearTimeout(heartbeatTimer);
        }
        const deadAgentTimer = this.deadAgentTimers.get(agentId);
        if (deadAgentTimer) {
            clearTimeout(deadAgentTimer);
        }
        // Get fleet ID
        const registration = this.storage.registrations.get(agentId);
        if (!registration)
            return;
        // Restart timers
        this.startHeartbeatMonitoring(agentId, registration.fleetId);
    }
    /**
     * Handle heartbeat timeout (mark agent as degraded)
     */
    handleHeartbeatTimeout(agentId, fleetId, level) {
        const agent = this.storage.agents.get(agentId);
        if (!agent)
            return;
        agent.status = level;
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId,
            timestamp: Date.now(),
            actor: 'system',
            action: 'agent.degraded',
            target: agentId,
            details: { lastHeartbeat: agent.lastHeartbeat },
        });
    }
    /**
     * Handle dead agent (mark as offline and reassign tasks)
     */
    handleDeadAgent(agentId, fleetId) {
        const agent = this.storage.agents.get(agentId);
        if (!agent)
            return;
        agent.status = 'offline';
        this.addAuditLog({
            id: this.generateId('audit'),
            fleetId,
            timestamp: Date.now(),
            actor: 'system',
            action: 'agent.offline',
            target: agentId,
            details: { lastHeartbeat: agent.lastHeartbeat },
        });
        // Get agent's active tasks
        const activeTasks = Array.from(this.storage.tasks.values()).filter(t => t.assignedTo === agentId && t.status !== 'completed');
        // Mark tasks for reassignment
        for (const task of activeTasks) {
            task.status = 'pending';
            delete task.assignedTo;
            this.addAuditLog({
                id: this.generateId('audit'),
                fleetId,
                timestamp: Date.now(),
                actor: 'system',
                action: 'task.reassigned',
                target: task.id,
                details: { fromAgent: agentId, reason: 'agent-offline' },
            });
        }
    }
    // ---------------------------------------------------------------------------
    // Task Management
    // ---------------------------------------------------------------------------
    /**
     * Create task
     */
    createTask(task) {
        const taskId = this.generateId('task');
        const now = Date.now();
        const newTask = {
            ...task,
            id: taskId,
            createdAt: now,
            retryCount: 0,
        };
        this.storage.tasks.set(taskId, newTask);
        // Add to fleet
        const fleet = this.storage.fleets.get(task.fleetId);
        if (fleet) {
            fleet.tasks.push(newTask);
        }
        return newTask;
    }
    /**
     * Get task by ID
     */
    getTask(taskId) {
        return this.storage.tasks.get(taskId);
    }
    /**
     * Update task
     */
    updateTask(taskId, updates) {
        const task = this.storage.tasks.get(taskId);
        if (!task)
            return undefined;
        const updated = { ...task, ...updates };
        this.storage.tasks.set(taskId, updated);
        return updated;
    }
    /**
     * Get tasks for agent
     */
    getAgentTasks(agentId) {
        return Array.from(this.storage.tasks.values()).filter(t => t.assignedTo === agentId && t.status !== 'completed');
    }
    /**
     * Get all tasks for fleet
     */
    getFleetTasks(fleetId) {
        return Array.from(this.storage.tasks.values()).filter(t => t.fleetId === fleetId);
    }
    // ---------------------------------------------------------------------------
    // Task Deduplication
    // ---------------------------------------------------------------------------
    /**
     * Check for duplicate task
     */
    checkDuplicate(fingerprint) {
        const existing = this.storage.taskDedup.get(fingerprint);
        return existing?.status === 'pending';
    }
    /**
     * Register task fingerprint
     */
    registerTaskFingerprint(fingerprint, agentId) {
        const existing = this.storage.taskDedup.get(fingerprint);
        if (existing) {
            existing.assignedTo.push(agentId);
        }
        else {
            this.storage.taskDedup.set(fingerprint, {
                fingerprint,
                assignedTo: [agentId],
                status: 'pending',
            });
        }
    }
    /**
     * Mark task fingerprint as complete
     */
    completeTaskFingerprint(fingerprint) {
        const dedup = this.storage.taskDedup.get(fingerprint);
        if (dedup) {
            dedup.status = 'complete';
        }
    }
    // ---------------------------------------------------------------------------
    // Audit Logging
    // ---------------------------------------------------------------------------
    /**
     * Add audit log entry
     */
    addAuditLog(log) {
        this.storage.auditLogs.push(log);
        // Prune old logs based on retention policy
        const cutoff = Date.now() - this.config.auditLogRetention;
        this.storage.auditLogs = this.storage.auditLogs.filter(log => log.timestamp > cutoff);
    }
    /**
     * Get audit logs for fleet
     */
    getAuditLogs(fleetId, limit = 100) {
        return this.storage.auditLogs
            .filter(log => log.fleetId === fleetId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    // ---------------------------------------------------------------------------
    // Utility Methods
    // ---------------------------------------------------------------------------
    /**
     * Generate unique ID
     */
    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Cleanup resources
     */
    destroy() {
        // Clear all timers
        for (const timer of this.heartbeatTimers.values()) {
            clearTimeout(timer);
        }
        for (const timer of this.deadAgentTimers.values()) {
            clearTimeout(timer);
        }
        this.heartbeatTimers.clear();
        this.deadAgentTimers.clear();
    }
}
exports.FleetRegistry = FleetRegistry;
// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------
exports.fleetRegistry = new FleetRegistry();
//# sourceMappingURL=fleet-registry.js.map