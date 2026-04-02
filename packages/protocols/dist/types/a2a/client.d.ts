/**
 * A2AClient — sends A2A tasks to a remote agent.
 *
 * Used by the local bridge to delegate tasks to cloud Workers,
 * or by Workers to call other Workers.
 *
 * Transport: HTTP POST with JSON-RPC 2.0 body.
 * Streaming: Server-Sent Events (SSE) for tasks/sendSubscribe.
 */
import type { A2AAgentCard, CancelTaskParams, GetTaskParams, SendTaskParams, Task, TaskStreamEvent } from "./types.js";
export interface A2AClientOptions {
    /** Base URL of the remote A2A agent (e.g., https://agent.cocapn.io) */
    baseUrl: string;
    /** Optional bearer token for authenticated agents */
    authToken?: string;
    /** Fetch implementation — defaults to global fetch (available in Node 18+, Workers, browsers) */
    fetch?: typeof globalThis.fetch;
}
export declare class A2AClient {
    private baseUrl;
    private authToken;
    private fetch;
    private nextId;
    constructor(options: A2AClientOptions);
    getAgentCard(): Promise<A2AAgentCard>;
    sendTask(params: SendTaskParams): Promise<Task>;
    getTask(params: GetTaskParams): Promise<Task>;
    cancelTask(params: CancelTaskParams): Promise<Task>;
    /**
     * Subscribe to streaming task updates via Server-Sent Events.
     * The callback is called for each event until the stream ends.
     */
    sendTaskStream(params: SendTaskParams): AsyncGenerator<TaskStreamEvent>;
    private rpc;
    private baseHeaders;
}
//# sourceMappingURL=client.d.ts.map