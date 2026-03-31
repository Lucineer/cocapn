/**
 * Tests for cocapn import command — ChatGPT, Claude, markdown, JSONL, CSV.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  createImportCommand,
  parseChatGPT,
  parseClaude,
  parseMarkdownDir,
  parseJSONL,
  parseCSV,
} from "../src/commands/import.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const testDir = join(process.cwd(), ".test-import-tmp");

function setupTestDir(): void {
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  mkdirSync(join(testDir, "cocapn", "memory"), { recursive: true });
}

function cleanupTestDir(): void {
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
}

async function runCommand(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const cmd = createImportCommand();
  let stdout = "";
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;

  console.log = (...a: any[]) => { stdout += a.join(" ") + "\n"; };
  console.error = (...a: any[]) => { stdout += a.join(" ") + "\n"; };
  let exitCode = 0;
  process.exit = ((code: number) => { exitCode = code ?? 1; }) as never;

  try {
    const origCwd = process.cwd;
    process.cwd = () => testDir;

    cmd.parseAsync(["node", "cocapn", ...args]).catch(() => {});
    await new Promise((r) => setTimeout(r, 100));

    process.cwd = origCwd;
  } finally {
    console.log = origLog;
    console.error = origErr;
    process.exit = origExit;
  }

  return { stdout, exitCode };
}

// ─── ChatGPT samples ───────────────────────────────────────────────────────

const CHATGPT_EXPORT = [
  {
    title: "Fishing tips",
    mapping: {
      node1: {
        message: {
          author: { role: "user" },
          content: { parts: ["What's the best bait for salmon?"] },
        },
      },
      node2: {
        message: {
          author: { role: "assistant" },
          content: { parts: ["For salmon, try using roe or herring as bait."] },
        },
      },
    },
  },
  {
    title: "Weather query",
    mapping: {
      node1: {
        message: {
          author: { role: "user" },
          content: { parts: ["What's the weather like?"] },
        },
      },
    },
  },
];

const CLAUDE_EXPORT = [
  {
    name: "Coding help",
    chat_messages: [
      { sender: "human", text: "How do I read a file in Node.js?" },
      { sender: "assistant", text: "Use fs.readFile or readFileSync." },
    ],
  },
];

const CLAUDE_EXPORT_WRAPPED = {
  conversations: [
    {
      name: "Wrapped conversation",
      chat_messages: [
        { sender: "human", text: "Hello" },
        { sender: "assistant", text: "Hi there!" },
      ],
    },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("parseChatGPT", () => {
  it("parses ChatGPT export array", () => {
    const entries = parseChatGPT(JSON.stringify(CHATGPT_EXPORT));
    expect(entries).toHaveLength(2);
    expect(entries[0].meta.title).toBe("Fishing tips");
    expect(entries[0].content).toContain("best bait for salmon");
    expect(entries[0].content).toContain("roe or herring");
    expect(entries[0].source).toBe("chatgpt");
    expect(entries[0].type).toBe("conversation");
  });

  it("extracts message counts", () => {
    const entries = parseChatGPT(JSON.stringify(CHATGPT_EXPORT));
    expect(entries[0].meta.messageCount).toBe(2);
    expect(entries[1].meta.messageCount).toBe(1);
  });

  it("generates slugs from titles", () => {
    const entries = parseChatGPT(JSON.stringify(CHATGPT_EXPORT));
    expect(entries[0].meta.slug).toBe("fishing-tips");
    expect(entries[1].meta.slug).toBe("weather-query");
  });

  it("handles empty mapping", () => {
    const entries = parseChatGPT(JSON.stringify([{ title: "Empty", mapping: {} }]));
    expect(entries).toHaveLength(1);
    expect(entries[0].meta.messageCount).toBe(0);
  });

  it("throws on invalid format", () => {
    expect(() => parseChatGPT("{}")).toThrow("Expected an array");
  });
});

describe("parseClaude", () => {
  it("parses Claude array export", () => {
    const entries = parseClaude(JSON.stringify(CLAUDE_EXPORT));
    expect(entries).toHaveLength(1);
    expect(entries[0].meta.title).toBe("Coding help");
    expect(entries[0].content).toContain("read a file");
    expect(entries[0].source).toBe("claude");
  });

  it("parses wrapped { conversations: [...] } format", () => {
    const entries = parseClaude(JSON.stringify(CLAUDE_EXPORT_WRAPPED));
    expect(entries).toHaveLength(1);
    expect(entries[0].meta.title).toBe("Wrapped conversation");
    expect(entries[0].content).toContain("Hello");
  });

  it("formats sender roles", () => {
    const entries = parseClaude(JSON.stringify(CLAUDE_EXPORT));
    expect(entries[0].content).toContain("**User:**");
    expect(entries[0].content).toContain("**Assistant:**");
  });

  it("throws on invalid format", () => {
    expect(() => parseClaude('"text"')).toThrow();
  });
});

describe("parseJSONL", () => {
  it("parses JSONL with content field", () => {
    const jsonl = [
      JSON.stringify({ content: "First entry", type: "species" }),
      JSON.stringify({ content: "Second entry", type: "regulation" }),
    ].join("\n");

    const entries = parseJSONL(jsonl);
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toBe("First entry");
    expect(entries[0].type).toBe("species");
    expect(entries[1].type).toBe("regulation");
  });

  it("falls back to text field", () => {
    const jsonl = JSON.stringify({ text: "Text content" });
    const entries = parseJSONL(jsonl);
    expect(entries[0].content).toBe("Text content");
  });

  it("falls back to JSON.stringify of whole object", () => {
    const jsonl = JSON.stringify({ name: "Halibut", weight: "30kg" });
    const entries = parseJSONL(jsonl);
    expect(entries[0].content).toContain("Halibut");
  });

  it("respects forceType override", () => {
    const jsonl = JSON.stringify({ content: "Some data", type: "species" });
    const entries = parseJSONL(jsonl, "regulation");
    expect(entries[0].type).toBe("regulation");
  });

  it("defaults type to general", () => {
    const jsonl = JSON.stringify({ content: "No type specified" });
    const entries = parseJSONL(jsonl);
    expect(entries[0].type).toBe("general");
  });

  it("throws on invalid JSON line", () => {
    expect(() => parseJSONL("not json")).toThrow("Invalid JSON on line 1");
  });

  it("skips blank lines", () => {
    const jsonl = `\n${JSON.stringify({ content: "data" })}\n\n`;
    const entries = parseJSONL(jsonl);
    expect(entries).toHaveLength(1);
  });
});

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    const csv = "name,location,weight\nSalmon,Pacific,12kg\nHalibut,Atlantic,30kg";
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toContain("Salmon");
    expect(entries[0].content).toContain("Pacific");
  });

  it("handles quoted fields with commas", () => {
    const csv = 'name,desc\n"Salmon, King","Large fish"';
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toContain("Salmon, King");
  });

  it("respects forceType override", () => {
    const csv = "name,value\nTest,123";
    const entries = parseCSV(csv, "species");
    expect(entries[0].type).toBe("species");
  });

  it("uses type column if present", () => {
    const csv = "name,type\nSalmon,species\nRule,regulation";
    const entries = parseCSV(csv);
    expect(entries[0].type).toBe("species");
    expect(entries[1].type).toBe("regulation");
  });

  it("throws on empty CSV", () => {
    expect(() => parseCSV("")).toThrow("CSV must have a header row");
  });

  it("throws on header-only CSV", () => {
    expect(() => parseCSV("name,value")).toThrow("CSV must have a header row");
  });

  it("stores columns in meta", () => {
    const csv = "name,location\nSalmon,Pacific";
    const entries = parseCSV(csv);
    expect(entries[0].meta.columns).toEqual(["name", "location"]);
  });
});

describe("parseMarkdownDir", () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it("scans .md files from a directory", () => {
    const mdDir = join(testDir, "notes");
    mkdirSync(mdDir, { recursive: true });
    writeFileSync(join(mdDir, "page1.md"), "# Page One\nContent here.");
    writeFileSync(join(mdDir, "page2.md"), "# Page Two\nMore content.");

    const entries = parseMarkdownDir(mdDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toContain("Page One");
    expect(entries[1].content).toContain("Page Two");
    expect(entries[0].type).toBe("wiki");
    expect(entries[0].source).toBe("markdown");
  });

  it("preserves hierarchy with slug separator", () => {
    const mdDir = join(testDir, "notes");
    mkdirSync(join(mdDir, "sub"), { recursive: true });
    writeFileSync(join(mdDir, "root.md"), "# Root");
    writeFileSync(join(mdDir, "sub", "nested.md"), "# Nested");

    const entries = parseMarkdownDir(mdDir);
    expect(entries).toHaveLength(2);
    const nested = entries.find((e) => e.content.includes("Nested"));
    expect(nested!.meta.slug).toContain("--");
    expect(nested!.meta.originalPath).toBe("sub/nested.md");
  });

  it("ignores non-markdown files", () => {
    const mdDir = join(testDir, "notes");
    mkdirSync(mdDir, { recursive: true });
    writeFileSync(join(mdDir, "page.md"), "# Page");
    writeFileSync(join(mdDir, "data.json"), "{}");

    const entries = parseMarkdownDir(mdDir);
    expect(entries).toHaveLength(1);
  });

  it("throws on nonexistent directory", () => {
    expect(() => parseMarkdownDir("/nonexistent")).toThrow("Directory not found");
  });

  it("throws when path is a file", () => {
    const filePath = join(testDir, "file.md");
    writeFileSync(filePath, "# Test");
    expect(() => parseMarkdownDir(filePath)).toThrow("Not a directory");
  });
});

describe("cocapn import CLI", () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it("imports ChatGPT conversations", async () => {
    const chatgptFile = join(testDir, "chatgpt.json");
    writeFileSync(chatgptFile, JSON.stringify(CHATGPT_EXPORT));

    const { stdout } = await runCommand(["chatgpt", chatgptFile, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.source).toBe("chatgpt");
    expect(summary.imported).toBe(2);
    expect(summary.entries).toHaveLength(2);
  });

  it("imports Claude conversations", async () => {
    const claudeFile = join(testDir, "claude.json");
    writeFileSync(claudeFile, JSON.stringify(CLAUDE_EXPORT));

    const { stdout } = await runCommand(["claude", claudeFile, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.source).toBe("claude");
    expect(summary.imported).toBe(1);
  });

  it("imports markdown directory as wiki", async () => {
    const mdDir = join(testDir, "notes");
    mkdirSync(mdDir, { recursive: true });
    writeFileSync(join(mdDir, "test.md"), "# Test Page\nSome content.");

    const { stdout } = await runCommand(["markdown", mdDir, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.source).toBe("markdown");
    expect(summary.imported).toBe(1);

    // Verify wiki file was created
    const wikiDir = join(testDir, "cocapn", "wiki");
    expect(existsSync(join(wikiDir, "test.md"))).toBe(true);
  });

  it("imports JSONL data", async () => {
    const jsonlFile = join(testDir, "data.jsonl");
    writeFileSync(
      jsonlFile,
      [
        JSON.stringify({ content: "Salmon live in the Pacific", type: "species" }),
        JSON.stringify({ content: "Regulation requires permits", type: "regulation" }),
      ].join("\n"),
    );

    const { stdout } = await runCommand(["jsonl", jsonlFile, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.source).toBe("jsonl");
    expect(summary.imported).toBe(2);
  });

  it("imports CSV data", async () => {
    const csvFile = join(testDir, "data.csv");
    writeFileSync(csvFile, "name,location,weight\nSalmon,Pacific,12kg\nHalibut,Atlantic,30kg");

    const { stdout } = await runCommand(["csv", csvFile, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.source).toBe("csv");
    expect(summary.imported).toBe(2);
  });

  it("supports --dry-run without writing", async () => {
    const csvFile = join(testDir, "data.csv");
    writeFileSync(csvFile, "name,value\nTest,123");

    const { stdout } = await runCommand(["csv", csvFile, "--dry-run", "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.imported).toBe(1);

    // No facts file should exist
    expect(existsSync(join(testDir, "cocapn", "memory", "facts.json"))).toBe(false);
  });

  it("deduplicates on re-import", async () => {
    const chatgptFile = join(testDir, "chatgpt.json");
    writeFileSync(chatgptFile, JSON.stringify(CHATGPT_EXPORT));

    // First import
    await runCommand(["chatgpt", chatgptFile, "--json"]);

    // Second import of same data
    const { stdout } = await runCommand(["chatgpt", chatgptFile, "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.duplicates).toBe(2);
    expect(summary.imported).toBe(0);
  });

  it("respects --type flag for CSV", async () => {
    const csvFile = join(testDir, "data.csv");
    writeFileSync(csvFile, "name,value\nTest,123");

    const { stdout } = await runCommand(["csv", csvFile, "--type", "species", "--json"]);
    const summary = JSON.parse(stdout);
    expect(summary.entries[0].type).toBe("species");
  });

  it("shows human-readable summary without --json", async () => {
    const chatgptFile = join(testDir, "chatgpt.json");
    writeFileSync(chatgptFile, JSON.stringify(CHATGPT_EXPORT));

    const { stdout } = await runCommand(["chatgpt", chatgptFile]);
    expect(stdout).toContain("Import:");
    expect(stdout).toContain("chatgpt");
    expect(stdout).toContain("Total:");
    expect(stdout).toContain("Imported:");
  });

  it("exits with error for missing file", async () => {
    const { exitCode } = await runCommand(["chatgpt", "/nonexistent/file.json"]);
    expect(exitCode).toBe(1);
  });
});

describe("createImportCommand", () => {
  it("returns a Commander command with correct name", () => {
    const cmd = createImportCommand();
    expect(cmd.name()).toBe("import");
  });

  it("has subcommands: chatgpt, claude, markdown, jsonl, csv", () => {
    const cmd = createImportCommand();
    const names = cmd.commands.map((c) => c.name());
    expect(names).toContain("chatgpt");
    expect(names).toContain("claude");
    expect(names).toContain("markdown");
    expect(names).toContain("jsonl");
    expect(names).toContain("csv");
  });
});
