/**
 * cocapn export — Export agent data in multiple formats.
 *
 * Subcommands:
 *   cocapn export brain    — entire brain (facts, memories, wiki)
 *   cocapn export chat     — chat history
 *   cocapn export wiki     — wiki as markdown files
 *   cocapn export knowledge — knowledge entries with type filtering
 *
 * Formats: json, jsonl, markdown, csv
 * Output:  stdout (default) or --output <file>
 */
import { Command } from "commander";
interface ExportEntry {
    type: string;
    key: string;
    value: string;
    meta?: Record<string, unknown>;
}
type ExportFormat = "json" | "jsonl" | "markdown" | "csv";
declare function loadBrainEntries(repoRoot: string): ExportEntry[];
declare function loadKnowledgeEntries(repoRoot: string, typeFilter?: string): ExportEntry[];
declare function loadWikiEntries(repoRoot: string): ExportEntry[];
declare function loadChatHistory(repoRoot: string, sessionId: string): ExportEntry[];
declare function formatJSON(entries: ExportEntry[]): string;
declare function formatJSONL(entries: ExportEntry[]): string;
declare function formatMarkdown(entries: ExportEntry[]): string;
declare function formatCSV(entries: ExportEntry[]): string;
export declare function createExportCommand(): Command;
export { formatJSON, formatJSONL, formatMarkdown, formatCSV, loadBrainEntries, loadKnowledgeEntries, loadWikiEntries, loadChatHistory };
export type { ExportEntry, ExportFormat };
//# sourceMappingURL=export.d.ts.map