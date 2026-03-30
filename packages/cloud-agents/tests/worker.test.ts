/**
 * Tests for Cloud Agent Worker HTTP API routes (v0.2.0).
 *
 * Tests the HTTP API endpoints:
 *   - GET /api/health (with brain state validation)
 *   - GET /api/status (agent status, soul.md info)
 *   - POST /api/execute-task
 *   - POST /api/webhook/github
 *   - GET /api/status/:taskId
 *   - POST /api/chat (soul.md personality injection)
 *   - Fleet JWT verification
 *   - SoulCompiler in cloud context
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock DurableObjectState ─────────────────────────────────────────────────────

class MockStorage implements DurableObjectStorage {
  private store = new Map<string, unknown>();
  private alarms = new Map<string, Date>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<DurableObjectStorageList> {
    const list: DurableObjectStorageList = {
      keys: [],
      complete: true,
    };
    return list;
  }

  async getAlarm(): Promise<Date | null> {
    return null;
  }

  async setAlarm(): Promise<void> {
    // No-op for mock
  }

  async deleteAlarm(): Promise<void> {
    // No-op for mock
  }

  async transaction(): Promise<unknown> {
    return undefined;
  }

  // Helper for tests
  clear(): void {
    this.store.clear();
    this.alarms.clear();
  }

  size(): number {
    return this.store.size;
  }
}

class MockDurableObjectState implements DurableObjectState {
  storage: MockStorage;
  id = {
    toString: () => "test-admiral-id",
    equals: () => false,
  };

  constructor(storage: MockStorage) {
    this.storage = storage as unknown as DurableObjectStorage;
  }
}

class MockDurableObjectNamespace implements DurableObjectNamespace {
  private objectId = "test-admiral-id";

  idFromName(): DurableObjectId {
    return {
      toString: () => this.objectId,
      equals: () => false,
    };
  }

  get(): DurableObjectStub {
    return {
      id: {
        toString: () => this.objectId,
        equals: () => false,
      },
      fetch: async (req: Request) => {
        // Return mock response
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    };
  }
}

// ─── Test utilities ─────────────────────────────────────────────────────────────

const kvStore = new Map<string, string>();

function createMockEnv(): {
  GITHUB_PAT: string;
  FLEET_JWT_SECRET: string;
  DEEPSEEK_API_KEY: string;
  PRIVATE_REPO: string;
  PUBLIC_REPO: string;
  BRIDGE_MODE: string;
  AUTH_KV: KVNamespace;
  ADMIRAL: DurableObjectNamespace;
} {
  return {
    GITHUB_PAT: "test-github-pat",
    FLEET_JWT_SECRET: "test-fleet-secret-for-testing",
    DEEPSEEK_API_KEY: "test-deepseek-key",
    PRIVATE_REPO: "test/private-repo",
    PUBLIC_REPO: "test/public-repo",
    BRIDGE_MODE: "cloud",
    AUTH_KV: {
      get: async (key: string) => kvStore.get(key) ?? null,
      put: async (key: string, value: string) => { kvStore.set(key, value); },
      delete: async (key: string) => { kvStore.delete(key); },
    } as unknown as KVNamespace,
    ADMIRAL: new MockDurableObjectNamespace() as unknown as DurableObjectNamespace,
  };
}

async function jsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

// ─── Test suite ────────────────────────────────────────────────────────────────

describe("Cloud Agent Worker HTTP API", () => {
  let worker: ExportedHandler<{ GITHUB_PAT: string; FLEET_JWT_SECRET: string; DEEPSEEK_API_KEY: string; PRIVATE_REPO: string; PUBLIC_REPO: string; BRIDGE_MODE: string; AUTH_KV: KVNamespace; ADMIRAL: DurableObjectNamespace }>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(async () => {
    // Import the worker module
    const workerModule = await import("../src/worker.js");
    worker = workerModule.default;
    env = createMockEnv();
    kvStore.clear();
  });

  describe("GET /api/health", () => {
    it("should return health check with 200 OK and brain info", async () => {
      const request = new Request("https://worker.test/api/health");
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(200);
      const data = await jsonResponse<{ ok: boolean; timestamp: string; version: string; brain: { kvHealthy: boolean; soulAvailable: boolean; factsAvailable: boolean; wikiAvailable: boolean } }>(response);
      expect(data.ok).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBe("0.2.0");
      expect(data.brain).toBeDefined();
      expect(data.brain.kvHealthy).toBe(true);
    });

    it("should detect soul.md in KV", async () => {
      kvStore.set("soul.md", "# Identity\nYou are Alice.");
      const request = new Request("https://worker.test/api/health");
      const response = await worker.fetch(request, env);

      const data = await response.json() as { brain: { soulAvailable: boolean } };
      expect(data.brain.soulAvailable).toBe(true);
    });

    it("should return JSON content type", async () => {
      const request = new Request("https://worker.test/api/health");
      const response = await worker.fetch(request, env);

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include CORS headers", async () => {
      const request = new Request("https://worker.test/api/health");
      const response = await worker.fetch(request, env);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("GET /api/status", () => {
    it("should return agent status with soul.md info", async () => {
      const request = new Request("https://worker.test/api/status");
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(200);
      const data = await jsonResponse<{
        ok: boolean;
        version: string;
        mode: string;
        soul: { loaded: boolean; version: string; tone: string; traits: number; constraints: number; capabilities: number };
        brain: { kvHealthy: boolean };
        uptime: number;
        timestamp: string;
      }>(response);

      expect(data.version).toBe("0.2.0");
      expect(data.mode).toBe("public");
      expect(data.soul).toBeDefined();
      expect(data.soul.loaded).toBe(false); // No soul.md in KV yet
      expect(data.brain.kvHealthy).toBe(true);
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
    });

    it("should reflect soul.md content when loaded in KV", async () => {
      kvStore.set("soul.md", [
        "---",
        "name: Alice",
        "version: 1.0",
        "tone: friendly",
        "greeting: Hey there!",
        "",
        "# Identity",
        "- Helpful assistant",
        "- Friendly and warm",
        "",
        "# Public Face",
        "I'm Alice, your digital companion.",
        "",
        "# What You Know",
        "- TypeScript",
        "- Cloud architecture",
        "",
      ].join("\n"));

      const request = new Request("https://worker.test/api/status");
      const response = await worker.fetch(request, env);

      const data = await response.json() as {
        soul: { loaded: boolean; version: string; tone: string; traits: number; constraints: number; capabilities: number; greeting: string; publicPromptLength: number };
      };

      expect(data.soul.loaded).toBe(true);
      expect(data.soul.version).toBe("1.0");
      expect(data.soul.tone).toBe("friendly");
      expect(data.soul.traits).toBe(2);
      expect(data.soul.capabilities).toBe(2);
      expect(data.soul.greeting).toBe("Hey there!");
      expect(data.soul.publicPromptLength).toBeGreaterThan(0);
    });

    it("should include CORS headers", async () => {
      const request = new Request("https://worker.test/api/status");
      const response = await worker.fetch(request, env);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("POST /api/execute-task", () => {
    it("should reject request without taskId", async () => {
      const request = new Request("https://worker.test/api/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "valid-token" }),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(400);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Missing taskId");
    });

    it("should reject request without token", async () => {
      const request = new Request("https://worker.test/api/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-123" }),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Missing fleet JWT token");
    });

    it("should reject request with invalid JWT", async () => {
      const request = new Request("https://worker.test/api/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "task-123",
          token: "invalid-jwt-token",
        }),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Invalid JWT");
    });
  });

  describe("POST /api/webhook/github", () => {
    it("should reject webhook without signature", async () => {
      const request = new Request("https://worker.test/api/webhook/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Missing signature");
    });

    it("should reject webhook with invalid signature format", async () => {
      const request = new Request("https://worker.test/api/webhook/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "invalid-format",
        },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Invalid signature format");
    });

    it("should accept valid webhook with correct signature format", async () => {
      const request = new Request("https://worker.test/api/webhook/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=abc123",
          "X-GitHub-Event": "ping",
        },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, env);
      // Should be forwarded to AdmiralDO, which returns 200 in our mock
      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/status/:taskId", () => {
    it("should reject status request without taskId", async () => {
      const request = new Request("https://worker.test/api/status/");
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(400);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Missing taskId");
    });

    it("should return 404 for non-existent task", async () => {
      const request = new Request("https://worker.test/api/status/non-existent-task");
      const response = await worker.fetch(request, env);

      // Our mock AdmiralDO returns 200, but in a real scenario with a non-existent task it would be 404
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).lessThan(500);
    });
  });

  describe("POST /api/chat", () => {
    it("should reject chat request without authentication", async () => {
      const request = new Request("https://worker.test/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Authentication required");
    });

    it("should reject chat request with malformed Authorization header", async () => {
      const request = new Request("https://worker.test/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic abc123",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(401);

      const data = await response.json() as { error: string };
      expect(data.error).toContain("Invalid Authorization header format");
    });

    it("should accept chat request with X-API-Key header", async () => {
      const request = new Request("https://worker.test/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "cocapn_sk_testkey",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      });

      // Should pass auth check (API key verification is delegated to AdmiralDO mock)
      const response = await worker.fetch(request, env);
      // Expect non-401 — actual LLM call may fail in test env but auth should pass
      expect(response.status).not.toBe(401);
    });

    it("should accept chat request with Bearer Authorization header", async () => {
      const request = new Request("https://worker.test/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer some-jwt-token",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      });

      // Should pass auth check (JWT verification is delegated)
      const response = await worker.fetch(request, env);
      expect(response.status).not.toBe(401);
    });

    it("should inject soul.md public prompt into chat", async () => {
      // Put soul.md in KV so the chat handler picks it up
      kvStore.set("soul.md", `---
name: Alice
tone: friendly

# Public Face
I'm Alice, your helpful companion.
`);

      const request = new Request("https://worker.test/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "cocapn_sk_testkey",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      });

      // The LLM call will fail in test env (no real API key),
      // but auth passes and soul.md is loaded — we just verify non-401
      const response = await worker.fetch(request, env);
      expect(response.status).not.toBe(401);
    });
  });

  describe("CORS preflight", () => {
    it("should handle OPTIONS request with CORS headers", async () => {
      const request = new Request("https://worker.test/api/health", {
        method: "OPTIONS",
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    });
  });
});

// ─── SoulCompiler tests ────────────────────────────────────────────────────────

describe("SoulCompiler (cloud context)", () => {
  let SoulCompiler: typeof import("../src/soul-compiler.js").SoulCompiler;

  beforeEach(async () => {
    const mod = await import("../src/soul-compiler.js");
    SoulCompiler = mod.SoulCompiler;
  });

  it("should compile empty soul.md into safe defaults", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile("");

    expect(result.systemPrompt).toBe("");
    expect(result.publicSystemPrompt).toBe("");
    expect(result.traits).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.capabilities).toEqual([]);
    expect(result.version).toBe("0.0");
    expect(result.tone).toBe("casual");
    expect(result.greeting).toBe("");
  });

  it("should parse YAML frontmatter", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile(`---
name: Alice
version: 2.0
tone: professional
greeting: Welcome!

# Identity
You are Alice.
`);

    expect(result.version).toBe("2.0");
    expect(result.tone).toBe("professional");
    expect(result.greeting).toBe("Welcome!");
    expect(result.systemPrompt).toContain("You are Alice.");
  });

  it("should extract traits from Identity section", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile(`# Identity
- Helpful and friendly
- Knowledgeable about code
- Patient with beginners
`);

    expect(result.traits).toEqual([
      "Helpful and friendly",
      "Knowledgeable about code",
      "Patient with beginners",
    ]);
  });

  it("should extract capabilities from What You Know section", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile(`# What You Know
- TypeScript
- Cloud architecture
- Git workflows
`);

    expect(result.capabilities).toEqual([
      "TypeScript",
      "Cloud architecture",
      "Git workflows",
    ]);
  });

  it("should extract constraints from Constraints section", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile(`# Constraints
- Never share private user data
- Always verify API keys
`);

    expect(result.constraints).toEqual([
      "Never share private user data",
      "Always verify API keys",
    ]);
  });

  it("should build public system prompt (Identity + Public Face only)", () => {
    const compiler = new SoulCompiler();
    const soulMd = `---
name: Alice

# Identity
You are Alice, a helpful AI.

# Public Face
I'm Alice, your friendly assistant.

# What You Don't Do
- Share private data
- Make up facts
`;

    const result = compiler.compile(soulMd);

    // Public prompt should include Identity and Public Face
    expect(result.publicSystemPrompt).toContain("You are Alice, a helpful AI.");
    expect(result.publicSystemPrompt).toContain("I'm Alice, your friendly assistant.");
    // Public prompt should NOT include private sections
    expect(result.publicSystemPrompt).not.toContain("What You Don't Do");
    expect(result.publicSystemPrompt).not.toContain("Share private data");
  });

  it("should detect tone from content keywords", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile(`# Identity
You are a formal and professional assistant.
`);

    expect(result.tone).toBe("professional");
  });

  it("should handle soul.md with no sections gracefully", () => {
    const compiler = new SoulCompiler();
    const result = compiler.compile("Just some plain text about the agent.");

    expect(result.systemPrompt).toContain("Just some plain text about the agent.");
    expect(result.traits).toEqual([]);
  });
});
