/**
 * A2AServer — receives A2A tasks from remote agents.
 *
 * Handles inbound JSON-RPC 2.0 HTTP requests at a single endpoint.
 * Works in both Node.js (via http.IncomingMessage) and Cloudflare Workers
 * (via the Fetch API Request/Response types).
 *
 * Usage:
 *   const server = new A2AServer({ agentCard, taskHandler });
 *   // In a Worker:
 *   export default { fetch: (req) => server.handleRequest(req) };
 *   // In Node.js:
 *   http.createServer((req, res) => server.handleNodeRequest(req, res));
 */
import type { A2AAgentCard, SendTaskParams, Task, TaskStatus } from "./types.js";
export type TaskHandler = (params: SendTaskParams) => Promise<Task>;
export type TaskLookup = (id: string) => Promise<Task | null>;
export type TaskCancel = (id: string) => Promise<Task | null>;
export interface A2AServerOptions {
    agentCard: A2AAgentCard;
    /** Called when a new task arrives via tasks/send */
    onSendTask: TaskHandler;
    /** Called when a client requests task status via tasks/get */
    onGetTask?: TaskLookup;
    /** Called when a client cancels a task via tasks/cancel */
    onCancelTask?: TaskCancel;
}
export declare class A2AServer {
    private agentCard;
    private onSendTask;
    private onGetTask;
    private onCancelTask;
    constructor(options: A2AServerOptions);
    /**
     * Handle a Fetch API Request (Cloudflare Workers or Node.js 18+).
     * Returns a Fetch API Response.
     */
    handleRequest(request: Request): Promise<Response>;
    private dispatchRpc;
    static makeTask(id: string, status: TaskStatus, sessionId?: string): Task;
    private successResponse;
    private errorResponse;
}
//# sourceMappingURL=server.d.ts.map