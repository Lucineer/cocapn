/**
 * cocapn deploy — One-command deployment to Cloudflare / Docker
 *
 * Usage:
 *   cocapn deploy cloudflare  — Deploy to Cloudflare Workers
 *   cocapn deploy docker      — Build and run Docker container
 *   cocapn deploy status      — Check deployment status
 */
import { Command } from "commander";
interface CloudflareOptions {
    env: string;
    region: string;
    verify: boolean;
    tests: boolean;
    dryRun: boolean;
    verbose: boolean;
}
interface DockerOptions {
    tag: string;
    port: string;
    brain: string;
    verbose: boolean;
}
export declare function createDeployCommand(): Command;
declare function deployCloudflare(opts: CloudflareOptions): Promise<void>;
declare function deployDocker(opts: DockerOptions): Promise<void>;
declare function checkStatus(): Promise<void>;
declare function execSafe(command: string, options: {
    cwd: string;
    verbose: boolean;
}): string;
declare function extractUrl(output: string): string | null;
declare function loadEnvVar(cwd: string, key: string): string | undefined;
export { execSafe, extractUrl, loadEnvVar, deployCloudflare, deployDocker, checkStatus };
//# sourceMappingURL=deploy.d.ts.map