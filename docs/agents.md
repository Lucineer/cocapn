# Writing Custom Agents

Agents are the workers of Cocapn. An agent is any CLI program that reads from stdin and writes to stdout — Claude Code, Pi, a custom Node.js script, or a shell one-liner. The bridge spawns them, streams their output, and tears them down.

## Defining an agent

Create a YAML file in `cocapn/agents/` of your private repo:

```yaml
# cocapn/agents/researcher.agent.yml
id: researcher
name: Deep Researcher
description: Searches the web and populates wiki/ overnight
type: local              # local | cloud
command: claude          # executable name
args: []                 # extra CLI args prepended to every invocation
model: claude-sonnet-4-6 # passed as --model if the CLI supports it

# Environment variables injected at spawn time (values from secrets/)
env:
  PERPLEXITY_API_KEY: "secret:PERPLEXITY_API_KEY"  # decrypted from secrets/PERPLEXITY_API_KEY.age

# MCP server configuration (optional)
mcp:
  servers:
    - name: perplexity
      command: node
      args: ["modules/perplexity-search/server.js"]

# Soul override — appended to the base soul.md for this agent only
soulAppend: |
  You are focused exclusively on research. When asked to research a topic:
  1. Search Perplexity for recent sources
  2. Write a structured summary to wiki/research/<topic>.md
  3. List your sources at the bottom
```

## Agent types

### `local` — CLI subprocess

Spawns `command` as a child process. The soul is passed as `COCAPN_SOUL`. Conversation history is passed on stdin as a JSON array of `{role, content}` messages.

```yaml
type: local
command: claude
```

Supported CLI agents out of the box:
- `claude` (Claude Code)
- `pi` (Pi agent)
- Any MCP-compatible stdio server

### `cloud` — Cloudflare Worker

Routes the message to a Cloudflare Worker URL defined in `cocapn/cocapn-cloud.yml`. Requires the cloud tier to be configured.

```yaml
type: cloud
# workerUrl is read from cocapn-cloud.yml, matched by id
```

## Environment sandboxing

Agent subprocesses receive only:

| Variable | Source |
|---|---|
| `COCAPN_SOUL` | Contents of `cocapn/soul.md` (+ agent `soulAppend`) |
| `COCAPN_REPO_ROOT` | Absolute path to the private repo |
| `COCAPN_AGENT_ID` | The agent's `id` field |
| `COCAPN_VERSION` | Bridge version (`0.1.0`) |
| `SECRET_*` | Decrypted secrets listed in `env:` |
| `PATH`, `HOME`, `TMPDIR`, `TERM`, `LANG`, `TZ` | Minimal system vars |

All other host environment variables — especially `AWS_*`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, and any `*_SECRET*` / `*_KEY*` vars — are **stripped**. Agents cannot access your host credentials.

## Writing a TypeScript agent

Any Node.js script that reads stdin and writes stdout works:

```typescript
#!/usr/bin/env node
// agents/my-agent.ts  (compiled to agents/my-agent.js)

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

const soul   = process.env["COCAPN_SOUL"] ?? "";
const repo   = process.env["COCAPN_REPO_ROOT"] ?? ".";
const rl     = readline.createInterface({ input: process.stdin });

// Read conversation from stdin (JSON array sent by bridge)
let raw = "";
rl.on("line", (line) => { raw += line; });
rl.on("close", async () => {
  const messages: Array<{ role: string; content: string }> = JSON.parse(raw || "[]");
  const last = messages.at(-1)?.content ?? "";

  // Do something useful
  const response = `You said: ${last}. Soul length: ${soul.length} chars.`;

  // Write the wiki file (allowed write path)
  const wikiPath = path.join(repo, "wiki", "last-response.md");
  fs.writeFileSync(wikiPath, `# Last Response\n\n${response}\n`);

  // Output the response — bridge streams this to the browser
  process.stdout.write(response);
});
```

Register it:

```yaml
# cocapn/agents/my-agent.agent.yml
id: my-agent
name: My Agent
type: local
command: node
args: ["agents/my-agent.js"]
```

## MCP tool agents

Use the `mcp` key to attach MCP servers. The bridge passes them to Claude via `--mcp-config`:

```yaml
id: habit-agent
name: Habit Tracker
type: local
command: claude
mcp:
  servers:
    - name: habit-tracker
      command: node
      args: ["modules/habit-tracker/agent.js"]
```

The MCP server must implement the Model Context Protocol stdio transport. See `modules/habit-tracker/agent.js` for a reference implementation using `@modelcontextprotocol/sdk`.

## Agent routing

The bridge routes messages to agents using the `AgentRouter`. By default, all messages go to the `defaultAgent`. Configure routing in `cocapn/config.yml`:

```yaml
agents:
  defaultAgent: claude
  routing:
    strategy: first-match
    rules:
      - match: { contentContains: "research" }
        agent: researcher
      - match: { contentContains: "habit" }
        agent: habit-agent
```

Or send a message to a specific agent from the browser:

```json
{ "type": "CHAT", "agentId": "researcher", "content": "Research quantum computing" }
```

## Installing agents via modules

The easiest way to add an agent is via the module system:

```bash
cocapn-bridge module add https://github.com/cocapn/habit-tracker
# or from chat: "install habit-tracker"
```

Module agents are installed to `cocapn/agents/<name>.agent.yml` automatically.

## Testing agents locally

```bash
# Pipe a message directly to test outside the bridge
echo '[{"role":"user","content":"Hello"}]' | \
  COCAPN_SOUL="You are helpful." \
  COCAPN_REPO_ROOT="$(pwd)" \
  node agents/my-agent.js
```
