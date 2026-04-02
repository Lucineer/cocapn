/**
 * cocapn upgrade — Self-upgrade cocapn to latest version
 *
 * Usage:
 *   cocapn upgrade          — Check for updates and upgrade
 *   cocapn upgrade --check  — Check only, don't install
 *   cocapn upgrade --force  — Skip confirm prompt
 */
import { Command } from "commander";
import { execSync } from "child_process";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
// ─── ANSI colors ────────────────────────────────────────────────────────────
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
};
const bold = (s) => `${c.bold}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const red = (s) => `${c.red}${s}${c.reset}`;
const gray = (s) => `${c.gray}${s}${c.reset}`;
// ─── Semver parsing ─────────────────────────────────────────────────────────
export function parseSemver(version) {
    const match = version.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match)
        return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4],
    };
}
export function semverCompare(a, b) {
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    // prerelease versions are lower than release versions
    if (a.prerelease && !b.prerelease)
        return -1;
    if (!a.prerelease && b.prerelease)
        return 1;
    if (a.prerelease && b.prerelease)
        return a.prerelease.localeCompare(b.prerelease);
    return 0;
}
export function formatSemver(v) {
    const base = `${v.major}.${v.minor}.${v.patch}`;
    return v.prerelease ? `${base}-${v.prerelease}` : base;
}
// ─── Get current version ────────────────────────────────────────────────────
export function getCurrentVersion() {
    try {
        const require = createRequire(import.meta.url);
        const pkg = require("../package.json");
        return pkg.version;
    }
    catch {
        // Fallback: read package.json relative to this file
        try {
            const thisDir = dirname(fileURLToPath(import.meta.url));
            const pkg = JSON.parse(readFileSync(join(thisDir, "..", "package.json"), "utf-8"));
            return pkg.version;
        }
        catch {
            return "0.0.0";
        }
    }
}
// ─── Get latest version from npm ────────────────────────────────────────────
export function getLatestVersion() {
    try {
        const result = execSync("npm view cocapn version --json", {
            encoding: "utf-8",
            timeout: 15000,
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        // npm view may return quoted JSON
        const parsed = JSON.parse(result);
        return typeof parsed === "string" ? parsed : parsed.version || result;
    }
    catch {
        throw new Error("Failed to check npm registry. Check your network connection.");
    }
}
// ─── Install latest version ─────────────────────────────────────────────────
export function installLatest() {
    try {
        const result = execSync("npm install -g cocapn@latest", {
            encoding: "utf-8",
            timeout: 120000,
            stdio: ["pipe", "pipe", "pipe"],
        });
        return result;
    }
    catch (err) {
        throw new Error(`Failed to install cocapn@latest. ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─── Check for updates ──────────────────────────────────────────────────────
export function checkForUpdates() {
    const currentStr = getCurrentVersion();
    const latestStr = getLatestVersion();
    const current = parseSemver(currentStr);
    const latest = parseSemver(latestStr);
    if (!current) {
        throw new Error(`Could not parse current version: ${currentStr}`);
    }
    if (!latest) {
        throw new Error(`Could not parse latest version: ${latestStr}`);
    }
    const hasUpdate = semverCompare(latest, current) > 0;
    return {
        current,
        latest,
        hasUpdate,
        changelogUrl: `https://github.com/Lucineer/cocapn/releases/tag/v${formatSemver(latest)}`,
    };
}
// ─── Display ────────────────────────────────────────────────────────────────
function printCheckResult(result) {
    const currentStr = formatSemver(result.current);
    const latestStr = formatSemver(result.latest);
    if (result.hasUpdate) {
        console.log(`\n  ${yellow("\u26A0")}  Update available: ${bold(currentStr)} ${gray("\u2192")} ${green(latestStr)}\n`);
        console.log(`  ${gray("Changelog:")} ${cyan(result.changelogUrl)}\n`);
    }
    else {
        console.log(`\n  ${green("\u2713")}  cocapn ${bold(currentStr)} is up to date\n`);
    }
}
// ─── Confirm prompt ─────────────────────────────────────────────────────────
async function confirm(prompt) {
    process.stdout.write(prompt + " ");
    // Check if we're in a non-interactive context (piped, CI)
    if (!process.stdin.isTTY) {
        console.log(gray("(non-interactive, skipping)"));
        return false;
    }
    return new Promise((resolve) => {
        const onData = (chunk) => {
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            const answer = chunk.toString().trim().toLowerCase();
            resolve(answer === "y" || answer === "yes");
        };
        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        process.stdin.on("data", onData);
    });
}
// ─── Command ────────────────────────────────────────────────────────────────
export function createUpgradeCommand() {
    return new Command("upgrade")
        .description("Check for updates and upgrade cocapn")
        .option("--check", "Check for updates without installing")
        .option("--force", "Skip confirmation prompt")
        .action(async (options) => {
        try {
            const result = checkForUpdates();
            printCheckResult(result);
            if (options.check) {
                process.exit(0);
            }
            if (!result.hasUpdate) {
                process.exit(0);
            }
            // Confirm upgrade unless --force
            if (!options.force) {
                const ok = await confirm("Upgrade to latest version? [y/N]");
                if (!ok) {
                    console.log(gray("  Upgrade cancelled.\n"));
                    process.exit(0);
                }
            }
            // Install
            console.log(`  ${cyan("Installing cocapn@" + formatSemver(result.latest))}...\n`);
            installLatest();
            console.log(`  ${green("\u2713")}  Successfully upgraded to ${bold(formatSemver(result.latest))}\n`);
            console.log(`  ${gray("Run cocapn --version to verify.")}\n`);
        }
        catch (err) {
            console.log(`\n  ${red("\u274C")}  ${err instanceof Error ? err.message : String(err)}\n`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=upgrade.js.map