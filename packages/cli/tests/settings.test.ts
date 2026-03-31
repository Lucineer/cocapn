import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  resolveConfigPath,
  readConfig,
  writeConfig,
  backupConfig,
  getNestedValue,
  setNestedValue,
  showAllSettings,
  getSetting,
  setSetting,
  resetSetting,
} from "../src/commands/settings.js";

const TMP = join(import.meta.dirname, "__test_settings_tmp__");
const COCAPN = join(TMP, "cocapn");
const CONFIG_PATH = join(COCAPN, "config.yml");

const SAMPLE_CONFIG = `soul: cocapn/soul.md
config:
  mode: local
  port: 8787
sync:
  interval: 300
  memoryInterval: 60
  autoCommit: true
  autoPush: false
memory:
  facts: cocapn/memory/facts.json
  procedures: cocapn/memory/procedures.json
  relationships: cocapn/memory/relationships.json
`;

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(COCAPN, { recursive: true });
  writeFileSync(CONFIG_PATH, SAMPLE_CONFIG, "utf-8");
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

// ─── Unit tests: resolveConfigPath ──────────────────────────────────────────

describe("resolveConfigPath", () => {
  it("finds cocapn/config.yml", () => {
    expect(resolveConfigPath(TMP)).toBe(CONFIG_PATH);
  });

  it("returns null when no config exists", () => {
    rmSync(COCAPN, { recursive: true });
    expect(resolveConfigPath(TMP)).toBeNull();
  });

  it("falls back to root config.yml", () => {
    rmSync(COCAPN, { recursive: true });
    const rootConfig = join(TMP, "config.yml");
    writeFileSync(rootConfig, "soul: test.md\n", "utf-8");
    expect(resolveConfigPath(TMP)).toBe(rootConfig);
  });
});

// ─── Unit tests: readConfig / writeConfig ───────────────────────────────────

describe("readConfig", () => {
  it("parses YAML config", () => {
    const cfg = readConfig(CONFIG_PATH) as Record<string, unknown>;
    expect(cfg.soul).toBe("cocapn/soul.md");
    expect(cfg.config).toEqual({ mode: "local", port: 8787 });
  });
});

describe("writeConfig", () => {
  it("round-trips config through YAML", () => {
    const cfg = readConfig(CONFIG_PATH);
    writeConfig(CONFIG_PATH, cfg);
    const cfg2 = readConfig(CONFIG_PATH) as Record<string, unknown>;
    expect(cfg2.soul).toBe("cocapn/soul.md");
  });
});

// ─── Unit tests: getNestedValue ─────────────────────────────────────────────

describe("getNestedValue", () => {
  const obj = { config: { port: 8787, mode: "local" }, soul: "soul.md" };

  it("gets top-level value", () => {
    expect(getNestedValue(obj, "soul")).toBe("soul.md");
  });

  it("gets nested value", () => {
    expect(getNestedValue(obj, "config.port")).toBe(8787);
  });

  it("returns undefined for missing key", () => {
    expect(getNestedValue(obj, "config.tunnel")).toBeUndefined();
  });

  it("returns undefined for non-object path", () => {
    expect(getNestedValue(obj, "soul.foo")).toBeUndefined();
  });
});

// ─── Unit tests: setNestedValue ─────────────────────────────────────────────

describe("setNestedValue", () => {
  it("sets top-level value", () => {
    const obj = { soul: "old.md" };
    const result = setNestedValue(obj, "soul", "new.md") as Record<string, unknown>;
    expect(result.soul).toBe("new.md");
  });

  it("sets nested value", () => {
    const obj = { config: { port: 8787 } };
    const result = setNestedValue(obj, "config.port", 9999) as Record<string, unknown>;
    const config = result.config as Record<string, unknown>;
    expect(config.port).toBe(9999);
  });

  it("creates intermediate objects", () => {
    const obj = {};
    const result = setNestedValue(obj, "fleet.agentId", "abc") as Record<string, unknown>;
    const fleet = result.fleet as Record<string, unknown>;
    expect(fleet.agentId).toBe("abc");
  });

  it("sets boolean value", () => {
    const obj = { sync: { autoPush: false } };
    const result = setNestedValue(obj, "sync.autoPush", true) as Record<string, unknown>;
    const sync = result.sync as Record<string, unknown>;
    expect(sync.autoPush).toBe(true);
  });

  it("sets numeric value", () => {
    const obj = { config: { port: 8787 } };
    const result = setNestedValue(obj, "config.port", 3000) as Record<string, unknown>;
    const config = result.config as Record<string, unknown>;
    expect(config.port).toBe(3000);
  });
});

// ─── Unit tests: backupConfig ───────────────────────────────────────────────

describe("backupConfig", () => {
  it("creates .bak file", () => {
    const bakPath = backupConfig(CONFIG_PATH);
    expect(bakPath).toBe(CONFIG_PATH + ".bak");
    expect(existsSync(bakPath)).toBe(true);
    expect(readFileSync(bakPath, "utf-8")).toBe(SAMPLE_CONFIG);
  });
});

// ─── Integration: setSetting ────────────────────────────────────────────────

describe("setSetting", () => {
  it("sets a valid setting", () => {
    setSetting(TMP, "config.port", "3000");
    const cfg = readConfig(CONFIG_PATH) as Record<string, unknown>;
    const config = cfg.config as Record<string, unknown>;
    expect(config.port).toBe(3000);
  });

  it("rejects unknown setting", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      setSetting(TMP, "unknown.key", "val");
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });

  it("rejects wrong type for port", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      setSetting(TMP, "config.port", "not-a-number");
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });

  it("rejects invalid port range", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      setSetting(TMP, "config.port", "99999");
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });

  it("rejects invalid mode", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      setSetting(TMP, "config.mode", "invalid");
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });

  it("sets boolean setting", () => {
    setSetting(TMP, "sync.autoPush", "true");
    const cfg = readConfig(CONFIG_PATH) as Record<string, unknown>;
    const sync = cfg.sync as Record<string, unknown>;
    expect(sync.autoPush).toBe(true);
  });

  it("auto-creates config if missing", () => {
    rmSync(COCAPN, { recursive: true });
    mkdirSync(COCAPN, { recursive: true });
    setSetting(TMP, "config.port", "9090");
    const cfg = readConfig(CONFIG_PATH) as Record<string, unknown>;
    const config = cfg.config as Record<string, unknown>;
    expect(config.port).toBe(9090);
  });
});

// ─── Integration: getSetting ────────────────────────────────────────────────

describe("getSetting", () => {
  it("gets existing setting", () => {
    // Should not throw
    getSetting(TMP, "config.port");
  });

  it("handles unknown key gracefully", () => {
    getSetting(TMP, "nonexistent.key");
  });
});

// ─── Integration: resetSetting ──────────────────────────────────────────────

describe("resetSetting", () => {
  it("resets a specific key to default", () => {
    // First set it to something else
    setSetting(TMP, "config.port", "3000");

    // Reset it
    resetSetting(TMP, "config.port");

    const cfg = readConfig(CONFIG_PATH) as Record<string, unknown>;
    const config = cfg.config as Record<string, unknown>;
    expect(config.port).toBe(8787);
  });

  it("resets all settings with COCAPN_YES", () => {
    process.env.COCAPN_YES = "1";
    resetSetting(TMP);
    delete process.env.COCAPN_YES;

    // Config file should still exist (may be empty or minimal)
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });

  it("requires confirmation for full reset", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      resetSetting(TMP);
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });

  it("rejects unknown key", () => {
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      resetSetting(TMP, "unknown.key");
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });
});

// ─── Integration: showAllSettings ───────────────────────────────────────────

describe("showAllSettings", () => {
  it("displays all settings without error", () => {
    const origLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    showAllSettings(TMP);

    console.log = origLog;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("Brain"))).toBe(true);
    expect(logs.some((l) => l.includes("LLM"))).toBe(true);
    expect(logs.some((l) => l.includes("Bridge"))).toBe(true);
  });

  it("shows error when no config", () => {
    rmSync(COCAPN, { recursive: true });
    const origExit = process.exit;
    const exitCalls: number[] = [];
    process.exit = ((code: number) => { exitCalls.push(code); throw new Error("exit"); }) as never;
    try {
      showAllSettings(TMP);
    } catch { /* expected */ }
    process.exit = origExit;
    expect(exitCalls).toContain(1);
  });
});
