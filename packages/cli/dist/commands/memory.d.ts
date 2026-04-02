/**
 * cocapn memory — Browse and manage agent memory from the CLI.
 *
 * Reads directly from cocapn/memory/*.json and cocapn/wiki/*.md files.
 * No bridge required.
 */
import { Command } from "commander";
export interface MemoryEntry {
    type: "fact" | "memory" | "wiki" | "knowledge";
    key: string;
    value: string;
}
export interface MemoryListResult {
    entries: MemoryEntry[];
    total: number;
    byType: Record<string, number>;
}
export declare function resolveMemoryPaths(repoRoot: string): {
    memoryDir: string;
    wikiDir: string;
} | null;
export declare function loadAllEntries(repoRoot: string): MemoryEntry[];
export declare function loadEntriesByType(repoRoot: string, type: string): MemoryEntry[];
export declare function createMemoryCommand(): Command;
//# sourceMappingURL=memory.d.ts.map