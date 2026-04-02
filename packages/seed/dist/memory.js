/**
 * Memory — two-tier persistent memory for cocapn.
 *
 * Hot tier: JSON file for recent facts and messages (<100)
 * Cold tier: git log for long-term recall
 *
 * Zero dependencies. Uses only Node.js built-ins.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
// ─── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_MEMORY = { messages: [], facts: {}, users: {}, userFacts: {} };
const MAX_MESSAGES = 100;
// ─── Memory class ──────────────────────────────────────────────────────────────
export class Memory {
    path;
    data;
    repoDir;
    constructor(repoDir) {
        this.repoDir = repoDir;
        const dir = join(repoDir, '.cocapn');
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        this.path = join(dir, 'memory.json');
        this.data = this.load();
    }
    get messages() {
        return this.data.messages;
    }
    get facts() {
        return this.data.facts;
    }
    /** Get last N messages for LLM context */
    recent(n = 20) {
        return this.data.messages.slice(-n);
    }
    /** Add a message and persist */
    addMessage(role, content, userId) {
        this.data.messages.push({ role, content, ts: new Date().toISOString(), userId });
        // Trim to max
        if (this.data.messages.length > MAX_MESSAGES) {
            this.data.messages = this.data.messages.slice(-MAX_MESSAGES);
        }
        // Update user stats
        if (userId && this.data.users[userId]) {
            this.data.users[userId].messageCount++;
            this.data.users[userId].lastSeen = new Date().toISOString();
        }
        this.save();
    }
    /** Format recent messages as LLM context */
    formatContext(n = 20) {
        const msgs = this.recent(n);
        if (msgs.length === 0)
            return '';
        return msgs
            .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
            .join('\n\n');
    }
    /** Format facts as LLM context */
    formatFacts() {
        const entries = Object.entries(this.data.facts);
        if (entries.length === 0)
            return '';
        return 'Known facts:\n' + entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
    }
    /** Clear all messages and facts */
    clear() {
        this.data = { messages: [], facts: {}, users: {}, userFacts: {} };
        this.save();
    }
    /** Search hot (JSON) + cold (git) memory for a query */
    search(query) {
        const q = query.toLowerCase();
        return {
            messages: this.data.messages.filter(m => m.content.toLowerCase().includes(q)),
            facts: Object.entries(this.data.facts)
                .filter(([, v]) => v.toLowerCase().includes(q))
                .map(([key, value]) => ({ key, value })),
            gitLog: this.searchGit(query),
        };
    }
    /** Cold tier: search git log for keywords */
    searchGit(query) {
        try {
            const raw = execSync(`git log --grep=${JSON.stringify(query)} --oneline -20`, {
                cwd: this.repoDir, encoding: 'utf-8', timeout: 5000,
            }).trim();
            return raw ? raw.split('\n').filter(Boolean) : [];
        }
        catch {
            return [];
        }
    }
    // ── Multi-user methods ──────────────────────────────────────────────────────
    /** Get or create a user record */
    getOrCreateUser(userId, name) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {
                name: name ?? userId,
                lastSeen: new Date().toISOString(),
                messageCount: 0,
                preferences: {},
            };
            this.save();
        }
        return this.data.users[userId];
    }
    /** List all known users */
    getUsers() {
        return Object.entries(this.data.users).map(([id, u]) => ({ id, ...u }));
    }
    /** Get messages visible to a specific user (their own + system/assistant) */
    recentForUser(userId, n = 20) {
        return this.data.messages
            .filter(m => !m.userId || m.userId === userId)
            .slice(-n);
    }
    /** Get facts for a user: global + user-specific merged */
    getFactsForUser(userId) {
        const userFacts = this.data.userFacts[userId] ?? {};
        return { ...this.data.facts, ...userFacts };
    }
    /** Set a user-specific fact */
    setUserFact(userId, key, value) {
        if (!this.data.userFacts[userId])
            this.data.userFacts[userId] = {};
        this.data.userFacts[userId][key] = value;
        this.save();
    }
    /** Format facts for a specific user (global + user-specific) */
    formatFactsForUser(userId) {
        const facts = this.getFactsForUser(userId);
        const entries = Object.entries(facts);
        if (entries.length === 0)
            return '';
        return 'Known facts:\n' + entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
    }
    // ── Persistence ──────────────────────────────────────────────────────────────
    load() {
        if (!existsSync(this.path))
            return { messages: [], facts: {}, users: {}, userFacts: {} };
        try {
            const raw = readFileSync(this.path, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                messages: Array.isArray(parsed.messages) ? parsed.messages : [],
                facts: parsed.facts && typeof parsed.facts === 'object' ? parsed.facts : {},
                users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
                userFacts: parsed.userFacts && typeof parsed.userFacts === 'object' ? parsed.userFacts : {},
            };
        }
        catch {
            return { messages: [], facts: {}, users: {}, userFacts: {} };
        }
    }
    save() {
        writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8');
    }
}
//# sourceMappingURL=memory.js.map