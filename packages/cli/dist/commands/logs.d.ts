/**
 * cocapn logs — View and search agent logs
 */
import { Command } from "commander";
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    raw: string;
}
export declare function parseLogLine(line: string): LogEntry | null;
export declare function resolveLogsDir(cwd: string): string;
export declare function findLogFiles(logsDir: string): string[];
export declare function readLogs(logFiles: string[], lines: number): LogEntry[];
export declare function filterByLevel(entries: LogEntry[], minLevel: LogLevel): LogEntry[];
export declare function searchLogs(entries: LogEntry[], query: string): LogEntry[];
export declare function formatEntry(entry: LogEntry): string;
export declare function createLogsCommand(): Command;
//# sourceMappingURL=logs.d.ts.map