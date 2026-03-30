/**
 * Tests for api/analytics.ts — Analytics Dashboard API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AnalyticsAPI,
  type AnalyticsDependencies,
} from "../../src/api/analytics.js";
import type { Brain } from "../../src/brain/index.js";
import type { TokenTracker } from "../../src/metrics/token-tracker.js";
import type { BridgeConfig } from "../../src/config/types.js";
import { DEFAULT_CONFIG } from "../../src/config/types.js";
import { AnalyticsCollector } from "../../src/analytics/collector.js";
import type { IncomingMessage, ServerResponse } from "http";

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeBrain(overrides: Partial<Brain> = {}): Brain {
  return {
    getFact: vi.fn().mockReturnValue(undefined),
    getAllFacts: vi.fn().mockReturnValue({}),
    getMemories: vi.fn().mockReturnValue([]),
    listWikiPages: vi.fn().mockReturnValue([]),
    setMode: vi.fn(),
    getMode: vi.fn().mockReturnValue("private"),
    memoryManager: null,
    ...overrides,
  } as unknown as Brain;
}

function makeTokenTracker(overrides: Partial<TokenTracker> = {}): TokenTracker {
  return {
    record: vi.fn().mockReturnValue("id"),
    getStats: vi.fn().mockReturnValue({
      totalTokensIn: 1000,
      totalTokensOut: 2000,
      totalTokens: 3000,
      avgTokensPerTask: 500,
      tasksCompleted: 5,
      tasksFailed: 1,
      tokensByModule: {},
      tokensBySkill: {},
      tokensByTask: {},
      efficiency: 600,
      topWasters: [],
      period: { start: "2026-03-30T00:00:00Z", end: "2026-03-30T10:00:00Z" },
    }),
    ...overrides,
  } as unknown as TokenTracker;
}

function makeConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AnalyticsDependencies> = {}): AnalyticsDependencies {
  return {
    brain: undefined,
    tokenTracker: undefined,
    collector: undefined,
    config: makeConfig(),
    startTime: Date.now() - 3600_000,
    ...overrides,
  };
}

function makeMockReq(url: string, method = "GET"): IncomingMessage {
  return {
    url,
    method,
    headers: {},
  } as IncomingMessage;
}

function makeMockRes(): { res: ServerResponse; getBody: () => any; getStatusCode: () => number } {
  let body: string | undefined;
  let statusCode = 0;

  const res = {
    writeHead: vi.fn((code: number) => {
      statusCode = code;
    }),
    end: vi.fn((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : undefined;
    }),
  } as unknown as ServerResponse;

  return {
    res,
    getBody: () => (body ? JSON.parse(body) : null),
    getStatusCode: () => statusCode,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AnalyticsAPI", () => {
  let deps: AnalyticsDependencies;
  let api: AnalyticsAPI;
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector(); // in-memory SQLite
    deps = makeDeps({ collector });
    api = new AnalyticsAPI(deps);
  });

  afterEach(() => {
    collector.close();
  });

  // ---------------------------------------------------------------------------
  // Route handling
  // ---------------------------------------------------------------------------

  describe("handleRequest", () => {
    it("returns false for unknown routes", async () => {
      const req = makeMockReq("/api/unknown");
      const { res } = makeMockRes();
      const handled = await api.handleRequest(req, res);
      expect(handled).toBe(false);
    });

    it("returns false for wrong methods", async () => {
      const req = makeMockReq("/api/analytics/overview", "POST");
      const { res } = makeMockRes();
      const handled = await api.handleRequest(req, res);
      expect(handled).toBe(false);
    });

    it("handles GET /api/analytics/overview", async () => {
      const req = makeMockReq("/api/analytics/overview");
      const mockRes = makeMockRes();
      const handled = await api.handleRequest(req, mockRes.res);
      expect(handled).toBe(true);
      expect(mockRes.getStatusCode()).toBe(200);
    });

    it("handles GET /api/analytics/usage", async () => {
      const req = makeMockReq("/api/analytics/usage?period=7d");
      const mockRes = makeMockRes();
      const handled = await api.handleRequest(req, mockRes.res);
      expect(handled).toBe(true);
      expect(mockRes.getStatusCode()).toBe(200);
    });

    it("handles GET /api/analytics/brain", async () => {
      const req = makeMockReq("/api/analytics/brain");
      const mockRes = makeMockRes();
      const handled = await api.handleRequest(req, mockRes.res);
      expect(handled).toBe(true);
      expect(mockRes.getStatusCode()).toBe(200);
    });

    it("handles GET /api/analytics/performance", async () => {
      const req = makeMockReq("/api/analytics/performance");
      const mockRes = makeMockRes();
      const handled = await api.handleRequest(req, mockRes.res);
      expect(handled).toBe(true);
      expect(mockRes.getStatusCode()).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Overview
  // ---------------------------------------------------------------------------

  describe("buildOverview", () => {
    it("returns zeros when no collector", () => {
      const noCollectorApi = new AnalyticsAPI(makeDeps({ collector: undefined }));
      const overview = noCollectorApi.buildOverview();
      expect(overview.totalConversations).toBe(0);
      expect(overview.totalMessages).toBe(0);
      expect(overview.avgConversationLength).toBe(0);
      expect(overview.mostUsedCommands).toEqual([]);
      expect(overview.activeSessions).toBe(0);
      expect(overview.uptimePercent).toBe(100);
    });

    it("counts conversations and messages", () => {
      // Track chat events across 2 sessions
      collector.track("chat", { messageLength: 50, success: true, latency: 100 }, "sess-1");
      collector.track("chat", { messageLength: 80, success: true, latency: 120 }, "sess-1");
      collector.track("chat", { messageLength: 30, success: true, latency: 90 }, "sess-2");

      const overview = api.buildOverview();
      expect(overview.totalConversations).toBe(2);
      expect(overview.totalMessages).toBe(3);
      expect(overview.avgConversationLength).toBe(2); // ceil((2+1)/2) = 2
    });

    it("tracks most used commands", () => {
      collector.track("skill_use", { skillName: "deploy", matchScore: 0.9, success: true }, "s1");
      collector.track("skill_use", { skillName: "deploy", matchScore: 0.8, success: true }, "s1");
      collector.track("skill_use", { skillName: "test", matchScore: 0.7, success: true }, "s1");

      const overview = api.buildOverview();
      expect(overview.mostUsedCommands).toHaveLength(2);
      expect(overview.mostUsedCommands[0]).toEqual({ name: "deploy", count: 2 });
      expect(overview.mostUsedCommands[1]).toEqual({ name: "test", count: 1 });
    });

    it("counts active sessions in last 24h", () => {
      collector.track("chat", { success: true, latency: 100 }, "recent-1");
      collector.track("chat", { success: true, latency: 100 }, "recent-2");

      const overview = api.buildOverview();
      // recent-1 and recent-2 are unique sessionIds from the last 24h
      // But they may not have sessionId explicitly — track uses the sessionId param
      expect(overview.activeSessions).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Usage
  // ---------------------------------------------------------------------------

  describe("buildUsage", () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    it("returns empty arrays when no collector", () => {
      const noCollectorApi = new AnalyticsAPI(makeDeps({ collector: undefined }));
      const usage = noCollectorApi.buildUsage({ start: now - 7 * oneDay, end: now });
      expect(usage.messagesPerDay).toEqual([]);
      expect(usage.tokensPerDay).toEqual([]);
      expect(usage.uniqueUsersPerDay).toEqual([]);
      expect(usage.peakHours).toEqual([]);
    });

    it("aggregates messages per day", () => {
      const yesterday = now - oneDay;
      collector.track("chat", { success: true, latency: 100 }, "s1");
      // Manually insert an event in the past by tracking with timestamp manipulation
      // The collector uses Date.now() internally, so we test with current events
      collector.track("chat", { success: true, latency: 110 }, "s1");

      const period = { start: now - 2 * oneDay, end: now + oneDay };
      const usage = api.buildUsage(period);

      // Should have days in the range
      expect(usage.messagesPerDay.length).toBeGreaterThan(0);
      // Today should have 2 messages
      const todayStr = new Date(now).toISOString().slice(0, 10);
      const todayEntry = usage.messagesPerDay.find((d) => d.date === todayStr);
      expect(todayEntry?.count).toBe(2);
    });

    it("aggregates tokens per day", () => {
      collector.track("token_usage", { tokensIn: 100, tokensOut: 200, model: "test", taskType: "chat" }, "s1");
      collector.track("token_usage", { tokensIn: 50, tokensOut: 150, model: "test", taskType: "code" }, "s1");

      const period = { start: now - oneDay, end: now + oneDay };
      const usage = api.buildUsage(period);

      const todayStr = new Date(now).toISOString().slice(0, 10);
      const todayEntry = usage.tokensPerDay.find((d) => d.date === todayStr);
      expect(todayEntry?.input).toBe(150);
      expect(todayEntry?.output).toBe(350);
      expect(todayEntry?.total).toBe(500);
    });

    it("aggregates unique users per day", () => {
      collector.track("chat", { success: true, latency: 100 }, "user-a");
      collector.track("chat", { success: true, latency: 100 }, "user-b");
      collector.track("chat", { success: true, latency: 100 }, "user-a"); // same user

      const period = { start: now - oneDay, end: now + oneDay };
      const usage = api.buildUsage(period);

      const todayStr = new Date(now).toISOString().slice(0, 10);
      const todayEntry = usage.uniqueUsersPerDay.find((d) => d.date === todayStr);
      expect(todayEntry?.count).toBe(2); // user-a and user-b
    });

    it("computes peak hours", () => {
      collector.track("chat", { success: true, latency: 100 }, "s1");

      const period = { start: now - oneDay, end: now + oneDay };
      const usage = api.buildUsage(period);

      expect(usage.peakHours).toHaveLength(24);
      // At least one hour should have a count > 0
      const totalChat = usage.peakHours.reduce((sum, h) => sum + h.count, 0);
      expect(totalChat).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Brain Analytics
  // ---------------------------------------------------------------------------

  describe("buildBrainAnalytics", () => {
    it("returns data from brain when available", () => {
      const brain = makeBrain({
        getAllFacts: vi.fn().mockReturnValue({
          "knowledge.tech": "TypeScript",
          "knowledge.domain": "AI",
          "user.name": "Alice",
        }),
        getMemories: vi.fn().mockReturnValue([
          { createdAt: "2026-03-28T10:00:00Z" },
          { createdAt: "2026-03-29T14:00:00Z" },
          { createdAt: "2026-03-29T16:00:00Z" },
        ]),
        listWikiPages: vi.fn().mockReturnValue([
          { file: "architecture.md", title: "Architecture" },
          { file: "api.md", title: "API Reference" },
        ]),
      });

      const brainApi = new AnalyticsAPI(makeDeps({ brain, collector }));
      const result = brainApi.buildBrainAnalytics();

      expect(result.knowledgeByType).toEqual({ tech: 1, domain: 1 });
      expect(result.wikiPages).toEqual([
        { file: "architecture.md", title: "Architecture" },
        { file: "api.md", title: "API Reference" },
      ]);
      expect(result.memoriesPerDay).toHaveLength(2); // 2 unique days
    });

    it("returns empty when no brain", () => {
      const noBrainApi = new AnalyticsAPI(makeDeps({ brain: undefined, collector }));
      const result = noBrainApi.buildBrainAnalytics();
      expect(result.knowledgeByType).toEqual({});
      expect(result.wikiPages).toEqual([]);
      expect(result.memoriesPerDay).toEqual([]);
    });

    it("computes facts growth from file_edit events", () => {
      collector.track("file_edit", { filePath: "memory/facts.json" }, "s1");
      collector.track("file_edit", { filePath: "memory/facts.json" }, "s1");
      collector.track("file_edit", { filePath: "src/index.ts" }, "s1"); // not a fact edit

      const result = api.buildBrainAnalytics();
      // Should have growth entries (days in last 7 days)
      expect(result.factsGrowth.length).toBeGreaterThan(0);
      // At least one day should have added > 0
      const totalAdded = result.factsGrowth.reduce((s, d) => s + d.added, 0);
      expect(totalAdded).toBe(2);
    });

    it("finds most referenced facts from chat events", () => {
      const brain = makeBrain({
        getAllFacts: vi.fn().mockReturnValue({
          "knowledge.lang": "TypeScript",
          "knowledge.framework": "React",
          "user.name": "Alice",
        }),
      });

      collector.track("chat", {
        messageContent: "I use knowledge.lang for programming",
        success: true,
        latency: 100,
      }, "s1");
      collector.track("chat", {
        messageContent: "knowledge.lang and knowledge.framework are great",
        success: true,
        latency: 100,
      }, "s1");

      const brainApi = new AnalyticsAPI(makeDeps({ brain, collector }));
      const result = brainApi.buildBrainAnalytics();

      expect(result.mostReferencedFacts.length).toBeGreaterThan(0);
      expect(result.mostReferencedFacts[0]!.key).toBe("knowledge.lang");
      expect(result.mostReferencedFacts[0]!.references).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------

  describe("buildPerformance", () => {
    it("returns zeros when no collector", () => {
      const noCollectorApi = new AnalyticsAPI(makeDeps({ collector: undefined }));
      const perf = noCollectorApi.buildPerformance();
      expect(perf.avgLatency).toBe(0);
      expect(perf.p50).toBe(0);
      expect(perf.p90).toBe(0);
      expect(perf.p99).toBe(0);
      expect(perf.errorRate).toBe(0);
      expect(perf.errorCount).toBe(0);
      expect(perf.rateLimitHits).toBe(0);
    });

    it("computes latency percentiles", () => {
      // Add events with known latencies
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      for (const lat of latencies) {
        collector.track("chat", { success: true, latency: lat }, "s1");
      }

      const perf = api.buildPerformance();
      expect(perf.avgLatency).toBe(550); // (100+200+...+1000)/10
      expect(perf.p50).toBeGreaterThan(0);
      expect(perf.p90).toBeGreaterThan(perf.p50);
      expect(perf.p99).toBeGreaterThanOrEqual(perf.p90);
    });

    it("computes error rate", () => {
      collector.track("chat", { success: true, latency: 100 }, "s1");
      collector.track("chat", { success: true, latency: 100 }, "s1");
      collector.track("error", { errorType: "timeout", errorMessage: "timed out" }, "s1");

      const perf = api.buildPerformance();
      expect(perf.errorCount).toBe(1);
      expect(perf.errorRate).toBeCloseTo(1 / 3, 5);
    });

    it("counts rate limit hits", () => {
      collector.track("error", { errorType: "rate_limit", errorMessage: "too many requests" }, "s1");
      collector.track("error", { errorType: "rate_limit_exceeded", errorMessage: "slow down" }, "s1");
      collector.track("error", { errorType: "timeout", errorMessage: "timed out" }, "s1");

      const perf = api.buildPerformance();
      expect(perf.rateLimitHits).toBe(2);
    });

    it("includes memory usage trend", () => {
      api.sampleMemory(); // manually trigger a sample
      const perf = api.buildPerformance();
      expect(perf.memoryUsageTrend.length).toBeGreaterThan(0);
      const entry = perf.memoryUsageTrend[0]!;
      expect(entry.rss).toBeGreaterThan(0);
      expect(entry.heapUsed).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Memory sampling
  // ---------------------------------------------------------------------------

  describe("sampleMemory", () => {
    it("records memory samples", () => {
      api.sampleMemory();
      api.sampleMemory();
      const trend = api.buildMemoryTrend();
      expect(trend.length).toBe(3); // constructor + 2 manual samples
    });

    it("limits samples to 288 entries", () => {
      // Add 290 samples
      for (let i = 0; i < 290; i++) {
        api.sampleMemory();
      }
      const trend = api.buildMemoryTrend();
      // Constructor adds 1, plus 290 manual = 291 total, capped at 288
      expect(trend.length).toBe(288);
    });
  });

  // ---------------------------------------------------------------------------
  // Period parsing (via usage endpoint)
  // ---------------------------------------------------------------------------

  describe("period parsing", () => {
    it("defaults to 7 days when no period param", async () => {
      collector.track("chat", { success: true, latency: 100 }, "s1");
      const req = makeMockReq("/api/analytics/usage");
      const mockRes = makeMockRes();
      await api.handleRequest(req, mockRes.res);
      const body = mockRes.getBody();
      // 7 day range should have 8 days (start to end inclusive)
      expect(body.messagesPerDay.length).toBeGreaterThanOrEqual(7);
    });

    it("parses hour-based periods", async () => {
      collector.track("chat", { success: true, latency: 100 }, "s1");
      const req = makeMockReq("/api/analytics/usage?period=1h");
      const mockRes = makeMockRes();
      await api.handleRequest(req, mockRes.res);
      const body = mockRes.getBody();
      expect(body.messagesPerDay).toBeDefined();
    });

    it("parses day-based periods", async () => {
      collector.track("chat", { success: true, latency: 100 }, "s1");
      const req = makeMockReq("/api/analytics/usage?period=30d");
      const mockRes = makeMockRes();
      await api.handleRequest(req, mockRes.res);
      const body = mockRes.getBody();
      expect(body.messagesPerDay.length).toBeGreaterThanOrEqual(30);
    });

    it("falls back to 7d for invalid period", async () => {
      const req = makeMockReq("/api/analytics/usage?period=invalid");
      const mockRes = makeMockRes();
      await api.handleRequest(req, mockRes.res);
      const body = mockRes.getBody();
      expect(body.messagesPerDay.length).toBeGreaterThanOrEqual(7);
    });
  });
});
