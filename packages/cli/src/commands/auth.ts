/**
 * cocapn auth — Authentication and API key management
 *
 * Usage:
 *   cocapn auth login           — Authenticate with cocapn.ai
 *   cocapn auth logout          — Clear auth
 *   cocapn auth status          — Show auth status
 *   cocapn auth keys list       — Show configured keys (masked)
 *   cocapn auth keys set <provider> <key> — Set API key
 *   cocapn auth keys remove <provider>   — Remove API key
 */

import { Command } from "commander";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "fs";
import { join } from "path";

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

const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const green = (s: string) => `${c.green}${s}${c.reset}`;
const cyan = (s: string) => `${c.cyan}${s}${c.reset}`;
const yellow = (s: string) => `${c.yellow}${s}${c.reset}`;
const red = (s: string) => `${c.red}${s}${c.reset}`;
const gray = (s: string) => `${c.gray}${s}${c.reset}`;

// ─── Constants ──────────────────────────────────────────────────────────────

const AUTH_DIR = "cocapn";
const AUTH_FILE = "cocapn/.auth";
const ENV_LOCAL_FILE = ".env.local";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthData {
  token: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

export interface KeyEntry {
  provider: string;
  key: string;
  setAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Mask an API key — show first 8 chars + ***.
 * Short keys (< 8 chars) show first 4 + ***.
 * Empty/undefined returns "(none)".
 */
export function maskKey(key: string | undefined): string {
  if (!key) return "(none)";
  if (key.length < 4) return key.slice(0, 2) + "***";
  if (key.length <= 8) return key.slice(0, 4) + "***";
  return key.slice(0, 8) + "***";
}

/**
 * Decode a JWT payload without verification (for display only).
 * Returns null if the token is malformed.
 */
function decodeJWTPayload(token: string): { email?: string; exp?: number; iat?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.exp) return true;
  return Date.now() / 1000 > payload.exp;
}

/**
 * Get token expiry date string.
 */
export function getTokenExpiry(token: string): string | null {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.exp) return null;
  return new Date(payload.exp * 1000).toISOString();
}

/**
 * Get email from JWT.
 */
function getTokenEmail(token: string): string | null {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.email) return null;
  return payload.email;
}

// ─── Auth file operations ───────────────────────────────────────────────────

/**
 * Read stored auth data.
 */
export function readAuth(repoRoot: string): AuthData | null {
  const authPath = join(repoRoot, AUTH_FILE);
  if (!existsSync(authPath)) return null;

  try {
    return JSON.parse(readFileSync(authPath, "utf-8")) as AuthData;
  } catch {
    return null;
  }
}

/**
 * Write auth data to .auth file.
 */
export function writeAuth(repoRoot: string, auth: AuthData): void {
  const dir = join(repoRoot, AUTH_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".auth"), JSON.stringify(auth, null, 2), "utf-8");
}

/**
 * Remove stored auth data.
 */
export function removeAuth(repoRoot: string): boolean {
  const authPath = join(repoRoot, AUTH_FILE);
  if (!existsSync(authPath)) return false;
  rmSync(authPath);
  return true;
}

// ─── Auth actions ───────────────────────────────────────────────────────────

/**
 * Authenticate with cocapn.ai — stores JWT.
 * In a real implementation this would call the API; here we store the provided token.
 */
export function authLogin(repoRoot: string, token: string): AuthData {
  const email = getTokenEmail(token);
  const expiresAt = getTokenExpiry(token);

  const auth: AuthData = {
    token,
    email: email ?? "unknown",
    expiresAt: expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  writeAuth(repoRoot, auth);
  return auth;
}

/**
 * Logout — remove stored auth.
 */
export function authLogout(repoRoot: string): boolean {
  return removeAuth(repoRoot);
}

/**
 * Get auth status information.
 */
export function authStatus(
  repoRoot: string,
): { authenticated: boolean; email?: string; expiresAt?: string; expired?: boolean } {
  const auth = readAuth(repoRoot);
  if (!auth) {
    return { authenticated: false };
  }

  const expired = isTokenExpired(auth.token);
  return {
    authenticated: true,
    email: auth.email,
    expiresAt: auth.expiresAt,
    expired,
  };
}

// ─── API key operations ─────────────────────────────────────────────────────

/**
 * Read all stored API keys from .env.local.
 */
export function readKeys(repoRoot: string): KeyEntry[] {
  const envPath = join(repoRoot, ENV_LOCAL_FILE);
  if (!existsSync(envPath)) return [];

  try {
    const content = readFileSync(envPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) return null;
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        return { provider: key, key: value, setAt: "" };
      })
      .filter((entry): entry is KeyEntry => entry !== null);
  } catch {
    return [];
  }
}

/**
 * Set an API key in .env.local.
 */
export function setKey(repoRoot: string, provider: string, key: string): void {
  const envPath = join(repoRoot, ENV_LOCAL_FILE);
  let content = "";

  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf-8");
  }

  const lines = content.split("\n");
  const varName = provider.toUpperCase();
  let found = false;

  // Update existing key or add new one
  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${varName}=`)) {
      found = true;
      return `${varName}=${key}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${varName}=${key}`);
  }

  writeFileSync(envPath, updatedLines.join("\n"), "utf-8");
}

/**
 * Remove an API key from .env.local.
 */
export function removeKey(repoRoot: string, provider: string): boolean {
  const envPath = join(repoRoot, ENV_LOCAL_FILE);
  if (!existsSync(envPath)) return false;

  const content = readFileSync(envPath, "utf-8");
  const varName = provider.toUpperCase();
  const lines = content.split("\n").filter((line) => !line.startsWith(`${varName}=`));

  if (lines.length === content.split("\n").length) return false;

  writeFileSync(envPath, lines.join("\n"), "utf-8");
  return true;
}

// ─── Command ────────────────────────────────────────────────────────────────

export function createAuthCommand(): Command {
  return new Command("auth")
    .description("Manage authentication and API keys")
    .addCommand(
      new Command("login")
        .description("Authenticate with cocapn.ai")
        .argument("[token]", "JWT token (or set via --token)")
        .option("-e, --email <email>", "Email address")
        .option("-t, --token <token>", "JWT token")
        .action(function (positionalToken?: string) {
          const repoRoot = process.cwd();
          const opts = this.opts();
          const token = positionalToken ?? opts.token;

          if (!token) {
            console.log(red("\n  Error: No token provided. Usage: cocapn auth login <token>\n"));
            process.exit(1);
          }

          try {
            const auth = authLogin(repoRoot, token);
            console.log(bold("\n  cocapn auth login\n"));
            console.log(`  ${green("Logged in:")} ${auth.email}`);
            console.log(`  ${cyan("Expires:")}   ${auth.expiresAt}`);
            console.log(green("\n  Done.\n"));
          } catch (err) {
            console.log(red(`\n  ${(err as Error).message}\n`));
            process.exit(1);
          }
        }),
    )
    .addCommand(
      new Command("logout")
        .description("Clear authentication")
        .action(() => {
          const repoRoot = process.cwd();

          const removed = authLogout(repoRoot);
          if (removed) {
            console.log(bold("\n  cocapn auth logout\n"));
            console.log(green("  Logged out.\n"));
          } else {
            console.log(yellow("\n  Not logged in.\n"));
          }
        }),
    )
    .addCommand(
      new Command("status")
        .description("Show authentication status")
        .action(() => {
          const repoRoot = process.cwd();
          const status = authStatus(repoRoot);

          console.log(bold("\n  cocapn auth status\n"));

          if (!status.authenticated) {
            console.log(yellow("  Not logged in.\n"));
            return;
          }

          if (status.expired) {
            console.log(`  ${red("Token expired:")} ${status.email}`);
            console.log(`  ${gray("Expired at:")}  ${status.expiresAt}`);
            console.log(yellow("\n  Run cocapn auth login to re-authenticate.\n"));
          } else {
            console.log(`  ${green("Logged in:")}  ${status.email}`);
            console.log(`  ${cyan("Expires:")}    ${status.expiresAt}`);
            console.log();
          }
        }),
    )
    .addCommand(
      new Command("keys")
        .description("Manage API keys")
        .addCommand(
          new Command("list")
            .description("Show configured API keys (masked)")
            .action(() => {
              const repoRoot = process.cwd();
              const keys = readKeys(repoRoot);

              console.log(bold("\n  cocapn auth keys list\n"));

              if (keys.length === 0) {
                console.log(gray("  No API keys configured.\n"));
                return;
              }

              for (const entry of keys) {
                console.log(`  ${cyan(entry.provider.padEnd(25))} ${gray(maskKey(entry.key))}`);
              }
              console.log();
            }),
        )
        .addCommand(
          new Command("set")
            .description("Set an API key")
            .argument("<provider>", "Provider name (e.g. DEEPSEEK_API_KEY)")
            .argument("<key>", "API key value")
            .action((provider: string, key: string) => {
              const repoRoot = process.cwd();

              setKey(repoRoot, provider, key);
              console.log(bold("\n  cocapn auth keys set\n"));
              console.log(`  ${green("Set:")}       ${provider.toUpperCase()}`);
              console.log(`  ${gray("Value:")}     ${maskKey(key)}`);
              console.log(green("\n  Done.\n"));
            }),
        )
        .addCommand(
          new Command("remove")
            .description("Remove an API key")
            .argument("<provider>", "Provider name to remove")
            .action((provider: string) => {
              const repoRoot = process.cwd();
              const removed = removeKey(repoRoot, provider);

              if (removed) {
                console.log(bold("\n  cocapn auth keys remove\n"));
                console.log(`  ${green("Removed:")} ${provider.toUpperCase()}`);
                console.log(green("\n  Done.\n"));
              } else {
                console.log(yellow(`\n  Key not found: ${provider.toUpperCase()}\n`));
              }
            }),
        ),
    );
}
