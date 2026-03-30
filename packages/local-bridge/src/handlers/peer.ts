/**
 * Peer handler — HTTP peer API for A2A discovery and fact queries.
 *
 * Provides HTTP endpoints for cross-domain agent communication:
 *   GET /.well-known/cocapn/peer   → peer card (domain, capabilities, publicKey)
 *   GET /api/peer/fact?key=<k>     → { key, value } from Brain facts
 *   GET /api/peer/facts            → all facts (requires fleet JWT)
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { HandlerContext } from "./types.js";
import { verifyPeerAuth as verifyPeerAuthHandler } from "../security/auth-handler.js";

/**
 * HTTP request handler for A2A peer discovery and fact query endpoints.
 *
 * @param req  The HTTP request
 * @param res  The HTTP response
 * @param ctx  Handler context with access to config, brain, and auth options
 */
export async function handleHttpPeerRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: HandlerContext,
): Promise<void> {
  res.setHeader("Content-Type", "application/json");
  // Restrictive CORS — only allow same-origin by default.
  // Peer discovery (.well-known) allows cross-origin; data endpoints do not.
  const requestOrigin = req.headers.origin;
  if (requestOrigin) {
    // Only echo back the origin if it matches a known cocapn tunnel domain pattern
    const isLocalhost = requestOrigin.startsWith("http://localhost") || requestOrigin.startsWith("http://127.0.0.1");
    const isTunnel = requestOrigin.includes(".trycloudflare.com") || requestOrigin.includes(".cfargotunnel.com") || requestOrigin.includes(".cocapn.io");
    if (isLocalhost || isTunnel) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
  }

  const url = req.url ?? "/";
  const { pathname, searchParams } = new URL(url, "http://localhost");

  // ── Peer discovery card ───────────────────────────────────────────────────
  if (pathname === "/.well-known/cocapn/peer") {
    const card = {
      domain: ctx.config.config.tunnel ?? `localhost:${ctx.config.config.port}`,
      capabilities: ["chat", "memory", "a2a"],
      publicKey: ctx.config.encryption.publicKey || null,
      version: "0.1.0",
    };
    res.writeHead(200).end(JSON.stringify(card));
    return;
  }

  // Remaining endpoints require fleet JWT auth
  if (!verifyPeerAuth(req, ctx)) {
    res.writeHead(401).end(JSON.stringify({ error: "Unauthorized — fleet JWT required" }));
    return;
  }

  // ── Single fact query ─────────────────────────────────────────────────────
  if (pathname === "/api/peer/fact") {
    const key = searchParams.get("key");
    if (!key) {
      res.writeHead(400).end(JSON.stringify({ error: "Missing key parameter" }));
      return;
    }
    const value = ctx.brain?.getFact(key);
    if (value === undefined) {
      res.writeHead(404).end(JSON.stringify({ error: "Fact not found", key }));
      return;
    }
    res.writeHead(200).end(JSON.stringify({ key, value }));
    return;
  }

  // ── All facts ─────────────────────────────────────────────────────────────
  if (pathname === "/api/peer/facts") {
    const facts = ctx.brain?.getAllFacts() ?? {};
    res.writeHead(200).end(JSON.stringify({ facts }));
    return;
  }

  res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
}

/**
 * Verify fleet JWT in Authorization header.
 * Used by the peer HTTP API endpoints.
 * Returns true when auth passes or is disabled (skipAuth).
 *
 * @param req  The HTTP request
 * @param ctx  Handler context with auth options
 */
export function verifyPeerAuth(
  req: IncomingMessage,
  ctx: HandlerContext,
): boolean {
  return verifyPeerAuthHandler(req, isSkipAuth(ctx), ctx.fleetKey);
}

/**
 * Helper to check if auth should be skipped.
 * Checks if skipAuth is explicitly true or if the config mode is "dev".
 */
function isSkipAuth(ctx: HandlerContext): boolean | undefined {
  if (ctx.config.config.mode === "dev") return true;
  return undefined;
}
