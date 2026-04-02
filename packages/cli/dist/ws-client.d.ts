/**
 * WebSocket client for communicating with a running cocapn bridge.
 *
 * Provides a simple interface for sending JSON-RPC requests to the bridge
 * and receiving responses.
 */
import { EventEmitter } from "events";
export interface BridgeResponse {
    jsonrpc: "2.0";
    id: string | number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export interface BridgeStatus {
    running: boolean;
    uptime?: number;
    agents?: number;
    connections?: number;
    port?: number;
}
export interface SkillInfo {
    name: string;
    version: string;
    description: string;
    loaded: boolean;
}
export interface TemplateInfo {
    name: string;
    displayName: string;
    description: string;
    emoji: string;
    domains: string[];
}
export interface GraphStats {
    nodes: number;
    edges: number;
    languages: Record<string, number>;
    lastUpdated: string;
}
export interface TokenStats {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    requests: number;
    avgTokensPerRequest: number;
}
export interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    checks: {
        git?: {
            status: string;
            message?: string;
        };
        brain?: {
            status: string;
            message?: string;
        };
        disk?: {
            status: string;
            message?: string;
        };
        websocket?: {
            status: string;
            message?: string;
        };
    };
}
export declare class BridgeClient extends EventEmitter {
    private ws;
    private url;
    private token;
    private connected;
    private messageId;
    private pendingRequests;
    private requestTimeout;
    constructor(url: string, token?: string);
    /**
     * Connect to the bridge
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the bridge
     */
    disconnect(): void;
    /**
     * Send a JSON-RPC request to the bridge
     */
    sendRequest(method: string, params?: unknown): Promise<unknown>;
    /**
     * Get bridge status
     */
    getStatus(): Promise<BridgeStatus>;
    /**
     * List available skills
     */
    listSkills(): Promise<SkillInfo[]>;
    /**
     * Load a skill
     */
    loadSkill(name: string): Promise<void>;
    /**
     * Unload a skill
     */
    unloadSkill(name: string): Promise<void>;
    /**
     * Search templates
     */
    searchTemplates(query: string): Promise<TemplateInfo[]>;
    /**
     * Install a template
     */
    installTemplate(name: string, options?: {
        fork?: string;
    }): Promise<void>;
    /**
     * Start a tree search
     */
    startTreeSearch(task: string): Promise<string>;
    /**
     * Get tree search status
     */
    getTreeSearchStatus(searchId: string): Promise<unknown>;
    /**
     * Get graph statistics
     */
    getGraphStats(): Promise<GraphStats>;
    /**
     * Get token usage statistics
     */
    getTokenStats(): Promise<TokenStats>;
    /**
     * Get health status
     */
    getHealth(): Promise<HealthStatus>;
    /**
     * List personality presets
     */
    listPersonalities(): Promise<{
        builtIn: Array<{
            name: string;
            tagline: string;
            voice: string;
            traits: string[];
        }>;
        current: string;
    }>;
    /**
     * Get current personality
     */
    getPersonality(): Promise<{
        personality: {
            name: string;
            tagline: string;
            voice: string;
            traits: string[];
            rules: string[];
            systemPrompt: string;
        };
    }>;
    /**
     * Set personality preset
     */
    setPersonality(name: string): Promise<{
        personality: {
            name: string;
            tagline: string;
        };
    }>;
    /**
     * Get soul.md edit path
     */
    editPersonality(): Promise<{
        soulPath: string;
    }>;
    /**
     * Handle incoming WebSocket message
     */
    private handleMessage;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
/**
 * Create a bridge client and connect
 */
export declare function createBridgeClient(host?: string, port?: number, token?: string): Promise<BridgeClient>;
//# sourceMappingURL=ws-client.d.ts.map