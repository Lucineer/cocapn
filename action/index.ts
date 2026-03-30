/**
 * cocapn-action — GitHub Action entry point.
 *
 * Installs cocapn CLI, starts the agent, validates brain integrity,
 * optionally runs tests, and sets action outputs.
 */

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// ─── Inputs ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = core.getInput("config-path") || "cocapn/config.yml";
const MODE = core.getInput("mode") || "private";
const RUN_TESTS = core.getInput("test") !== "false";
const DEPLOY = core.getInput("deploy") === "true";
const WORKING_DIR = core.getInput("working-directory") || ".";
const HEALTH_TIMEOUT = parseInt(core.getInput("health-timeout") || "30", 10);

// ─── Status response type (mirrors CLI status.ts) ────────────────────────────

interface StatusResponse {
  agent: { name: string; version: string; mode: string; uptime: number };
  brain: {
    facts: number;
    memories: number;
    wikiPages: number;
    knowledgeEntries: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countJsonKeys(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return typeof data === "object" && data !== null ? Object.keys(data).length : 0;
  } catch {
    return -1; // parse error
  }
}

function countJsonArrayItems(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return -1;
  }
}

function countWikiPages(wikiDir: string): number {
  if (!existsSync(wikiDir)) return 0;
  try {
    return readdirSync(wikiDir).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

async function waitForHealth(timeoutSec: number): Promise<boolean> {
  const url = "http://localhost:3100/api/status";
  const start = Date.now();

  while (Date.now() - start < timeoutSec * 1000) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const memoryDir = join(WORKING_DIR, "memory");
  const wikiDir = join(WORKING_DIR, "wiki");

  // Step 1: Install cocapn CLI
  core.info("Installing cocapn CLI...");
  await exec.exec("npm", ["install", "-g", "cocapn"]);

  // Step 2: Start the agent in background
  core.info(`Starting agent in ${MODE} mode...`);
  let agentPid: number | null = null;

  try {
    const startOutput = await exec.getExecOutput(
      "cocapn",
      ["start", "--mode", MODE],
      { cwd: WORKING_DIR, silent: true }
    );
    // If start is synchronous (blocks), we capture output
    core.info(`Agent output: ${startOutput.stdout}`);
  } catch {
    // start may fail or not exist — proceed with offline checks
    core.warning("cocapn start did not complete — proceeding with offline validation");
  }

  // Step 3: Wait for health check
  core.info(`Waiting up to ${HEALTH_TIMEOUT}s for health check...`);
  const healthy = await waitForHealth(HEALTH_TIMEOUT);
  let status = "offline";

  if (healthy) {
    status = "healthy";
    core.info("Agent is healthy");
  } else {
    core.warning("Agent did not become healthy — running offline checks");
  }

  // Step 4: Validate brain integrity
  core.info("Validating brain integrity...");

  const facts = countJsonKeys(join(memoryDir, "facts.json"));
  const memories = countJsonArrayItems(join(memoryDir, "memories.json"));
  const procedures = countJsonKeys(join(memoryDir, "procedures.json"));
  const wikiPages = countWikiPages(wikiDir);

  core.info(`Brain: ${facts} facts, ${memories} memories, ${procedures} procedures, ${wikiPages} wiki pages`);

  if (facts === -1) {
    core.warning("facts.json is malformed");
    status = "degraded";
  }
  if (memories === -1) {
    core.warning("memories.json is malformed");
    status = "degraded";
  }

  // Check soul.md
  const soulPath = join(WORKING_DIR, "soul.md");
  if (existsSync(soulPath)) {
    const soulContent = readFileSync(soulPath, "utf-8");
    core.info(`soul.md: ${soulContent.split("\n").length} lines`);
  } else {
    core.warning("soul.md not found");
    if (status === "healthy") status = "degraded";
  }

  // Step 5: Optionally run tests
  let testResults = "skipped";

  if (RUN_TESTS) {
    core.info("Running tests...");
    try {
      const testOutput = await exec.getExecOutput("npm", ["test"], {
        cwd: WORKING_DIR,
        silent: true,
      });
      testResults = "pass";
      core.info(`Tests passed:\n${testOutput.stdout}`);
    } catch (err: unknown) {
      testResults = "fail";
      const error = err as { stderr?: string; stdout?: string };
      core.warning(`Tests failed: ${error?.stderr || error?.stdout || "unknown error"}`);
    }
  }

  // Step 6: Optionally deploy
  if (DEPLOY) {
    core.info("Deploying...");
    try {
      await exec.exec("cocapn", ["deploy", "--env", "production"], {
        cwd: WORKING_DIR,
      });
      core.info("Deploy succeeded");
    } catch {
      core.setFailed("Deploy failed");
      return;
    }
  }

  // Step 7: Set outputs
  core.setOutput("status", status);
  core.setOutput("brain-facts", String(Math.max(0, facts)));
  core.setOutput("brain-memories", String(Math.max(0, memories)));
  core.setOutput("brain-wiki", String(wikiPages));
  core.setOutput("test-results", testResults);

  // Step 8: Try to fetch full status from bridge
  if (healthy) {
    try {
      const res = await fetch("http://localhost:3100/api/status");
      const data = (await res.json()) as StatusResponse;
      core.info(`Agent: ${data.agent.name} v${data.agent.version} (${data.agent.mode})`);
      core.info(`LLM requests today: ${data.brain.facts} facts loaded`);
    } catch {
      // best effort
    }
  }

  core.info(`Action complete: status=${status}, tests=${testResults}`);
}

run().catch((err) => {
  core.setFailed(`Action failed: ${err}`);
});
