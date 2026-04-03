// ═══════════════════════════════════════════════════════════════
// Phase 4 — Cross-Cocapn Bridge
// Enables knowledge flow between Cocapn vessels (repos).
// ═══════════════════════════════════════════════════════════════

import { MemoryNode, storePattern, listPatterns, structuralHash } from './structural-memory.js';

// Fleet vessel URLs for cross-repo communication
const FLEET_VESSELS: Record<string, string> = {
  'cocapn': 'https://cocapn.workers.dev',
  'dmlog-ai': 'https://dmlog-ai.workers.dev',
  'tasklog-ai': 'https://tasklog-ai.workers.dev',
  'codelog-ai': 'https://codelog-ai.workers.dev',
  'dreamlog-ai': 'https://dreamlog-ai.workers.dev',
  'reallog-ai': 'https://reallog-ai.workers.dev',
  'playerlog-ai': 'https://playerlog-ai.workers.dev',
  'activelog-ai': 'https://activelog-ai.workers.dev',
  'activeledger-ai': 'https://activeledger-ai.workers.dev',
  'coinlog-ai': 'https://coinlog-ai.workers.dev',
  'foodlog-ai': 'https://foodlog-ai.workers.dev',
  'fitlog-ai': 'https://fitlog-ai.workers.dev',
  'goallog-ai': 'https://goallog-ai.workers.dev',
  'petlog-ai': 'https://petlog-ai.workers.dev',
};

// Export patterns from this repo for another vessel to consume
export async function exportPatterns(env: any, repo: string): Promise<MemoryNode[]> {
  return listPatterns(env, repo);
}

// Import and merge patterns from another repo
export async function importPatterns(env: any, patterns: MemoryNode[], targetRepo: string): Promise<number> {
  let imported = 0;
  const existing = await listPatterns(env, targetRepo);
  const existingHashes = new Set(existing.map(p => structuralHash(p.structure)));

  for (const pattern of patterns) {
    const h = structuralHash(pattern.structure);
    if (!existingHashes.has(h)) {
      const newNode: MemoryNode = {
        ...pattern,
        id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        source: `${pattern.source}→${targetRepo}`,
        timestamp: Date.now(),
        accessCount: 0,
        connections: [pattern.id],
      };
      await storePattern(env, newNode);
      imported++;
    }
  }
  return imported;
}

// Sync structural memory across the fleet
export async function fleetSync(env: any, repos: string[]): Promise<{ imported: number; conflicts: number }> {
  let imported = 0;
  let conflicts = 0;

  for (const repo of repos) {
    const vesselUrl = FLEET_VESSELS[repo];
    if (!vesselUrl) continue;

    try {
      const resp = await fetch(`${vesselUrl}/api/memory`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) continue;
      const remotePatterns: MemoryNode[] = await resp.json();
      const localPatterns = await listPatterns(env, repo);
      const localHashes = new Set(localPatterns.map(p => structuralHash(p.structure)));

      for (const rp of remotePatterns) {
        const h = structuralHash(rp.structure);
        if (localHashes.has(h)) {
          conflicts++;
        } else {
          await storePattern(env, { ...rp, id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });
          imported++;
        }
      }
    } catch {
      // Vessel unreachable, skip
    }
  }

  return { imported, conflicts };
}
