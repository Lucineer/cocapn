/**
 * StdioTransport — MCP transport for Node.js local bridge.
 *
 * Communicates with a CLI agent process via its stdin/stdout using
 * newline-delimited JSON (NDJSON). Each message is a single JSON line.
 *
 * Only imported in Node.js environments; not compatible with Cloudflare Workers.
 */
import { BaseTransport } from "./transport.js";
import type { JsonRpcMessage } from "./types.js";
export interface StdioTransportOptions {
    /** Readable stream to receive messages from (default: process.stdin) */
    readable?: NodeJS.ReadableStream;
    /** Writable stream to send messages to (default: process.stdout) */
    writable?: NodeJS.WritableStream;
}
export declare class StdioTransport extends BaseTransport {
    private readable;
    private writable;
    private buffer;
    private started;
    constructor(options?: StdioTransportOptions);
    start(): Promise<void>;
    send(message: JsonRpcMessage): Promise<void>;
    close(): Promise<void>;
    private processBuffer;
}
//# sourceMappingURL=stdio-transport.d.ts.map