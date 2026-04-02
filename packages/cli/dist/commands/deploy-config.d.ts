/**
 * Deploy configuration loader
 *
 * Reads cocapn.json from project root and merges with:
 * - cocapn.{env}.json (environment-specific overrides)
 * - ~/.cocapn/deploy-settings.json (user settings)
 * - Default values
 */
export interface DeployConfig {
    name: string;
    version: string;
    template: string;
    description?: string;
    author?: string;
    license?: string;
    deploy: {
        account: string;
        account_id?: string;
        region: string;
        compatibility_date: string;
        compatibility_flags?: string[];
        environments?: Record<string, EnvironmentConfig>;
        vars: Record<string, string>;
        secrets: SecretConfig;
        durable_objects?: DurableObjectConfig[];
        kv_namespaces?: KVNamespaceConfig[];
        d1_databases?: D1DatabaseConfig[];
        migrations?: MigrationConfig[];
    };
}
export interface EnvironmentConfig {
    route?: string;
    vars?: Record<string, string>;
}
export interface SecretConfig {
    required: string[];
    optional?: string[];
}
export interface DurableObjectConfig {
    name: string;
    class_name: string;
    script_name?: string;
}
export interface KVNamespaceConfig {
    name: string;
    binding: string;
}
export interface D1DatabaseConfig {
    name: string;
    binding: string;
}
export interface MigrationConfig {
    tag: string;
    new_sqlite_classes?: string[];
}
export interface DeploySettings {
    cloudflare_api_token?: string;
    cloudflare_account_id?: string;
    default_region?: string;
    defaults?: Record<string, string>;
}
/**
 * Load deploy configuration from project directory
 */
export declare function loadDeployConfig(projectDir: string, env?: string): DeployConfig;
/**
 * Load secrets from ~/.cocapn/secrets.json
 */
export declare function loadSecrets(account: string): Record<string, string>;
/**
 * Get environment-specific configuration
 */
export declare function getEnvironmentConfig(config: DeployConfig, env: string): EnvironmentConfig | undefined;
//# sourceMappingURL=deploy-config.d.ts.map