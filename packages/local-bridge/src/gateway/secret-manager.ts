/**
 * GatewaySecretManager — manages secrets that NEVER touch any repo.
 *
 * Stores secrets in .env.local (gitignored), syncs them to deployment
 * platforms (GitHub Secrets via `gh`, Cloudflare via `wrangler`).
 *
 * This is distinct from the root SecretManager which handles age-encrypted
 * secrets in the private repo. This one focuses on deployment-time secrets
 * that only exist locally and on the target platform.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { execFile as execFileCb, spawn } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCb);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecretEntry {
  key: string;
  /** Masked value for display. */
  maskedValue: string;
  /** Where this secret is currently synced. */
  platforms: string[];
}

export interface AuditResult {
  key: string;
  local: boolean;
  github: boolean;
  cloudflare: boolean;
}

export interface SyncResult {
  platform: string;
  synced: string[];
  failed: Array<{ key: string; error: string }>;
}

// ─── GatewaySecretManager ─────────────────────────────────────────────────────

export class GatewaySecretManager {
  private envPath: string;
  private githubRepo: string | undefined;
  private cloudflareProject: string | undefined;

  constructor(options: {
    /** Directory containing .env.local (typically the private repo root). */
    repoRoot: string;
    /** GitHub repo in "owner/repo" format (e.g. "alice/alice.makerlog.ai"). */
    githubRepo?: string;
    /** Cloudflare Workers project name. */
    cloudflareProject?: string;
  }) {
    this.envPath = join(options.repoRoot, ".env.local");
    this.githubRepo = options.githubRepo;
    this.cloudflareProject = options.cloudflareProject;
  }

  // ---------------------------------------------------------------------------
  // Local .env.local management
  // ---------------------------------------------------------------------------

  /** Set a secret in .env.local. Creates the file if missing. */
  set(key: string, value: string): void {
    const line = `${key}=${value}\n`;

    if (!existsSync(this.envPath)) {
      writeFileSync(this.envPath, line, "utf8");
      return;
    }

    const content = readFileSync(this.envPath, "utf8");
    const lines = content.split("\n");
    const keyPrefix = `${key}=`;
    const idx = lines.findIndex((l) => l.startsWith(keyPrefix));

    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
      writeFileSync(this.envPath, lines.join("\n"), "utf8");
    } else {
      appendFileSync(this.envPath, line, "utf8");
    }
  }

  /** Get a secret value from .env.local. Returns undefined if not found. */
  get(key: string): string | undefined {
    if (!existsSync(this.envPath)) return undefined;
    const content = readFileSync(this.envPath, "utf8");
    const keyPrefix = `${key}=`;
    for (const line of content.split("\n")) {
      if (line.startsWith(keyPrefix)) {
        return line.slice(keyPrefix.length);
      }
    }
    return undefined;
  }

  /** Delete a secret from .env.local. */
  delete(key: string): boolean {
    if (!existsSync(this.envPath)) return false;
    const content = readFileSync(this.envPath, "utf8");
    const keyPrefix = `${key}=`;
    const lines = content.split("\n");
    const filtered = lines.filter((l) => !l.startsWith(keyPrefix));

    if (filtered.length === lines.length) return false;

    writeFileSync(this.envPath, filtered.join("\n"), "utf8");
    return true;
  }

  /** List all secrets from .env.local with masked values. */
  list(): SecretEntry[] {
    if (!existsSync(this.envPath)) return [];

    const content = readFileSync(this.envPath, "utf8");
    const entries: SecretEntry[] = [];

    for (const line of content.split("\n")) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      entries.push({
        key,
        maskedValue: this.mask(value),
        platforms: [], // Filled by audit()
      });
    }

    return entries;
  }

  /** Check if a specific secret exists locally. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  // ---------------------------------------------------------------------------
  // Platform sync
  // ---------------------------------------------------------------------------

  /** Sync a secret to GitHub Secrets via `gh secret set`. */
  async syncToGithub(key: string): Promise<void> {
    if (!this.githubRepo) {
      throw new Error("GitHub repo not configured");
    }
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Secret "${key}" not found in .env.local`);
    }
    await this.pipeToProcess("gh", ["secret", "set", key, "--repo", this.githubRepo], value);
  }

  /** Sync a secret to Cloudflare via `wrangler secret put`. */
  async syncToCloudflare(key: string): Promise<void> {
    if (!this.cloudflareProject) {
      throw new Error("Cloudflare project not configured");
    }
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Secret "${key}" not found in .env.local`);
    }
    await this.pipeToProcess("wrangler", ["secret", "put", key, "--name", this.cloudflareProject], value);
  }

  /** Sync all local secrets to a platform. */
  async syncAll(platform: "github" | "cloudflare"): Promise<SyncResult> {
    const secrets = this.list();
    const synced: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (const { key } of secrets) {
      try {
        if (platform === "github") {
          await this.syncToGithub(key);
        } else {
          await this.syncToCloudflare(key);
        }
        synced.push(key);
      } catch (err) {
        failed.push({
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { platform, synced, failed };
  }

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  /**
   * Audit where each secret is configured.
   * Checks local .env.local, GitHub, and Cloudflare.
   */
  async audit(): Promise<AuditResult[]> {
    const localEntries = this.list();
    const results: AuditResult[] = [];

    for (const entry of localEntries) {
      const result: AuditResult = {
        key: entry.key,
        local: true,
        github: false,
        cloudflare: false,
      };

      // Check GitHub (best-effort)
      if (this.githubRepo) {
        try {
          const { stdout } = await execFile("gh", ["secret", "list", "--repo", this.githubRepo], {
            timeout: 15_000,
          });
          result.github = stdout.includes(entry.key);
        } catch {
          // gh not available or no access
        }
      }

      // Check Cloudflare (best-effort)
      if (this.cloudflareProject) {
        try {
          const { stdout } = await execFile("wrangler", ["secret", "list", "--name", this.cloudflareProject], {
            timeout: 15_000,
          });
          const parsed = JSON.parse(stdout) as Array<{ name: string }>;
          result.cloudflare = parsed.some((s) => s.name === entry.key);
        } catch {
          // wrangler not available or no access
        }
      }

      results.push(result);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mask(value: string): string {
    if (value.length <= 8) return "****";
    return value.slice(0, 2) + "*".repeat(Math.min(value.length - 4, 8)) + value.slice(-2);
  }

  /** Spawn a process, pipe value to stdin, and wait for exit. */
  private pipeToProcess(command: string, args: string[], value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
      proc.stdin!.write(value);
      proc.stdin!.end();
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      proc.on("error", reject);
    });
  }
}
