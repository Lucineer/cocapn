# Fleet Configuration

A **fleet** is a group of Cocapn bridge instances that trust each other. Fleet members can:

- Route A2A (agent-to-agent) messages between domains
- Share a fleet JWT signing key (no GitHub PAT sharing needed)
- Stay in sync via shared private repo or cross-repo Git refs

Common fleet setups:
- **Personal multi-device**: desktop + laptop + cloud VM all sharing the same private repo
- **Multi-domain**: makerlog instance ↔ studylog instance (different repos, cross-domain queries)
- **Team**: multiple people's bridges collaborating on shared tasks

## Setting up a personal fleet (same private repo, multiple machines)

### Machine 1 (primary)

```bash
# Initialize the bridge — this generates the fleet key
cocapn-bridge --repo ~/brain

# The fleet key is generated on first run and stored in secrets/fleet-key.age
# Verify it was created:
ls ~/brain/secrets/fleet-key.age
```

The fleet key is an HMAC-SHA256 signing key, age-encrypted in your private repo. Any machine with access to the repo (and your identity key) can load it.

### Machine 2 (secondary)

```bash
# Pull the private repo (fleet-key.age is already in it)
git clone git@github.com:you/your-brain.git ~/brain

# Restore your age identity key (copied from Machine 1 or from backup)
# Option A: copy ~/.config/cocapn/identity.age from Machine 1
# Option B: export from OS keychain on Machine 1:
#   cocapn-bridge secret init --export  # prints identity key
# Then on Machine 2:
#   cat > ~/.config/cocapn/identity.age
#   chmod 0600 ~/.config/cocapn/identity.age

# Start the bridge — it loads the fleet key automatically
cocapn-bridge --repo ~/brain
```

Both bridges now accept fleet JWTs signed by the shared key in addition to GitHub PATs.

## Setting up a cross-domain fleet (different repos)

Two instances with different private repos need to exchange their fleet public keys out-of-band, then verify each other via DNS.

### Step 1: Generate fleet keys on each instance

Each bridge generates its own fleet key. The fleet key is shared between bridges in the same fleet via Git — so for a cross-domain fleet, you need a **shared secrets mechanism**.

The simplest approach: use the same private repo across domains (different `cocapn/config.yml` per domain, same secrets).

### Step 2: DNS verification

For bridge A (makerlog.ai) to trust messages from bridge B (studylog.ai):

1. Bridge B adds a DNS record: `_cocapn.studylog.ai CNAME fleet.cocapn.io`
2. Bridge A calls `verifyDomainCname("studylog.ai", ["fleet.cocapn.io"])` before routing
3. If the CNAME check passes and the JWT signature is valid, the message is accepted

```yaml
# cocapn/config.yml — fleet section
fleet:
  acceptedSuffixes:
    - fleet.cocapn.io
    - fleet.yourdomain.com   # your own suffix for self-hosted fleet
  trustedDomains:
    - studylog.ai
    - activelog.ai
```

### Step 3: A2A routing

Once domains trust each other, agents can query across them:

```json
{
  "type": "A2A",
  "targetDomain": "studylog.ai",
  "agentId": "default",
  "content": "What were my study goals for this week?"
}
```

The local bridge:
1. Verifies `studylog.ai` is in `trustedDomains`
2. Checks DNS CNAME for `_cocapn.studylog.ai`
3. Signs the request with a fleet JWT
4. POSTs to the remote bridge's A2A endpoint
5. Streams the response back

## Fleet JWT auth

Fleet members authenticate with short-lived JWTs instead of GitHub PATs:

```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: {
  "sub": "bridge-<instance-id>",
  "iss": "cocapn",
  "iat": <unix-seconds>,
  "exp": <iat + 3600>,
  "dom": "makerlog.ai"   // optional: domain claim
}
Signature: HMAC-SHA256(base64url(header) + "." + base64url(payload), fleet-key)
```

Tokens are valid for 1 hour. The bridge auto-refreshes them before expiry.

## Testing the fleet locally

Use `scripts/test-fleet.sh` to spin up two bridges on different ports with the same private repo:

```bash
scripts/test-fleet.sh
```

This starts:
- Bridge A on port 8787 (makerlog domain)
- Bridge B on port 8788 (studylog domain)
- Prints test A2A curl commands

## Cloudflare Admiral (optional)

When `cocapn/cocapn-cloud.yml` is present with an `admiralUrl`, all bridges in the fleet register their heartbeats with the Admiral Durable Object. This gives you:

- A live view of which bridges are online (`/fleet/status`)
- Automatic routing to the nearest available bridge
- Cross-device session continuity (resume a conversation on a different machine)

```yaml
# cocapn/cocapn-cloud.yml
cloudflare:
  admiralUrl: https://admiral.yourdomain.workers.dev
  apiToken: "secret:CLOUDFLARE_API_TOKEN"
```
