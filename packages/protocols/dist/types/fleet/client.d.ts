/**
 * Fleet Client
 *
 * Client for bridge integration with fleet protocol.
 * Handles fleet connection, messaging, and task execution.
 */
import type { FleetAgent, FleetMessage, FleetClientConfig, FleetClientState } from './types.js';
import { FleetManager } from './fleet-manager.js';
export declare class FleetClient {
    private config;
    private manager;
    private state;
    private heartbeatInterval?;
    private messageHandlers;
    constructor(config: FleetClientConfig, manager?: FleetManager);
    /**
     * Connect to fleet (create new or join existing)
     */
    connect(): Promise<{
        fleetId: string;
        role: string;
        leaderId: string;
        peers: FleetAgent[];
    }>;
    /**
     * Disconnect from fleet
     */
    disconnect(): Promise<void>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get current state
     */
    getState(): FleetClientState;
    /**
     * Send message to fleet or specific agent
     */
    sendMessage(message: Omit<FleetMessage, 'id' | 'from' | 'timestamp'>): Promise<string>;
    /**
     * Send task progress update
     */
    sendProgress(taskId: string, progress: number, status: 'working' | 'blocked' | 'complete' | 'failed', message?: string): Promise<void>;
    /**
     * Send task result
     */
    sendResult(taskId: string, result: {
        status: 'success' | 'failure' | 'partial';
        output: any;
        artifacts: any[];
        metrics: {
            duration: number;
            tokensUsed: number;
            steps: number;
        };
    }): Promise<void>;
    /**
     * Send error escalation
     */
    sendError(taskId: string, error: {
        code: string;
        message: string;
        stack?: string;
        recoverable: boolean;
        escalationLevel: 'warn' | 'retry' | 'escalate' | 'abort';
    }): Promise<void>;
    /**
     * Register message handler
     */
    onMessage(type: string, handler: (message: FleetMessage) => void): void;
    /**
     * Handle incoming message
     */
    handleMessage(message: FleetMessage): Promise<void>;
    /**
     * Start heartbeat loop
     */
    private startHeartbeat;
    /**
     * Stop heartbeat loop
     */
    private stopHeartbeat;
    /**
     * Send heartbeat to fleet
     */
    private sendHeartbeat;
    /**
     * Complete task and remove from tracking
     */
    completeTask(taskId: string, result?: any): void;
    /**
     * Fail task and remove from tracking
     */
    failTask(taskId: string, error: Error): void;
    /**
     * Get current tasks
     */
    getCurrentTasks(): Set<string>;
    /**
     * Get fleet peers
     */
    getPeers(): FleetAgent[];
    /**
     * Get fleet leader
     */
    getLeader(): FleetAgent | undefined;
    /**
     * Get agent info
     */
    getAgentInfo(): {
        id: string;
        name: string;
        role: string | undefined;
    };
    /**
     * Broadcast message to all peers
     */
    private broadcastToPeers;
    /**
     * Send message to specific agent
     */
    private sendToAgent;
    /**
     * Generate unique message ID
     */
    private generateMessageId;
    /**
     * Cleanup resources
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map