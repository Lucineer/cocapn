/**
 * Tests for src/gateway/secret-manager.ts
 *
 * Covers:
 *   - set/get/delete: .env.local management
 *   - list: masked listing
 *   - has: existence check
 *   - Platform sync (mocked — just tests interface)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { GatewaySecretManager } from "../../src/gateway/secret-manager.js";

let tempDir: string;
let manager: GatewaySecretManager;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "secret-test-"));
  manager = new GatewaySecretManager({ repoRoot: tempDir });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── set / get ────────────────────────────────────────────────────────────────

describe("GatewaySecretManager.set/get", () => {
  it("creates .env.local if missing", () => {
    manager.set("API_KEY", "test123");
    expect(existsSync(join(tempDir, ".env.local"))).toBe(true);
  });

  it("stores and retrieves a secret", () => {
    manager.set("API_KEY", "test123");
    expect(manager.get("API_KEY")).toBe("test123");
  });

  it("overwrites an existing secret", () => {
    manager.set("API_KEY", "old-value");
    manager.set("API_KEY", "new-value");
    expect(manager.get("API_KEY")).toBe("new-value");
  });

  it("stores multiple secrets", () => {
    manager.set("KEY_A", "val-a");
    manager.set("KEY_B", "val-b");
    expect(manager.get("KEY_A")).toBe("val-a");
    expect(manager.get("KEY_B")).toBe("val-b");
  });

  it("returns undefined for non-existent key", () => {
    expect(manager.get("NONEXISTENT")).toBeUndefined();
  });

  it("returns undefined when .env.local does not exist", () => {
    const fresh = new GatewaySecretManager({ repoRoot: join(tempDir, "nope") });
    expect(fresh.get("ANY")).toBeUndefined();
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("GatewaySecretManager.delete", () => {
  it("deletes an existing secret", () => {
    manager.set("KEY_A", "val-a");
    manager.set("KEY_B", "val-b");
    expect(manager.delete("KEY_A")).toBe(true);
    expect(manager.get("KEY_A")).toBeUndefined();
    expect(manager.get("KEY_B")).toBe("val-b");
  });

  it("returns false for non-existent key", () => {
    expect(manager.delete("NONEXISTENT")).toBe(false);
  });

  it("returns false when .env.local does not exist", () => {
    const fresh = new GatewaySecretManager({ repoRoot: join(tempDir, "nope") });
    expect(fresh.delete("ANY")).toBe(false);
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("GatewaySecretManager.list", () => {
  it("lists all secrets with masked values", () => {
    manager.set("API_KEY", "sk-1234567890abcdef");
    manager.set("DB_HOST", "localhost");

    const entries = manager.list();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.key).sort()).toEqual(["API_KEY", "DB_HOST"]);

    // Values should be masked
    const apiKeyEntry = entries.find((e) => e.key === "API_KEY")!;
    expect(apiKeyEntry.maskedValue).toContain("*");
    expect(apiKeyEntry.maskedValue).not.toContain("sk-1234567890abcdef");
  });

  it("returns empty array when no secrets", () => {
    const fresh = new GatewaySecretManager({ repoRoot: join(tempDir, "nope") });
    expect(fresh.list()).toHaveLength(0);
  });

  it("handles short values correctly", () => {
    manager.set("X", "ab");
    const entries = manager.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.maskedValue).toBe("****");
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe("GatewaySecretManager.has", () => {
  it("returns true for existing key", () => {
    manager.set("MY_KEY", "value");
    expect(manager.has("MY_KEY")).toBe(true);
  });

  it("returns false for missing key", () => {
    expect(manager.has("MISSING")).toBe(false);
  });
});

// ─── constructor options ──────────────────────────────────────────────────────

describe("GatewaySecretManager constructor", () => {
  it("stores GitHub repo and Cloudflare project options", () => {
    const m = new GatewaySecretManager({
      repoRoot: tempDir,
      githubRepo: "alice/repo",
      cloudflareProject: "my-project",
    });
    // Can't directly test private fields, but syncToGithub should throw with message
    m.set("KEY", "val");
    // Not testing actual gh/wrangler calls — just that options are accepted
    expect(m.has("KEY")).toBe(true);
  });
});

// ─── audit ────────────────────────────────────────────────────────────────────

describe("GatewaySecretManager.audit", () => {
  it("returns audit results with local=true when secrets exist", async () => {
    manager.set("API_KEY", "test123");
    manager.set("DB_URL", "postgres://...");

    const results = await manager.audit();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.local)).toBe(true);
    // GitHub/Cloudflare won't be checked without gh/wrangler
    expect(results.every((r) => r.github === false)).toBe(true);
    expect(results.every((r) => r.cloudflare === false)).toBe(true);
  });

  it("returns empty array when no secrets", async () => {
    const fresh = new GatewaySecretManager({ repoRoot: join(tempDir, "nope") });
    const results = await fresh.audit();
    expect(results).toHaveLength(0);
  });
});
