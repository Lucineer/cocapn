/**
 * cocapn remote — Manage remote (cloud) agent instances
 *
 * Usage:
 *   cocapn remote list               — list remote instances
 *   cocapn remote add <name> <url>   — add remote instance
 *   cocapn remote remove <name>      — remove remote
 *   cocapn remote deploy <name>      — deploy to remote
 *   cocapn remote status <name>      — check remote health
 */

import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Colors ──────────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const green = (s: string) => `${c.green}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;
const red = (s: string) => `${c.red}${s}${c.reset}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RemoteInstance {
  name: string;
  url: string;
  addedAt: string;
  lastSeen?: string;
  version?: string;
  status?: string;
}

export interface RemoteHealth {
  status: string;
  version: string;
  mode: string;
  brain: {
    facts: number;
    wiki: number;
    memories: number;
    procedures: number;
  };
  uptime: number;
}

// ─── Remotes file I/O ────────────────────────────────────────────────────────

const REMOTES_TIMEOUT = 10000;

function getRemotesPath(): string {
  const cocapnDir = join(process.cwd(), "cocapn");
  return join(cocapnDir, "remotes.json");
}

function readRemotes(): RemoteInstance[] {
  const path = getRemotesPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeRemotes(remotes: RemoteInstance[]): void {
  const cocapnDir = join(process.cwd(), "cocapn");
  if (!existsSync(cocapnDir)) {
    mkdirSync(cocapnDir, { recursive: true });
  }
  writeFileSync(getRemotesPath(), JSON.stringify(remotes, null, 2), "utf-8");
}

// ─── URL validation ──────────────────────────────────────────────────────────

export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function healthCheck(url: string): Promise<RemoteHealth> {
  const res = await fetch(`${url}/api/health`, {
    signal: AbortSignal.timeout(REMOTES_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<RemoteHealth>;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function remoteList(json: boolean): void {
  const remotes = readRemotes();

  if (json) {
    console.log(JSON.stringify(remotes, null, 2));
    return;
  }

  if (remotes.length === 0) {
    console.log(yellow("No remote instances configured"));
    console.log(dim("  Add one with: cocapn remote add <name> <url>"));
    return;
  }

  console.log(cyan("Remote Instances\n"));

  const nameWidth = Math.max(6, ...remotes.map((r) => r.name.length));
  const urlWidth = Math.max(8, ...remotes.map((r) => r.url.length));

  for (const remote of remotes) {
    const name = bold(remote.name.padEnd(nameWidth));
    const url = dim(remote.url.padEnd(urlWidth));
    const status = remote.status || dim("unknown");
    const version = remote.version ? dim(`v${remote.version}`) : dim("—");

    console.log(`  ${name} ${url} ${status.padEnd(12)} ${version}`);
  }
}

async function remoteAdd(name: string, url: string): Promise<void> {
  if (!isValidUrl(url)) {
    console.error(red("Invalid URL") + ` — must be http:// or https://`);
    process.exit(1);
  }

  const remotes = readRemotes();

  if (remotes.some((r) => r.name === name)) {
    console.error(red("Remote already exists") + ` — "${name}" is already configured`);
    console.error(dim("  Remove it first with: cocapn remote remove " + name));
    process.exit(1);
  }

  // Attempt health check
  let health: RemoteHealth | null = null;
  try {
    health = await healthCheck(url);
  } catch {
    console.log(yellow("Warning:") + ` Could not reach ${url}/api/health — adding anyway`);
  }

  const instance: RemoteInstance = {
    name,
    url,
    addedAt: new Date().toISOString(),
    lastSeen: health ? new Date().toISOString() : undefined,
    version: health?.version,
    status: health?.status || "unknown",
  };

  remotes.push(instance);
  writeRemotes(remotes);

  console.log(green("\u2713") + ` Added remote ${bold(name)}`);
  console.log(`  URL:     ${dim(url)}`);
  if (health) {
    console.log(`  Version: ${dim(`v${health.version}`)}`);
    console.log(`  Status:  ${green(health.status)}`);
    console.log(`  Mode:    ${dim(health.mode)}`);
  }
}

function remoteRemove(name: string): void {
  const remotes = readRemotes();
  const idx = remotes.findIndex((r) => r.name === name);

  if (idx === -1) {
    console.error(red("Remote not found") + ` — "${name}" does not exist`);
    process.exit(1);
  }

  const removed = remotes.splice(idx, 1)[0];
  writeRemotes(remotes);

  console.log(green("\u2713") + ` Removed remote ${bold(name)}`);
  console.log(`  URL: ${dim(removed.url)}`);
}

async function remoteDeploy(name: string): Promise<void> {
  const remotes = readRemotes();
  const remote = remotes.find((r) => r.name === name);

  if (!remote) {
    console.error(red("Remote not found") + ` — "${name}" does not exist`);
    process.exit(1);
  }

  console.log(cyan(`Deploying to ${bold(name)}...`));
  console.log(`  URL: ${dim(remote.url)}`);

  const url = remote.url;
  let deployCmd: string;

  if (url.includes("workers.dev") || url.includes("cloudflare")) {
    deployCmd = "npx wrangler deploy";
  } else {
    deployCmd = "docker compose up --build -d";
  }

  console.log();
  console.log(dim(`  Detected platform: ${url.includes("workers.dev") || url.includes("cloudflare") ? "Cloudflare Workers" : "Docker"}`));
  console.log(dim(`  Run: ${deployCmd}`));
  console.log();

  // Update last seen
  remote.lastSeen = new Date().toISOString();
  writeRemotes(remotes);

  console.log(green("\u2713") + ` Deploy configuration saved for ${bold(name)}`);
  console.log(dim("  Run the deploy command above to push your changes."));
}

async function remoteStatus(name: string): Promise<void> {
  const remotes = readRemotes();
  const remote = remotes.find((r) => r.name === name);

  if (!remote) {
    console.error(red("Remote not found") + ` — "${name}" does not exist`);
    process.exit(1);
  }

  console.log(cyan(`Remote: ${bold(name)}\n`));

  try {
    const health = await healthCheck(remote.url);

    console.log(`  ${bold("URL")}        ${dim(remote.url)}`);
    console.log(`  ${bold("Status")}     ${green(health.status)}`);
    console.log(`  ${bold("Version")}    ${dim(`v${health.version}`)}`);
    console.log(`  ${bold("Mode")}       ${dim(health.mode)}`);
    console.log();

    console.log(`  ${bold("Brain")}`);
    console.log(`    Facts       ${health.brain.facts}`);
    console.log(`    Wiki        ${health.brain.wiki}`);
    console.log(`    Memories    ${health.brain.memories}`);
    console.log(`    Procedures  ${health.brain.procedures}`);
    console.log();

    // Update cached info
    remote.status = health.status;
    remote.version = health.version;
    remote.lastSeen = new Date().toISOString();
    writeRemotes(remotes);
  } catch (err) {
    console.log(`  ${bold("URL")}        ${dim(remote.url)}`);
    console.log(`  ${bold("Status")}     ${red("unreachable")}`);
    console.log();
    console.error(red("  Could not reach remote:") + ` ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ─── Command ─────────────────────────────────────────────────────────────────

export function createRemoteCommand(): Command {
  const cmd = new Command("remote")
    .description("Manage remote (cloud) agent instances");

  // ── list ──────────────────────────────────────────────────────────────────

  cmd
    .command("list")
    .description("List remote instances")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      try {
        remoteList(!!options.json);
      } catch (err) {
        console.error(yellow("List failed:"), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── add ───────────────────────────────────────────────────────────────────

  cmd
    .command("add <name> <url>")
    .description("Add a remote instance")
    .action(async (name: string, url: string) => {
      try {
        await remoteAdd(name, url);
      } catch (err) {
        console.error(yellow("Add failed:"), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── remove ────────────────────────────────────────────────────────────────

  cmd
    .command("remove <name>")
    .description("Remove a remote instance")
    .action((name: string) => {
      try {
        remoteRemove(name);
      } catch (err) {
        console.error(yellow("Remove failed:"), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── deploy ────────────────────────────────────────────────────────────────

  cmd
    .command("deploy <name>")
    .description("Deploy to a remote instance")
    .action(async (name: string) => {
      try {
        await remoteDeploy(name);
      } catch (err) {
        console.error(yellow("Deploy failed:"), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── status ────────────────────────────────────────────────────────────────

  cmd
    .command("status <name>")
    .description("Check remote instance health")
    .action(async (name: string) => {
      try {
        await remoteStatus(name);
      } catch (err) {
        console.error(yellow("Status failed:"), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return cmd;
}

// Exported for testing
export {
  readRemotes,
  writeRemotes,
  remoteList,
  remoteAdd,
  remoteRemove,
  remoteDeploy,
  remoteStatus,
};
