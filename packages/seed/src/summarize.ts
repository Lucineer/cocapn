/**
 * Summarize — conversation summarization for long sessions.
 *
 * After 20+ messages, summarizes the conversation:
 *   - Key topics discussed
 *   - Decisions made
 *   - Facts learned
 *   - Questions left unanswered
 *
 * Saves summary to memory, clears old messages to prevent context overflow.
 */

import type { Memory } from './memory.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Summary {
  topics: string[];
  decisions: string[];
  factsLearned: Array<[string, string]>;
  unansweredQuestions: string[];
  messageRange: { from: number; to: number };
}

// ─── Config ────────────────────────────────────────────────────────────────────

const SUMMARY_THRESHOLD = 20;

// ─── Public API ────────────────────────────────────────────────────────────────

/** Check if summarization is needed. */
export function shouldSummarize(memory: Memory): boolean {
  return memory.messages.length >= SUMMARY_THRESHOLD;
}

/** Summarize the conversation and compact memory. */
export function summarize(memory: Memory): Summary {
  const msgs = memory.messages;
  const userMsgs = msgs.filter(m => m.role === 'user');
  const assistantMsgs = msgs.filter(m => m.role === 'assistant');
  const facts = Object.entries(memory.facts);

  // Extract topics from all messages
  const topics = extractTopics(msgs.map(m => m.content));

  // Detect decisions — sentences with decision signals
  const decisions = userMsgs
    .flatMap(m => m.content.split(/[.!]+/))
    .map(s => s.trim())
    .filter(s => /\b(let's|should|we'll|going to|decided|switch to|use \w+ instead)\b/i.test(s))
    .slice(0, 5);

  // Find unanswered questions — user questions without assistant follow-up
  const unansweredQuestions = userMsgs
    .flatMap(m => m.content.split(/[.!]+/).map(s => s.trim()))
    .filter(s => s.endsWith('?'))
    .filter(q => !assistantMsgs.some(m => {
      const qWords = q.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      return qWords.some(w => m.content.toLowerCase().includes(w));
    }))
    .slice(0, 5);

  // Build summary object
  const summary: Summary = {
    topics,
    decisions,
    factsLearned: facts.slice(0, 10),
    unansweredQuestions,
    messageRange: { from: 0, to: msgs.length },
  };

  // Save summary as a fact, keep only last 5 messages for continuity
  const summaryText = formatSummary(summary);
  memory.facts['_lastSummary'] = summaryText;
  memory['save']();

  // Compact: keep only last 5 messages
  const keep = msgs.slice(-5);
  memory['data'].messages = keep;
  memory['save']();

  return summary;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractTopics(texts: string[]): string[] {
  const stopWords = new Set(['the','a','an','is','are','was','were','i','you','me','my','it','to','of','in','for','and','or','but','not','this','that','with','how','what','when','where','why','do','can','have','has','on','at','be','would','could','should']);
  const counts: Record<string, number> = {};
  for (const text of texts) {
    for (const w of text.toLowerCase().split(/\W+/)) {
      if (w.length > 3 && !stopWords.has(w)) counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
}

function formatSummary(s: Summary): string {
  const parts: string[] = [];
  parts.push(`${s.messageRange.to} messages exchanged`);
  if (s.topics.length) parts.push(`topics: ${s.topics.join(', ')}`);
  if (s.decisions.length) parts.push(`decisions: ${s.decisions.join('; ')}`);
  if (s.factsLearned.length) parts.push(`facts: ${s.factsLearned.length}`);
  if (s.unansweredQuestions.length) parts.push(`unanswered: ${s.unansweredQuestions.join('; ')}`);
  return parts.join(' | ');
}
