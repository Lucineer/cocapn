/**
 * Cocapn CLI — Unified CLI tool for cocapn management
 *
 * Usage:
 *   cocapn setup [dir]         — Interactive onboarding wizard
 *   cocapn init [dir]          — Alias for setup
 *   cocapn start               — Start the bridge
 *   cocapn serve               — Serve web UI locally
 *   cocapn chat                — Interactive terminal chat
 *   cocapn status              — Show bridge status
 *   cocapn deploy              — Deploy to Cloudflare Workers
 *   cocapn rollback            — Rollback deployment
 *   cocapn skill list          — List available skills
 *   cocapn template search <q> — Search template registry
 *   cocapn tokens              — Show token usage stats
 *   cocapn health              — Health check
 *   cocapn memory list         — List all memory entries
 *   cocapn memory get <key>    — Get a specific entry
 *   cocapn memory set <k> <v>  — Set a fact
 *   cocapn memory delete <key> — Delete a fact
 *   cocapn memory search <q>   — Search memory
 *   cocapn export brain        — Export entire brain
 *   cocapn export chat <id>    — Export chat history
 *   cocapn export wiki         — Export wiki as markdown
 *   cocapn export knowledge    — Export knowledge entries
 *   cocapn sync                — Sync repos (private + public)
 *   cocapn sync status         — Show sync status
 *   cocapn sync pull           — Pull from remotes
 *   cocapn wiki list           — List wiki pages
 *   cocapn wiki get <slug>     — Show wiki page
 *   cocapn wiki new <slug>     — Create wiki page
 *   cocapn wiki edit <slug>    — Edit wiki page
 *   cocapn wiki search <query> — Search wiki
 *   cocapn wiki delete <slug>  — Delete wiki page
 *   cocapn config show         — Show current config
 *   cocapn config get <key>    — Get a config value
 *   cocapn config set <k> <v>  — Set a config value
 *   cocapn config reset        — Reset to defaults
 *   cocapn config validate     — Validate config
 *   cocapn logs                — Show recent agent logs
 *   cocapn logs search <query> — Search logs
 *   cocapn backup create       — Create full backup
 *   cocapn backup list         — List backups
 *   cocapn backup restore <n>  — Restore from backup
 *   cocapn backup clean        — Remove old backups
 *   cocapn invite create       — Create invite link
 *   cocapn invite list         — List active invites
 *   cocapn invite revoke <code> — Revoke invite
 *   cocapn invite accept <code> — Accept invite
 *   cocapn version             — Show version
 */
import { Command } from "commander";
export declare function createCLI(): Command;
//# sourceMappingURL=index.d.ts.map