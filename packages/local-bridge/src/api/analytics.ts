/**
 * AnalyticsAPI — agent usage metrics and insights dashboard endpoints.
 *
 * Registers HTTP routes on the existing BridgeServer peer API:
 *   GET /api/analytics/overview     — total conversations, messages, commands, uptime
 *   GET /api/analytics/usage        — per-day usage: messages, tokens, users, peak hours
 *   GET /api/analytics/brain        — knowledge growth: facts, memories, wiki, types
 *   GET /api/analytics/performance  — latency percentiles, error rate, memory trend
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { Brain } from "../brain/index.js";
import type { TokenTracker, TokenStats } from "../metrics/token-tracker.js";
import type { BridgeConfig } from "../config/types.js";
import type {
  AnalyticsCollector,
  TimePeriod,
  AnalyticsEvent,
} from "../analytics/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsDependencies {
  brain: Brain | undefined;
  tokenTracker: TokenTracker | undefined;
  collector: AnalyticsCollector | undefined;
  config: BridgeConfig;
  startTime: number;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface OverviewResponse {
  totalConversations: number;
  totalMessages: number;
  avgConversationLength: number;
  mostUsedCommands: Array<{ name: string; count: number }>;
  activeSessions: number;
  uptimePercent: number;
}

export interface UsageResponse {
  messagesPerDay: Array<{ date: string; count: number }>;
  tokensPerDay: Array<{ date: string; input: number; output: number; total: number }>;
  uniqueUsersPerDay: Array<{ date: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface BrainAnalyticsResponse {
  factsGrowth: Array<{ date: string; added: number; total: number }>;
  memoriesPerDay: Array<{ date: string; count: number }>;
  wikiPages: Array<{ file: string; title: string }>;
  knowledgeByType: Record<string, number>;
  mostReferencedFacts: Array<{ key: string; references: number }>;
}

export interface PerformanceResponse {
  avgLatency: number;
  p50: number;
  p90: number;
  p99: number;
  errorRate: number;
  errorCount: number;
  rateLimitHits: number;
  memoryUsageTrend: Array<{ date: string; rss: number; heapUsed: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a period string like "7d", "30d", "1h" into a TimePeriod. */
function parsePeriod(periodStr?: string): TimePeriod {
  const now = Date.now();
  if (!periodStr) {
    return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
  }

  const match = periodStr.match(/^(\d+)([hd])$/);
  if (!match) {
    return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  if (unit === "h") {
    return { start: now - value * 60 * 60 * 1000, end: now };
  }

  return { start: now - value * 24 * 60 * 60 * 1000, end: now };
}

/** Format a timestamp to YYYY-MM-DD. */
function toDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Format a timestamp to the hour (0-23). */
function toHour(ts: number): number {
  return new Date(ts).getHours();
}

/** Group values by day string. */
function groupByDay<T>(
  events: Array<{ timestamp: number }>,
  extractor: (e: typeof events[number], idx: number) => T | undefined,
  aggregator: (values: T[], day: string) => { date: string; [k: string]: unknown },
): Array<{ date: string; [k: string]: unknown }> {
  const buckets = new Map<string, T[]>();

  events.forEach((e, idx) => {
    const val = extractor(e, idx);
    if (val !== undefined) {
      const day = toDay(e.timestamp);
      if (!buckets.has(day)) buckets.set(day, []);
      buckets.get(day)!.push(val);
    }
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => aggregator(values, day));
}

// ─── AnalyticsAPI ─────────────────────────────────────────────────────────────

export class AnalyticsAPI {
  private deps: AnalyticsDependencies;
  /** In-memory memory usage samples for the trend. */
  private memorySamples: Array<{ timestamp: number; rss: number; heapUsed: number }> = [];

  constructor(deps: AnalyticsDependencies) {
    this.deps = deps;
    // Take initial sample
    this.sampleMemory();
  }

  /** Record a memory usage sample. Call periodically (e.g. every 5 min). */
  sampleMemory(): void {
    const mem = process.memoryUsage();
    this.memorySamples.push({
      timestamp: Date.now(),
      rss: mem.rss,
      heapUsed: mem.heapUsed,
    });
    // Keep last 288 samples (= 24h at 5-min intervals)
    if (this.memorySamples.length > 288) {
      this.memorySamples = this.memorySamples.slice(-288);
    }
  }

  /**
   * Route an incoming HTTP request to the appropriate analytics handler.
   * Returns true if the request was handled, false otherwise.
   */
  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = req.url || "";

    if (url === "/api/analytics/overview" && req.method === "GET") {
      return this.handleOverview(req, res);
    }

    if (url.startsWith("/api/analytics/usage") && req.method === "GET") {
      return this.handleUsage(req, res);
    }

    if (url === "/api/analytics/brain" && req.method === "GET") {
      return this.handleBrain(req, res);
    }

    if (url === "/api/analytics/performance" && req.method === "GET") {
      return this.handlePerformance(req, res);
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // GET /api/analytics/overview
  // ---------------------------------------------------------------------------

  private async handleOverview(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const body = this.buildOverview();
    this.json(res, 200, body);
    return true;
  }

  buildOverview(): OverviewResponse {
    const { collector } = this.deps;

    if (!collector) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgConversationLength: 0,
        mostUsedCommands: [],
        activeSessions: 0,
        uptimePercent: 100,
      };
    }

    const allEvents = collector.getEvents();
    const chatEvents = allEvents.filter((e) => e.type === "chat");
    const skillUseEvents = allEvents.filter((e) => e.type === "skill_use");

    // Total conversations = unique sessions with chat events
    const sessions = new Set<string>();
    for (const e of chatEvents) {
      if (e.sessionId) sessions.add(e.sessionId);
    }
    const totalConversations = sessions.size || (chatEvents.length > 0 ? 1 : 0);

    // Total messages = chat events (each = one exchange)
    const totalMessages = chatEvents.length;

    // Average conversation length
    const sessionLengths = new Map<string, number>();
    for (const e of chatEvents) {
      const sid = e.sessionId ?? "__anon__";
      sessionLengths.set(sid, (sessionLengths.get(sid) ?? 0) + 1);
    }
    const avgConversationLength =
      sessionLengths.size > 0
        ? Math.round(
            Array.from(sessionLengths.values()).reduce((a, b) => a + b, 0) /
              sessionLengths.size,
          )
        : 0;

    // Most used commands from skill_use events
    const commandCounts = new Map<string, number>();
    for (const e of skillUseEvents) {
      const name = (e.data.skillName as string) ?? "unknown";
      commandCounts.set(name, (commandCounts.get(name) ?? 0) + 1);
    }
    const mostUsedCommands = Array.from(commandCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Active sessions = unique sessionIds across all events in last 24h
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentSessions = new Set<string>();
    for (const e of allEvents) {
      if (e.timestamp >= oneDayAgo && e.sessionId) {
        recentSessions.add(e.sessionId);
      }
    }

    // Uptime percentage
    const uptimeSec = (Date.now() - this.deps.startTime) / 1000;
    const uptimePercent = uptimeSec > 0 ? 100 : 0;

    return {
      totalConversations,
      totalMessages,
      avgConversationLength,
      mostUsedCommands,
      activeSessions: recentSessions.size,
      uptimePercent,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/analytics/usage?period=7d
  // ---------------------------------------------------------------------------

  private async handleUsage(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url || "/", "http://localhost");
    const periodStr = url.searchParams.get("period") ?? undefined;
    const period = parsePeriod(periodStr);
    const body = this.buildUsage(period);
    this.json(res, 200, body);
    return true;
  }

  buildUsage(period: TimePeriod): UsageResponse {
    const { collector } = this.deps;

    if (!collector) {
      return {
        messagesPerDay: [],
        tokensPerDay: [],
        uniqueUsersPerDay: [],
        peakHours: [],
      };
    }

    const events = collector.getEventsInPeriod(period);
    const chatEvents = events.filter((e) => e.type === "chat");
    const tokenEvents = events.filter((e) => e.type === "token_usage");

    // Generate full date range
    const days = this.generateDayRange(period);

    // Messages per day
    const chatByDay = new Map<string, number>();
    for (const e of chatEvents) {
      const day = toDay(e.timestamp);
      chatByDay.set(day, (chatByDay.get(day) ?? 0) + 1);
    }
    const messagesPerDay = days.map((date) => ({
      date,
      count: chatByDay.get(date) ?? 0,
    }));

    // Tokens per day
    const tokenByDay = new Map<string, { input: number; output: number }>();
    for (const e of tokenEvents) {
      const day = toDay(e.timestamp);
      const existing = tokenByDay.get(day) ?? { input: 0, output: 0 };
      existing.input += (e.data.tokensIn as number) ?? 0;
      existing.output += (e.data.tokensOut as number) ?? 0;
      tokenByDay.set(day, existing);
    }
    const tokensPerDay = days.map((date) => {
      const t = tokenByDay.get(date) ?? { input: 0, output: 0 };
      return { date, ...t, total: t.input + t.output };
    });

    // Unique users (sessions) per day
    const usersByDay = new Map<string, Set<string>>();
    for (const e of events) {
      if (e.sessionId) {
        const day = toDay(e.timestamp);
        if (!usersByDay.has(day)) usersByDay.set(day, new Set());
        usersByDay.get(day)!.add(e.sessionId);
      }
    }
    const uniqueUsersPerDay = days.map((date) => ({
      date,
      count: usersByDay.get(date)?.size ?? 0,
    }));

    // Peak hours (across all chat events in period)
    const hourCounts = new Map<number, number>();
    for (const e of chatEvents) {
      const hour = toHour(e.timestamp);
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
    const peakHours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourCounts.get(hour) ?? 0,
    }));

    return { messagesPerDay, tokensPerDay, uniqueUsersPerDay, peakHours };
  }

  // ---------------------------------------------------------------------------
  // GET /api/analytics/brain
  // ---------------------------------------------------------------------------

  private async handleBrain(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const body = this.buildBrainAnalytics();
    this.json(res, 200, body);
    return true;
  }

  buildBrainAnalytics(): BrainAnalyticsResponse {
    const { brain } = this.deps;

    // Facts
    const facts = brain?.getAllFacts("private") ?? {};
    const factKeys = Object.keys(facts);

    // Facts growth over last 7 days — approximate from events
    const { collector } = this.deps;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const factsGrowth: Array<{ date: string; added: number; total: number }> = [];
    if (collector) {
      const brainEvents = collector.getEventsInPeriod({
        start: sevenDaysAgo,
        end: now,
      });

      // Track fact-related events per day (using task_complete with fact data)
      const factEvents = brainEvents.filter(
        (e) =>
          e.type === "file_edit" &&
          (e.data.filePath as string)?.includes("facts"),
      );

      const factByDay = new Map<string, number>();
      for (const e of factEvents) {
        const day = toDay(e.timestamp);
        factByDay.set(day, (factByDay.get(day) ?? 0) + 1);
      }

      const days = this.generateDayRange({ start: sevenDaysAgo, end: now });
      let cumulative = 0;
      for (const date of days) {
        const added = factByDay.get(date) ?? 0;
        cumulative += added;
        factsGrowth.push({ date, added, total: cumulative });
      }
    }

    // Memories per day
    const memories = brain?.getMemories({ mode: "private" }) ?? [];
    const memoriesPerDay: Array<{ date: string; count: number }> = [];
    const memByDay = new Map<string, number>();
    for (const m of memories) {
      const day = (m.createdAt as string)?.slice(0, 10);
      if (day) {
        memByDay.set(day, (memByDay.get(day) ?? 0) + 1);
      }
    }
    const memDays = Array.from(memByDay.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [date, count] of memDays) {
      memoriesPerDay.push({ date, count });
    }

    // Wiki pages
    const wikiPages = (brain?.listWikiPages() ?? []).map((p) => ({
      file: p.file,
      title: p.title,
    }));

    // Knowledge by type
    const knowledgeByType: Record<string, number> = {};
    for (const key of factKeys) {
      if (key.startsWith("knowledge.")) {
        const type = key.split(".")[1] ?? "unknown";
        knowledgeByType[type] = (knowledgeByType[type] ?? 0) + 1;
      }
    }

    // Most referenced facts — approximate from chat events mentioning fact keys
    const factReferences = new Map<string, number>();
    if (collector) {
      const chatEvents = collector.getEvents({ types: ["chat"] });
      for (const e of chatEvents) {
        const content = (e.data.messageContent as string) ?? "";
        for (const key of factKeys) {
          if (content.includes(key)) {
            factReferences.set(key, (factReferences.get(key) ?? 0) + 1);
          }
        }
      }
    }
    const mostReferencedFacts = Array.from(factReferences.entries())
      .map(([key, references]) => ({ key, references }))
      .sort((a, b) => b.references - a.references)
      .slice(0, 10);

    return {
      factsGrowth,
      memoriesPerDay,
      wikiPages,
      knowledgeByType,
      mostReferencedFacts,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/analytics/performance
  // ---------------------------------------------------------------------------

  private async handlePerformance(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const body = this.buildPerformance();
    this.json(res, 200, body);
    return true;
  }

  buildPerformance(): PerformanceResponse {
    const { collector } = this.deps;

    if (!collector) {
      return {
        avgLatency: 0,
        p50: 0,
        p90: 0,
        p99: 0,
        errorRate: 0,
        errorCount: 0,
        rateLimitHits: 0,
        memoryUsageTrend: this.buildMemoryTrend(),
      };
    }

    // Get all events with latency data
    const allEvents = collector.getEvents();
    const latencies: number[] = [];

    for (const e of allEvents) {
      const lat = e.data.latency as number | undefined;
      if (lat !== undefined) {
        latencies.push(lat);
      }
    }

    latencies.sort((a, b) => a - b);

    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
    const p50 = this.percentile(latencies, 50);
    const p90 = this.percentile(latencies, 90);
    const p99 = this.percentile(latencies, 99);

    // Error metrics
    const totalRequests = allEvents.length;
    const errorEvents = allEvents.filter((e) => e.type === "error");
    const errorCount = errorEvents.length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    // Rate limit hits — count error events with rate-limit type
    const rateLimitHits = errorEvents.filter(
      (e) =>
        (e.data.errorType as string) === "rate_limit" ||
        (e.data.errorType as string) === "rate_limit_exceeded",
    ).length;

    return {
      avgLatency,
      p50,
      p90,
      p99,
      errorRate,
      errorCount,
      rateLimitHits,
      memoryUsageTrend: this.buildMemoryTrend(),
    };
  }

  // ---------------------------------------------------------------------------
  // Builders (public for testing)
  // ---------------------------------------------------------------------------

  buildMemoryTrend(): Array<{ date: string; rss: number; heapUsed: number }> {
    return this.memorySamples.map((s) => ({
      date: toDay(s.timestamp),
      rss: Math.round(s.rss / 1024 / 1024), // MB
      heapUsed: Math.round(s.heapUsed / 1024 / 1024), // MB
    }));
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]!;

    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const frac = rank - lower;

    if (lower === upper) return sorted[lower] ?? 0;

    return Math.round(
      (sorted[lower] ?? 0) + frac * ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)),
    );
  }

  private generateDayRange(period: TimePeriod): string[] {
    const days: string[] = [];
    const start = new Date(period.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(period.end);
    end.setHours(0, 0, 0, 0);

    const current = new Date(start);
    while (current <= end) {
      days.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private json(res: ServerResponse, code: number, body: unknown): void {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  }
}
