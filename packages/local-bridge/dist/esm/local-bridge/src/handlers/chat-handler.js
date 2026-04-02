/**
 * ChatHandler — handles the CHAT typed WebSocket message.
 *
 * Responsibilities (in priority order):
 *   1. Module install intent  — "install habit-tracker"
 *   2. Peer query intent      — "ask activelog for my step count"
 *   3. Skin change intent     — "change skin to dark"
 *   4. Explicit agent prefix  — /claude, /pi, /copilot (via ChatRouter)
 *   5. Heuristic routing      — implicit agent selection based on content
 *
 * Brain context (soul.md + facts) is injected before the first spawn so
 * agents have memory access from their very first message.
 *
 * Protocol:
 *   Input:  { type: "CHAT", id, agentId?, content }
 *   Output: { type: "CHAT_STREAM", id, chunk, stream?, done, agentId?, agentBadge? }
 */
import { signJwt } from "../security/jwt.js";
import { parseModuleInstallIntent, parsePeerQueryIntent, parseSkinIntent, } from "./intents.js";
import { TokenTracker as TT } from "../metrics/token-tracker.js";
// ─── Built-in CSS variable skins ─────────────────────────────────────────────
const BUILTIN_SKIN_VARS = {
    dark: {
        "--color-bg": "#0d0d0d",
        "--color-surface": "#1a1a1a",
        "--color-text": "#e8e8e8",
        "--color-primary": "#7c8aff",
    },
    light: {
        "--color-bg": "#ffffff",
        "--color-surface": "#f4f4f5",
        "--color-text": "#18181b",
        "--color-primary": "#3b5bdb",
    },
};
// ─── ChatHandler class ────────────────────────────────────────────────────────
export class ChatHandler {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    // ---------------------------------------------------------------------------
    // Public entry point
    // ---------------------------------------------------------------------------
    async handle(ws, clientId, msg) {
        const rawContent = msg["content"];
        const rawAgentId = msg["agentId"];
        if (!rawContent) {
            this.send(ws, { type: "CHAT_STREAM", id: msg.id, chunk: "", done: true, error: "Missing content" });
            return;
        }
        const intent = this.parseCommand(rawContent, rawAgentId);
        switch (intent.kind) {
            case "module-install":
                await this.handleModuleInstall(ws, msg.id, intent.intent);
                return;
            case "peer-query":
                await this.handlePeerQuery(ws, msg.id, intent.intent);
                return;
            case "skin-change":
                await this.handleSkinChange(ws, msg.id, intent.intent.skin, intent.intent.preview);
                return;
            case "chat":
                await this.handleAgentChat(ws, clientId, msg.id, intent.content, intent.agentId, intent.badge);
                return;
        }
    }
    // ---------------------------------------------------------------------------
    // Command parsing
    // ---------------------------------------------------------------------------
    /**
     * Classify the incoming content as one of the four intent kinds.
     *
     * Intent precedence:
     *   module-install > peer-query > skin-change > chat (with prefix/heuristic routing)
     */
    parseCommand(content, agentId) {
        const moduleIntent = parseModuleInstallIntent(content);
        if (moduleIntent)
            return { kind: "module-install", intent: moduleIntent };
        const peerIntent = parsePeerQueryIntent(content);
        if (peerIntent)
            return { kind: "peer-query", intent: peerIntent };
        const skinIntent = parseSkinIntent(content);
        if (skinIntent)
            return { kind: "skin-change", intent: skinIntent };
        const parsed = this.deps.chatRouter.parse(content);
        return {
            kind: "chat",
            content: parsed.content,
            agentId: parsed.agentId ?? agentId,
            badge: parsed.badge,
        };
    }
    // ---------------------------------------------------------------------------
    // Agent chat (local + cloud paths)
    // ---------------------------------------------------------------------------
    async handleAgentChat(ws, clientId, msgId, content, agentId, agentBadge) {
        const startTime = Date.now();
        let matchedSkill;
        let skillContext = "";
        // Run skill decision tree to find matching skills
        if (this.deps.decisionTree && this.deps.skillLoader) {
            const keywords = this.extractKeywords(content);
            const matchedSkills = this.deps.decisionTree.resolve(keywords);
            if (matchedSkills.length > 0) {
                // Load the first matching skill
                const skillName = matchedSkills[0];
                const cartridge = this.deps.skillLoader.load(skillName);
                if (cartridge) {
                    matchedSkill = skillName;
                    skillContext = this.formatSkillForAgent(cartridge);
                    // Record skill usage for statistics
                    console.info(`[chat] Matched skill: ${skillName} for keywords: ${keywords.join(", ")}`);
                }
            }
        }
        // Inject brain context before first spawn so agents start with memory
        if (this.deps.brain) {
            const soul = this.deps.brain.getSoul();
            const context = this.deps.brain.buildContext();
            const preSpawnTarget = agentId ?? content;
            const resolved = this.deps.router.resolve(preSpawnTarget);
            if (resolved?.source === "local" && !this.deps.spawner.get(resolved.definition.id)) {
                await this.deps.spawner.spawn(resolved.definition, { soul, context });
            }
        }
        // Resolve agent — spawn if needed
        const routeResult = agentId
            ? this.deps.router.resolve(content)
            : await this.deps.router.resolveAndEnsureRunning(content);
        if (!routeResult) {
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: "", done: true, error: "No agent available" });
            return;
        }
        const { definition, source } = routeResult;
        // ── Cloud path ────────────────────────────────────────────────────────────
        if (source === "cloud") {
            const adapter = this.deps.cloudAdapters?.get(definition.id);
            if (!adapter) {
                this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: "", done: true, error: "Cloud adapter not configured" });
                return;
            }
            const outputCb = (chunk) => {
                this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk, stream: "stdout", done: false, agentId: definition.id, agentBadge });
            };
            const cloudResult = await adapter.sendTask(content, outputCb, clientId);
            if (!cloudResult.reached) {
                this.send(ws, {
                    type: "CHAT_STREAM", id: msgId, chunk: "", done: true,
                    error: `Cloud unreachable: ${cloudResult.error ?? "unknown"}`,
                });
                return;
            }
            const finalText = cloudResult.task?.status.message?.parts
                .filter((p) => p.type === "text")
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("") ?? "";
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: finalText, done: true, agentId: definition.id, agentBadge });
            return;
        }
        // ── Local path ────────────────────────────────────────────────────────────
        this.deps.spawner.attachSession(definition.id, clientId);
        const agent = this.deps.spawner.get(definition.id);
        if (!agent) {
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: "", done: true, error: "Agent not running" });
            return;
        }
        // Subscribe to agent output stream, forward chunks to the WebSocket
        const unsubscribe = (() => {
            const handler = (id, chunk, stream) => {
                if (id !== definition.id)
                    return;
                this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk, stream, done: false, agentId: definition.id, agentBadge });
            };
            this.deps.spawner.on("output", handler);
            return () => this.deps.spawner.off("output", handler);
        })();
        try {
            // Prepend skill context if available
            let enhancedContent = skillContext
                ? `<skill_context>\n${skillContext}\n</skill_context>\n\nUser: ${content}`
                : content;
            // Inject conversation memory context before sending to agent
            if (this.deps.conversationMemory) {
                const memoryPrompt = await this.deps.conversationMemory.buildMemoryPrompt(content);
                if (memoryPrompt) {
                    enhancedContent = `<user_context>\n${memoryPrompt}\n</user_context>\n\n${enhancedContent}`;
                }
            }
            const result = await agent.client.callTool({
                name: "chat",
                arguments: { content: enhancedContent, sessionId: clientId },
            });
            unsubscribe();
            const text = result.content.find((c) => c.type === "text")?.text ?? "";
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: text, done: true, agentId: definition.id, agentBadge });
            // Extract and store facts from the conversation (best-effort)
            if (this.deps.conversationMemory) {
                this.deps.conversationMemory.extractAndStore(content, text).catch(() => {
                    // Non-fatal: don't let memory extraction break the chat flow
                });
            }
            // Track token usage
            const duration = Date.now() - startTime;
            if (this.deps.tokenTracker) {
                this.deps.tokenTracker.record({
                    messageType: "user",
                    tokensIn: TT.estimateTokens(content),
                    tokensOut: TT.estimateTokens(text),
                    model: definition.capabilities.model || "unknown",
                    module: matchedSkill,
                    skill: matchedSkill,
                    taskType: "chat",
                    duration,
                    success: true,
                });
            }
        }
        catch (err) {
            unsubscribe();
            // Track failed request
            const duration = Date.now() - startTime;
            if (this.deps.tokenTracker) {
                this.deps.tokenTracker.record({
                    messageType: "user",
                    tokensIn: TT.estimateTokens(content),
                    tokensOut: 0,
                    model: definition.capabilities.model || "unknown",
                    module: matchedSkill,
                    skill: matchedSkill,
                    taskType: "chat",
                    duration,
                    success: false,
                });
            }
            throw err;
        }
    }
    // ---------------------------------------------------------------------------
    // Skill helpers
    // ---------------------------------------------------------------------------
    /**
     * Extract keywords from content for skill matching
     */
    extractKeywords(content) {
        // Simple keyword extraction: split by whitespace and filter
        // In production, you might use more sophisticated NLP
        const words = content
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2); // Filter out short words
        return [...new Set(words)]; // Remove duplicates
    }
    /**
     * Format a skill cartridge for agent context injection
     */
    formatSkillForAgent(cartridge) {
        const parts = [];
        parts.push(`Skill: ${cartridge.name}`);
        if (cartridge.description) {
            parts.push(`Description: ${cartridge.description}`);
        }
        if (cartridge.steps && cartridge.steps.length > 0) {
            parts.push("Steps:");
            cartridge.steps.forEach((step, i) => {
                parts.push(`  ${i + 1}. ${step.action}: ${step.description}`);
            });
        }
        return parts.join("\n");
    }
    // ---------------------------------------------------------------------------
    // Module install (conversational confirm → install flow)
    // ---------------------------------------------------------------------------
    async handleModuleInstall(ws, msgId, intent) {
        const { gitUrl, moduleName } = intent;
        this.send(ws, {
            type: "CHAT_STREAM", id: msgId,
            chunk: `Install module **${moduleName}** from \`${gitUrl}\`?\nReply **yes** to confirm or **no** to cancel.`,
            done: true,
        });
        // Wait for the user's reply (60s timeout → default "no")
        const reply = await new Promise((resolve) => {
            const handler = (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const text = (msg["content"] ?? msg["text"] ?? "").toString().toLowerCase().trim();
                    ws.off("message", handler);
                    resolve(text);
                }
                catch {
                    ws.off("message", handler);
                    resolve("no");
                }
            };
            ws.once("message", handler);
            setTimeout(() => { ws.off("message", handler); resolve("no"); }, 60_000);
        });
        if (reply !== "yes" && reply !== "y") {
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: "Installation cancelled.", done: true });
            return;
        }
        this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: `Installing ${moduleName}…\n`, done: false });
        try {
            const mod = await this.deps.moduleManager.add(gitUrl, (line, stream) => {
                this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: `${line}\n`, stream, done: false });
            });
            const status = mod.error ? `installed with warnings: ${mod.error}` : "installed successfully";
            this.send(ws, {
                type: "CHAT_STREAM", id: msgId,
                chunk: `\n✓ **${mod.name}@${mod.version}** ${status}.`,
                done: true,
            });
            this.deps.broadcast({ type: "MODULE_LIST_UPDATE", modules: this.deps.moduleManager.list() });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.send(ws, { type: "CHAT_STREAM", id: msgId, chunk: `\nInstallation failed: ${message}`, done: true });
        }
    }
    // ---------------------------------------------------------------------------
    // Peer query (A2A cross-domain)
    // ---------------------------------------------------------------------------
    async handlePeerQuery(ws, msgId, intent) {
        const { domain, factKey, originalContent } = intent;
        if (!this.deps.fleetKey) {
            this.send(ws, {
                type: "CHAT_STREAM", id: msgId,
                chunk: "Cannot query peer: fleet key not configured. Run `cocapn-bridge secret init` first.",
                done: true,
            });
            return;
        }
        // Build peer URL — HTTP peer API is always WS port + 1
        const peerBase = domain.includes("://") ? domain : `http://${domain}`;
        const peerPort = this.deps.config.config.port + 1;
        const peerHost = peerBase.includes(":") ? peerBase : `${peerBase}:${peerPort}`;
        this.send(ws, {
            type: "CHAT_STREAM", id: msgId,
            chunk: `Querying **${domain}** for \`${factKey}\`…\n`,
            done: false,
        });
        try {
            const token = signJwt({ sub: "bridge" }, this.deps.fleetKey, { ttlSeconds: 60 });
            const url = `${peerHost}/api/peer/fact?key=${encodeURIComponent(factKey)}`;
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "User-Agent": "cocapn-bridge/0.1.0",
                },
            });
            if (!res.ok) {
                const body = await res.text().catch(() => "");
                this.send(ws, {
                    type: "CHAT_STREAM", id: msgId,
                    chunk: `Peer **${domain}** returned ${res.status}: ${body}`,
                    done: true,
                });
                return;
            }
            const data = (await res.json());
            const contextNote = originalContent ? `\n\n_Re: "${originalContent.slice(0, 80)}"_` : "";
            this.send(ws, {
                type: "CHAT_STREAM",
                id: msgId,
                chunk: `**[${domain}]** ${data.key}: ${data.value}${contextNote}`,
                done: true,
                agentBadge: domain,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.send(ws, {
                type: "CHAT_STREAM", id: msgId,
                chunk: `Failed to reach **${domain}**: ${message}`,
                done: true,
            });
        }
    }
    // ---------------------------------------------------------------------------
    // Skin change (triggered by chat intent)
    // ---------------------------------------------------------------------------
    async handleSkinChange(ws, msgId, skin, preview) {
        const modules = this.deps.moduleManager.list();
        const skinMod = modules.find((m) => m.type === "skin" && (m.name === skin || m.name.includes(skin)));
        if (skinMod) {
            // Disable all other skin modules first, then enable the requested one
            for (const s of modules.filter((m) => m.type === "skin" && m.name !== skinMod.name)) {
                try {
                    await this.deps.moduleManager.disable(s.name);
                }
                catch { /* non-fatal */ }
            }
            try {
                await this.deps.moduleManager.enable(skinMod.name);
                this.send(ws, {
                    type: "SKIN_UPDATE", id: msgId,
                    skin: skinMod.name, done: true,
                    message: `Skin **${skinMod.name}** activated.`,
                });
                this.deps.broadcast({ type: "SKIN_UPDATE_BROADCAST", skin: skinMod.name });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.send(ws, { type: "SKIN_UPDATE", id: msgId, done: true, error: message });
            }
            return;
        }
        // Built-in CSS variable skins
        const cssVars = BUILTIN_SKIN_VARS[skin.toLowerCase()];
        if (cssVars) {
            const branchName = preview ? `skin-preview-${skin}-${Date.now()}` : undefined;
            this.send(ws, {
                type: "SKIN_UPDATE", id: msgId,
                skin, cssVars, done: true,
                previewBranch: branchName,
                message: preview
                    ? `Skin preview created. Reply **"looks good, merge it"** to apply.`
                    : `Theme **${skin}** applied.`,
            });
            this.deps.broadcast({ type: "SKIN_UPDATE_BROADCAST", skin, cssVars });
            return;
        }
        this.send(ws, {
            type: "SKIN_UPDATE", id: msgId, done: true,
            error: `Unknown skin: ${skin}. Available: dark, light, or an installed skin module.`,
        });
    }
    // ---------------------------------------------------------------------------
    // Send helper
    // ---------------------------------------------------------------------------
    send(ws, payload) {
        ws.send(JSON.stringify(payload));
    }
}
//# sourceMappingURL=chat-handler.js.map