/**
 * cocapn upgrade — Self-upgrade cocapn to latest version
 *
 * Usage:
 *   cocapn upgrade          — Check for updates and upgrade
 *   cocapn upgrade --check  — Check only, don't install
 *   cocapn upgrade --force  — Skip confirm prompt
 */
import { Command } from "commander";
export interface SemVer {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
}
export interface UpgradeCheckResult {
    current: SemVer;
    latest: SemVer;
    hasUpdate: boolean;
    changelogUrl: string;
}
export declare function parseSemver(version: string): SemVer | null;
export declare function semverCompare(a: SemVer, b: SemVer): number;
export declare function formatSemver(v: SemVer): string;
export declare function getCurrentVersion(): string;
export declare function getLatestVersion(): string;
export declare function installLatest(): string;
export declare function checkForUpdates(): UpgradeCheckResult;
export declare function createUpgradeCommand(): Command;
//# sourceMappingURL=upgrade.d.ts.map