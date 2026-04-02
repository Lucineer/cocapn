/**
 * StdioTransport — MCP transport for Node.js local bridge.
 *
 * Communicates with a CLI agent process via its stdin/stdout using
 * newline-delimited JSON (NDJSON). Each message is a single JSON line.
 *
 * Only imported in Node.js environments; not compatible with Cloudflare Workers.
 */
import { BaseTransport } from "./transport.js";
export class StdioTransport extends BaseTransport {
    readable;
    writable;
    buffer = "";
    started = false;
    constructor(options = {}) {
        super();
        this.readable = options.readable ?? process.stdin;
        this.writable = options.writable ?? process.stdout;
    }
    async start() {
        if (this.started)
            return;
        this.started = true;
        this.readable.setEncoding("utf8");
        this.readable.on("data", (chunk) => {
            this.buffer += chunk;
            this.processBuffer();
        });
        this.readable.on("error", (err) => {
            this.notifyError(err);
        });
        this.readable.on("end", () => {
            // Process any remaining buffered data
            if (this.buffer.trim()) {
                this.processBuffer();
            }
            this.notifyClose();
        });
    }
    async send(message) {
        if (!this.started) {
            throw new Error("StdioTransport: call start() before send()");
        }
        const line = JSON.stringify(message) + "\n";
        await new Promise((resolve, reject) => {
            this.writable.write(line, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async close() {
        this.started = false;
        this.notifyClose();
    }
    processBuffer() {
        const lines = this.buffer.split("\n");
        // Last element is either empty (complete line) or a partial line
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const parsed = JSON.parse(trimmed);
                this.notifyMessage(parsed).catch((err) => {
                    this.notifyError(err instanceof Error ? err : new Error(String(err)));
                });
            }
            catch {
                this.notifyError(new Error(`StdioTransport: failed to parse line: ${trimmed}`));
            }
        }
    }
}
//# sourceMappingURL=stdio-transport.js.map