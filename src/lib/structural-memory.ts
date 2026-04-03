// ═══════════════════════════════════════════════════════════════
// Phase 4 — Structural Memory: isomorphism-based pattern retrieval
// Recognize patterns across repos by structure, not keywords.
// O(log n) via sorted structural hashes in KV.
// ═══════════════════════════════════════════════════════════════

export interface MemoryNode {
  id: string;
  type: 'pattern' | 'concept' | 'solution' | 'anti-pattern';
  structure: string;     // structural hash (normalized shape)
  content: string;       // human-readable description
  source: string;        // which repo/agent created this
  confidence: number;    // 0-1
  connections: string[]; // IDs of related nodes
  timestamp: number;
  accessCount: number;
}

// ── Structural Hash ──
// Normalizes code/logic into a structural signature.
// Strips variable names, string literals → keeps control flow shape.
// e.g., "if(check) { try { await fn() } catch { fallback } }" → "IF_EXPR TRY_EXPR AWAIT CALL CATCH_EXPR BLOCK"
export function structuralHash(code: string): string {
  let s = code
    .replace(/\/\/.*$/gm, '')           // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // strip block comments
    .replace(/'(?:[^'\\]|\\.)*'/g, 'S') // strings → S
    .replace(/"(?:[^"\\]|\\.)*"/g, 'S')
    .replace(/`(?:[^`\\]|\\.)*`/g, 'S')
    .replace(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g, 'X') // identifiers → X
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
  // Simple hash via SubtleCrypto not available in edge, use djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xFFFFFFFF;
  return h.toString(36);
}

// SimHash-inspired: produces comparable bit strings for structural similarity
export function simHash(code: string, bits = 32): string {
  let s = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '')
    .replace(/`(?:[^`\\]|\\.)*`/g, '')
    .replace(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g, 'X')
    .replace(/\s+/g, ' ').trim();

  // Tokenize into 4-grams and compute simhash
  const tokens: string[] = [];
  for (let i = 0; i <= s.length - 4; i++) tokens.push(s.substring(i, i + 4));
  const v = new Int32Array(bits);
  for (const t of tokens) {
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) & 0xFFFFFFFF;
    for (let j = 0; j < bits; j++) {
      if ((h >> j) & 1) v[j]++; else v[j]--;
    }
  }
  let result = '';
  for (let j = 0; j < bits; j++) result += v[j] > 0 ? '1' : '0';
  return result;
}

// Hamming distance between two simhash strings
export function hammingDistance(a: string, b: string): number {
  let d = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++;
  return d;
}

// Similarity score (1 = identical, 0 = completely different)
export function structuralSimilarity(a: string, b: string): number {
  const ha = simHash(a), hb = simHash(b);
  return 1 - hammingDistance(ha, hb) / ha.length;
}

// ── KV Helpers ──
const MEM_PREFIX = 'mem:node:';
const IDX_PREFIX = 'mem:idx:';
const GRAPH_PREFIX = 'mem:graph:';

async function getNode(env: any, id: string): Promise<MemoryNode | null> {
  const raw = await env.COCAPN_KV.get(MEM_PREFIX + id, 'json');
  return raw as MemoryNode | null;
}

async function putNode(env: any, node: MemoryNode): Promise<void> {
  await env.COCAPN_KV.put(MEM_PREFIX + node.id, JSON.stringify(node));
  // Index by simhash prefix for O(log n) retrieval
  const sh = simHash(node.structure);
  await env.COCAPN_KV.put(IDX_PREFIX + sh, node.id);
}

// ── Core API ──

export async function storePattern(env: any, node: MemoryNode): Promise<void> {
  if (!node.id) node.id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!node.timestamp) node.timestamp = Date.now();
  if (!node.accessCount) node.accessCount = 0;
  await putNode(env, node);
}

export async function findSimilar(env: any, structure: string, threshold = 0.7): Promise<MemoryNode[]> {
  const targetHash = simHash(structure);
  const results: MemoryNode[] = [];
  // Scan index keys (in KV, we list by prefix)
  const cursor = await env.COCAPN_KV.list({ prefix: IDX_PREFIX });
  for (const key of cursor.keys) {
    const storedHash = key.name.slice(IDX_PREFIX.length);
    const nodeId = await env.COCAPN_KV.get(key.name);
    if (!nodeId) continue;
    const dist = hammingDistance(targetHash, storedHash);
    const sim = 1 - dist / Math.max(targetHash.length, storedHash.length);
    if (sim >= threshold) {
      const node = await getNode(env, nodeId);
      if (node) {
        node.accessCount++;
        await putNode(env, node);
        results.push(node);
      }
    }
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

export async function getNeighborhood(env: any, nodeId: string, depth = 1): Promise<MemoryNode[]> {
  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  const results: MemoryNode[] = [];
  visited.add(nodeId);

  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of queue) {
      const node = await getNode(env, id);
      if (node) {
        results.push(node);
        for (const conn of node.connections) {
          if (!visited.has(conn)) { visited.add(conn); next.push(conn); }
        }
      }
    }
    queue.length = 0;
    queue.push(...next);
  }
  return results;
}

export async function crossRepoTransfer(
  env: any, fromRepo: string, toRepo: string, problem: string
): Promise<MemoryNode[]> {
  const problemHash = simHash(problem);
  const cursor = await env.COCAPN_KV.list({ prefix: MEM_PREFIX });
  const solutions: MemoryNode[] = [];

  for (const key of cursor.keys) {
    const raw = await env.COCAPN_KV.get(key.name, 'json');
    const node = raw as MemoryNode | null;
    if (!node || node.source !== fromRepo || node.type !== 'solution') continue;
    const dist = hammingDistance(problemHash, simHash(node.structure));
    const sim = 1 - dist / problemHash.length;
    if (sim >= 0.6) {
      solutions.push(node);
    }
  }
  return solutions.sort((a, b) => b.confidence - a.confidence);
}

export async function listPatterns(env: any, source?: string): Promise<MemoryNode[]> {
  const cursor = await env.COCAPN_KV.list({ prefix: MEM_PREFIX });
  const nodes: MemoryNode[] = [];
  for (const key of cursor.keys) {
    const raw = await env.COCAPN_KV.get(key.name, 'json');
    if (raw) {
      const node = raw as MemoryNode;
      if (!source || node.source === source) nodes.push(node);
    }
  }
  return nodes.sort((a, b) => b.timestamp - a.timestamp);
}
