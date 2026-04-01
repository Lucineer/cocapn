#!/bin/bash
set -e
BOLD='\033[1m'; CYAN='\033[36m'; GREEN='\033[32m'; RESET='\033[0m'

# ─── Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then echo "Node.js required: https://nodejs.org"; exit 1; fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then echo "Node.js 18+ required (found $(node -v))"; exit 1; fi

# ─── Create directory ───────────────────────────────────────────────────────
DIR="${1:-my-agent}"
mkdir -p "$DIR" && cd "$DIR"

# ─── Init git ───────────────────────────────────────────────────────────────
git init -q
git config user.email "agent@cocapn.dev" 2>/dev/null || true
git config user.name "Agent" 2>/dev/null || true

# ─── cocapn.json ────────────────────────────────────────────────────────────
mkdir -p cocapn
cat > cocapn/cocapn.json << 'CONF'
{
  "name": "my-agent",
  "model": "deepseek",
  "tone": "friendly",
  "port": 3100,
  "channels": ["cli", "web"]
}
CONF

# ─── soul.md ────────────────────────────────────────────────────────────────
cat > cocapn/soul.md << 'SOUL'
---
name: MyAgent
tone: friendly
---

I am MyAgent, a cocapn agent. I live inside this repository.
I remember conversations, learn from code changes, and grow over time.
Edit this file to change who I am.
SOUL

# ─── README.md ──────────────────────────────────────────────────────────────
cat > README.md << 'README'
# My Agent

A living repository powered by [cocapn](https://github.com/Lucineer/cocapn).

## Quick Start
```bash
export DEEPSEEK_API_KEY=your-key   # or OPENAI_API_KEY
npx cocapn                         # start chatting
```

## Customize
- `cocapn/soul.md` — personality and identity
- `cocapn/cocapn.json` — model, tone, channels
README

# ─── Install cocapn ─────────────────────────────────────────────────────────
npm init -y --silent > /dev/null 2>&1
npm install cocapn --silent 2>/dev/null || echo "  (npm install skipped — run manually)"

# ─── Commit ─────────────────────────────────────────────────────────────────
git add -A && git commit -q -m "init: cocapn agent"

echo ''
echo -e "${GREEN}${BOLD}Your agent is alive!${RESET}"
echo ''
echo -e "  ${CYAN}cd $DIR${RESET}"
echo -e "  ${CYAN}export DEEPSEEK_API_KEY=your-key${RESET}   # or OPENAI_API_KEY"
echo -e "  ${CYAN}npx cocapn${RESET}                         # start chatting"
echo -e "  ${CYAN}npx cocapn --web${RESET}                   # web UI at http://localhost:3100"
echo ''
