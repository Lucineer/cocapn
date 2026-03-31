/**
 * MobileAPI — HTTP endpoints for mobile pairing and device management.
 *
 * Routes:
 *   GET  /api/mobile/pairing-code  → generate new pairing code
 *   GET  /api/mobile/qr            → QR code SVG
 *   POST /api/mobile/pair          → validate pairing
 *   GET  /api/mobile/devices       → list connected devices
 *   DELETE /api/mobile/devices/:id → disconnect device
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { MobileConnectionManager } from "./connection.js";
import { generateQRSVG, buildPairingURL } from "./qr.js";

export class MobileAPI {
  private manager: MobileConnectionManager;
  private host: string;
  private port: number;

  constructor(opts: {
    manager: MobileConnectionManager;
    host: string;
    port: number;
  }) {
    this.manager = opts.manager;
    this.host = opts.host;
    this.port = opts.port;
  }

  /**
   * Route an incoming HTTP request. Returns true if handled.
   */
  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = req.url || "";
    const method = req.method || "GET";

    // GET /api/mobile/pairing-code
    if (url === "/api/mobile/pairing-code" && method === "GET") {
      return this.handlePairingCode(req, res);
    }

    // GET /api/mobile/qr
    if (url === "/api/mobile/qr" && method === "GET") {
      return this.handleQR(req, res);
    }

    // POST /api/mobile/pair
    if (url === "/api/mobile/pair" && method === "POST") {
      return this.handlePair(req, res);
    }

    // GET /api/mobile/devices
    if (url === "/api/mobile/devices" && method === "GET") {
      return this.handleListDevices(req, res);
    }

    // DELETE /api/mobile/devices/:id
    if (url.startsWith("/api/mobile/devices/") && method === "DELETE") {
      return this.handleDisconnectDevice(req, res, url);
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // GET /api/mobile/pairing-code
  // ---------------------------------------------------------------------------

  private async handlePairingCode(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const pairingCode = this.manager.generatePairingCode();
    this.json(res, 200, {
      code: pairingCode.code,
      expiresAt: pairingCode.expiresAt,
      ttlSeconds: Math.round((pairingCode.expiresAt - pairingCode.createdAt) / 1000),
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // GET /api/mobile/qr
  // ---------------------------------------------------------------------------

  private async handleQR(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    // Get or generate an active pairing code
    let pairingCode = this.manager.getActivePairingCode();
    if (!pairingCode) {
      pairingCode = this.manager.generatePairingCode();
    }

    const pairingURL = buildPairingURL({
      code: pairingCode.code,
      host: this.host,
      port: this.port,
      agentName: this.manager.getAgentName(),
    });

    const svg = generateQRSVG(pairingURL);

    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache",
    });
    res.end(svg);
    return true;
  }

  // ---------------------------------------------------------------------------
  // POST /api/mobile/pair
  // ---------------------------------------------------------------------------

  private async handlePair(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const body = await readBody(req);
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(body) as Record<string, unknown>;
    } catch {
      this.json(res, 400, { error: "Invalid JSON body" });
      return true;
    }

    const code = data["code"];
    if (typeof code !== "string") {
      this.json(res, 400, { error: "Missing required field: code" });
      return true;
    }

    const result = this.manager.validatePairingCode(code);

    if (!result.valid) {
      this.json(res, 401, { error: result.reason });
      return true;
    }

    this.json(res, 200, {
      paired: true,
      agentName: this.manager.getAgentName(),
      bridgeVersion: this.manager.getBridgeVersion(),
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // GET /api/mobile/devices
  // ---------------------------------------------------------------------------

  private async handleListDevices(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const devices = this.manager.getConnectedDevices();
    this.json(res, 200, {
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        connectedAt: d.connectedAt,
        lastHeartbeat: d.lastHeartbeat,
        state: d.state,
      })),
      count: devices.length,
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/mobile/devices/:id
  // ---------------------------------------------------------------------------

  private async handleDisconnectDevice(
    _req: IncomingMessage,
    res: ServerResponse,
    url: string,
  ): Promise<boolean> {
    const id = url.replace("/api/mobile/devices/", "");
    const success = this.manager.disconnectDevice(id);

    if (!success) {
      this.json(res, 404, { error: `Device not found: ${id}` });
      return true;
    }

    this.json(res, 200, { ok: true, deviceId: id });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private json(res: ServerResponse, code: number, body: unknown): void {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  }
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
