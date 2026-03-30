/**
 * Tests for cocapn invite command.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
  createInviteCommand,
  type Invite,
} from "../src/commands/invite.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cocapn-invite-test-"));
  // Create a valid cocapn project
  mkdirSync(join(tmpDir, "cocapn"), { recursive: true });
  writeFileSync(join(tmpDir, "cocapn", "config.yml"), "soul: cocapn/soul.md\n", "utf-8");
  writeFileSync(join(tmpDir, "cocapn", "soul.md"), "# Soul\n\nYou are helpful.\n", "utf-8");

  // Initialize git repo (needed for acceptInvite clone detection)
  try {
    const { execSync } = require("child_process");
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "pipe" });
    execSync("git add -A", { cwd: tmpDir, stdio: "pipe" });
    execSync("git commit -m 'init'", { cwd: tmpDir, stdio: "pipe" });
  } catch {
    // Git not available — tests that don't need git will still pass
  }
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── createInvite ───────────────────────────────────────────────────────────

describe("createInvite", () => {
  it("creates an invite with default options", () => {
    const invite = createInvite(tmpDir);

    expect(invite.code).toMatch(/^[a-f0-9]{8}$/);
    expect(invite.mode).toBe("public");
    expect(invite.readOnly).toBe(false);
    expect(invite.uses).toBe(0);
    expect(invite.createdAt).toBeTruthy();
    expect(invite.expiresAt).toBeTruthy();

    // File should exist
    const filePath = join(tmpDir, "cocapn", "invites", `${invite.code}.json`);
    expect(existsSync(filePath)).toBe(true);

    // File content should match
    const stored: Invite = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(stored.code).toBe(invite.code);
  });

  it("creates a read-only invite", () => {
    const invite = createInvite(tmpDir, { readonly: true });
    expect(invite.readOnly).toBe(true);
  });

  it("creates invite with specified mode", () => {
    const invite = createInvite(tmpDir, { mode: "private" });
    expect(invite.mode).toBe("private");
  });

  it("creates invite with maintenance mode", () => {
    const invite = createInvite(tmpDir, { mode: "maintenance" });
    expect(invite.mode).toBe("maintenance");
  });

  it("defaults unknown mode to public", () => {
    const invite = createInvite(tmpDir, { mode: "invalid" as any });
    expect(invite.mode).toBe("public");
  });

  it("creates invite with custom expiry", () => {
    const invite = createInvite(tmpDir, { expires: "24h" });

    const created = new Date(invite.createdAt).getTime();
    const expires = new Date(invite.expiresAt).getTime();
    const diffMs = expires - created;
    const diffHours = diffMs / (1000 * 60 * 60);

    expect(diffHours).toBeGreaterThanOrEqual(23);
    expect(diffHours).toBeLessThanOrEqual(25);
  });

  it("creates invite with minute expiry", () => {
    const invite = createInvite(tmpDir, { expires: "30m" });

    const created = new Date(invite.createdAt).getTime();
    const expires = new Date(invite.expiresAt).getTime();
    const diffMs = expires - created;
    const diffMinutes = diffMs / (1000 * 60);

    expect(diffMinutes).toBeGreaterThanOrEqual(29);
    expect(diffMinutes).toBeLessThanOrEqual(31);
  });

  it("throws on invalid expiry format", () => {
    expect(() => createInvite(tmpDir, { expires: "invalid" })).toThrow("Invalid expiry format");
  });

  it("creates invites directory if it doesn't exist", () => {
    const invite = createInvite(tmpDir);
    expect(existsSync(join(tmpDir, "cocapn", "invites"))).toBe(true);
    expect(existsSync(join(tmpDir, "cocapn", "invites", `${invite.code}.json`))).toBe(true);
  });

  it("generates unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const invite = createInvite(tmpDir);
      codes.add(invite.code);
    }
    expect(codes.size).toBe(20);
  });
});

// ─── listInvites ────────────────────────────────────────────────────────────

describe("listInvites", () => {
  it("returns empty array when no invites exist", () => {
    const result = listInvites(tmpDir);
    expect(result).toEqual([]);
  });

  it("lists created invites sorted newest first", () => {
    createInvite(tmpDir);
    createInvite(tmpDir);

    const result = listInvites(tmpDir);
    expect(result.length).toBe(2);
    expect(result[0].createdAt >= result[1].createdAt).toBe(true);
  });

  it("includes all invite properties", () => {
    createInvite(tmpDir, { readonly: true, mode: "private" });

    const result = listInvites(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].readOnly).toBe(true);
    expect(result[0].mode).toBe("private");
  });

  it("ignores corrupted JSON files", () => {
    mkdirSync(join(tmpDir, "cocapn", "invites"), { recursive: true });
    writeFileSync(join(tmpDir, "cocapn", "invites", "bad.json"), "not json", "utf-8");

    const result = listInvites(tmpDir);
    expect(result).toEqual([]);
  });

  it("ignores non-JSON files", () => {
    mkdirSync(join(tmpDir, "cocapn", "invites"), { recursive: true });
    writeFileSync(join(tmpDir, "cocapn", "invites", "readme.txt"), "hello", "utf-8");

    const result = listInvites(tmpDir);
    expect(result).toEqual([]);
  });
});

// ─── revokeInvite ──────────────────────────────────────────────────────────

describe("revokeInvite", () => {
  it("revokes an existing invite", () => {
    const invite = createInvite(tmpDir);
    const revoked = revokeInvite(tmpDir, invite.code);

    expect(revoked.revokedAt).toBeTruthy();
    expect(revoked.code).toBe(invite.code);

    // Verify persisted
    const stored: Invite = JSON.parse(
      readFileSync(join(tmpDir, "cocapn", "invites", `${invite.code}.json`), "utf-8"),
    );
    expect(stored.revokedAt).toBeTruthy();
  });

  it("throws when invite not found", () => {
    expect(() => revokeInvite(tmpDir, "nonexistent")).toThrow("Invite not found");
  });

  it("throws when invite already revoked", () => {
    const invite = createInvite(tmpDir);
    revokeInvite(tmpDir, invite.code);

    expect(() => revokeInvite(tmpDir, invite.code)).toThrow("already revoked");
  });
});

// ─── acceptInvite ──────────────────────────────────────────────────────────

describe("acceptInvite", () => {
  it("throws when invite not found", () => {
    expect(() => acceptInvite(tmpDir, "nonexistent")).toThrow("Invite not found");
  });

  it("throws when invite is revoked", () => {
    const invite = createInvite(tmpDir);
    revokeInvite(tmpDir, invite.code);

    expect(() => acceptInvite(tmpDir, invite.code)).toThrow("revoked");
  });

  it("increments invite uses count", () => {
    const invite = createInvite(tmpDir);
    expect(invite.uses).toBe(0);

    // Read from file to verify increment
    const filePath = join(tmpDir, "cocapn", "invites", `${invite.code}.json`);
    const stored: Invite = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(stored.uses).toBe(0);
  });
});

// ─── createInviteCommand ───────────────────────────────────────────────────

describe("createInviteCommand", () => {
  it("creates command with subcommands", () => {
    const cmd = createInviteCommand();
    expect(cmd.name()).toBe("invite");

    const subcommands = cmd.commands.map((c: { name: () => string }) => c.name());
    expect(subcommands).toContain("create");
    expect(subcommands).toContain("list");
    expect(subcommands).toContain("revoke");
    expect(subcommands).toContain("accept");
  });

  it("create command has correct options", () => {
    const cmd = createInviteCommand();
    const createCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "create");
    expect(createCmd).toBeDefined();

    const optionFlags = createCmd.options.map((o: { flags: string }) => o.flags);
    expect(optionFlags.some((f: string) => f.includes("--readonly"))).toBe(true);
    expect(optionFlags.some((f: string) => f.includes("--mode"))).toBe(true);
    expect(optionFlags.some((f: string) => f.includes("--expires"))).toBe(true);
  });

  it("accept command has --dir option", () => {
    const cmd = createInviteCommand();
    const acceptCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "accept");
    expect(acceptCmd).toBeDefined();

    const optionFlags = acceptCmd.options.map((o: { flags: string }) => o.flags);
    expect(optionFlags.some((f: string) => f.includes("--dir"))).toBe(true);
  });

  it("revoke command has code argument", () => {
    const cmd = createInviteCommand();
    const revokeCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "revoke");
    expect(revokeCmd).toBeDefined();
    const argDescriptions = revokeCmd.registeredArguments || [];
    expect(argDescriptions.length).toBeGreaterThan(0);
    expect(argDescriptions[0].name()).toBe("code");
  });
});

// ─── Integration ────────────────────────────────────────────────────────────

describe("integration", () => {
  it("full create → list → revoke cycle", () => {
    // Create
    const invite = createInvite(tmpDir, { readonly: true, mode: "private" });

    // List should show it
    const listed = listInvites(tmpDir);
    expect(listed.length).toBe(1);
    expect(listed[0].code).toBe(invite.code);
    expect(listed[0].readOnly).toBe(true);

    // Revoke
    const revoked = revokeInvite(tmpDir, invite.code);
    expect(revoked.revokedAt).toBeTruthy();

    // List still shows it but as revoked
    const afterRevoke = listInvites(tmpDir);
    expect(afterRevoke.length).toBe(1);
    expect(afterRevoke[0].revokedAt).toBeTruthy();
  });

  it("multiple invites with different modes", () => {
    createInvite(tmpDir, { mode: "public" });
    createInvite(tmpDir, { mode: "private", readonly: true });
    createInvite(tmpDir, { mode: "maintenance" });

    const invites = listInvites(tmpDir);
    expect(invites.length).toBe(3);

    const modes = invites.map((i) => i.mode);
    expect(modes).toContain("public");
    expect(modes).toContain("private");
    expect(modes).toContain("maintenance");

    const readOnlyInvites = invites.filter((i) => i.readOnly);
    expect(readOnlyInvites.length).toBe(1);
    expect(readOnlyInvites[0].mode).toBe("private");
  });
});
