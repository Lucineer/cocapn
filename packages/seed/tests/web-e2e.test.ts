/* eslint-disable */
// @ts-nocheck
/**
 * Web Server E2E Test — starts a real HTTP server and tests all routes.
 *
 * 1. Start the web server on a random port
 * 2. GET /            → verify HTML returned
 * 3. GET /api/status  → verify JSON with agent info
 * 4. POST /api/chat   → verify streaming SSE response
 * 5. GET /api/whoami  → verify self-perception
 * 6. GET /api/git/log → verify commit history
 * 7. GET /api/memory/search?q= → verify search works
 * 8. GET /cocapn/soul.md → verify soul served
 * 9. Close server
 *
 * Note: process.chdir() is not supported in Vitest workers, so git endpoints
 * use the Vitest CWD (the cocapn repo). Awareness/memory endpoints use the
 * temp repo passed via constructor.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';

import { startWebServer } from '../src/web.ts';
import { Memory } from '../src/memory.ts';
import { Awareness } from '../src/awareness.ts';
import type { Soul } from '../src/soul.ts';

const uid = () => Math.random().toString(36).slice(2);

// ─── Mock LLM (same pattern as seed.test.ts) ──────────────────────────────────

function createMockLLM() {
  return {
    async *chatStream(messages: any[]) {
      const userMsg = messages.find((m: any) => m.role === 'user');
      if (userMsg) yield { type: 'content' as const, text: 'MockBot: ' + userMsg.content };
      yield { type: 'done' as const };
    },
  };
}

// ─── Shared state ──────────────────────────────────────────────────────────────

let testDir: string;
let port: number;
let server: Server;
let memory: Memory;

describe('Web Server E2E', () => {

  beforeAll(async () => {
    testDir = join(tmpdir(), `cocapn-web-e2e-${uid()}-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Write repo files
    writeFileSync(join(testDir, 'soul.md'),
      '---\nname: WebE2EBot\ntone: friendly\n---\n\nI am WebE2EBot, the web test agent.');
    writeFileSync(join(testDir, 'cocapn.json'),
      JSON.stringify({ mode: 'private', port: 3100 }));
    writeFileSync(join(testDir, 'package.json'),
      JSON.stringify({ name: 'web-e2e-test', description: 'Web E2E test' }));
    writeFileSync(join(testDir, 'app.ts'),
      'export const app = () => "hello";\n');
    writeFileSync(join(testDir, 'utils.ts'),
      'export function util() { return 42; }\n');

    // Git init
    execSync('git init', { cwd: testDir });
    execSync('git config user.email test@test.com', { cwd: testDir });
    execSync('git config user.name TestUser', { cwd: testDir });
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: initial web e2e setup"', { cwd: testDir });

    // Second commit for more git history
    writeFileSync(join(testDir, 'feature.ts'), 'export const feature = true;\n');
    execSync('git add feature.ts', { cwd: testDir });
    execSync('git commit -m "feat: add feature module"', { cwd: testDir });

    // Init modules — Awareness and Memory use testDir (passed via constructor)
    const mockLLM = createMockLLM();
    memory = new Memory(testDir);
    const awareness = new Awareness(testDir);
    const soul: Soul = { name: 'WebE2EBot', tone: 'friendly', model: 'deepseek', body: 'I am WebE2EBot, the web test agent.' };

    port = 13000 + Math.floor(Math.random() * 900);
    server = startWebServer(port, mockLLM, memory, awareness, soul);

    // Wait for server to start listening
    await new Promise<void>(resolve => {
      server.on('listening', resolve);
      if (server.listening) resolve();
    });
  });

  afterAll(() => {
    server?.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  // ── 1. GET / ─────────────────────────────────────────────────────────────────

  it('GET / returns HTML', async () => {
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('cocapn');
  });

  // ── 2. GET /api/status ──────────────────────────────────────────────────────

  it('GET /api/status returns agent info JSON', async () => {
    const res = await fetch(`http://localhost:${port}/api/status`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.name).toBe('WebE2EBot');
    expect(data.tone).toBe('friendly');
    expect(typeof data.commits).toBe('number');
    expect(data.commits).toBeGreaterThanOrEqual(2);
    expect(typeof data.files).toBe('number');
    expect(data.files).toBeGreaterThanOrEqual(4);
    expect(data.languages).toBeDefined();
    expect(data.branch).toBeTruthy();
    expect(typeof data.memoryCount).toBe('number');
    expect(typeof data.factCount).toBe('number');
  });

  // ── 3. POST /api/chat ───────────────────────────────────────────────────────

  it('POST /api/chat streams SSE response', async () => {
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello from web test' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('MockBot: Hello from web test');
    expect(text).toContain('[DONE]');

    // Verify SSE format
    expect(text).toContain('data: {"content":');
  });

  it('POST /api/chat rejects empty message', async () => {
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/chat saves to memory', async () => {
    // Check that the previous chat was persisted
    const memRes = await fetch(`http://localhost:${port}/api/memory`);
    const memData = await memRes.json();
    expect(memData.messages.some((m: any) => m.content === 'Hello from web test')).toBe(true);
  });

  // ── 4. GET /api/whoami ──────────────────────────────────────────────────────

  it('GET /api/whoami returns self-perception', async () => {
    const res = await fetch(`http://localhost:${port}/api/whoami`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.name).toBe('WebE2EBot');
    expect(data.born).toBeTruthy();
    expect(data.age).toBeTruthy();
    expect(data.description).toBe('Web E2E test');
    expect(data.files).toBeGreaterThanOrEqual(4);
    expect(data.languages).toBeDefined();
    expect(data.commits).toBeGreaterThanOrEqual(2);
    expect(data.branch).toBeTruthy();
    expect(data.authors).toBeDefined();
    expect(data.memory).toBeDefined();
    expect(typeof data.memory.facts).toBe('number');
  });

  // ── 5. GET /api/git/log ─────────────────────────────────────────────────────

  it('GET /api/git/log returns commit history', async () => {
    const res = await fetch(`http://localhost:${port}/api/git/log`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    const first = data[0];
    expect(first.hash).toBeTruthy();
    expect(first.date).toBeTruthy();
    expect(first.author).toBeTruthy();
    expect(first.msg).toBeTruthy();
  });

  // ── 6. GET /api/memory/search ───────────────────────────────────────────────

  it('GET /api/memory/search?q= finds messages', async () => {
    // Seed some searchable data
    memory.addMessage('user', 'I love TypeScript and web testing');
    memory.addMessage('assistant', 'TypeScript is great for web development');

    const res = await fetch(`http://localhost:${port}/api/memory/search?q=typescript`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.messages.length).toBeGreaterThanOrEqual(1);
    expect(data.messages.some((m: any) => m.content.toLowerCase().includes('typescript'))).toBe(true);
  });

  it('GET /api/memory/search requires q param', async () => {
    const res = await fetch(`http://localhost:${port}/api/memory/search`);
    expect(res.status).toBe(400);
  });

  // ── 7. GET /cocapn/soul.md ──────────────────────────────────────────────────

  it('GET /cocapn/soul.md returns public soul', async () => {
    const res = await fetch(`http://localhost:${port}/cocapn/soul.md`);
    expect(res.status).toBe(200);
    const text = await res.text();

    expect(text).toContain('WebE2EBot');
    expect(text).toContain('friendly');
    expect(text).toContain('I am WebE2EBot');
  });

  // ── Additional coverage ──────────────────────────────────────────────────────

  it('GET /api/git/stats returns repo statistics', async () => {
    const res = await fetch(`http://localhost:${port}/api/git/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(typeof data.files).toBe('number');
    expect(typeof data.lines).toBe('number');
    expect(data.languages).toBeDefined();
  });

  it('DELETE /api/memory clears memories', async () => {
    // Add a message first
    memory.addMessage('user', 'to be deleted');

    const res = await fetch(`http://localhost:${port}/api/memory`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify cleared
    const memRes = await fetch(`http://localhost:${port}/api/memory`);
    const memData = await memRes.json();
    expect(memData.messages.length).toBe(0);
  });

  it('GET unknown route returns 404', async () => {
    const res = await fetch(`http://localhost:${port}/nonexistent`);
    expect(res.status).toBe(404);
  });
});
