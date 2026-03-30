/**
 * cocapn memory — Browse and manage agent memory from the CLI.
 *
 * Reads directly from cocapn/memory/*.json and cocapn/wiki/*.md files.
 * No bridge required.
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  type: "fact" | "memory" | "wiki" | "knowledge";
  key: string;
  value: string;
}

export interface MemoryListResult {
  entries: MemoryEntry[];
  total: number;
  byType: Record<string, number>;
}

// ─── ANSI colors (no deps) ──────────────────────────────────────────────────

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
const magenta = (s: string) => `${c.magenta}${s}${c.reset}`;
const gray = (s: string) => `${c.gray}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

// ─── Memory store readers ──────────────────────────────────────────────────

function readFacts(memoryDir: string): MemoryEntry[] {
  const path = join(memoryDir, "facts.json");
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    return Object.entries(data).map(([key, value]) => ({
      type: key.startsWith("knowledge.") ? "knowledge" as const : "fact" as const,
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
  } catch {
    return [];
  }
}

function readMemories(memoryDir: string): MemoryEntry[] {
  const path = join(memoryDir, "memories.json");
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
    if (!Array.isArray(data)) return [];
    return data.map((entry, i) => {
      const obj = entry as Record<string, unknown>;
      return {
        type: "memory" as const,
        key: (obj.id as string) ?? `memory-${i}`,
        value: typeof obj.content === "string" ? obj.content : JSON.stringify(obj),
      };
    });
  } catch {
    return [];
  }
}

function readWiki(wikiDir: string): MemoryEntry[] {
  if (!existsSync(wikiDir)) return [];
  try {
    const files = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
    return files.map((file) => {
      const content = readFileSync(join(wikiDir, file), "utf-8");
      const name = file.replace(/\.md$/, "");
      return {
        type: "wiki" as const,
        key: name,
        value: content,
      };
    });
  } catch {
    return [];
  }
}

// ─── Core helpers ───────────────────────────────────────────────────────────

export function resolveMemoryPaths(repoRoot: string): { memoryDir: string; wikiDir: string } | null {
  // Try both cocapn/memory and memory directly
  const cocapnDir = join(repoRoot, "cocapn");
  const memoryDir = existsSync(join(cocapnDir, "memory"))
    ? join(cocapnDir, "memory")
    : existsSync(join(repoRoot, "memory"))
      ? join(repoRoot, "memory")
      : null;

  if (!memoryDir) return null;

  const wikiDir = existsSync(join(cocapnDir, "wiki"))
    ? join(cocapnDir, "wiki")
    : existsSync(join(repoRoot, "wiki"))
      ? join(repoRoot, "wiki")
      : join(repoRoot, "wiki");

  return { memoryDir, wikiDir };
}

export function loadAllEntries(repoRoot: string): MemoryEntry[] {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) return [];
  return [...readFacts(paths.memoryDir), ...readMemories(paths.memoryDir), ...readWiki(paths.wikiDir)];
}

export function loadEntriesByType(repoRoot: string, type: string): MemoryEntry[] {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) return [];

  switch (type) {
    case "facts":
      return readFacts(paths.memoryDir).filter((e) => e.type === "fact");
    case "memories":
      return readMemories(paths.memoryDir);
    case "wiki":
      return readWiki(paths.wikiDir);
    case "knowledge":
      return readFacts(paths.memoryDir).filter((e) => e.type === "knowledge");
    default:
      return [];
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
}

const TYPE_COLORS: Record<string, (s: string) => string> = {
  fact: green,
  memory: cyan,
  wiki: magenta,
  knowledge: yellow,
};

function formatEntryTable(entries: MemoryEntry[]): string {
  if (entries.length === 0) return gray("No entries found.");

  const typeW = 12;
  const keyW = 30;
  const valW = 40;
  const header = `  ${bold("TYPE".padEnd(typeW))}  ${bold("KEY".padEnd(keyW))}  ${bold("VALUE")}`;
  const sep = `  ${gray("\u2500".repeat(typeW))}  ${gray("\u2500".repeat(keyW))}  ${gray("\u2500".repeat(valW))}`;

  const rows = entries.map((e) => {
    const colorFn = TYPE_COLORS[e.type] ?? ((s: string) => s);
    return `  ${colorFn(e.type.padEnd(typeW))}  ${e.key.padEnd(keyW)}  ${dim(truncate(e.value, valW))}`;
  });

  return [header, sep, ...rows].join("\n");
}

function formatEntryDetail(entry: MemoryEntry): string {
  const colorFn = TYPE_COLORS[entry.type] ?? ((s: string) => s);
  return [
    `${bold("Type:")}  ${colorFn(entry.type)}`,
    `${bold("Key:")}   ${entry.key}`,
    "",
    entry.value,
  ].join("\n");
}

// ─── Subcommands ────────────────────────────────────────────────────────────

function listAction(repoRoot: string, type: string, json: boolean): void {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) {
    console.log(yellow("No cocapn/ directory found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const entries = type === "all" ? loadAllEntries(repoRoot) : loadEntriesByType(repoRoot, type);
  const byType: Record<string, number> = {};
  for (const e of entries) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  const result: MemoryListResult = { entries, total: entries.length, byType };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(bold(`\nMemory (${entries.length} entries)\n`));
  console.log(formatEntryTable(entries));
}

function getAction(repoRoot: string, key: string, json: boolean): void {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) {
    console.log(yellow("No cocapn/ directory found. Run cocapn setup to get started."));
    process.exit(1);
  }

  // Search across all stores
  const allEntries = loadAllEntries(repoRoot);
  const matches = allEntries.filter(
    (e) => e.key === key || e.key.endsWith(`.${key}`) || e.key === `${key}.md`
  );

  if (matches.length === 0) {
    console.log(yellow(`No entry found for key: ${key}`));
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  for (const match of matches) {
    console.log(formatEntryDetail(match));
    console.log("");
  }
}

function setAction(repoRoot: string, key: string, value: string): void {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) {
    console.log(yellow("No cocapn/ directory found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const factsPath = join(paths.memoryDir, "facts.json");
  let facts: Record<string, unknown> = {};
  if (existsSync(factsPath)) {
    try {
      facts = JSON.parse(readFileSync(factsPath, "utf-8")) as Record<string, unknown>;
    } catch {
      // start fresh
    }
  }

  // Check existing value
  const existing = facts[key];
  if (existing !== undefined) {
    console.log(dim(`Current value: ${typeof existing === "string" ? existing : JSON.stringify(existing)}`));
  }

  // Parse value: try JSON first, fall back to string
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }

  facts[key] = parsedValue;
  writeFileSync(factsPath, JSON.stringify(facts, null, 2) + "\n");
  console.log(green(`\u2713 Set ${key}`));
}

function deleteAction(repoRoot: string, key: string): void {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) {
    console.log(yellow("No cocapn/ directory found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const factsPath = join(paths.memoryDir, "facts.json");
  if (!existsSync(factsPath)) {
    console.log(yellow(`No facts file found.`));
    process.exit(1);
  }

  let facts: Record<string, unknown> = {};
  try {
    facts = JSON.parse(readFileSync(factsPath, "utf-8")) as Record<string, unknown>;
  } catch {
    console.log(yellow(`Could not read facts file.`));
    process.exit(1);
  }

  if (!(key in facts)) {
    console.log(yellow(`No fact found with key: ${key}`));
    process.exit(1);
  }

  const value = facts[key];
  const displayValue = typeof value === "string" ? value : JSON.stringify(value);
  console.log(dim(`Deleting: ${key} = ${displayValue}`));

  delete facts[key];
  writeFileSync(factsPath, JSON.stringify(facts, null, 2) + "\n");
  console.log(green(`\u2713 Deleted ${key}`));
}

function searchAction(repoRoot: string, query: string, json: boolean): void {
  const paths = resolveMemoryPaths(repoRoot);
  if (!paths) {
    console.log(yellow("No cocapn/ directory found. Run cocapn setup to get started."));
    process.exit(1);
  }

  const lowerQuery = query.toLowerCase();
  const allEntries = loadAllEntries(repoRoot);
  const matches = allEntries.filter(
    (e) =>
      e.key.toLowerCase().includes(lowerQuery) ||
      e.value.toLowerCase().includes(lowerQuery)
  );

  if (json) {
    console.log(JSON.stringify({ query, matches, total: matches.length }, null, 2));
    return;
  }

  if (matches.length === 0) {
    console.log(gray(`No results for: ${query}`));
    return;
  }

  console.log(bold(`\nSearch: "${query}" (${matches.length} results)\n`));
  console.log(formatEntryTable(matches));
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createMemoryCommand(): Command {
  return new Command("memory")
    .description("Browse and manage agent memory")
    .addCommand(
      new Command("list")
        .description("List all memory entries")
        .option("-t, --type <type>", "Filter by type: facts|memories|wiki|knowledge|all", "all")
        .option("--json", "Output as JSON")
        .action((opts: { type: string; json?: boolean }) => {
          listAction(process.cwd(), opts.type, opts.json ?? false);
        })
    )
    .addCommand(
      new Command("get")
        .description("Get a specific memory entry")
        .argument("<key>", "Key to look up")
        .option("--json", "Output as JSON")
        .action((key: string, opts: { json?: boolean }) => {
          getAction(process.cwd(), key, opts.json ?? false);
        })
    )
    .addCommand(
      new Command("set")
        .description("Set a fact")
        .argument("<key>", "Fact key")
        .argument("<value>", "Fact value")
        .action((key: string, value: string) => {
          setAction(process.cwd(), key, value);
        })
    )
    .addCommand(
      new Command("delete")
        .description("Delete a fact")
        .argument("<key>", "Fact key to delete")
        .action((key: string) => {
          deleteAction(process.cwd(), key);
        })
    )
    .addCommand(
      new Command("search")
        .description("Search across all memory")
        .argument("<query>", "Search query")
        .option("--json", "Output as JSON")
        .action((query: string, opts: { json?: boolean }) => {
          searchAction(process.cwd(), query, opts.json ?? false);
        })
    );
}
