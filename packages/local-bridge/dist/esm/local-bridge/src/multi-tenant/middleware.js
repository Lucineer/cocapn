/**
 * Tenant middleware — resolves tenant from incoming requests.
 *
 * Supports multiple resolution strategies:
 *   1. X-Tenant-ID header (explicit)
 *   2. Authorization: Bearer <api-key> (API key lookup)
 *   3. Origin header (CORS origin match)
 *
 * Works with both HTTP (IncomingMessage/ServerResponse) and
 * WebSocket upgrade requests.
 */
// ─── Errors ──────────────────────────────────────────────────────────────────
export class TenantError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "TenantError";
    }
}
// ─── Middleware function ─────────────────────────────────────────────────────
/**
 * Create a tenant resolution middleware for HTTP requests.
 *
 * Usage with Node.js HTTP server:
 *   ```ts
 *   const resolve = createTenantMiddleware(registry);
 *   server.on('request', async (req, res) => {
 *     try {
 *       const { tenant } = await resolve(req);
 *       req.tenant = tenant;
 *       // proceed with request
 *     } catch (err) {
 *       if (err instanceof TenantError) {
 *         res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
 *         res.end(JSON.stringify({ error: err.message }));
 *       }
 *     }
 *   });
 *   ```
 */
export function createTenantMiddleware(registry) {
    return async (req) => {
        const resolutionRequest = extractResolutionRequest(req);
        const tenant = await registry.resolveTenant(resolutionRequest);
        if (!tenant) {
            // Determine which method was attempted for better error messages
            if (resolutionRequest.tenantId) {
                throw new TenantError(404, `Tenant not found: ${resolutionRequest.tenantId}`);
            }
            if (resolutionRequest.apiKey) {
                throw new TenantError(401, "Invalid API key");
            }
            if (resolutionRequest.origin) {
                throw new TenantError(401, "No tenant found for origin");
            }
            throw new TenantError(401, "Tenant identification required");
        }
        // Determine resolution method
        let resolutionMethod;
        if (resolutionRequest.tenantId) {
            resolutionMethod = "header";
        }
        else if (resolutionRequest.apiKey) {
            resolutionMethod = "api-key";
        }
        else {
            resolutionMethod = "origin";
        }
        return { tenant, tenantId: tenant.id, resolutionMethod };
    };
}
/**
 * Send a tenant error response.
 */
export function sendTenantError(res, err) {
    if (err instanceof TenantError) {
        res.writeHead(err.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
}
// ─── Request extraction ─────────────────────────────────────────────────────
/**
 * Extract tenant resolution parameters from an HTTP request.
 */
export function extractResolutionRequest(req) {
    const headers = req.headers;
    // 1. X-Tenant-ID header
    const tenantId = headers["x-tenant-id"]
        ? Array.isArray(headers["x-tenant-id"])
            ? headers["x-tenant-id"][0]
            : headers["x-tenant-id"]
        : undefined;
    // 2. Authorization header → API key
    let apiKey;
    const authHeader = headers["authorization"];
    if (authHeader) {
        const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        if (auth?.startsWith("Bearer ")) {
            apiKey = auth.slice(7);
        }
    }
    // 3. Origin header
    const origin = headers["origin"]
        ? Array.isArray(headers["origin"])
            ? headers["origin"][0]
            : headers["origin"]
        : undefined;
    const result = {};
    if (tenantId)
        result.tenantId = tenantId;
    if (apiKey)
        result.apiKey = apiKey;
    if (origin)
        result.origin = origin;
    return result;
}
//# sourceMappingURL=middleware.js.map