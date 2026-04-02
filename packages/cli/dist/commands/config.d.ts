/**
 * cocapn config — Manage agent configuration from the CLI.
 *
 * Reads/writes cocapn/config.yml directly. No bridge required.
 */
import { Command } from "commander";
type YamlValue = string | number | boolean | null | YamlValue[] | {
    [key: string]: YamlValue;
};
export declare function parseYaml(text: string): YamlValue;
export declare function serializeYaml(data: YamlValue, indent?: number): string;
export declare function resolveConfigPath(repoRoot: string): string | null;
export declare function readConfig(configPath: string): YamlValue;
export declare function writeConfig(configPath: string, data: YamlValue): void;
export declare function backupConfig(configPath: string): string;
export declare function getNestedValue(obj: YamlValue, keyPath: string): YamlValue | undefined;
export declare function setNestedValue(obj: YamlValue, keyPath: string, value: YamlValue): YamlValue;
export declare function maskSecrets(data: YamlValue, showAll: boolean): YamlValue;
export interface ValidationIssue {
    level: "error" | "warning";
    path: string;
    message: string;
}
export declare function validateConfig(data: YamlValue): ValidationIssue[];
export declare const DEFAULT_CONFIG: YamlValue;
export declare function createConfigCommand(): Command;
export {};
//# sourceMappingURL=config.d.ts.map