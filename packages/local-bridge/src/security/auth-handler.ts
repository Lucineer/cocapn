/**
 * auth-handler — composable WebSocket authentication.
 *
 * Supports two auth methods (tried in order):
 *   1. Fleet JWT  — token starts with "eyJ", verified via HMAC-SHA256
 *   2. GitHub PAT — validated against the GitHub /user endpoint
 *
 * Use createAuthMiddleware() to produce a per-connection authenticate()
 * function that closes the WebSocket with code 4001 on failure and
 * returns an AuthContext on success.
 */

import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { verifyJwt } from "./jwt.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  githubLogin?: string;
  githubToken?: string;
  authMethod: "github" | "fleet" | "none";
}

export interface AuthMiddlewareOptions {
  skipAuth?: boolean;
  fleetKey?: string;
}

// ─── Token extraction ─────────────────────────────────────────────────────────

/**
 * Extract the `token` query parameter from a WebSocket upgrade URL.
 * Handles both full URLs and bare path strings like `/?token=ghp_...`.
 */
export function extractToken(url: string): string | undefined {
  try {
    const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    return new URLSearchParams(qs).get("token") ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── GitHub PAT validation ────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

/**
 * Validate a GitHub Personal Access Token.
 * Returns the authenticated user's login on success, undefined on any failure.
 */
export async function validateGithubPat(token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "cocapn-bridge/0.1.0",
      },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { login?: string };
    return body.login ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Fleet JWT verification ───────────────────────────────────────────────────

/**
 * Verify a fleet JWT token.
 * Throws if the signature is invalid or the token is expired.
 * Returns only the `sub` field (bridge/client identity).
 */
export function verifyFleetJwt(token: string, fleetKey: string): { sub: string } {
  const payload = verifyJwt(token, fleetKey);
  return { sub: payload.sub };
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Create an authenticate function bound to the given options.
 *
 * Usage:
 *   const authenticate = createAuthMiddleware({ fleetKey, skipAuth });
 *   const ctx = await authenticate(ws, req);
 *   if (!ctx) return; // ws already closed with 4001
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  return async function authenticate(
    ws: WebSocket,
    req: IncomingMessage,
  ): Promise<AuthContext | undefined> {
    // Auth disabled — local/testing mode
    if (options.skipAuth) {
      return { authMethod: "none" };
    }

    const rawToken = extractToken(req.url ?? "");

    if (!rawToken) {
      ws.close(4001, "Missing token — provide ?token=<github-pat> or ?token=<fleet-jwt>");
      return undefined;
    }

    // Fleet JWT path — token begins with base64url-encoded header "eyJ"
    if (rawToken.startsWith("eyJ") && options.fleetKey) {
      try {
        const { sub } = verifyFleetJwt(rawToken, options.fleetKey);
        return { githubLogin: sub, authMethod: "fleet" };
      } catch {
        ws.close(4001, "Invalid fleet JWT");
        return undefined;
      }
    }

    // GitHub PAT path
    const githubLogin = await validateGithubPat(rawToken);
    if (!githubLogin) {
      ws.close(4001, "Invalid or expired GitHub PAT");
      return undefined;
    }

    return { githubLogin, githubToken: rawToken, authMethod: "github" };
  };
}
