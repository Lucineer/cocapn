# {{username}}-brain — Cocapn Private Repo

> Your data is in Git. You own it completely.

This is your **private encrypted brain** — the repository that stores everything personal to your Cocapn instance: agent memories, secrets, tasks, wiki notes, and soul configuration.

**Keep this repo private.** Never make it public. The secrets are age-encrypted, but defense in depth means keeping the repo private as well.

## Structure

```
.
├── cocapn/
│   ├── config.yml          # Bridge configuration (port, sync, auth)
│   ├── soul.md             # Your system prompt — the agent's personality
│   ├── age-recipients.txt  # age public key (safe to commit)
│   ├── agents/             # Custom agent definitions (.agent.yml)
│   ├── memory/             # Agent long-term memory (Markdown files)
│   └── modules.json        # Installed modules registry
├── secrets/
│   └── *.age               # Encrypted secrets (safe to commit, needs identity key)
├── wiki/                   # Your personal wiki (Markdown)
├── tasks/                  # Tasks and kanban boards (JSON/Markdown)
└── skin/                   # Custom CSS skin overrides
```

## Starting the bridge

```bash
npx cocapn-bridge --repo .
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--port <n>` | `8787` | WebSocket listen port |
| `--public <path>` | same as `--repo` | Path to your public repo |
| `--tunnel` | off | Expose via Cloudflare Tunnel |
| `--no-auth` | off | Disable GitHub PAT auth (local-only) |

## soul.md — Your Agent's Personality

The `cocapn/soul.md` file is the system prompt injected into every agent conversation. It defines how agents talk to you, what they know about your context, and what they should prioritize.

```markdown
# My Soul

I'm a senior full-stack developer working on SaaS products. I prefer TypeScript and Cloudflare Workers.

## How I think
- I value correctness over speed
- I prefer explicit over implicit

## My context
- Currently building: [project name]
- My stack: Next.js 14, Drizzle, Cloudflare D1
```

## Security Best Practices

### What is safe to commit

- `cocapn/age-recipients.txt` — public key only, no private material
- `secrets/*.age` — age-encrypted blobs, unreadable without your identity key
- `cocapn/config.yml` — no secrets in config; use `cocapn-bridge secret add` instead
- Everything in `wiki/`, `tasks/`, `skin/` — plain Markdown and JSON

### What is NEVER committed

- Your age identity key (`AGE-SECRET-KEY-1…`) — stored in OS keychain or `~/.config/cocapn/identity.age` (mode 0600, outside this repo)
- Plaintext API keys — always use `cocapn-bridge secret add` to encrypt them first
- GitHub PATs — stored in OS keychain via `cocapn-bridge token set`

### If you suspect a secret was committed in plaintext

1. **Revoke the secret immediately** (GitHub token settings, API provider dashboard)
2. Run `git log --all -S "the-secret-value"` to find the commit
3. Use `git filter-repo` to scrub the history and force-push
4. Generate a new secret: `cocapn-bridge secret add KEY`

## Managing Secrets

```bash
# Initialize encryption (first time — generates age keypair)
cocapn-bridge secret init

# Add a secret (prompts for value, never echoed to terminal)
cocapn-bridge secret add ANTHROPIC_API_KEY

# Retrieve a secret (for debugging)
cocapn-bridge secret get ANTHROPIC_API_KEY

# Rotate all secrets with a new keypair
cocapn-bridge secret rotate
```

## Cloning on a New Machine

```bash
git clone git@github.com:{{username}}/{{username}}-brain.git
cd {{username}}-brain

# Option A: Restore your identity key from backup (recommended)
# Copy your backed-up identity key to ~/.config/cocapn/identity.age
# then run:
cocapn-bridge secret init --import ~/.config/cocapn/identity.age

# Option B: Generate a new key and re-encrypt all secrets
cocapn-bridge secret init   # new key
cocapn-bridge secret rotate  # re-encrypt everything

# Start the bridge
cocapn-bridge --repo . --public ../{{username}}-log
```

**Back up your age identity key** to a password manager. Without it, you cannot decrypt your secrets on a new machine.

## Sync Configuration

The bridge pulls from `origin` every 30 seconds and auto-commits local changes. Configure in `cocapn/config.yml`:

```yaml
sync:
  interval: 30
  memoryInterval: 60
  autoCommit: true
  autoPush: true
```
