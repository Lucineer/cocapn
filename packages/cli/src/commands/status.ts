/**
 * cocapn status — Real-time agent health display in the terminal.
 *
 * Fetches from http://localhost:<port>/api/status, falls back to reading
 * local brain files when the bridge is offline.
 */

import { Command } from "commander";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// ─── Types (mirrors local-bridge/src/api/status.ts) ──────────────────────────

export interface StatusResponse {
  agent: {
    name: string;
    version: string;
    mode: string;
    uptime: number;
    repoRoot: string;
  };
  brain: {
    facts: number;
    memories: number;
    wikiPages: number;
    knowledgeEntries: number;
    lastSync: string | null;
  };
  llm: {
    provider: string;
    model: string;
    requestsToday: number;
    tokensToday: number;
    avgLatency: number;
  };
  fleet: {
    peers: number;
    messagesSent: number;
    messagesReceived: number;
  };
  system: {
    memoryUsage: string;
    cpuPercent: number;
    diskUsage: string;
  };
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
  white: "\x1b[37m",
};

const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const green = (s: string) => `${c.green}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;
const gray = (s: string) => `${c.gray}${s}${c.reset}`;

// ─── Box drawing ─────────────────────────────────────────────────────────────

const BOX_WIDTH = 55;

function renderBox(lines: string[]): string {
  const top = `╭${"─".repeat(BOX_WIDTH - 2)}╮`;
  const bottom = `╰${"─".repeat(BOX_WIDTH - 2)}╯`;
  const inner = lines.map((line) => {
    const pad = BOX_WIDTH - 2 - line.length;
    return `│ ${line}${" ".repeat(Math.max(0, pad))} │`;
  });
  return [top, ...inner, bottom].join("\n");
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── Fetch from bridge ──────────────────────────────────────────────────────

async function fetchStatus(host: string, port: number): Promise<StatusResponse> {
  const url = `http://${host}:${port}/api/status`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<StatusResponse>;
}

// ─── Fallback: read local brain files ───────────────────────────────────────

export function readLocalStatus(repoRoot: string): StatusResponse {
  let facts = 0;
  let memories = 0;
  let wikiPages = 0;
  let knowledgeEntries = 0;

  const memoryDir = join(repoRoot, "memory");
  const wikiDir = join(repoRoot, "wiki");

  // Count facts
  const factsPath = join(memoryDir, "facts.json");
  if (existsSync(factsPath)) {
    try {
      const data = JSON.parse(readFileSync(factsPath, "utf-8")) as Record<string, unknown>;
      facts = Object.keys(data).length;
      for (const key of Object.keys(data)) {
        if (key.startsWith("knowledge.")) knowledgeEntries++;
      }
    } catch {
      // malformed file
    }
  }

  // Count memories
  const memoriesPath = join(memoryDir, "memories.json");
  if (existsSync(memoriesPath)) {
    try {
      const data = JSON.parse(readFileSync(memoriesPath, "utf-8")) as unknown[];
      memories = Array.isArray(data) ? data.length : 0;
    } catch {
      // malformed file
    }
  }

  // Count wiki pages
  if (existsSync(wikiDir)) {
    try {
      const files = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
      wikiPages = files.length;
    } catch {
      // can't read
    }
  }

  return {
    agent: {
      name: "Cocapn Agent",
      version: "0.2.0",
      mode: "local",
      uptime: 0,
      repoRoot,
    },
    brain: { facts, memories, wikiPages, knowledgeEntries, lastSync: null },
    llm: { provider: "none", model: "none", requestsToday: 0, tokensToday: 0, avgLatency: 0 },
    fleet: { peers: 0, messagesSent: 0, messagesReceived: 0 },
    system: { memoryUsage: "unknown", cpuPercent: 0, diskUsage: "unknown" },
  };
}

// ─── Terminal renderer ──────────────────────────────────────────────────────

export function renderStatus(status: StatusResponse, offline: boolean): string {
  const lines: string[] = [];

  if (offline) {
    lines.push(dim("(bridge offline — showing local files)"));
    lines.push("");
  }

  // Agent header
  lines.push(`${bold("Agent:")} ${status.agent.name} ${gray(`(v${status.agent.version})`)}`);
  lines.push(`${bold("Mode:")}  ${status.agent.mode}`);
  if (status.agent.uptime > 0) {
    lines.push(`${bold("Uptime:")} ${formatUptime(status.agent.uptime)}`);
  }
  lines.push("");

  // Brain
  lines.push(bold("Brain"));
  lines.push(`├─ Facts: ${status.brain.facts}`);
  lines.push(`├─ Memories: ${status.brain.memories}`);
  lines.push(`├─ Wiki: ${status.brain.wikiPages} pages`);
  lines.push(`└─ Knowledge: ${status.brain.knowledgeEntries} entries`);
  lines.push("");

  // LLM
  lines.push(`${bold("LLM:")} ${status.llm.model}`);
  lines.push(`├─ Requests today: ${formatNumber(status.llm.requestsToday)}`);
  lines.push(`├─ Tokens today: ${formatNumber(status.llm.tokensToday)}`);
  lines.push(`└─ Avg latency: ${status.llm.avgLatency > 0 ? `${(status.llm.avgLatency / 1000).toFixed(1)}s` : "N/A"}`);
  lines.push("");

  // Fleet + System
  lines.push(`${bold("Fleet:")} ${status.fleet.peers} peers connected`);
  lines.push(`${bold("System:")} ${status.system.memoryUsage}, ${status.system.cpuPercent}% CPU`);

  return renderBox(lines);
}

function renderBridgeNotRunning(): string {
  const lines = [
    yellow("Bridge not running."),
    "",
    "Start it with: " + cyan("cocapn start"),
  ];
  return renderBox(lines);
}

// ─── Watch mode ─────────────────────────────────────────────────────────────

async function watchMode(host: string, port: number, repoRoot: string): Promise<never> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Clear screen and move cursor to top
    process.stdout.write("\x1b[2J\x1b[H");

    let offline = false;
    let status: StatusResponse;

    try {
      status = await fetchStatus(host, port);
    } catch {
      offline = true;
      status = readLocalStatus(repoRoot);
    }

    console.log(cyan(bold("╭─ Cocapn Status ──────────────────────────────╮")));
    console.log(renderStatus(status, offline));
    console.log(dim("  Refreshing every 5s. Press Ctrl+C to stop."));

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show real-time agent health status")
    .option("-H, --host <host>", "Bridge host", "localhost")
    .option("-p, --port <port>", "Bridge port", "3100")
    .option("--json", "Output as JSON")
    .option("--watch", "Live update every 5 seconds")
    .option("--repo <path>", "Path to cocapn repo (for offline fallback)", process.cwd())
    .action(async (options: {
      host: string;
      port: string;
      json?: boolean;
      watch?: boolean;
      repo: string;
    }) => {
      const port = parseInt(options.port, 10);
      const repoRoot = options.repo;

      if (options.watch) {
        return watchMode(options.host, port, repoRoot);
      }

      let offline = false;
      let status: StatusResponse;

      try {
        status = await fetchStatus(options.host, port);
      } catch {
        offline = true;
        status = readLocalStatus(repoRoot);
      }

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      if (offline && status.brain.facts === 0 && status.brain.memories === 0 && status.brain.wikiPages === 0) {
        console.log(renderBridgeNotRunning());
        return;
      }

      console.log(renderStatus(status, offline));
    });
}
