/**
 * cocapn deploy — One-command deployment to Cloudflare / Docker
 *
 * Usage:
 *   cocapn deploy cloudflare  — Deploy to Cloudflare Workers
 *   cocapn deploy docker      — Build and run Docker container
 *   cocapn deploy status      — Check deployment status
 */
import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
// --- Color helpers ---
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
};
const bold = (s) => `${c.bold}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const red = (s) => `${c.red}${s}${c.reset}`;
// --- Public API ---
export function createDeployCommand() {
    return (new Command("deploy")
        .description("Deploy cocapn instance to Cloudflare Workers or Docker")
        .addCommand(createCloudflareCommand())
        .addCommand(createDockerCommand())
        .addCommand(createStatusCommand()));
}
// --- cloudflare subcommand ---
function createCloudflareCommand() {
    return (new Command("cloudflare")
        .description("Deploy to Cloudflare Workers")
        .option("-e, --env <environment>", "Environment (production, staging)", "production")
        .option("-r, --region <region>", "Cloudflare region", "auto")
        .option("--no-verify", "Skip post-deploy health checks")
        .option("--no-tests", "Skip pre-deploy tests")
        .option("--dry-run", "Build and validate without uploading")
        .option("-v, --verbose", "Detailed logging")
        .action(async (opts) => {
        try {
            await deployCloudflare(opts);
        }
        catch (err) {
            console.error(red("\u2717 Deployment failed"));
            console.error(`  ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }));
}
// --- docker subcommand ---
function createDockerCommand() {
    return (new Command("docker")
        .description("Build and run Docker container")
        .option("-t, --tag <tag>", "Image tag", "cocapn")
        .option("-p, --port <port>", "Host port mapping", "3100")
        .option("-b, --brain <path>", "Brain volume path", "./cocapn")
        .option("-v, --verbose", "Detailed logging")
        .action(async (opts) => {
        try {
            await deployDocker(opts);
        }
        catch (err) {
            console.error(red("\u2717 Docker deployment failed"));
            console.error(`  ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }));
}
// --- status subcommand ---
function createStatusCommand() {
    return new Command("status")
        .description("Check deployment status for all targets")
        .action(async () => {
        try {
            await checkStatus();
        }
        catch (err) {
            console.error(red("\u2717 Status check failed"));
            console.error(`  ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
}
// --- Cloudflare deployment ---
async function deployCloudflare(opts) {
    const cwd = process.cwd();
    // Prerequisite: wrangler.toml
    const wranglerPath = join(cwd, "wrangler.toml");
    if (!existsSync(wranglerPath)) {
        throw new Error("Missing wrangler.toml. Run 'cocapn init' first.");
    }
    console.log(green("\u2713") + " Found wrangler.toml");
    // Prerequisite: API token
    const apiToken = process.env.CLOUDFLARE_API_TOKEN ||
        process.env.CF_API_TOKEN ||
        loadEnvVar(cwd, "CLOUDFLARE_API_TOKEN");
    if (!apiToken) {
        throw new Error("Missing CLOUDFLARE_API_TOKEN. Set it in your environment or .env.local.");
    }
    console.log(green("\u2713") + " Cloudflare API token found");
    if (opts.verbose) {
        console.log(yellow("Configuration:"));
        console.log(`  Environment: ${opts.env}`);
        console.log(`  Region: ${opts.region}`);
    }
    // Pre-deploy tests
    if (opts.tests) {
        console.log(cyan("\u25b8 Running tests..."));
        execSafe("npx vitest run", { cwd, verbose: opts.verbose });
        console.log(green("\u2713 Tests passed"));
    }
    else {
        console.log(yellow("\u26a0 Skipping tests (--no-tests)"));
    }
    // Dry-run stops here
    if (opts.dryRun) {
        console.log(cyan("\u25b8 Dry run complete \u2014 no deployment performed"));
        return;
    }
    // Deploy
    console.log(cyan("\u25b8 Deploying to Cloudflare Workers..."));
    const envArgs = opts.env !== "production" ? `--env ${opts.env}` : "";
    const output = execSafe(`npx wrangler deploy ${envArgs}`, {
        cwd,
        verbose: opts.verbose,
    });
    console.log(green("\u2713 Uploaded to Cloudflare"));
    // Extract URL from wrangler output
    const deployedUrl = extractUrl(output);
    if (deployedUrl) {
        console.log();
        console.log(cyan("\ud83d\ude80 Deployed to: ") + green(deployedUrl));
    }
    // Health check
    if (opts.verify && deployedUrl) {
        console.log(cyan("\u25b8 Verifying health endpoint..."));
        try {
            const healthUrl = `${deployedUrl.replace(/\/+$/, "")}/_health`;
            const resp = await fetch(healthUrl);
            const body = (await resp.json());
            if (body.status === "healthy") {
                console.log(green("\u2713 Health check passed"));
            }
            else {
                console.warn(yellow("\u26a0 Health check returned non-healthy status"));
            }
        }
        catch {
            console.warn(yellow("\u26a0 Health endpoint not reachable (may take a moment)"));
        }
    }
    console.log();
    console.log(cyan("\ud83d\udd17 Next steps:"));
    console.log(`   - View logs: ${cyan("npx wrangler tail")}`);
    console.log(`   - Rollback: ${cyan("cocapn rollback")}`);
}
// --- Docker deployment ---
async function deployDocker(opts) {
    const cwd = process.cwd();
    // Prerequisite: Dockerfile
    const dockerfilePath = join(cwd, "Dockerfile");
    if (!existsSync(dockerfilePath)) {
        throw new Error("Missing Dockerfile. Add a Dockerfile to your project root.");
    }
    console.log(green("\u2713") + " Found Dockerfile");
    // Prerequisite: docker binary
    try {
        execSafe("docker --version", { cwd, verbose: opts.verbose });
    }
    catch {
        throw new Error("Docker is not installed or not in PATH.");
    }
    console.log(green("\u2713") + " Docker is available");
    // Build
    console.log(cyan("\u25b8 Building Docker image..."));
    execSafe(`docker build -t ${opts.tag} .`, { cwd, verbose: opts.verbose });
    console.log(green(`\u2713 Built image: ${opts.tag}`));
    // Resolve brain path to absolute
    const brainPath = resolvePath(opts.brain);
    // Run
    console.log(cyan("\u25b8 Starting container..."));
    const runOutput = execSafe(`docker run -d -p ${opts.port}:3100 -v ${brainPath}:/app/brain ${opts.tag}`, { cwd, verbose: opts.verbose });
    const containerId = runOutput.trim().split("\n").pop()?.trim() || "unknown";
    console.log();
    console.log(cyan("\ud83d\ude80 Container running:"));
    console.log(`   ID:    ${green(containerId)}`);
    console.log(`   Image: ${opts.tag}`);
    console.log(`   Port:  ${opts.port}`);
    console.log(`   Brain: ${brainPath}`);
    console.log();
    console.log(cyan("\ud83d\udd17 Next steps:"));
    console.log(`   - View logs: ${cyan(`docker logs -f ${containerId}`)}`);
    console.log(`   - Stop:      ${cyan(`docker stop ${containerId}`)}`);
}
// --- Status check ---
async function checkStatus() {
    const cwd = process.cwd();
    let foundAny = false;
    // Cloud
    console.log(cyan("\u25b8 Cloudflare Workers:"));
    const wranglerPath = join(cwd, "wrangler.toml");
    if (existsSync(wranglerPath)) {
        try {
            // Try to extract worker name from wrangler.toml
            const wranglerContent = readFileSync(wranglerPath, "utf-8");
            const nameMatch = wranglerContent.match(/name\s*=\s*"([^"]+)"/);
            const workerName = nameMatch ? nameMatch[1] : "unknown";
            console.log(`   Worker: ${workerName}`);
            // Check if deployed via wrangler
            try {
                const tailOutput = execSafe("npx wrangler deployments list 2>&1 || true", {
                    cwd,
                    verbose: false,
                });
                if (tailOutput.includes("error") || tailOutput.includes("Error")) {
                    console.log(yellow("   Status: Not deployed or unreachable"));
                }
                else {
                    console.log(green("   Status: Deployed"));
                }
            }
            catch {
                console.log(yellow("   Status: Unable to verify (check API token)"));
            }
        }
        catch {
            console.log(red("   Status: Error reading wrangler.toml"));
        }
    }
    else {
        console.log(yellow("   Status: No wrangler.toml found"));
    }
    // Docker
    console.log(cyan("\u25b8 Docker:"));
    try {
        const psOutput = execSafe('docker ps --filter "ancestor=cocapn" --format "{{.ID}} {{.Status}}"', {
            cwd,
            verbose: false,
        });
        if (psOutput.trim()) {
            const lines = psOutput.trim().split("\n");
            for (const line of lines) {
                const [id, status] = line.split(/\s+/, 2);
                console.log(`   Container ${id}: ${green(status || "running")}`);
                foundAny = true;
            }
        }
        else {
            console.log(yellow("   Status: No cocapn containers running"));
        }
    }
    catch {
        console.log(yellow("   Status: Docker not available"));
    }
    // Local bridge
    console.log(cyan("\u25b8 Local bridge:"));
    try {
        const psOutput = execSafe("pgrep -f 'cocapn.*start' || true", {
            cwd,
            verbose: false,
        });
        if (psOutput.trim()) {
            console.log(green(`   Status: Running (PID ${psOutput.trim()})`));
            foundAny = true;
        }
        else {
            console.log(yellow("   Status: Not running"));
        }
    }
    catch {
        console.log(yellow("   Status: Unable to check"));
    }
    if (!foundAny) {
        console.log();
        console.log(yellow("No active deployments found. Run:"));
        console.log(`   ${cyan("cocapn deploy cloudflare")} — Deploy to Workers`);
        console.log(`   ${cyan("cocapn deploy docker")}     — Run via Docker`);
        console.log(`   ${cyan("cocapn start")}            — Start local bridge`);
    }
}
// --- Helpers ---
function execSafe(command, options) {
    try {
        const output = execSync(command, {
            cwd: options.cwd,
            encoding: "utf-8",
            stdio: options.verbose ? "inherit" : "pipe",
            timeout: 120_000,
            env: { ...process.env },
        });
        return typeof output === "string" ? output : "";
    }
    catch (err) {
        if (err instanceof Error && "status" in err && err.status !== 0) {
            throw new Error(`Command failed: ${command}`);
        }
        throw err;
    }
}
function extractUrl(output) {
    // wrangler outputs "Published <name> (<url>)" or "  <url>"
    const patterns = [
        /https?:\/\/[^\s)]+/,
        /Published.*?\((https?:\/\/[^\s)]+)\)/,
    ];
    for (const pat of patterns) {
        const match = output.match(pat);
        if (match)
            return match[1] || match[0];
    }
    return null;
}
function loadEnvVar(cwd, key) {
    for (const file of [".env.local", ".env"]) {
        const envPath = join(cwd, file);
        if (!existsSync(envPath))
            continue;
        const content = readFileSync(envPath, "utf-8");
        const line = content
            .split("\n")
            .find((l) => l.startsWith(`${key}=`) || l.startsWith(`${key} `));
        if (line) {
            const eq = line.indexOf("=");
            return line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
    }
    return undefined;
}
function resolvePath(p) {
    if (p.startsWith("/"))
        return p;
    return join(process.cwd(), p);
}
// Exported for testing
export { execSafe, extractUrl, loadEnvVar, deployCloudflare, deployDocker, checkStatus };
//# sourceMappingURL=deploy.js.map