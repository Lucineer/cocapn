/**
 * TenantRegistry — CRUD + usage tracking for multi-tenant brain isolation.
 *
 * Storage layout:
 *   <storagePath>/
 *     tenants.json          — { [tenantId]: Tenant } (source of truth)
 *     <tenantId>/
 *       brain/              — isolated brain directory (facts, wiki, tasks, soul.md)
 *       config.json         — tenant-specific overrides
 *
 * Usage metering:
 *   - Token/message counts are tracked in the Tenant object in tenants.json.
 *   - Daily counters reset when resetDailyUsage() is called (typically via scheduler).
 *   - recordUsage() atomically increments counters and persists.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, } from "fs";
import { join } from "path";
import crypto from "crypto";
import { PLAN_DEFAULTS, } from "./types.js";
// ─── Tenant registry file ───────────────────────────────────────────────────
const TENANTS_FILE = "tenants.json";
// ─── TenantRegistry ─────────────────────────────────────────────────────────
export class TenantRegistry {
    storagePath;
    tenants = new Map();
    /** Per-tenant mutex: serializes concurrent usage updates so counts don't race. */
    usageLocks = new Map();
    constructor(storagePath) {
        this.storagePath = storagePath || join(process.env["HOME"] || "/tmp", ".cocapn", "tenants");
        this.ensureStorageDir();
        this.load();
    }
    // ---------------------------------------------------------------------------
    // CRUD
    // ---------------------------------------------------------------------------
    /**
     * Create a new tenant with isolated storage.
     * Generates a UUID if no id is provided.
     */
    async createTenant(partial) {
        const id = partial.id || crypto.randomUUID();
        if (this.tenants.has(id)) {
            throw new Error(`Tenant already exists: ${id}`);
        }
        const plan = partial.plan || "free";
        const defaults = PLAN_DEFAULTS[plan];
        const config = {
            maxTokensPerDay: partial.config?.maxTokensPerDay ?? defaults.maxTokensPerDay,
            maxConcurrentSessions: partial.config?.maxConcurrentSessions ?? defaults.maxConcurrentSessions,
            enabledSkills: partial.config?.enabledSkills ?? defaults.enabledSkills,
            ...(partial.config?.customPersonality !== undefined
                ? { customPersonality: partial.config.customPersonality }
                : {}),
            allowedOrigins: partial.config?.allowedOrigins ?? partial.allowedOrigins ?? defaults.allowedOrigins,
        };
        const now = new Date().toISOString();
        const brainPath = join(this.storagePath, id, "brain");
        const personalityPath = join(brainPath, "soul.md");
        // Create isolated brain directory structure
        this.ensureDir(join(brainPath, "cocapn", "memory"));
        this.ensureDir(join(brainPath, "cocapn", "wiki"));
        this.ensureDir(join(brainPath, "cocapn", "tasks"));
        const tenant = {
            id,
            name: partial.name,
            plan,
            brainPath,
            personalityPath,
            config,
            createdAt: now,
            lastActive: now,
            usage: {
                tokensToday: 0,
                tokensTotal: 0,
                messagesToday: 0,
                messagesTotal: 0,
                lastReset: now,
            },
            allowedOrigins: config.allowedOrigins,
        };
        this.tenants.set(id, tenant);
        this.persist();
        return tenant;
    }
    /**
     * Get a tenant by ID. Returns null if not found.
     */
    async getTenant(tenantId) {
        return this.tenants.get(tenantId) ?? null;
    }
    /**
     * Update a tenant's metadata. Partial merge.
     */
    async updateTenant(tenantId, updates) {
        const existing = this.tenants.get(tenantId);
        if (!existing) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        if (updates.name !== undefined)
            existing.name = updates.name;
        if (updates.plan !== undefined) {
            existing.plan = updates.plan;
        }
        if (updates.config !== undefined) {
            existing.config = { ...existing.config, ...updates.config };
        }
        // When plan changes, reset config to new plan defaults, then overlay custom values
        if (updates.plan !== undefined) {
            const planDefaults = PLAN_DEFAULTS[existing.plan];
            const customOverrides = updates.config || {};
            existing.config = { ...planDefaults, ...customOverrides };
        }
        if (updates.allowedOrigins !== undefined) {
            existing.allowedOrigins = updates.allowedOrigins;
        }
        existing.lastActive = new Date().toISOString();
        this.tenants.set(tenantId, existing);
        this.persist();
        return existing;
    }
    /**
     * Delete a tenant and its isolated storage.
     */
    async deleteTenant(tenantId) {
        const existing = this.tenants.get(tenantId);
        if (!existing) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        // Remove isolated brain directory
        const tenantDir = join(this.storagePath, tenantId);
        if (existsSync(tenantDir)) {
            rmSync(tenantDir, { recursive: true, force: true });
        }
        this.tenants.delete(tenantId);
        this.persist();
    }
    /**
     * List all tenants.
     */
    async listTenants() {
        return Array.from(this.tenants.values());
    }
    // ---------------------------------------------------------------------------
    // Usage tracking
    // ---------------------------------------------------------------------------
    /**
     * Record token usage for a tenant. Persists atomically.
     * Uses a per-tenant mutex to prevent lost increments under concurrency.
     * Throws if tenant not found or daily limit exceeded.
     */
    async recordUsage(tenantId, tokens) {
        // Chain onto the existing lock (if any) for this tenant
        const prior = this.usageLocks.get(tenantId) ?? Promise.resolve();
        let resolve;
        const current = new Promise((r) => { resolve = r; });
        this.usageLocks.set(tenantId, current);
        await prior;
        try {
            const tenant = this.tenants.get(tenantId);
            if (!tenant) {
                throw new Error(`Tenant not found: ${tenantId}`);
            }
            // Check daily limit (0 = unlimited)
            if (tenant.config.maxTokensPerDay > 0 &&
                tenant.usage.tokensToday + tokens > tenant.config.maxTokensPerDay) {
                throw new Error(`Daily token limit exceeded for tenant ${tenantId}: ` +
                    `${tenant.usage.tokensToday + tokens} > ${tenant.config.maxTokensPerDay}`);
            }
            tenant.usage.tokensToday += tokens;
            tenant.usage.tokensTotal += tokens;
            tenant.usage.messagesToday += 1;
            tenant.usage.messagesTotal += 1;
            tenant.lastActive = new Date().toISOString();
            this.tenants.set(tenantId, tenant);
            this.persist();
        }
        finally {
            resolve();
            // Clean up the lock entry if we were the last writer
            if (this.usageLocks.get(tenantId) === current) {
                this.usageLocks.delete(tenantId);
            }
        }
    }
    /**
     * Get current usage for a tenant.
     */
    async getUsage(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        return { ...tenant.usage };
    }
    /**
     * Reset daily usage counters for all tenants.
     * Should be called once per day (e.g. via scheduler at midnight).
     */
    async resetDailyUsage() {
        const now = new Date().toISOString();
        for (const tenant of this.tenants.values()) {
            tenant.usage.tokensToday = 0;
            tenant.usage.messagesToday = 0;
            tenant.usage.lastReset = now;
        }
        this.persist();
    }
    // ---------------------------------------------------------------------------
    // Tenant resolution
    // ---------------------------------------------------------------------------
    /**
     * Resolve a tenant from request context.
     *
     * Resolution order:
     *   1. Explicit X-Tenant-ID header
     *   2. API key match
     *   3. Origin match
     */
    async resolveTenant(request) {
        // 1. Explicit tenant ID
        if (request.tenantId) {
            return this.tenants.get(request.tenantId) ?? null;
        }
        // 2. API key match
        if (request.apiKey) {
            for (const tenant of this.tenants.values()) {
                if (tenant.apiKey === request.apiKey) {
                    return tenant;
                }
            }
        }
        // 3. Origin match
        if (request.origin) {
            for (const tenant of this.tenants.values()) {
                if (tenant.allowedOrigins.includes(request.origin)) {
                    return tenant;
                }
            }
        }
        return null;
    }
    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------
    load() {
        const filePath = join(this.storagePath, TENANTS_FILE);
        if (!existsSync(filePath))
            return;
        try {
            const raw = readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw || "{}");
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                for (const [id, tenant] of Object.entries(parsed)) {
                    this.tenants.set(id, tenant);
                }
            }
        }
        catch {
            console.warn("[multi-tenant] Failed to load tenants.json, starting fresh");
        }
    }
    persist() {
        const filePath = join(this.storagePath, TENANTS_FILE);
        const data = {};
        for (const [id, tenant] of this.tenants) {
            data[id] = tenant;
        }
        writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
    ensureStorageDir() {
        this.ensureDir(this.storagePath);
    }
    ensureDir(dir) {
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
    }
}
//# sourceMappingURL=tenant-registry.js.map