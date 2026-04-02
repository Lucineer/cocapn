/**
 * cocapn template — Create and manage agent templates
 *
 * Usage:
 *   cocapn template list                — List available templates
 *   cocapn template apply <name>        — Apply template to current repo
 *   cocapn template create --from current — Create template from current config
 *   cocapn template info <name>         — Show template details
 */
import { Command } from "commander";
export interface TemplateInfo {
    name: string;
    type: "soul" | "deployment" | "vertical";
    description: string;
    path: string;
}
export interface TemplateDetails {
    name: string;
    type: "soul" | "deployment" | "vertical";
    description: string;
    soulMd?: string;
    config?: Record<string, any>;
    modules?: string[];
    plugins?: string[];
}
export interface ApplyResult {
    template: string;
    applied: string[];
    skipped: string[];
    created: string[];
}
export interface CreateResult {
    name: string;
    path: string;
    files: string[];
}
/**
 * Resolve the templates package directory within the monorepo.
 */
export declare function resolveTemplatesDir(): string;
/**
 * List all soul templates from packages/templates/src/souls/.
 */
export declare function listSoulTemplates(): TemplateInfo[];
/**
 * Get a soul template's content by name.
 */
export declare function getSoulTemplateContent(name: string): string | undefined;
/**
 * List all deployment templates from packages/templates/src/deployments/.
 */
export declare function listDeploymentTemplates(): TemplateInfo[];
/**
 * List vertical templates from packages/templates/.
 */
export declare function listVerticalTemplates(): TemplateInfo[];
/**
 * List user-created templates from cocapn/templates/local/.
 */
export declare function listLocalTemplates(repoRoot: string): TemplateInfo[];
/**
 * List all available templates (soul + deployment + vertical + local).
 */
export declare function listAllTemplates(repoRoot?: string): TemplateInfo[];
/**
 * Find a template by name across all categories.
 */
export declare function findTemplate(name: string, repoRoot?: string): TemplateInfo | undefined;
/**
 * Get detailed information about a template.
 */
export declare function getTemplateDetails(name: string, repoRoot?: string): TemplateDetails | undefined;
/**
 * Apply a template to the current repo's cocapn/ directory.
 */
export declare function applyTemplate(name: string, repoRoot: string, options?: {
    force?: boolean;
    sourceRoot?: string;
}): ApplyResult;
/**
 * Create a template from the current repo's configuration.
 */
export declare function createTemplateFromCurrent(repoRoot: string, name?: string): CreateResult;
export declare function createTemplateCommand(): Command;
//# sourceMappingURL=template.d.ts.map