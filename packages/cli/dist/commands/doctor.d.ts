/**
 * cocapn doctor — Diagnose and fix common issues
 *
 * Usage:
 *   cocapn doctor       — Run full diagnostics
 *   cocapn doctor fix   — Auto-fix common issues
 */
import { Command } from "commander";
export interface CheckResult {
    id: string;
    label: string;
    status: "pass" | "fail" | "warn";
    message: string;
    fixable: boolean;
    fix?: string;
}
export interface DoctorResult {
    checks: CheckResult[];
    fixes: string[];
}
export declare function checkCocapnDir(repoRoot: string): CheckResult;
export declare function checkSubdirectories(repoRoot: string): CheckResult;
export declare function checkConfigYaml(repoRoot: string): CheckResult;
export declare function checkSoulMd(repoRoot: string): CheckResult;
export declare function checkBrainFiles(repoRoot: string): CheckResult;
export declare function checkGitRepo(repoRoot: string): CheckResult;
export declare function checkNodeVersion(): CheckResult;
export declare function checkLockFiles(repoRoot: string): CheckResult;
export declare function checkApiKeys(): CheckResult;
export declare function checkBridgePort(): Promise<CheckResult>;
export declare function fixMissingDirectories(repoRoot: string): string[];
export declare function fixDefaultConfig(repoRoot: string): string[];
export declare function fixDefaultSoul(repoRoot: string): string[];
export declare function fixBrainFiles(repoRoot: string): string[];
export declare function fixLockFiles(repoRoot: string): string[];
export declare function runDiagnostics(repoRoot: string): Promise<DoctorResult>;
export declare function runFixes(repoRoot: string, diagnostics: DoctorResult): DoctorResult;
export declare function createDoctorCommand(): Command;
//# sourceMappingURL=doctor.d.ts.map