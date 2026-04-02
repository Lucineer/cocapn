/**
 * Memory — two-tier persistent memory for cocapn.
 *
 * Hot tier: JSON file for recent facts and messages (<100)
 * Cold tier: git log for long-term recall
 *
 * Zero dependencies. Uses only Node.js built-ins.
 */
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    ts: string;
    userId?: string;
}
export interface UserRecord {
    name: string;
    lastSeen: string;
    messageCount: number;
    preferences: Record<string, string>;
}
export interface MemoryStore {
    messages: Message[];
    facts: Record<string, string>;
    users: Record<string, UserRecord>;
    userFacts: Record<string, Record<string, string>>;
}
export declare class Memory {
    private path;
    private data;
    private repoDir;
    constructor(repoDir: string);
    get messages(): Message[];
    get facts(): Record<string, string>;
    /** Get last N messages for LLM context */
    recent(n?: number): Message[];
    /** Add a message and persist */
    addMessage(role: Message['role'], content: string, userId?: string): void;
    /** Format recent messages as LLM context */
    formatContext(n?: number): string;
    /** Format facts as LLM context */
    formatFacts(): string;
    /** Clear all messages and facts */
    clear(): void;
    /** Search hot (JSON) + cold (git) memory for a query */
    search(query: string): {
        messages: Message[];
        facts: Array<{
            key: string;
            value: string;
        }>;
        gitLog: string[];
    };
    /** Cold tier: search git log for keywords */
    searchGit(query: string): string[];
    /** Get or create a user record */
    getOrCreateUser(userId: string, name?: string): UserRecord;
    /** List all known users */
    getUsers(): Array<UserRecord & {
        id: string;
    }>;
    /** Get messages visible to a specific user (their own + system/assistant) */
    recentForUser(userId: string, n?: number): Message[];
    /** Get facts for a user: global + user-specific merged */
    getFactsForUser(userId: string): Record<string, string>;
    /** Set a user-specific fact */
    setUserFact(userId: string, key: string, value: string): void;
    /** Format facts for a specific user (global + user-specific) */
    formatFactsForUser(userId: string): string;
    private load;
    private save;
}
//# sourceMappingURL=memory.d.ts.map