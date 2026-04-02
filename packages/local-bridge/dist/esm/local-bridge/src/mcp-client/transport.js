/**
 * MCP Client Transport Layer — connects cocapn TO external MCP servers.
 *
 * Supports two transport types:
 *   - stdio: spawn a process and communicate via stdin/stdout
 *   - sse: connect to an HTTP SSE endpoint
 */
import { BaseTransport } from "@cocapn/protocols/mcp/transport";
import { spawn } from "child_process";
// ---------------------------------------------------------------------------
// Stdio Transport — spawn a process and communicate via stdin/stdout
// ---------------------------------------------------------------------------
export class McpStdioTransport extends BaseTransport {
    command;
    args;
    env;
    process = null;
    buffer = "";
    started = false;
    constructor(config) {
        super();
        this.command = config.command;
        this.args = config.args;
        this.env = config.env ?? {};
    }
    async start() {
        if (this.started)
            return;
        this.started = true;
        this.process = spawn(this.command, this.args, {
            env: { ...process.env, ...this.env },
            stdio: ["pipe", "pipe", "pipe"],
        });
        const { stdout, stderr } = this.process;
        if (!stdout || !stderr) {
            throw new Error("McpStdioTransport: failed to spawn process (stdio not available)");
        }
        stdout.setEncoding("utf8");
        stdout.on("data", (chunk) => {
            this.buffer += chunk;
            this.processBuffer();
        });
        stderr.on("data", (chunk) => {
            // Log stderr for debugging but don't parse as MCP messages
            console.error(`[McpStdioTransport:${this.command}] stderr:`, chunk);
        });
        stdout.on("error", (err) => {
            this.notifyError(err);
        });
        stderr.on("error", (err) => {
            this.notifyError(err);
        });
        this.process.on("error", (err) => {
            this.notifyError(err);
        });
        this.process.on("exit", (code) => {
            const exitCode = code ?? -1;
            if (exitCode !== 0) {
                this.notifyError(new Error(`McpStdioTransport: process exited with code ${exitCode}`));
            }
            this.notifyClose();
        });
    }
    async send(message) {
        if (!this.started || !this.process || !this.process.stdin) {
            throw new Error("McpStdioTransport: not connected — call start() first");
        }
        const line = JSON.stringify(message) + "\n";
        return new Promise((resolve, reject) => {
            this.process.stdin.write(line, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async close() {
        this.started = false;
        if (this.process) {
            this.process.kill("SIGTERM");
            this.process = null;
        }
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
                this.notifyError(new Error(`McpStdioTransport: failed to parse line: ${trimmed}`));
            }
        }
    }
}
// ---------------------------------------------------------------------------
// SSE Transport — connect to an HTTP SSE endpoint
// ---------------------------------------------------------------------------
export class McpSseTransport extends BaseTransport {
    url;
    headers;
    abortController = null;
    started = false;
    constructor(config) {
        super();
        this.url = config.url;
        this.headers = config.headers ?? {};
    }
    async start() {
        if (this.started)
            return;
        this.started = true;
        this.abortController = new AbortController();
        try {
            const response = await fetch(this.url, {
                headers: this.headers,
                signal: this.abortController.signal,
            });
            if (!response.ok) {
                throw new Error(`McpSseTransport: HTTP ${response.status} ${response.statusText}`);
            }
            if (!response.body) {
                throw new Error("McpSseTransport: response body is null");
            }
            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (this.started && !this.abortController.signal.aborted) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                this.processBuffer(buffer);
                // Keep only the last partial line
                buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                // Normal close via abort()
                return;
            }
            this.notifyError(error instanceof Error ? error : new Error(String(error)));
        }
    }
    async send(message) {
        if (!this.started) {
            throw new Error("McpSseTransport: not connected — call start() first");
        }
        // For SSE, we typically send messages via a separate POST endpoint
        // This implementation assumes a common pattern where POST goes to the same base URL
        const postUrl = this.url.replace("/sse", "/message");
        try {
            const response = await fetch(postUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.headers,
                },
                body: JSON.stringify(message),
            });
            if (!response.ok) {
                throw new Error(`McpSseTransport: HTTP ${response.status} ${response.statusText}`);
            }
        }
        catch (error) {
            throw new Error(`McpSseTransport: failed to send message: ${error}`);
        }
    }
    async close() {
        this.started = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.notifyClose();
    }
    processBuffer(buffer) {
        const lines = buffer.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:"))
                continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]")
                continue;
            try {
                const parsed = JSON.parse(data);
                this.notifyMessage(parsed).catch((err) => {
                    this.notifyError(err instanceof Error ? err : new Error(String(err)));
                });
            }
            catch {
                this.notifyError(new Error(`McpSseTransport: failed to parse SSE data: ${data}`));
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Factory function — create transport from config
// ---------------------------------------------------------------------------
export function createMcpTransport(config) {
    switch (config.type) {
        case "stdio":
            if (!config.command || !config.args) {
                throw new Error("McpTransport: stdio requires command and args");
            }
            return new McpStdioTransport({
                command: config.command,
                args: config.args,
                env: config.env,
            });
        case "sse":
            if (!config.url) {
                throw new Error("McpTransport: sse requires url");
            }
            return new McpSseTransport({
                url: config.url,
                headers: config.headers,
            });
        default:
            throw new Error(`McpTransport: unknown transport type ${config.type}`);
    }
}
//# sourceMappingURL=transport.js.map