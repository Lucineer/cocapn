/**
 * cocapn webhooks — Manage webhook integrations
 *
 * Usage:
 *   cocapn webhooks list                     — List registered webhooks
 *   cocapn webhooks add <url> --events <evts> — Add a webhook
 *   cocapn webhooks remove <url>              — Remove a webhook
 *   cocapn webhooks test <url>                — Send test payload
 *   cocapn webhooks logs                      — Show recent deliveries
 */

import { Command } from "commander";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { randomBytes, createHmac } from "crypto";

// ─── ANSI colors ────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
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
const red = (s: string) => `${c.red}${s}${c.reset}`;
const gray = (s: string) => `${c.gray}${s}${c.reset}`;

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_EVENTS = [
  "brain:updated",
  "chat:message",
  "fleet:changed",
  "knowledge:added",
] as const;

const WEBHOOKS_FILE = "cocapn/webhooks.json";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  createdAt: number;
  lastTriggered?: number;
  successCount: number;
  failureCount: number;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  url: string;
  eventType: string;
  status: "success" | "failed";
  responseCode?: number;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface WebhooksData {
  webhooks: WebhookEntry[];
  deliveryLogs: WebhookDeliveryLog[];
  updatedAt: number;
}

// ─── Storage ────────────────────────────────────────────────────────────────

function storagePath(repoRoot: string): string {
  return join(repoRoot, WEBHOOKS_FILE);
}

export function loadWebhooks(repoRoot: string): WebhooksData {
  const path = storagePath(repoRoot);
  if (!existsSync(path)) {
    return { webhooks: [], deliveryLogs: [], updatedAt: Date.now() };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { webhooks: [], deliveryLogs: [], updatedAt: Date.now() };
  }
}

export function saveWebhooks(repoRoot: string, data: WebhooksData): void {
  const dir = join(repoRoot, "cocapn");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  data.updatedAt = Date.now();
  writeFileSync(storagePath(repoRoot), JSON.stringify(data, null, 2), "utf-8");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return randomBytes(16).toString("hex");
}

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function parseEvents(raw: string): string[] {
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function validateEvents(events: string[]): string[] {
  const invalid = events.filter((e) => !VALID_EVENTS.includes(e as typeof VALID_EVENTS[number]));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid event(s): ${invalid.join(", ")}\n  Valid events: ${VALID_EVENTS.join(", ")}`,
    );
  }
  return events;
}

export async function validateUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`URL must use http or https: ${url}`);
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    // Any response means the server is reachable
    void response;
  } catch (err) {
    throw new Error(
      `URL not reachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

// ─── Core operations ────────────────────────────────────────────────────────

export function addWebhook(
  repoRoot: string,
  url: string,
  events: string[],
): WebhookEntry {
  const data = loadWebhooks(repoRoot);

  // Check for duplicate URL
  if (data.webhooks.some((w) => w.url === url)) {
    throw new Error(`Webhook already exists for URL: ${url}`);
  }

  validateEvents(events);

  const webhook: WebhookEntry = {
    id: generateId(),
    url,
    events,
    active: true,
    secret: generateSecret(),
    createdAt: Date.now(),
    successCount: 0,
    failureCount: 0,
  };

  data.webhooks.push(webhook);
  saveWebhooks(repoRoot, data);
  return webhook;
}

export function removeWebhook(repoRoot: string, url: string): boolean {
  const data = loadWebhooks(repoRoot);
  const index = data.webhooks.findIndex((w) => w.url === url);
  if (index === -1) return false;
  data.webhooks.splice(index, 1);
  saveWebhooks(repoRoot, data);
  return true;
}

export async function testWebhook(
  repoRoot: string,
  url: string,
): Promise<WebhookDeliveryLog> {
  const data = loadWebhooks(repoRoot);
  const webhook = data.webhooks.find((w) => w.url === url);
  if (!webhook) {
    throw new Error(`No webhook found for URL: ${url}`);
  }

  const payload = JSON.stringify({
    id: generateId(),
    type: "test",
    payload: { message: "Test webhook from cocapn", timestamp: Date.now() },
    timestamp: Date.now(),
  });

  const signature = signPayload(payload, webhook.secret);
  const start = Date.now();

  let log: WebhookDeliveryLog;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Cocapn-Webhook/1.0",
        "X-Webhook-Id": webhook.id,
        "X-Webhook-Event": "test",
        "X-Webhook-Delivery": generateId(),
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": Date.now().toString(),
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      webhook.successCount++;
      webhook.lastTriggered = Date.now();
      log = {
        id: generateId(),
        webhookId: webhook.id,
        url,
        eventType: "test",
        status: "success",
        responseCode: response.status,
        latencyMs,
        timestamp: Date.now(),
      };
    } else {
      webhook.failureCount++;
      log = {
        id: generateId(),
        webhookId: webhook.id,
        url,
        eventType: "test",
        status: "failed",
        responseCode: response.status,
        latencyMs,
        timestamp: Date.now(),
        error: `HTTP ${response.status}`,
      };
    }
  } catch (err) {
    webhook.failureCount++;
    log = {
      id: generateId(),
      webhookId: webhook.id,
      url,
      eventType: "test",
      status: "failed",
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }

  data.deliveryLogs.push(log);
  // Keep last 100 delivery logs
  if (data.deliveryLogs.length > 100) {
    data.deliveryLogs = data.deliveryLogs.slice(-100);
  }
  saveWebhooks(repoRoot, data);
  return log;
}

export function listDeliveryLogs(repoRoot: string): WebhookDeliveryLog[] {
  const data = loadWebhooks(repoRoot);
  return [...data.deliveryLogs].reverse();
}

// ─── Display helpers ────────────────────────────────────────────────────────

function printWebhookList(webhooks: WebhookEntry[]): void {
  console.log(bold("\n  cocapn webhooks list\n"));

  if (webhooks.length === 0) {
    console.log(gray("  No webhooks registered.\n"));
    return;
  }

  for (const w of webhooks) {
    const status = w.active ? green("active") : yellow("inactive");
    const last = w.lastTriggered
      ? formatTimestamp(w.lastTriggered)
      : gray("never");
    console.log(`  ${status}  ${cyan(w.url)}`);
    console.log(`    ${gray("Events:")}        ${w.events.join(", ")}`);
    console.log(`    ${gray("Last triggered:")} ${last}`);
    console.log(
      `    ${gray("Deliveries:")}     ${green(String(w.successCount))} success, ${red(String(w.failureCount))} failed`,
    );
    console.log();
  }
}

function printDeliveryLogs(logs: WebhookDeliveryLog[]): void {
  console.log(bold("\n  cocapn webhooks logs\n"));

  if (logs.length === 0) {
    console.log(gray("  No delivery logs.\n"));
    return;
  }

  for (const log of logs) {
    const icon = log.status === "success" ? green("ok") : red("fail");
    const code = log.responseCode ? ` HTTP ${log.responseCode}` : "";
    const latency = `${log.latencyMs}ms`;
    const err = log.error ? ` — ${log.error}` : "";

    console.log(
      `  ${icon}  ${formatTimestamp(log.timestamp)}  ${cyan(log.url)}  ${gray(latency)}${code}${err}`,
    );
  }
  console.log();
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createWebhooksCommand(): Command {
  return new Command("webhooks")
    .description("Manage webhook integrations")
    .addCommand(
      new Command("list")
        .description("List registered webhooks")
        .action(() => {
          const repoRoot = process.cwd();
          const data = loadWebhooks(repoRoot);
          printWebhookList(data.webhooks);
        }),
    )
    .addCommand(
      new Command("add")
        .description("Add a new webhook")
        .argument("<url>", "Webhook target URL")
        .requiredOption("-e, --events <events>", "Comma-separated event types")
        .option("--no-validate", "Skip URL validation")
        .action(async (url: string, options: { events: string; validate: boolean }) => {
          const repoRoot = process.cwd();
          const events = parseEvents(options.events);

          if (events.length === 0) {
            console.error(red("\n  No events specified. Use --events with comma-separated values.\n"));
            process.exit(1);
          }

          try {
            validateEvents(events);
          } catch (err) {
            console.error(red(`\n  ${(err as Error).message}\n`));
            process.exit(1);
          }

          if (options.validate) {
            process.stdout.write(gray("  Validating URL..."));
            try {
              await validateUrl(url);
              console.log(` ${green("ok")}`);
            } catch (err) {
              console.log(` ${yellow("warning")}`);
              console.log(yellow(`  ${(err as Error).message}`));
              console.log(gray("  Use --no-validate to skip URL check."));
              console.log();
            }
          }

          try {
            const webhook = addWebhook(repoRoot, url, events);
            console.log(bold("\n  cocapn webhooks add\n"));
            console.log(`  ${green("+")} ${cyan(webhook.url)}`);
            console.log(`    ${gray("Events:")} ${webhook.events.join(", ")}`);
            console.log(`    ${gray("Secret:")} ${webhook.secret.slice(0, 12)}...`);
            console.log(green("\n  Done.\n"));
          } catch (err) {
            console.error(red(`\n  ${(err as Error).message}\n`));
            process.exit(1);
          }
        }),
    )
    .addCommand(
      new Command("remove")
        .description("Remove a webhook")
        .argument("<url>", "Webhook URL to remove")
        .action((url: string) => {
          const repoRoot = process.cwd();
          const removed = removeWebhook(repoRoot, url);
          if (removed) {
            console.log(green(`\n  Removed webhook: ${url}\n`));
          } else {
            console.error(red(`\n  No webhook found for URL: ${url}\n`));
            process.exit(1);
          }
        }),
    )
    .addCommand(
      new Command("test")
        .description("Send a test payload to a webhook")
        .argument("<url>", "Webhook URL to test")
        .action(async (url: string) => {
          const repoRoot = process.cwd();
          try {
            console.log(gray(`  Sending test payload to ${url}...`));
            const log = await testWebhook(repoRoot, url);
            if (log.status === "success") {
              console.log(
                green(`\n  Test delivered successfully`) +
                gray(` (${log.latencyMs}ms, HTTP ${log.responseCode})`),
              );
              console.log();
            } else {
              console.error(
                red(`\n  Test delivery failed`) +
                gray(` (${log.latencyMs}ms)`) +
                (log.error ? `: ${log.error}` : ""),
              );
              console.error();
              process.exit(1);
            }
          } catch (err) {
            console.error(red(`\n  ${(err as Error).message}\n`));
            process.exit(1);
          }
        }),
    )
    .addCommand(
      new Command("logs")
        .description("Show recent webhook deliveries")
        .option("-n, --limit <n>", "Number of log entries", (v: string) => parseInt(v, 10), 20)
        .action((options: { limit: number }) => {
          const repoRoot = process.cwd();
          const logs = listDeliveryLogs(repoRoot).slice(0, options.limit);
          printDeliveryLogs(logs);
        }),
    );
}
