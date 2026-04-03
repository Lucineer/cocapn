// context-pod.ts — Seed 2: User-Owned Data Vaults
// Personal context pods as KV-backed data vaults. User owns their data.
// Foundation for data dividends and Right to Be Augmented.

export interface ContextPod {
  id: string;
  owner: string; // hash of user identifier
  created: number;
  lastAccessed: number;
  entries: PodEntry[];
  preferences: PodPreferences;
  version: number;
}

export interface PodEntry {
  id: string;
  timestamp: number;
  domain: string; // which vessel created this
  type: 'interaction' | 'preference' | 'insight' | 'pattern' | 'export';
  content: string;
  confidence: number;
  shared: boolean; // whether user opted to share back with fleet
}

export interface PodPreferences {
  allowFleetLearning: boolean; // opt-in to share patterns back
  allowCrossDomain: boolean; // allow pods to be queried across vessels
  dataRetentionDays: number;
  exportFormat: 'json' | 'markdown';
}

export const DEFAULT_PREFERENCES: PodPreferences = {
  allowFleetLearning: false,
  allowCrossDomain: false,
  dataRetentionDays: 365,
  exportFormat: 'json',
};

function generatePodId(owner: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `pod:${owner.slice(0, 8)}:${ts}:${rand}`;
}

export function createPod(owner: string, prefs?: Partial<PodPreferences>): ContextPod {
  return {
    id: generatePodId(owner),
    owner,
    created: Date.now(),
    lastAccessed: Date.now(),
    entries: [],
    preferences: { ...DEFAULT_PREFERENCES, ...prefs },
    version: 1,
  };
}

export function addEntry(pod: ContextPod, entry: Omit<PodEntry, 'id' | 'timestamp'>): ContextPod {
  const newEntry: PodEntry = {
    ...entry,
    id: `e:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  return {
    ...pod,
    entries: [...pod.entries.slice(-99), newEntry], // keep last 100 entries
    lastAccessed: Date.now(),
    version: pod.version + 1,
  };
}

export function getEntriesByDomain(pod: ContextPod, domain: string): PodEntry[] {
  return pod.entries.filter(e => e.domain === domain);
}

export function getSharedEntries(pod: ContextPod): PodEntry[] {
  return pod.entries.filter(e => e.shared);
}

export function exportPod(pod: ContextPod): string {
  if (pod.preferences.exportFormat === 'markdown') {
    const lines = [`# Context Pod: ${pod.id}`, `Created: ${new Date(pod.created).toISOString()}`, `Entries: ${pod.entries.length}`, '', '## Entries', ''];
    pod.entries.forEach(e => {
      lines.push(`### [${e.type}] ${new Date(e.timestamp).toISOString()}`);
      lines.push(`Domain: ${e.domain} | Confidence: ${(e.confidence * 100).toFixed(0)}% | Shared: ${e.shared}`);
      lines.push(e.content);
      lines.push('');
    });
    return lines.join('\n');
  }
  return JSON.stringify(pod, null, 2);
}

// KV persistence helpers
export async function savePod(env: any, pod: ContextPod): Promise<void> {
  await env.COCAPN_KV.put(`pod:${pod.id}`, JSON.stringify(pod), {
    expirationTtl: pod.preferences.dataRetentionDays * 86400,
  });
}

export async function loadPod(env: any, podId: string): Promise<ContextPod | null> {
  const data = await env.COCAPN_KV.get(`pod:${podId}`);
  return data ? JSON.parse(data) : null;
}

export async function listPods(env: any, owner: string): Promise<string[]> {
  const data = await env.COCAPN_KV.get(`pods:${owner}`, 'json');
  return data || [];
}

export async function registerPod(env: any, pod: ContextPod): Promise<void> {
  const pods = await listPods(env, pod.owner);
  if (!pods.includes(pod.id)) {
    pods.push(pod.id);
    await env.COCAPN_KV.put(`pods:${pod.owner}`, JSON.stringify(pods));
  }
}
