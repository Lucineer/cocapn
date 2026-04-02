/**
 * WebSocket client for communicating with a running cocapn bridge.
 *
 * Provides a simple interface for sending JSON-RPC requests to the bridge
 * and receiving responses.
 */
import { WebSocket } from "ws";
import { EventEmitter } from "events";
export class BridgeClient extends EventEmitter {
    ws = null;
    url;
    token;
    connected = false;
    messageId = 0;
    pendingRequests = new Map();
    requestTimeout = 30000; // 30 seconds
    constructor(url, token) {
        super();
        this.url = url;
        this.token = token;
    }
    /**
     * Connect to the bridge
     */
    connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;
            this.ws = new WebSocket(wsUrl);
            let resolved = false;
            // Connection timeout (5 seconds)
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.ws?.terminate();
                    reject(new Error("Connection timeout"));
                }
            }, 5000);
            this.ws.on("open", () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.connected = true;
                    this.emit("connected");
                    resolve();
                }
            });
            this.ws.on("message", (data) => {
                this.handleMessage(data);
            });
            this.ws.on("error", (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.emit("error", err);
                    reject(err);
                }
            });
            this.ws.on("close", () => {
                this.connected = false;
                this.emit("disconnected");
                // Reject all pending requests
                for (const pending of this.pendingRequests.values()) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error("Connection closed"));
                }
                this.pendingRequests.clear();
            });
        });
    }
    /**
     * Disconnect from the bridge
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.connected = false;
        }
    }
    /**
     * Send a JSON-RPC request to the bridge
     */
    async sendRequest(method, params) {
        if (!this.connected || !this.ws) {
            throw new Error("Not connected to bridge");
        }
        const id = ++this.messageId;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, this.requestTimeout);
            this.pendingRequests.set(id, { resolve, reject, timeout });
            const request = {
                jsonrpc: "2.0",
                id,
                method,
                params,
            };
            this.ws.send(JSON.stringify(request), (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
        });
    }
    /**
     * Get bridge status
     */
    async getStatus() {
        const result = await this.sendRequest("bridge/status");
        return result;
    }
    /**
     * List available skills
     */
    async listSkills() {
        const result = await this.sendRequest("skill/list");
        return result.skills || [];
    }
    /**
     * Load a skill
     */
    async loadSkill(name) {
        await this.sendRequest("skill/load", { name });
    }
    /**
     * Unload a skill
     */
    async unloadSkill(name) {
        await this.sendRequest("skill/unload", { name });
    }
    /**
     * Search templates
     */
    async searchTemplates(query) {
        const result = await this.sendRequest("template/search", { query });
        return result.templates || [];
    }
    /**
     * Install a template
     */
    async installTemplate(name, options) {
        await this.sendRequest("template/install", { name, ...options });
    }
    /**
     * Start a tree search
     */
    async startTreeSearch(task) {
        const result = await this.sendRequest("tree/start", { task });
        return result.searchId;
    }
    /**
     * Get tree search status
     */
    async getTreeSearchStatus(searchId) {
        return this.sendRequest("tree/status", { searchId });
    }
    /**
     * Get graph statistics
     */
    async getGraphStats() {
        const result = await this.sendRequest("graph/stats");
        return result;
    }
    /**
     * Get token usage statistics
     */
    async getTokenStats() {
        const result = await this.sendRequest("metrics/tokens");
        return result;
    }
    /**
     * Get health status
     */
    async getHealth() {
        const result = await this.sendRequest("health/check");
        return result;
    }
    /**
     * List personality presets
     */
    async listPersonalities() {
        const result = await this.sendRequest("personality/list");
        return result;
    }
    /**
     * Get current personality
     */
    async getPersonality() {
        const result = await this.sendRequest("personality/get");
        return result;
    }
    /**
     * Set personality preset
     */
    async setPersonality(name) {
        const result = await this.sendRequest("personality/set", { name });
        return result;
    }
    /**
     * Get soul.md edit path
     */
    async editPersonality() {
        const result = await this.sendRequest("personality/edit");
        return result;
    }
    /**
     * Handle incoming WebSocket message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                const pending = this.pendingRequests.get(message.id);
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(`${message.error.message} (${message.error.code})`));
                }
                else {
                    pending.resolve(message.result);
                }
            }
            else {
                // Emit unhandled messages
                this.emit("message", message);
            }
        }
        catch (err) {
            this.emit("error", new Error(`Failed to parse message: ${err}`));
        }
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
}
/**
 * Create a bridge client and connect
 */
export async function createBridgeClient(host = "localhost", port = 3100, token) {
    const url = `ws://${host}:${port}`;
    const client = new BridgeClient(url, token);
    await client.connect();
    return client;
}
//# sourceMappingURL=ws-client.js.map