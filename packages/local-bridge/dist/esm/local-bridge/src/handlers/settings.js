/**
 * Settings Handlers — WebSocket handlers for settings operations
 *
 * Provides GET_SETTINGS and UPDATE_SETTINGS methods for runtime configuration.
 */
/**
 * Handle GET_SETTINGS WebSocket method
 * Returns all current settings with API keys masked for safety
 */
export async function handleGetSettings(context, sender) {
    const { settingsManager } = context;
    if (!settingsManager) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'Settings manager not available',
                settings: null,
            },
        });
        return;
    }
    try {
        const settings = settingsManager.getAll();
        const safeString = settingsManager.toSafeString();
        const safeSettings = JSON.parse(safeString);
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                settings: safeSettings,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                settings: null,
            },
        });
    }
}
/**
 * Handle UPDATE_SETTINGS WebSocket method
 * Updates settings and persists to disk
 *
 * @param params.settings - Partial settings object with values to update
 * @param params.validate - Whether to validate settings (default: true)
 */
export async function handleUpdateSettings(context, sender, params) {
    const { settingsManager } = context;
    if (!settingsManager) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'Settings manager not available',
                updated: false,
                validation: null,
            },
        });
        return;
    }
    if (!params.settings) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'No settings provided',
                updated: false,
                validation: null,
            },
        });
        return;
    }
    try {
        // Validate if requested
        const shouldValidate = params.validate !== false;
        let validation = null;
        if (shouldValidate) {
            // Create a temporary settings object for validation
            const currentSettings = settingsManager.getAll();
            const testSettings = { ...currentSettings, ...params.settings };
            // Use a temporary validation approach
            validation = validateSettingsObject(testSettings);
        }
        if (shouldValidate && validation && !validation.valid) {
            await sender({
                jsonrpc: '2.0',
                id: null,
                result: {
                    success: false,
                    error: 'Settings validation failed',
                    updated: false,
                    validation,
                },
            });
            return;
        }
        // Apply updates
        settingsManager.merge(params.settings);
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                updated: true,
                validation,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                updated: false,
                validation: null,
            },
        });
    }
}
/**
 * Validate a settings object (independent of SettingsManager instance)
 */
function validateSettingsObject(settings) {
    const errors = [];
    const warnings = [];
    // Validate port
    if (settings.port !== undefined) {
        if (typeof settings.port !== 'number' || settings.port < 1 || settings.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }
    }
    // Validate temperature
    if (settings.temperature !== undefined) {
        if (typeof settings.temperature !== 'number' || settings.temperature < 0 || settings.temperature > 2) {
            errors.push('Temperature must be between 0 and 2');
        }
    }
    // Validate maxTokens
    if (settings.maxTokens !== undefined) {
        if (typeof settings.maxTokens !== 'number' || settings.maxTokens < 1) {
            errors.push('maxTokens must be positive');
        }
    }
    // Validate hybridSearchAlpha
    if (settings.hybridSearchAlpha !== undefined) {
        if (typeof settings.hybridSearchAlpha !== 'number' || settings.hybridSearchAlpha < 0 || settings.hybridSearchAlpha > 1) {
            errors.push('hybridSearchAlpha must be between 0 and 1');
        }
    }
    // Validate skillMemoryBudget
    if (settings.skillMemoryBudget !== undefined) {
        if (typeof settings.skillMemoryBudget !== 'number' || settings.skillMemoryBudget < 1) {
            errors.push('skillMemoryBudget must be positive');
        }
    }
    // Validate maxLoadedSkills
    if (settings.maxLoadedSkills !== undefined) {
        if (typeof settings.maxLoadedSkills !== 'number' || settings.maxLoadedSkills < 1) {
            errors.push('maxLoadedSkills must be positive');
        }
    }
    // Warnings for missing API keys
    if (!settings.apiKey) {
        warnings.push('No API key configured — AI features will be limited');
    }
    if (settings.embeddingProvider === 'openai' && !settings.openaiApiKey) {
        warnings.push("Embedding provider is 'openai' but no OpenAI API key is configured");
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Handle SETTINGS_VALIDATE WebSocket method
 * Validates settings without applying them
 */
export async function handleSettingsValidate(context, sender, params) {
    if (!params.settings) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: 'No settings provided',
                validation: null,
            },
        });
        return;
    }
    try {
        const validation = validateSettingsObject(params.settings);
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: true,
                validation,
            },
        });
    }
    catch (error) {
        await sender({
            jsonrpc: '2.0',
            id: null,
            result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                validation: null,
            },
        });
    }
}
//# sourceMappingURL=settings.js.map