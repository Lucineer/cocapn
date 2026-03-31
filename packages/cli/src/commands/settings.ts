/**
 * cocapn settings — Comprehensive agent settings management.
 *
 * Reads/writes cocapn/config.yml with grouped display,
 * type validation, auto-backup, and $EDITOR support.
 */

import { Command } from "commander";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── ANSI colors ────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const green = (s: string) => `${c.green}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const red = (s: string) => `${c.red}${s}${c.reset}`;
const gray = (s: string) => `${c.gray}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

// ─── YAML helpers (reused from config.ts patterns) ──────────────────────────

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

function parseYaml(text: string): YamlValue {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return parseBlock(lines, 0, -1).value;
}

function parseBlock(lines: string[], startLine: number, parentIndent: number): { value: YamlValue; endLine: number } {
  if (startLine >= lines.length) return { value: null, endLine: lines.length };

  let firstContent = startLine;
  while (firstContent < lines.length && (lines[firstContent].trim() === "" || lines[firstContent].trim().startsWith("#"))) {
    firstContent++;
  }
  if (firstContent >= lines.length) return { value: null, endLine: lines.length };

  const baseIndent = getIndent(lines[firstContent]);
  const firstTrimmed = lines[firstContent].trim();

  if (firstTrimmed.startsWith("- ")) return parseList(lines, firstContent, baseIndent);
  if (firstTrimmed.includes(":") && !firstTrimmed.startsWith('"') && !firstTrimmed.startsWith("'")) {
    return parseMapping(lines, firstContent, baseIndent);
  }
  return { value: parseScalar(firstTrimmed), endLine: firstContent + 1 };
}

function parseMapping(lines: string[], startLine: number, baseIndent: number): { value: { [key: string]: YamlValue }; endLine: number } {
  const result: { [key: string]: YamlValue } = {};
  let i = startLine;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) { i++; continue; }
    if (getIndent(lines[i]) !== baseIndent) break;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) break;

    const key = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();

    if (afterColon === "" || afterColon.startsWith("#")) {
      const nextNonEmpty = findNextNonEmpty(lines, i + 1);
      if (nextNonEmpty < lines.length && getIndent(lines[nextNonEmpty]) > baseIndent) {
        const nested = parseBlock(lines, nextNonEmpty, baseIndent);
        result[key] = nested.value;
        i = nested.endLine;
      } else {
        result[key] = null;
        i++;
      }
    } else {
      result[key] = parseScalar(afterColon);
      i++;
    }
  }

  return { value: result, endLine: i };
}

function parseList(lines: string[], startLine: number, baseIndent: number): { value: YamlValue[]; endLine: number } {
  const result: YamlValue[] = [];
  let i = startLine;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) { i++; continue; }
    if (getIndent(lines[i]) !== baseIndent) break;
    if (!trimmed.startsWith("- ")) break;

    const afterDash = trimmed.slice(2).trim();
    if (afterDash === "") {
      const nextNonEmpty = findNextNonEmpty(lines, i + 1);
      if (nextNonEmpty < lines.length && getIndent(lines[nextNonEmpty]) > baseIndent) {
        const nested = parseBlock(lines, nextNonEmpty, baseIndent);
        result.push(nested.value);
        i = nested.endLine;
      } else {
        result.push(null);
        i++;
      }
    } else {
      result.push(parseScalar(afterDash));
      i++;
    }
  }

  return { value: result, endLine: i };
}

function parseScalar(raw: string): YamlValue {
  if (raw.startsWith("#")) return null;
  const commentIdx = raw.indexOf(" #");
  if (commentIdx !== -1) raw = raw.slice(0, commentIdx).trim();

  if (raw === "null" || raw === "~" || raw === "") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;

  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  const num = Number(raw);
  if (!isNaN(num) && raw !== "") return num;

  return raw;
}

function getIndent(line: string): number {
  const match = line.match(/^( *)/);
  return match ? match[1].length : 0;
}

function findNextNonEmpty(lines: string[], from: number): number {
  let i = from;
  while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
  return i;
}

// ─── YAML serializer ────────────────────────────────────────────────────────

function serializeYaml(data: YamlValue, indent: number = 0): string {
  const pad = "  ".repeat(indent);
  if (data === null || data === undefined) return "null";
  if (typeof data === "boolean" || typeof data === "number") return String(data);
  if (typeof data === "string") {
    if (data === "") return '""';
    if (data.includes("\n") || data.includes(":") || data.includes("#") || data.startsWith(" ")) {
      return `"${data.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return data;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data.map((item) => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const inner = serializeYaml(item, indent + 1);
        return `${pad}- ${inner.trimStart()}`;
      }
      return `${pad}- ${serializeYaml(item, 0)}`;
    }).join("\n");
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, YamlValue>);
    if (entries.length === 0) return "{}";
    return entries.map(([key, val]) => {
      if (typeof val === "object" && val !== null) {
        return `${pad}${key}:\n${serializeYaml(val, indent + 1)}`;
      }
      if (val === null) return `${pad}${key}:`;
      return `${pad}${key}: ${serializeYaml(val, 0)}`;
    }).join("\n");
  }
  return String(data);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function resolveConfigPath(repoRoot: string): string | null {
  const cocapnConfig = join(repoRoot, "cocapn", "config.yml");
  if (existsSync(cocapnConfig)) return cocapnConfig;
  const rootConfig = join(repoRoot, "config.yml");
  if (existsSync(rootConfig)) return rootConfig;
  return null;
}

export function readConfig(configPath: string): YamlValue {
  const raw = readFileSync(configPath, "utf-8");
  return parseYaml(raw);
}

export function writeConfig(configPath: string, data: YamlValue): void {
  const dir = configPath.substring(0, configPath.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, serializeYaml(data) + "\n", "utf-8");
}

export function backupConfig(configPath: string): string {
  const backupPath = configPath + ".bak";
  copyFileSync(configPath, backupPath);
  return backupPath;
}

export function getNestedValue(obj: YamlValue, keyPath: string): YamlValue | undefined {
  const parts = keyPath.split(".");
  let current: YamlValue = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, YamlValue>)[part];
    if (current === undefined) return undefined;
  }
  return current;
}

export function setNestedValue(obj: YamlValue, keyPath: string, value: YamlValue): YamlValue {
  const parts = keyPath.split(".");
  const result = typeof obj === "object" && obj !== null && !Array.isArray(obj) ? { ...obj } : {};
  let current: Record<string, YamlValue> = result as Record<string, YamlValue>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (next !== undefined && typeof next === "object" && !Array.isArray(next)) {
      current[part] = { ...next };
      current = current[part] as Record<string, YamlValue>;
    } else {
      current[part] = {};
      current = current[part] as Record<string, YamlValue>;
    }
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

function deleteNestedKey(obj: YamlValue, keyPath: string): YamlValue {
  const parts = keyPath.split(".");
  if (parts.length === 1) {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const result = { ...(obj as Record<string, YamlValue>) };
      delete result[parts[0]];
      return result;
    }
    return obj;
  }

  const result = typeof obj === "object" && obj !== null && !Array.isArray(obj) ? { ...(obj as Record<string, YamlValue>) } : {};
  let current: Record<string, YamlValue> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (next !== undefined && typeof next === "object" && !Array.isArray(next)) {
      current[part] = { ...next };
    } else {
      return obj; // path doesn't exist, nothing to delete
    }
    current = current[part] as Record<string, YamlValue>;
  }

  delete current[parts[parts.length - 1]];
  return result;
}

function parseValue(rawValue: string): YamlValue {
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  if (rawValue === "null") return null;
  if (!isNaN(Number(rawValue)) && rawValue !== "") return Number(rawValue);
  if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
    try { return JSON.parse(rawValue) as YamlValue; }
    catch { return rawValue; }
  }
  return rawValue;
}

// ─── Settings schema: keys organized by category ────────────────────────────

interface SettingMeta {
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  default: YamlValue;
  secret?: boolean;
}

const SETTINGS_CATEGORIES: Record<string, Record<string, SettingMeta>> = {
  brain: {
    "soul": { description: "Path to soul.md personality file", type: "string", default: "cocapn/soul.md" },
    "memory.facts": { description: "Path to facts store", type: "string", default: "cocapn/memory/facts.json" },
    "memory.procedures": { description: "Path to procedures store", type: "string", default: "cocapn/memory/procedures.json" },
    "memory.relationships": { description: "Path to relationships store", type: "string", default: "cocapn/memory/relationships.json" },
    "sync.interval": { description: "Seconds between Git syncs", type: "number", default: 300 },
    "sync.memoryInterval": { description: "Seconds between memory syncs", type: "number", default: 60 },
    "sync.autoCommit": { description: "Auto-commit changes to Git", type: "boolean", default: true },
    "sync.autoPush": { description: "Auto-push commits to remote", type: "boolean", default: false },
  },
  llm: {
    "llm.defaultModel": { description: "Default LLM model", type: "string", default: null },
    "llm.timeout": { description: "Request timeout (ms)", type: "number", default: null },
    "llm.providers.deepseek.apiKey": { description: "DeepSeek API key", type: "string", default: "", secret: true },
    "llm.providers.openai.apiKey": { description: "OpenAI API key", type: "string", default: "", secret: true },
    "llm.providers.anthropic.apiKey": { description: "Anthropic API key", type: "string", default: "", secret: true },
  },
  bridge: {
    "config.mode": { description: "Bridge mode (local, hybrid, cloud)", type: "string", default: "local" },
    "config.port": { description: "WebSocket port", type: "number", default: 8787 },
    "config.tunnel": { description: "Cloudflare tunnel URL", type: "string", default: null },
  },
  publishing: {
    "encryption.publicKey": { description: "Age encryption public key", type: "string", default: "", secret: true },
    "encryption.encryptedPaths": { description: "Paths to encrypt", type: "array", default: ["secrets/"] },
  },
  fleet: {
    "fleet.enabled": { description: "Enable fleet coordination", type: "boolean", default: false },
    "fleet.agentId": { description: "Agent ID in fleet", type: "string", default: null },
  },
  mode: {
    "config.mode": { description: "Default agent mode", type: "string", default: "local" },
  },
};

/** Flatten all settings metadata into one map keyed by dot-notation path */
function allSettings(): Map<string, SettingMeta> {
  const map = new Map<string, SettingMeta>();
  for (const group of Object.values(SETTINGS_CATEGORIES)) {
    for (const [key, meta] of Object.entries(group)) {
      map.set(key, meta);
    }
  }
  return map;
}

/** Validate a value against a setting's expected type */
function validateType(key: string, value: YamlValue, meta: SettingMeta): string | null {
  if (value === null) return null; // null is always ok (means "not set")

  switch (meta.type) {
    case "string": return typeof value === "string" ? null : `Expected string for ${key}, got ${typeof value}`;
    case "number": return typeof value === "number" ? null : `Expected number for ${key}, got ${typeof value}`;
    case "boolean": return typeof value === "boolean" ? null : `Expected boolean for ${key}, got ${typeof value}`;
    case "object": return typeof value === "object" && !Array.isArray(value) ? null : `Expected object for ${key}`;
    case "array": return Array.isArray(value) ? null : `Expected array for ${key}, got ${typeof value}`;
    default: return null;
  }
}

/** Extra semantic validation for specific keys */
function validateSemantic(key: string, value: YamlValue): string | null {
  if (value === null || value === undefined) return null;

  if (key === "config.port") {
    if (typeof value !== "number" || value < 1 || value > 65535) return "Port must be 1-65535";
  }
  if (key === "config.mode") {
    if (!["local", "hybrid", "cloud"].includes(String(value))) return "Mode must be: local, hybrid, or cloud";
  }
  if (key === "sync.interval" || key === "sync.memoryInterval") {
    if (typeof value === "number" && value < 0) return "Interval must be >= 0";
  }
  return null;
}

function maskValue(value: YamlValue, secret?: boolean): string {
  if (secret && typeof value === "string" && value.length > 0) return "********";
  if (value === null) return dim("null");
  if (typeof value === "boolean") return value ? green(String(value)) : red(String(value));
  if (typeof value === "number") return cyan(String(value));
  if (typeof value === "string") return dim(`"${value}"`);
  return JSON.stringify(value);
}

// ─── Subcommand actions ─────────────────────────────────────────────────────

export function showAllSettings(repoRoot: string): void {
  const configPath = resolveConfigPath(repoRoot);
  if (!configPath) {
    console.log(yellow("No config.yml found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const data = readConfig(configPath);
  console.log(bold(`\nSettings: ${configPath}\n`));

  for (const [category, settings] of Object.entries(SETTINGS_CATEGORIES)) {
    console.log(bold(`  ${category.charAt(0).toUpperCase() + category.slice(1)}`));
    console.log(gray("  " + "─".repeat(40)));

    for (const [key, meta] of Object.entries(settings)) {
      const current = getNestedValue(data, key);
      const display = maskValue(current, meta.secret);
      const defaultVal = meta.default !== null ? String(meta.default) : dim("unset");
      const isDefault = current === meta.default || (current === undefined && meta.default === null);
      const marker = isDefault ? gray("(default)") : yellow("(modified)");

      console.log(`    ${bold(key)} ${gray("—")} ${gray(meta.description)}`);
      console.log(`      ${display} ${marker}`);
    }
    console.log();
  }
}

export function getSetting(repoRoot: string, keyPath: string): void {
  const settings = allSettings();
  const configPath = resolveConfigPath(repoRoot);
  if (!configPath) {
    console.log(yellow("No config.yml found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const data = readConfig(configPath);
  const value = getNestedValue(data, keyPath);

  if (value === undefined) {
    // Check if it's a known setting that's just not set
    const meta = settings.get(keyPath);
    if (meta) {
      console.log(dim(`Not set. Default: ${meta.default !== null ? String(meta.default) : "unset"}`));
    } else {
      console.log(yellow(`Unknown setting: ${keyPath}`));
    }
    return;
  }

  const meta = settings.get(keyPath);
  console.log(bold(`${keyPath}`));
  if (meta) console.log(gray(`  ${meta.description}`));
  console.log(`  Current: ${maskValue(value, meta?.secret)}`);
  if (meta && meta.default !== null && meta.default !== undefined) {
    const isDefault = value === meta.default;
    console.log(`  Default: ${String(meta.default)} ${isDefault ? green("(match)") : yellow("(modified)")}`);
  }
}

export function setSetting(repoRoot: string, keyPath: string, rawValue: string): void {
  const settings = allSettings();
  const meta = settings.get(keyPath);

  if (!meta) {
    console.log(yellow(`Unknown setting: ${keyPath}`));
    console.log(gray(`Run 'cocapn settings' to see all available settings.`));
    process.exit(1);
  }

  const value = parseValue(rawValue);

  // Type validation
  const typeErr = validateType(keyPath, value, meta);
  if (typeErr) {
    console.log(red(`Validation error: ${typeErr}`));
    process.exit(1);
  }

  // Semantic validation
  const semErr = validateSemantic(keyPath, value);
  if (semErr) {
    console.log(red(`Validation error: ${semErr}`));
    process.exit(1);
  }

  const cocapnDir = join(repoRoot, "cocapn");
  let configPath = resolveConfigPath(repoRoot);

  // Create config if it doesn't exist
  if (!configPath) {
    if (!existsSync(cocapnDir)) mkdirSync(cocapnDir, { recursive: true });
    configPath = join(cocapnDir, "config.yml");
    writeConfig(configPath, {});
    console.log(gray(`Created ${configPath}`));
  }

  // Auto-backup
  backupConfig(configPath);

  const data = readConfig(configPath);
  const updated = setNestedValue(data, keyPath, value);
  writeConfig(configPath, updated);

  console.log(green(`\u2713 Set ${keyPath} = ${meta.secret && typeof value === "string" ? "********" : String(typeof value === "string" ? value : JSON.stringify(value))}`));
  console.log(gray(`  ${meta.description}`));
}

export function resetSetting(repoRoot: string, keyPath?: string): void {
  const configPath = resolveConfigPath(repoRoot);
  if (!configPath) {
    console.log(yellow("No config.yml found. Nothing to reset."));
    process.exit(1);
  }

  if (!keyPath) {
    // Reset all settings
    const skipConfirm = process.env.COCAPN_YES === "1" || process.argv.includes("--yes") || process.argv.includes("-y");
    if (!skipConfirm) {
      console.log(yellow("Use --yes or -y to confirm resetting all settings to defaults."));
      process.exit(1);
    }

    backupConfig(configPath);
    writeConfig(configPath, {});
    console.log(green("\u2713 All settings reset to defaults. Backup saved to config.yml.bak"));
    return;
  }

  // Reset specific key
  const settings = allSettings();
  const meta = settings.get(keyPath);
  if (!meta) {
    console.log(yellow(`Unknown setting: ${keyPath}`));
    process.exit(1);
  }

  backupConfig(configPath);

  if (meta.default === null) {
    // Remove the key entirely
    const data = readConfig(configPath);
    const updated = deleteNestedKey(data, keyPath);
    writeConfig(configPath, updated);
    console.log(green(`\u2713 Reset ${keyPath} (cleared)`));
  } else {
    const data = readConfig(configPath);
    const updated = setNestedValue(data, keyPath, meta.default);
    writeConfig(configPath, updated);
    console.log(green(`\u2713 Reset ${keyPath} to default: ${String(meta.default)}`));
  }
  console.log(gray("  Backup saved to config.yml.bak"));
}

export function editConfig(repoRoot: string): void {
  const configPath = resolveConfigPath(repoRoot);
  if (!configPath) {
    console.log(yellow("No config.yml found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  console.log(gray(`Opening ${configPath} with ${editor}...`));

  try {
    execSync(`${editor} "${configPath}"`, { stdio: "inherit" });
  } catch {
    console.log(red(`Failed to open editor: ${editor}`));
    console.log(gray(`Edit manually: ${configPath}`));
    process.exit(1);
  }
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createSettingsCommand(): Command {
  const cmd = new Command("settings")
    .description("Manage agent settings (grouped view with validation)")
    .action(() => {
      showAllSettings(process.cwd());
    });

  cmd.addCommand(
    new Command("get")
      .description("Get a specific setting value")
      .argument("<key>", "Setting key (dot notation, e.g., llm.defaultModel)")
      .action((key: string) => {
        getSetting(process.cwd(), key);
      })
  );

  cmd.addCommand(
    new Command("set")
      .description("Set a setting value (with type validation)")
      .argument("<key>", "Setting key (dot notation)")
      .argument("<value>", "New value")
      .action((key: string, value: string) => {
        setSetting(process.cwd(), key, value);
      })
  );

  cmd.addCommand(
    new Command("reset")
      .description("Reset settings to defaults")
      .argument("[key]", "Specific setting to reset (omit for all)")
      .option("-y, --yes", "Skip confirmation (required for resetting all)")
      .action((key: string | undefined) => {
        resetSetting(process.cwd(), key);
      })
  );

  cmd.addCommand(
    new Command("edit")
      .description("Open config.yml in $EDITOR")
      .action(() => {
        editConfig(process.cwd());
      })
  );

  return cmd;
}
