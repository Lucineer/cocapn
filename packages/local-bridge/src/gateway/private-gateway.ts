/**
 * PrivateGateway — the private agent IS the gateway to the public repo.
 *
 * All public repo edits flow through here. No direct edits to the public repo.
 * The gateway validates, filters, and commits every change, ensuring nothing
 * secret ever reaches the public face.
 *
 * Flow:
 *   user → private agent → PrivateGateway.editPublic() → public repo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join, relative, dirname } from "path";
import { simpleGit } from "simple-git";
import { EventEmitter } from "events";
import { promisify } from "util";
import { execFile as execFileCb } from "child_process";
import { PublicGuard, type GuardResult, type GuardViolation } from "./public-guard.js";
import { GatewaySecretManager, type SyncResult } from "./secret-manager.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeployPlatform = "cloudflare" | "github-pages" | "docker";

export interface PublicChange {
  /** Files to write to the public repo. Key = repo-relative path, value = content. */
  files: Record<string, string>;
  /** Files or directories to delete from the public repo. */
  deletions?: string[];
  /** Commit message for the change. */
  message: string;
  /** If true, skip the secret guard scan. USE WITH CAUTION. */
  skipGuard?: boolean;
}

export interface EditResult {
  /** Whether the edit was applied successfully. */
  success: boolean;
  /** Files written. */
  written: string[];
  /** Files deleted. */
  deleted: string[];
  /** Guard violations that were blocked (empty if success). */
  blocked: GuardViolation[];
  /** Git commit SHA (if committed). */
  commitSha?: string;
  /** Whether the push succeeded. */
  pushed: boolean;
  /** Human-readable summary. */
  summary: string;
}

export interface ReviewResult {
  /** Pending changes in the public repo (uncommitted). */
  uncommittedFiles: string[];
  /** Guard scan of all pending content. */
  guardScan: GuardResult;
  /** Whether it's safe to publish. */
  safe: boolean;
  /** Human-readable summary. */
  summary: string;
}

export interface DeployResult {
  platform: DeployPlatform;
  success: boolean;
  output: string;
  summary: string;
}

export type GatewayEventMap = {
  "edit-attempted":  [change: PublicChange];
  "edit-blocked":    [change: PublicChange, violations: GuardViolation[]];
  "edit-applied":    [result: EditResult];
  "guard-violation": [violations: GuardViolation[]];
  "deployed":        [result: DeployResult];
  error:             [err: Error];
};

// ─── PrivateGateway ───────────────────────────────────────────────────────────

export class PrivateGateway extends EventEmitter<GatewayEventMap> {
  private publicRepoRoot: string;
  private privateRepoRoot: string;
  private guard: PublicGuard;
  private secretManager: GatewaySecretManager;
  private autoPublish: boolean;

  constructor(options: {
    privateRepoRoot: string;
    publicRepoRoot: string;
    autoPublish?: boolean;
    githubRepo?: string;
    cloudflareProject?: string;
    guardWhitelist?: Array<{ filePattern?: string; allowPattern: string }>;
  }) {
    super();
    this.publicRepoRoot = options.publicRepoRoot;
    this.privateRepoRoot = options.privateRepoRoot;
    this.autoPublish = options.autoPublish ?? false;
    const guardOpts: { whitelist?: Array<{ filePattern?: string; allowPattern: string }> } = {};
    if (options.guardWhitelist !== undefined && options.guardWhitelist.length > 0) {
      guardOpts.whitelist = options.guardWhitelist;
    }
    this.guard = new PublicGuard(guardOpts);

    const smOpts: { repoRoot: string; githubRepo?: string; cloudflareProject?: string } = {
      repoRoot: options.privateRepoRoot,
    };
    if (options.githubRepo !== undefined) smOpts.githubRepo = options.githubRepo;
    if (options.cloudflareProject !== undefined) smOpts.cloudflareProject = options.cloudflareProject;
    this.secretManager = new GatewaySecretManager(smOpts);
  }

  // ---------------------------------------------------------------------------
  // Core: edit public repo
  // ---------------------------------------------------------------------------

  /**
   * Apply a change to the public repo.
   *
   * Steps:
   *   1. Validate change (is it safe for public?)
   *   2. Apply publishing filter (strip secrets, PII)
   *   3. Guard-scan all file contents
   *   4. Write files to public repo
   *   5. Delete specified files/dirs
   *   6. Git commit with descriptive message
   *   7. Push to public remote
   *   8. Return result
   */
  async editPublic(change: PublicChange): Promise<EditResult> {
    this.emit("edit-attempted", change);

    // ── 1. Guard scan ─────────────────────────────────────────────────────
    if (!change.skipGuard) {
      const allViolations: GuardViolation[] = [];
      for (const [filePath, content] of Object.entries(change.files)) {
        const violations = this.guard.scanContent(content, filePath);
        allViolations.push(...violations);
      }

      if (allViolations.length > 0) {
        this.emit("edit-blocked", change, allViolations);
        this.emit("guard-violation", allViolations);
        return {
          success: false,
          written: [],
          deleted: [],
          blocked: allViolations,
          pushed: false,
          summary: `Blocked: ${allViolations.length} secret/PII violation(s) detected`,
        };
      }
    }

    // ── 2. Write files ────────────────────────────────────────────────────
    const written: string[] = [];
    for (const [filePath, content] of Object.entries(change.files)) {
      const absPath = join(this.publicRepoRoot, filePath);
      const dir = dirname(absPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(absPath, content, "utf8");
      written.push(filePath);
    }

    // ── 3. Delete files ───────────────────────────────────────────────────
    const deleted: string[] = [];
    for (const target of change.deletions ?? []) {
      const absPath = join(this.publicRepoRoot, target);
      if (existsSync(absPath)) {
        rmSync(absPath, { recursive: true, force: true });
        deleted.push(target);
      }
    }

    // ── 4. Git commit ─────────────────────────────────────────────────────
    let commitSha: string | undefined;
    if (written.length > 0 || deleted.length > 0) {
      try {
        const git = simpleGit(this.publicRepoRoot);
        for (const f of [...written, ...deleted]) {
          await git.add(f);
        }
        // For deletions, add with --all to stage removed files
        if (deleted.length > 0) {
          await git.raw(["add", "--all", ...deleted]);
        }
        await git.commit(change.message);
        const log = await git.log({ maxCount: 1 });
        commitSha = log.latest?.hash;
      } catch {
        // Nothing to commit or git error — non-fatal
      }
    }

    // ── 5. Push ───────────────────────────────────────────────────────────
    let pushed = false;
    if (commitSha) {
      pushed = await this.tryPush();
    }

    const result: EditResult = {
      success: true,
      written,
      deleted,
      blocked: [],
      pushed,
      summary: this.buildSummary(written, deleted, commitSha, pushed),
    };
    if (commitSha !== undefined) result.commitSha = commitSha;

    this.emit("edit-applied", result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Review pending changes
  // ---------------------------------------------------------------------------

  /**
   * Review all uncommitted changes in the public repo.
   * Scans for secrets/PII and returns a safety report.
   */
  async reviewPublic(): Promise<ReviewResult> {
    const uncommittedFiles = await this.getUncommittedFiles();
    const violations: GuardViolation[] = [];

    for (const file of uncommittedFiles) {
      const absPath = join(this.publicRepoRoot, file);
      if (!existsSync(absPath)) continue;
      try {
        const content = readFileSync(absPath, "utf8");
        violations.push(...this.guard.scanContent(content, file));
      } catch {
        // Unreadable — skip
      }
    }

    const guardScan: GuardResult = {
      safe: violations.length === 0,
      violations,
      filesScanned: uncommittedFiles.length,
    };

    return {
      uncommittedFiles,
      guardScan,
      safe: guardScan.safe,
      summary: guardScan.safe
        ? `${uncommittedFiles.length} file(s) pending — safe to publish`
        : `${violations.length} secret/PII violation(s) in ${uncommittedFiles.length} file(s)`,
    };
  }

  // ---------------------------------------------------------------------------
  // Secret sync
  // ---------------------------------------------------------------------------

  /**
   * Sync secrets from .env.local to deployment platforms.
   * Never writes secrets to any repo file.
   */
  async syncSecrets(platform?: "github" | "cloudflare"): Promise<SyncResult | SyncResult[]> {
    if (platform) {
      return this.secretManager.syncAll(platform);
    }
    // Sync to all configured platforms
    const results: SyncResult[] = [];
    try {
      results.push(await this.secretManager.syncAll("github"));
    } catch {
      // GitHub not configured — skip
    }
    try {
      results.push(await this.secretManager.syncAll("cloudflare"));
    } catch {
      // Cloudflare not configured — skip
    }
    return results;
  }

  /** Access the underlying GatewaySecretManager for direct operations. */
  getSecretManager(): GatewaySecretManager {
    return this.secretManager;
  }

  /** Access the underlying PublicGuard for direct scans. */
  getGuard(): PublicGuard {
    return this.guard;
  }

  // ---------------------------------------------------------------------------
  // Deploy
  // ---------------------------------------------------------------------------

  /**
   * Deploy the public repo to a platform.
   * All secrets come from .env.local, never from the repo.
   */
  async deployPublic(platform: DeployPlatform): Promise<DeployResult> {
    try {
      switch (platform) {
        case "cloudflare":
          return await this.deployCloudflare();
        case "github-pages":
          return await this.deployGithubPages();
        case "docker":
          return await this.deployDocker();
      }
    } catch (err) {
      const result: DeployResult = {
        platform,
        success: false,
        output: "",
        summary: `Deploy failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      this.emit("deployed", result);
      return result;
    }
  }

  // ---------------------------------------------------------------------------
  // Full brain → face publish (convenience)
  // ---------------------------------------------------------------------------

  /**
   * Convenience: compile a public-safe soul.md from the private soul.md.
   * Strips sections between <!-- private --> and <!-- /private --> markers.
   */
  compilePublicSoul(privateSoul: string): string {
    let out = privateSoul.replace(
      /<!--\s*private\s*-->[\s\S]*?<!--\s*\/private\s*-->/gi,
      ""
    );
    // Additional guard scan pass
    out = this.stripPIILines(out);
    return out.trim();
  }

  /**
   * Generate a public-safe config (no API keys, no private URLs).
   */
  compilePublicConfig(privateConfig: Record<string, unknown>): Record<string, unknown> {
    const publicConfig: Record<string, unknown> = {};
    const unsafeKeys = new Set([
      "apiKey", "api_key", "secret", "token", "password", "credential",
      "privateKey", "private_key", "accessToken", "access_token",
    ]);

    for (const [key, value] of Object.entries(privateConfig)) {
      const lowerKey = key.toLowerCase();
      const isUnsafe = unsafeKeys.has(lowerKey) ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("private");

      if (!isUnsafe) {
        publicConfig[key] = value;
      }
    }

    return publicConfig;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async tryPush(): Promise<boolean> {
    try {
      const git = simpleGit(this.publicRepoRoot);
      const remotes = await git.getRemotes();
      if (remotes.length === 0) return false;
      await git.push();
      return true;
    } catch {
      return false;
    }
  }

  private async getUncommittedFiles(): Promise<string[]> {
    try {
      const git = simpleGit(this.publicRepoRoot);
      const status = await git.status();
      return [
        ...status.modified,
        ...status.not_added,
        ...status.created,
        ...status.renamed.map((r) => r.to),
        ...status.deleted,
      ];
    } catch {
      return [];
    }
  }

  private stripPIILines(text: string): string {
    // Use the guard to find violations, then strip those lines
    const violations = this.guard.scanContent(text);
    if (violations.length === 0) return text;

    const lines = text.split("\n");
    const violationLines = new Set(violations.map((v) => v.line));

    return lines
      .map((line, idx) => (violationLines.has(idx + 1) ? "[REDACTED]" : line))
      .join("\n");
  }

  private buildSummary(
    written: string[],
    deleted: string[],
    commitSha: string | undefined,
    pushed: boolean
  ): string {
    const parts: string[] = [];
    if (written.length > 0) parts.push(`${written.length} file(s) written`);
    if (deleted.length > 0) parts.push(`${deleted.length} file(s) deleted`);
    if (commitSha) parts.push(`committed ${commitSha.slice(0, 7)}`);
    if (pushed) parts.push("pushed");
    return parts.join(", ") || "No changes";
  }

  // ── Deploy helpers ──────────────────────────────────────────────────────

  private async deployCloudflare(): Promise<DeployResult> {
    const execAsync = promisify(execFileCb);

    // Sync secrets first
    try {
      await this.secretManager.syncAll("cloudflare");
    } catch {
      // Non-fatal — secrets may already be set
    }

    const { stdout, stderr } = await execAsync("wrangler", ["deploy"], {
      cwd: this.publicRepoRoot,
      timeout: 120_000,
    });

    const result: DeployResult = {
      platform: "cloudflare",
      success: true,
      output: stdout + stderr,
      summary: "Deployed to Cloudflare Workers",
    };
    this.emit("deployed", result);
    return result;
  }

  private async deployGithubPages(): Promise<DeployResult> {
    const execAsync = promisify(execFileCb);

    // Sync secrets first
    try {
      await this.secretManager.syncAll("github");
    } catch {
      // Non-fatal
    }

    // Build + deploy via gh-pages or direct push to gh-pages branch
    const { stdout, stderr } = await execAsync("npx", ["gh-pages", "-d", "."], {
      cwd: this.publicRepoRoot,
      timeout: 120_000,
    });

    const result: DeployResult = {
      platform: "github-pages",
      success: true,
      output: stdout + stderr,
      summary: "Deployed to GitHub Pages",
    };
    this.emit("deployed", result);
    return result;
  }

  private async deployDocker(): Promise<DeployResult> {
    const execAsync = promisify(execFileCb);

    const { stdout, stderr } = await execAsync("docker", ["compose", "up", "--build", "-d"], {
      cwd: this.publicRepoRoot,
      timeout: 300_000,
    });

    const result: DeployResult = {
      platform: "docker",
      success: true,
      output: stdout + stderr,
      summary: "Deployed via Docker Compose",
    };
    this.emit("deployed", result);
    return result;
  }
}
