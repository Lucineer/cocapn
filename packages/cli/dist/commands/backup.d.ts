/**
 * cocapn backup — Backup and restore agent data
 *
 * Usage:
 *   cocapn backup create          — Create full backup (tar.gz)
 *   cocapn backup list            — List existing backups
 *   cocapn backup restore <name>  — Restore from backup
 *   cocapn backup clean           — Remove old backups (keep last 5)
 *   cocapn backup clean --keep 3  — Remove old backups (keep last 3)
 */
import { Command } from "commander";
export interface BackupManifest {
    name: string;
    created: string;
    checksum: string;
    sizeBytes: number;
    files: string[];
}
export interface BackupListEntry {
    name: string;
    created: string;
    sizeBytes: number;
    checksum: string;
    fileCount: number;
}
export declare function resolveCocapnDir(repoRoot: string): string | null;
export declare function createBackup(repoRoot: string): Promise<BackupManifest>;
export declare function listBackups(repoRoot: string): BackupListEntry[];
export declare function restoreBackup(repoRoot: string, backupName: string, preRestoreBackup: boolean): Promise<{
    restored: BackupManifest;
    safetyBackup?: string;
}>;
export declare function cleanBackups(repoRoot: string, keep: number): string[];
export declare function createBackupCommand(): Command;
//# sourceMappingURL=backup.d.ts.map