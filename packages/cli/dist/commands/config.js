/**
 * cocapn config — Manage agent configuration from the CLI.
 *
 * Reads/writes cocapn/config.yml directly. No bridge required.
 */
import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readSync } from "fs";
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
const bold = (s) => `${c.bold}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const red = (s) => `${c.red}${s}${c.reset}`;
const magenta = (s) => `${c.magenta}${s}${c.reset}`;
const gray = (s) => `${c.gray}${s}${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;
export function parseYaml(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    return parseBlock(lines, 0, -1).value;
}
function parseBlock(lines, startLine, parentIndent) {
    if (startLine >= lines.length)
        return { value: null, endLine: lines.length };
    // Skip empty / comment lines to find the first content line
    let firstContent = startLine;
    while (firstContent < lines.length && (lines[firstContent].trim() === "" || lines[firstContent].trim().startsWith("#"))) {
        firstContent++;
    }
    if (firstContent >= lines.length)
        return { value: null, endLine: lines.length };
    const baseIndent = getIndent(lines[firstContent]);
    const firstTrimmed = lines[firstContent].trim();
    // List: "- item"
    if (firstTrimmed.startsWith("- ")) {
        return parseList(lines, firstContent, baseIndent);
    }
    // Mapping: "key: value" or "key:"
    if (firstTrimmed.includes(":") && !firstTrimmed.startsWith('"') && !firstTrimmed.startsWith("'")) {
        return parseMapping(lines, firstContent, baseIndent);
    }
    // Scalar
    return { value: parseScalar(firstTrimmed), endLine: firstContent + 1 };
}
function parseMapping(lines, startLine, baseIndent) {
    const result = {};
    let i = startLine;
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
            i++;
            continue;
        }
        if (getIndent(lines[i]) !== baseIndent)
            break;
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx === -1)
            break;
        const key = trimmed.slice(0, colonIdx).trim();
        const afterColon = trimmed.slice(colonIdx + 1).trim();
        if (afterColon === "" || afterColon.startsWith("#")) {
            // Check for nested block on next lines
            const nextNonEmpty = findNextNonEmpty(lines, i + 1);
            if (nextNonEmpty < lines.length && getIndent(lines[nextNonEmpty]) > baseIndent) {
                const nested = parseBlock(lines, nextNonEmpty, baseIndent);
                result[key] = nested.value;
                i = nested.endLine;
            }
            else {
                result[key] = null;
                i++;
            }
        }
        else {
            result[key] = parseScalar(afterColon);
            i++;
        }
    }
    return { value: result, endLine: i };
}
function parseList(lines, startLine, baseIndent) {
    const result = [];
    let i = startLine;
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === "" || trimmed.startsWith("#")) {
            i++;
            continue;
        }
        if (getIndent(lines[i]) !== baseIndent)
            break;
        if (!trimmed.startsWith("- "))
            break;
        const afterDash = trimmed.slice(2).trim();
        if (afterDash === "") {
            // Nested block
            const nextNonEmpty = findNextNonEmpty(lines, i + 1);
            if (nextNonEmpty < lines.length && getIndent(lines[nextNonEmpty]) > baseIndent) {
                const nested = parseBlock(lines, nextNonEmpty, baseIndent);
                result.push(nested.value);
                i = nested.endLine;
            }
            else {
                result.push(null);
                i++;
            }
        }
        else {
            result.push(parseScalar(afterDash));
            i++;
        }
    }
    return { value: result, endLine: i };
}
function parseScalar(raw) {
    if (raw.startsWith("#"))
        return null;
    // Inline comment
    const commentIdx = raw.indexOf(" #");
    if (commentIdx !== -1)
        raw = raw.slice(0, commentIdx).trim();
    if (raw === "null" || raw === "~" || raw === "")
        return null;
    if (raw === "true")
        return true;
    if (raw === "false")
        return false;
    // Quoted string
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }
    // Number
    const num = Number(raw);
    if (!isNaN(num) && raw !== "")
        return num;
    return raw;
}
function getIndent(line) {
    const match = line.match(/^( *)/);
    return match ? match[1].length : 0;
}
function findNextNonEmpty(lines, from) {
    let i = from;
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#")))
        i++;
    return i;
}
// ─── Simple YAML serializer ─────────────────────────────────────────────────
export function serializeYaml(data, indent = 0) {
    const pad = "  ".repeat(indent);
    if (data === null || data === undefined)
        return "null";
    if (typeof data === "boolean" || typeof data === "number")
        return String(data);
    if (typeof data === "string") {
        if (data === "")
            return '""';
        if (data.includes("\n") || data.includes(":") || data.includes("#") || data.startsWith(" ")) {
            return `"${data.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        }
        return data;
    }
    if (Array.isArray(data)) {
        if (data.length === 0)
            return "[]";
        return data.map((item) => {
            if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                const inner = serializeYaml(item, indent + 1);
                return `${pad}- ${inner.trimStart()}`;
            }
            if (Array.isArray(item)) {
                const innerLines = serializeYaml(item, indent + 2).split("\n");
                return `${pad}-\n${innerLines.map((l) => `${pad}  ${l}`).join("\n")}`;
            }
            return `${pad}- ${serializeYaml(item, 0)}`;
        }).join("\n");
    }
    if (typeof data === "object") {
        const entries = Object.entries(data);
        if (entries.length === 0)
            return "{}";
        return entries.map(([key, val]) => {
            if (typeof val === "object" && val !== null) {
                return `${pad}${key}:\n${serializeYaml(val, indent + 1)}`;
            }
            if (val === null)
                return `${pad}${key}:`;
            return `${pad}${key}: ${serializeYaml(val, 0)}`;
        }).join("\n");
    }
    return String(data);
}
// ─── Helpers ────────────────────────────────────────────────────────────────
const SECRET_KEYS = ["apiKey", "api_key", "apikey", "publicKey", "public_key", "token", "secret", "password"];
const MASK_VALUE = "********";
export function resolveConfigPath(repoRoot) {
    const cocapnConfig = join(repoRoot, "cocapn", "config.yml");
    if (existsSync(cocapnConfig))
        return cocapnConfig;
    const rootConfig = join(repoRoot, "config.yml");
    if (existsSync(rootConfig))
        return rootConfig;
    return null;
}
export function readConfig(configPath) {
    const raw = readFileSync(configPath, "utf-8");
    return parseYaml(raw);
}
export function writeConfig(configPath, data) {
    const dir = configPath.substring(0, configPath.lastIndexOf("/"));
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, serializeYaml(data) + "\n", "utf-8");
}
export function backupConfig(configPath) {
    const backupPath = configPath + ".bak";
    copyFileSync(configPath, backupPath);
    return backupPath;
}
export function getNestedValue(obj, keyPath) {
    const parts = keyPath.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === null || typeof current !== "object" || Array.isArray(current))
            return undefined;
        current = current[part];
        if (current === undefined)
            return undefined;
    }
    return current;
}
export function setNestedValue(obj, keyPath, value) {
    const parts = keyPath.split(".");
    const result = typeof obj === "object" && obj !== null && !Array.isArray(obj) ? { ...obj } : {};
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const next = current[part];
        if (next !== undefined && typeof next === "object" && !Array.isArray(next)) {
            current[part] = { ...next };
            current = current[part];
        }
        else {
            current[part] = {};
            current = current[part];
        }
    }
    current[parts[parts.length - 1]] = value;
    return result;
}
export function maskSecrets(data, showAll) {
    if (showAll)
        return data;
    if (Array.isArray(data))
        return data.map((item) => maskSecrets(item, false));
    if (data === null || typeof data !== "object")
        return data;
    const result = {};
    for (const [key, val] of Object.entries(data)) {
        if (SECRET_KEYS.some((sk) => key.toLowerCase().endsWith(sk.toLowerCase()))) {
            result[key] = typeof val === "string" && val.length > 0 ? MASK_VALUE : val;
        }
        else {
            result[key] = maskSecrets(val, false);
        }
    }
    return result;
}
export function validateConfig(data) {
    const issues = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        issues.push({ level: "error", path: "", message: "Config is empty or invalid" });
        return issues;
    }
    const cfg = data;
    // Required top-level sections
    for (const section of ["soul", "config", "sync", "memory"]) {
        if (!(section in cfg)) {
            issues.push({ level: "warning", path: section, message: `Missing required section: ${section}` });
        }
    }
    // config.mode
    const configSection = cfg.config;
    if (configSection) {
        const mode = configSection.mode;
        if (mode !== undefined && !["local", "hybrid", "cloud"].includes(String(mode))) {
            issues.push({ level: "error", path: "config.mode", message: `Invalid mode: ${mode}. Expected: local, hybrid, or cloud` });
        }
        const port = configSection.port;
        if (port !== undefined && (typeof port !== "number" || port < 1 || port > 65535)) {
            issues.push({ level: "error", path: "config.port", message: `Invalid port: ${port}. Must be 1-65535` });
        }
    }
    // sync section
    const syncSection = cfg.sync;
    if (syncSection) {
        for (const key of ["interval", "memoryInterval"]) {
            const val = syncSection[key];
            if (val !== undefined && (typeof val !== "number" || val < 0)) {
                issues.push({ level: "warning", path: `sync.${key}`, message: `${key} should be a positive number (seconds)` });
            }
        }
    }
    // LLM provider validation
    const llmSection = cfg.llm;
    if (llmSection) {
        const providers = llmSection.providers;
        if (providers) {
            for (const [name, prov] of Object.entries(providers)) {
                if (typeof prov === "object" && prov !== null && !Array.isArray(prov)) {
                    const p = prov;
                    if (!p.apiKey || p.apiKey === "") {
                        issues.push({ level: "warning", path: `llm.providers.${name}.apiKey`, message: `No API key configured for provider: ${name}` });
                    }
                }
            }
        }
        const model = llmSection.defaultModel;
        if (model === undefined || model === "") {
            issues.push({ level: "warning", path: "llm.defaultModel", message: "No default LLM model configured" });
        }
    }
    return issues;
}
// ─── Default config ─────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
    soul: "cocapn/soul.md",
    config: {
        mode: "local",
        port: 8787,
    },
    sync: {
        interval: 300,
        memoryInterval: 60,
        autoCommit: true,
        autoPush: false,
    },
    memory: {
        facts: "cocapn/memory/facts.json",
        procedures: "cocapn/memory/procedures.json",
        relationships: "cocapn/memory/relationships.json",
    },
    encryption: {
        publicKey: "",
        encryptedPaths: ["secrets/"],
    },
};
// ─── Subcommand actions ─────────────────────────────────────────────────────
function showAction(repoRoot, json, showAll) {
    const configPath = resolveConfigPath(repoRoot);
    if (!configPath) {
        console.log(yellow("No config.yml found. Run cocapn setup to get started."));
        process.exit(1);
    }
    const data = readConfig(configPath);
    const display = maskSecrets(data, showAll);
    if (json) {
        console.log(JSON.stringify(display, null, 2));
        return;
    }
    console.log(bold(`\nConfig: ${configPath}\n`));
    console.log(formatYamlTree(display));
}
function getAction(repoRoot, keyPath, json, showAll) {
    const configPath = resolveConfigPath(repoRoot);
    if (!configPath) {
        console.log(yellow("No config.yml found. Run cocapn setup to get started."));
        process.exit(1);
    }
    const data = readConfig(configPath);
    const value = getNestedValue(data, keyPath);
    if (value === undefined) {
        console.log(yellow(`Key not found: ${keyPath}`));
        process.exit(1);
    }
    const display = maskSecrets(value, showAll);
    if (json) {
        console.log(JSON.stringify(display, null, 2));
        return;
    }
    if (typeof display === "object" && display !== null) {
        console.log(formatYamlTree(display));
    }
    else {
        console.log(String(display));
    }
}
function setAction(repoRoot, keyPath, rawValue) {
    const cocapnDir = join(repoRoot, "cocapn");
    let configPath = resolveConfigPath(repoRoot);
    // If no config exists, create one in cocapn/
    if (!configPath) {
        if (!existsSync(cocapnDir))
            mkdirSync(cocapnDir, { recursive: true });
        configPath = join(cocapnDir, "config.yml");
        writeConfig(configPath, DEFAULT_CONFIG);
        console.log(gray(`Created ${configPath}`));
    }
    // Backup before change
    backupConfig(configPath);
    // Parse value: try number, boolean, JSON first; fall back to string
    let value;
    if (rawValue === "true")
        value = true;
    else if (rawValue === "false")
        value = false;
    else if (rawValue === "null")
        value = null;
    else if (!isNaN(Number(rawValue)) && rawValue !== "")
        value = Number(rawValue);
    else if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
        try {
            value = JSON.parse(rawValue);
        }
        catch {
            value = rawValue;
        }
    }
    else {
        value = rawValue;
    }
    const data = readConfig(configPath);
    const updated = setNestedValue(data, keyPath, value);
    writeConfig(configPath, updated);
    console.log(green(`\u2713 Set ${keyPath} = ${typeof value === "string" ? value : JSON.stringify(value)}`));
}
function resetAction(repoRoot) {
    const configPath = resolveConfigPath(repoRoot);
    if (!configPath) {
        console.log(yellow("No config.yml found. Nothing to reset."));
        process.exit(1);
    }
    // Confirmation
    const skipConfirm = process.env.COCAPN_YES === "1" || process.argv.includes("--yes") || process.argv.includes("-y");
    if (!skipConfirm) {
        if (process.stdin.isTTY) {
            process.stdout.write(red("Reset config to defaults? This will overwrite your current config. [y/N] "));
            const buf = Buffer.alloc(1);
            readSync(0, buf, 0, 1, null);
            const answer = buf.toString("utf-8", 0, 1).trim().toLowerCase();
            console.log();
            if (answer !== "y") {
                console.log(gray("Cancelled."));
                process.exit(0);
            }
        }
        else {
            console.log(yellow("Use --yes to confirm reset in non-interactive mode."));
            process.exit(1);
        }
    }
    backupConfig(configPath);
    writeConfig(configPath, DEFAULT_CONFIG);
    console.log(green("\u2713 Config reset to defaults. Backup saved to config.yml.bak"));
}
function validateAction(repoRoot, json) {
    const configPath = resolveConfigPath(repoRoot);
    if (!configPath) {
        console.log(yellow("No config.yml found. Run cocapn setup to get started."));
        process.exit(1);
    }
    const data = readConfig(configPath);
    const issues = validateConfig(data);
    if (json) {
        console.log(JSON.stringify({ valid: issues.filter((i) => i.level === "error").length === 0, issues }, null, 2));
        return;
    }
    if (issues.length === 0) {
        console.log(green("\u2713 Config is valid."));
        return;
    }
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");
    if (errors.length > 0) {
        console.log(red(`\n${errors.length} error(s):\n`));
        for (const e of errors) {
            console.log(`  ${red("\u2717")} ${bold(e.path)} — ${e.message}`);
        }
    }
    if (warnings.length > 0) {
        console.log(yellow(`\n${warnings.length} warning(s):\n`));
        for (const w of warnings) {
            console.log(`  ${yellow("\u26A0")} ${bold(w.path)} — ${w.message}`);
        }
    }
    console.log();
    if (errors.length > 0)
        process.exit(1);
}
function formatYamlTree(data, indent = 0) {
    const pad = "  ".repeat(indent);
    if (data === null || data === undefined)
        return dim("null");
    if (typeof data === "boolean")
        return data ? green(String(data)) : red(String(data));
    if (typeof data === "number")
        return cyan(String(data));
    if (typeof data === "string")
        return dim(`"${data}"`);
    if (Array.isArray(data)) {
        if (data.length === 0)
            return dim("[]");
        return data.map((item) => `${pad}${magenta("-")} ${formatYamlTree(item, indent + 1).trimStart()}`).join("\n");
    }
    if (typeof data === "object") {
        const entries = Object.entries(data);
        if (entries.length === 0)
            return dim("{}");
        return entries.map(([key, val]) => {
            if (typeof val === "object" && val !== null) {
                return `${pad}${bold(key)}:\n${formatYamlTree(val, indent + 1)}`;
            }
            return `${pad}${bold(key)}: ${formatYamlTree(val, indent)}`;
        }).join("\n");
    }
    return String(data);
}
// ─── Command ────────────────────────────────────────────────────────────────
export function createConfigCommand() {
    return new Command("config")
        .description("Manage agent configuration")
        .addCommand(new Command("show")
        .description("Show current configuration")
        .option("--json", "Output as JSON")
        .option("--all", "Show secrets (API keys)")
        .action((opts) => {
        showAction(process.cwd(), opts.json ?? false, opts.all ?? false);
    }))
        .addCommand(new Command("get")
        .description("Get a config value (dot notation)")
        .argument("<key>", "Config key (e.g., llm.provider)")
        .option("--json", "Output as JSON")
        .option("--all", "Show secrets")
        .action((key, opts) => {
        getAction(process.cwd(), key, opts.json ?? false, opts.all ?? false);
    }))
        .addCommand(new Command("set")
        .description("Set a config value (dot notation)")
        .argument("<key>", "Config key (e.g., config.port)")
        .argument("<value>", "Config value")
        .action((key, value) => {
        setAction(process.cwd(), key, value);
    }))
        .addCommand(new Command("reset")
        .description("Reset config to defaults")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {
        resetAction(process.cwd());
    }))
        .addCommand(new Command("validate")
        .description("Validate current config")
        .option("--json", "Output as JSON")
        .action((opts) => {
        validateAction(process.cwd(), opts.json ?? false);
    }));
}
//# sourceMappingURL=config.js.map