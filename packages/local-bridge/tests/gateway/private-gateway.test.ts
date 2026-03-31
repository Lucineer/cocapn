/**
 * Tests for src/gateway/private-gateway.ts
 *
 * Covers:
 *   - editPublic: apply changes through the gateway
 *   - editPublic: blocks secret leaks
 *   - reviewPublic: review pending changes
 *   - compilePublicSoul: strip private sections
 *   - compilePublicConfig: strip secret keys
 *   - Event emission
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { simpleGit } from "simple-git";
import { PrivateGateway, type PublicChange } from "../../src/gateway/private-gateway.js";

let tempPrivate: string;
let tempPublic: string;
let gateway: PrivateGateway;

beforeEach(async () => {
  tempPrivate = mkdtempSync(join(tmpdir(), "gw-private-"));
  tempPublic = mkdtempSync(join(tmpdir(), "gw-public-"));

  // Initialize git repos
  const privateGit = simpleGit(tempPrivate);
  await privateGit.init();
  await privateGit.addConfig("user.email", "test@test.com");
  await privateGit.addConfig("user.name", "Test");
  writeFileSync(join(tempPrivate, "soul.md"), "# Soul\nHello");
  await privateGit.add("soul.md");
  await privateGit.commit("init");

  const publicGit = simpleGit(tempPublic);
  await publicGit.init();
  await publicGit.addConfig("user.email", "test@test.com");
  await publicGit.addConfig("user.name", "Test");
  writeFileSync(join(tempPublic, "index.html"), "<h1>Hello</h1>");
  await publicGit.add("index.html");
  await publicGit.commit("init");

  gateway = new PrivateGateway({
    privateRepoRoot: tempPrivate,
    publicRepoRoot: tempPublic,
  });
});

afterEach(() => {
  rmSync(tempPrivate, { recursive: true, force: true });
  rmSync(tempPublic, { recursive: true, force: true });
});

// ─── editPublic: success ──────────────────────────────────────────────────────

describe("PrivateGateway.editPublic (success)", () => {
  it("writes safe files to the public repo", async () => {
    const result = await gateway.editPublic({
      files: { "about.md": "# About\nThis is my public page." },
      message: "Add about page",
    });

    expect(result.success).toBe(true);
    expect(result.written).toContain("about.md");
    expect(result.blocked).toHaveLength(0);
    expect(readFileSync(join(tempPublic, "about.md"), "utf8")).toContain("public page");
  });

  it("commits the change with the provided message", async () => {
    const result = await gateway.editPublic({
      files: { "page.md": "# Page" },
      message: "test: add page",
    });

    expect(result.success).toBe(true);
    expect(result.commitSha).toBeDefined();

    const git = simpleGit(tempPublic);
    const log = await git.log({ maxCount: 1 });
    expect(log.latest?.message).toContain("test: add page");
  });

  it("writes multiple files at once", async () => {
    const result = await gateway.editPublic({
      files: {
        "a.txt": "content A",
        "sub/b.txt": "content B",
      },
      message: "add two files",
    });

    expect(result.success).toBe(true);
    expect(result.written).toHaveLength(2);
    expect(readFileSync(join(tempPublic, "sub", "b.txt"), "utf8")).toBe("content B");
  });

  it("deletes specified files", async () => {
    writeFileSync(join(tempPublic, "old.txt"), "stale");
    const git = simpleGit(tempPublic);
    await git.add("old.txt");
    await git.commit("add old file");

    const result = await gateway.editPublic({
      files: {},
      deletions: ["old.txt"],
      message: "remove old file",
    });

    expect(result.success).toBe(true);
    expect(result.deleted).toContain("old.txt");
    expect(existsSync(join(tempPublic, "old.txt"))).toBe(false);
  });

  it("returns correct summary", async () => {
    const result = await gateway.editPublic({
      files: { "x.txt": "x" },
      message: "test",
    });

    expect(result.summary).toContain("1 file(s) written");
  });

  it("emits edit-attempted and edit-applied events", async () => {
    const attempted: PublicChange[] = [];
    const applied: unknown[] = [];

    gateway.on("edit-attempted", (change) => attempted.push(change));
    gateway.on("edit-applied", (result) => applied.push(result));

    await gateway.editPublic({
      files: { "test.txt": "safe content" },
      message: "event test",
    });

    expect(attempted).toHaveLength(1);
    expect(applied).toHaveLength(1);
  });
});

// ─── editPublic: blocked ──────────────────────────────────────────────────────

describe("PrivateGateway.editPublic (blocked)", () => {
  it("blocks edits containing API keys", async () => {
    const result = await gateway.editPublic({
      files: { "config.json": '{"key": "sk-abc123def456ghi789jkl012mno345pqr"}' },
      message: "leak attempt",
    });

    expect(result.success).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
    expect(result.written).toHaveLength(0);
  });

  it("blocks edits containing email addresses", async () => {
    const result = await gateway.editPublic({
      files: { "contact.md": "Email: alice@example.com for info" },
      message: "leak email",
    });

    expect(result.success).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it("blocks edits containing passwords", async () => {
    const result = await gateway.editPublic({
      files: { "env.txt": "password=hunter2" },
      message: "leak password",
    });

    expect(result.success).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it("blocks edits containing private URLs", async () => {
    const result = await gateway.editPublic({
      files: { "api.txt": "endpoint=http://localhost:3000/api" },
      message: "leak internal URL",
    });

    expect(result.success).toBe(false);
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it("emits edit-blocked event on secret detection", async () => {
    const blocked: unknown[] = [];

    gateway.on("edit-blocked", (_change, violations) => blocked.push(violations));

    await gateway.editPublic({
      files: { "bad.txt": "api_key=supersecret" },
      message: "blocked test",
    });

    expect(blocked).toHaveLength(1);
  });

  it("allows edits when skipGuard is true", async () => {
    const result = await gateway.editPublic({
      files: { "override.txt": "api_key=supersecret" },
      message: "skip guard",
      skipGuard: true,
    });

    expect(result.success).toBe(true);
    expect(result.written).toContain("override.txt");
  });
});

// ─── reviewPublic ─────────────────────────────────────────────────────────────

describe("PrivateGateway.reviewPublic", () => {
  it("returns safe=true when no uncommitted changes", async () => {
    const review = await gateway.reviewPublic();
    expect(review.safe).toBe(true);
    expect(review.uncommittedFiles).toHaveLength(0);
  });

  it("detects uncommitted safe files", async () => {
    writeFileSync(join(tempPublic, "new.md"), "# Safe page");
    const review = await gateway.reviewPublic();
    expect(review.uncommittedFiles).toContain("new.md");
    expect(review.safe).toBe(true);
  });

  it("flags uncommitted files with secrets", async () => {
    writeFileSync(join(tempPublic, "leak.json"), '{"key": "sk-abc123def456ghi789jkl012mno345pqr"}');
    const review = await gateway.reviewPublic();
    expect(review.safe).toBe(false);
    expect(review.guardScan.violations.length).toBeGreaterThan(0);
  });

  it("includes human-readable summary", async () => {
    const review = await gateway.reviewPublic();
    expect(typeof review.summary).toBe("string");
    expect(review.summary.length).toBeGreaterThan(0);
  });
});

// ─── compilePublicSoul ────────────────────────────────────────────────────────

describe("PrivateGateway.compilePublicSoul", () => {
  it("strips <!-- private --> sections", () => {
    const privateSoul = [
      "# My Agent",
      "I am helpful.",
      "<!-- private -->",
      "My email is alice@example.com",
      "<!-- /private -->",
      "I like coffee.",
    ].join("\n");

    const publicSoul = gateway.compilePublicSoul(privateSoul);
    expect(publicSoul).not.toContain("alice@example.com");
    expect(publicSoul).toContain("I am helpful.");
    expect(publicSoul).toContain("I like coffee.");
  });

  it("returns clean soul when no private sections", () => {
    const soul = "# Agent\nJust a public soul.";
    expect(gateway.compilePublicSoul(soul)).toContain("Just a public soul.");
  });
});

// ─── compilePublicConfig ──────────────────────────────────────────────────────

describe("PrivateGateway.compilePublicConfig", () => {
  it("strips secret keys from config", () => {
    const config = {
      name: "my-agent",
      apiKey: "sk-123",
      database: { host: "localhost" },
      secret: "supersecret",
      password: "hunter2",
    };

    const publicConfig = gateway.compilePublicConfig(config);
    expect(publicConfig["name"]).toBe("my-agent");
    expect(publicConfig).not.toHaveProperty("apiKey");
    expect(publicConfig).not.toHaveProperty("secret");
    expect(publicConfig).not.toHaveProperty("password");
    expect(publicConfig["database"]).toEqual({ host: "localhost" });
  });

  it("passes through safe config values", () => {
    const config = {
      title: "My Site",
      version: "1.0.0",
      features: { chat: true },
    };

    const publicConfig = gateway.compilePublicConfig(config);
    expect(publicConfig).toEqual(config);
  });

  it("strips keys with 'token' in the name", () => {
    const config = {
      accessToken: "abc",
      safeKey: "value",
    };

    const publicConfig = gateway.compilePublicConfig(config);
    expect(publicConfig).not.toHaveProperty("accessToken");
    expect(publicConfig["safeKey"]).toBe("value");
  });
});

// ─── Accessor methods ─────────────────────────────────────────────────────────

describe("PrivateGateway accessors", () => {
  it("exposes the guard", () => {
    expect(gateway.getGuard()).toBeDefined();
    expect(gateway.getGuard().isSafe("safe content")).toBe(true);
  });

  it("exposes the secret manager", () => {
    expect(gateway.getSecretManager()).toBeDefined();
  });
});
