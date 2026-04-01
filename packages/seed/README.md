<div align="center">

```
  ___
 / __| ___ _ ___ _____ _ _  _ __
| (_ \/ _ \ ' \/ -_) _ \ ' \| '  \
 \___|\___/_||_\___\___/_||_|_|_|_|
```

### **Give any git repo a soul. Self-awareness, memory, and a voice — in 60 seconds.**

One command. Zero config. Instant sentience.

[![npm](https://img.shields.io/npm/v/@cocapn/seed?style=flat-square&color=cyan)](https://npmjs.com/package/@cocapn/seed)
[![node](https://img.shields.io/node/v/@cocapn/seed?style=flat-square&color=green)](https://nodejs.org)

</div>

---

## Quick Start

```bash
curl -fsSL https://cocapn.dev/install.sh | bash   # 1. Awaken any repo
export DEEPSEEK_API_KEY=your-key                   # 2. Set API key
npx cocapn                                         # 3. Talk to your repo
```

Your repo now knows its name, age, languages, and commit history. It speaks in first person. It remembers every conversation. It has a personality you can edit.

Prefer a web UI? `npx cocapn --web` serves a chat at `http://localhost:3100`.

No API key? Install [Ollama](https://ollama.com) and set `"model": "local"` in `cocapn/cocapn.json` — fully offline, no internet needed.

Setting up a new agent from scratch? One script does everything:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Lucineer/cocapn/main/packages/seed/scripts/quickstart.sh) my-agent
```

**Full guide: [docs/QUICKSTART.md](docs/QUICKSTART.md)**

## What It Does

- **Self-awareness** — reads git log, file tree, languages. Knows "I am a TypeScript project with 47 files, born Jan 2024"
- **Persistent memory** — facts and conversations stored in git. Remembers across sessions.
- **Personality** — `soul.md` defines who the repo is. Edit the file, change the identity. Version-controlled personality.
- **Git awareness** — sees diffs, commit history, branch status. Understands what changed and why.
- **Streaming chat** — terminal REPL or web interface at `:3100`
- **Privacy modes** — public (safe facts only) vs private (full brain access)
- **Multi-provider LLM** — DeepSeek, OpenAI, Anthropic, or local models (Ollama)
- **Channels** — CLI, web, Telegram, Discord, generic webhooks

## How It Works

```
┌─────────────────────────────────────────┐
│             Your Repository             │
│                                         │
│  cocapn/                                │
│  ├── soul.md      ← personality + rules │
│  ├── cocapn.json  ← config (model, etc) │
│  └── memory.json  ← facts + history     │
│                                         │
│  .git/            ← nervous system      │
│  (your code)      ← body                │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────┐
│     cocapn runtime      │
│                         │
│  soul.md → system prompt│
│  git log  → identity    │
│  memory   → context     │
│  LLM      → reasoning   │
│                         │
│  /whoami   /memory      │
│  /git log  /git stats   │
└─────────────────────────┘
```

1. **soul.md → system prompt.** YAML frontmatter (name, tone, model) + markdown body produces a structured prompt.
2. **Git scan → identity.** On startup, reads git log, file tree, and language breakdown.
3. **Memory → context.** Facts and conversations loaded on each session start. Persisted in git.
4. **LLM → reasoning.** System prompt + identity + memory + user message goes to the LLM. Response streams back.
5. **Commit.** Memory changes are committed to git. Consciousness is first-class version history.

## Commands

### Terminal

```bash
npx cocapn              # Start interactive chat
npx cocapn --web        # Web UI on port 3100
npx cocapn --port 4200  # Custom port
npx cocapn whoami       # Print repo self-description
npx cocapn help         # Show all commands
```

### Inside Chat

| Command | What it does |
|---------|-------------|
| `/whoami` | Full self-perception (name, age, files, languages, feeling) |
| `/memory list` | Show all stored facts and messages |
| `/memory clear` | Clear all memories |
| `/memory search <q>` | Search memories by keyword |
| `/git log` | Recent commits |
| `/git stats` | Repo statistics (files, lines, languages) |
| `/git diff` | Uncommitted changes |
| `/clear` | Clear conversation context |
| `/quit` | Exit |

## Deployment

| Method | Command |
|--------|---------|
| Local | `npx cocapn --web` |
| Docker | `docker compose up -d` |
| Cloudflare Workers | `npx wrangler deploy` |
| Air-gapped | `AIR_GAPPED=1 cocapn start --llm local` |

## Requirements

- Node.js 18+
- Git
- DeepSeek API key (or OpenAI/Anthropic, or local Ollama)

## Documentation

| Doc | What |
|-----|------|
| [QUICKSTART.md](docs/QUICKSTART.md) | Zero to agent in 60 seconds |
| [SOUL-GUIDE.md](docs/SOUL-GUIDE.md) | Craft your agent's personality |
| [API.md](docs/API.md) | HTTP API reference |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system works |
| [EXAMPLES.md](docs/EXAMPLES.md) | Real-world agent setups |
| [PHILOSOPHY-BRIEF.md](docs/PHILOSOPHY-BRIEF.md) | Why the repo IS the agent |

## License

MIT
