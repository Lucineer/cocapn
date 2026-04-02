/**
 * cocapn invite — Share agent with invite links
 *
 * Usage:
 *   cocapn invite create            — Create invite link
 *   cocapn invite create --readonly — Create read-only invite
 *   cocapn invite create --mode public --expires 7d
 *   cocapn invite list              — List active invites
 *   cocapn invite revoke <code>     — Revoke an invite
 *   cocapn invite accept <code>     — Accept an invite (clone + configure)
 */
import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { execSync } from "child_process";
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
// ─── Constants ──────────────────────────────────────────────────────────────
const INVITES_DIR = "cocapn/invites";
const DEFAULT_EXPIRY_DAYS = 7;
// ─── Helpers ────────────────────────────────────────────────────────────────
function generateCode() {
    const bytes = randomBytes(6);
    return bytes.toString("hex").slice(0, 8);
}
function invitesDirPath(repoRoot) {
    return join(repoRoot, INVITES_DIR);
}
function inviteFilePath(repoRoot, code) {
    return join(repoRoot, INVITES_DIR, `${code}.json`);
}
function parseExpiry(input) {
    const match = input.match(/^(\d+)(d|h|m)$/);
    if (!match) {
        throw new Error(`Invalid expiry format: ${input}. Use format like 7d, 24h, 30m.`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();
    switch (unit) {
        case "d":
            now.setDate(now.getDate() + value);
            break;
        case "h":
            now.setHours(now.getHours() + value);
            break;
        case "m":
            now.setMinutes(now.getMinutes() + value);
            break;
    }
    return now;
}
function isExpired(invite) {
    if (invite.revokedAt)
        return true;
    return new Date(invite.expiresAt) < new Date();
}
// ─── Create invite ──────────────────────────────────────────────────────────
export function createInvite(repoRoot, options = {}) {
    const dir = invitesDirPath(repoRoot);
    mkdirSync(dir, { recursive: true });
    const code = generateCode();
    const mode = options.mode === "public" || options.mode === "private" || options.mode === "maintenance"
        ? options.mode
        : "public";
    const expiresAt = options.expires
        ? parseExpiry(options.expires)
        : (() => { const d = new Date(); d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS); return d; })();
    const invite = {
        code,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        mode,
        readOnly: options.readonly ?? false,
        uses: 0,
    };
    // Detect public repo URL if available
    try {
        const remote = execSync("git remote get-url origin 2>/dev/null || true", {
            cwd: repoRoot,
            encoding: "utf-8",
            timeout: 5000,
        }).trim();
        if (remote) {
            invite.publicRepo = remote;
        }
    }
    catch {
        // No git remote — skip
    }
    writeFileSync(inviteFilePath(repoRoot, code), JSON.stringify(invite, null, 2), "utf-8");
    return invite;
}
// ─── List invites ───────────────────────────────────────────────────────────
export function listInvites(repoRoot) {
    const dir = invitesDirPath(repoRoot);
    if (!existsSync(dir))
        return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
        try {
            return JSON.parse(readFileSync(join(dir, f), "utf-8"));
        }
        catch {
            return null;
        }
    })
        .filter((inv) => inv !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
// ─── Revoke invite ──────────────────────────────────────────────────────────
export function revokeInvite(repoRoot, code) {
    const filePath = inviteFilePath(repoRoot, code);
    if (!existsSync(filePath)) {
        throw new Error(`Invite not found: ${code}`);
    }
    const invite = JSON.parse(readFileSync(filePath, "utf-8"));
    if (invite.revokedAt) {
        throw new Error(`Invite already revoked: ${code}`);
    }
    invite.revokedAt = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(invite, null, 2), "utf-8");
    return invite;
}
// ─── Accept invite ──────────────────────────────────────────────────────────
export function acceptInvite(repoRoot, code, targetDir) {
    const filePath = inviteFilePath(repoRoot, code);
    if (!existsSync(filePath)) {
        throw new Error(`Invite not found: ${code}`);
    }
    const invite = JSON.parse(readFileSync(filePath, "utf-8"));
    if (invite.revokedAt) {
        throw new Error(`Invite has been revoked: ${code}`);
    }
    if (isExpired(invite)) {
        throw new Error(`Invite has expired: ${code} (expired ${invite.expiresAt})`);
    }
    if (!invite.publicRepo) {
        throw new Error(`Invite has no public repo URL configured`);
    }
    // Increment uses
    invite.uses++;
    writeFileSync(filePath, JSON.stringify(invite, null, 2), "utf-8");
    const cloneDir = targetDir ?? code;
    // Clone the public repo
    execSync(`git clone "${invite.publicRepo}" "${cloneDir}"`, {
        cwd: repoRoot,
        stdio: "pipe",
        timeout: 60000,
    });
    // Write invite config into the cloned repo
    const inviteConfigPath = join(repoRoot, cloneDir, "cocapn", "invite.json");
    mkdirSync(join(repoRoot, cloneDir, "cocapn"), { recursive: true });
    writeFileSync(inviteConfigPath, JSON.stringify({
        code,
        mode: invite.mode,
        readOnly: invite.readOnly,
        acceptedAt: new Date().toISOString(),
    }, null, 2), "utf-8");
    return { invite, cloneDir };
}
// ─── Display helpers ────────────────────────────────────────────────────────
function formatInvite(invite) {
    const expired = isExpired(invite);
    const revoked = !!invite.revokedAt;
    const status = revoked ? red("REVOKED") : expired ? yellow("EXPIRED") : green("ACTIVE");
    const lines = [
        `  ${cyan(invite.code)}  ${status}`,
        `    ${gray("Created:")} ${invite.createdAt}`,
        `    ${gray("Expires:")} ${invite.expiresAt}`,
        `    ${gray("Mode:")}    ${invite.mode}${invite.readOnly ? ` (${yellow("read-only")})` : ""}`,
        `    ${gray("Uses:")}    ${invite.uses}`,
    ];
    if (invite.publicRepo) {
        lines.push(`    ${gray("Repo:")}    ${invite.publicRepo}`);
    }
    return lines.join("\n");
}
// ─── Command ────────────────────────────────────────────────────────────────
export function createInviteCommand() {
    return new Command("invite")
        .description("Share agent with invite links")
        .addCommand(new Command("create")
        .description("Create a new invite link")
        .option("--readonly", "Read-only access", false)
        .option("--mode <mode>", "Access mode: public, private, maintenance", "public")
        .option("--expires <duration>", "Expiry duration (e.g. 7d, 24h, 30m)", "7d")
        .action(function () {
        const repoRoot = process.cwd();
        if (!existsSync(join(repoRoot, "cocapn"))) {
            console.log(red("\n  No cocapn/ directory found. Run cocapn setup first.\n"));
            process.exit(1);
        }
        const opts = this.opts();
        try {
            const invite = createInvite(repoRoot, {
                mode: opts.mode,
                readonly: opts.readonly,
                expires: opts.expires,
            });
            console.log(bold("\n  cocapn invite create\n"));
            console.log(`  ${green("Code:")}    ${invite.code}`);
            console.log(`  ${cyan("Mode:")}    ${invite.mode}${invite.readOnly ? " (read-only)" : ""}`);
            console.log(`  ${cyan("Expires:")} ${invite.expiresAt}`);
            if (invite.publicRepo) {
                console.log(`  ${cyan("Repo:")}    ${invite.publicRepo}`);
            }
            console.log(`\n  Share:  ${green(`cocapn invite accept ${invite.code}`)}\n`);
        }
        catch (err) {
            console.log(red(`\n  ${err.message}\n`));
            process.exit(1);
        }
    }))
        .addCommand(new Command("list")
        .description("List active invites")
        .action(() => {
        const repoRoot = process.cwd();
        const invites = listInvites(repoRoot);
        console.log(bold("\n  cocapn invite list\n"));
        if (invites.length === 0) {
            console.log(gray("  No invites found.\n"));
            return;
        }
        for (const invite of invites) {
            console.log(formatInvite(invite));
            console.log();
        }
    }))
        .addCommand(new Command("revoke")
        .description("Revoke an invite")
        .argument("<code>", "Invite code to revoke")
        .action((code) => {
        const repoRoot = process.cwd();
        try {
            const invite = revokeInvite(repoRoot, code);
            console.log(bold("\n  cocapn invite revoke\n"));
            console.log(`  ${red("Revoked:")} ${invite.code}`);
            console.log(green("\n  Done.\n"));
        }
        catch (err) {
            console.log(red(`\n  ${err.message}\n`));
            process.exit(1);
        }
    }))
        .addCommand(new Command("accept")
        .description("Accept an invite (clone repo with config)")
        .argument("<code>", "Invite code")
        .option("-d, --dir <path>", "Target directory for clone")
        .action((code, options) => {
        const repoRoot = process.cwd();
        try {
            const result = acceptInvite(repoRoot, code, options.dir);
            console.log(bold("\n  cocapn invite accept\n"));
            console.log(`  ${green("Code:")}    ${result.invite.code}`);
            console.log(`  ${cyan("Mode:")}    ${result.invite.mode}${result.invite.readOnly ? " (read-only)" : ""}`);
            console.log(`  ${cyan("Cloned:")}  ${result.cloneDir}`);
            console.log(green("\n  Done.\n"));
        }
        catch (err) {
            console.log(red(`\n  ${err.message}\n`));
            process.exit(1);
        }
    }));
}
//# sourceMappingURL=invite.js.map