/**
 * Deploy command tests — cloudflare, docker, status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import {
  createDeployCommand,
  extractUrl,
  loadEnvVar,
} from "../src/commands/deploy.js";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// --- Unit tests: extractUrl ---

describe("extractUrl", () => {
  it("extracts URL from wrangler output", () => {
    const output = `Published my-worker (https://my-worker.account.workers.dev)`;
    expect(extractUrl(output)).toBe("https://my-worker.account.workers.dev");
  });

  it("extracts URL from plain output", () => {
    const output = `Deployed to https://app.example.com successfully`;
    expect(extractUrl(output)).toBe("https://app.example.com");
  });

  it("returns null when no URL found", () => {
    expect(extractUrl("no urls here")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractUrl("")).toBeNull();
  });
});

// --- Unit tests: loadEnvVar ---

describe("loadEnvVar", () => {
  const testDir = join(process.cwd(), "test-temp-deploy-env");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("returns undefined when no .env files exist", () => {
    expect(loadEnvVar(testDir, "API_KEY")).toBeUndefined();
  });

  it("loads value from .env.local", () => {
    const envPath = join(testDir, ".env.local");
    writeFileSync(envPath, `CLOUDFLARE_API_TOKEN=cf_token_123\n`);
    expect(loadEnvVar(testDir, "CLOUDFLARE_API_TOKEN")).toBe("cf_token_123");
  });

  it("loads quoted value from .env", () => {
    const envPath = join(testDir, ".env");
    writeFileSync(envPath, `MY_KEY="quoted_value"\n`);
    expect(loadEnvVar(testDir, "MY_KEY")).toBe("quoted_value");
  });

  it("prefers .env.local over .env", () => {
    writeFileSync(join(testDir, ".env"), `KEY=from_dotenv\n`);
    writeFileSync(join(testDir, ".env.local"), `KEY=from_dotenv_local\n`);
    expect(loadEnvVar(testDir, "KEY")).toBe("from_dotenv_local");
  });
});

// --- Command structure tests ---

describe("Deploy Command Structure", () => {
  let program: Command;

  beforeEach(() => {
    program = createDeployCommand();
  });

  it("registers deploy as a command group", () => {
    expect(program.name()).toBe("deploy");
  });

  it("has cloudflare subcommand", () => {
    const cf = program.commands.find((c) => c.name() === "cloudflare");
    expect(cf).toBeDefined();
    expect(cf!.description()).toContain("Cloudflare Workers");
  });

  it("cloudflare subcommand has --env option", () => {
    const cf = program.commands.find((c) => c.name() === "cloudflare");
    expect(cf!.options.some((o) => o.long === "--env")).toBe(true);
  });

  it("cloudflare subcommand has --region option", () => {
    const cf = program.commands.find((c) => c.name() === "cloudflare");
    expect(cf!.options.some((o) => o.long === "--region")).toBe(true);
  });

  it("cloudflare subcommand has --dry-run option", () => {
    const cf = program.commands.find((c) => c.name() === "cloudflare");
    expect(cf!.options.some((o) => o.long === "--dry-run")).toBe(true);
  });

  it("cloudflare subcommand has --no-tests option", () => {
    const cf = program.commands.find((c) => c.name() === "cloudflare");
    expect(cf!.options.some((o) => o.long === "--no-tests")).toBe(true);
  });

  it("has docker subcommand", () => {
    const docker = program.commands.find((c) => c.name() === "docker");
    expect(docker).toBeDefined();
    expect(docker!.description()).toContain("Docker");
  });

  it("docker subcommand has --tag option", () => {
    const docker = program.commands.find((c) => c.name() === "docker");
    expect(docker!.options.some((o) => o.long === "--tag")).toBe(true);
  });

  it("docker subcommand has --port option", () => {
    const docker = program.commands.find((c) => c.name() === "docker");
    expect(docker!.options.some((o) => o.long === "--port")).toBe(true);
  });

  it("docker subcommand has --brain option", () => {
    const docker = program.commands.find((c) => c.name() === "docker");
    expect(docker!.options.some((o) => o.long === "--brain")).toBe(true);
  });

  it("has status subcommand", () => {
    const status = program.commands.find((c) => c.name() === "status");
    expect(status).toBeDefined();
  });
});

// --- Cloudflare deploy prerequisite tests ---

describe("Cloudflare Deploy Prerequisites", () => {
  const testDir = join(process.cwd(), "test-temp-cf-deploy");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("fails when wrangler.toml is missing", async () => {
    // No wrangler.toml in testDir
    const origCwd = process.cwd;
    vi.spyOn(process, "cwd").mockReturnValue(testDir);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = createDeployCommand();
    await program.parseAsync(["node", "test", "cloudflare"]);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing wrangler.toml")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    (process.cwd as any).mockRestore();
  });

  it("fails when API token is missing", async () => {
    // Create wrangler.toml but no API token
    writeFileSync(join(testDir, "wrangler.toml"), 'name = "test"\n');

    const origCwd = process.cwd;
    vi.spyOn(process, "cwd").mockReturnValue(testDir);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    // Ensure no env token
    const origToken = process.env.CLOUDFLARE_API_TOKEN;
    const origCfToken = process.env.CF_API_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CF_API_TOKEN;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = createDeployCommand();
    await program.parseAsync(["node", "test", "cloudflare"]);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing CLOUDFLARE_API_TOKEN")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    (process.cwd as any).mockRestore();
    if (origToken !== undefined) process.env.CLOUDFLARE_API_TOKEN = origToken;
    if (origCfToken !== undefined) process.env.CF_API_TOKEN = origCfToken;
  });
});

// --- Docker deploy prerequisite tests ---

describe("Docker Deploy Prerequisites", () => {
  const testDir = join(process.cwd(), "test-temp-docker-deploy");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("fails when Dockerfile is missing", async () => {
    const origCwd = process.cwd;
    vi.spyOn(process, "cwd").mockReturnValue(testDir);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = createDeployCommand();
    await program.parseAsync(["node", "test", "docker"]);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing Dockerfile")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    (process.cwd as any).mockRestore();
  });
});

// --- Status check tests ---

describe("Deploy Status", () => {
  const testDir = join(process.cwd(), "test-temp-status");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("runs status without crashing when no wrangler.toml", async () => {
    const origCwd = process.cwd;
    vi.spyOn(process, "cwd").mockReturnValue(testDir);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = createDeployCommand();
    // execSync will be called for docker/bridge checks and may fail
    // but the status command should handle errors gracefully
    try {
      await program.parseAsync(["node", "test", "status"]);
    } catch {
      // process.exit from exec failures is ok in this sandbox
    }

    // Should not have logged errors for missing wrangler.toml (it's handled gracefully)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("wrangler.toml")
    );

    consoleSpy.mockRestore();
    logSpy.mockRestore();
    (process.cwd as any).mockRestore();
  });
});
