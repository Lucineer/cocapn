/**
 * cocapn import — import data from other tools into cocapn.
 *
 * Subcommands:
 *   cocapn import chatgpt <file>  — import ChatGPT conversations
 *   cocapn import claude <file>   — import Claude conversations
 *   cocapn import markdown <dir>  — import markdown notes as wiki pages
 *   cocapn import jsonl <file>    — import JSONL data as knowledge entries
 *   cocapn import csv <file>      — import CSV data as knowledge entries
 *
 * Options:
 *   --dry-run   — preview without writing
 *   --json      — output as JSON
 *   --type <t>  — force type for csv/jsonl (species, regulation, technique, etc.)
 */

import { Command } from "commander";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, basename, extname, relative } from "path";
import { createHash } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportedEntry {
  id: string;
  type: string;
  source: string;
  content: string;
  meta: Record<string, unknown>;
}

interface ImportSummary {
  source: string;
  format: string;
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  entries: ImportedEntry[];
}

// ─── ANSI colors ────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const green = (s: string) => `${c.green}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const red = (s: string) => `${c.red}${s}${c.reset}`;
const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

// ─── Deduplication ──────────────────────────────────────────────────────────

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function loadExistingHashes(memoryDir: string): Set<string> {
  const hashes = new Set<string>();

  // Check facts
  const factsPath = join(memoryDir, "facts.json");
  if (existsSync(factsPath)) {
    try {
      const facts = JSON.parse(readFileSync(factsPath, "utf-8")) as Record<string, unknown>;
      for (const val of Object.values(facts)) {
        hashes.add(contentHash(typeof val === "string" ? val : JSON.stringify(val)));
      }
    } catch { /* skip */ }
  }

  // Check memories
  const memPath = join(memoryDir, "memories.json");
  if (existsSync(memPath)) {
    try {
      const memories = JSON.parse(readFileSync(memPath, "utf-8")) as unknown[];
      if (Array.isArray(memories)) {
        for (const m of memories) {
          const obj = m as Record<string, unknown>;
          if (typeof obj.content === "string") hashes.add(contentHash(obj.content));
        }
      }
    } catch { /* skip */ }
  }

  // Check wiki
  const wikiDir = join(memoryDir, "..", "wiki");
  if (existsSync(wikiDir)) {
    try {
      for (const f of readdirSync(wikiDir)) {
        if (!f.endsWith(".md")) continue;
        const content = readFileSync(join(wikiDir, f), "utf-8");
        hashes.add(contentHash(content));
      }
    } catch { /* skip */ }
  }

  return hashes;
}

// ─── Memory store writers ───────────────────────────────────────────────────

function resolveMemoryDir(cwd: string): string | null {
  const cocapnDir = join(cwd, "cocapn");
  const memoryDir = existsSync(join(cocapnDir, "memory"))
    ? join(cocapnDir, "memory")
    : existsSync(join(cwd, "memory"))
      ? join(cwd, "memory")
      : null;
  return memoryDir;
}

function appendMemories(memoryDir: string, entries: ImportedEntry[]): void {
  const memPath = join(memoryDir, "memories.json");
  let existing: unknown[] = [];
  if (existsSync(memPath)) {
    try {
      const data = JSON.parse(readFileSync(memPath, "utf-8"));
      if (Array.isArray(data)) existing = data;
    } catch { /* start fresh */ }
  }

  const newMemories = entries.map((e) => ({
    id: e.id,
    content: e.content,
    type: e.type,
    source: e.source,
    confidence: 0.8,
    importedAt: new Date().toISOString(),
    ...e.meta,
  }));

  existing.push(...newMemories);
  writeFileSync(memPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

function appendFacts(memoryDir: string, entries: ImportedEntry[]): void {
  const factsPath = join(memoryDir, "facts.json");
  let facts: Record<string, unknown> = {};
  if (existsSync(factsPath)) {
    try {
      facts = JSON.parse(readFileSync(factsPath, "utf-8")) as Record<string, unknown>;
    } catch { /* start fresh */ }
  }

  for (const e of entries) {
    const key = e.meta.factKey
      ? `knowledge.${e.meta.factKey}`
      : `knowledge.imported.${e.id}`;
    facts[key] = e.content;
  }

  writeFileSync(factsPath, JSON.stringify(facts, null, 2) + "\n", "utf-8");
}

function writeWikiPages(cwd: string, entries: ImportedEntry[]): void {
  const cocapnDir = join(cwd, "cocapn");
  const wikiDir = existsSync(cocapnDir)
    ? join(cocapnDir, "wiki")
    : join(cwd, "wiki");

  mkdirSync(wikiDir, { recursive: true });

  for (const e of entries) {
    const slug = (e.meta.slug as string) ?? e.id;
    writeFileSync(join(wikiDir, `${slug}.md`), e.content, "utf-8");
  }
}

// ─── Parsers ────────────────────────────────────────────────────────────────

/**
 * ChatGPT export format (conversations.json):
 * Array of { title, mapping: { id: { message: { author: { role }, content: { parts } } } } }
 */
export function parseChatGPT(raw: string): ImportedEntry[] {
  const conversations = JSON.parse(raw) as ChatGPTConversation[];
  if (!Array.isArray(conversations)) {
    throw new Error("Expected an array of ChatGPT conversations");
  }

  return conversations.map((conv, i) => {
    const title = conv.title ?? `Conversation ${i + 1}`;
    const messages = extractChatGPTMessages(conv);
    const body = messages
      .map((m) => `**${m.role === "user" ? "User" : "Assistant"}:** ${m.text}`)
      .join("\n\n");
    const content = `# ${title}\n\n${body}`;

    return {
      id: contentHash(content),
      type: "conversation",
      source: "chatgpt",
      content,
      meta: {
        title,
        messageCount: messages.length,
        slug: slugify(title),
      },
    };
  });
}

interface ChatGPTConversation {
  title?: string;
  mapping?: Record<string, { message?: { author?: { role?: string }; content?: { parts?: string[] } } }>;
}

interface ChatMessage {
  role: string;
  text: string;
}

function extractChatGPTMessages(conv: ChatGPTConversation): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (!conv.mapping) return messages;

  for (const node of Object.values(conv.mapping)) {
    if (!node.message?.content?.parts) continue;
    const role = node.message.author?.role ?? "unknown";
    const text = node.message.content.parts.join("\n");
    if (text.trim()) {
      messages.push({ role, text });
    }
  }
  return messages;
}

/**
 * Claude export format:
 * Array of { uuid, name, chat_messages: [{ sender, text }] }
 * OR { conversations: [...] }
 */
export function parseClaude(raw: string): ImportedEntry[] {
  const data = JSON.parse(raw);
  if (typeof data !== "object" || data === null) {
    throw new Error("Expected an array or { conversations: [...] }");
  }
  const conversations: ClaudeConversation[] = Array.isArray(data)
    ? data
    : (data as { conversations: ClaudeConversation[] }).conversations ?? [];

  if (!Array.isArray(conversations)) {
    throw new Error("Expected an array or { conversations: [...] }");
  }

  return conversations.map((conv, i) => {
    const name = conv.name ?? `Conversation ${i + 1}`;
    const msgs = conv.chat_messages ?? conv.messages ?? [];
    const body = msgs
      .map((m) => `**${m.sender === "human" ? "User" : "Assistant"}:** ${m.text}`)
      .join("\n\n");
    const content = `# ${name}\n\n${body}`;

    return {
      id: contentHash(content),
      type: "conversation",
      source: "claude",
      content,
      meta: {
        title: name,
        messageCount: msgs.length,
        slug: slugify(name),
      },
    };
  });
}

interface ClaudeConversation {
  name?: string;
  chat_messages?: ClaudeMessage[];
  messages?: ClaudeMessage[];
}

interface ClaudeMessage {
  sender: string;
  text: string;
}

/**
 * Markdown directory scan — each .md becomes a wiki page.
 */
export function parseMarkdownDir(dirPath: string): ImportedEntry[] {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  if (!statSync(dirPath).isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  return scanMarkdownDir(dirPath, dirPath);
}

function scanMarkdownDir(dirPath: string, rootDir: string): ImportedEntry[] {
  const entries: ImportedEntry[] = [];

  for (const dirent of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, dirent.name);

    if (dirent.isDirectory()) {
      entries.push(...scanMarkdownDir(fullPath, rootDir));
      continue;
    }

    if (!dirent.name.endsWith(".md") && !dirent.name.endsWith(".markdown")) continue;

    const content = readFileSync(fullPath, "utf-8");
    const relPath = relative(rootDir, fullPath);
    const slug = relPath.replace(/\.(md|markdown)$/, "").replace(/[/\\]/g, "--");

    entries.push({
      id: contentHash(content),
      type: "wiki",
      source: "markdown",
      content,
      meta: {
        slug,
        originalPath: relPath,
      },
    });
  }

  return entries;
}

/**
 * JSONL import — each line is a JSON object, imported as knowledge.
 */
export function parseJSONL(raw: string, forceType?: string): ImportedEntry[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  return lines.map((line, i) => {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON on line ${i + 1}`);
    }

    const content = typeof obj.content === "string"
      ? obj.content
      : typeof obj.text === "string"
        ? obj.text
        : JSON.stringify(obj);

    const type = forceType ?? (obj.type as string) ?? "general";

    return {
      id: contentHash(content),
      type,
      source: "jsonl",
      content,
      meta: {
        factKey: obj.key ? `${type}.${obj.key}` : undefined,
        ...pickMeta(obj, ["key", "tags", "confidence", "source"]),
      },
    };
  });
}

/**
 * CSV import — first row is header, map columns to knowledge fields.
 */
export function parseCSV(raw: string, forceType?: string): ImportedEntry[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headers = parseCSVRow(lines[0]);
  const entries: ImportedEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVRow(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }

    const content = headers
      .map((h) => `**${h}:** ${row[h]}`)
      .join("\n");

    const name = row.name ?? row.title ?? row.Name ?? row.Title ?? `row-${i}`;
    const type = forceType ?? row.type ?? "general";

    entries.push({
      id: contentHash(content),
      type,
      source: "csv",
      content,
      meta: {
        factKey: `${type}.${slugify(name)}`,
        columns: headers,
      },
    });
  }

  return entries;
}

/**
 * Minimal CSV row parser — handles quoted fields with commas.
 */
function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function pickMeta(
  obj: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// ─── Import runner ──────────────────────────────────────────────────────────

function runImport(
  cwd: string,
  entries: ImportedEntry[],
  format: string,
  dryRun: boolean,
  asJson: boolean,
): ImportSummary {
  const memoryDir = resolveMemoryDir(cwd);

  const summary: ImportSummary = {
    source: format,
    format,
    total: entries.length,
    imported: 0,
    duplicates: 0,
    errors: 0,
    entries: [],
  };

  if (entries.length === 0) return summary;

  // Dedup against existing data
  const existingHashes = memoryDir ? loadExistingHashes(memoryDir) : new Set<string>();
  const uniqueEntries = entries.filter((e) => {
    if (existingHashes.has(e.id)) {
      summary.duplicates++;
      return false;
    }
    return true;
  });

  if (dryRun) {
    summary.imported = uniqueEntries.length;
    summary.entries = uniqueEntries;
    return summary;
  }

  if (!memoryDir) {
    mkdirSync(join(cwd, "cocapn", "memory"), { recursive: true });
  }

  const memDir = resolveMemoryDir(cwd)!;

  // Route by type
  const wikiEntries = uniqueEntries.filter((e) => e.type === "wiki");
  const convEntries = uniqueEntries.filter((e) => e.type === "conversation");
  const knowledgeEntries = uniqueEntries.filter(
    (e) => e.type !== "wiki" && e.type !== "conversation",
  );

  try {
    if (wikiEntries.length > 0) writeWikiPages(cwd, wikiEntries);
    if (convEntries.length > 0) appendMemories(memDir, convEntries);
    if (knowledgeEntries.length > 0) appendFacts(memDir, knowledgeEntries);
    summary.imported = uniqueEntries.length;
    summary.entries = uniqueEntries;
  } catch {
    summary.errors++;
  }

  return summary;
}

function printSummary(summary: ImportSummary): void {
  console.log(bold(`\nImport: ${summary.source}\n`));
  console.log(`  Total:       ${summary.total}`);
  console.log(`  ${green("Imported:")}   ${summary.imported}`);
  if (summary.duplicates > 0) {
    console.log(`  ${yellow("Duplicates:")} ${summary.duplicates}`);
  }
  if (summary.errors > 0) {
    console.log(`  ${red("Errors:")}     ${summary.errors}`);
  }

  if (summary.entries.length > 0 && summary.entries.length <= 20) {
    console.log(`\n  ${dim("Entries:")}`);
    for (const e of summary.entries) {
      const preview = e.content.replace(/\s+/g, " ").trim().slice(0, 60);
      console.log(`  ${cyan(e.type.padEnd(14))} ${dim(preview)}${preview.length >= 60 ? "..." : ""}`);
    }
  }
}

// ─── Subcommand actions ─────────────────────────────────────────────────────

function chatgptAction(cwd: string, filePath: string, opts: ImportOptions): void {
  const absPath = filePath.startsWith("/") ? filePath : join(cwd, filePath);
  if (!existsSync(absPath)) {
    console.error(red(`File not found: ${absPath}`));
    process.exit(1);
  }

  const raw = readFileSync(absPath, "utf-8");
  const entries = parseChatGPT(raw);
  const summary = runImport(cwd, entries, "chatgpt", opts.dryRun ?? false, opts.json ?? false);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

function claudeAction(cwd: string, filePath: string, opts: ImportOptions): void {
  const absPath = filePath.startsWith("/") ? filePath : join(cwd, filePath);
  if (!existsSync(absPath)) {
    console.error(red(`File not found: ${absPath}`));
    process.exit(1);
  }

  const raw = readFileSync(absPath, "utf-8");
  const entries = parseClaude(raw);
  const summary = runImport(cwd, entries, "claude", opts.dryRun ?? false, opts.json ?? false);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

function markdownAction(cwd: string, dirPath: string, opts: ImportOptions): void {
  const absPath = dirPath.startsWith("/") ? dirPath : join(cwd, dirPath);
  if (!existsSync(absPath)) {
    console.error(red(`Directory not found: ${absPath}`));
    process.exit(1);
  }

  const entries = parseMarkdownDir(absPath);
  const summary = runImport(cwd, entries, "markdown", opts.dryRun ?? false, opts.json ?? false);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

function jsonlAction(cwd: string, filePath: string, opts: ImportOptions): void {
  const absPath = filePath.startsWith("/") ? filePath : join(cwd, filePath);
  if (!existsSync(absPath)) {
    console.error(red(`File not found: ${absPath}`));
    process.exit(1);
  }

  const raw = readFileSync(absPath, "utf-8");
  const entries = parseJSONL(raw, opts.type);
  const summary = runImport(cwd, entries, "jsonl", opts.dryRun ?? false, opts.json ?? false);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

function csvAction(cwd: string, filePath: string, opts: ImportOptions): void {
  const absPath = filePath.startsWith("/") ? filePath : join(cwd, filePath);
  if (!existsSync(absPath)) {
    console.error(red(`File not found: ${absPath}`));
    process.exit(1);
  }

  const raw = readFileSync(absPath, "utf-8");
  const entries = parseCSV(raw, opts.type);
  const summary = runImport(cwd, entries, "csv", opts.dryRun ?? false, opts.json ?? false);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

// ─── Types for options ──────────────────────────────────────────────────────

interface ImportOptions {
  dryRun?: boolean;
  json?: boolean;
  type?: string;
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createImportCommand(): Command {
  return new Command("import")
    .description("Import data from other tools into cocapn")
    .addCommand(
      new Command("chatgpt")
        .description("Import ChatGPT conversations")
        .argument("<file>", "Path to ChatGPT conversations.json export")
        .option("--dry-run", "Preview without writing")
        .option("--json", "Output as JSON")
        .action((filePath: string, opts: ImportOptions) => {
          chatgptAction(process.cwd(), filePath, opts);
        })
    )
    .addCommand(
      new Command("claude")
        .description("Import Claude conversations")
        .argument("<file>", "Path to Claude JSON export")
        .option("--dry-run", "Preview without writing")
        .option("--json", "Output as JSON")
        .action((filePath: string, opts: ImportOptions) => {
          claudeAction(process.cwd(), filePath, opts);
        })
    )
    .addCommand(
      new Command("markdown")
        .description("Import markdown notes as wiki pages")
        .argument("<dir>", "Directory containing .md files")
        .option("--dry-run", "Preview without writing")
        .option("--json", "Output as JSON")
        .action((dirPath: string, opts: ImportOptions) => {
          markdownAction(process.cwd(), dirPath, opts);
        })
    )
    .addCommand(
      new Command("jsonl")
        .description("Import JSONL data as knowledge entries")
        .argument("<file>", "Path to JSONL file")
        .option("--type <type>", "Force knowledge type (species, regulation, technique, etc.)")
        .option("--dry-run", "Preview without writing")
        .option("--json", "Output as JSON")
        .action((filePath: string, opts: ImportOptions) => {
          jsonlAction(process.cwd(), filePath, opts);
        })
    )
    .addCommand(
      new Command("csv")
        .description("Import CSV data as knowledge entries")
        .argument("<file>", "Path to CSV file")
        .option("--type <type>", "Force knowledge type (species, regulation, technique, etc.)")
        .option("--dry-run", "Preview without writing")
        .option("--json", "Output as JSON")
        .action((filePath: string, opts: ImportOptions) => {
          csvAction(process.cwd(), filePath, opts);
        })
    );
}
