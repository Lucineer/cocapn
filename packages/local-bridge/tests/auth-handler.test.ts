/**
 * Unit tests for src/security/auth-handler.ts
 *
 * Covers:
 *   1. extractToken — pure URL parsing
 *   2. verifyFleetJwt — wraps jwt.ts, rejects bad signature / expired tokens
 *   3. createAuthMiddleware — skipAuth, missing token (4001 close), valid fleet JWT
 */

import { describe, it, expect, vi } from "vitest";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import {
  extractToken,
  verifyFleetJwt,
  createAuthMiddleware,
} from "../src/security/auth-handler.js";
import { signJwt, generateJwtSecret } from "../src/security/jwt.js";

// ─── extractToken ─────────────────────────────────────────────────────────────

describe("extractToken", () => {
  it("returns token from query string", () => {
    expect(extractToken("/?token=ghp_abc123")).toBe("ghp_abc123");
    expect(extractToken("/ws?token=eyJmoo&other=1")).toBe("eyJmoo");
  });

  it("returns undefined when no token param", () => {
    expect(extractToken("/")).toBeUndefined();
    expect(extractToken("/?other=value")).toBeUndefined();
    expect(extractToken("")).toBeUndefined();
  });
});

// ─── verifyFleetJwt ───────────────────────────────────────────────────────────

describe("verifyFleetJwt", () => {
  const secret = generateJwtSecret();

  it("returns sub from a valid fleet JWT", () => {
    const token = signJwt({ sub: "bridge-test" }, secret);
    const result = verifyFleetJwt(token, secret);
    expect(result.sub).toBe("bridge-test");
  });

  it("throws on wrong key", () => {
    const token = signJwt({ sub: "bridge-test" }, secret);
    const wrongKey = generateJwtSecret();
    expect(() => verifyFleetJwt(token, wrongKey)).toThrow();
  });

  it("throws on expired token", () => {
    // ttlSeconds: -1 produces a token that expired 1s in the past
    const token = signJwt({ sub: "bridge-test" }, secret, { ttlSeconds: -1 });
    expect(() => verifyFleetJwt(token, secret)).toThrow(/expired/i);
  });
});

// ─── createAuthMiddleware ─────────────────────────────────────────────────────

describe("createAuthMiddleware", () => {
  /** Minimal fake WebSocket that records close calls. */
  function makeWs(): { ws: WebSocket; closeSpy: ReturnType<typeof vi.fn> } {
    const closeSpy = vi.fn();
    const ws = { close: closeSpy } as unknown as WebSocket;
    return { ws, closeSpy };
  }

  /** Minimal IncomingMessage with a URL. */
  function makeReq(url: string): IncomingMessage {
    return { url } as IncomingMessage;
  }

  it("skipAuth: true returns authMethod 'none' without closing the socket", async () => {
    const authenticate = createAuthMiddleware({ skipAuth: true });
    const { ws, closeSpy } = makeWs();

    const ctx = await authenticate(ws, makeReq("/"));

    expect(ctx).toEqual({ authMethod: "none" });
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("closes with 4001 when token is missing and auth is required", async () => {
    const authenticate = createAuthMiddleware({ skipAuth: false });
    const { ws, closeSpy } = makeWs();

    const ctx = await authenticate(ws, makeReq("/ws"));

    expect(ctx).toBeUndefined();
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(closeSpy).toHaveBeenCalledWith(4001, expect.stringContaining("Missing token"));
  });

  it("authenticates with a valid fleet JWT and returns authMethod 'fleet'", async () => {
    const fleetKey = generateJwtSecret();
    const token = signJwt({ sub: "peer-bridge" }, fleetKey, { ttlSeconds: 60 });
    const authenticate = createAuthMiddleware({ skipAuth: false, fleetKey });
    const { ws, closeSpy } = makeWs();

    const ctx = await authenticate(ws, makeReq(`/?token=${token}`));

    expect(ctx).toMatchObject({ githubLogin: "peer-bridge", authMethod: "fleet" });
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("closes with 4001 on invalid fleet JWT signature", async () => {
    const fleetKey = generateJwtSecret();
    const badToken = signJwt({ sub: "attacker" }, generateJwtSecret()); // signed with different key
    const authenticate = createAuthMiddleware({ skipAuth: false, fleetKey });
    const { ws, closeSpy } = makeWs();

    const ctx = await authenticate(ws, makeReq(`/?token=${badToken}`));

    expect(ctx).toBeUndefined();
    expect(closeSpy).toHaveBeenCalledWith(4001, expect.stringContaining("Invalid fleet JWT"));
  });
});
