/**
 * auto-publisher module entry point.
 *
 * Re-exports the Publisher class from @cocapn/local-bridge so that
 * the module can be used:
 *   a) directly in the monorepo (Bridge imports from this file)
 *   b) standalone after `npm install` (peer dep on @cocapn/local-bridge)
 *
 * The template shipped at ../templates/update.md is used automatically
 * when the Bridge instantiates Publisher with the default templatePath.
 */

export { Publisher } from "@cocapn/local-bridge";
export type { PublisherOptions } from "@cocapn/local-bridge";

/** Absolute path to the bundled update.md template for this module. */
export const TEMPLATE_PATH = new URL(
  "../templates/update.md",
  import.meta.url
).pathname;
