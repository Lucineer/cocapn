# Cocapn Seed — API Reference

> Every exported function, class, and interface for developers extending the seed.

---

## soul.ts — Personality Engine

### Types

```typescript
interface Soul {
  name: string;    // Agent name (from frontmatter or directory name)
  tone: string;    // Personality tone (neutral, warm, technical, etc.)
  model: string;   // Preferred LLM provider hint
  body: string;    // Freeform personality prompt (Markdown)
}
```

### `loadSoul(soulPath: string): Soul`

Parse a `soul.md` file with YAML frontmatter into a `Soul` object.

```typescript
import { loadSoul } from './soul.js';

const soul = loadSoul('./soul.md');
// { name: 'Forge', tone: 'technical', model: 'deepseek', body: '# I Am Forge\n...' }
```

**Parameters:**
- `soulPath` — Absolute or relative path to a `soul.md` file

**Returns:** `Soul` — defaults to `name: 'unnamed'`, `tone: 'neutral'`, `model: 'deepseek'` if frontmatter is missing.

**Behavior:**
- Parses YAML frontmatter between `---` delimiters
- Each frontmatter line is split on the first `:` — `key: value`
- Body is everything after the closing `---`, trimmed
- Reads synchronously via `readFileSync`

---

### `soulToSystemPrompt(soul: Soul): string`

Convert a `Soul` to a basic system prompt string.

```typescript
import { soulToSystemPrompt } from './soul.js';

const prompt = soulToSystemPrompt(soul);
// "You are Forge. Your tone is technical.\n\n# I Am Forge\n..."
```

**Returns:** A string starting with `"You are {name}. Your tone is {tone}."` followed by the soul body.

---

### `buildFullSystemPrompt(soul, awarenessNarration, formattedFacts, reflectionSummary?): string`

Build an enhanced system prompt combining all context sources.

```typescript
import { buildFullSystemPrompt } from './soul.js';

const prompt = buildFullSystemPrompt(soul, narration, facts, reflection);
// Sections: personality, "## Who I Am", "## What I Remember", "## Recent Reflection"
```

**Parameters:**
- `soul: Soul` — Agent personality
- `awarenessNarration: string` — First-person narrative from `awareness.narrate()`
- `formattedFacts: string` — Formatted facts from `memory.formatFacts()`
- `reflectionSummary?: string` — Optional reflection summary

**Returns:** Combined prompt with `## Who I Am`, `## What I Remember`, and optionally `## Recent Reflection` sections.

---

## memory.ts — Two-Tier Memory

### Types

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;  // ISO 8601 timestamp
}

interface MemoryStore {
  messages: Message[];
  facts: Record<string, string>;
}
```

### `class Memory`

```typescript
const memory = new Memory('/path/to/repo');
```

**Constructor:** `new Memory(repoDir: string)`
- Creates `.cocapn/` directory if it doesn't exist
- Loads `.cocapn/memory.json` or starts fresh
- Handles corrupted JSON gracefully (starts empty)

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `Message[]` | All stored messages (max 100) |
| `facts` | `Record<string, string>` | Key-value fact store |

#### Methods

#### `recent(n?: number): Message[]`

Get last N messages for LLM context.

```typescript
const recent = memory.recent(20);  // default: 20
```

#### `addMessage(role, content): void`

Add a message and persist to disk. Auto-trims to 100 messages.

```typescript
memory.addMessage('user', 'Hello');
memory.addMessage('assistant', 'Hi there!');
```

**Parameters:**
- `role: 'user' | 'assistant' | 'system'`
- `content: string`

**Behavior:**
- Appends message with current ISO timestamp
- If messages exceed 100, trims to last 100
- Writes to `.cocapn/memory.json` immediately

#### `formatContext(n?: number): string`

Format recent messages as LLM-readable context.

```typescript
const ctx = memory.formatContext(20);
// "Human: Hello\n\nAssistant: Hi there!"
```

**Returns:** String with `Human:` and `Assistant:` prefixes, double-newline separated. Empty string if no messages.

#### `formatFacts(): string`

Format facts as LLM-readable context.

```typescript
const facts = memory.formatFacts();
// "Known facts:\n- user.name: Alice\n- user.location: Portland"
```

**Returns:** `"Known facts:\n"` followed by `- key: value` lines. Empty string if no facts.

#### `clear(): void`

Clear all messages and facts, persist immediately.

```typescript
memory.clear();
```

#### `search(query: string): { messages, facts, gitLog }`

Search across hot (JSON) and cold (git) memory tiers.

```typescript
const results = memory.search('svelte');
// {
//   messages: [...],   // messages containing 'svelte'
//   facts: [...],      // facts whose value contains 'svelte'
//   gitLog: [...]      // git log --grep='svelte' results
// }
```

**Parameters:**
- `query: string` — Case-insensitive keyword search

**Returns:**
```typescript
{
  messages: Message[];
  facts: Array<{ key: string; value: string }>;
  gitLog: string[];
}
```

#### `searchGit(query: string): string[]`

Search git log for a keyword (cold tier only).

```typescript
const commits = memory.searchGit('auth');
// ["a3f21 Fix auth middleware", "7b1c Add rate limiting"]
```

**Returns:** Up to 20 matching commit subjects. Empty array on error.

---

## git.ts — Git Awareness

### Types

```typescript
interface GitSelf {
  born: string;        // First commit date (ISO)
  commits: number;     // Total commit count
  files: number;       // Tracked file count
  lines: number;       // Total line count
  recent: Array<{ date: string; msg: string }>;
  authors: string[];   // Contributor names
  pulse: 'active' | 'resting' | 'dormant';  // Activity level
}
```

### `perceive(dir: string): GitSelf`

Gather structured git statistics.

```typescript
import { perceive } from './git.js';

const self = perceive('/path/to/repo');
// { born: '2024-01-15 10:30:00 +0000', commits: 152, files: 47, ... }
```

**Pulse logic:** active (< 1 day since last commit), resting (< 30 days), dormant (> 30 days).

### `narrate(dir: string): string`

Render git self as first-person narrative.

```typescript
import { narrate } from './git.js';

const story = narrate('/path/to/repo');
// "I was born 2024-01-15. I have 152 memories, 47 files, 12400 lines..."
```

### `log(dir: string, count?: number): Array<{hash, date, author, msg}>`

Get recent commit history.

```typescript
import { log } from './git.js';

const commits = log('/path/to/repo', 10);  // default: 10
// [{ hash: 'e7f3a', date: '2024-03-15', author: 'Alice', msg: 'Fix auth' }, ...]
```

### `stats(dir: string): {files, lines, languages}`

Get file counts and language breakdown.

```typescript
import { stats } from './git.js';

const s = stats('/path/to/repo');
// { files: 47, lines: 12400, languages: { TypeScript: 23, Python: 12, Markdown: 8 } }
```

**Language detection:** by file extension mapping (`.ts` → TypeScript, `.py` → Python, etc.)

### `diff(dir: string): string`

Get uncommitted changes summary.

```typescript
import { diff } from './git.js';

const changes = diff('/path/to/repo');
// "src/auth.ts | 5 +++--\n1 file changed, 3 insertions(+), 2 deletions(-)"
// or "No uncommitted changes."
```

---

## awareness.ts — Self-Perception

### Types

```typescript
interface SelfDescription {
  name: string;
  born: string;
  age: string;           // e.g. "3 months", "1 year 2 months"
  commits: number;
  files: number;
  languages: string[];   // up to 5 detected languages
  description: string;   // from package.json "description"
  lastCommit: string;    // e.g. "My last memory was 2 hours ago."
  branch: string;
  authors: string[];     // up to 5 git authors
  recentActivity: string;
  feeling: string;       // e.g. "I feel restless — 3 uncommitted changes."
}
```

### `class Awareness`

```typescript
const awareness = new Awareness('/path/to/repo');
```

**Constructor:** `new Awareness(repoDir: string)`

#### `perceive(): SelfDescription`

Generate structured self-description from repo state.

```typescript
const self = awareness.perceive();
// { name: 'myproject', born: '2024-01-15', age: '3 months', ... }
```

**Data sources:**
- `package.json` → name, description
- `git log --reverse` → birth date
- `git rev-list --count HEAD` → commit count
- File tree walk (depth 4, skipping `node_modules`, `dist`, `.git`) → file count, languages
- `git status --porcelain` → feeling
- `git shortlog -sn` → authors
- `git log -1 --format=%ar` → last commit time

#### `narrate(): string`

Render as first-person narrative.

```typescript
const story = awareness.narrate();
// "I am myproject. My purpose: Build cool stuff. I was born 3 months ago..."
```

---

## context.ts — Smart Context Builder

### Types

```typescript
interface ContextOptions {
  soul: Soul;
  memory: Memory;
  awareness: Awareness;
  userMessage: string;
  reflectionSummary?: string;
}
```

### `buildContext(opts: ContextOptions): string`

Build a budget-aware system prompt (~24K chars / ~4K tokens).

```typescript
import { buildContext } from './context.js';

const systemPrompt = buildContext({
  soul,
  memory,
  awareness,
  userMessage: 'How do I fix the auth bug?',
  reflectionSummary: 'Recent topics: auth, redis...',
});
```

**Priority order:**

| Priority | Section | Budget |
|----------|---------|--------|
| 1 | Soul personality | Always included |
| 2 | Git awareness | Always included |
| 3 | Reflection summary | If provided |
| 4 | Relevant facts | Keyword match against `userMessage` |
| 5 | Recent 5 messages | Always included |
| 6 | Older messages | Fill remaining budget |

**Fact matching:** Words from the user message (length > 3) are matched against fact values. Matching facts are included.

**Budget:** `MAX_CHARS = 24000` (~4000 tokens at ~6 chars/token). Older messages fill from most recent backwards.

---

## extract.ts — Learning from Conversations

### Types

```typescript
interface Extraction {
  facts: Array<{ key: string; value: string }>;
  decisions: string[];
  questions: string[];
  tone: 'positive' | 'negative' | 'neutral';
}
```

### `extract(message: string, memory: Memory): Extraction`

Extract learnings from a user message. Auto-saves facts to memory.

```typescript
import { extract } from './extract.js';

const result = extract('My name is Alice and I live in Portland', memory);
// {
//   facts: [{ key: 'user.name', value: 'Alice' }, { key: 'user.location', value: 'Portland' }],
//   decisions: [],
//   questions: [],
//   tone: 'neutral'
// }
```

**Fact patterns:**

| Pattern | Fact Key | Example |
|---------|----------|---------|
| `my name is X` | `user.name` | "My name is Alice" |
| `I'm from X` / `I am from X` | `user.location` | "I'm from Portland" |
| `I live in X` | `user.location` | "I live in Portland" |
| `I like X` | `user.likes.{firstWord}` | "I like TypeScript" |
| `I prefer X` | `user.preference` | "I prefer dark mode" |
| `I use X` | `user.tool` | "I use VS Code" |

**Decision patterns:** Sentences matching `let's X`, `we should X`, `I'll X`, `use X instead of Y`.

**Tone detection:** Keyword-based — positive (love, great, awesome...) and negative (hate, bad, broken...).

**Side effect:** Extracted facts are written to `memory.facts` and persisted immediately.

---

## reflect.ts — Self-Reflection

### Types

```typescript
interface Reflection {
  summary: string;
  patterns: string[];
  factCount: number;
  messageCount: number;
  ts: string;  // ISO 8601
}
```

### `reflect(memory: Memory, awareness: Awareness): Reflection`

Generate a reflection from current state. Saves to memory.

```typescript
import { reflect } from './reflect.js';

const r = reflect(memory, awareness);
// {
//   summary: "I have 5 facts and 30 messages in memory. Key facts: ...",
//   patterns: ['active conversation', 'accumulating knowledge'],
//   factCount: 5,
//   messageCount: 30,
//   ts: '2024-03-15T10:30:00.000Z'
// }
```

**Pattern detection:**
- `'active conversation'` — more than 10 user messages
- `'accumulating knowledge'` — more than 5 facts
- `'curious interlocutor'` — more than 40% of user messages contain `?`

**Side effects:**
- Saves `memory.facts['_lastReflection']` (truncated to 200 chars)
- Saves `memory.facts['_reflectionTs']` (ISO timestamp)

### `shouldReflect(memory: Memory): boolean`

Check if reflection is due.

```typescript
import { shouldReflect } from './reflect.js';

if (shouldReflect(memory)) {
  const r = reflect(memory, awareness);
}
```

**Triggers:**
- No previous reflection AND more than 2 messages, OR
- More than 30 minutes since last reflection

---

## summarize.ts — Conversation Summarization

### Types

```typescript
interface Summary {
  topics: string[];
  decisions: string[];
  factsLearned: Array<[string, string]>;
  unansweredQuestions: string[];
  messageRange: { from: number; to: number };
}
```

### `shouldSummarize(memory: Memory): boolean`

Check if summarization threshold is reached (20+ messages).

```typescript
import { shouldSummarize } from './summarize.js';

if (shouldSummarize(memory)) {
  const s = summarize(memory);
}
```

### `summarize(memory: Memory): Summary`

Summarize the conversation and compact memory.

```typescript
import { summarize } from './summarize.js';

const s = summarize(memory);
// {
//   topics: ['auth', 'redis', 'rate-limit'],
//   decisions: ['in-memory rate limit fallback'],
//   factsLearned: [['user.name', 'Alice']],
//   unansweredQuestions: ['Should we add a circuit breaker?'],
//   messageRange: { from: 0, to: 24 }
// }
```

**Side effects:**
- Saves summary text to `memory.facts['_lastSummary']`
- Compacts messages to last 5

**Topic extraction:** Word frequency (length > 3, stop words removed), top 5.

**Decision detection:** Sentences matching `let's`, `should`, `we'll`, `going to`, `decided`, `switch to`, `use X instead`.

**Unanswered questions:** User questions where no assistant message contains matching keywords.

---

## llm.ts — Multi-Provider LLM Client

### Types

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface StreamChunk {
  type: 'content' | 'done' | 'error';
  text?: string;
  error?: string;
}

interface LLMConfig {
  provider?: string;      // 'deepseek' | 'openai' | 'ollama' | custom
  apiKey?: string;
  baseUrl?: string;       // Override provider default
  model?: string;         // Override provider default
  temperature?: number;   // 0-2, default 0.7
  maxTokens?: number;     // Default 2048
  timeout?: number;       // ms, default 30000
}
```

### `class LLM`

```typescript
const llm = new LLM({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2048,
});
```

**Provider defaults:**

| Provider | Base URL | Default Model |
|----------|----------|---------------|
| `deepseek` | `https://api.deepseek.com` | `deepseek-chat` |
| `openai` | `https://api.openai.com` | `gpt-4o-mini` |
| `ollama` | `http://localhost:11434` | `llama3` |

**Custom provider:** Set `baseUrl` to any OpenAI-compatible endpoint and `model` to the desired model name.

#### `chat(messages: ChatMessage[]): Promise<ChatResponse>`

Non-streaming chat completion.

```typescript
const response = await llm.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
]);
// { content: 'Hi there!', model: 'gpt-4o-mini', usage: { ... } }
```

**Endpoint:** `POST ${baseUrl}/v1/chat/completions`

**Error handling:** Throws on network errors, timeouts, or empty choices. Retries once on failure.

#### `chatStream(messages: ChatMessage[]): AsyncGenerator<StreamChunk>`

Streaming chat completion via SSE.

```typescript
for await (const chunk of llm.chatStream(messages)) {
  if (chunk.type === 'content') process.stdout.write(chunk.text);
  if (chunk.type === 'error') console.error(chunk.error);
  if (chunk.type === 'done') break;
}
```

**Yields:**
- `{ type: 'content', text: '...' }` — token chunks
- `{ type: 'error', error: '...' }` — HTTP errors or stream errors
- `{ type: 'done' }` — stream complete

### `detectOllama(): Promise<{model: string} | null>`

Auto-detect a locally running Ollama instance.

```typescript
import { detectOllama } from './llm.js';

const ollama = await detectOllama();
// { model: 'llama3' } or null
```

**Behavior:** Fetches `http://localhost:11434/api/tags` with 2-second timeout. Returns the first available model name.

---

## web.ts — HTTP Chat Server

### `startWebServer(port, llm, memory, awareness, soul): void`

Start an HTTP server with chat UI and REST API.

```typescript
import { startWebServer } from './web.js';

startWebServer(3100, llm, memory, awareness, soul);
// [cocapn] Web chat at http://localhost:3100
```

**Parameters:**
- `port: number` — Port to listen on
- `llm: LLM` — LLM client instance
- `memory: Memory` — Memory store instance
- `awareness: Awareness` — Self-perception instance
- `soul: Soul` — Agent personality

### Routes

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/` | Chat UI | HTML from `public/index.html` |
| `GET` | `/cocapn/soul.md` | Public soul | Markdown with frontmatter |
| `GET` | `/api/status` | Agent state | JSON: name, tone, born, age, commits, files, languages, branch, lastCommit, feeling, memoryCount, factCount |
| `GET` | `/api/whoami` | Full self-perception | JSON: all SelfDescription fields + memory counts |
| `GET` | `/api/memory` | Recent memories | JSON: `{ messages: Message[], facts: Record<string, string> }` |
| `GET` | `/api/memory/search?q=` | Search memories | JSON: `{ messages, facts, gitLog }` |
| `DELETE` | `/api/memory` | Clear all memories | JSON: `{ ok: true }` |
| `GET` | `/api/git/log` | Recent commits | JSON array: `[{ hash, date, author, msg }]` |
| `GET` | `/api/git/stats` | Repo statistics | JSON: `{ files, lines, languages }` |
| `GET` | `/api/git/diff` | Uncommitted changes | JSON: `{ diff: string }` |
| `POST` | `/api/chat` | Streaming chat | SSE stream: `data: {"content":"..."}\n\n` |

### Chat endpoint details

`POST /api/chat` accepts:

```json
{ "message": "Hello, who are you?" }
```

Returns a Server-Sent Events stream:

```
data: {"content":"I am "}
data: {"content":"Forge, "}
data: {"content":"a development project companion."}
data: [DONE]
```

**Error responses:**
- `400` — Invalid JSON or empty message
- Stream errors — `data: {"error":"..."}`

**CORS:** All routes include `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight.

---

## chat.ts — Terminal Chat

### `chat(llm, memory, systemPrompt, stream?): Promise<void>`

Simple terminal readline chat interface.

```typescript
import { chat } from './chat.js';

await chat(llm, memory, 'You are a helpful assistant.');
```

**Parameters:**
- `llm: LLM` — LLM client
- `memory: Memory` — Memory store
- `systemPrompt: string` — Base system prompt
- `stream?: boolean` — Enable streaming (default: `true`)

**In-chat commands:**
- `/quit` or `/exit` — Exit
- `/whoami` — Print system prompt

**Behavior:** Messages are saved to memory. Streaming output is rendered in bold.

---

## config.ts — Configuration Schema

### Types

```typescript
interface LLMConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface Config {
  mode?: string;          // 'private' | 'public'
  port?: number;          // 1-65535
  llm?: LLMConfig;
  // Legacy flat fields
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### `validateConfig(raw: Record<string, unknown>): string[]`

Validate a parsed JSON config. Returns error messages.

```typescript
import { validateConfig } from './config.js';

const errors = validateConfig({ port: 'abc' });
// ['port must be a number between 1 and 65535']
```

**Returns:** Empty array if valid. Array of error strings if invalid.

### `applyDefaults(config: Config): Required<Pick<Config, 'mode' | 'port'>> & Config`

Fill in default values for missing config fields.

```typescript
import { applyDefaults } from './config.js';

const full = applyDefaults({});
// { mode: 'private', port: 3100, llm: { provider: 'deepseek' } }
```

**Defaults:**
- `mode`: `'private'`
- `port`: `3100`
- `llm.provider`: `'deepseek'`

---

## CLI (index.ts)

### Usage

```bash
cocapn              # Start terminal chat
cocapn --web        # Start web server
cocapn --port 3100  # Custom port (default 3100)
cocapn whoami       # Print self-description and exit
cocapn help         # Show help
```

### Terminal Chat Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/whoami` | Full self-perception |
| `/memory list` | Show all memories |
| `/memory clear` | Clear all memories |
| `/memory search <query>` | Search memories + git history |
| `/export` | Export memories to `.cocapn/memories.md` |
| `/import <file>` | Import facts from JSON file |
| `/git log` | Recent commits |
| `/git stats` | Repo statistics |
| `/git diff` | Uncommitted changes |
| `/clear` | Clear context |
| `/quit` | Exit |

### API Key Resolution Order

1. `cocapn.json` → `llm.apiKey`
2. `cocapn.json` → `apiKey` (legacy)
3. `DEEPSEEK_API_KEY` environment variable
4. `OPENAI_API_KEY` environment variable
5. `~/.cocapn/secrets.json` → `DEEPSEEK_API_KEY`
6. `~/.cocapn/secrets.json` → `OPENAI_API_KEY`
7. Auto-detect Ollama at `localhost:11434`
8. Exit with error message

### Config File Locations

Searched in order:
1. `cocapn.json` (repo root)
2. `cocapn/cocapn.json`

### Soul File Locations

Searched in order:
1. `soul.md` (repo root)
2. `cocapn/soul.md`
3. Default: `{ name: directoryName, tone: 'neutral', model: 'deepseek' }`
