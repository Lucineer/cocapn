/**
 * Plugins — extensible plugin system for cocapn.
 *
 * Loads JS files from cocapn/plugins/*.js. Each exports a Plugin object.
 * Hooks run in load order. Plugin errors are caught and logged, never crash.
 * Zero dependencies.
 */
export interface ChatContext {
    message: string;
    facts: Record<string, string>;
    [key: string]: unknown;
}
export interface Plugin {
    name: string;
    version: string;
    hooks: {
        'before-chat'?: (message: string, context: ChatContext) => Promise<ChatContext>;
        'after-chat'?: (response: string, context: ChatContext) => Promise<string>;
        'command'?: Record<string, (args: string) => Promise<string>>;
        'periodic'?: () => Promise<void>;
    };
}
export declare class PluginLoader {
    plugins: Plugin[];
    private log;
    constructor(log?: (msg: string) => void);
    load(dir: string): Promise<void>;
    runBeforeChat(message: string, context: ChatContext): Promise<ChatContext>;
    runAfterChat(response: string, context: ChatContext): Promise<string>;
    getCommands(): Record<string, (args: string) => Promise<string>>;
    list(): Array<{
        name: string;
        version: string;
        commands: string[];
    }>;
}
//# sourceMappingURL=plugins.d.ts.map