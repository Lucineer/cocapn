/**
 * Gateway module — private-agent-as-gateway pattern.
 *
 * All public repo edits flow through PrivateGateway.
 * PublicGuard scans for secret/PII leaks.
 * GatewaySecretManager handles deployment secrets.
 */

export { PrivateGateway, type EditResult, type ReviewResult, type DeployResult, type PublicChange, type DeployPlatform, type GatewayEventMap } from "./private-gateway.js";
export { PublicGuard, type GuardResult, type GuardViolation, type GuardWhitelistEntry } from "./public-guard.js";
export { GatewaySecretManager, type SecretEntry, type AuditResult, type SyncResult } from "./secret-manager.js";
