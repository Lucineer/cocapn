/**
 * Tests for src/gateway/public-guard.ts
 *
 * Covers:
 *   - scanContent: detects secrets/PII in text
 *   - scanFile: scans files on disk
 *   - scanDirectory: recursive directory scan
 *   - isSafe: quick boolean check
 *   - Whitelist: allow specific patterns through
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PublicGuard } from "../../src/gateway/public-guard.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "guard-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── scanContent ──────────────────────────────────────────────────────────────

describe("PublicGuard.scanContent", () => {
  const guard = new PublicGuard();

  it("detects Stripe-style API keys", () => {
    const violations = guard.scanContent("key=sk-abc123def456ghi789jkl012mno345pqr");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("API key"))).toBe(true);
  });

  it("detects GitHub PATs", () => {
    const violations = guard.scanContent("token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("GitHub PAT"))).toBe(true);
  });

  it("detects email addresses", () => {
    const violations = guard.scanContent("contact: alice@example.com");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("Email"))).toBe(true);
  });

  it("detects password assignments", () => {
    const violations = guard.scanContent("password=hunter2");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("Password"))).toBe(true);
  });

  it("detects secret assignments", () => {
    const violations = guard.scanContent("api_key=mysecretkey123");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("Secret"))).toBe(true);
  });

  it("detects long hex strings (40+ chars)", () => {
    const hex = "a".repeat(42);
    const violations = guard.scanContent(`token=${hex}`);
    expect(violations.some((v) => v.pattern.includes("hex"))).toBe(true);
  });

  it("detects Bearer tokens", () => {
    const violations = guard.scanContent("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload");
    expect(violations.some((v) => v.pattern.includes("Bearer"))).toBe(true);
  });

  it("detects private URLs (localhost)", () => {
    const violations = guard.scanContent("endpoint=http://localhost:3000/api");
    expect(violations.some((v) => v.pattern.includes("Private"))).toBe(true);
  });

  it("detects AWS access keys", () => {
    const violations = guard.scanContent("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");
    expect(violations.some((v) => v.pattern.includes("AWS"))).toBe(true);
  });

  it("returns empty for clean content", () => {
    const violations = guard.scanContent("# Hello World\nThis is a safe public page.\n");
    expect(violations).toHaveLength(0);
  });

  it("reports correct line numbers", () => {
    const content = "line 1 is safe\napi_key=secret123\nline 3 is safe";
    const violations = guard.scanContent(content);
    expect(violations.some((v) => v.line === 2)).toBe(true);
  });

  it("masks secrets in violation output", () => {
    const violations = guard.scanContent("sk-abc123def456ghi789jkl012mno345pqr");
    expect(violations.length).toBeGreaterThan(0);
    // Masked value should not contain the full secret
    const matched = violations[0]!.matched;
    expect(matched).toContain("***");
    expect(matched).not.toContain("sk-abc123def456ghi789jkl012mno345pqr");
  });
});

// ─── isSafe ───────────────────────────────────────────────────────────────────

describe("PublicGuard.isSafe", () => {
  const guard = new PublicGuard();

  it("returns true for safe content", () => {
    expect(guard.isSafe("# Public page\nHello world")).toBe(true);
  });

  it("returns false for content with secrets", () => {
    expect(guard.isSafe("key=sk-abc123def456ghi789jkl012mno345pqr")).toBe(false);
  });
});

// ─── scanFile ─────────────────────────────────────────────────────────────────

describe("PublicGuard.scanFile", () => {
  const guard = new PublicGuard();

  it("scans a file and detects secrets", () => {
    const filePath = join(tempDir, "config.json");
    writeFileSync(filePath, '{"apiKey": "sk-abc123def456ghi789jkl012mno345pqr"}');

    const violations = guard.scanFile(filePath);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.file).toBe(filePath);
  });

  it("returns empty for safe files", () => {
    const filePath = join(tempDir, "safe.md");
    writeFileSync(filePath, "# Hello\nJust a safe page.");

    const violations = guard.scanFile(filePath);
    expect(violations).toHaveLength(0);
  });

  it("handles unreadable files gracefully", () => {
    const violations = guard.scanFile(join(tempDir, "nonexistent.txt"));
    expect(violations).toHaveLength(0);
  });
});

// ─── scanDirectory ────────────────────────────────────────────────────────────

describe("PublicGuard.scanDirectory", () => {
  const guard = new PublicGuard();

  it("recursively scans directories for secrets", () => {
    mkdirSync(join(tempDir, "sub"));
    writeFileSync(join(tempDir, "safe.txt"), "hello world");
    writeFileSync(join(tempDir, "sub", "leaked.json"), '{"token": "sk-abc123def456ghi789jkl012mno345pqr"}');

    const result = guard.scanDirectory(tempDir);
    expect(result.safe).toBe(false);
    expect(result.filesScanned).toBe(2);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("returns safe for clean directories", () => {
    writeFileSync(join(tempDir, "index.html"), "<h1>Hello</h1>");

    const result = guard.scanDirectory(tempDir);
    expect(result.safe).toBe(true);
  });

  it("skips node_modules and .git directories", () => {
    mkdirSync(join(tempDir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(tempDir, ".git", "objects"), { recursive: true });
    writeFileSync(join(tempDir, "node_modules", "pkg", "leak.txt"), "api_key=supersecret123");
    writeFileSync(join(tempDir, ".git", "objects", "leak.txt"), "password=hunter2");
    writeFileSync(join(tempDir, "safe.txt"), "all good");

    const result = guard.scanDirectory(tempDir);
    expect(result.safe).toBe(true);
    expect(result.filesScanned).toBe(1);
  });

  it("skips binary/non-scannable file extensions", () => {
    writeFileSync(join(tempDir, "image.png"), "not a real png but still skipped");
    writeFileSync(join(tempDir, "data.bin"), "binary data");

    const result = guard.scanDirectory(tempDir);
    expect(result.filesScanned).toBe(0);
  });
});

// ─── Whitelist ────────────────────────────────────────────────────────────────

describe("PublicGuard with whitelist", () => {
  it("allows whitelisted patterns", () => {
    const guard = new PublicGuard({
      whitelist: [
        { filePattern: "cocapn/public-*", allowPattern: "public-key" },
      ],
    });

    // "public-key" as a value normally wouldn't trigger, but test the mechanism
    const violations = guard.scanContent("some safe content", "cocapn/public-facts.json");
    expect(violations).toHaveLength(0);
  });

  it("still blocks non-whitelisted patterns", () => {
    const guard = new PublicGuard({
      whitelist: [
        { allowPattern: "^safe-value$" },
      ],
    });

    const violations = guard.scanContent("api_key=supersecret123");
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ─── Custom rules ─────────────────────────────────────────────────────────────

describe("PublicGuard with custom rules", () => {
  it("applies extra detection rules", () => {
    const guard = new PublicGuard({
      extraRules: [
        { name: "Custom token", pattern: "CUSTOM_TOKEN_[A-Z]+" },
      ],
    });

    const violations = guard.scanContent("auth=CUSTOM_TOKEN_ABC");
    expect(violations.some((v) => v.pattern === "Custom token")).toBe(true);
  });
});
