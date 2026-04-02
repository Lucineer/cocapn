/**
 * AgentSpawner — spawns CLI agent processes and connects them via MCP StdioTransport.
 *
 * New in this version:
 *   - Injects COCAPN_SOUL env var from soul.md content
 *   - Streams stderr back via an optional outputCallback
 *   - Cleans up sessions on disconnect via detachSession()
 */
import { spawn } from "child_process";
import { EventEmitter } from "events";
import { MCPClient, StdioTransport } from "@cocapn/protocols/mcp";
// ─── Environment variable filter ─────────────────────────────────────────────
//
// Agents only receive:
//   - Their own explicitly declared env vars (definition.env)
//   - COCAPN_* variables (injected context)
//   - A minimal set of system vars needed for the process to run
//
// This prevents agents from reading host secrets (API keys, AWS creds, etc.)
// that happen to be in the parent process environment.
const ALLOWED_ENV_PREFIXES = ["COCAPN_"];
const ALLOWED_ENV_EXACT = new Set([
    "PATH", "HOME", "USER", "LOGNAME", "SHELL",
    "TMPDIR", "TEMP", "TMP",
    "TERM", "COLORTERM",
    "LANG", "LC_ALL", "LC_CTYPE",
    "TZ",
    "NODE_PATH", "NODE_ENV",
    // Let agents find their own runtimes
    "npm_config_cache",
]);
export function filterEnv(parentEnv, agentEnv) {
    const filtered = {};
    for (const [k, v] of Object.entries(parentEnv)) {
        if (v === undefined)
            continue;
        const allowed = ALLOWED_ENV_EXACT.has(k) ||
            ALLOWED_ENV_PREFIXES.some((prefix) => k.startsWith(prefix));
        if (allowed)
            filtered[k] = v;
    }
    // Agent's own env overrides (always included)
    for (const [k, v] of Object.entries(agentEnv)) {
        filtered[k] = v;
    }
    return filtered;
}
export class AgentSpawner extends EventEmitter {
    agents = new Map();
    secretManager;
    constructor(secretManager) {
        super();
        this.secretManager = secretManager;
    }
    // ---------------------------------------------------------------------------
    // Spawn
    // ---------------------------------------------------------------------------
    /**
     * Spawn a local CLI agent and connect to it via MCP stdio.
     * COCAPN_SOUL is injected if provided in options.
     * stderr is forwarded to outputCallback and the `output` event.
     */
    async spawn(definition, options = {}) {
        if (this.agents.has(definition.id)) {
            throw new Error(`COCAPN-010: Agent already running: ${definition.id} - Stop the agent first with: cocapn-bridge agent stop ${definition.id} or check if another process is using it`);
        }
        // Resolve secret references in env vars (e.g., "secret:OPENAI_API_KEY")
        const agentEnv = {};
        for (const [key, value] of Object.entries(definition.env)) {
            if (value.startsWith("secret:")) {
                const secretKey = value.slice(7); // Remove "secret:" prefix
                const secretValue = this.secretManager ? await this.secretManager.getSecret(secretKey) : undefined;
                if (secretValue === undefined) {
                    throw new Error(`COCAPN-034: Secret '${secretKey}' not found - Add it with: cocapn-bridge secret add ${secretKey} <value>`);
                }
                agentEnv[key] = secretValue;
            }
            else {
                agentEnv[key] = value;
            }
        }
        if (options.soul)
            agentEnv["COCAPN_SOUL"] = options.soul;
        if (options.context)
            agentEnv["COCAPN_CONTEXT"] = options.context;
        const proc = spawn(definition.command, definition.args, {
            env: filterEnv(process.env, agentEnv),
            stdio: ["pipe", "pipe", "pipe"],
        });
        const stdinStream = proc.stdin;
        const stdoutStream = proc.stdout;
        const stderrStream = proc.stderr;
        if (!stdinStream || !stdoutStream) {
            proc.kill();
            throw new Error(`COCAPN-011: Agent ${definition.id}: failed to get stdio pipes - The agent process failed to start. Check the agent command is valid and executable`);
        }
        // Stream stderr to callback and emit event
        if (stderrStream) {
            stderrStream.setEncoding("utf8");
            stderrStream.on("data", (chunk) => {
                this.emit("output", definition.id, chunk, "stderr");
                options.outputCallback?.(chunk, "stderr");
            });
        }
        const transport = new StdioTransport({
            readable: stdoutStream,
            writable: stdinStream,
        });
        const client = new MCPClient({
            clientInfo: { name: "cocapn-bridge", version: "0.1.0" },
        });
        proc.on("exit", (code) => {
            this.agents.delete(definition.id);
            this.emit("stopped", definition.id, code);
        });
        proc.on("error", (err) => {
            this.emit("error", definition.id, err);
        });
        let serverInfo;
        try {
            serverInfo = await client.connect(transport);
        }
        catch (err) {
            proc.kill();
            throw new Error(`COCAPN-012: Agent ${definition.id}: failed to spawn - ${err instanceof Error ? err.message : String(err)} - Check the agent command, args, and working directory. Ensure the agent binary exists and is executable`);
        }
        const agent = {
            definition,
            process: proc,
            client,
            serverInfo,
            startedAt: new Date(),
            sessions: new Set(),
        };
        this.agents.set(definition.id, agent);
        this.emit("spawned", agent);
        return agent;
    }
    // ---------------------------------------------------------------------------
    // Session management
    // ---------------------------------------------------------------------------
    /** Associate a WebSocket session with a running agent. */
    attachSession(agentId, sessionId) {
        this.agents.get(agentId)?.sessions.add(sessionId);
    }
    /**
     * Detach a session from all agents it was using.
     * Stops agents that have no remaining sessions and are not shared.
     */
    async detachSession(sessionId) {
        for (const [agentId, agent] of this.agents) {
            agent.sessions.delete(sessionId);
            if (agent.sessions.size === 0) {
                // Stop single-session agents on disconnect to free resources
                await this.stop(agentId);
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    async stop(id) {
        const agent = this.agents.get(id);
        if (!agent)
            return;
        await agent.client.close();
        agent.process.kill("SIGTERM");
        this.agents.delete(id);
    }
    async stopAll() {
        await Promise.all([...this.agents.keys()].map((id) => this.stop(id)));
    }
    get(id) {
        return this.agents.get(id);
    }
    getAll() {
        return [...this.agents.values()];
    }
    // ---------------------------------------------------------------------------
    // Lazy spawning
    // ---------------------------------------------------------------------------
    /**
     * Check if an agent is currently spawned and ready.
     */
    isReady(id) {
        return this.agents.has(id);
    }
    /**
     * Ensure an agent is spawned, spawning it lazily if needed.
     * This is useful for agents with lazy=true that should only spawn on first use.
     *
     * Returns the spawned agent, or undefined if spawning failed.
     */
    async ensureSpawned(definition, options = {}) {
        // If already spawned, return it
        const existing = this.agents.get(definition.id);
        if (existing)
            return existing;
        // Otherwise spawn it now
        try {
            return await this.spawn(definition, options);
        }
        catch (err) {
            this.emit("error", definition.id, err instanceof Error ? err : new Error(String(err)));
            return undefined;
        }
    }
}
//# sourceMappingURL=spawner.js.map