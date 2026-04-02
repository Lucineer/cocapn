/**
 * cocapn status — Real-time agent health display in the terminal.
 *
 * Fetches from http://localhost:<port>/api/status, falls back to reading
 * local brain files when the bridge is offline.
 */
import { Command } from "commander";
export interface StatusResponse {
    agent: {
        name: string;
        version: string;
        mode: string;
        uptime: number;
        repoRoot: string;
    };
    brain: {
        facts: number;
        memories: number;
        wikiPages: number;
        knowledgeEntries: number;
        lastSync: string | null;
    };
    llm: {
        provider: string;
        model: string;
        requestsToday: number;
        tokensToday: number;
        avgLatency: number;
    };
    fleet: {
        peers: number;
        messagesSent: number;
        messagesReceived: number;
    };
    system: {
        memoryUsage: string;
        cpuPercent: number;
        diskUsage: string;
    };
}
export declare function readLocalStatus(repoRoot: string): StatusResponse;
export declare function renderStatus(status: StatusResponse, offline: boolean): string;
export declare function createStatusCommand(): Command;
//# sourceMappingURL=status.d.ts.map