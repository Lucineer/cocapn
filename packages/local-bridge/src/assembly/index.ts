/**
 * Self-Assembly module
 *
 * Automatic configuration for cocapn on first run.
 */

export { RepoDetector, type RepoProfile } from "./detector.js";
export { TemplateMatcher, type TemplateMatch } from "./matcher.js";
export {
  SelfAssembler,
  type AssemblyResult,
} from "./assembler.js";
