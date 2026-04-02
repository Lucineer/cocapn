/**
 * WorkerTransport — MCP transport for Cloudflare Workers.
 *
 * Communicates using the Fetch API and the WebSocket API available in
 * the Workers runtime. Does NOT use Node.js built-ins (no `process`, `stream`, etc.).
 *
 * Connection model: the Worker acts as a WebSocket client connecting to the
 * local bridge's WebSocket server (or another Worker's Durable Object WebSocket).
 */
import { BaseTransport } from "./transport.js";
import type { JsonRpcMessage } from "./types.js";
export interface WorkerTransportOptions {
    /** WebSocket URL of the MCP server to connect to */
    url: string;
    /**
     * Headers to include in the WebSocket upgrade request
     * (e.g., Authorization for authenticated tunnels)
     */
    headers?: Record<string, string>;
}
export declare class WorkerTransport extends BaseTransport {
    private url;
    private headers;
    private ws;
    constructor(options: WorkerTransportOptions);
    start(): Promise<void>;
    send(message: JsonRpcMessage): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=worker-transport.d.ts.map