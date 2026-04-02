/**
 * Runtime configuration types for the local bridge.
 * Mirrors the cocapn-private.schema.json structure.
 */
export const DEFAULT_CONFIG = {
    soul: "soul.md",
    config: {
        mode: "local",
        port: 8787,
        tunnel: undefined,
    },
    memory: {
        facts: "memory/facts.json",
        procedures: "memory/procedures",
        relationships: "memory/relationships.json",
    },
    encryption: {
        publicKey: "",
        recipients: [],
        encryptedPaths: ["secrets/**", "*.secret.yml"],
    },
    sync: {
        interval: 300,
        memoryInterval: 60,
        autoCommit: true,
        autoPush: false,
    },
    vectorSearch: {
        enabled: true,
        provider: "local",
        dimensions: 384,
        alpha: 0.6,
    },
};
//# sourceMappingURL=types.js.map