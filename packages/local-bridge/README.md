# cocapn-bridge — Local Bridge

The local WebSocket bridge is the heart of Cocapn. It runs on your machine, connects your browser UI to agent subprocesses, and keeps your private Git repo in sync.

## Installation

```bash
npm install -g cocapn-bridge
# or run without installing:
npx cocapn-bridge --repo ~/my-private-repo
```

## Usage

```bash
# Start the bridge
cocapn-bridge --repo ~/private --public ~/public

# With a Cloudflare tunnel (public HTTPS access)
cocapn-bridge --repo ~/private --tunnel

# Disable auth (local dev only)
cocapn-bridge --repo ~/private --no-auth

# Custom port
cocapn-bridge --repo ~/private --port 9000

# Interactive setup wizard
cocapn-bridge init
```

## Sub-commands

### `cocapn-bridge init`

Interactive 7-step onboarding wizard. Creates your public and private GitHub repos, sets up age encryption, and starts the bridge.

### `cocapn-bridge secret`

```bash
cocapn-bridge secret init          # Generate age keypair
cocapn-bridge secret add KEY       # Encrypt and store a secret
cocapn-bridge secret get KEY       # Decrypt and print a secret
cocapn-bridge secret rotate        # Re-encrypt all secrets with a new keypair
```

Secrets are stored as age-encrypted files at `secrets/KEY.age` in your private repo. The identity key is stored in your OS keychain (or `~/.config/cocapn/identity.age` mode 0600 as fallback).

### `cocapn-bridge token`

```bash
cocapn-bridge token set            # Store GitHub PAT in OS keychain
cocapn-bridge token get            # Print the stored token (masked)
cocapn-bridge token verify         # Check scopes against GitHub API
cocapn-bridge token delete         # Remove from keychain
```

### `cocapn-bridge module`

```bash
cocapn-bridge module add <git-url>  # Install a module
cocapn-bridge module remove <name>  # Remove a module
cocapn-bridge module update <name>  # Update to latest
cocapn-bridge module list           # List installed modules
```

## WebSocket API

Connect to `ws://localhost:8787` and send JSON messages:

```jsonc
// Authenticate
{ "type": "AUTH", "token": "<github-pat-or-jwt>" }

// Chat with an agent
{ "type": "CHAT", "id": "req-1", "agentId": "default", "content": "Hello" }

// Execute a shell command
{ "type": "BASH", "id": "req-2", "command": "ls -la" }

// Edit a file
{ "type": "FILE_EDIT", "id": "req-3", "path": "wiki/notes.md", "content": "..." }

// Module RPC
{ "type": "RPC", "id": "req-4", "method": "module/list" }
{ "type": "RPC", "id": "req-5", "method": "module/install", "params": { "gitUrl": "..." } }
```

## Configuration

The bridge reads `cocapn/config.yml` from your private repo:

```yaml
config:
  mode: local          # local | hybrid | cloud
  port: 8787
  allowedOrigins:
    - http://localhost:5173
    - https://you.makerlog.ai

soul:
  path: soul.md        # System prompt for agents

agents:
  defaultAgent: claude-code
```

## Source Layout

```
src/
├── main.ts              # CLI entry point (Commander)
├── bridge.ts            # Top-level orchestrator
├── config/              # Config loader + schema validator
├── git/                 # GitSync (auto-commit/push/pull) + RepoWatcher
├── agents/              # AgentSpawner, AgentRegistry, AgentRouter
├── ws/                  # BridgeServer (WebSocket with auth)
├── modules/             # Module manager + sandbox + hooks
├── security/            # JWT, audit logger, fleet key manager
├── secret-manager.ts    # age encryption + OS keychain
├── CloudAdapter.ts      # Cloudflare Workers integration (optional)
└── cli/                 # init, secret, token, module sub-commands
```

## Development

```bash
cd packages/local-bridge
npm install
npm run build      # tsc
npm test           # vitest
npm run dev        # tsc --watch
```

## Security Model

- **Agent isolation**: subprocesses only inherit `COCAPN_*` + minimal system vars (`PATH`, `HOME`, `TMPDIR`, `TERM`, `LANG`). Host secrets are stripped.
- **Module sandbox**: modules may only write to their own directory plus `wiki/`, `tasks/`, `cocapn/memory/`, `cocapn/agents/`, `skin/`.
- **Audit log**: every agent spawn, bash exec, file edit, secret operation, and auth event is appended to `cocapn/audit.log` as NDJSON with secret values masked.
- **JWT auth**: fleet members authenticate with HMAC-SHA256 JWTs signed by a fleet key stored in `secrets/fleet-key.age`.
