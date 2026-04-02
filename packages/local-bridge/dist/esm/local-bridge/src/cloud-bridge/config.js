/**
 * Cloud Bridge Configuration Types
 *
 * Defines the configuration interface for the CloudBridge class,
 * which connects cocapn agents to Cloudflare Workers backends.
 */
export const DEFAULT_CLOUD_BRIDGE_CONFIG = {
    piiEnabled: true,
    routingEnabled: true,
    defaultModel: 'deepseek-chat',
    timeout: 30000,
};
//# sourceMappingURL=config.js.map