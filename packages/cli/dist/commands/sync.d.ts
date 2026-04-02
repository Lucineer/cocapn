/**
 * cocapn sync — Git sync between local and remote repos (private + public).
 *
 * Usage:
 *   cocapn sync            — Sync both repos (commit + push)
 *   cocapn sync private    — Sync only brain (private) repo
 *   cocapn sync public     — Sync only face (public) repo
 *   cocapn sync status     — Show sync status for both repos
 *   cocapn sync pull       — Pull from remotes
 */
import { Command } from "commander";
export interface SyncRepoStatus {
    path: string;
    branch: string;
    clean: boolean;
    changedFiles: string[];
    hasRemote: boolean;
    ahead: number;
    behind: number;
    lastCommitMsg: string;
    lastCommitDate: string;
}
export interface SyncFullStatus {
    privateRepo: SyncRepoStatus | null;
    publicRepo: SyncRepoStatus | null;
}
export interface SyncResult {
    repo: "private" | "public";
    committed: boolean;
    pushed: boolean;
    files: string[];
    diffSummary: string;
}
declare function git(cwd: string, args: string): string;
declare function gitSafe(cwd: string, args: string): {
    ok: true;
    output: string;
} | {
    ok: false;
    error: string;
};
/** Detect repo paths from current working directory or config. */
export declare function resolveRepoPaths(cwdOverride?: string): {
    privatePath: string | null;
    publicPath: string | null;
};
/** Parse git status --porcelain into file list. */
export declare function parseStatusPorcelain(output: string): string[];
/** Get the repo status. */
export declare function getRepoStatus(repoPath: string): SyncRepoStatus;
/** Stage all changes and commit. Returns list of committed files or null if nothing to commit. */
declare function autoCommit(repoPath: string, message: string): string[] | null;
/** Push to remote. Returns true on success. */
declare function pushRepo(repoPath: string): boolean;
/** Pull from remote. Returns true on success. */
declare function pullRepo(repoPath: string): boolean;
/** Get short diff summary. */
export declare function getDiffSummary(repoPath: string): string;
declare function syncRepo(repoPath: string, repo: "private" | "public", commitMsg: string): SyncResult;
declare function printRepoStatus(label: string, status: SyncRepoStatus): void;
export declare function createSyncCommand(): Command;
export { git, gitSafe, autoCommit, pushRepo, pullRepo, syncRepo, printRepoStatus };
//# sourceMappingURL=sync.d.ts.map