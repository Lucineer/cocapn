/**
 * cocapn fleet — Fleet management commands
 *
 * Usage:
 *   cocapn fleet list                 — list fleet members
 *   cocapn fleet list --json          — list as JSON
 *   cocapn fleet status               — fleet overview
 *   cocapn fleet status --json        — fleet overview as JSON
 *   cocapn fleet send <agent> <msg>   — send message to fleet member
 *   cocapn fleet broadcast <message>  — broadcast to all agents
 *   cocapn fleet inspect <agent>      — detailed agent info
 */
import { Command } from "commander";
interface FleetMember {
    agentId: string;
    name: string;
    role: string;
    status: string;
    lastHeartbeat: number;
    uptime: number;
    load: number;
    successRate: number;
    skills: string[];
    instanceUrl: string;
}
interface FleetOverview {
    fleetId: string;
    totalAgents: number;
    connected: number;
    disconnected: number;
    messagesLastHour: number;
    tasksRunning: number;
    tasksCompleted: number;
    systemResources: {
        cpuUsage: string;
        memoryUsage: string;
        uptime: number;
    };
}
interface AgentInspect {
    agentId: string;
    name: string;
    role: string;
    status: string;
    uptime: number;
    load: number;
    successRate: number;
    skills: string[];
    brain: {
        facts: number;
        wiki: number;
        memories: number;
        procedures: number;
    };
    llm: {
        provider: string;
        model: string;
    };
    mode: string;
    capabilities: string[];
    lastHeartbeat: number;
    instanceUrl: string;
}
interface SendMessageResponse {
    success: boolean;
    agentId: string;
    message: string;
    response?: string;
    error?: string;
}
interface BroadcastResponse {
    success: boolean;
    message: string;
    delivered: number;
    failed: number;
    total: number;
}
declare function fetchFleetAPI<T>(path: string): Promise<T>;
declare function postFleetAPI<T>(path: string, body: unknown): Promise<T>;
declare function readLocalFleetConfig(cocapnDir: string): {
    agents: FleetMember[];
} | null;
declare function formatUptime(seconds: number): string;
declare function formatTimeAgo(timestamp: number): string;
declare function statusColor(status: string): string;
declare function roleIcon(role: string): string;
declare function fleetList(json: boolean): Promise<void>;
declare function fleetStatus(json: boolean): Promise<void>;
declare function fleetSend(agentId: string, message: string): Promise<void>;
declare function fleetBroadcast(message: string): Promise<void>;
declare function fleetInspect(agentId: string): Promise<void>;
export declare function createFleetCommand(): Command;
export { formatUptime, formatTimeAgo, statusColor, roleIcon, fetchFleetAPI, postFleetAPI, readLocalFleetConfig, fleetList, fleetStatus, fleetSend, fleetBroadcast, fleetInspect, };
export type { FleetMember, FleetOverview, AgentInspect, SendMessageResponse, BroadcastResponse, };
//# sourceMappingURL=fleet.d.ts.map