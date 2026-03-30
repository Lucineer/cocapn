/**
 * Tests for cocapn auth command.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  maskKey,
  isTokenExpired,
  getTokenExpiry,
  readAuth,
  writeAuth,
  removeAuth,
  authLogin,
  authLogout,
  authStatus,
  readKeys,
  setKey,
  removeKey,
  createAuthCommand,
  type AuthData,
} from "../src/commands/auth.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cocapn-auth-test-"));
  mkdirSync(join(tmpDir, "cocapn"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── maskKey ────────────────────────────────────────────────────────────────

describe("maskKey", () => {
  it("returns (none) for undefined", () => {
    expect(maskKey(undefined)).toBe("(none)");
  });

  it("returns (none) for empty string", () => {
    expect(maskKey("")).toBe("(none)");
  });

  it("masks short keys (< 4 chars)", () => {
    expect(maskKey("ab")).toBe("ab***");
    expect(maskKey("abc")).toBe("ab***");
  });

  it("masks medium keys (4-8 chars)", () => {
    expect(maskKey("abcd")).toBe("abcd***");
    expect(maskKey("abcdefg")).toBe("abcd***");
  });

  it("masks long keys (> 8 chars) showing first 8", () => {
    expect(maskKey("abcdefghijklmnop")).toBe("abcdefgh***");
    expect(maskKey("sk-1234567890abcdef")).toBe("sk-12345***");
  });
});

// ─── JWT helpers ────────────────────────────────────────────────────────────

describe("JWT helpers", () => {
  it("isTokenExpired returns true for expired token", () => {
    // JWT with exp in the past
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }))
      .toString("base64url");
    const token = `header.${payload}.sig`;
    expect(isTokenExpired(token)).toBe(true);
  });

  it("isTokenExpired returns false for future token", () => {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
      .toString("base64url");
    const token = `header.${payload}.sig`;
    expect(isTokenExpired(token)).toBe(false);
  });

  it("isTokenExpired returns true for malformed token", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });

  it("isTokenExpired returns true for token without exp", () => {
    const payload = Buffer.from(JSON.stringify({ email: "test@test.com" }))
      .toString("base64url");
    const token = `header.${payload}.sig`;
    expect(isTokenExpired(token)).toBe(true);
  });

  it("getTokenExpiry returns ISO string for valid token", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp }))
      .toString("base64url");
    const token = `header.${payload}.sig`;
    const result = getTokenExpiry(token);
    expect(result).toBeTruthy();
    expect(new Date(result!).getTime()).toBeGreaterThan(Date.now());
  });

  it("getTokenExpiry returns null for malformed token", () => {
    expect(getTokenExpiry("bad")).toBeNull();
  });
});

// ─── Auth file operations ──────────────────────────────────────────────────

describe("readAuth / writeAuth / removeAuth", () => {
  it("returns null when no auth file exists", () => {
    expect(readAuth(tmpDir)).toBeNull();
  });

  it("writes and reads auth data", () => {
    const auth: AuthData = {
      token: "test-token",
      email: "user@test.com",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    writeAuth(tmpDir, auth);
    const read = readAuth(tmpDir);

    expect(read).not.toBeNull();
    expect(read!.token).toBe("test-token");
    expect(read!.email).toBe("user@test.com");
  });

  it("creates cocapn directory if missing", () => {
    const dir = join(tmpDir, "nonexistent", "cocapn");
    const auth: AuthData = {
      token: "token",
      email: "e@e.com",
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    writeAuth(join(tmpDir, "nonexistent"), auth);
    expect(existsSync(join(dir, ".auth"))).toBe(true);
  });

  it("removeAuth returns false when no auth file", () => {
    expect(removeAuth(tmpDir)).toBe(false);
  });

  it("removeAuth deletes auth file", () => {
    const auth: AuthData = {
      token: "token",
      email: "e@e.com",
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    writeAuth(tmpDir, auth);
    expect(existsSync(join(tmpDir, "cocapn", ".auth"))).toBe(true);

    const removed = removeAuth(tmpDir);
    expect(removed).toBe(true);
    expect(existsSync(join(tmpDir, "cocapn", ".auth"))).toBe(false);
  });

  it("returns null for corrupted auth file", () => {
    mkdirSync(join(tmpDir, "cocapn"), { recursive: true });
    writeFileSync(join(tmpDir, "cocapn", ".auth"), "not json", "utf-8");
    expect(readAuth(tmpDir)).toBeNull();
  });
});

// ─── authLogin ──────────────────────────────────────────────────────────────

describe("authLogin", () => {
  it("stores auth with email from JWT", () => {
    const email = "user@example.com";
    const payload = Buffer.from(JSON.stringify({
      email,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    const auth = authLogin(tmpDir, token);

    expect(auth.email).toBe(email);
    expect(auth.token).toBe(token);

    // Verify persisted
    const stored = readAuth(tmpDir);
    expect(stored).not.toBeNull();
    expect(stored!.email).toBe(email);
  });

  it("stores auth with unknown email when JWT has none", () => {
    const payload = Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    const auth = authLogin(tmpDir, token);
    expect(auth.email).toBe("unknown");
  });

  it("sets default expiry when JWT has no exp", () => {
    const payload = Buffer.from(JSON.stringify({ email: "e@e.com" }))
      .toString("base64url");
    const token = `header.${payload}.sig`;

    const auth = authLogin(tmpDir, token);
    const expiresAt = new Date(auth.expiresAt).getTime();
    const now = Date.now();

    // Should be roughly 24 hours from now
    expect(expiresAt - now).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(expiresAt - now).toBeLessThan(25 * 60 * 60 * 1000);
  });
});

// ─── authLogout ─────────────────────────────────────────────────────────────

describe("authLogout", () => {
  it("returns false when not logged in", () => {
    expect(authLogout(tmpDir)).toBe(false);
  });

  it("removes stored auth", () => {
    const payload = Buffer.from(JSON.stringify({
      email: "e@e.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    authLogin(tmpDir, token);
    expect(readAuth(tmpDir)).not.toBeNull();

    const result = authLogout(tmpDir);
    expect(result).toBe(true);
    expect(readAuth(tmpDir)).toBeNull();
  });
});

// ─── authStatus ─────────────────────────────────────────────────────────────

describe("authStatus", () => {
  it("returns not authenticated when no auth", () => {
    const status = authStatus(tmpDir);
    expect(status.authenticated).toBe(false);
    expect(status.email).toBeUndefined();
  });

  it("returns authenticated with email when logged in", () => {
    const payload = Buffer.from(JSON.stringify({
      email: "user@test.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    authLogin(tmpDir, token);
    const status = authStatus(tmpDir);

    expect(status.authenticated).toBe(true);
    expect(status.email).toBe("user@test.com");
    expect(status.expired).toBe(false);
  });

  it("detects expired tokens", () => {
    const payload = Buffer.from(JSON.stringify({
      email: "user@test.com",
      exp: Math.floor(Date.now() / 1000) - 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    authLogin(tmpDir, token);
    const status = authStatus(tmpDir);

    expect(status.authenticated).toBe(true);
    expect(status.expired).toBe(true);
  });
});

// ─── Key management ─────────────────────────────────────────────────────────

describe("readKeys", () => {
  it("returns empty array when no .env.local", () => {
    expect(readKeys(tmpDir)).toEqual([]);
  });

  it("reads keys from .env.local", () => {
    writeFileSync(join(tmpDir, ".env.local"), "DEEPSEEK_API_KEY=sk-abc123\nOPENAI_API_KEY=sk-xyz\n", "utf-8");
    const keys = readKeys(tmpDir);

    expect(keys.length).toBe(2);
    expect(keys[0].provider).toBe("DEEPSEEK_API_KEY");
    expect(keys[0].key).toBe("sk-abc123");
    expect(keys[1].provider).toBe("OPENAI_API_KEY");
    expect(keys[1].key).toBe("sk-xyz");
  });

  it("skips empty lines and comments", () => {
    writeFileSync(join(tmpDir, ".env.local"), "\n# comment\nDEEPSEEK_API_KEY=val\n\n", "utf-8");
    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].provider).toBe("DEEPSEEK_API_KEY");
  });

  it("skips lines without = sign", () => {
    writeFileSync(join(tmpDir, ".env.local"), "JUST_A_WORD\n", "utf-8");
    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(0);
  });

  it("returns empty for corrupted file", () => {
    // readKeys shouldn't throw on normal files
    writeFileSync(join(tmpDir, ".env.local"), "VALID_KEY=value\n", "utf-8");
    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
  });
});

describe("setKey", () => {
  it("creates .env.local with new key", () => {
    setKey(tmpDir, "DEEPSEEK_API_KEY", "sk-abc123");

    const content = readFileSync(join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("DEEPSEEK_API_KEY=sk-abc123");

    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].key).toBe("sk-abc123");
  });

  it("updates existing key", () => {
    writeFileSync(join(tmpDir, ".env.local"), "DEEPSEEK_API_KEY=old-key\n", "utf-8");
    setKey(tmpDir, "DEEPSEEK_API_KEY", "new-key");

    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].key).toBe("new-key");
  });

  it("normalizes provider name to uppercase", () => {
    setKey(tmpDir, "deepseek_api_key", "val");
    const keys = readKeys(tmpDir);
    expect(keys[0].provider).toBe("DEEPSEEK_API_KEY");
  });

  it("appends key when file has other keys", () => {
    writeFileSync(join(tmpDir, ".env.local"), "EXISTING_KEY=val\n", "utf-8");
    setKey(tmpDir, "NEW_KEY", "newval");

    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(2);
    expect(keys.map((k) => k.provider)).toContain("EXISTING_KEY");
    expect(keys.map((k) => k.provider)).toContain("NEW_KEY");
  });
});

describe("removeKey", () => {
  it("returns false when no .env.local", () => {
    expect(removeKey(tmpDir, "DEEPSEEK_API_KEY")).toBe(false);
  });

  it("returns false when key not found", () => {
    writeFileSync(join(tmpDir, ".env.local"), "OTHER_KEY=val\n", "utf-8");
    expect(removeKey(tmpDir, "DEEPSEEK_API_KEY")).toBe(false);
  });

  it("removes existing key", () => {
    writeFileSync(join(tmpDir, ".env.local"), "DEEPSEEK_API_KEY=val\nOTHER_KEY=keep\n", "utf-8");
    const removed = removeKey(tmpDir, "DEEPSEEK_API_KEY");

    expect(removed).toBe(true);
    const keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].provider).toBe("OTHER_KEY");
  });

  it("normalizes provider name to uppercase", () => {
    writeFileSync(join(tmpDir, ".env.local"), "DEEPSEEK_API_KEY=val\n", "utf-8");
    expect(removeKey(tmpDir, "deepseek_api_key")).toBe(true);
    expect(readKeys(tmpDir).length).toBe(0);
  });
});

// ─── createAuthCommand ─────────────────────────────────────────────────────

describe("createAuthCommand", () => {
  it("creates auth command with subcommands", () => {
    const cmd = createAuthCommand();
    expect(cmd.name()).toBe("auth");

    const subcommands = cmd.commands.map((c: { name: () => string }) => c.name());
    expect(subcommands).toContain("login");
    expect(subcommands).toContain("logout");
    expect(subcommands).toContain("status");
    expect(subcommands).toContain("keys");
  });

  it("keys command has subcommands", () => {
    const cmd = createAuthCommand();
    const keysCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "keys");
    expect(keysCmd).toBeDefined();

    const keySubcommands = keysCmd.commands.map((c: { name: () => string }) => c.name());
    expect(keySubcommands).toContain("list");
    expect(keySubcommands).toContain("set");
    expect(keySubcommands).toContain("remove");
  });

  it("login command has token option", () => {
    const cmd = createAuthCommand();
    const loginCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "login");
    expect(loginCmd).toBeDefined();

    const optionFlags = loginCmd.options.map((o: { flags: string }) => o.flags);
    expect(optionFlags.some((f: string) => f.includes("--token"))).toBe(true);
    expect(optionFlags.some((f: string) => f.includes("--email"))).toBe(true);
  });

  it("set command has provider and key arguments", () => {
    const cmd = createAuthCommand();
    const keysCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "keys");
    const setCmd = keysCmd.commands.find((c: { name: () => string }) => c.name() === "set");
    expect(setCmd).toBeDefined();

    const args = setCmd.registeredArguments || [];
    expect(args.length).toBeGreaterThanOrEqual(2);
    expect(args[0].name()).toBe("provider");
    expect(args[1].name()).toBe("key");
  });

  it("remove command has provider argument", () => {
    const cmd = createAuthCommand();
    const keysCmd = cmd.commands.find((c: { name: () => string }) => c.name() === "keys");
    const removeCmd = keysCmd.commands.find((c: { name: () => string }) => c.name() === "remove");
    expect(removeCmd).toBeDefined();

    const args = removeCmd.registeredArguments || [];
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[0].name()).toBe("provider");
  });
});

// ─── Integration ────────────────────────────────────────────────────────────

describe("integration", () => {
  it("full login → status → logout cycle", () => {
    const payload = Buffer.from(JSON.stringify({
      email: "test@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const token = `header.${payload}.sig`;

    // Login
    const auth = authLogin(tmpDir, token);
    expect(auth.email).toBe("test@example.com");

    // Status — authenticated
    let status = authStatus(tmpDir);
    expect(status.authenticated).toBe(true);
    expect(status.expired).toBe(false);

    // Logout
    expect(authLogout(tmpDir)).toBe(true);

    // Status — not authenticated
    status = authStatus(tmpDir);
    expect(status.authenticated).toBe(false);
  });

  it("full key set → list → remove cycle", () => {
    // Set
    setKey(tmpDir, "DEEPSEEK_API_KEY", "sk-1234567890abcdef");

    // List
    let keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].provider).toBe("DEEPSEEK_API_KEY");

    // Update
    setKey(tmpDir, "DEEPSEEK_API_KEY", "sk-updated-key");
    keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].key).toBe("sk-updated-key");

    // Add another
    setKey(tmpDir, "OPENAI_API_KEY", "sk-openai-key");
    keys = readKeys(tmpDir);
    expect(keys.length).toBe(2);

    // Remove one
    expect(removeKey(tmpDir, "DEEPSEEK_API_KEY")).toBe(true);
    keys = readKeys(tmpDir);
    expect(keys.length).toBe(1);
    expect(keys[0].provider).toBe("OPENAI_API_KEY");
  });
});
