/**
 * Analytics — usage analytics for the cocapn seed.
 *
 * Tracks: message count per session/user/day, response times, topics.
 * Storage: .cocapn/analytics.json (append-only events, max 5000)
 * API: GET /api/analytics
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface AnalyticsEvent {
  type: 'message' | 'response' | 'command';
  ts: string;
  user?: string;
  channel?: string;
  topic?: string;
  duration?: number;
}

interface DailyStats {
  date: string;
  messages: number;
  responses: number;
}

export interface AnalyticsStats {
  total: number;
  avgResponseMs: number;
  daily: DailyStats[];
  topTopics: string[];
}

export class Analytics {
  private dir: string;
  private events: AnalyticsEvent[] = [];

  constructor(repoDir: string) {
    const cocapnDir = join(repoDir, '.cocapn');
    if (!existsSync(cocapnDir)) mkdirSync(cocapnDir, { recursive: true });
    this.dir = cocapnDir;
    this.load();
  }

  private get path() { return join(this.dir, 'analytics.json'); }

  private load(): void {
    try {
      if (existsSync(this.path)) this.events = JSON.parse(readFileSync(this.path, 'utf-8'));
    } catch { this.events = []; }
    if (!Array.isArray(this.events)) this.events = [];
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.events, null, 2));
  }

  track(event: AnalyticsEvent): void {
    this.events.push({ ...event, ts: event.ts || new Date().toISOString() });
    if (this.events.length > 5000) this.events = this.events.slice(-5000);
    this.save();
  }

  getStats(days = 7): AnalyticsStats {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const recent = this.events.filter(e => e.ts >= cutoff);
    const msgs = recent.filter(e => e.type === 'message');
    const resps = recent.filter(e => e.type === 'response' && e.duration);
    const durations = resps.map(r => r.duration!);
    const avgResponseMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const topicMap: Record<string, number> = {};
    for (const e of recent) if (e.topic) topicMap[e.topic] = (topicMap[e.topic] ?? 0) + 1;
    const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

    const dayMap: Record<string, AnalyticsEvent[]> = {};
    for (const e of recent) { const d = e.ts.slice(0, 10); (dayMap[d] ??= []).push(e); }

    const daily = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, evts]) => ({
      date,
      messages: evts.filter(e => e.type === 'message').length,
      responses: evts.filter(e => e.type === 'response').length,
    }));

    return { total: msgs.length, avgResponseMs, daily, topTopics };
  }
}
