/**
 * Tests for cocapn status command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { renderStatus, readLocalStatus, type StatusResponse } from "../src/commands/status.js";

// ─── Render tests ────────────────────────────────────────────────────────────

describe("renderStatus", () => {
  const baseStatus: StatusResponse = {
    agent: { name: "Fishing Buddy", version: "0.2.0", mode: "private", uptime: 8040, repoRoot: "/test" },
    brain: { facts: 42, memories: 156, wikiPages: 12, knowledgeEntries: 89, lastSync: null },
    llm: { provider: "deepseek", model: "deepseek-chat", requestsToday: 23, tokensToday: 45000, avgLatency: 1200 },
    fleet: { peers: 3, messagesSent: 10, messagesReceived: 5 },
    system: { memoryUsage: "128MB", cpuPercent: 12, diskUsage: "45MB" },
  };

  it("renders box-drawn status with all sections", () => {
    const output = renderStatus(baseStatus, false);
    expect(output).toContain("╭");
    expect(output).toContain("╮");
    expect(output).toContain("╰");
    expect(output).toContain("╯");
    expect(output).toContain("│");
  });

  it("includes agent info", () => {
    const output = renderStatus(baseStatus, false);
    expect(output).toContain("Fishing Buddy");
    expect(output).toContain("v0.2.0");
    expect(output).toContain("private");
    expect(output).toContain("2h 14m");
  });

  it("includes brain stats", () => {
    const output = renderStatus(baseStatus, false);
    expect(output).toContain("Facts: 42");
    expect(output).toContain("Memories: 156");
    expect(output).toContain("Wiki: 12 pages");
    expect(output).toContain("Knowledge: 89 entries");
  });

  it("includes LLM stats", () => {
    const output = renderStatus(baseStatus, false);
    expect(output).toContain("deepseek-chat");
    expect(output).toContain("Requests today: 23");
    expect(output).toContain("Tokens today: 45,000");
    expect(output).toContain("1.2s");
  });

  it("includes fleet and system", () => {
    const output = renderStatus(baseStatus, false);
    expect(output).toContain("3 peers connected");
    expect(output).toContain("128MB");
    expect(output).toContain("12% CPU");
  });

  it("shows offline indicator when bridge is offline", () => {
    const output = renderStatus(baseStatus, true);
    expect(output).toContain("bridge offline");
  });

  it("formats uptime correctly for seconds", () => {
    const status = { ...baseStatus, agent: { ...baseStatus.agent, uptime: 45 } };
    const output = renderStatus(status, false);
    expect(output).toContain("45s");
  });

  it("formats uptime correctly for minutes", () => {
    const status = { ...baseStatus, agent: { ...baseStatus.agent, uptime: 300 } };
    const output = renderStatus(status, false);
    expect(output).toContain("5m");
  });

  it("hides uptime when zero", () => {
    const status = { ...baseStatus, agent: { ...baseStatus.agent, uptime: 0 } };
    const output = renderStatus(status, false);
    expect(output).not.toContain("Uptime:");
  });

  it("shows N/A for latency when zero", () => {
    const status = { ...baseStatus, llm: { ...baseStatus.llm, avgLatency: 0 } };
    const output = renderStatus(status, false);
    expect(output).toContain("N/A");
  });
});

// ─── Local fallback tests ───────────────────────────────────────────────────

describe("readLocalStatus", () => {
  const testDir = join(process.cwd(), ".test-status-tmp");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("returns defaults when no brain files exist", () => {
    const status = readLocalStatus(testDir);
    expect(status.brain.facts).toBe(0);
    expect(status.brain.memories).toBe(0);
    expect(status.brain.wikiPages).toBe(0);
    expect(status.brain.knowledgeEntries).toBe(0);
    expect(status.agent.name).toBe("Cocapn Agent");
  });

  it("counts facts from facts.json", () => {
    const memoryDir = join(testDir, "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "facts.json"), JSON.stringify({
      "user.name": "Alice",
      "user.email": "alice@example.com",
      "knowledge.species.1": "salmon",
    }));

    const status = readLocalStatus(testDir);
    expect(status.brain.facts).toBe(3);
    expect(status.brain.knowledgeEntries).toBe(1);
  });

  it("counts memories from memories.json", () => {
    const memoryDir = join(testDir, "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "memories.json"), JSON.stringify([
      { id: "1", createdAt: "2026-03-30T10:00:00Z" },
      { id: "2", createdAt: "2026-03-29T10:00:00Z" },
      { id: "3", createdAt: "2026-03-28T10:00:00Z" },
    ]));

    const status = readLocalStatus(testDir);
    expect(status.brain.memories).toBe(3);
  });

  it("counts wiki pages", () => {
    const wikiDir = join(testDir, "wiki");
    mkdirSync(wikiDir, { recursive: true });
    writeFileSync(join(wikiDir, "guide.md"), "# Guide");
    writeFileSync(join(wikiDir, "faq.md"), "# FAQ");
    writeFileSync(join(wikiDir, "notes.txt"), "not a wiki page");

    const status = readLocalStatus(testDir);
    expect(status.brain.wikiPages).toBe(2);
  });

  it("handles malformed JSON gracefully", () => {
    const memoryDir = join(testDir, "memory");
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "facts.json"), "not json");
    writeFileSync(join(memoryDir, "memories.json"), "broken");

    const status = readLocalStatus(testDir);
    expect(status.brain.facts).toBe(0);
    expect(status.brain.memories).toBe(0);
  });
});

// ─── JSON output test ────────────────────────────────────────────────────────

describe("JSON output", () => {
  it("produces valid JSON for StatusResponse shape", () => {
    const status: StatusResponse = {
      agent: { name: "Test", version: "0.2.0", mode: "local", uptime: 0, repoRoot: "/test" },
      brain: { facts: 1, memories: 2, wikiPages: 3, knowledgeEntries: 4, lastSync: null },
      llm: { provider: "deepseek", model: "deepseek-chat", requestsToday: 5, tokensToday: 6000, avgLatency: 1200 },
      fleet: { peers: 0, messagesSent: 0, messagesReceived: 0 },
      system: { memoryUsage: "50MB", cpuPercent: 5, diskUsage: "10MB" },
    };

    const json = JSON.stringify(status, null, 2);
    const parsed = JSON.parse(json) as StatusResponse;

    expect(parsed.agent.name).toBe("Test");
    expect(parsed.brain.facts).toBe(1);
    expect(parsed.llm.requestsToday).toBe(5);
    expect(parsed.fleet.peers).toBe(0);
  });
});
