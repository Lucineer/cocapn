/**
 * CloudAdapter — routes tasks to cloud Cloudflare Worker agents via A2A protocol.
 *
 * Implements the same AgentAdapter interface used internally by AgentSpawner so
 * the router can treat cloud agents identically to local processes.
 *
 * Graceful degradation:
 *   - If the cloud endpoint is unreachable, reachable() returns false immediately
 *     (short 3s timeout, no retries) so the router can fall back locally.
 *   - All errors are caught and surfaced as structured results rather than throws,
 *     so a cloud outage never crashes the local bridge.
 *
 * Authentication:
 *   - Reads Cloudflare credentials from the SecretManager (age-encrypted in repo).
 *   - Sends the GitHub PAT stored in the session as a Bearer token so cloud agents
 *     can read from the private repo when they need context.
 *
 * Registry:
 *   - Registers user profiles with AdmiralDO for cross-domain discovery.
 *   - Called when Publisher exports a profile with discovery: true.
 */
import { A2AClient } from "@cocapn/protocols/a2a";
// ─── CloudAdapter ─────────────────────────────────────────────────────────────
const REACHABILITY_TIMEOUT_MS = 3_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_MAX_ATTEMPTS = 60; // 2 min total
export class CloudAdapter {
    workerUrl;
    client;
    agentId;
    constructor(config) {
        this.agentId = config.agentId;
        this.workerUrl = config.workerUrl;
        // Forward the GitHub PAT as Bearer token so cloud Workers can call GitHub API
        const token = config.githubToken ?? config.cfApiToken;
        this.client = new A2AClient({
            baseUrl: config.workerUrl,
            ...(token ? { authToken: token } : {}),
        });
    }
    // ── Reachability check ────────────────────────────────────────────────────
    /**
     * Returns true if the cloud worker responds to its agent card endpoint
     * within REACHABILITY_TIMEOUT_MS.  Never throws.
     */
    async reachable() {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
            const res = await fetch(`${this.workerUrl}/.well-known/agent.json`, { signal: controller.signal });
            clearTimeout(timer);
            return res.ok;
        }
        catch {
            return false;
        }
    }
    // ── Send a task (fire-and-poll) ───────────────────────────────────────────
    /**
     * Send a task to the cloud agent and poll until it reaches a terminal state.
     * Streams progress chunks to `outputCallback` if provided.
     */
    async sendTask(taskDescription, outputCallback, sessionId) {
        let task;
        const message = {
            role: "user",
            parts: [{ type: "text", text: taskDescription }],
        };
        try {
            task = await this.client.sendTask({
                id: `${this.agentId}-${Date.now()}`,
                message,
                ...(sessionId ? { metadata: { sessionId } } : {}),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[cloud] Failed to send task to ${this.agentId}: ${msg}`);
            return { task: undefined, reached: false, error: msg };
        }
        // Poll until terminal
        task = await this.pollUntilDone(task, outputCallback);
        return { task, reached: true, error: undefined };
    }
    // ── Send a task with SSE streaming ────────────────────────────────────────
    /**
     * Stream a task to the cloud agent via Server-Sent Events.
     * Yields each TaskStreamEvent as it arrives.
     */
    async *streamTask(taskDescription, sessionId) {
        const message = {
            role: "user",
            parts: [{ type: "text", text: taskDescription }],
        };
        try {
            yield* this.client.sendTaskStream({
                id: `${this.agentId}-${Date.now()}`,
                message,
                ...(sessionId ? { metadata: { sessionId } } : {}),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[cloud] Stream failed for ${this.agentId}: ${msg}`);
            return { task: undefined, reached: false, error: msg };
        }
        return { task: undefined, reached: true, error: undefined };
    }
    // ── Cancel ────────────────────────────────────────────────────────────────
    async cancelTask(taskId) {
        try {
            await this.client.cancelTask({ id: taskId });
            return true;
        }
        catch {
            return false;
        }
    }
    // ── Accessors ─────────────────────────────────────────────────────────────
    getAgentId() { return this.agentId; }
    getWorkerUrl() { return this.workerUrl; }
    // ── Registry registration ───────────────────────────────────────────────────
    /**
     * Register a profile with the AdmiralDO discovery registry.
     *
     * Called when Publisher exports a profile with discovery: true.
     * Converts the SignedProfile to a RegistryProfile and sends it to Admiral.
     *
     * Returns the peer count (number of registered users) or undefined on failure.
     */
    async registerWithAdmiral(signedProfile) {
        if (!this.workerUrl)
            return undefined;
        try {
            // Convert SignedProfile to RegistryProfile format
            const registryProfile = {
                username: signedProfile.profile.displayName ?? "unknown",
                displayName: signedProfile.profile.displayName,
                currentFocus: signedProfile.profile.currentProject,
                website: signedProfile.profile.website,
                bio: signedProfile.profile.bio,
                domains: signedProfile.profile.domains,
                signature: signedProfile.signature,
            };
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
            const res = await fetch(`${this.workerUrl}/registry/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: registryProfile }),
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok)
                return undefined;
            const result = await res.json();
            return result.peerCount;
        }
        catch (err) {
            console.warn(`[cloud] Failed to register with Admiral:`, err);
            return undefined;
        }
    }
    // ── Internal ──────────────────────────────────────────────────────────────
    async pollUntilDone(initial, outputCallback, intervalMs = DEFAULT_POLL_INTERVAL_MS, maxAttempts = DEFAULT_POLL_MAX_ATTEMPTS) {
        let task = initial;
        const TERMINAL = new Set(["completed", "failed", "cancelled", "rejected"]);
        let lastOutputLen = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (TERMINAL.has(task.status.state))
                break;
            await sleep(intervalMs);
            try {
                task = await this.client.getTask({ id: task.id });
            }
            catch (err) {
                console.warn(`[cloud] Poll failed for task ${task.id}:`, err);
                break;
            }
            // Stream any new text parts to outputCallback
            if (outputCallback && task.status.message?.parts) {
                const parts = task.status.message.parts;
                for (let i = lastOutputLen; i < parts.length; i++) {
                    const part = parts[i];
                    if (part?.type === "text" && part.text) {
                        outputCallback(part.text, "stdout");
                    }
                }
                lastOutputLen = parts.length;
            }
        }
        return task;
    }
}
export class CloudAdapterRegistry {
    adapters = new Map();
    config;
    githubToken;
    constructor(config, githubToken) {
        this.config = config;
        this.githubToken = githubToken;
        this.init();
    }
    init() {
        for (const worker of this.config.workers) {
            const adapter = new CloudAdapter({
                agentId: worker.agentId,
                workerUrl: worker.workerUrl,
                cfApiToken: this.config.apiToken,
                githubToken: this.githubToken,
            });
            this.adapters.set(worker.agentId, adapter);
        }
    }
    get(agentId) {
        return this.adapters.get(agentId);
    }
    getAll() {
        return [...this.adapters.values()];
    }
    /** Check all workers in parallel; return ids of reachable ones. */
    async reachableAgents() {
        const results = await Promise.all([...this.adapters.entries()].map(async ([id, adapter]) => ({
            id,
            ok: await adapter.reachable(),
        })));
        return results.filter((r) => r.ok).map((r) => r.id);
    }
    /** Update the GitHub token (e.g., after a new PAT is set in a session). */
    setGitHubToken(token) {
        this.githubToken = token;
        this.init(); // re-create adapters with new token
    }
    /**
     * Register a profile with all AdmiralDO instances.
     *
     * Returns the highest peer count from all successful registrations,
     * or undefined if all registrations fail.
     */
    async registerWithAdmiral(signedProfile) {
        const results = await Promise.all([...this.adapters.values()].map((adapter) => adapter.registerWithAdmiral(signedProfile)));
        // Return the highest peer count from successful registrations
        const validResults = results.filter((r) => r !== undefined);
        if (validResults.length === 0)
            return undefined;
        return Math.max(...validResults);
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=CloudAdapter.js.map