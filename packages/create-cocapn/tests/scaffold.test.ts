/**
 * Tests for scaffold.ts — two-repo model.
 *
 * Run with:
 *   node --import ../local-bridge/node_modules/tsx/dist/esm/index.cjs --test tests/scaffold.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir(suffix: string): string {
  const dir = join(tmpdir(), `cocapn-test-${suffix}-${Date.now()}`);
  return dir;
}

const CONFIG = {
  username: "alice",
  projectName: "my-cocapn",
  domain: "makerlog",
  template: "bare",
  baseDir: "",
};

// ─── createPrivateRepo ────────────────────────────────────────────────────────

describe("createPrivateRepo", () => {
  let dir: string;

  before(() => {
    dir = tmpDir("brain");
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates expected directory structure", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    createPrivateRepo(dir, CONFIG);

    // Directories
    assert.ok(existsSync(join(dir, "cocapn")), "cocapn/ exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory")), "memory/ exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory", "repo-understanding")), "repo-understanding/ exists");
    assert.ok(existsSync(join(dir, "wiki")), "wiki/ exists");

    // Files
    assert.ok(existsSync(join(dir, "cocapn", "soul.md")), "soul.md exists");
    assert.ok(existsSync(join(dir, "cocapn", "config.yml")), "config.yml exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory", "facts.json")), "facts.json exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory", "memories.json")), "memories.json exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory", "procedures.json")), "procedures.json exists");
    assert.ok(existsSync(join(dir, "cocapn", "memory", "relationships.json")), "relationships.json exists");
    assert.ok(existsSync(join(dir, "wiki", "README.md")), "wiki README exists");
    assert.ok(existsSync(join(dir, ".gitignore")), ".gitignore exists");
    assert.ok(existsSync(join(dir, ".env.local")), ".env.local exists");
    assert.ok(existsSync(join(dir, "package.json")), "package.json exists");
  });

  it("soul.md contains username", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    const d = tmpDir("soul-user");
    try {
      createPrivateRepo(d, { ...CONFIG, username: "bob" });
      const soul = readFileSync(join(d, "cocapn", "soul.md"), "utf8");
      assert.ok(soul.includes("bob"), "username in soul.md");
      assert.ok(!soul.includes("{{username}}"), "no unreplaced placeholders");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it(".gitignore contains .env.local", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    const d = tmpDir("gitignore");
    try {
      createPrivateRepo(d, CONFIG);
      const gitignore = readFileSync(join(d, ".gitignore"), "utf8");
      assert.ok(gitignore.includes(".env.local"), ".env.local in .gitignore");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("config.yml has correct domain", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    const d = tmpDir("config-domain");
    try {
      createPrivateRepo(d, { ...CONFIG, domain: "dmlog" });
      const config = readFileSync(join(d, "cocapn", "config.yml"), "utf8");
      assert.ok(config.includes("dmlog"), "domain in config.yml");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("dmlog template has TTRPG soul.md", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    const d = tmpDir("dmlog-soul");
    try {
      createPrivateRepo(d, { ...CONFIG, template: "dmlog" });
      const soul = readFileSync(join(d, "cocapn", "soul.md"), "utf8");
      assert.ok(soul.includes("Dungeon Master"), "TTRPG content in dmlog soul.md");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("facts.json is empty object", async () => {
    const { createPrivateRepo } = await import("../src/scaffold.js");
    const d = tmpDir("facts-empty");
    try {
      createPrivateRepo(d, CONFIG);
      const facts = readFileSync(join(d, "cocapn", "memory", "facts.json"), "utf8");
      assert.deepEqual(JSON.parse(facts), {});
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

// ─── createPublicRepo ─────────────────────────────────────────────────────────

describe("createPublicRepo", () => {
  it("creates expected directory structure", async () => {
    const { createPublicRepo } = await import("../src/scaffold.js");
    const dir = tmpDir("public");
    try {
      createPublicRepo(dir, CONFIG);

      assert.ok(existsSync(join(dir, "cocapn.yml")), "cocapn.yml exists");
      assert.ok(existsSync(join(dir, "index.html")), "index.html exists");
      assert.ok(existsSync(join(dir, "src", "main.ts")), "main.ts exists");
      assert.ok(existsSync(join(dir, "src", "app.ts")), "app.ts exists");
      assert.ok(existsSync(join(dir, "src", "style.css")), "style.css exists");
      assert.ok(existsSync(join(dir, ".gitignore")), ".gitignore exists");
      assert.ok(existsSync(join(dir, "package.json")), "package.json exists");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates CNAME when domain is provided", async () => {
    const { createPublicRepo } = await import("../src/scaffold.js");
    const dir = tmpDir("cname");
    try {
      createPublicRepo(dir, CONFIG);
      assert.ok(existsSync(join(dir, "CNAME")), "CNAME exists");
      const cname = readFileSync(join(dir, "CNAME"), "utf8");
      assert.ok(cname.includes("alice.makerlog.ai"), "CNAME has correct domain");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("omits CNAME when no domain", async () => {
    const { createPublicRepo } = await import("../src/scaffold.js");
    const dir = tmpDir("no-cname");
    try {
      createPublicRepo(dir, { ...CONFIG, domain: "" });
      assert.ok(!existsSync(join(dir, "CNAME")), "CNAME should not exist");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cocapn.yml links to brain repo", async () => {
    const { createPublicRepo } = await import("../src/scaffold.js");
    const dir = tmpDir("cocapn-yml");
    try {
      createPublicRepo(dir, CONFIG);
      const yml = readFileSync(join(dir, "cocapn.yml"), "utf8");
      assert.ok(yml.includes("my-cocapn"), "project name in cocapn.yml");
      assert.ok(yml.includes("alice"), "username in cocapn.yml");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── Two-repo integration ─────────────────────────────────────────────────────

describe("Two-repo integration", () => {
  let baseDir: string;

  before(() => {
    baseDir = tmpDir("two-repo");
  });

  after(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("creates both repos from a temp dir", async () => {
    const { createPrivateRepo, createPublicRepo, initAndCommit } = await import("../src/scaffold.js");
    const brainDir = join(baseDir, "test-brain");
    const publicDir = join(baseDir, "test-public");

    createPrivateRepo(brainDir, CONFIG);
    createPublicRepo(publicDir, CONFIG);
    initAndCommit(brainDir, "alice", "Initial brain");
    initAndCommit(publicDir, "alice", "Initial public");

    assert.ok(existsSync(join(brainDir, "cocapn", "soul.md")), "brain has soul.md");
    assert.ok(existsSync(join(publicDir, "cocapn.yml")), "public has cocapn.yml");
  });

  it("both repos have .git directories after initAndCommit", async () => {
    assert.ok(existsSync(join(baseDir, "test-brain", ".git")), "brain has .git");
    assert.ok(existsSync(join(baseDir, "test-public", ".git")), "public has .git");
  });

  it("soul.md exists in brain repo", async () => {
    const soul = readFileSync(join(baseDir, "test-brain", "cocapn", "soul.md"), "utf8");
    assert.ok(soul.length > 0, "soul.md is not empty");
    assert.ok(soul.includes("alice"), "soul.md has username");
  });

  it(".gitignore has .env.local in brain repo", async () => {
    const gitignore = readFileSync(join(baseDir, "test-brain", ".gitignore"), "utf8");
    assert.ok(gitignore.includes(".env.local"), ".env.local in brain .gitignore");
  });

  it(".env.local is gitignored", async () => {
    // git check-ignore should confirm .env.local is ignored
    try {
      const output = execSync("git check-ignore .env.local", {
        cwd: join(baseDir, "test-brain"),
        encoding: "utf8",
        stdio: "pipe",
      });
      assert.ok(output.trim() === ".env.local", "git check-ignore confirms .env.local");
    } catch {
      assert.fail(".env.local should be gitignored but git check-ignore returned non-zero");
    }
  });
});

// ─── writeSecrets ─────────────────────────────────────────────────────────────

describe("writeSecrets", () => {
  it("writes secrets to .env.local", async () => {
    const { writeSecrets } = await import("../src/scaffold.js");
    const dir = tmpDir("secrets");
    try {
      // Create minimal .env.local first
      const { mkdirSync, writeFileSync } = await import("fs");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, ".env.local"), "");

      writeSecrets(dir, { DEEPSEEK_API_KEY: "sk-test-123" });
      const content = readFileSync(join(dir, ".env.local"), "utf8");
      assert.ok(content.includes("DEEPSEEK_API_KEY=sk-test-123"), "secret written");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── testLLMConnection (mocked) ───────────────────────────────────────────────

describe("testLLMConnection", () => {
  it("returns ok result on successful response", async () => {
    const { testLLMConnection } = await import("../src/scaffold.js");

    const originalFetch = global.fetch;
    global.fetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ id: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const result = await testLLMConnection("sk-test-key");
      assert.equal(result.ok, true);
      assert.ok(result.latencyMs >= 0, "latency is non-negative");
      assert.ok(typeof result.model === "string", "model is string");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns error on non-ok response", async () => {
    const { testLLMConnection } = await import("../src/scaffold.js");

    const originalFetch = global.fetch;
    global.fetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: "invalid key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const result = await testLLMConnection("sk-bad-key");
      assert.equal(result.ok, false);
      assert.ok(result.error, "error message present");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns error on network failure", async () => {
    const { testLLMConnection } = await import("../src/scaffold.js");

    const originalFetch = global.fetch;
    global.fetch = async (): Promise<Response> => {
      throw new Error("ECONNREFUSED");
    };

    try {
      const result = await testLLMConnection("sk-any-key");
      assert.equal(result.ok, false);
      assert.ok(result.error?.includes("ECONNREFUSED"), "error message contains cause");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ─── GitHub API (mocked) ─────────────────────────────────────────────────────

describe("createGitHubRepos", () => {
  it("derives correct repo names", async () => {
    const { createGitHubRepos } = await import("../src/scaffold.js");

    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      const body = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
      calls.push({ url, body });
      return new Response(JSON.stringify({ id: 1, name: "test" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const repos = await createGitHubRepos("fake-token", "testuser", "my-app");
      assert.equal(repos.publicRepo, "my-app-public");
      assert.equal(repos.privateRepo, "my-app-brain");
      assert.equal(calls.length, 2);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("validateToken", () => {
  it("returns username on valid token", async () => {
    const { validateToken } = await import("../src/scaffold.js");

    const originalFetch = global.fetch;
    global.fetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ login: "alice" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const result = await validateToken("valid-token");
      assert.equal(result, "alice");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns undefined on invalid token", async () => {
    const { validateToken } = await import("../src/scaffold.js");

    const originalFetch = global.fetch;
    global.fetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const result = await validateToken("bad-token");
      assert.equal(result, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
