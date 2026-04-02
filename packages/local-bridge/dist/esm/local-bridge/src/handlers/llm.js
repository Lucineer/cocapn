/**
 * LLM Handler — handles CHAT_STREAM typed messages for direct LLM calls.
 *
 * Bypasses the agent spawner and calls the LLM provider directly.
 * Streams chunks back to the WebSocket client.
 *
 * Protocol:
 *   Input:  { type: "CHAT_STREAM", id, content, model?, systemPrompt? }
 *   Output: { type: "CHAT_STREAM", id, chunk, done, model?, error? }
 */
export async function handleChatStream(ws, clientId, msg, ctx) {
    if (!ctx.llmRouter) {
        ws.send(JSON.stringify({
            type: "CHAT_STREAM",
            id: msg.id,
            chunk: "",
            done: true,
            error: "LLM not configured. Set llm.providers in cocapn-private.yml.",
        }));
        return;
    }
    const content = msg["content"];
    if (!content) {
        ws.send(JSON.stringify({
            type: "CHAT_STREAM",
            id: msg.id,
            chunk: "",
            done: true,
            error: "Missing content",
        }));
        return;
    }
    const model = msg["model"];
    const systemPrompt = msg["systemPrompt"];
    const maxTokens = msg["maxTokens"];
    const temperature = msg["temperature"];
    const messages = [{ role: "user", content }];
    try {
        const stream = ctx.llmRouter.chatStream(messages, {
            model,
            systemPrompt,
            maxTokens,
            temperature,
        });
        for await (const chunk of stream) {
            switch (chunk.type) {
                case "content":
                    ws.send(JSON.stringify({
                        type: "CHAT_STREAM",
                        id: msg.id,
                        chunk: chunk.text ?? "",
                        done: false,
                        model,
                    }));
                    break;
                case "done":
                    ws.send(JSON.stringify({
                        type: "CHAT_STREAM",
                        id: msg.id,
                        chunk: "",
                        done: true,
                        model,
                        usage: chunk.usage,
                    }));
                    break;
                case "error":
                    ws.send(JSON.stringify({
                        type: "CHAT_STREAM",
                        id: msg.id,
                        chunk: "",
                        done: true,
                        error: chunk.error,
                    }));
                    return;
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ws.send(JSON.stringify({
            type: "CHAT_STREAM",
            id: msg.id,
            chunk: "",
            done: true,
            error: message,
        }));
    }
}
//# sourceMappingURL=llm.js.map