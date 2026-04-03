// ═══════════════════════════════════════════════════════════════
// Phase 4 — Pattern Extractor
// Extracts structural patterns from code and conversation history.
// ═══════════════════════════════════════════════════════════════

import { MemoryNode, structuralHash, simHash } from './structural-memory.js';

// Extract patterns from a repo's codebase (structural signatures of key functions)
export async function extractPatternsFromRepo(repo: string, files: Record<string, string>): Promise<MemoryNode[]> {
  const patterns: MemoryNode[] = [];
  const now = Date.now();

  for (const [path, content] of Object.entries(files)) {
    if (!content || content.length < 20) continue;
    // Extract function-like blocks
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}(?=\s*(?:export|function|async|const|let|var|class|$))/g;
    const arrowRegex = /(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{[\s\S]*?\}(?=\s*(?:export|const|let|var|class|$))/g;
    const matches = content.match(funcRegex) || [];
    const arrowMatches = content.match(arrowRegex) || [];
    const allBlocks = [...matches, ...arrowMatches];

    for (const block of allBlocks) {
      if (block.length < 30) continue;
      patterns.push({
        id: `pat_${now}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'pattern',
        structure: block,
        content: `${path}: ${block.split('\n')[0].trim().slice(0, 120)}`,
        source: repo,
        confidence: 0.5 + Math.min(block.length / 500, 0.3),
        connections: [],
        timestamp: now,
        accessCount: 0,
      });
    }
  }
  return patterns;
}

// Extract patterns from conversation history (what worked, what didn't)
export async function extractPatternsFromHistory(history: any[]): Promise<MemoryNode[]> {
  const patterns: MemoryNode[] = [];
  const now = Date.now();

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const text = typeof msg === 'string' ? msg : (msg.content || msg.text || JSON.stringify(msg));
    if (!text || text.length < 10) continue;

    // Detect success patterns (positive feedback, resolved states)
    const successSignals = ['resolved', 'fixed', 'working', 'success', 'thanks', 'correct', 'perfect', 'great job'];
    const failureSignals = ['error', 'failed', 'broken', 'wrong', 'bug', 'issue', 'crash', 'not working'];

    const isPositive = successSignals.some(s => text.toLowerCase().includes(s));
    const isNegative = failureSignals.some(s => text.toLowerCase().includes(s));

    if (isPositive || isNegative) {
      // Include context from previous message
      const context = i > 0 ? (typeof history[i - 1] === 'string' ? history[i - 1] : history[i - 1].content || '') : '';
      patterns.push({
        id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
        type: isPositive ? 'solution' : 'anti-pattern',
        structure: (context + '\n' + text).slice(0, 1000),
        content: text.slice(0, 200),
        source: 'conversation-history',
        confidence: 0.6,
        connections: [],
        timestamp: now,
        accessCount: 0,
      });
    }
  }
  return patterns;
}

// Detect anti-patterns (common mistakes across repos)
export async function detectAntiPatterns(env: any): Promise<MemoryNode[]> {
  const patterns = await listAllPatterns(env);
  const antiPatterns: MemoryNode[] = [];

  // Group by structure hash to find recurring patterns
  const hashGroups = new Map<string, MemoryNode[]>();
  for (const p of patterns) {
    const h = structuralHash(p.structure);
    if (!hashGroups.has(h)) hashGroups.set(h, []);
    hashGroups.get(h)!.push(p);
  }

  // Anti-patterns: patterns with low confidence that appear multiple times
  for (const [, group] of hashGroups) {
    if (group.length >= 2 && group.every(p => p.confidence < 0.5)) {
      antiPatterns.push({
        id: `anti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'anti-pattern',
        structure: group[0].structure,
        content: `Recurring low-confidence pattern from ${group.length} repos: ${group.map(p => p.source).join(', ')}`,
        source: 'fleet-analysis',
        confidence: 0.7,
        connections: group.map(p => p.id),
        timestamp: Date.now(),
        accessCount: 0,
      });
    }
  }
  return antiPatterns;
}

// Internal helper
async function listAllPatterns(env: any): Promise<MemoryNode[]> {
  const { listPatterns } = await import('./structural-memory.js');
  return listPatterns(env);
}
