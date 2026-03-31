/**
 * MobileConnectionManager — manages mobile device pairing and connections.
 *
 * Responsibilities:
 *   - Generate time-limited 6-digit pairing codes
 *   - Validate pairing attempts from mobile clients
 *   - Track connected devices
 *   - Handle WebSocket message routing for mobile clients
 *   - Heartbeat monitoring
 */

import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import {
  MobileConnectionState,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from "./protocol.js";
import type {
  MobileDevice,
  MobileClientMessage,
  MobileServerMessage,
} from "./protocol.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PairingCode {
  code: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface MobileConnectionManagerEvents {
  deviceConnected: [device: MobileDevice];
  deviceDisconnected: [deviceId: string, reason?: string];
  message: [deviceId: string, message: MobileClientMessage];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAIRING_CODE_LENGTH = 6;
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_DEVICES = 10;

// ─── MobileConnectionManager ────────────────────────────────────────────────

export class MobileConnectionManager extends EventEmitter {
  private pairingCodes = new Map<string, PairingCode>();
  private devices = new Map<string, MobileDevice>();
  private connections = new Map<string, WebSocket>();
  private heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private heartbeatTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;
  private agentName: string;
  private bridgeVersion: string;

  constructor(opts: { agentName?: string; bridgeVersion?: string } = {}) {
    super();
    this.agentName = opts.agentName ?? "cocapn";
    this.bridgeVersion = opts.bridgeVersion ?? "0.1.0";
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      CLEANUP_INTERVAL_MS,
    );
    console.info("[mobile] Connection manager started");
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    // Close all device connections
    for (const [deviceId, ws] of this.connections) {
      try {
        ws.close(1001, "Bridge shutting down");
      } catch { /* already gone */ }
      this.removeDevice(deviceId);
    }
    console.info("[mobile] Connection manager stopped");
  }

  // ---------------------------------------------------------------------------
  // Pairing codes
  // ---------------------------------------------------------------------------

  /**
   * Generate a new 6-digit pairing code. Only one active code at a time
   * — calling this invalidates any previous code.
   */
  generatePairingCode(): PairingCode {
    // Invalidate any existing codes
    for (const [, pc] of this.pairingCodes) {
      pc.used = true;
    }

    const code = this.randomDigits(PAIRING_CODE_LENGTH);
    const now = Date.now();
    const pairingCode: PairingCode = {
      code,
      createdAt: now,
      expiresAt: now + PAIRING_CODE_TTL_MS,
      used: false,
    };

    this.pairingCodes.set(code, pairingCode);
    return pairingCode;
  }

  /**
   * Validate a pairing code. Returns true if valid and not expired.
   * Marks the code as used on success.
   */
  validatePairingCode(code: string): { valid: boolean; reason?: string } {
    const pc = this.pairingCodes.get(code);

    if (!pc) {
      return { valid: false, reason: "Unknown pairing code" };
    }

    if (pc.used) {
      return { valid: false, reason: "Pairing code already used" };
    }

    if (Date.now() > pc.expiresAt) {
      pc.used = true;
      return { valid: false, reason: "Pairing code expired" };
    }

    pc.used = true;
    return { valid: true };
  }

  /**
   * Get the current active (unused, unexpired) pairing code, or null.
   */
  getActivePairingCode(): PairingCode | null {
    for (const [, pc] of this.pairingCodes) {
      if (!pc.used && Date.now() <= pc.expiresAt) {
        return pc;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Device management
  // ---------------------------------------------------------------------------

  /**
   * Register an authenticated mobile device.
   */
  registerDevice(
    ws: WebSocket,
    info: { deviceName: string; deviceType: "ios" | "android" | "web"; appVersion?: string },
  ): MobileDevice {
    if (this.devices.size >= MAX_DEVICES) {
      throw new Error(`Maximum ${MAX_DEVICES} devices connected`);
    }

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    const device: MobileDevice = {
      deviceId,
      deviceName: info.deviceName,
      deviceType: info.deviceType,
      ...(info.appVersion !== undefined ? { appVersion: info.appVersion } : {}),
      connectedAt: now,
      lastHeartbeat: now,
      state: MobileConnectionState.Authenticated,
    };

    this.devices.set(deviceId, device);
    this.connections.set(deviceId, ws);

    // Setup heartbeat monitoring
    this.startHeartbeatMonitor(deviceId, ws);

    // Handle WebSocket close
    ws.on("close", () => {
      this.removeDevice(deviceId, "WebSocket closed");
    });

    ws.on("error", () => {
      this.removeDevice(deviceId, "WebSocket error");
    });

    console.info(`[mobile] Device connected: ${info.deviceName} (${deviceId})`);
    this.emit("deviceConnected", device);

    return device;
  }

  /**
   * Disconnect and remove a device by ID.
   */
  disconnectDevice(deviceId: string): boolean {
    const ws = this.connections.get(deviceId);
    // Remove first to prevent double-removal from close handler
    const removed = this.removeDevice(deviceId, "Disconnected by bridge");
    if (ws) {
      try {
        ws.close(1000, "Disconnected by bridge");
      } catch { /* already gone */ }
    }
    return removed;
  }

  /**
   * Get a list of all connected devices.
   */
  getConnectedDevices(): MobileDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get a specific device by ID.
   */
  getDevice(deviceId: string): MobileDevice | undefined {
    return this.devices.get(deviceId);
  }

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  /**
   * Handle an incoming message from a mobile device.
   */
  handleMessage(deviceId: string, message: MobileClientMessage): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    switch (message.type) {
      case "heartbeat":
        device.lastHeartbeat = Date.now();
        this.resetHeartbeatTimeout(deviceId);
        this.sendToDevice(deviceId, {
          type: "heartbeat_ack",
          id: message.id,
          timestamp: Date.now(),
        });
        break;

      case "status":
        this.sendToDevice(deviceId, {
          type: "status_response",
          id: message.id,
          status: {
            mode: "private",
            uptime: process.uptime(),
            connectedDevices: this.devices.size,
            agentCount: 0,
          },
        });
        break;

      case "disconnect":
        this.disconnectDevice(deviceId);
        break;

      default:
        // Emit for upstream handling (chat, config, etc.)
        this.emit("message", deviceId, message);
        break;
    }
  }

  /**
   * Send a message to a specific device.
   */
  sendToDevice(deviceId: string, message: MobileServerMessage): boolean {
    const ws = this.connections.get(deviceId);
    if (!ws || ws.readyState !== ws.OPEN) return false;

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast a message to all connected devices.
   */
  broadcastToDevices(message: MobileServerMessage): number {
    let sent = 0;
    for (const deviceId of this.devices.keys()) {
      if (this.sendToDevice(deviceId, message)) sent++;
    }
    return sent;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getAgentName(): string {
    return this.agentName;
  }

  getBridgeVersion(): string {
    return this.bridgeVersion;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private startHeartbeatMonitor(deviceId: string, ws: WebSocket): void {
    // Monitor for heartbeat timeouts
    this.resetHeartbeatTimeout(deviceId);
  }

  private resetHeartbeatTimeout(deviceId: string): void {
    // Clear existing timeout
    const existing = this.heartbeatTimeouts.get(deviceId);
    if (existing) clearTimeout(existing);

    // Set new timeout — expect heartbeat within interval + grace period
    const timeout = setTimeout(() => {
      const device = this.devices.get(deviceId);
      if (device) {
        console.warn(`[mobile] Heartbeat timeout for ${deviceId}`);
        this.removeDevice(deviceId, "Heartbeat timeout");
        const ws = this.connections.get(deviceId);
        if (ws) {
          try { ws.close(1001, "Heartbeat timeout"); } catch { /* gone */ }
        }
      }
    }, HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS);

    this.heartbeatTimeouts.set(deviceId, timeout);
  }

  private removeDevice(deviceId: string, reason?: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    this.devices.delete(deviceId);
    this.connections.delete(deviceId);

    // Clear heartbeat timers
    const ht = this.heartbeatTimeouts.get(deviceId);
    if (ht) {
      clearTimeout(ht);
      this.heartbeatTimeouts.delete(deviceId);
    }
    const hi = this.heartbeatTimers.get(deviceId);
    if (hi) {
      clearInterval(hi);
      this.heartbeatTimers.delete(deviceId);
    }

    console.info(`[mobile] Device disconnected: ${device.deviceName} (${deviceId})${reason ? ` — ${reason}` : ""}`);
    this.emit("deviceDisconnected", deviceId, reason);

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, pc] of this.pairingCodes) {
      if (pc.used || now > pc.expiresAt) {
        this.pairingCodes.delete(code);
      }
    }
  }

  private randomDigits(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  }
}
