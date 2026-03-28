#!/usr/bin/env node
/**
 * auto-publisher enable hook.
 * Publisher activation is handled by Bridge at startup.
 * This hook just confirms the module is being enabled.
 */
console.log("[auto-publisher] Enabled. Bridge will subscribe to post-commit events on next start.");
