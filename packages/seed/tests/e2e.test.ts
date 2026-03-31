/* eslint-disable */
// @ts-nocheck
/**
 * E2E Integration Test — full pipeline with mock LLM.
 *
 * 1. Creates temp git repo with soul.md + cocapn.json
 * 2. Creates commits with feature messages
 * 3. Imports seed modules directly
 * 4. Sends 5 chat messages with mock LLM
 * 5. Verifies memory, fact extraction, git awareness,
 *    context selection, summarize, and reflection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

import * as soulMod from '../src/soul.ts';
import * as memoryMod from '../src/memory.ts';
import * as awarenessMod from '../src/awareness.ts';
import * as extractMod from '../src/extract.ts';
import * as contextMod from '../src/context.ts';
import * as reflectMod from '../src/reflect.ts';
import * as summarizeMod from '../src/summarize.ts';
import * as gitMod from '../src/git.ts';

const { loadSoul, soulToSystemPrompt } = soulMod;
const { Memory } = memoryMod;
const { Awareness } = awarenessMod;
const { extract } = extractMod;
const { buildContext } = contextMod;
const { reflect, shouldReflect } = reflectMod;
const { summarize, shouldSummarize } = summarizeMod;

const uid = () => Math.random().toString(36).slice(2);

// ─── Mock LLM ─────────────────────────────────────────────────────────────────

function createMockLLM() {
  return {
    async *chatStream(messages) {
      const userMsg = messages.find((m) => m.role === 'user');
      if (!userMsg) { yield { type: 'done' }; return; }

      const c = userMsg.content.toLowerCase();
      let response = 'I understand. Tell me more.';

      if (c.includes('name')) response = "Nice to meet you, Casey! I'll remember your name.";
      else if (c.includes('live in') || c.includes('from')) response = "Great city! I'll remember that.";
      else if (c.includes('repo') || c.includes('about')) response = 'I am the e2e-test-repo. Let me look at my files...';
      else if (c.includes('love') || c.includes('like')) response = 'That is great! Good taste.';
      else if (c.includes('prefer')) response = "Good choice, I'll note that preference.";

      yield { type: 'content', text: response };
      yield { type: 'done' };
    },
  };
}

// ─── Shared state ──────────────────────────────────────────────────────────────

let testDir: string;
let memory: InstanceType<typeof Memory>;
let awareness: InstanceType<typeof Awareness>;
let soul: soulMod.Soul;
let mockLLM: ReturnType<typeof createMockLLM>;

/** Simulate a full chat exchange (same as web/terminal handler) */
async function chat(userText: string): Promise<string> {
  const fullSystem = [
    soulToSystemPrompt(soul), '',
    '## Who I Am', awareness.narrate(), '',
    memory.formatFacts() ? `## What I Remember\n${memory.formatFacts()}` : '', '',
    '## Recent Conversation', memory.formatContext(20) || '(start of conversation)',
  ].join('\n');

  let response = '';
  for await (const chunk of mockLLM.chatStream([
    { role: 'system', content: fullSystem },
    { role: 'user', content: userText },
  ])) {
    if (chunk.type === 'content' && chunk.text) response += chunk.text;
  }

  memory.addMessage('user', userText);
  if (response) memory.addMessage('assistant', response);

  // Extract facts from user message
  extract(userText, memory);

  return response;
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(() => {
  testDir = join(tmpdir(), `cocapn-e2e-${uid()}-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  // Write config files
  writeFileSync(join(testDir, 'soul.md'),
    '---\nname: E2EBot\ntone: curious\nmodel: deepseek\n---\n\nI am E2EBot, a self-aware test agent. I learn from conversations.');
  writeFileSync(join(testDir, 'cocapn.json'),
    JSON.stringify({ mode: 'private', port: 3100, llm: { provider: 'deepseek' } }, null, 2));
  writeFileSync(join(testDir, 'package.json'),
    JSON.stringify({ name: 'e2e-test-repo', description: 'End-to-end integration test repo' }));
  writeFileSync(join(testDir, 'app.ts'),
    'export const app = () => "hello";\n');
  writeFileSync(join(testDir, 'utils.ts'),
    'export function greet(name: string) { return `Hello ${name}`; }\n');
  writeFileSync(join(testDir, 'README.md'),
    '# E2E Test Repo\n\nA repo for testing cocapn.\n');

  // Git init + first commit
  execSync('git init', { cwd: testDir });
  execSync('git config user.email test@test.com', { cwd: testDir });
  execSync('git config user.name TestUser', { cwd: testDir });
  execSync('git add .', { cwd: testDir });
  execSync('git commit -m "feat: initial project setup with soul and config"', { cwd: testDir });

  // Second commit — new feature file
  writeFileSync(join(testDir, 'feature.ts'),
    'export function feature() { return true; }\n');
  execSync('git add feature.ts', { cwd: testDir });
  execSync('git commit -m "feat: add feature module for user auth"', { cwd: testDir });

  // Third commit — bugfix
  writeFileSync(join(testDir, 'fix.ts'),
    'export function fix() { return "patched"; }\n');
  execSync('git add fix.ts', { cwd: testDir });
  execSync('git commit -m "fix: resolve edge case in greeting logic"', { cwd: testDir });

  // Init modules
  soul = loadSoul(join(testDir, 'soul.md'));
  memory = new Memory(testDir);
  awareness = new Awareness(testDir);
  mockLLM = createMockLLM();
});

afterAll(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('E2E Integration', () => {

  // ── Step 1+8: Git awareness returns correct data ───────────────────────────

  it('knows its name from package.json', () => {
    const self = awareness.perceive();
    expect(self.name).toBe('e2e-test-repo');
  });

  it('counts commits correctly', () => {
    const self = awareness.perceive();
    expect(self.commits).toBeGreaterThanOrEqual(3);
  });

  it('counts files correctly', () => {
    const self = awareness.perceive();
    // soul.md, cocapn.json, package.json, app.ts, utils.ts, README.md, feature.ts, fix.ts = 8
    expect(self.files).toBeGreaterThanOrEqual(7);
  });

  it('detects TypeScript language', () => {
    const self = awareness.perceive();
    expect(self.languages).toContain('TypeScript');
  });

  it('knows its branch', () => {
    const self = awareness.perceive();
    expect(self.branch).toBeTruthy();
    expect(['master', 'main']).toContain(self.branch);
  });

  it('narrates in first person', () => {
    const narrative = awareness.narrate();
    expect(narrative).toContain('I am e2e-test-repo');
    expect(narrative).toContain('files');
  });

  it('git module returns log entries with feature messages', () => {
    const entries = gitMod.log(testDir, 5);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const msgs = entries.map(e => e.msg);
    expect(msgs.some(m => m.includes('feat'))).toBe(true);
  });

  // ── Steps 2-6: Send 5 chat messages, verify memory ─────────────────────────

  it('sends 5 chat messages and memory grows', async () => {
    const r1 = await chat('My name is Casey');
    expect(r1).toBeTruthy();
    expect(r1).toContain('Casey');
    expect(memory.messages.length).toBe(2);

    const r2 = await chat('I live in Portland');
    expect(r2).toBeTruthy();
    expect(memory.messages.length).toBe(4);

    const r3 = await chat('Tell me about this repo');
    expect(r3).toBeTruthy();
    expect(memory.messages.length).toBe(6);

    const r4 = await chat('I love TypeScript');
    expect(r4).toBeTruthy();
    expect(memory.messages.length).toBe(8);

    const r5 = await chat('I prefer dark mode for my editor');
    expect(r5).toBeTruthy();
    expect(memory.messages.length).toBe(10);

    // All messages persisted
    const mem2 = new Memory(testDir);
    expect(mem2.messages.length).toBe(10);
  });

  // ── Step 7: Fact extraction ──────────────────────────────────────────────────

  it('extracted user.name fact', () => {
    expect(memory.facts['user.name']).toBe('Casey');
  });

  it('extracted user.location fact', () => {
    expect(memory.facts['user.location']).toBe('Portland');
  });

  it('extracted user.preference fact', () => {
    expect(memory.facts['user.preference']).toBeTruthy();
    expect(memory.facts['user.preference'].toLowerCase()).toContain('dark');
  });

  it('facts persist across memory instances', () => {
    const mem2 = new Memory(testDir);
    expect(mem2.facts['user.name']).toBe('Casey');
    expect(mem2.facts['user.location']).toBe('Portland');
  });

  it('detects positive tone from love message', () => {
    const mem = new Memory(testDir);
    const result = extract('I love TypeScript so much', mem);
    expect(result.tone).toBe('positive');
  });

  // ── Step 9: Context selection prioritizes relevant facts ─────────────────────

  it('context includes Portland when asked about Portland weather', () => {
    const ctx = buildContext({
      soul, memory, awareness,
      userMessage: 'What is the weather like in Portland today?',
    });
    expect(ctx).toContain('Portland');
    expect(ctx).toContain('E2EBot');
    expect(ctx).toContain('Who I Am');
  });

  it('context includes Casey when asked about the user', () => {
    const ctx = buildContext({
      soul, memory, awareness,
      userMessage: 'Tell me about Casey',
    });
    expect(ctx).toContain('Casey');
  });

  it('context always includes soul personality', () => {
    const ctx = buildContext({
      soul, memory, awareness,
      userMessage: 'random question',
    });
    expect(ctx).toContain('You are E2EBot');
    expect(ctx).toContain('curious');
  });

  // ── Step 10: Summarize triggers after 20 messages ────────────────────────────

  it('shouldSummarize is false with 10 messages', () => {
    expect(memory.messages.length).toBe(10);
    expect(shouldSummarize(memory)).toBe(false);
  });

  it('shouldSummarize triggers after 20 messages and compacts', () => {
    // Add 10 more messages to reach 20
    for (let i = 0; i < 10; i++) {
      memory.addMessage('user', `Filler message ${i} about testing`);
      memory.addMessage('assistant', `Response to filler ${i}`);
    }

    expect(memory.messages.length).toBe(30);
    expect(shouldSummarize(memory)).toBe(true);

    const summary = summarize(memory);

    // Verify summary has content
    expect(summary.topics.length).toBeGreaterThan(0);
    expect(summary.messageRange.to).toBe(30);

    // Memory compacted to last 5
    expect(memory.messages.length).toBe(5);

    // Summary saved as fact
    expect(memory.facts['_lastSummary']).toBeTruthy();

    // Summary persists
    const mem2 = new Memory(testDir);
    expect(mem2.facts['_lastSummary']).toBeTruthy();
  });

  // ── Step 11: Reflection generates meaningful output ──────────────────────────

  it('reflection generates summary with facts and patterns', () => {
    const result = reflect(memory, awareness);
    expect(result.summary).toBeTruthy();
    expect(result.factCount).toBeGreaterThan(0);
    expect(result.messageCount).toBe(5); // after compaction
    expect(result.ts).toBeTruthy();

    // Saved to memory
    expect(memory.facts['_lastReflection']).toBeTruthy();
    expect(memory.facts['_reflectionTs']).toBeTruthy();
  });

  it('reflection persists across memory instances', () => {
    const mem2 = new Memory(testDir);
    expect(mem2.facts['_lastReflection']).toBeTruthy();
    expect(mem2.facts['_reflectionTs']).toBeTruthy();
  });

  it('reflection summary includes repo info', () => {
    const result = reflect(memory, awareness);
    expect(result.summary).toContain('e2e-test-repo');
  });

  it('shouldReflect is false right after reflection', () => {
    expect(shouldReflect(memory)).toBe(false);
  });

  // ── Step 12: Cleanup verified ────────────────────────────────────────────────

  it('temp repo exists for cleanup', () => {
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, '.cocapn', 'memory.json'))).toBe(true);
  });
});
