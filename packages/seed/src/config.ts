/**
 * Config — schema validation for cocapn.json.
 *
 * Delegates to config-schema.ts for full validation across all sections.
 * Re-exports legacy API (validateConfig → string[]) for backward compatibility.
 */

export { applyFullDefaults as applyDefaults, formatErrors } from './config-schema.js';
export type { FullConfig as Config, LLMConfig, VisionConfig, GenerateConfig, ChannelConfig, PluginEntry, GlueConfig, ValidationResult } from './config-schema.js';

import { validateFullConfig } from './config-schema.js';

/** Validate config — returns string[] for backward compatibility */
export function validateConfig(raw: Record<string, unknown>): string[] {
  const result = validateFullConfig(raw);
  return [...result.errors.map(e => `${e.path}: ${e.message}`)];
}
