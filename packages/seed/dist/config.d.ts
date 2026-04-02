/**
 * Config — schema validation for cocapn.json.
 */
export interface LLMConfig {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface Config {
    mode?: string;
    port?: number;
    llm?: LLMConfig;
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare function validateConfig(raw: Record<string, unknown>): string[];
/** Apply defaults to a parsed config */
export declare function applyDefaults(config: Config): Required<Pick<Config, 'mode' | 'port'>> & Config;
//# sourceMappingURL=config.d.ts.map