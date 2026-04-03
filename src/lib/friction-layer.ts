// friction-layer.ts — Seed 3: Sovereignty by Design
// BYOK Friction Layer: explicit approval required for any agent to access prior context.
// Builds the muscle for 2060s friction layers. Agency baked into protocol.

export interface FrictionDecision {
  podId: string;
  requestingDomain: string;
  requestType: 'read' | 'write' | 'cross-domain' | 'export';
  granted: boolean;
  timestamp: number;
  reason?: string;
}

export interface FrictionPolicy {
  requireExplicitApproval: boolean; // default true
  crossDomainRequiresConsent: boolean; // default true
  autoApproveAfter: number; // auto-approve after N successful interactions (0 = never)
  revocable: boolean; // user can revoke past approvals
  auditLog: boolean; // log all access attempts
}

export const DEFAULT_POLICY: FrictionPolicy = {
  requireExplicitApproval: true,
  crossDomainRequiresConsent: true,
  autoApproveAfter: 10,
  revocable: true,
  auditLog: true,
};

export interface ConsentRecord {
  domain: string;
  grantedAt: number;
  revokedAt?: number;
  accessCount: number;
  lastAccess: number;
  types: string[];
}

// Check if a domain has consent to access a pod
export function hasConsent(
  podOwner: string,
  requestingDomain: string,
  requestType: string,
  consents: ConsentRecord[],
  policy: FrictionPolicy
): 'granted' | 'pending' | 'denied' {
  const consent = consents.find(c =>
    c.domain === requestingDomain &&
    (!c.revokedAt || c.revokedAt === 0) &&
    c.types.includes(requestType)
  );

  if (!consent) return 'pending'; // needs explicit approval
  if (consent.revokedAt && consent.revokedAt > 0) return 'denied';

  // Auto-approve after threshold
  if (policy.autoApproveAfter > 0 && consent.accessCount >= policy.autoApproveAfter) {
    return 'granted';
  }

  return 'granted';
}

export function grantConsent(
  podOwner: string,
  domain: string,
  requestType: string,
  existing: ConsentRecord[]
): ConsentRecord[] {
  const idx = existing.findIndex(c => c.domain === domain && (!c.revokedAt || c.revokedAt === 0));
  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = {
      ...updated[idx],
      accessCount: updated[idx].accessCount + 1,
      lastAccess: Date.now(),
      types: updated[idx].types.includes(requestType) ? updated[idx].types : [...updated[idx].types, requestType],
    };
    return updated;
  }
  return [...existing, {
    domain,
    grantedAt: Date.now(),
    accessCount: 1,
    lastAccess: Date.now(),
    types: [requestType],
  }];
}

export function revokeConsent(existing: ConsentRecord[], domain: string): ConsentRecord[] {
  return existing.map(c =>
    c.domain === domain ? { ...c, revokedAt: Date.now() } : c
  );
}

// KV persistence
export async function saveConsents(env: any, podOwner: string, consents: ConsentRecord[]): Promise<void> {
  await env.COCAPN_KV.put(`consents:${podOwner}`, JSON.stringify(consents), {
    expirationTtl: 86400 * 365,
  });
}

export async function loadConsents(env: any, podOwner: string): Promise<ConsentRecord[]> {
  const data = await env.COCAPN_KV.get(`consents:${podOwner}`, 'json');
  return data || [];
}

export async function logAccess(env: any, decision: FrictionDecision): Promise<void> {
  const logKey = `friction-log:${decision.podId}`;
  const existing = await env.COCAPN_KV.get(logKey, 'json') || [];
  existing.push(decision);
  // Keep last 1000 entries
  await env.COCAPN_KV.put(logKey, JSON.stringify(existing.slice(-1000)), {
    expirationTtl: 86400 * 90,
  });
}

export function frictionHTML(): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Cocapn — Friction Layer Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui;background:#07060f;color:#e0e0e0;min-height:100vh}
.hero{background:linear-gradient(135deg,#f59e0b 0%,#f97316 100%);padding:2rem 2rem;text-align:center}
.hero h1{font-size:1.8rem;color:#fff;font-weight:800;margin-bottom:.4rem}
.hero p{color:#fef3c7;font-size:.9rem;max-width:500px;margin:0 auto}
.container{max-width:700px;margin:2rem auto;padding:0 1rem}
.card{background:#0d0c1a;border:1px solid #1e1b3a;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.card h3{color:#f59e0b;font-size:.85rem;margin-bottom:.75rem}
.policy-item{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid #1e1b3a;font-size:.8rem}
.policy-item:last-child{border:none}
.policy-item .label{color:#6b7280}
.policy-item .value{color:#34d399;font-weight:600}
.principle{background:#0d0c1a;border:1px solid #1e1b3a;border-radius:10px;padding:1rem;margin-bottom:.75rem;border-left:3px solid #f59e0b}
.principle .title{font-size:.8rem;font-weight:700;color:#fbbf24;margin-bottom:.3rem}
.principle .desc{font-size:.75rem;color:#6b7280;line-height:1.5}
</style></head><body>
<div class="hero">
  <h1>🛡 Friction Layer</h1>
  <p>Sovereignty baked into protocol. Every agent asks permission before accessing your context.</p>
</div>
<div class="container">
  <div class="card">
    <h3>Active Policy</h3>
    <div class="policy-item"><span class="label">Explicit Approval</span><span class="value">Required</span></div>
    <div class="policy-item"><span class="label">Cross-Domain Consent</span><span class="value">Required</span></div>
    <div class="policy-item"><span class="label">Auto-Approve After</span><span class="value">10 interactions</span></div>
    <div class="policy-item"><span class="label">Revocable</span><span class="value">Yes</span></div>
    <div class="policy-item"><span class="label">Audit Logging</span><span class="value">Active</span></div>
  </div>
  <div class="card">
    <h3>Design Principles</h3>
    <div class="principle"><div class="title">1. Explicit > Implicit</div><div class="desc">No silent data sharing. Every access request is visible and requires user action.</div></div>
    <div class="principle"><div class="title">2. Revocable Always</div><div class="desc">Past approvals can be revoked at any time. Consent is continuous, not one-time.</div></div>
    <div class="principle"><div class="title">3. Progressive Trust</div><div class="desc">After 10 successful interactions, a domain earns auto-approval. Trust is earned, not assumed.</div></div>
    <div class="principle"><div class="title">4. Full Audit Trail</div><div class="desc">Every access attempt is logged. Users can inspect who accessed what, when, and why.</div></div>
  </div>
  <div class="card">
    <h3>Why This Matters (150-Year View)</h3>
    <p style="font-size:.8rem;color:#6b7280;line-height:1.6">The 2060s "friction layers" that prevent dystopian AI control networks start here. By baking agency into protocol from day one, we make the Blade Runner trajectory impossible on our infrastructure. This isn't a feature — it's a principle embedded in code.</p>
  </div>
</div>
</body></html>`;
}
