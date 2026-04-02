/**
 * cocapn setup — Interactive onboarding wizard for first-time configuration
 *
 * Walks users through creating the cocapn/ directory structure,
 * configuring LLM provider, setting secrets, and testing connections.
 */
import { Command } from "commander";
interface Template {
    name: string;
    description: string;
    soulExtra: string;
    configExtra: string;
}
declare const TEMPLATES: Record<string, Template>;
declare const TEMPLATE_NAMES: string[];
interface SetupOptions {
    nonInteractive: boolean;
    template: string;
    dir: string;
    force: boolean;
    projectName?: string;
    userName?: string;
    domain?: string;
    llmProvider?: string;
}
interface SetupAnswers {
    projectName: string;
    userName: string;
    domain: string;
    llmProvider: string;
    apiKey: string;
}
export declare function runSetup(options: SetupOptions): Promise<void>;
declare function createDirectoryStructure(cocapnDir: string): void;
declare function createSoulMd(cocapnDir: string, answers: SetupAnswers, template: Template): void;
declare function createConfigYml(cocapnDir: string, answers: SetupAnswers, template: Template): void;
declare function createMemoryStores(cocapnDir: string): void;
declare function createWiki(cocapnDir: string, answers: SetupAnswers): void;
declare function storeSecret(envFile: string, provider: string, apiKey: string): void;
declare function getEnvVarName(provider: string): string;
declare function getDefaultModel(provider: string): string;
declare function ensureGitignore(targetDir: string): void;
declare function testLlmConnection(provider: string, apiKey: string): Promise<boolean>;
export declare function createSetupCommand(): Command;
export { createDirectoryStructure, createSoulMd, createConfigYml, createMemoryStores, createWiki, storeSecret, ensureGitignore, getEnvVarName, getDefaultModel, testLlmConnection, TEMPLATES, TEMPLATE_NAMES, };
export type { SetupOptions, SetupAnswers, Template };
//# sourceMappingURL=setup.d.ts.map