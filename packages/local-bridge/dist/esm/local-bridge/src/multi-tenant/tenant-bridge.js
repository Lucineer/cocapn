/**
 * TenantBridge — creates and manages tenant-scoped contexts.
 *
 * Each tenant gets:
 *   - An isolated Brain instance (own facts, wiki, tasks, soul.md)
 *   - A PersonalityManager (tenant-specific or shared)
 *   - A filtered view of the skill system
 *
 * Tenant brains are backed by their own git repos for data isolation.
 */
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { simpleGit } from "simple-git";
import { Brain } from "../brain/index.js";
import { GitSync } from "../git/sync.js";
import { PersonalityManager } from "../personality/index.js";
import { SkillLoader } from "../skills/loader.js";
import { loadConfig } from "../config/loader.js";
export class TenantBridge {
    registry;
    contexts = new Map();
    sharedSkillLoader;
    constructor(registry, sharedSkillLoader) {
        this.registry = registry;
        this.sharedSkillLoader = sharedSkillLoader;
    }
    /**
     * Create a tenant-scoped context with isolated brain, personality, and skills.
     * Caches the context for subsequent calls.
     */
    async createContext(tenantId) {
        // Return cached context if available
        const cached = this.contexts.get(tenantId);
        if (cached)
            return cached;
        const tenant = await this.registry.getTenant(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        const context = await this.buildContext(tenant);
        this.contexts.set(tenantId, context);
        return context;
    }
    /**
     * Process a chat message for a specific tenant.
     * Returns the agent's response string.
     */
    async chat(tenantId, message) {
        const ctx = await this.createContext(tenantId);
        // Record usage (estimate ~4 chars per token)
        const estimatedTokens = Math.ceil(message.length / 4);
        await this.registry.recordUsage(tenantId, estimatedTokens);
        // Build context snapshot for the tenant's brain
        const contextSnapshot = ctx.brain.buildContext();
        // For now, return a context-enriched echo.
        // Full agent integration would route through AgentRouter.
        const soul = ctx.brain.getSoul();
        const factCount = Object.keys(ctx.brain.getAllFacts()).length;
        const wikiPages = ctx.brain.listWikiPages().length;
        return JSON.stringify({
            tenantId,
            message,
            soulLength: soul.length,
            factCount,
            wikiPages,
            contextSnapshot,
        });
    }
    /**
     * Get status for a specific tenant.
     */
    async getStatus(tenantId) {
        const tenant = await this.registry.getTenant(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        let brainSize = 0;
        let factCount = 0;
        let wikiPages = 0;
        let activeTasks = 0;
        let initialized = false;
        try {
            const ctx = await this.createContext(tenantId);
            initialized = true;
            const facts = ctx.brain.getAllFacts();
            factCount = Object.keys(facts).length;
            wikiPages = ctx.brain.listWikiPages().length;
            activeTasks = ctx.brain.listTasks().filter((t) => t.status === "active").length;
            // Estimate brain size from context snapshot
            const snapshot = ctx.brain.buildContext();
            brainSize = Buffer.byteLength(snapshot, "utf8");
        }
        catch {
            // Tenant exists but brain not yet initialized
        }
        return {
            tenant,
            initialized,
            brainSize,
            factCount,
            wikiPages,
            activeTasks,
        };
    }
    /**
     * Initialize a tenant's isolated brain directory and git repo.
     * Called once when a tenant is first created.
     */
    async initializeTenant(tenantId) {
        const tenant = await this.registry.getTenant(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        // Initialize git repo if not already present
        const gitDir = join(tenant.brainPath, ".git");
        if (!existsSync(gitDir)) {
            await simpleGit(tenant.brainPath).init();
        }
        // Write default soul.md if not present
        if (!existsSync(tenant.personalityPath)) {
            const defaultSoul = tenant.config.customPersonality || `# ${tenant.name}\n\nA helpful AI assistant.`;
            writeFileSync(tenant.personalityPath, defaultSoul, "utf8");
        }
        // Write initial empty facts
        const factsDir = join(tenant.brainPath, "cocapn", "memory");
        const factsPath = join(factsDir, "facts.json");
        if (!existsSync(factsPath)) {
            mkdirSync(factsDir, { recursive: true });
            writeFileSync(factsPath, "{}\n", "utf8");
        }
        // Invalidate any cached context
        this.contexts.delete(tenantId);
    }
    /**
     * Dispose of a tenant's cached context.
     */
    disposeContext(tenantId) {
        this.contexts.delete(tenantId);
    }
    /**
     * Dispose all cached contexts.
     */
    disposeAll() {
        this.contexts.clear();
    }
    /**
     * Get the tenant registry.
     */
    getRegistry() {
        return this.registry;
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    async buildContext(tenant) {
        // Ensure tenant is initialized
        await this.initializeTenant(tenant.id);
        // Load config for the tenant's brain directory
        let config;
        try {
            config = loadConfig(tenant.brainPath);
        }
        catch {
            // Use minimal defaults if no config file exists
            config = this.minimalConfig();
        }
        // Create tenant-scoped GitSync
        const sync = new GitSync(tenant.brainPath, config);
        // Create tenant-scoped Brain
        const brain = new Brain(tenant.brainPath, config, sync);
        // Create tenant-scoped PersonalityManager
        const personality = new PersonalityManager(brain, tenant.brainPath);
        // Use shared skill loader or create a tenant-scoped one
        const skillSystem = this.sharedSkillLoader || new SkillLoader({
            maxColdSkills: 10,
            maxMemoryBytes: 25 * 1024,
            skillPaths: [],
        });
        return {
            tenant,
            brain,
            personality,
            skillSystem,
        };
    }
    minimalConfig() {
        return {
            soul: "soul.md",
            config: {
                mode: "local",
                port: 0,
                tunnel: undefined,
            },
            memory: {
                facts: "cocapn/memory/facts.json",
                procedures: "cocapn/memory/procedures",
                relationships: "cocapn/memory/relationships.json",
            },
            encryption: {
                publicKey: "",
                recipients: [],
                encryptedPaths: [],
            },
            sync: {
                interval: 300,
                memoryInterval: 60,
                autoCommit: true,
                autoPush: false,
            },
            vectorSearch: {
                enabled: false,
                provider: "local",
            },
        };
    }
}
//# sourceMappingURL=tenant-bridge.js.map