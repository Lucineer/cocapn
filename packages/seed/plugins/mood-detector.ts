/**
 * Mood-detector plugin — /mood
 * Detects developer mood from commit messages and code patterns.
 * Suggests breaks on frustration, celebrates positive momentum.
 */

import { execSync } from 'node:child_process';

export default {
  name: 'mood-detector',
  version: '1.0.0',
  hooks: {
    command: {
      async mood(_args: string) {
        const messages = recentCommits(20);
        if (!messages.length) return 'No commits found.';
        const scores = messages.map(analyzeSentiment);
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        const trend = detectTrend(scores);
        const state = moodLabel(avg);
        const tip = moodTip(avg, trend);
        return `## Developer Mood: ${state}\nScore: ${avg.toFixed(2)} (trend: ${trend})\n\n${tip}\n\nRecent: ${messages.slice(0, 5).map((m, i) => `${emoji(scores[i])} ${m.slice(0, 60)}`).join('\n')}`;
      },
    },
  },
};

function recentCommits(n: number): string[] {
  try {
    return execSync(`git log --format="%s" -n ${n}`, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

export function analyzeSentiment(msg: string): number {
  let score = 0;
  const positive = /\b(fix|resolve|complete|done|awesome|great|ship|launch|improve|add|clean|refactor|fast|better|woot|yay|nice|perfect|love)\b/i;
  const negative = /\b(wtf|broken|hack|ugly|stupid|hate|damn|hell|broken|wtf|fuck|shit|crap|broken|fail|broken|broke|bang|argh|sigh)\b/i;
  const frustrated = /\b(workaround|temporary|kludge|bodge|monkey.?patch|hack|dirty|quick)\b/i;
  const caps = (msg.match(/[A-Z]{3,}/g) || []).length;
  if (positive.test(msg)) score += 1;
  if (negative.test(msg)) score -= 2;
  if (frustrated.test(msg)) score -= 1;
  if (caps > 1) score -= 1;
  if (msg.endsWith('!') && !msg.startsWith('!')) score += 0.5;
  return Math.max(-3, Math.min(3, score));
}

export function detectTrend(scores: number[]): string {
  if (scores.length < 3) return 'neutral';
  const recent = scores.slice(0, Math.floor(scores.length / 2));
  const older = scores.slice(Math.floor(scores.length / 2));
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

export function moodLabel(avg: number): string {
  if (avg >= 1.0) return 'On Fire';
  if (avg >= 0.3) return 'Productive';
  if (avg >= -0.3) return 'Neutral';
  if (avg >= -1.0) return 'Frustrated';
  return 'Burned Out';
}

function moodTip(avg: number, trend: string): string {
  if (avg >= 1.0 && trend === 'improving') return 'You are on a roll! Ship it.';
  if (avg >= 0.3) return 'Good flow. Keep going.';
  if (avg < -1.0) return 'Take a break. Go for a walk. It will still be here.';
  if (trend === 'declining') return 'Mood trending down. Consider a short break.';
  return 'Steady pace. You got this.';
}

function emoji(score: number): string {
  if (score >= 1) return ':)';
  if (score <= -1) return ':(';
  return ':|';
}
