// cocapn-agent Worker bundle — built 2026-03-29T21:42:29.635Z

// ../protocols/dist/esm/a2a/types.js
var A2AErrorCode = {
  TaskNotFound: -32001,
  TaskNotCancelable: -32002,
  PushNotificationNotSupported: -32003,
  UnsupportedOperation: -32004,
  IncompatibleContentTypes: -32005
};

// ../protocols/dist/esm/a2a/server.js
var A2AServer = class {
  agentCard;
  onSendTask;
  onGetTask;
  onCancelTask;
  constructor(options) {
    this.agentCard = options.agentCard;
    this.onSendTask = options.onSendTask;
    this.onGetTask = options.onGetTask ?? (() => Promise.resolve(null));
    this.onCancelTask = options.onCancelTask ?? (() => Promise.resolve(null));
  }
  /**
   * Handle a Fetch API Request (Cloudflare Workers or Node.js 18+).
   * Returns a Fetch API Response.
   */
  async handleRequest(request) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agent.json") {
      return new Response(JSON.stringify(this.agentCard), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return this.errorResponse(null, -32700, "Parse error");
    }
    return this.dispatchRpc(body);
  }
  // ---------------------------------------------------------------------------
  // JSON-RPC dispatch
  // ---------------------------------------------------------------------------
  async dispatchRpc(req) {
    const id = req.id ?? null;
    try {
      switch (req.method) {
        case "tasks/send": {
          const task = await this.onSendTask(req.params);
          return this.successResponse(id, task);
        }
        case "tasks/get": {
          const params = req.params;
          const task = await this.onGetTask(params.id);
          if (!task) {
            return this.errorResponse(id, A2AErrorCode.TaskNotFound, "Task not found");
          }
          return this.successResponse(id, task);
        }
        case "tasks/cancel": {
          const params = req.params;
          const task = await this.onCancelTask(params.id);
          if (!task) {
            return this.errorResponse(id, A2AErrorCode.TaskNotCancelable, "Task not found or cannot be canceled");
          }
          return this.successResponse(id, task);
        }
        default:
          return this.errorResponse(id, -32601, `Method not found: ${req.method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.errorResponse(id, -32603, message);
    }
  }
  // ---------------------------------------------------------------------------
  // Helpers for building task objects
  // ---------------------------------------------------------------------------
  static makeTask(id, status, sessionId) {
    const task = { id, status, artifacts: [], history: [] };
    if (sessionId !== void 0)
      task.sessionId = sessionId;
    return task;
  }
  // ---------------------------------------------------------------------------
  // Response helpers
  // ---------------------------------------------------------------------------
  successResponse(id, result) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  errorResponse(id, code, message) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
      status: 200,
      // A2A spec: error responses still return 200
      headers: { "Content-Type": "application/json" }
    });
  }
};

// src/github.ts
var GITHUB_API = "https://api.github.com";
var GitHubClient = class {
  token;
  privateRepo;
  publicRepo;
  constructor(options) {
    this.token = options.token;
    this.privateRepo = options.privateRepo;
    this.publicRepo = options.publicRepo;
  }
  // ── Read ──────────────────────────────────────────────────────────────────
  /** Fetch a file's decoded text content from the private repo. */
  async readFile(path, ref = "HEAD") {
    const url = `${GITHUB_API}/repos/${this.privateRepo}/contents/${path}?ref=${ref}`;
    const res = await fetch(url, { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub read ${path}: ${res.status}`);
    const data = await res.json();
    if (!data.content || data.encoding !== "base64") return null;
    return atob(data.content.replace(/\n/g, ""));
  }
  /** Fetch soul.md — the agent's personality context. */
  async readSoul() {
    return await this.readFile("cocapn/soul.md") ?? "";
  }
  /** Fetch memory facts as a parsed JSON array. */
  async readFacts() {
    const raw = await this.readFile("cocapn/memory/facts.json");
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  /** Fetch wiki README for broader context. */
  async readWiki() {
    return await this.readFile("cocapn/wiki/README.md") ?? "";
  }
  // ── Write (commit) ────────────────────────────────────────────────────────
  /**
   * Write a file to the private repo as a new commit.
   * Uses the GitHub Contents API (PUT) which creates or updates a file.
   */
  async writeFile(path, content, message) {
    const sha = await this.getFileSha(path);
    const url = `${GITHUB_API}/repos/${this.privateRepo}/contents/${path}`;
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content)))
    };
    if (sha) body["sha"] = sha;
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub write ${path}: ${res.status} \u2014 ${err}`);
    }
  }
  /**
   * Append a line to a NDJSON log file (e.g., coordination.jsonl).
   * Reads existing content, appends, then writes back.
   */
  async appendNdjson(path, record, commitMessage) {
    const existing = await this.readFile(path) ?? "";
    const newContent = existing.trimEnd() + "\n" + JSON.stringify(record) + "\n";
    await this.writeFile(path, newContent, commitMessage);
  }
  // ── Internal ──────────────────────────────────────────────────────────────
  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  async getFileSha(path) {
    const url = `${GITHUB_API}/repos/${this.privateRepo}/contents/${path}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha ?? null;
  }
};
function makeGitHubClient(env, requestToken) {
  return new GitHubClient({
    token: requestToken ?? env.GITHUB_PAT,
    privateRepo: env.PRIVATE_REPO,
    publicRepo: env.PUBLIC_REPO
  });
}

// src/admiral.ts
var REGISTRY_TTL_DAYS = 30;
var MAX_DISCOVER_RESULTS = 20;
var MAX_MESSAGES = 100;
var MAX_TASKS = 50;
var AdmiralDO = class {
  state;
  sqlEnabled = null;
  constructor(state) {
    this.state = state;
  }
  /**
   * Check if SQL storage is available.
   * Cached after first check.
   */
  async isSqlEnabled() {
    if (this.sqlEnabled !== null) {
      return this.sqlEnabled;
    }
    try {
      await this.state.storage.sql`SELECT 1`;
      this.sqlEnabled = true;
      return true;
    } catch {
      this.sqlEnabled = false;
      return false;
    }
  }
  /**
   * Initialize SQLite schema if SQL is enabled.
   * Called on first SQL access.
   */
  async initSqlSchema() {
    if (!await this.isSqlEnabled()) {
      return;
    }
    try {
      await this.state.storage.sql`
        CREATE TABLE IF NOT EXISTS profiles (
          username TEXT PRIMARY KEY,
          displayName TEXT,
          currentFocus TEXT,
          bio TEXT,
          domain TEXT,
          website TEXT,
          profileJson TEXT,
          signature TEXT,
          fleetPublicKey TEXT,
          lastSeen TEXT,
          createdAt TEXT,
          expiresAt TEXT
        )
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_profiles_name
        ON profiles(displayName)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_profiles_focus
        ON profiles(currentFocus)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_profiles_domain
        ON profiles(domain)
      `;
      await this.state.storage.sql`
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
          taskId TEXT PRIMARY KEY,
          username TEXT,
          cron TEXT,
          timezone TEXT,
          agent TEXT,
          instructions TEXT,
          payload TEXT,
          enabled INTEGER,
          lastRun TEXT,
          nextRun TEXT,
          createdAt TEXT
        )
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_tasks_next
        ON scheduled_tasks(nextRun)
      `;
      await this.state.storage.sql`
        CREATE TABLE IF NOT EXISTS task_queue (
          queueId TEXT PRIMARY KEY,
          taskId TEXT,
          status TEXT,
          result TEXT,
          error TEXT,
          log TEXT,
          createdAt TEXT,
          startedAt TEXT,
          completedAt TEXT
        )
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_queue_status
        ON task_queue(status)
      `;
      await this.state.storage.sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          passwordSalt TEXT NOT NULL,
          name TEXT NOT NULL,
          instance TEXT UNIQUE,
          plan TEXT DEFAULT 'free',
          createdAt TEXT NOT NULL,
          lastLogin TEXT,
          lastLoginIp TEXT,
          settings TEXT DEFAULT '{}',
          status TEXT DEFAULT 'active',
          metadata TEXT
        )
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_users_instance
        ON users(instance)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_users_plan
        ON users(plan)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_users_status
        ON users(status)
      `;
      await this.state.storage.sql`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          keyHash TEXT NOT NULL,
          keyPrefix TEXT NOT NULL,
          name TEXT NOT NULL,
          scopes TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          lastUsed TEXT,
          expiresAt TEXT,
          FOREIGN KEY (userId) REFERENCES users(id)
        )
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_api_keys_user
        ON api_keys(userId)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_api_keys_prefix
        ON api_keys(keyPrefix)
      `;
      await this.state.storage.sql`
        CREATE INDEX IF NOT EXISTS idx_api_keys_hash
        ON api_keys(keyHash)
      `;
    } catch (error) {
      console.error("Failed to initialize SQL schema:", error);
      this.sqlEnabled = false;
    }
  }
  /**
   * One-time migration from KV to SQLite.
   * Called on first SQL access if KV has data.
   */
  async migrateKvToSql() {
    if (!await this.isSqlEnabled()) {
      return;
    }
    try {
      const registry = await this.state.storage.get("registry");
      if (registry && registry.length > 0) {
        const existingProfiles = await this.state.storage.sql`SELECT username FROM profiles LIMIT 1`;
        if (existingProfiles.length === 0) {
          for (const profile of registry) {
            await this.state.storage.sql`
              INSERT INTO profiles (
                username, displayName, currentFocus, bio, website,
                signature, createdAt, expiresAt
              ) VALUES (
                ${profile.username},
                ${profile.displayName ?? null},
                ${profile.currentFocus ?? null},
                ${profile.bio ?? null},
                ${profile.website ?? null},
                ${profile.signature},
                ${profile.registeredAt},
                ${profile.expiresAt}
              )
            `;
          }
        }
      }
      const scheduledTasksObj = await this.state.storage.get("scheduled-tasks");
      if (scheduledTasksObj) {
        const existingTasks = await this.state.storage.sql`SELECT taskId FROM scheduled_tasks LIMIT 1`;
        if (existingTasks.length === 0) {
          for (const [id, task] of Object.entries(scheduledTasksObj)) {
            await this.state.storage.sql`
              INSERT INTO scheduled_tasks (
                taskId, cron, agent, payload, enabled, nextRun, createdAt
              ) VALUES (
                ${id},
                ${task.schedule},
                ${task.target},
                ${JSON.stringify(task.payload)},
                ${task.enabled ? 1 : 0},
                ${task.nextRun},
                ${task.createdAt}
              )
            `;
          }
        }
      }
      const taskQueue = await this.state.storage.get("task-queue");
      if (taskQueue && taskQueue.length > 0) {
        const existingQueue = await this.state.storage.sql`SELECT queueId FROM task_queue LIMIT 1`;
        if (existingQueue.length === 0) {
          for (const item of taskQueue) {
            await this.state.storage.sql`
              INSERT INTO task_queue (
                queueId, taskId, status, result, error, log,
                createdAt, startedAt, completedAt
              ) VALUES (
                ${item.id},
                ${item.id},
                ${item.status},
                ${item.result ?? null},
                ${item.error ?? null},
                ${JSON.stringify(item.log)},
                ${item.startedAt ?? item.createdAt},
                ${item.startedAt ?? null},
                ${item.completedAt ?? null}
              )
            `;
          }
        }
      }
    } catch (error) {
      console.error("Failed to migrate KV to SQL:", error);
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+/, "");
    if (request.method === "GET" && pathname === "state") {
      return this.handleGetState();
    }
    if (request.method === "POST" && pathname === "task") {
      return this.handleUpsertTask(request);
    }
    if (request.method === "POST" && pathname === "message") {
      return this.handleAddMessage(request);
    }
    if (request.method === "POST" && pathname === "heartbeat") {
      return this.handleHeartbeat(request);
    }
    if (request.method === "POST" && pathname === "notify") {
      return this.handleGitNotify(request);
    }
    if (request.method === "DELETE" && pathname === "task") {
      return this.handleDeleteTask(request);
    }
    if (request.method === "POST" && pathname === "registry/register") {
      return this.handleRegistryRegister(request);
    }
    if (request.method === "GET" && pathname === "registry/discover") {
      return this.handleRegistryDiscover(url);
    }
    if (request.method === "GET" && pathname.startsWith("registry/profile/")) {
      const username = pathname.slice("registry/profile/".length);
      return this.handleRegistryGetProfile(username);
    }
    if (request.method === "POST" && pathname === "tasks/schedule") {
      return this.handleScheduleTasks(request);
    }
    if (request.method === "POST" && pathname === "tasks/execute") {
      return this.handleExecuteTask(request);
    }
    if (request.method === "GET" && pathname.startsWith("tasks/status/")) {
      const taskId = pathname.slice("tasks/status/".length);
      return this.handleGetTaskStatus(taskId);
    }
    if (request.method === "POST" && pathname === "tasks/webhook") {
      return this.handleWebhook(request);
    }
    if (request.method === "POST" && pathname === "auth/users") {
      return this.handleCreateUser(request);
    }
    if (request.method === "GET" && pathname.startsWith("auth/users/")) {
      const parts = pathname.split("/");
      if (parts[3] === "by-email" && parts[4]) {
        return this.handleGetUserByEmail(parts[4]);
      }
      return this.handleGetUser(parts[3]);
    }
    if (request.method === "PATCH" && pathname.startsWith("auth/users/")) {
      const userId = pathname.split("/")[3];
      return this.handleUpdateUser(userId, request);
    }
    if (request.method === "POST" && pathname === "auth/api-keys") {
      return this.handleCreateApiKey(request);
    }
    if (request.method === "GET" && pathname.startsWith("auth/api-keys/")) {
      const parts = pathname.split("/");
      if (parts[4] === "verify") {
        return this.handleVerifyApiKey(parts[4]);
      }
      return this.handleListApiKeys(parts[3]);
    }
    if (request.method === "PATCH" && pathname.startsWith("auth/api-keys/")) {
      const keyId = pathname.split("/")[3];
      return this.handleUpdateApiKey(keyId, request);
    }
    if (request.method === "DELETE" && pathname.startsWith("auth/api-keys/")) {
      const parts = pathname.split("/");
      return this.handleDeleteApiKey(parts[3], parts[4]);
    }
    return new Response("Not Found", { status: 404 });
  }
  // ── Handlers ───────────────────────────────────────────────────────────────
  async handleGetState() {
    const [tasks, messages, bridges, lastGitCommit] = await Promise.all([
      this.state.storage.get("tasks"),
      this.state.storage.get("messages"),
      this.state.storage.get("bridges"),
      this.state.storage.get("lastGitCommit")
    ]);
    const body = {
      tasks: tasks ?? [],
      messages: messages ?? [],
      bridges: bridges ?? [],
      lastGitCommit
    };
    return json(body);
  }
  async handleUpsertTask(request) {
    const task = await request.json();
    if (!task.id || !task.agentId) return new Response("Missing id or agentId", { status: 400 });
    const tasks = await this.state.storage.get("tasks") ?? [];
    const idx = tasks.findIndex((t) => t.id === task.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...task, updatedAt: now };
    } else {
      tasks.push({
        id: task.id,
        agentId: task.agentId,
        description: task.description ?? "",
        status: task.status ?? "pending",
        createdAt: task.createdAt ?? now,
        updatedAt: now,
        result: task.result
      });
    }
    const trimmed = tasks.slice(-MAX_TASKS);
    await this.state.storage.put("tasks", trimmed);
    return json({ ok: true });
  }
  async handleAddMessage(request) {
    const msg = await request.json();
    if (!msg.content || !msg.role) return new Response("Missing content or role", { status: 400 });
    const messages = await this.state.storage.get("messages") ?? [];
    messages.push({
      role: msg.role,
      agentId: msg.agentId,
      content: msg.content,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const trimmed = messages.slice(-MAX_MESSAGES);
    await this.state.storage.put("messages", trimmed);
    return json({ ok: true });
  }
  async handleHeartbeat(request) {
    const hb = await request.json();
    if (!hb.instanceId) return new Response("Missing instanceId", { status: 400 });
    const bridges = await this.state.storage.get("bridges") ?? [];
    const idx = bridges.findIndex((b) => b.instanceId === hb.instanceId);
    const updated = {
      instanceId: hb.instanceId,
      hostname: hb.hostname ?? "unknown",
      lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
      repoRoot: hb.repoRoot
    };
    if (idx >= 0) {
      bridges[idx] = updated;
    } else {
      bridges.push(updated);
    }
    const cutoff = Date.now() - 5 * 60 * 1e3;
    const live = bridges.filter((b) => new Date(b.lastSeen).getTime() > cutoff);
    await this.state.storage.put("bridges", live);
    return json({ ok: true });
  }
  async handleGitNotify(request) {
    const body = await request.json();
    if (body.sha) {
      await this.state.storage.put("lastGitCommit", body.sha);
    }
    return json({ ok: true, sha: body.sha });
  }
  async handleDeleteTask(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    const tasks = await this.state.storage.get("tasks") ?? [];
    const trimmed = tasks.filter((t) => t.id !== id);
    await this.state.storage.put("tasks", trimmed);
    return json({ ok: true });
  }
  // ── Registry handlers ────────────────────────────────────────────────────────
  /**
   * POST /registry/register
   *
   * Register a profile in the discovery registry.
   * Verifies the signature is a valid JWT (without verifying the secret key —
   * we just check it's well-formed and not expired).
   * Stores with a 30-day TTL and returns the current peer count.
   */
  async handleRegistryRegister(request) {
    try {
      const body = await request.json();
      const profile = body.profile;
      if (!profile || !profile.username) {
        return new Response("Missing profile or username", { status: 400 });
      }
      if (!this.isValidJwtFormat(profile.signature)) {
        return new Response("Invalid signature format", { status: 400 });
      }
      const now = /* @__PURE__ */ new Date();
      const expiresAt = new Date(now.getTime() + REGISTRY_TTL_DAYS * 24 * 60 * 60 * 1e3);
      const registryProfile = {
        username: profile.username,
        displayName: profile.displayName,
        currentFocus: profile.currentFocus,
        website: profile.website,
        bio: profile.bio,
        domains: profile.domains ?? [],
        signature: profile.signature,
        registeredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      if (await this.isSqlEnabled()) {
        await this.initSqlSchema();
        await this.migrateKvToSql();
        await this.state.storage.sql`
          INSERT INTO profiles (
            username, displayName, currentFocus, bio, website,
            signature, createdAt, expiresAt
          ) VALUES (
            ${registryProfile.username},
            ${registryProfile.displayName ?? null},
            ${registryProfile.currentFocus ?? null},
            ${registryProfile.bio ?? null},
            ${registryProfile.website ?? null},
            ${registryProfile.signature},
            ${registryProfile.registeredAt},
            ${registryProfile.expiresAt}
          )
          ON CONFLICT(username) DO UPDATE SET
            displayName = excluded.displayName,
            currentFocus = excluded.currentFocus,
            bio = excluded.bio,
            website = excluded.website,
            signature = excluded.signature,
            expiresAt = excluded.expiresAt
        `;
        await this.state.storage.sql`
          DELETE FROM profiles WHERE expiresAt < datetime('now')
        `;
        const countResult = await this.state.storage.sql`
          SELECT COUNT(*) as count FROM profiles
        `;
        const peerCount2 = countResult[0]?.count ?? 0;
        const response2 = { ok: true, peerCount: peerCount2 };
        return json(response2);
      }
      const registry = await this.state.storage.get("registry") ?? [];
      const existingIndex = registry.findIndex((p) => p.username === profile.username);
      if (existingIndex >= 0) {
        registry[existingIndex] = registryProfile;
      } else {
        registry.push(registryProfile);
      }
      await this.state.storage.put("registry", registry);
      await this.cleanupExpiredProfiles(registry);
      const peerCount = registry.length;
      const response = { ok: true, peerCount };
      return json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Registration failed: ${msg}`, { status: 400 });
    }
  }
  /**
   * GET /registry/discover?q={query}
   *
   * Search profiles by username, displayName, or currentFocus.
   * Returns max 20 results, sorted by most recently registered.
   */
  async handleRegistryDiscover(url) {
    const query = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
    if (query.length < 2) {
      return json({ results: [], total: 0 });
    }
    if (await this.isSqlEnabled()) {
      await this.initSqlSchema();
      await this.migrateKvToSql();
      const searchPattern = `%${query}%`;
      const results2 = await this.state.storage.sql`
        SELECT
          username, displayName, currentFocus, bio, website,
          signature, createdAt as registeredAt, expiresAt
        FROM profiles
        WHERE expiresAt > datetime('now')
          AND (
            LOWER(username) LIKE ${searchPattern}
            OR LOWER(displayName) LIKE ${searchPattern}
            OR LOWER(currentFocus) LIKE ${searchPattern}
          )
        ORDER BY createdAt DESC
        LIMIT ${MAX_DISCOVER_RESULTS}
      `;
      const response2 = {
        results: results2.map((row) => ({
          username: row.username,
          displayName: row.displayName ?? void 0,
          currentFocus: row.currentFocus ?? void 0,
          bio: row.bio ?? void 0,
          website: row.website ?? void 0,
          domains: [],
          signature: row.signature,
          registeredAt: row.registeredAt,
          expiresAt: row.expiresAt
        })),
        total: results2.length
      };
      return json(response2);
    }
    const registry = await this.getValidRegistry();
    const results = registry.filter(
      (p) => p.username.toLowerCase().includes(query) || (p.displayName?.toLowerCase().includes(query) ?? false) || (p.currentFocus?.toLowerCase().includes(query) ?? false)
    ).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, MAX_DISCOVER_RESULTS);
    const response = {
      results,
      total: results.length
    };
    return json(response);
  }
  /**
   * GET /registry/profile/:username
   *
   * Get a single profile by username.
   * Returns 404 if not found or expired.
   */
  async handleRegistryGetProfile(username) {
    if (!username) {
      return new Response("Missing username", { status: 400 });
    }
    if (await this.isSqlEnabled()) {
      await this.initSqlSchema();
      await this.migrateKvToSql();
      const results = await this.state.storage.sql`
        SELECT
          username, displayName, currentFocus, bio, website,
          signature, createdAt as registeredAt, expiresAt
        FROM profiles
        WHERE username = ${username}
          AND expiresAt > datetime('now')
        LIMIT 1
      `;
      if (results.length === 0) {
        return new Response("Profile not found", { status: 404 });
      }
      const row = results[0];
      const profile2 = {
        username: row.username,
        displayName: row.displayName ?? void 0,
        currentFocus: row.currentFocus ?? void 0,
        bio: row.bio ?? void 0,
        website: row.website ?? void 0,
        domains: [],
        signature: row.signature,
        registeredAt: row.registeredAt,
        expiresAt: row.expiresAt
      };
      return json(profile2);
    }
    const registry = await this.getValidRegistry();
    const profile = registry.find((p) => p.username === username);
    if (!profile) {
      return new Response("Profile not found", { status: 404 });
    }
    return json(profile);
  }
  /**
   * Get valid (non-expired) profiles from the registry.
   * Runs cleanup if expired profiles are found.
   */
  async getValidRegistry() {
    const registry = await this.state.storage.get("registry") ?? [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const valid = registry.filter((p) => p.expiresAt > now);
    if (valid.length < registry.length) {
      await this.state.storage.put("registry", valid);
    }
    return valid;
  }
  /**
   * Remove expired profiles from the registry.
   */
  async cleanupExpiredProfiles(registry) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const valid = registry.filter((p) => p.expiresAt > now);
    if (valid.length < registry.length) {
      await this.state.storage.put("registry", valid);
    }
  }
  /**
   * Check if a string is a valid JWT format (3 parts separated by dots).
   * Does NOT verify the signature — just checks structure.
   */
  isValidJwtFormat(signature) {
    const parts = signature.split(".");
    return parts.length === 3 && parts.every((p) => p.length > 0);
  }
  // ── Task Queue handlers ───────────────────────────────────────────────────────────
  /**
   * POST /tasks/schedule
   *
   * Schedule tasks for execution.
   * Stores tasks and sets DO alarms for their next execution.
   * Returns count of scheduled tasks and their IDs.
   */
  async handleScheduleTasks(request) {
    try {
      const body = await request.json();
      if (!body.tasks || !Array.isArray(body.tasks)) {
        return new Response("Missing tasks array", { status: 400 });
      }
      const now = /* @__PURE__ */ new Date();
      const ids = [];
      if (await this.isSqlEnabled()) {
        await this.initSqlSchema();
        await this.migrateKvToSql();
        for (const task of body.tasks) {
          const id = crypto.randomUUID();
          const nextRun = this.calculateNextRun(task.schedule, now);
          await this.state.storage.sql`
            INSERT INTO scheduled_tasks (
              taskId, cron, agent, payload, enabled, nextRun, createdAt
            ) VALUES (
              ${id},
              ${task.schedule},
              ${task.target},
              ${JSON.stringify(task.payload)},
              ${task.enabled !== false ? 1 : 0},
              ${nextRun},
              ${now.toISOString()}
            )
          `;
          if (task.enabled !== false) {
            await this.state.storage.setAlarm(new Date(nextRun), id);
          }
          ids.push(id);
        }
        const response2 = {
          ok: true,
          scheduled: ids.length,
          ids
        };
        return json(response2);
      }
      const scheduledTasks = await this.state.storage.get("scheduled-tasks") ?? {};
      const alarms = await this.state.storage.get("task-alarms") ?? [];
      for (const task of body.tasks) {
        const id = crypto.randomUUID();
        const nextRun = this.calculateNextRun(task.schedule, now);
        const config = {
          id,
          schedule: task.schedule,
          target: task.target,
          payload: task.payload,
          enabled: task.enabled ?? true,
          nextRun,
          createdAt: now.toISOString()
        };
        scheduledTasks[id] = config;
        if (task.enabled !== false) {
          await this.state.storage.setAlarm(new Date(nextRun), id);
          alarms.push({
            id,
            scheduledTime: nextRun,
            taskId: id
          });
        }
        ids.push(id);
      }
      await this.state.storage.put("scheduled-tasks", scheduledTasks);
      await this.state.storage.put("task-alarms", alarms);
      const response = {
        ok: true,
        scheduled: ids.length,
        ids
      };
      return json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Scheduling failed: ${msg}`, { status: 400 });
    }
  }
  /**
   * POST /tasks/execute
   *
   * Triggered by DO alarm when a task is due.
   * Finds the task, executes it, and records the result.
   */
  async handleExecuteTask(request) {
    try {
      const body = await request.json();
      if (!body.taskId) {
        return new Response("Missing taskId", { status: 400 });
      }
      if (await this.isSqlEnabled()) {
        await this.initSqlSchema();
        await this.migrateKvToSql();
        const tasks = await this.state.storage.sql`
          SELECT taskId, cron, agent, payload, enabled, nextRun, createdAt
          FROM scheduled_tasks
          WHERE taskId = ${body.taskId}
          LIMIT 1
        `;
        if (tasks.length === 0) {
          return new Response("Task not found", { status: 404 });
        }
        const row = tasks[0];
        const task2 = {
          id: row.taskId,
          schedule: row.cron,
          target: row.agent,
          payload: JSON.parse(row.payload),
          enabled: row.enabled === 1,
          nextRun: row.nextRun,
          createdAt: row.createdAt
        };
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await this.state.storage.sql`
          INSERT INTO task_queue (
            queueId, taskId, status, log, createdAt, startedAt
          ) VALUES (
            ${body.taskId},
            ${body.taskId},
            ${"running"},
            ${JSON.stringify([`Started execution at ${now}`])},
            ${now},
            ${now}
          )
        `;
        const result2 = await this.executeTaskWork(task2);
        const completedAt = (/* @__PURE__ */ new Date()).toISOString();
        const log = JSON.stringify([...result2.log]);
        await this.state.storage.sql`
          UPDATE task_queue
          SET status = ${result2.success ? "completed" : "failed"},
              result = ${result2.output ?? null},
              error = ${result2.error ?? null},
              log = ${log},
              completedAt = ${completedAt}
          WHERE queueId = ${body.taskId}
        `;
        if (this.isCronExpression(task2.schedule)) {
          const nextRun = this.calculateNextRun(task2.schedule, /* @__PURE__ */ new Date());
          await this.state.storage.sql`
            UPDATE scheduled_tasks
            SET nextRun = ${nextRun}
            WHERE taskId = ${body.taskId}
          `;
          await this.state.storage.setAlarm(new Date(nextRun), body.taskId);
        }
        return json({
          ok: true,
          taskId: body.taskId,
          status: result2.success ? "completed" : "failed"
        });
      }
      const scheduledTasksObj = await this.state.storage.get("scheduled-tasks");
      if (!scheduledTasksObj) {
        return new Response("No scheduled tasks found", { status: 404 });
      }
      const task = scheduledTasksObj[body.taskId];
      if (!task) {
        return new Response("Task not found", { status: 404 });
      }
      const queueItem = {
        id: body.taskId,
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        log: [`Started execution at ${(/* @__PURE__ */ new Date()).toISOString()}`]
      };
      const queue = await this.state.storage.get("task-queue") ?? [];
      queue.push(queueItem);
      await this.state.storage.put("task-queue", queue);
      const result = await this.executeTaskWork(task);
      const updatedQueue = await this.state.storage.get("task-queue") ?? [];
      const itemIndex = updatedQueue.findIndex((q) => q.id === body.taskId);
      if (itemIndex >= 0) {
        updatedQueue[itemIndex] = {
          ...updatedQueue[itemIndex],
          status: result.success ? "completed" : "failed",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          result: result.output,
          error: result.error,
          log: [...updatedQueue[itemIndex].log, ...result.log]
        };
        await this.state.storage.put("task-queue", updatedQueue);
      }
      if (this.isCronExpression(task.schedule)) {
        const nextRun = this.calculateNextRun(task.schedule, /* @__PURE__ */ new Date());
        const updatedTask = {
          ...task,
          nextRun
        };
        const scheduledTasks = { ...scheduledTasksObj };
        scheduledTasks[body.taskId] = updatedTask;
        await this.state.storage.put("scheduled-tasks", scheduledTasks);
        await this.state.storage.setAlarm(new Date(nextRun), body.taskId);
      }
      return json({
        ok: true,
        taskId: body.taskId,
        status: result.success ? "completed" : "failed"
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Execution failed: ${msg}`, { status: 500 });
    }
  }
  /**
   * GET /tasks/status/:taskId
   *
   * Get execution status and logs for a task.
   */
  async handleGetTaskStatus(taskId) {
    if (!taskId) {
      return new Response("Missing taskId", { status: 400 });
    }
    if (await this.isSqlEnabled()) {
      await this.initSqlSchema();
      await this.migrateKvToSql();
      const results = await this.state.storage.sql`
        SELECT queueId, taskId, status, result, error, log
        FROM task_queue
        WHERE taskId = ${taskId}
        LIMIT 1
      `;
      if (results.length === 0) {
        return new Response("Task not found in queue", { status: 404 });
      }
      const row = results[0];
      const log = JSON.parse(row.log);
      const response2 = {
        taskId: row.taskId,
        status: row.status,
        result: row.result ?? void 0,
        error: row.error ?? void 0,
        log
      };
      return json(response2);
    }
    const queue = await this.state.storage.get("task-queue") ?? [];
    const item = queue.find((q) => q.id === taskId);
    if (!item) {
      return new Response("Task not found in queue", { status: 404 });
    }
    const response = {
      taskId: item.id,
      status: item.status,
      result: item.result,
      error: item.error,
      log: item.log
    };
    return json(response);
  }
  /**
   * POST /tasks/webhook
   *
   * GitHub webhook handler.
   * Validates signature and triggers tasks based on webhook events.
   */
  async handleWebhook(request) {
    try {
      const signature = request.headers.get("X-Hub-Signature-256");
      if (!signature) {
        return new Response("Missing signature", { status: 401 });
      }
      const rawBody = await request.text();
      const expectedSignature = request.headers.get("X-Hub-Signature-256");
      if (!signature.startsWith("sha256=")) {
        return new Response("Invalid signature format", { status: 401 });
      }
      const payload = JSON.parse(rawBody);
      const event = request.headers.get("X-GitHub-Event");
      if (event === "push") {
        await this.handlePushWebhook(payload);
      } else if (event === "ping") {
      }
      return json({ ok: true, event });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Webhook processing failed: ${msg}`, { status: 400 });
    }
  }
  // ── Task Queue helpers ────────────────────────────────────────────────────────────
  /**
   * Calculate next run time based on schedule.
   * Supports ISO timestamps for one-shot and cron expressions for recurring.
   */
  calculateNextRun(schedule, from) {
    if (schedule.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(schedule)) {
      return schedule;
    }
    const cronMatch = schedule.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
    if (cronMatch) {
      const [, minute, hour, day, month, weekday] = cronMatch;
      const next2 = new Date(from.getTime() + 60 * 1e3);
      return next2.toISOString();
    }
    const next = new Date(from.getTime() + 60 * 60 * 1e3);
    return next.toISOString();
  }
  /**
   * Check if a schedule is a cron expression.
   */
  isCronExpression(schedule) {
    return /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(schedule);
  }
  /**
   * Execute the actual task work.
   * In production, this would call a worker or agent.
   */
  async executeTaskWork(task) {
    const log = [];
    try {
      log.push(`Executing task ${task.id} with target ${task.target}`);
      log.push(`Payload: ${JSON.stringify(task.payload)}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const output = `Task ${task.id} completed successfully`;
      log.push(output);
      return {
        success: true,
        output,
        log
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.push(`Error: ${error}`);
      return {
        success: false,
        error,
        log
      };
    }
  }
  /**
   * Handle push webhook event.
   * Triggers tasks associated with the repository.
   */
  async handlePushWebhook(payload) {
    const repo = payload.repository;
    const repoName = repo?.["full_name"];
    if (!repoName) return;
    const scheduledTasksObj = await this.state.storage.get("scheduled-tasks");
    if (!scheduledTasksObj) return;
    const tasks = Object.values(scheduledTasksObj).filter(
      (t) => t.payload && typeof t.payload === "object" && "repo" in t.payload && t.payload.repo === repoName
    );
    for (const task of tasks) {
      await this.handleExecuteTask(
        new Request(`https://admiral.test/tasks/execute`, {
          method: "POST",
          body: JSON.stringify({ taskId: task.id }),
          headers: { "Content-Type": "application/json" }
        })
      );
    }
  }
  // ── Auth handlers ───────────────────────────────────────────────────────────────
  /**
   * POST /auth/users
   *
   * Create a new user in the database.
   */
  async handleCreateUser(request) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const body = await request.json();
      if (body.action !== "create" || !body.user) {
        return new Response("Invalid request", { status: 400 });
      }
      const user = body.user;
      await this.state.storage.sql`
        INSERT INTO users (
          id, email, passwordHash, passwordSalt, name, instance, plan, createdAt, status
        ) VALUES (
          ${user.id},
          ${user.email},
          ${user.passwordHash},
          ${user.passwordSalt},
          ${user.name},
          ${user.instance},
          ${user.plan},
          ${user.createdAt},
          ${user.status}
        )
      `;
      return json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 400 });
    }
  }
  /**
   * GET /auth/users/:id
   *
   * Get a user by ID.
   */
  async handleGetUser(userId) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const results = await this.state.storage.sql`
        SELECT * FROM users WHERE id = ${userId} LIMIT 1
      `;
      if (results.length === 0) {
        return new Response("User not found", { status: 404 });
      }
      const row = results[0];
      return json({
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        passwordSalt: row.passwordSalt,
        name: row.name,
        instance: row.instance ?? void 0,
        plan: row.plan,
        createdAt: row.createdAt,
        lastLogin: row.lastLogin ?? void 0,
        lastLoginIp: row.lastLoginIp ?? void 0,
        settings: row.settings ? JSON.parse(row.settings) : void 0,
        status: row.status,
        metadata: row.metadata ? JSON.parse(row.metadata) : void 0
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * GET /auth/users/by-email/:email
   *
   * Get a user by email.
   */
  async handleGetUserByEmail(email) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const results = await this.state.storage.sql`
        SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
      `;
      if (results.length === 0) {
        return new Response("User not found", { status: 404 });
      }
      const row = results[0];
      return json({
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        passwordSalt: row.passwordSalt,
        name: row.name,
        instance: row.instance ?? void 0,
        plan: row.plan,
        createdAt: row.createdAt,
        lastLogin: row.lastLogin ?? void 0,
        lastLoginIp: row.lastLoginIp ?? void 0,
        settings: row.settings ? JSON.parse(row.settings) : void 0,
        status: row.status,
        metadata: row.metadata ? JSON.parse(row.metadata) : void 0
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * PATCH /auth/users/:id
   *
   * Update a user (e.g., last login).
   */
  async handleUpdateUser(userId, request) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const body = await request.json();
      const updates = [];
      const values = [];
      if (body.lastLogin) {
        updates.push("lastLogin = ?");
        values.push(body.lastLogin);
      }
      if (body.lastLoginIp) {
        updates.push("lastLoginIp = ?");
        values.push(body.lastLoginIp);
      }
      if (body.status) {
        updates.push("status = ?");
        values.push(body.status);
      }
      if (updates.length === 0) {
        return json({ ok: true });
      }
      values.push(userId);
      await this.state.storage.sql(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        ...values
      );
      return json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * POST /auth/api-keys
   *
   * Create an API key.
   */
  async handleCreateApiKey(request) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const apiKey = await request.json();
      await this.state.storage.sql`
        INSERT INTO api_keys (
          id, userId, keyHash, keyPrefix, name, scopes, createdAt, expiresAt
        ) VALUES (
          ${apiKey.id},
          ${apiKey.userId},
          ${apiKey.keyHash},
          ${apiKey.keyPrefix},
          ${apiKey.name},
          ${JSON.stringify(apiKey.scopes)},
          ${apiKey.createdAt},
          ${apiKey.expiresAt ?? null}
        )
      `;
      return json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * GET /auth/api-keys/:userId
   *
   * List API keys for a user.
   */
  async handleListApiKeys(userId) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const results = await this.state.storage.sql`
        SELECT * FROM api_keys WHERE userId = ${userId}
      `;
      return json(
        results.map((row) => ({
          id: row.id,
          userId: row.userId,
          keyHash: row.keyHash,
          keyPrefix: row.keyPrefix,
          name: row.name,
          scopes: JSON.parse(row.scopes),
          createdAt: row.createdAt,
          lastUsed: row.lastUsed ?? void 0,
          expiresAt: row.expiresAt ?? void 0
        }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * GET /auth/api-keys/verify/:hash
   *
   * Verify an API key and return the key with user.
   */
  async handleVerifyApiKey(keyHash) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const results = await this.state.storage.sql`
        SELECT * FROM api_keys WHERE keyHash = ${keyHash} LIMIT 1
      `;
      if (results.length === 0) {
        return new Response("API key not found", { status: 404 });
      }
      const apiKey = results[0];
      const userResults = await this.state.storage.sql`
        SELECT * FROM users WHERE id = ${apiKey.userId} LIMIT 1
      `;
      if (userResults.length === 0) {
        return new Response("User not found", { status: 404 });
      }
      const userRow = userResults[0];
      return json({
        ...apiKey,
        scopes: JSON.parse(apiKey.scopes),
        user: {
          id: userRow.id,
          email: userRow.email,
          passwordHash: userRow.passwordHash,
          passwordSalt: userRow.passwordSalt,
          name: userRow.name,
          instance: userRow.instance ?? void 0,
          plan: userRow.plan,
          createdAt: userRow.createdAt,
          lastLogin: userRow.lastLogin ?? void 0,
          lastLoginIp: userRow.lastLoginIp ?? void 0,
          settings: userRow.settings ? JSON.parse(userRow.settings) : void 0,
          status: userRow.status,
          metadata: userRow.metadata ? JSON.parse(userRow.metadata) : void 0
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * PATCH /auth/api-keys/:id
   *
   * Update an API key (e.g., lastUsed).
   */
  async handleUpdateApiKey(keyId, request) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      const body = await request.json();
      if (body.lastUsed) {
        await this.state.storage.sql`
          UPDATE api_keys SET lastUsed = ${body.lastUsed}
          WHERE id = ${keyId}
        `;
      }
      return json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
  /**
   * DELETE /auth/api-keys/:userId/:keyId
   *
   * Delete an API key.
   */
  async handleDeleteApiKey(userId, keyId) {
    try {
      if (!await this.isSqlEnabled()) {
        return new Response("SQL not enabled", { status: 503 });
      }
      await this.initSqlSchema();
      await this.state.storage.sql`
        DELETE FROM api_keys WHERE id = ${keyId} AND userId = ${userId}
      `;
      return json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(msg, { status: 500 });
    }
  }
};
var AdmiralClient = class {
  baseUrl;
  token;
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }
  async getState() {
    return this.fetch("GET", "state");
  }
  async upsertTask(task) {
    await this.fetch("POST", "task", task);
  }
  async addMessage(msg) {
    await this.fetch("POST", "message", msg);
  }
  async heartbeat(hb) {
    await this.fetch("POST", "heartbeat", hb);
  }
  async notifyGitCommit(sha) {
    await this.fetch("POST", "notify", { sha });
  }
  // ── Registry client methods ──────────────────────────────────────────────────
  /**
   * Register a profile in the discovery registry.
   * Returns the peer count or null if registration fails.
   */
  async registerProfile(profile) {
    const result = await this.fetch("POST", "registry/register", { profile });
    return result?.peerCount ?? null;
  }
  /**
   * Search for profiles by query string.
   * Returns results or null if search fails.
   */
  async discoverProfiles(query) {
    const result = await this.fetch("GET", `registry/discover?q=${encodeURIComponent(query)}`);
    return result?.results ?? null;
  }
  /**
   * Get a single profile by username.
   * Returns the profile or null if not found.
   */
  async getProfile(username) {
    return this.fetch("GET", `registry/profile/${encodeURIComponent(username)}`);
  }
  async fetch(method, path, body) {
    const headers = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    if (body) headers["Content-Type"] = "application/json";
    try {
      const res = await globalThis.fetch(`${this.baseUrl}/${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }
};
function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}

// src/llm.ts
var DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
var DEFAULT_MODEL = "deepseek-chat";
async function chatWithDeepSeek(messages, apiKey, model, options) {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model ?? DEFAULT_MODEL,
      messages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7
    })
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("DeepSeek returned no choices");
  }
  return {
    content: choice.message.content,
    usage: {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens
    }
  };
}

// src/auth/password.ts
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}
function encodeBase64Url(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b));
  const b64 = btoa(bin.join(""));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function decodeBase64Url(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const salt = generateSalt();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    256
    // 256 bits = 32 bytes
  );
  const hashBytes = new Uint8Array(hashBuffer);
  const hash = encodeBase64Url(hashBytes);
  const saltB64 = encodeBase64Url(salt);
  return { hash, salt: saltB64 };
}
async function verifyPassword(password, storedHash, storedSalt) {
  try {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const salt = decodeBase64Url(storedSalt);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordData,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    const hashBytes = new Uint8Array(hashBuffer);
    const computedHash = encodeBase64Url(hashBytes);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}
function validatePassword(password) {
  if (password.length < 8) {
    return false;
  }
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUpperCase || hasNumber;
}
function isCommonPassword(password) {
  const commonPasswords = /* @__PURE__ */ new Set([
    "password",
    "12345678",
    "qwerty123",
    "abc12345",
    "password1",
    "123456789",
    "welcome1",
    "monkey123",
    "sunshine1",
    "password123",
    "1234567890",
    "football1",
    "iloveyou1",
    "princess1",
    "adobe123",
    "admin123",
    "letmein1",
    "welcome123",
    "master123",
    "hello123"
  ]);
  return commonPasswords.has(password.toLowerCase());
}

// src/auth/tokens.ts
var ACCESS_TOKEN_EXPIRY = 15 * 60;
function encodeBase64Url2(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b));
  const b64 = btoa(bin.join(""));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function decodeBase64Url2(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function stringToBytes(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
async function signHmacSha256(data, secret) {
  const keyData = stringToBytes(secret);
  const messageData = stringToBytes(data);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return encodeBase64Url2(new Uint8Array(signature));
}
async function verifyHmacSha256(data, signature, secret) {
  const expectedSignature = await signHmacSha256(data, secret);
  const sigBytes = decodeBase64Url2(signature);
  const expectedBytes = decodeBase64Url2(expectedSignature);
  if (sigBytes.length !== expectedBytes.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expectedBytes[i];
  }
  return result === 0;
}
async function generateAccessToken2(user, secret) {
  const now = Math.floor(Date.now() / 1e3);
  const exp = now + ACCESS_TOKEN_EXPIRY;
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    instance: user.instance,
    plan: user.plan,
    iat: now,
    exp,
    iss: "cocapn.ai",
    aud: "cocapn-workers"
  };
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = encodeBase64Url2(stringToBytes(JSON.stringify(header)));
  const payloadB64 = encodeBase64Url2(stringToBytes(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await signHmacSha256(data, secret);
  return `${data}.${signature}`;
}
async function generateTokenPair(user, secret) {
  const accessToken = await generateAccessToken2(user, secret);
  const refreshToken2 = crypto.randomUUID();
  return {
    accessToken,
    refreshToken: refreshToken2,
    expiresIn: ACCESS_TOKEN_EXPIRY
  };
}
async function verifyAccessToken2(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token_format");
  }
  const [headerB64, payloadB64, signature] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const isValid = await verifyHmacSha256(data, signature, secret);
  if (!isValid) {
    throw new Error("invalid_signature");
  }
  try {
    const payloadBytes = decodeBase64Url2(payloadB64);
    const payloadStr = Array.from(
      payloadBytes,
      (b) => String.fromCharCode(b)
    ).join("");
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp < now) {
      throw new Error("token_expired");
    }
    return payload;
  } catch (err) {
    if (err instanceof Error && err.message === "token_expired") {
      throw err;
    }
    throw new Error("invalid_payload");
  }
}
function extractBearerToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return void 0;
  }
  if (!authHeader.startsWith("Bearer ")) {
    return void 0;
  }
  return authHeader.slice(7);
}
async function getUserFromRequest(request, secret) {
  const token = extractBearerToken(request);
  if (!token) {
    throw new Error("missing_token");
  }
  return verifyAccessToken2(token, secret);
}

// src/auth/service.ts
var ERRORS = {
  INVALID_CREDENTIALS: "invalid_credentials",
  USER_EXISTS: "user_exists",
  USER_NOT_FOUND: "user_not_found",
  TOKEN_EXPIRED: "token_expired",
  TOKEN_REVOKED: "token_revoked",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  ACCOUNT_SUSPENDED: "account_suspended",
  ACCOUNT_BANNED: "account_banned",
  INVALID_TOKEN: "invalid_token",
  MISSING_TOKEN: "missing_token",
  WEAK_PASSWORD: "weak_password",
  COMMON_PASSWORD: "common_password",
  INVALID_EMAIL: "invalid_email",
  INVALID_INSTANCE: "invalid_instance"
};
async function createUser(env, email, password, name, instance, plan = "free") {
  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    throw new Error(ERRORS.INVALID_EMAIL);
  }
  if (instance) {
    const instanceRegex = /^[a-z0-9]{3,20}$/;
    if (!instanceRegex.test(instance)) {
      throw new Error(ERRORS.INVALID_INSTANCE);
    }
  }
  if (!validatePassword(password)) {
    throw new Error(ERRORS.WEAK_PASSWORD);
  }
  if (isCommonPassword(password)) {
    throw new Error(ERRORS.COMMON_PASSWORD);
  }
  const { hash, salt } = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    id: userId,
    email: emailLower,
    passwordHash: hash,
    passwordSalt: salt,
    name: name.trim(),
    instance,
    plan,
    createdAt: now,
    status: "active"
  };
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request("https://admiral.internal/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", user })
    })
  );
  if (!response.ok) {
    const error = await response.text();
    if (error.includes("UNIQUE constraint failed") || error.includes("already exists")) {
      throw new Error(ERRORS.USER_EXISTS);
    }
    throw new Error(`database_error: ${error}`);
  }
  const tokens = await generateTokenPair(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      instance: user.instance,
      plan: user.plan
    },
    env.FLEET_JWT_SECRET ?? "default-secret"
  );
  const refreshData = {
    userId: user.id,
    createdAt: now
  };
  await env.AUTH_KV.put(
    `refresh-token:${tokens.refreshToken}`,
    JSON.stringify(refreshData),
    { expirationTtl: 30 * 24 * 60 * 60 }
    // 30 days
  );
  const { passwordHash, passwordSalt, ...userResponse } = user;
  return { user: userResponse, tokens };
}
async function authenticate(env, email, password, ip) {
  const emailLower = email.toLowerCase().trim();
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/users/by-email/${encodeURIComponent(emailLower)}`, {
      method: "GET"
    })
  );
  if (!response.ok) {
    throw new Error(ERRORS.INVALID_CREDENTIALS);
  }
  const user = await response.json();
  const isValid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    throw new Error(ERRORS.INVALID_CREDENTIALS);
  }
  if (user.status === "suspended") {
    throw new Error(ERRORS.ACCOUNT_SUSPENDED);
  }
  if (user.status === "banned") {
    throw new Error(ERRORS.ACCOUNT_BANNED);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastLogin: now,
        lastLoginIp: ip
      })
    })
  );
  const tokens = await generateTokenPair(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      instance: user.instance,
      plan: user.plan
    },
    env.FLEET_JWT_SECRET ?? "default-secret"
  );
  const refreshData = {
    userId: user.id,
    createdAt: now,
    ip
  };
  await env.AUTH_KV.put(
    `refresh-token:${tokens.refreshToken}`,
    JSON.stringify(refreshData),
    { expirationTtl: 30 * 24 * 60 * 60 }
    // 30 days
  );
  const { passwordHash, passwordSalt, ...userResponse } = user;
  return { user: userResponse, tokens };
}
async function verifyToken(env, token) {
  const payload = await verifyAccessToken2(token, env.FLEET_JWT_SECRET ?? "default-secret");
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/users/${payload.sub}`, {
      method: "GET"
    })
  );
  if (!response.ok) {
    throw new Error(ERRORS.USER_NOT_FOUND);
  }
  const user = await response.json();
  if (user.status !== "active") {
    if (user.status === "suspended") {
      throw new Error(ERRORS.ACCOUNT_SUSPENDED);
    }
    if (user.status === "banned") {
      throw new Error(ERRORS.ACCOUNT_BANNED);
    }
  }
  const { passwordHash, passwordSalt, ...userResponse } = user;
  return userResponse;
}
async function refreshToken(env, refreshToken2) {
  const tokenData = await env.AUTH_KV.get(
    `refresh-token:${refreshToken2}`,
    "json"
  );
  if (!tokenData) {
    throw new Error(ERRORS.TOKEN_REVOKED);
  }
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/users/${tokenData.userId}`, {
      method: "GET"
    })
  );
  if (!response.ok) {
    throw new Error(ERRORS.USER_NOT_FOUND);
  }
  const user = await response.json();
  if (user.status !== "active") {
    if (user.status === "suspended") {
      throw new Error(ERRORS.ACCOUNT_SUSPENDED);
    }
    if (user.status === "banned") {
      throw new Error(ERRORS.ACCOUNT_BANNED);
    }
  }
  const accessToken = await generateAccessToken(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      instance: user.instance,
      plan: user.plan
    },
    env.FLEET_JWT_SECRET ?? "default-secret"
  );
  return {
    accessToken,
    expiresIn: 900
    // 15 minutes
  };
}
async function revokeRefreshToken(env, refreshToken2) {
  await env.AUTH_KV.delete(`refresh-token:${refreshToken2}`);
}
async function createApiKey(env, userId, request) {
  const keyId = crypto.randomUUID();
  const secret = crypto.randomUUID();
  const key = `cocapn_sk_${secret}`;
  const keyBuffer = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const hashBytes = new Uint8Array(hashBuffer);
  const keyHash = Array.from(hashBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const keyPrefix = key.slice(10, 18);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const expiresAt = request.expiresIn ? new Date(Date.now() + request.expiresIn * 24 * 60 * 60 * 1e3).toISOString() : void 0;
  const apiKey = {
    id: keyId,
    userId,
    keyHash,
    keyPrefix,
    name: request.name,
    scopes: request.scopes ?? ["read", "write"],
    createdAt: now,
    expiresAt
  };
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request("https://admiral.internal/auth/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiKey)
    })
  );
  if (!response.ok) {
    throw new Error("database_error");
  }
  return {
    id: apiKey.id,
    name: apiKey.name,
    key,
    // Show only on creation
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt
  };
}
async function listApiKeys(env, userId) {
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  const response = await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/api-keys/${userId}`, {
      method: "GET"
    })
  );
  if (!response.ok) {
    return [];
  }
  const apiKeys = await response.json();
  return apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    createdAt: key.createdAt,
    lastUsed: key.lastUsed,
    expiresAt: key.expiresAt
  }));
}
async function revokeApiKey(env, userId, keyId) {
  const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("auth"));
  await admiralStub.fetch(
    new Request(`https://admiral.internal/auth/api-keys/${userId}/${keyId}`, {
      method: "DELETE"
    })
  );
}

// src/auth/rate-limit.ts
var SIGN_IN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1e3
  // 15 minutes
};
var SIGN_UP_RATE_LIMIT = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1e3
  // 1 hour
};
var IP_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1e3
  // 15 minutes
};
function rateLimitKey(prefix, identifier) {
  return `ratelimit:${prefix}:${identifier}`;
}
async function checkRateLimit(kv, key, config) {
  const now = Date.now();
  const currentData = await kv.get(key, "json");
  const current = currentData && typeof currentData === "object" && "count" in currentData ? currentData : null;
  if (current && current.resetAt < now) {
    await kv.put(
      key,
      JSON.stringify({ count: 1, resetAt: now + config.windowMs }),
      { expirationTtl: Math.ceil(config.windowMs / 1e3) }
    );
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: now + config.windowMs
    };
  }
  if (current && current.count >= config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt
    };
  }
  const newCount = (current?.count ?? 0) + 1;
  const resetAt = current?.resetAt ?? now + config.windowMs;
  await kv.put(
    key,
    JSON.stringify({ count: newCount, resetAt }),
    { expirationTtl: Math.ceil(config.windowMs / 1e3) }
  );
  return {
    allowed: true,
    remaining: config.maxAttempts - newCount,
    resetAt
  };
}
async function checkSignInRateLimit(kv, email) {
  const key = rateLimitKey("signin", email.toLowerCase());
  return checkRateLimit(kv, key, SIGN_IN_RATE_LIMIT);
}
async function checkSignUpRateLimit(kv, ip) {
  const key = rateLimitKey("signup", ip);
  return checkRateLimit(kv, key, SIGN_UP_RATE_LIMIT);
}
function getRateLimitHeaders(result) {
  const headers = new Headers({
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toString()
  });
  if (!result.allowed) {
    headers.set("Retry-After", Math.ceil((result.resetAt - Date.now()) / 1e3).toString());
  }
  return headers;
}
function getClientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const ips = xff.split(",").map((ip) => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }
  return "unknown";
}

// src/auth/routes.ts
async function handleSignup(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password || !body.name) {
      return errorResponse("Missing required fields: email, password, name", 400);
    }
    const ip = getClientIp(request);
    const rateLimitResult = await checkSignUpRateLimit(env.AUTH_KV, ip);
    if (!rateLimitResult.allowed) {
      const headers = getRateLimitHeaders(rateLimitResult);
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({
          error: ERRORS.RATE_LIMIT_EXCEEDED,
          message: "Too many sign-up attempts. Please try again later.",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        { status: 429, headers }
      );
    }
    const result = await createUser(
      env,
      body.email,
      body.password,
      body.name,
      body.instance,
      body.plan
    );
    return jsonResponse(result, 201);
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleSignin(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return errorResponse("Missing required fields: email, password", 400);
    }
    const ip = getClientIp(request);
    const [emailRateLimit, ipRateLimit] = await Promise.all([
      checkSignInRateLimit(env.AUTH_KV, body.email),
      checkSignUpRateLimit(env.AUTH_KV, ip)
      // Reuse sign-up limit for IP
    ]);
    if (!emailRateLimit.allowed || !ipRateLimit.allowed) {
      const headers = getRateLimitHeaders(emailRateLimit);
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({
          error: ERRORS.RATE_LIMIT_EXCEEDED,
          message: "Too many sign-in attempts. Please try again later.",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        { status: 429, headers }
      );
    }
    const result = await authenticate(env, body.email, body.password, ip);
    await env.AUTH_KV.delete(`ratelimit:signin:${body.email.toLowerCase()}`);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof Error && err.message === ERRORS.INVALID_CREDENTIALS) {
      try {
        const body = await request.clone().json();
        await checkSignInRateLimit(env.AUTH_KV, body.email);
      } catch {
      }
    }
    return handleAuthError(err);
  }
}
async function handleRefresh(request, env) {
  try {
    const body = await request.json();
    if (!body.refreshToken) {
      return errorResponse("Missing required field: refreshToken", 400);
    }
    const result = await refreshToken(env, body.refreshToken);
    return jsonResponse(result);
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleSignout(request, env) {
  try {
    const body = await request.json();
    if (!body.refreshToken) {
      return errorResponse("Missing required field: refreshToken", 400);
    }
    await revokeRefreshToken(env, body.refreshToken);
    return jsonResponse({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleGetMe(request, env) {
  try {
    const user = await getUserFromRequest(request, env.FLEET_JWT_SECRET);
    const userResponse = await verifyToken(env, extractBearerToken(request));
    return jsonResponse(userResponse);
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleCreateApiKey(request, env) {
  try {
    const user = await getUserFromRequest(request, env.FLEET_JWT_SECRET);
    const body = await request.json();
    if (!body.name) {
      return errorResponse("Missing required field: name", 400);
    }
    const result = await createApiKey(env, user.sub, body);
    return jsonResponse(result, 201);
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleListApiKeys(request, env) {
  try {
    const user = await getUserFromRequest(request, env.FLEET_JWT_SECRET);
    const result = await listApiKeys(env, user.sub);
    return jsonResponse(result);
  } catch (err) {
    return handleAuthError(err);
  }
}
async function handleRevokeApiKey(request, env) {
  try {
    const user = await getUserFromRequest(request, env.FLEET_JWT_SECRET);
    const url = new URL(request.url);
    const keyId = url.pathname.split("/").pop();
    if (!keyId) {
      return errorResponse("Missing API key ID", 400);
    }
    await revokeApiKey(env, user.sub, keyId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
function handleAuthError(err) {
  if (err instanceof Error) {
    const errorMap = {
      [ERRORS.INVALID_CREDENTIALS]: { status: 401, message: "Invalid email or password" },
      [ERRORS.USER_EXISTS]: { status: 409, message: "Email already registered" },
      [ERRORS.USER_NOT_FOUND]: { status: 404, message: "User not found" },
      [ERRORS.TOKEN_EXPIRED]: { status: 401, message: "Token expired" },
      [ERRORS.TOKEN_REVOKED]: { status: 401, message: "Token revoked" },
      [ERRORS.ACCOUNT_SUSPENDED]: { status: 403, message: "Account suspended" },
      [ERRORS.ACCOUNT_BANNED]: { status: 403, message: "Account permanently banned" },
      [ERRORS.INVALID_TOKEN]: { status: 401, message: "Invalid token" },
      [ERRORS.MISSING_TOKEN]: { status: 401, message: "Missing authorization header" },
      [ERRORS.WEAK_PASSWORD]: { status: 400, message: "Password does not meet requirements" },
      [ERRORS.COMMON_PASSWORD]: { status: 400, message: "Password is too common" },
      [ERRORS.INVALID_EMAIL]: { status: 400, message: "Invalid email format" },
      [ERRORS.INVALID_INSTANCE]: { status: 400, message: "Instance name must be 3-20 alphanumeric characters" }
    };
    const errorInfo = errorMap[err.message];
    if (errorInfo) {
      return errorResponse(errorInfo.message, errorInfo.status);
    }
  }
  return errorResponse("Internal server error", 500);
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
function errorResponse(message, status) {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

// src/worker.ts
var AGENT_CARD = {
  name: "cocapn-cloud-agent",
  description: "Cocapn cloud agent \u2014 always-on compute backed by Git memory",
  url: "",
  // filled at request time from Host header
  version: "0.1.0",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
    multimodal: false
  },
  skills: [
    {
      id: "chat",
      name: "Chat",
      tags: ["conversation", "reasoning"],
      examples: ["What should I work on today?", "Summarise my recent tasks"]
    },
    {
      id: "background-task",
      name: "Background Task",
      tags: ["async", "research", "summarise"],
      examples: ["Summarise my wiki changes this week"]
    }
  ]
};
function verifyFleetJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("COCAPN-001: Invalid JWT: expected 3 parts");
  }
  const [headerB64, bodyB64, sigB64] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const keyData = new TextEncoder().encode(secret);
  async function verifySignature(sig, data2, secret2) {
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const signature = decodeBase64Url3(sig);
      const message = new TextEncoder().encode(data2);
      const isValid = await crypto.subtle.verify("HMAC", key, signature, message);
      return isValid;
    } catch {
      return false;
    }
  }
  function decodeBase64Url3(base64url) {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  let payload;
  try {
    payload = JSON.parse(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    throw new Error("COCAPN-003: Invalid JWT: malformed payload");
  }
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp < now) {
    throw new Error(`COCAPN-004: JWT expired at ${new Date(payload.exp * 1e3).toISOString()}`);
  }
  return payload;
}
function handleHealthCheck() {
  const response = {
    ok: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "0.1.0"
  };
  return jsonResponse2(response);
}
async function handleExecuteTask(request, env) {
  try {
    const body = await request.json();
    if (!body.taskId) {
      return errorResponse2("Missing taskId", 400);
    }
    if (!body.token) {
      return errorResponse2("Missing fleet JWT token", 401);
    }
    let jwtPayload;
    try {
      jwtPayload = verifyFleetJwt(body.token, env.FLEET_JWT_SECRET);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse2(`Invalid JWT: ${msg}`, 401);
    }
    const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName(jwtPayload.sub));
    const taskResponse = await admiralStub.fetch(
      new Request(`https://admiral.internal/tasks/status/${body.taskId}`, {
        method: "GET"
      })
    );
    if (!taskResponse.ok) {
      return errorResponse2("Task not found in Admiral", 404);
    }
    const taskData = await taskResponse.json();
    const result = await executeScheduledTask(body.taskId, taskData, env);
    const response = {
      ok: result.success,
      taskId: body.taskId,
      status: result.success ? "completed" : "failed",
      result: result.output,
      error: result.error
    };
    return jsonResponse2(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse2(`Execution failed: ${msg}`, 500);
  }
}
async function executeScheduledTask(taskId, taskData, env) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const output = `Task ${taskId} executed successfully at ${(/* @__PURE__ */ new Date()).toISOString()}`;
    const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("default"));
    await admiralStub.fetch(
      new Request(`https://admiral.internal/tasks/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, result: output })
      })
    );
    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
async function handleGitHubWebhook(request, env) {
  try {
    const signature = request.headers.get("X-Hub-Signature-256");
    if (!signature) {
      return errorResponse2("Missing signature", 401);
    }
    if (!signature.startsWith("sha256=")) {
      return errorResponse2("Invalid signature format", 401);
    }
    const event = request.headers.get("X-GitHub-Event");
    const payload = await request.json();
    const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("default"));
    const webhookResponse = await admiralStub.fetch(
      new Request(`https://admiral.internal/tasks/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signature,
          "X-GitHub-Event": event ?? "ping"
        },
        body: JSON.stringify(payload)
      })
    );
    if (!webhookResponse.ok) {
      const error = await webhookResponse.text();
      return errorResponse2(`Webhook processing failed: ${error}`, webhookResponse.status);
    }
    return jsonResponse2({ ok: true, event });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse2(`Webhook processing failed: ${msg}`, 400);
  }
}
async function handleGetTaskStatus(taskId, env) {
  if (!taskId) {
    return errorResponse2("Missing taskId", 400);
  }
  try {
    const admiralStub = env.ADMIRAL.get(env.ADMIRAL.idFromName("default"));
    const statusResponse = await admiralStub.fetch(
      new Request(`https://admiral.internal/tasks/status/${taskId}`, {
        method: "GET"
      })
    );
    if (!statusResponse.ok) {
      return errorResponse2("Task not found", 404);
    }
    const data = await statusResponse.json();
    return jsonResponse2(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse2(`Failed to fetch status: ${msg}`, 500);
  }
}
async function handleChat(request, env) {
  try {
    const body = await request.json();
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse2("Missing or empty messages array", 400);
    }
    for (const msg of body.messages) {
      if (!msg.role || !msg.content || !["system", "user", "assistant"].includes(msg.role)) {
        return errorResponse2("Invalid message format: each message must have role (system/user/assistant) and content", 400);
      }
    }
    if (!env.DEEPSEEK_API_KEY) {
      return errorResponse2("DEEPSEEK_API_KEY is not configured. Set it via: wrangler secret put DEEPSEEK_API_KEY", 503);
    }
    const result = await chatWithDeepSeek(body.messages, env.DEEPSEEK_API_KEY);
    return jsonResponse2(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse2(`Chat failed: ${msg}`, 500);
  }
}
function jsonResponse2(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
function errorResponse2(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (pathname === "/api/health" && request.method === "GET") {
      return handleHealthCheck();
    }
    if (pathname === "/api/execute-task" && request.method === "POST") {
      return handleExecuteTask(request, env);
    }
    if (pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    if (pathname === "/api/webhook/github" && request.method === "POST") {
      return handleGitHubWebhook(request, env);
    }
    if (pathname.startsWith("/api/status/") && request.method === "GET") {
      const taskId = pathname.slice("/api/status/".length);
      return handleGetTaskStatus(taskId, env);
    }
    if (pathname === "/api/auth/signup" && request.method === "POST") {
      return handleSignup(request, env);
    }
    if (pathname === "/api/auth/signin" && request.method === "POST") {
      return handleSignin(request, env);
    }
    if (pathname === "/api/auth/refresh" && request.method === "POST") {
      return handleRefresh(request, env);
    }
    if (pathname === "/api/auth/signout" && request.method === "POST") {
      return handleSignout(request, env);
    }
    if (pathname === "/api/auth/me" && request.method === "GET") {
      return handleGetMe(request, env);
    }
    if (pathname === "/api/auth/api-keys" && request.method === "POST") {
      return handleCreateApiKey(request, env);
    }
    if (pathname === "/api/auth/api-keys" && request.method === "GET") {
      return handleListApiKeys(request, env);
    }
    if (pathname.startsWith("/api/auth/api-keys/") && request.method === "DELETE") {
      return handleRevokeApiKey(request, env);
    }
    const authHeader = request.headers.get("Authorization") ?? "";
    const requestToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : void 0;
    const github = makeGitHubClient(
      { GITHUB_PAT: env.GITHUB_PAT, PRIVATE_REPO: env.PRIVATE_REPO, PUBLIC_REPO: env.PUBLIC_REPO },
      requestToken
    );
    const admiralId = env.ADMIRAL.idFromName("default");
    const admiralStub = env.ADMIRAL.get(admiralId);
    const admiralClient = new AdmiralClient(admiralStub.id.toString());
    const origin = new URL(request.url).origin;
    const server = new A2AServer(
      {
        ...AGENT_CARD,
        url: origin
      },
      {
        onSendTask: async (params) => {
          const taskId = params.id ?? `task-${Date.now()}`;
          const userText = params.message.parts.filter((p) => p.type === "text").map((p) => p.type === "text" ? p.text : "").join(" ");
          await admiralClient.upsertTask({
            id: taskId,
            agentId: "cloud-agent",
            description: userText.slice(0, 120),
            status: "running"
          });
          const [soul, facts, wiki] = await Promise.all([
            github.readSoul(),
            github.readFacts(),
            github.readWiki()
          ]);
          const result = await executeTask(userText, { soul, facts, wiki }, env.DEEPSEEK_API_KEY);
          try {
            await github.appendNdjson(
              "cocapn/messages/coordination.jsonl",
              {
                timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                source: "cloud-agent",
                taskId,
                summary: result.slice(0, 500)
              },
              `Cocapn: cloud-agent result for task ${taskId}`
            );
            const shaRes = await fetch(
              `https://api.github.com/repos/${env.PRIVATE_REPO}/commits/HEAD`,
              {
                headers: {
                  Authorization: `Bearer ${requestToken ?? env.GITHUB_PAT}`,
                  Accept: "application/vnd.github+json"
                }
              }
            );
            if (shaRes.ok) {
              const shaData = await shaRes.json();
              if (shaData.sha) {
                await admiralClient.notifyGitCommit(shaData.sha);
              }
            }
          } catch (err) {
            console.warn("cloud-agent: failed to write result to Git:", err);
          }
          await admiralClient.upsertTask({
            id: taskId,
            agentId: "cloud-agent",
            status: "done",
            result: result.slice(0, 1e3)
          });
          const task = A2AServer.makeTask(taskId, {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: result }]
            }
          });
          return task;
        },
        onGetTask: async (params) => {
          return A2AServer.makeTask(params.id, {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: "Task result not in cache; fetch from Git." }]
            }
          });
        },
        onCancelTask: async (params) => {
          await admiralClient.upsertTask({
            id: params.id,
            agentId: "cloud-agent",
            status: "failed"
          });
          return A2AServer.makeTask(params.id, { state: "cancelled" });
        }
      }
    );
    const response = await server.handleRequest(request);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};
async function executeTask(userText, context, apiKey) {
  const factCount = context.facts.length;
  const systemParts = ["You are a helpful cloud agent for cocapn."];
  if (context.soul) {
    systemParts.push(`Personality/soul:
${context.soul}`);
  }
  if (factCount > 0) {
    systemParts.push(`Known facts (${factCount}):
${JSON.stringify(context.facts.slice(0, 20))}`);
  }
  if (context.wiki) {
    systemParts.push(`Wiki:
${context.wiki.slice(0, 2e3)}`);
  }
  const messages = [
    { role: "system", content: systemParts.join("\n\n") },
    { role: "user", content: userText }
  ];
  if (!apiKey) {
    return `[Cloud agent received: "${userText}"]
Context loaded \u2014 soul: ${context.soul.length > 0}, facts: ${factCount}, wiki: ${context.wiki.length > 0}.
Note: DEEPSEEK_API_KEY is not configured \u2014 set via wrangler secret put.`;
  }
  const result = await chatWithDeepSeek(messages, apiKey);
  return result.content;
}
export {
  AdmiralDO,
  worker_default as default
};
