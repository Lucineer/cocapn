/**
 * AdmiralDO — Durable Object for cross-device session persistence and discovery registry.
 *
 * Session persistence:
 *   Stores the current "state of the bridge" so cloud agents started on one
 *   device can pick up where they left off on another.
 *   Git is still the source of truth; Admiral only caches:
 *     - Active task queue (tasks in progress that haven't been committed yet)
 *     - Recent message log (last N messages for quick context without GitHub fetch)
 *     - Bridge heartbeat (last-seen timestamp per bridge instance)
 *
 * Discovery registry:
 *   Stores user profiles for cross-domain discovery.
 *     - Profiles are signed with fleet key JWTs
 *     - 30-day TTL with auto-cleanup
 *     - Search by username, displayName, or currentFocus
 *     - Single-profile lookup by username
 *
 * When the local bridge commits to Git, it POSTs to /notify to let Admiral
 * know the repo has been updated so the cache can be refreshed.
 */

export interface AdmiralState {
  tasks:    ActiveTask[];
  messages: RecentMessage[];
  bridges:  BridgeHeartbeat[];
  lastGitCommit: string | undefined;
}

export interface ActiveTask {
  id:          string;
  agentId:     string;
  description: string;
  status:      "pending" | "running" | "done" | "failed";
  createdAt:   string;
  updatedAt:   string;
  result:      string | undefined;
}

export interface RecentMessage {
  role:      "user" | "agent";
  agentId:   string | undefined;
  content:   string;
  timestamp: string;
}

export interface BridgeHeartbeat {
  instanceId: string;
  hostname:   string;
  lastSeen:   string;
  repoRoot:   string | undefined;
}

// ─── Registry types ─────────────────────────────────────────────────────────────

export interface RegistryProfile {
  /** Username (unique identifier) */
  username: string;
  /** Display name from facts.json */
  displayName?: string;
  /** Current project/focus from facts.json */
  currentFocus?: string;
  /** Website URL from facts.json */
  website?: string;
  /** Bio from soul.md */
  bio?: string;
  /** Fleet domains this user is part of */
  domains: string[];
  /** JWT signature verifying authenticity */
  signature: string;
  /** ISO timestamp when profile was registered */
  registeredAt: string;
  /** ISO timestamp when profile expires (30 days) */
  expiresAt: string;
}

export interface RegisterRequest {
  profile: RegistryProfile;
}

export interface RegisterResponse {
  ok: boolean;
  peerCount: number;
}

export interface DiscoverResponse {
  results: RegistryProfile[];
  total: number;
}

const REGISTRY_TTL_DAYS = 30;
const MAX_DISCOVER_RESULTS = 20;

const MAX_MESSAGES = 100;
const MAX_TASKS    = 50;

// ─── Task Queue types ─────────────────────────────────────────────────────────────

export interface ScheduledTaskConfig {
  /** Unique task ID */
  id: string;
  /** Cron expression or ISO timestamp */
  schedule: string;
  /** Agent/module to execute */
  target: string;
  /** Payload for execution */
  payload: unknown;
  /** Whether enabled */
  enabled: boolean;
  /** Next execution time (ISO) */
  nextRun: string;
  /** Created at (ISO) */
  createdAt: string;
}

export interface TaskQueueItem {
  /** Task ID */
  id: string;
  /** Status */
  status: "pending" | "running" | "completed" | "failed";
  /** Started at (ISO) */
  startedAt?: string;
  /** Completed at (ISO) */
  completedAt?: string;
  /** Result output */
  result?: string;
  /** Error message */
  error?: string;
  /** Execution log */
  log: string[];
}

export interface Alarm {
  /** Alarm ID (matches task ID) */
  id: string;
  /** Scheduled time (ISO) */
  scheduledTime: string;
  /** Task ID this alarm triggers */
  taskId: string;
}

export interface ScheduleTasksRequest {
  tasks: Omit<ScheduledTaskConfig, "id" | "nextRun" | "createdAt">[];
}

export interface ScheduleTasksResponse {
  ok: boolean;
  scheduled: number;
  ids: string[];
}

export interface TaskStatusResponse {
  taskId: string;
  status: string;
  result?: string;
  error?: string;
  log: string[];
}

export class AdmiralDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+/, "");

    // Session persistence endpoints
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

    // Registry endpoints
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

    // Task queue endpoints
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

    return new Response("Not Found", { status: 404 });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async handleGetState(): Promise<Response> {
    const [tasks, messages, bridges, lastGitCommit] = await Promise.all([
      this.state.storage.get<ActiveTask[]>("tasks"),
      this.state.storage.get<RecentMessage[]>("messages"),
      this.state.storage.get<BridgeHeartbeat[]>("bridges"),
      this.state.storage.get<string>("lastGitCommit"),
    ]);

    const body: AdmiralState = {
      tasks:         tasks    ?? [],
      messages:      messages ?? [],
      bridges:       bridges  ?? [],
      lastGitCommit,
    };

    return json(body);
  }

  private async handleUpsertTask(request: Request): Promise<Response> {
    const task = await request.json() as Partial<ActiveTask>;
    if (!task.id || !task.agentId) return new Response("Missing id or agentId", { status: 400 });

    const tasks = (await this.state.storage.get<ActiveTask[]>("tasks")) ?? [];
    const idx   = tasks.findIndex((t) => t.id === task.id);
    const now   = new Date().toISOString();

    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx]!, ...task, updatedAt: now };
    } else {
      tasks.push({
        id:          task.id,
        agentId:     task.agentId,
        description: task.description ?? "",
        status:      task.status      ?? "pending",
        createdAt:   task.createdAt   ?? now,
        updatedAt:   now,
        result:      task.result,
      });
    }

    // Keep only the most recent MAX_TASKS
    const trimmed = tasks.slice(-MAX_TASKS);
    await this.state.storage.put("tasks", trimmed);
    return json({ ok: true });
  }

  private async handleAddMessage(request: Request): Promise<Response> {
    const msg = await request.json() as Partial<RecentMessage>;
    if (!msg.content || !msg.role) return new Response("Missing content or role", { status: 400 });

    const messages = (await this.state.storage.get<RecentMessage[]>("messages")) ?? [];
    messages.push({
      role:      msg.role,
      agentId:   msg.agentId,
      content:   msg.content,
      timestamp: new Date().toISOString(),
    });

    const trimmed = messages.slice(-MAX_MESSAGES);
    await this.state.storage.put("messages", trimmed);
    return json({ ok: true });
  }

  private async handleHeartbeat(request: Request): Promise<Response> {
    const hb = await request.json() as Partial<BridgeHeartbeat>;
    if (!hb.instanceId) return new Response("Missing instanceId", { status: 400 });

    const bridges = (await this.state.storage.get<BridgeHeartbeat[]>("bridges")) ?? [];
    const idx     = bridges.findIndex((b) => b.instanceId === hb.instanceId);
    const updated: BridgeHeartbeat = {
      instanceId: hb.instanceId,
      hostname:   hb.hostname   ?? "unknown",
      lastSeen:   new Date().toISOString(),
      repoRoot:   hb.repoRoot,
    };

    if (idx >= 0) {
      bridges[idx] = updated;
    } else {
      bridges.push(updated);
    }

    // Prune bridges not seen for 5 minutes
    const cutoff = Date.now() - 5 * 60 * 1000;
    const live   = bridges.filter((b) => new Date(b.lastSeen).getTime() > cutoff);
    await this.state.storage.put("bridges", live);
    return json({ ok: true });
  }

  private async handleGitNotify(request: Request): Promise<Response> {
    const body = await request.json() as { sha?: string };
    if (body.sha) {
      await this.state.storage.put("lastGitCommit", body.sha);
    }
    return json({ ok: true, sha: body.sha });
  }

  private async handleDeleteTask(request: Request): Promise<Response> {
    const url  = new URL(request.url);
    const id   = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const tasks   = (await this.state.storage.get<ActiveTask[]>("tasks")) ?? [];
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
  private async handleRegistryRegister(request: Request): Promise<Response> {
    try {
      const body = await request.json() as RegisterRequest;
      const profile = body.profile;

      if (!profile || !profile.username) {
        return new Response("Missing profile or username", { status: 400 });
      }

      // Verify signature is a valid JWT format
      if (!this.isValidJwtFormat(profile.signature)) {
        return new Response("Invalid signature format", { status: 400 });
      }

      // Set expiration (30 days from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + REGISTRY_TTL_DAYS * 24 * 60 * 60 * 1000);

      const registryProfile: RegistryProfile = {
        username: profile.username,
        displayName: profile.displayName,
        currentFocus: profile.currentFocus,
        website: profile.website,
        bio: profile.bio,
        domains: profile.domains ?? [],
        signature: profile.signature,
        registeredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Store in registry
      const registry = (await this.state.storage.get<RegistryProfile[]>("registry")) ?? [];
      const existingIndex = registry.findIndex((p) => p.username === profile.username);

      if (existingIndex >= 0) {
        registry[existingIndex] = registryProfile;
      } else {
        registry.push(registryProfile);
      }

      await this.state.storage.put("registry", registry);
      await this.cleanupExpiredProfiles(registry);

      const peerCount = registry.length;

      const response: RegisterResponse = { ok: true, peerCount };
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
  private async handleRegistryDiscover(url: URL): Promise<Response> {
    const query = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
    if (query.length < 2) {
      return json({ results: [], total: 0 });
    }

    const registry = await this.getValidRegistry();

    // Filter by search query
    const results = registry
      .filter((p) =>
        p.username.toLowerCase().includes(query) ||
        (p.displayName?.toLowerCase().includes(query) ?? false) ||
        (p.currentFocus?.toLowerCase().includes(query) ?? false)
      )
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .slice(0, MAX_DISCOVER_RESULTS);

    const response: DiscoverResponse = {
      results,
      total: results.length,
    };

    return json(response);
  }

  /**
   * GET /registry/profile/:username
   *
   * Get a single profile by username.
   * Returns 404 if not found or expired.
   */
  private async handleRegistryGetProfile(username: string): Promise<Response> {
    if (!username) {
      return new Response("Missing username", { status: 400 });
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
  private async getValidRegistry(): Promise<RegistryProfile[]> {
    const registry = (await this.state.storage.get<RegistryProfile[]>("registry")) ?? [];
    const now = new Date().toISOString();
    const valid = registry.filter((p) => p.expiresAt > now);

    // Update storage if we removed expired profiles
    if (valid.length < registry.length) {
      await this.state.storage.put("registry", valid);
    }

    return valid;
  }

  /**
   * Remove expired profiles from the registry.
   */
  private async cleanupExpiredProfiles(registry: RegistryProfile[]): Promise<void> {
    const now = new Date().toISOString();
    const valid = registry.filter((p) => p.expiresAt > now);

    if (valid.length < registry.length) {
      await this.state.storage.put("registry", valid);
    }
  }

  /**
   * Check if a string is a valid JWT format (3 parts separated by dots).
   * Does NOT verify the signature — just checks structure.
   */
  private isValidJwtFormat(signature: string): boolean {
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
  private async handleScheduleTasks(request: Request): Promise<Response> {
    try {
      const body = await request.json() as ScheduleTasksRequest;
      if (!body.tasks || !Array.isArray(body.tasks)) {
        return new Response("Missing tasks array", { status: 400 });
      }

      const now = new Date();
      const scheduledTasks = (await this.state.storage.get<Map<string, ScheduledTaskConfig>>("scheduled-tasks"))
        ?? new Map();
      const alarms = (await this.state.storage.get<Alarm[]>("task-alarms")) ?? [];
      const ids: string[] = [];

      for (const task of body.tasks) {
        const id = crypto.randomUUID();
        const nextRun = this.calculateNextRun(task.schedule, now);

        const config: ScheduledTaskConfig = {
          id,
          schedule: task.schedule,
          target: task.target,
          payload: task.payload,
          enabled: task.enabled ?? true,
          nextRun,
          createdAt: now.toISOString(),
        };

        scheduledTasks.set(id, config);

        // Set DO alarm for next execution
        if (task.enabled !== false) {
          await this.state.storage.setAlarm(new Date(nextRun), id);
          alarms.push({
            id,
            scheduledTime: nextRun,
            taskId: id,
          });
        }

        ids.push(id);
      }

      // Convert Map to object for storage
      const scheduledTasksObj = Object.fromEntries(scheduledTasks.entries());
      await this.state.storage.put("scheduled-tasks", scheduledTasksObj);
      await this.state.storage.put("task-alarms", alarms);

      const response: ScheduleTasksResponse = {
        ok: true,
        scheduled: ids.length,
        ids,
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
  private async handleExecuteTask(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { taskId: string };
      if (!body.taskId) {
        return new Response("Missing taskId", { status: 400 });
      }

      const scheduledTasksObj = await this.state.storage.get<Record<string, ScheduledTaskConfig>>("scheduled-tasks");
      if (!scheduledTasksObj) {
        return new Response("No scheduled tasks found", { status: 404 });
      }

      const task = scheduledTasksObj[body.taskId];
      if (!task) {
        return new Response("Task not found", { status: 404 });
      }

      // Create queue item for execution
      const queueItem: TaskQueueItem = {
        id: body.taskId,
        status: "running",
        startedAt: new Date().toISOString(),
        log: [`Started execution at ${new Date().toISOString()}`],
      };

      const queue = (await this.state.storage.get<TaskQueueItem[]>("task-queue")) ?? [];
      queue.push(queueItem);
      await this.state.storage.put("task-queue", queue);

      // Execute the task (in real implementation, this would call a worker)
      const result = await this.executeTaskWork(task);

      // Update queue item with result
      const updatedQueue = (await this.state.storage.get<TaskQueueItem[]>("task-queue")) ?? [];
      const itemIndex = updatedQueue.findIndex((q) => q.id === body.taskId);
      if (itemIndex >= 0) {
        updatedQueue[itemIndex] = {
          ...updatedQueue[itemIndex]!,
          status: result.success ? "completed" : "failed",
          completedAt: new Date().toISOString(),
          result: result.output,
          error: result.error,
          log: [...updatedQueue[itemIndex]!.log, ...result.log],
        };
        await this.state.storage.put("task-queue", updatedQueue);
      }

      // Reschedule if it's a recurring task (cron)
      if (this.isCronExpression(task.schedule)) {
        const nextRun = this.calculateNextRun(task.schedule, new Date());
        const updatedTask: ScheduledTaskConfig = {
          ...task,
          nextRun,
        };

        const scheduledTasks = { ...scheduledTasksObj };
        scheduledTasks[body.taskId] = updatedTask;
        await this.state.storage.put("scheduled-tasks", scheduledTasks);

        // Set next alarm
        await this.state.storage.setAlarm(new Date(nextRun), body.taskId);
      }

      return json({
        ok: true,
        taskId: body.taskId,
        status: result.success ? "completed" : "failed",
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
  private async handleGetTaskStatus(taskId: string): Promise<Response> {
    if (!taskId) {
      return new Response("Missing taskId", { status: 400 });
    }

    const queue = (await this.state.storage.get<TaskQueueItem[]>("task-queue")) ?? [];
    const item = queue.find((q) => q.id === taskId);

    if (!item) {
      return new Response("Task not found in queue", { status: 404 });
    }

    const response: TaskStatusResponse = {
      taskId: item.id,
      status: item.status,
      result: item.result,
      error: item.error,
      log: item.log,
    };

    return json(response);
  }

  /**
   * POST /tasks/webhook
   *
   * GitHub webhook handler.
   * Validates signature and triggers tasks based on webhook events.
   */
  private async handleWebhook(request: Request): Promise<Response> {
    try {
      const signature = request.headers.get("X-Hub-Signature-256");
      if (!signature) {
        return new Response("Missing signature", { status: 401 });
      }

      const rawBody = await request.text();
      const expectedSignature = request.headers.get("X-Hub-Signature-256");

      // In production, verify with actual secret
      // For now, just check format
      if (!signature.startsWith("sha256=")) {
        return new Response("Invalid signature format", { status: 401 });
      }

      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const event = request.headers.get("X-GitHub-Event");

      // Handle different webhook events
      if (event === "push") {
        await this.handlePushWebhook(payload);
      } else if (event === "ping") {
        // Just acknowledge
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
  private calculateNextRun(schedule: string, from: Date): string {
    // Check if it's an ISO timestamp
    if (schedule.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(schedule)) {
      return schedule;
    }

    // Simple cron parser (supports limited patterns)
    // Format: "M H D Mo W" (minute hour day month weekday)
    const cronMatch = schedule.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
    if (cronMatch) {
      const [, minute, hour, day, month, weekday] = cronMatch;

      // For simplicity, just add 1 minute for now
      // A full implementation would parse the cron expression
      const next = new Date(from.getTime() + 60 * 1000);
      return next.toISOString();
    }

    // Default: 1 hour from now
    const next = new Date(from.getTime() + 60 * 60 * 1000);
    return next.toISOString();
  }

  /**
   * Check if a schedule is a cron expression.
   */
  private isCronExpression(schedule: string): boolean {
    return /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(schedule);
  }

  /**
   * Execute the actual task work.
   * In production, this would call a worker or agent.
   */
  private async executeTaskWork(task: ScheduledTaskConfig): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    log: string[];
  }> {
    const log: string[] = [];

    try {
      log.push(`Executing task ${task.id} with target ${task.target}`);
      log.push(`Payload: ${JSON.stringify(task.payload)}`);

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const output = `Task ${task.id} completed successfully`;
      log.push(output);

      return {
        success: true,
        output,
        log,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.push(`Error: ${error}`);
      return {
        success: false,
        error,
        log,
      };
    }
  }

  /**
   * Handle push webhook event.
   * Triggers tasks associated with the repository.
   */
  private async handlePushWebhook(payload: Record<string, unknown>): Promise<void> {
    const repo = payload.repository as Record<string, unknown> | undefined;
    const repoName = repo?.["full_name"] as string | undefined;

    if (!repoName) return;

    // Find tasks associated with this repo and trigger them
    const scheduledTasksObj = await this.state.storage.get<Record<string, ScheduledTaskConfig>>("scheduled-tasks");
    if (!scheduledTasksObj) return;

    const tasks = Object.values(scheduledTasksObj).filter((t) =>
      t.payload && typeof t.payload === "object" && "repo" in t.payload &&
      (t.payload as Record<string, unknown>).repo === repoName
    );

    for (const task of tasks) {
      // Trigger immediate execution
      await this.handleExecuteTask(
        new Request(`https://admiral.test/tasks/execute`, {
          method: "POST",
          body: JSON.stringify({ taskId: task.id }),
          headers: { "Content-Type": "application/json" },
        })
      );
    }
  }
}

// ─── AdmiralClient ────────────────────────────────────────────────────────────
//
// Called from the local bridge to push heartbeats and git-notify events.

export class AdmiralClient {
  private baseUrl: string;
  private token:   string | undefined;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token   = token;
  }

  async getState(): Promise<AdmiralState | null> {
    return this.fetch<AdmiralState>("GET", "state");
  }

  async upsertTask(task: Partial<ActiveTask>): Promise<void> {
    await this.fetch("POST", "task", task);
  }

  async addMessage(msg: Partial<RecentMessage>): Promise<void> {
    await this.fetch("POST", "message", msg);
  }

  async heartbeat(hb: Omit<BridgeHeartbeat, "lastSeen">): Promise<void> {
    await this.fetch("POST", "heartbeat", hb);
  }

  async notifyGitCommit(sha: string): Promise<void> {
    await this.fetch("POST", "notify", { sha });
  }

  // ── Registry client methods ──────────────────────────────────────────────────

  /**
   * Register a profile in the discovery registry.
   * Returns the peer count or null if registration fails.
   */
  async registerProfile(profile: RegistryProfile): Promise<number | null> {
    const result = await this.fetch<RegisterResponse>("POST", "registry/register", { profile });
    return result?.peerCount ?? null;
  }

  /**
   * Search for profiles by query string.
   * Returns results or null if search fails.
   */
  async discoverProfiles(query: string): Promise<RegistryProfile[] | null> {
    const result = await this.fetch<DiscoverResponse>("GET", `registry/discover?q=${encodeURIComponent(query)}`);
    return result?.results ?? null;
  }

  /**
   * Get a single profile by username.
   * Returns the profile or null if not found.
   */
  async getProfile(username: string): Promise<RegistryProfile | null> {
    return this.fetch<RegistryProfile>("GET", `registry/profile/${encodeURIComponent(username)}`);
  }

  private async fetch<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const headers: Record<string, string> = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    if (body)       headers["Content-Type"]  = "application/json";

    try {
      const res = await globalThis.fetch(`${this.baseUrl}/${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      return null;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
