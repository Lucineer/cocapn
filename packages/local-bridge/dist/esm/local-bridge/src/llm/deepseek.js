/**
 * DeepSeek LLM Provider
 *
 * Uses the DeepSeek API (OpenAI-compatible) for chat completions.
 * Supports both streaming and non-streaming modes.
 *
 * API: https://api.deepseek.com/v1/chat/completions
 */
import { getKeepAliveAgent } from './keep-alive.js';
// ─── DeepSeek model patterns ──────────────────────────────────────────────────
const DEEPSEEK_MODELS = /^deepseek-/;
// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULTS = {
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    timeout: 30000,
    maxRetries: 2,
};
// ─── DeepSeekProvider ─────────────────────────────────────────────────────────
export class DeepSeekProvider {
    name = 'deepseek';
    apiKey;
    baseUrl;
    timeout;
    maxRetries;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/$/, '');
        this.timeout = config.timeout ?? DEFAULTS.timeout;
        this.maxRetries = config.maxRetries ?? DEFAULTS.maxRetries;
    }
    supports(model) {
        return DEEPSEEK_MODELS.test(model);
    }
    async chat(messages, options) {
        const model = options?.model ?? DEFAULTS.defaultModel;
        const prepared = this.prepareMessages(messages, options?.systemPrompt);
        const body = {
            model,
            messages: prepared,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            stream: false,
        };
        const data = await this.requestWithRetry(body);
        const choice = data.choices[0];
        if (!choice)
            throw new Error('DeepSeek returned no choices');
        return {
            content: choice.message.content,
            model: data.model,
            usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            },
        };
    }
    async *chatStream(messages, options) {
        const model = options?.model ?? DEFAULTS.defaultModel;
        const prepared = this.prepareMessages(messages, options?.systemPrompt);
        const body = {
            model,
            messages: prepared,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            stream: true,
        };
        const response = await this.fetch(body);
        if (!response.ok) {
            const error = await response.text();
            yield { type: 'error', error: `DeepSeek error: ${response.status} ${error}` };
            return;
        }
        for await (const chunk of this.parseSSE(response)) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield { type: 'content', text: content };
            }
            if (chunk.choices[0]?.finish_reason === 'stop' && chunk.usage) {
                if (chunk.usage.prompt_tokens !== undefined && chunk.usage.completion_tokens !== undefined) {
                    yield {
                        type: 'done',
                        usage: {
                            inputTokens: chunk.usage.prompt_tokens,
                            outputTokens: chunk.usage.completion_tokens,
                        },
                    };
                    return;
                }
            }
        }
        yield { type: 'done' };
    }
    // ── Internal helpers ────────────────────────────────────────────────────────
    prepareMessages(messages, systemPrompt) {
        if (!systemPrompt)
            return messages;
        // Prepend system prompt if not already present
        if (messages.length > 0 && messages[0].role === 'system') {
            return messages;
        }
        return [{ role: 'system', content: systemPrompt }, ...messages];
    }
    async requestWithRetry(body) {
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (attempt > 0) {
                // Exponential backoff: 1s, 2s, 4s...
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
            try {
                const response = await this.fetch(body);
                if (!response.ok) {
                    const errorText = await response.text();
                    lastError = new Error(`DeepSeek API error ${response.status}: ${errorText}`);
                    // Retry on 429 (rate limit) and 5xx (server error)
                    if (response.status === 429 || response.status >= 500) {
                        continue;
                    }
                    throw lastError;
                }
                return await response.json();
            }
            catch (err) {
                if (err instanceof TypeError) {
                    // Network error — retryable
                    lastError = err;
                    continue;
                }
                throw err;
            }
        }
        throw lastError ?? new Error('DeepSeek request failed after retries');
    }
    async fetch(body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
                dispatcher: getKeepAliveAgent(this.name),
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (err) {
            clearTimeout(timeoutId);
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error('DeepSeek request timeout');
            }
            throw err;
        }
    }
    async *parseSSE(response) {
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('Response body is not readable');
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
                if (!trimmed || !trimmed.startsWith('data: '))
                    continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]')
                    return;
                try {
                    yield JSON.parse(data);
                }
                catch {
                    // Skip malformed chunks
                }
            }
        }
    }
}
//# sourceMappingURL=deepseek.js.map