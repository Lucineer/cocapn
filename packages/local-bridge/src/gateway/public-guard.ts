/**
 * PublicGuard — scans files for secrets/PII before they are published to the
 * public repo. Nothing passes through unless the guard clears it.
 *
 * Detects: API keys, passwords, tokens, private URLs, email addresses, and
 * long hex strings that look like secrets. Supports a whitelist for known-safe
 * patterns.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuardViolation {
  file: string;
  line: number;
  pattern: string;
  matched: string;
}

export interface GuardResult {
  safe: boolean;
  violations: GuardViolation[];
  filesScanned: number;
}

export interface GuardWhitelistEntry {
  /** Glob-like pattern for file paths (e.g. "cocapn/public-*.json"). */
  filePattern?: string;
  /** Regex pattern string that should be allowed through. */
  allowPattern: string;
}

// ─── Detection patterns ───────────────────────────────────────────────────────

const DETECTION_RULES: Array<{ name: string; re: RegExp }> = [
  {
    name: "API key (sk-)",
    re: /\bsk-[A-Za-z0-9]{20,}\b/gi,
  },
  {
    name: "GitHub PAT (ghp_)",
    re: /\bghp_[A-Za-z0-9]{30,}\b/g,
  },
  {
    name: "GitHub OAuth (gho_)",
    re: /\bgho_[A-Za-z0-9]{30,}\b/g,
  },
  {
    name: "Slack token (xox*)",
    re: /\bxox[bprsa]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: "AWS access key",
    re: /\bAKIA[A-Z0-9]{16}\b/g,
  },
  {
    name: "Bearer token",
    re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  },
  {
    name: "Email address",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    name: "Password assignment",
    re: /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
  },
  {
    name: "Secret assignment",
    re: /\b(?:secret|token|api[_-]?key|access[_-]?key|auth[_-]?key)\s*[:=]\s*\S+/gi,
  },
  {
    name: "Long hex string (40+)",
    re: /\b[0-9a-f]{40,}\b/gi,
  },
  {
    name: "Private/internal URL",
    re: /\bhttps?:\/\/(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|192\.168(?:\.\d+){2}|10(?:\.\d+){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d+){2})\b[^\s]*/gi,
  },
  {
    name: "Generic secret value in quotes",
    re: /["'](?:sk-|ghp_|gho_|xox[bprsa]-|AKIA)[A-Za-z0-9\-_]{10,}["']/g,
  },
];

// File extensions to scan (skip binary/media)
const SCANNABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".yml", ".yaml", ".toml",
  ".md", ".txt", ".html", ".css", ".scss",
  ".env", ".sh", ".bash", ".zsh",
  ".xml", ".svg",
]);

// ─── PublicGuard ──────────────────────────────────────────────────────────────

export class PublicGuard {
  private whitelist: GuardWhitelistEntry[];
  private customRules: Array<{ name: string; re: RegExp }>;

  constructor(
    options: {
      whitelist?: GuardWhitelistEntry[];
      /** Additional detection rules. */
      extraRules?: Array<{ name: string; pattern: string }>;
    } = {}
  ) {
    this.whitelist = options.whitelist ?? [];
    this.customRules = (options.extraRules ?? []).map((r) => ({
      name: r.name,
      re: new RegExp(r.pattern, "gi"),
    }));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Scan a single string for secret/PII patterns.
   * Returns violations found (empty array if safe).
   */
  scanContent(content: string, filePath?: string): GuardViolation[] {
    const violations: GuardViolation[] = [];
    const allRules = [...DETECTION_RULES, ...this.customRules];

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      for (const rule of allRules) {
        // Reset lastIndex for global regexes
        rule.re.lastIndex = 0;
        const match = rule.re.exec(line);
        if (match && !this.isWhitelisted(filePath ?? "", match[0], rule.re.source)) {
          violations.push({
            file: filePath ?? "<content>",
            line: i + 1,
            pattern: rule.name,
            matched: this.maskSecret(match[0]),
          });
        }
      }
    }

    return violations;
  }

  /**
   * Scan a single file on disk.
   */
  scanFile(filePath: string): GuardViolation[] {
    try {
      const content = readFileSync(filePath, "utf8");
      return this.scanContent(content, filePath);
    } catch {
      // Unreadable file — skip
      return [];
    }
  }

  /**
   * Recursively scan a directory for secrets.
   */
  scanDirectory(dirPath: string): GuardResult {
    const violations: GuardViolation[] = [];
    let filesScanned = 0;

    const walk = (dir: string): void => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          // Skip common non-scannable dirs
          if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;

          const fullPath = join(dir, entry);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (SCANNABLE_EXTENSIONS.has(extname(entry))) {
              filesScanned++;
              violations.push(...this.scanFile(fullPath));
            }
          } catch {
            // Skip inaccessible files
          }
        }
      } catch {
        // Skip inaccessible dirs
      }
    };

    walk(dirPath);
    return { safe: violations.length === 0, violations, filesScanned };
  }

  /**
   * Quick check: is a single string free of secrets?
   */
  isSafe(content: string): boolean {
    return this.scanContent(content).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private isWhitelisted(filePath: string, match: string, patternSource: string): boolean {
    for (const entry of this.whitelist) {
      if (entry.filePattern) {
        // Simple glob: only check if file path matches
        if (!this.matchGlob(filePath, entry.filePattern)) continue;
      }
      const allowRe = new RegExp(entry.allowPattern);
      if (allowRe.test(match) || allowRe.test(patternSource)) return true;
    }
    return false;
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    // Simple * glob matching
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(regexStr).test(filePath);
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) return "***";
    return value.slice(0, 3) + "***" + value.slice(-3);
  }
}
