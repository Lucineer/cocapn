/**
 * OpenAI LLM Provider
 *
 * Uses the OpenAI API for chat completions.
 * Supports both streaming and non-streaming modes.
 * Also works with OpenAI-compatible APIs (e.g., Together AI, Fireworks).
 *
 * API: https://api.openai.com/v1/chat/completions
 */
import { getKeepAliveAgent } from './keep-alive.js';
// ─── OpenAI model patterns ────────────────────────────────────────────────────
const OPENAI_MODELS = /^gpt-|^o[1-9]/;
// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULTS = {
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o',
    timeout: 60000,
    maxRetries: 2,
};
// ─── OpenAIProvider ───────────────────────────────────────────────────────────
export class OpenAIProvider {
    name = 'openai';
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
        return OPENAI_MODELS.test(model);
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
            throw new Error('OpenAI returned no choices');
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
            yield { type: 'error', error: `OpenAI error: ${response.status} ${error}` };
            return;
        }
        for await (const chunk of this.parseSSE(response)) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield { type: 'content', text: content };
            }
            if (chunk.choices[0]?.finish_reason === 'stop' && chunk.usage) {
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
        yield { type: 'done' };
    }
    // ── Internal helpers ────────────────────────────────────────────────────────
    prepareMessages(messages, systemPrompt) {
        if (!systemPrompt)
            return messages;
        if (messages.length > 0 && messages[0].role === 'system') {
            return messages;
        }
        return [{ role: 'system', content: systemPrompt }, ...messages];
    }
    async requestWithRetry(body) {
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
            try {
                const response = await this.fetch(body);
                if (!response.ok) {
                    const errorText = await response.text();
                    lastError = new Error(`OpenAI API error ${response.status}: ${errorText}`);
                    if (response.status === 429 || response.status >= 500) {
                        continue;
                    }
                    throw lastError;
                }
                return await response.json();
            }
            catch (err) {
                if (err instanceof TypeError) {
                    lastError = err;
                    continue;
                }
                throw err;
            }
        }
        throw lastError ?? new Error('OpenAI request failed after retries');
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
                throw new Error('OpenAI request timeout');
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
//# sourceMappingURL=openai.js.map