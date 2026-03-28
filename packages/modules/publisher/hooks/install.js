#!/usr/bin/env node
/**
 * auto-publisher install hook.
 * Verifies the public repo root is set in the bridge config.
 * The Bridge wires up the Publisher EventEmitter subscription automatically
 * when this module is enabled.
 */
const { existsSync } = require("fs");

const publicRoot = process.env["COCAPN_PUBLIC_REPO_ROOT"];
if (!publicRoot) {
  console.warn(
    "[auto-publisher] COCAPN_PUBLIC_REPO_ROOT is not set.\n" +
      "Set publicRepoRoot in your BridgeOptions to enable publishing."
  );
  process.exit(0); // non-fatal — bridge still works
}

if (!existsSync(publicRoot)) {
  console.warn(
    `[auto-publisher] publicRepoRoot does not exist: ${publicRoot}\n` +
      "Create or clone the public repo first."
  );
  process.exit(0);
}

console.log(`[auto-publisher] Installed. Public repo: ${publicRoot}`);
