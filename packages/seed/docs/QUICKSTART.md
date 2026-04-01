# Zero to Agent in 60 Seconds

## The Fastest Path

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Lucineer/cocapn/main/packages/seed/scripts/quickstart.sh) my-agent
export DEEPSEEK_API_KEY=your-key
cd my-agent && npx cocapn
```

That's it. You have a living agent with memory, personality, and a web UI.

## One-Liner with npx

```bash
npx cocapn-init my-agent
```

Walks you through setup interactively.

## Step by Step

### 1. Fork or create
```bash
bash scripts/quickstart.sh my-agent
cd my-agent
```

### 2. Add an API key
```bash
export DEEPSEEK_API_KEY=your-key     # DeepSeek (cheap, fast)
# or
export OPENAI_API_KEY=your-key       # OpenAI
# or install Ollama for fully local — no key needed
```

### 3. Talk to your agent
```bash
npx cocapn            # CLI chat
npx cocapn --web      # Web UI at http://localhost:3100
```

### First Conversation

```
you> Hi, who are you?
my-agent> I'm MyAgent! I live in this repository. I learn from the code
          changes you make and remember our conversations. What are we
          working on today?

you> Can you remember that I prefer TypeScript?
my-agent> Got it! I'll remember that you prefer TypeScript. Stored as a fact.

you> What do you know about me?
my-agent> You prefer TypeScript. That's all I know so far — tell me more!
```

Every fact, preference, and conversation is stored in Git. Restart tomorrow, it remembers.

## Customization

### Personality — `cocapn/soul.md`
```markdown
---
name: ShipBot
tone: concise
---

I am ShipBot. I help ship features fast.
I write tests, I don't break main, and I keep PRs small.
```

Edit this file, change who the agent is. It's version-controlled personality.

### Config — `cocapn/cocapn.json`
```json
{
  "name": "shipbot",
  "model": "deepseek",
  "tone": "concise",
  "port": 3100,
  "channels": ["cli", "web"]
}
```

Model options: `deepseek`, `openai`, `anthropic`, `local` (Ollama).

## Adding Channels

### Telegram
1. Message [@BotFather](https://t.me/BotFather) to get a token
2. Set the webhook: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/api/telegram/webhook"`
3. Add to `cocapn.json`: `"telegramToken": "YOUR_TOKEN"`

### Discord
1. Create a bot at [discord.com/developers](https://discord.com/developers/applications)
2. Add webhook URL to your server settings
3. Point the webhook to `https://your-domain/api/webhook/discord`

## Going to Production

### Cloudflare Workers
```bash
cocapn deploy --env production
```

Deploys your public repo to Workers. Brain stays local. Public chat hits Workers, private chat stays on your machine.

### Docker
```bash
docker compose up --build
```

Self-contained. Memory is Git-backed inside the container. Mount a volume for persistence.

### Air-Gapped
```bash
AIR_GAPPED=1 cocapn start --llm local
```

Requires [Ollama](https://ollama.com). No internet, no API keys, fully local.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` | Agent not running — `npx cocapn` first |
| `DEEPSEEK_API_KEY not set` | `export DEEPSEEK_API_KEY=your-key` |
| Port 3100 in use | `npx cocapn --port 3101` or change in `cocapn.json` |
| Memory not persisting | Ensure `git init` ran in your project directory |
| `node: not found` | Install Node.js 18+ from [nodejs.org](https://nodejs.org) |
| Slow responses | Switch model in `cocapn.json` — `deepseek` is fastest |

## What's Next?

- Read [SOUL-GUIDE.md](SOUL-GUIDE.md) to craft your agent's personality
- Read [API.md](API.md) for the full HTTP API reference
- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand how it works
- Browse [EXAMPLES.md](EXAMPLES.md) for real-world agent setups
