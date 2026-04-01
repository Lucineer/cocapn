/**
 * Time-tracker plugin — /time [today|week|summary]
 * Tracks development time from git log timestamps.
 * Stores data in .cocapn/time.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const STORE = join('.cocapn', 'time.json');

export default {
  name: 'time-tracker',
  version: '1.0.0',
  hooks: {
    command: {
      async time(args: string) {
        const sub = args.trim() || 'today';
        syncFromGit();
        const data = loadData();
        if (sub === 'week') return summary(data, 7);
        if (sub === 'summary') return summary(data, 30);
        return summary(data, 1);
      },
    },
  },
};

interface TimeEntry { date: string; files: Record<string, number>; total: number }

export function loadData(): TimeEntry[] {
  if (!existsSync(STORE)) return [];
  return JSON.parse(readFileSync(STORE, 'utf-8'));
}

export function saveData(data: TimeEntry[]): void {
  const dir = join(STORE, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORE, JSON.stringify(data, null, 2));
}

export function syncFromGit(): void {
  const data = loadData();
  const since = data.length ? data[data.length - 1].date : '1970-01-01';
  const log = execSync(`git log --format="%ai|%s" --since="${since}" --all`, { encoding: 'utf-8', timeout: 5000 }).trim();
  if (!log) return;
  const entries: Record<string, TimeEntry> = {};
  for (const row of data) entries[row.date] = row;

  log.split('\n').filter(Boolean).forEach(line => {
    const [ts] = line.split('|');
    const date = ts.slice(0, 10);
    if (!entries[date]) entries[date] = { date, files: {}, total: 0 };
    const files = execSync(`git diff --name-only HEAD~1..${line.split('|')[0] ? 'HEAD' : 'HEAD'} -- "${date}"`, { encoding: 'utf-8', timeout: 3000 }).trim().split('\n').filter(Boolean);
    const hours = Math.max(0.5, Math.min(8, files.length * 0.25));
    entries[date].total += hours;
    files.forEach(f => { entries[date].files[f] = (entries[date].files[f] || 0) + hours / files.length; });
  });

  const updated = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
  saveData(updated);
}

export function summary(data: TimeEntry[], days: number): string {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const recent = data.filter(e => e.date >= cutoff);
  if (!recent.length) return `No time tracked in the last ${days} day(s).`;
  const totalHrs = recent.reduce((s, e) => s + e.total, 0);
  const topFiles = Object.entries(recent.reduce<Record<string, number>>((acc, e) => {
    Object.entries(e.files).forEach(([f, h]) => { acc[f] = (acc[f] || 0) + h; });
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const daysList = recent.map(e => `  ${e.date}: ${e.total.toFixed(1)}h`).join('\n');
  return `## Time tracking (${days}d)\nTotal: ${totalHrs.toFixed(1)}h across ${recent.length} day(s)\n\nBy day:\n${daysList}\n\nTop files:\n${topFiles.map(([f, h]) => `  ${f}: ${h.toFixed(1)}h`).join('\n')}`;
}
