/**
 * Minimal HMAC-SHA256 JWT implementation — no external dependencies.
 *
 * Only HS256 is supported. Tokens are short-lived (default 1 hour).
 * Used for:
 *   - Fleet WebSocket authentication (alternative to GitHub PAT)
 *   - A2A request signing between bridge instances
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
// ─── JWT implementation ───────────────────────────────────────────────────────
function b64url(buf) {
    return buf.toString("base64url");
}
function b64urlStr(s) {
    return Buffer.from(s, "utf8").toString("base64url");
}
function decodeB64url(s) {
    return Buffer.from(s, "base64url");
}
const HEADER_B64 = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
/**
 * Sign a JWT with HMAC-SHA256.
 * The secret should be at least 32 bytes of high-entropy data.
 */
export function signJwt(payload, secret, opts = {}) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = opts.ttlSeconds ?? 3600;
    const fullPayload = {
        ...payload,
        sub: payload.sub,
        iss: "cocapn",
        iat: now,
        exp: now + ttl,
        ...(opts.domain ? { dom: opts.domain } : {}),
    };
    const body = b64urlStr(JSON.stringify(fullPayload));
    const data = `${HEADER_B64}.${body}`;
    const sig = createHmac("sha256", secret).update(data).digest();
    return `${data}.${b64url(sig)}`;
}
/**
 * Verify a JWT and return its payload.
 * Throws if the signature is invalid or the token is expired.
 */
export function verifyJwt(token, secret) {
    const parts = token.split(".");
    if (parts.length !== 3)
        throw new Error("COCAPN-001: Invalid JWT: expected 3 parts - Ensure your fleet JWT is complete and not truncated. Regenerate with: cocapn-bridge token generate");
    const [headerB64, bodyB64, sigB64] = parts;
    const data = `${headerB64}.${bodyB64}`;
    const expectedSig = createHmac("sha256", secret).update(data).digest();
    const actualSig = decodeB64url(sigB64);
    // Constant-time comparison to prevent timing attacks
    if (actualSig.length !== expectedSig.length ||
        !timingSafeEqual(expectedSig, actualSig)) {
        throw new Error("COCAPN-002: Invalid JWT: bad signature - Your fleet JWT may be corrupted or the secret changed. Regenerate with: cocapn-bridge token generate");
    }
    let payload;
    try {
        payload = JSON.parse(decodeB64url(bodyB64).toString("utf8"));
    }
    catch {
        throw new Error("COCAPN-003: Invalid JWT: malformed payload - JWT payload is corrupted. Regenerate with: cocapn-bridge token generate");
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
        throw new Error(`COCAPN-004: JWT expired at ${new Date(payload.exp * 1000).toISOString()} - Your fleet token has expired. Generate a new one with: cocapn-bridge token generate`);
    }
    if (payload.iss !== "cocapn") {
        throw new Error(`COCAPN-005: Invalid JWT issuer: ${payload.iss} - JWT must be issued by "cocapn". Regenerate with: cocapn-bridge token generate`);
    }
    return payload;
}
/** Generate a cryptographically random secret suitable for JWT signing (32 bytes). */
export function generateJwtSecret() {
    return randomBytes(32).toString("hex");
}
/** Decode JWT payload without verifying — for inspection only. */
export function decodeJwtPayload(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3)
            return undefined;
        return JSON.parse(decodeB64url(parts[1]).toString("utf8"));
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=jwt.js.map