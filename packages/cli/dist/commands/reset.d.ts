/**
 * cocapn reset — Reset agent to clean state with backups
 *
 * Usage:
 *   cocapn reset brain     — Clear brain memory (facts, memories, wiki)
 *   cocapn reset knowledge — Clear knowledge pipeline
 *   cocapn reset all       — Full reset + re-run setup
 *   cocapn reset --force   — Skip confirmation prompt
 */
import { Command } from "commander";
export interface ResetResult {
    target: string;
    backupDir: string;
    backedUp: string[];
    cleared: string[];
}
export declare function createBackupDir(repoRoot: string, prefix: string): string;
export declare function resetBrain(repoRoot: string, backupDir: string): ResetResult;
export declare function resetKnowledge(repoRoot: string, backupDir: string): ResetResult;
export declare function resetAll(repoRoot: string, backupDir: string): ResetResult;
export declare function createResetCommand(): Command;
//# sourceMappingURL=reset.d.ts.map