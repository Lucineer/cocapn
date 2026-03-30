/**
 * Tests for cocapn remote command — list, add, remove, deploy, status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  isValidUrl,
  healthCheck,
  readRemotes,
  writeRemotes,
  remoteList,
  remoteAdd,
  remoteRemove,
  remoteDeploy,
  remoteStatus,
  createRemoteCommand,
  type RemoteInstance,
  type RemoteHealth,
} from "../src/commands/remote.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const testDir = join(process.cwd(), ".test-remote-tmp");

function setupRemoteDir(): void {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
  mkdirSync(join(testDir, "cocapn"), { recursive: true });
}

function cleanupRemoteDir(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function getRemotesPath(): string {
  return join(testDir, "cocapn", "remotes.json");
}

// ─── isValidUrl ─────────────────────────────────────────────────────────────

describe("isValidUrl", () => {
  it("accepts https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("accepts http URLs", () => {
    expect(isValidUrl("http://localhost:3100")).toBe(true);
  });

  it("rejects non-HTTP protocols", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("ssh://git@github.com")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("://missing-scheme")).toBe(false);
  });

  it("rejects URLs without scheme", () => {
    expect(isValidUrl("example.com")).toBe(false);
    expect(isValidUrl("localhost:3100")).toBe(false);
  });
});

// ─── healthCheck ────────────────────────────────────────────────────────────

describe("healthCheck", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns health data on success", async () => {
    const mockHealth: RemoteHealth = {
      status: "ok",
      version: "0.1.0",
      mode: "private",
      brain: { facts: 10, wiki: 3, memories: 5, procedures: 2 },
      uptime: 3600,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealth),
    });

    const result = await healthCheck("https://example.com");
    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.1.0");
    expect(result.mode).toBe("private");
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    await expect(healthCheck("https://example.com")).rejects.toThrow("Health check failed: 503");
  });

  it("throws on connection error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(healthCheck("https://example.com")).rejects.toThrow("ECONNREFUSED");
  });

  it("calls /api/health endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok", version: "0.1.0", mode: "public", brain: { facts: 0, wiki: 0, memories: 0, procedures: 0 }, uptime: 0 }),
    });

    await healthCheck("https://my-agent.example.com");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://my-agent.example.com/api/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

// ─── readRemotes / writeRemotes ─────────────────────────────────────────────

describe("readRemotes / writeRemotes", () => {
  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    vi.restoreAllMocks();
  });

  it("returns empty array when no remotes.json exists", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);
    const result = readRemotes();
    expect(result).toEqual([]);
  });

  it("reads and writes remotes", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const remotes: RemoteInstance[] = [
      { name: "production", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z" },
      { name: "staging", url: "https://staging.example.com", addedAt: "2026-01-02T00:00:00Z" },
    ];

    writeRemotes(remotes);
    const result = readRemotes();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("production");
    expect(result[1].name).toBe("staging");
  });

  it("creates cocapn dir if missing", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);
    rmSync(join(testDir, "cocapn"), { recursive: true, force: true });

    writeRemotes([{ name: "test", url: "https://test.com", addedAt: "2026-01-01T00:00:00Z" }]);

    expect(existsSync(getRemotesPath())).toBe(true);
  });

  it("returns empty array for malformed JSON", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeFileSync(getRemotesPath(), "not json", "utf-8");

    const result = readRemotes();
    expect(result).toEqual([]);
  });
});

// ─── remoteList ─────────────────────────────────────────────────────────────

describe("remoteList", () => {
  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    vi.restoreAllMocks();
  });

  it("shows message when no remotes configured", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    remoteList(false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No remote instances"));
  });

  it("lists remotes in table format", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeRemotes([
      { name: "prod", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z", status: "ok", version: "0.1.0" },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    remoteList(false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("prod"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("https://prod.example.com"));
  });

  it("outputs JSON with --json flag", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const remotes: RemoteInstance[] = [
      { name: "staging", url: "https://staging.example.com", addedAt: "2026-01-01T00:00:00Z", status: "ok", version: "0.2.0" },
    ];
    writeRemotes(remotes);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    remoteList(true);

    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("staging");
  });
});

// ─── remoteAdd ──────────────────────────────────────────────────────────────

describe("remoteAdd", () => {
  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;
    vi.restoreAllMocks();
  });

  it("adds remote and stores in remotes.json", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const mockHealth: RemoteHealth = {
      status: "ok", version: "0.1.0", mode: "private",
      brain: { facts: 10, wiki: 3, memories: 5, procedures: 2 }, uptime: 3600,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve(mockHealth),
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await remoteAdd("production", "https://prod.example.com");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("production"));

    const remotes = readRemotes();
    expect(remotes).toHaveLength(1);
    expect(remotes[0].name).toBe("production");
    expect(remotes[0].url).toBe("https://prod.example.com");
    expect(remotes[0].version).toBe("0.1.0");
    expect(remotes[0].status).toBe("ok");
  });

  it("rejects invalid URL", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteAdd("bad", "not-a-url");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid URL"));
    }
  });

  it("rejects duplicate remote name", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeRemotes([{ name: "production", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z" }]);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteAdd("production", "https://other.example.com");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    }
  });

  it("adds remote even when health check fails", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await remoteAdd("offline-remote", "https://offline.example.com");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Warning"));

    const remotes = readRemotes();
    expect(remotes).toHaveLength(1);
    expect(remotes[0].name).toBe("offline-remote");
    expect(remotes[0].status).toBe("unknown");
  });

  it("rejects ftp:// URLs", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteAdd("bad", "ftp://example.com");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid URL"));
    }
  });
});

// ─── remoteRemove ───────────────────────────────────────────────────────────

describe("remoteRemove", () => {
  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    vi.restoreAllMocks();
  });

  it("removes existing remote", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeRemotes([
      { name: "prod", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z" },
      { name: "staging", url: "https://staging.example.com", addedAt: "2026-01-02T00:00:00Z" },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    remoteRemove("prod");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("prod"));

    const remotes = readRemotes();
    expect(remotes).toHaveLength(1);
    expect(remotes[0].name).toBe("staging");
  });

  it("errors when remote not found", () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      remoteRemove("nonexistent");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    }
  });
});

// ─── remoteDeploy ───────────────────────────────────────────────────────────

describe("remoteDeploy", () => {
  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    vi.restoreAllMocks();
  });

  it("detects Cloudflare Workers platform", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeRemotes([
      { name: "workers", url: "https://my-agent.workers.dev", addedAt: "2026-01-01T00:00:00Z" },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await remoteDeploy("workers");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cloudflare Workers"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("wrangler deploy"));
  });

  it("detects Docker platform", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    writeRemotes([
      { name: "docker-host", url: "https://my-server.example.com", addedAt: "2026-01-01T00:00:00Z" },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await remoteDeploy("docker-host");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Docker"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("docker compose"));
  });

  it("errors when remote not found", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteDeploy("nonexistent");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    }
  });
});

// ─── remoteStatus ───────────────────────────────────────────────────────────

describe("remoteStatus", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => setupRemoteDir());
  afterEach(() => {
    cleanupRemoteDir();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows health info from remote", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const mockHealth: RemoteHealth = {
      status: "ok", version: "0.2.0", mode: "public",
      brain: { facts: 42, wiki: 10, memories: 5, procedures: 3 }, uptime: 7200,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve(mockHealth),
    });

    writeRemotes([{ name: "prod", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z" }]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await remoteStatus("prod");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("prod"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("ok"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("0.2.0"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("public"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("42"));
  });

  it("updates cached status in remotes.json", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const mockHealth: RemoteHealth = {
      status: "degraded", version: "0.3.0", mode: "private",
      brain: { facts: 1, wiki: 0, memories: 0, procedures: 0 }, uptime: 100,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve(mockHealth),
    });

    writeRemotes([{ name: "prod", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z", status: "ok", version: "0.1.0" }]);

    await remoteStatus("prod");

    const remotes = readRemotes();
    expect(remotes[0].status).toBe("degraded");
    expect(remotes[0].version).toBe("0.3.0");
    expect(remotes[0].lastSeen).toBeDefined();
  });

  it("errors when remote not found", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteStatus("nonexistent");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    }
  });

  it("shows unreachable when health check fails", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    writeRemotes([{ name: "prod", url: "https://prod.example.com", addedAt: "2026-01-01T00:00:00Z" }]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT");
    });

    try {
      await remoteStatus("prod");
      expect.fail("Should have exited");
    } catch (e) {
      expect((e as Error).message).toBe("EXIT");
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("unreachable"));
    }
  });
});

// ─── createRemoteCommand ────────────────────────────────────────────────────

describe("createRemoteCommand", () => {
  it("creates a command with 'remote' name", () => {
    const cmd = createRemoteCommand();
    expect(cmd.name()).toBe("remote");
  });

  it("has all subcommands", () => {
    const cmd = createRemoteCommand();
    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain("list");
    expect(subcommands).toContain("add");
    expect(subcommands).toContain("remove");
    expect(subcommands).toContain("deploy");
    expect(subcommands).toContain("status");
  });
});
