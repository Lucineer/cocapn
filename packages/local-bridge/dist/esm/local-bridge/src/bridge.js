/**
 * Bridge — top-level orchestrator for the Cocapn local bridge.
 *
 * Wires together:
 *   - Config loader + SchemaValidator
 *   - SecretManager (age encryption + OS keychain)
 *   - GitSync + RepoWatcher
 *   - AgentRegistry (loads from cocapn/agents/, injects soul.md)
 *   - AgentSpawner + AgentRouter
 *   - CloudAdapterRegistry (optional, when mode !== "local")
 *   - AdmiralClient (optional, for cross-device session sync)
 *   - BridgeServer (WebSocket with GitHub PAT auth)
 *   - Optional Cloudflare tunnel via cloudflared
 */
import { readFileSync, existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import { loadConfig } from "./config/loader.js";
import { GitSync } from "./git/sync.js";
import { RepoWatcher } from "./git/watcher.js";
import { AgentSpawner } from "./agents/spawner.js";
import { AgentRegistry } from "./agents/registry.js";
import { AgentRouter } from "./agents/router.js";
import { BridgeServer } from "./ws/server.js";
import { SecretManager } from "./secret-manager.js";
import { SchemaValidator } from "./schema-validator.js";
import { CloudAdapterRegistry, } from "./CloudAdapter.js";
import { ModuleManager } from "./modules/manager.js";
import { FleetKeyManager } from "./security/fleet.js";
import { Brain } from "./brain/index.js";
import { ConversationMemory } from "./brain/conversation-memory.js";
import { Publisher } from "./publishing/publisher.js";
import { SkillLoader } from "./skills/loader.js";
import { SkillDecisionTree } from "./skills/decision-tree.js";
import { RepoGraph } from "./graph/index.js";
import { SelfAssembler, SelfAssembler as AssemblySystem } from "./assembly/index.js";
import { CloudConnector } from "./cloud-bridge/connector.js";
import { LLMRouter } from "./llm/index.js";
import { destroyAllAgents } from "./llm/keep-alive.js";
import { PersonalityManager } from "./personality/index.js";
import { Telemetry, getSystemProperties } from "./telemetry/index.js";
import { RequestQueue } from "./queue/index.js";
import { TenantRegistry } from "./multi-tenant/tenant-registry.js";
import { TenantBridge } from "./multi-tenant/tenant-bridge.js";
export class Bridge {
    options;
    config;
    validator;
    secrets;
    sync;
    watcher;
    spawner;
    registry;
    router;
    server;
    cloudAdapters;
    admiral;
    instanceId;
    modules;
    fleetKeys;
    fleetKey;
    brain;
    publisher;
    skillLoader;
    decisionTree;
    repoGraph;
    assembly;
    assembler;
    cloudConnector;
    llmRouter;
    personalityManager;
    telemetry;
    tenantRegistry;
    tenantBridge;
    requestQueue;
    constructor(options) {
        this.options = options;
        this.instanceId = `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.validator = new SchemaValidator();
        this.config = loadConfig(options.privateRepoRoot);
        // Initialize self-assembly system
        this.assembler = new SelfAssembler(options.privateRepoRoot);
        if (options.port !== undefined) {
            this.config = {
                ...this.config,
                config: { ...this.config.config, port: options.port },
            };
        }
        this.secrets = new SecretManager(options.privateRepoRoot);
        this.sync = new GitSync(options.privateRepoRoot, this.config);
        this.modules = new ModuleManager(options.privateRepoRoot);
        this.repoGraph = new RepoGraph(options.privateRepoRoot);
        this.brain = new Brain(options.privateRepoRoot, this.config, this.sync, this.repoGraph);
        this.fleetKeys = new FleetKeyManager(options.privateRepoRoot);
        // Initialize skill system
        this.skillLoader = new SkillLoader({
            maxColdSkills: 20,
            maxMemoryBytes: 50 * 1024,
            skillPaths: [join(options.privateRepoRoot, 'cocapn', 'modules')],
        });
        this.decisionTree = new SkillDecisionTree();
        this.watcher = new RepoWatcher([options.privateRepoRoot], this.config, this.sync);
        this.spawner = new AgentSpawner();
        this.registry = new AgentRegistry(this.validator);
        this.registry.loadFromPrivateRepo(options.privateRepoRoot, this.config.soul);
        this.registry.loadFromPublicConfig(options.publicRepoRoot);
        // Load cloud config and wire CloudAdapterRegistry if present
        this.cloudAdapters = this.loadCloudAdapters(options.privateRepoRoot);
        if (this.cloudAdapters) {
            this.registry.attachCloud(this.cloudAdapters);
        }
        // Initialize LLM router if LLM config is present
        this.llmRouter = this.initLLMRouter();
        // Initialize personality manager
        this.personalityManager = new PersonalityManager(this.brain, options.privateRepoRoot);
        // Initialize telemetry (opt-in, off by default)
        this.telemetry = new Telemetry();
        // Initialize multi-tenant system
        this.tenantRegistry = new TenantRegistry();
        this.tenantBridge = new TenantBridge(this.tenantRegistry, this.skillLoader);
        // Initialize LLM request queue with backpressure
        this.requestQueue = new RequestQueue();
        this.router = new AgentRouter({
            rules: [],
            strategy: "first-match",
            defaultAgent: undefined,
            fallbackAgent: undefined,
        }, this.registry, this.spawner, this.cloudAdapters);
        this.server = new BridgeServer({
            config: this.config,
            router: this.router,
            spawner: this.spawner,
            sync: this.sync,
            repoRoot: options.privateRepoRoot,
            skipAuth: options.skipAuth,
            cloudAdapters: this.cloudAdapters,
            moduleManager: this.modules,
            fleetKey: this.fleetKey,
            brain: this.brain,
            skillLoader: this.skillLoader,
            decisionTree: this.decisionTree,
            repoGraph: this.repoGraph,
            enablePeerApi: true,
            bridge: this,
            llmRouter: this.llmRouter,
            personalityManager: this.personalityManager,
            conversationMemory: new ConversationMemory(this.brain),
            tenantRegistry: this.tenantRegistry,
            tenantBridge: this.tenantBridge,
            requestQueue: this.requestQueue,
        });
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    async start() {
        console.info("[bridge] Starting Cocapn local bridge…");
        console.info(`[bridge] Mode:      ${this.config.config.mode}`);
        console.info(`[bridge] Port:      ${this.config.config.port}`);
        console.info(`[bridge] Repo:      ${this.options.privateRepoRoot}`);
        console.info(`[bridge] Auth:      ${this.options.skipAuth ? "disabled" : "GitHub PAT"}`);
        console.info(`[bridge] Cloud:     ${this.cloudAdapters ? "enabled" : "local-only"}`);
        console.info(`[bridge] Telemetry: ${this.telemetry.isEnabled() ? "enabled" : "disabled"}`);
        // Track bridge_start telemetry event
        this.telemetry.track("bridge_start", {
            ...getSystemProperties(),
            mode: this.config.config.mode,
        });
        // Run self-assembly on first run
        console.info("[bridge] Running self-assembly…");
        this.assembly = await this.assembler.assemble();
        console.info(AssemblySystem.formatStatus(this.assembly));
        await this.secrets.loadIdentity();
        // Load fleet key (used for JWT auth between fleet members)
        this.fleetKey = await this.fleetKeys.load((ct) => this.secrets.decrypt(ct));
        if (this.fleetKey) {
            console.info("[bridge] Fleet key loaded — JWT auth enabled");
            // Inject into running server options (server not yet started)
            this.server["options"].fleetKey = this.fleetKey;
        }
        // Initialize CloudConnector if we have cloud adapters configured
        const cloudWorkerUrl = this.getCloudWorkerUrl();
        if (cloudWorkerUrl && this.fleetKey) {
            const connectorConfig = {
                workerUrl: cloudWorkerUrl,
                fleetJwtSecret: this.fleetKey,
                instanceId: this.instanceId,
                bridgeMode: this.config.config.mode,
                heartbeatInterval: 30000,
            };
            this.cloudConnector = new CloudConnector(connectorConfig);
            console.info(`[bridge] Cloud connector initialized: ${cloudWorkerUrl}`);
            // Start heartbeat and expose to server
            this.cloudConnector.startHeartbeat();
            this.server.cloudConnector = this.cloudConnector;
            // Auto-ping on startup
            const pingResult = await this.cloudConnector.ping();
            if (pingResult) {
                console.info("[bridge] Cloud worker connection established");
            }
            else {
                console.warn("[bridge] Cloud worker unreachable - will retry");
            }
        }
        await this.sync.pull();
        this.sync.startTimers();
        this.watcher.start();
        // Register built-in skills from modules directory
        const modulesDir = join(this.options.privateRepoRoot, 'cocapn', 'modules');
        if (existsSync(modulesDir)) {
            const registered = await this.skillLoader.registerDirectory(modulesDir);
            console.info(`[bridge] Registered ${registered} skill cartridges from ${modulesDir}`);
            // Rebuild decision tree with registered skills
            const allSkills = this.skillLoader.getAll();
            this.decisionTree.rebuild(allSkills);
        }
        this.server.start();
        // ── auto-publisher integration ───────────────────────────────────────────
        const publisherMod = this.modules.get("auto-publisher");
        if (publisherMod?.status === "enabled") {
            this.publisher = new Publisher({
                privateRepoRoot: this.options.privateRepoRoot,
                publicRepoRoot: this.options.publicRepoRoot,
            }, this.sync);
            console.info("[bridge] auto-publisher active — writing to:", this.options.publicRepoRoot);
        }
        // ── Git sync event logging ───────────────────────────────────────────────
        this.sync.on("committed", (msg, files) => {
            console.info(`[git] Committed: ${msg} (${files.length} files)`);
            // Notify Admiral DO so cloud agents know the repo changed
            void this.notifyAdmiralCommit();
        });
        this.sync.on("pushed", () => console.info("[git] Pushed to remote"));
        this.sync.on("pulled", () => console.info("[git] Pulled from remote"));
        this.sync.on("conflict", (files) => console.warn(`[git] Merge conflicts written to: ${files.join(", ")}`));
        this.sync.on("error", (err) => console.error("[git] Error:", err));
        // ── Admiral heartbeat (every 60s when cloud is configured) ───────────────
        if (this.admiral) {
            const beat = () => void this.admiral?.heartbeat({
                instanceId: this.instanceId,
                hostname: process.env["HOSTNAME"] ?? "local",
                repoRoot: this.options.privateRepoRoot,
            });
            beat();
            setInterval(beat, 60_000);
        }
    }
    /**
     * Graceful shutdown — closes WebSocket connections with a 'shutdown' event,
     * waits for pending LLM requests to complete (with timeout), flushes
     * analytics/telemetry, cleans up temp files, and logs shutdown status.
     */
    async shutdown(timeoutMs = 30_000) {
        console.info("[bridge] Shutting down gracefully…");
        const deadline = Date.now() + timeoutMs;
        // 1. Stop accepting new connections and broadcast shutdown event
        console.info("[bridge] Closing WebSocket connections…");
        await this.server.shutdown();
        // 2. Stop git sync timers and file watcher
        this.sync.stopTimers();
        await this.watcher.stop();
        // 3. Stop spawning new agents
        await this.spawner.stopAll();
        // 4. Destroy cloud connector
        this.cloudConnector?.destroy();
        // 5. Wait for pending LLM requests to drain (with timeout)
        console.info("[bridge] Waiting for pending LLM requests…");
        const drainDeadline = Math.max(deadline - Date.now(), 1_000);
        await this.requestQueue.shutdown();
        destroyAllAgents();
        const elapsed = Date.now();
        if (elapsed < deadline) {
            console.info(`[bridge] LLM requests drained in ${elapsed - (deadline - timeoutMs)}ms`);
        }
        else {
            console.warn("[bridge] LLM drain timed out — forcing shutdown");
        }
        // 6. Flush analytics/telemetry
        console.info("[bridge] Flushing telemetry…");
        await this.telemetry.shutdown();
        // 7. Stop the HTTP server (already done by server.shutdown, but ensure clean)
        await this.server.stop();
        // 8. Clean up temp files created by this bridge instance
        this.cleanupTempFiles();
        // 9. Clear sensitive caches
        this.secrets.clearCache();
        console.info("[bridge] Shutdown complete.");
    }
    /**
     * Legacy stop method — delegates to shutdown for backward compatibility.
     */
    async stop() {
        await this.shutdown();
    }
    /**
     * Remove temp files created by this bridge instance.
     */
    cleanupTempFiles() {
        const prefix = `cocapn-${this.instanceId}`;
        try {
            const tmpFiles = readdirSync(tmpdir());
            for (const file of tmpFiles) {
                if (file.startsWith(prefix)) {
                    try {
                        rmSync(join(tmpdir(), file), { force: true });
                    }
                    catch {
                        // Best-effort cleanup
                    }
                }
            }
        }
        catch {
            // tmpdir() unavailable — skip
        }
    }
    getConfig() { return this.config; }
    getSecrets() { return this.secrets; }
    getCloudAdapters() { return this.cloudAdapters; }
    getAssembly() { return this.assembly; }
    getLLMRouter() { return this.llmRouter; }
    getTelemetry() { return this.telemetry; }
    getRequestQueue() { return this.requestQueue; }
    // ---------------------------------------------------------------------------
    // LLM initialization
    // ---------------------------------------------------------------------------
    initLLMRouter() {
        const llmConfig = this.config.llm;
        if (!llmConfig?.providers)
            return undefined;
        // Check that at least one provider has an API key
        const hasAnyKey = Object.values(llmConfig.providers).some((p) => p && p.apiKey);
        if (!hasAnyKey)
            return undefined;
        const routerConfig = {
            providers: {},
            ...(llmConfig.defaultModel ? { defaultModel: llmConfig.defaultModel } : {}),
            ...(llmConfig.fallbackModels ? { fallbackModels: llmConfig.fallbackModels } : {}),
            ...(llmConfig.timeout ? { timeout: llmConfig.timeout } : {}),
        };
        if (llmConfig.providers.deepseek?.apiKey) {
            routerConfig.providers.deepseek = {
                apiKey: llmConfig.providers.deepseek.apiKey,
                baseUrl: llmConfig.providers.deepseek.baseUrl,
            };
        }
        if (llmConfig.providers.openai?.apiKey) {
            routerConfig.providers.openai = {
                apiKey: llmConfig.providers.openai.apiKey,
                baseUrl: llmConfig.providers.openai.baseUrl,
            };
        }
        if (llmConfig.providers.anthropic?.apiKey) {
            routerConfig.providers.anthropic = {
                apiKey: llmConfig.providers.anthropic.apiKey,
                baseUrl: llmConfig.providers.anthropic.baseUrl,
            };
        }
        const router = new LLMRouter(routerConfig);
        console.info(`[bridge] LLM router initialized: ${router.getAvailableModels().join(', ')}`);
        return router;
    }
    // ---------------------------------------------------------------------------
    // Cloud config loading
    // ---------------------------------------------------------------------------
    loadCloudAdapters(repoRoot) {
        const cloudYmlPath = join(repoRoot, "cocapn", "cocapn-cloud.yml");
        if (!existsSync(cloudYmlPath))
            return undefined;
        let raw;
        try {
            raw = parseYaml(readFileSync(cloudYmlPath, "utf8"));
        }
        catch {
            console.warn("[bridge] Failed to parse cocapn-cloud.yml");
            return undefined;
        }
        const yml = raw;
        const cf = yml.cloudflare;
        if (!cf?.workers?.length)
            return undefined;
        const cloudConfig = {
            accountId: cf.accountId ?? "",
            apiToken: cf.apiToken,
            workers: cf.workers.map((w) => ({
                agentId: w.agentId,
                workerUrl: w.workerUrl,
            })),
            admiralUrl: cf.admiralUrl,
        };
        console.info(`[bridge] Cloud workers: ${cloudConfig.workers.map((w) => w.agentId).join(", ")}`);
        // Build Admiral client if configured
        if (cloudConfig.admiralUrl) {
            // Inline import to avoid hard dependency on cloud-agents package
            this.admiral = this.makeAdmiralClient(cloudConfig.admiralUrl, cloudConfig.apiToken);
        }
        return new CloudAdapterRegistry(cloudConfig);
    }
    makeAdmiralClient(admiralUrl, token) {
        return {
            heartbeat: async (hb) => {
                try {
                    await fetch(`${admiralUrl}/heartbeat`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify(hb),
                    });
                }
                catch { /* non-fatal */ }
            },
            notifyGitCommit: async (sha) => {
                try {
                    await fetch(`${admiralUrl}/notify`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ sha }),
                    });
                }
                catch { /* non-fatal */ }
            },
        };
    }
    async notifyAdmiralCommit() {
        if (!this.admiral)
            return;
        try {
            // Read latest commit SHA from git
            const result = await this.sync.latestCommitSha();
            if (result)
                await this.admiral.notifyGitCommit(result);
        }
        catch { /* non-fatal */ }
    }
    // ---------------------------------------------------------------------------
    // Cloud connector helpers
    // ---------------------------------------------------------------------------
    /**
     * Get the cloud worker URL from cloud adapters config.
     * Returns the first worker URL or undefined if not configured.
     */
    getCloudWorkerUrl() {
        if (!this.cloudAdapters)
            return undefined;
        const adapters = this.cloudAdapters.getAll();
        if (adapters.length === 0)
            return undefined;
        // Return the first worker URL
        return adapters[0].getWorkerUrl();
    }
    /**
     * Get the CloudConnector instance.
     * Used by handlers and for testing.
     */
    getCloudConnector() {
        return this.cloudConnector;
    }
}
//# sourceMappingURL=bridge.js.map