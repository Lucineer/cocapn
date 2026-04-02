/**
 * LLM — Multi-provider chat completions via OpenAI-compatible API.
 *
 * Supports: DeepSeek, OpenAI, Ollama, and any OpenAI-compatible endpoint.
 * Zero dependencies. Uses only the global fetch API (Node 18+).
 */
// ─── Provider defaults ─────────────────────────────────────────────────────────
const PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
    ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
};
// ─── Ollama auto-detection ─────────────────────────────────────────────────────
export async function detectOllama() {
    try {
        const res = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(2000),
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        if (data.models?.length)
            return { model: data.models[0].name };
    }
    catch { /* not running */ }
    return null;
}
// ─── LLM Provider ──────────────────────────────────────────────────────────────
export class LLM {
    apiKey;
    baseUrl;
    model;
    temperature;
    maxTokens;
    timeout;
    constructor(config = {}) {
        const p = PROVIDERS[config.provider ?? 'deepseek'] ?? PROVIDERS.deepseek;
        this.baseUrl = (config.baseUrl ?? p.baseUrl).replace(/\/$/, '');
        this.model = config.model ?? p.model;
        this.apiKey = config.apiKey ?? '';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 2048;
        this.timeout = config.timeout ?? 30000;
    }
    /** Non-streaming chat completion */
    async chat(messages) {
        const res = await this.fetchAPI({ messages, stream: false });
        const data = await res.json();
        const choice = data.choices[0];
        if (!choice)
            throw new Error('LLM returned no choices');
        return {
            content: choice.message.content, model: data.model,
            usage: {
                inputTokens: data.usage?.prompt_tokens ?? 0,
                outputTokens: data.usage?.completion_tokens ?? 0,
                totalTokens: data.usage?.total_tokens ?? 0,
            },
        };
    }
    /** Streaming chat completion */
    async *chatStream(messages) {
        const res = await this.fetchAPI({ messages, stream: true });
        if (!res.ok) {
            yield { type: 'error', error: `LLM ${res.status}: ${await res.text().catch(() => 'unknown')}` };
            return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
            yield { type: 'error', error: 'No response body' };
            return;
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: '))
                    continue;
                const payload = trimmed.slice(6);
                if (payload === '[DONE]') {
                    yield { type: 'done' };
                    return;
                }
                try {
                    const chunk = JSON.parse(payload);
                    const content = chunk.choices[0]?.delta?.content;
                    if (content)
                        yield { type: 'content', text: content };
                    if (chunk.choices[0]?.finish_reason === 'stop') {
                        yield { type: 'done' };
                        return;
                    }
                }
                catch { /* skip malformed */ }
            }
        }
        yield { type: 'done' };
    }
    // ── Internal ─────────────────────────────────────────────────────────────────
    async fetchAPI(body, retries = 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey)
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        try {
            return await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST', headers,
                body: JSON.stringify({
                    model: this.model, messages: body.messages,
                    temperature: this.temperature, max_tokens: this.maxTokens,
                    stream: body.stream ?? false,
                }),
                signal: controller.signal,
            });
        }
        catch (err) {
            if (retries > 0)
                return this.fetchAPI(body, retries - 1);
            if (err instanceof DOMException && err.name === 'AbortError')
                throw new Error(`Request timed out after ${this.timeout / 1000}s`);
            throw new Error(`Network error: ${String(err)}`);
        }
        finally {
            clearTimeout(timer);
        }
    }
}
/** @deprecated Use LLM instead */
export const DeepSeek = LLM;
//# sourceMappingURL=llm.js.map