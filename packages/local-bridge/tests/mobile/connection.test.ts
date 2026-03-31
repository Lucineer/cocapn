/**
 * Tests for MobileConnectionManager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MobileConnectionManager } from "../../src/mobile/connection.js";
import { MobileConnectionState } from "../../src/mobile/protocol.js";

// ─── Mock WebSocket ─────────────────────────────────────────────────────────

function createMockWebSocket(): any {
  const listeners: Record<string, Function[]> = {};
  return {
    readyState: 1, // OPEN
    OPEN: 1,
    CLOSED: 3,
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    send: vi.fn((data: string) => {}),
    close: vi.fn((_code?: number, _reason?: string) => {
      // Simulate close event
      const handlers = listeners["close"] || [];
      handlers.forEach((h) => h());
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const handlers = listeners[event] || [];
      handlers.forEach((h) => h(...args));
    }),
    _listeners: listeners,
  };
}

describe("MobileConnectionManager", () => {
  let manager: MobileConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new MobileConnectionManager({
      agentName: "test-agent",
      bridgeVersion: "0.0.1",
    });
    manager.start();
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Pairing codes
  // ---------------------------------------------------------------------------

  describe("generatePairingCode", () => {
    it("generates a 6-digit code", () => {
      const pc = manager.generatePairingCode();
      expect(pc.code).toMatch(/^\d{6}$/);
    });

    it("sets expiration 5 minutes from now", () => {
      const pc = manager.generatePairingCode();
      expect(pc.expiresAt - pc.createdAt).toBe(5 * 60 * 1000);
    });

    it("marks previous codes as used", () => {
      const pc1 = manager.generatePairingCode();
      const pc2 = manager.generatePairingCode();
      expect(pc1.used).toBe(true);
      expect(pc2.used).toBe(false);
    });
  });

  describe("validatePairingCode", () => {
    it("validates a fresh code", () => {
      const pc = manager.generatePairingCode();
      const result = manager.validatePairingCode(pc.code);
      expect(result.valid).toBe(true);
    });

    it("rejects an unknown code", () => {
      const result = manager.validatePairingCode("000000");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Unknown");
    });

    it("rejects a used code", () => {
      const pc = manager.generatePairingCode();
      manager.validatePairingCode(pc.code);
      const result = manager.validatePairingCode(pc.code);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("already used");
    });

    it("rejects an expired code", () => {
      const pc = manager.generatePairingCode();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      const result = manager.validatePairingCode(pc.code);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired");
    });
  });

  describe("getActivePairingCode", () => {
    it("returns null when no code generated", () => {
      expect(manager.getActivePairingCode()).toBeNull();
    });

    it("returns the active code", () => {
      const pc = manager.generatePairingCode();
      const active = manager.getActivePairingCode();
      expect(active?.code).toBe(pc.code);
    });

    it("returns null after code is used", () => {
      const pc = manager.generatePairingCode();
      manager.validatePairingCode(pc.code);
      expect(manager.getActivePairingCode()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Device management
  // ---------------------------------------------------------------------------

  describe("registerDevice", () => {
    it("registers a device and returns MobileDevice", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
        appVersion: "1.0",
      });

      expect(device.deviceName).toBe("iPhone");
      expect(device.deviceType).toBe("ios");
      expect(device.state).toBe(MobileConnectionState.Authenticated);
      expect(device.deviceId).toMatch(/^device-/);
    });

    it("tracks connected devices", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.registerDevice(ws1, { deviceName: "iPhone", deviceType: "ios" });
      manager.registerDevice(ws2, { deviceName: "Pixel", deviceType: "android" });

      const devices = manager.getConnectedDevices();
      expect(devices).toHaveLength(2);
    });

    it("emits deviceConnected event", () => {
      const handler = vi.fn();
      manager.on("deviceConnected", handler);

      const ws = createMockWebSocket();
      manager.registerDevice(ws, { deviceName: "iPhone", deviceType: "ios" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].deviceName).toBe("iPhone");
    });

    it("removes device on WebSocket close", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });

      // Simulate WebSocket close
      ws.close();

      expect(manager.getConnectedDevices()).toHaveLength(0);
    });
  });

  describe("disconnectDevice", () => {
    it("disconnects a known device", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });

      const result = manager.disconnectDevice(device.deviceId);
      expect(result).toBe(true);
      expect(manager.getConnectedDevices()).toHaveLength(0);
    });

    it("returns false for unknown device", () => {
      const result = manager.disconnectDevice("device-nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getDevice", () => {
    it("returns the device by ID", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });

      const found = manager.getDevice(device.deviceId);
      expect(found).toBeDefined();
      expect(found?.deviceName).toBe("iPhone");
    });

    it("returns undefined for unknown ID", () => {
      expect(manager.getDevice("nonexistent")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  describe("handleMessage", () => {
    it("handles heartbeat and updates lastHeartbeat", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });
      const before = device.lastHeartbeat;

      vi.advanceTimersByTime(1000);

      manager.handleMessage(device.deviceId, {
        type: "heartbeat",
        id: "1",
        timestamp: Date.now(),
      });

      expect(device.lastHeartbeat).toBeGreaterThan(before);
      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sent.type).toBe("heartbeat_ack");
    });

    it("handles status request", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "Pixel",
        deviceType: "android",
      });

      manager.handleMessage(device.deviceId, {
        type: "status",
        id: "2",
      });

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sent.type).toBe("status_response");
      expect(sent.status.connectedDevices).toBe(1);
    });

    it("emits message for chat", () => {
      const handler = vi.fn();
      manager.on("message", handler);

      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });

      manager.handleMessage(device.deviceId, {
        type: "chat",
        id: "3",
        content: "Hello!",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe(device.deviceId);
      expect(handler.mock.calls[0][1].content).toBe("Hello!");
    });
  });

  describe("sendToDevice", () => {
    it("sends a message to a connected device", () => {
      const ws = createMockWebSocket();
      const device = manager.registerDevice(ws, {
        deviceName: "iPhone",
        deviceType: "ios",
      });

      const result = manager.sendToDevice(device.deviceId, {
        type: "notification",
        id: "n1",
        title: "Test",
        body: "Hello",
        timestamp: Date.now(),
      });

      expect(result).toBe(true);
      expect(ws.send).toHaveBeenCalledTimes(1);
    });

    it("returns false for unknown device", () => {
      const result = manager.sendToDevice("nonexistent", {
        type: "error",
        id: "e1",
        code: "NOT_FOUND",
        message: "Device not found",
      });
      expect(result).toBe(false);
    });
  });

  describe("broadcastToDevices", () => {
    it("broadcasts to all connected devices", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.registerDevice(ws1, { deviceName: "iPhone", deviceType: "ios" });
      manager.registerDevice(ws2, { deviceName: "Pixel", deviceType: "android" });

      const sent = manager.broadcastToDevices({
        type: "event",
        id: "evt1",
        eventType: "brain_update",
        data: {},
        timestamp: Date.now(),
      });

      expect(sent).toBe(2);
      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  describe("getAgentName", () => {
    it("returns configured agent name", () => {
      expect(manager.getAgentName()).toBe("test-agent");
    });
  });

  describe("getBridgeVersion", () => {
    it("returns configured version", () => {
      expect(manager.getBridgeVersion()).toBe("0.0.1");
    });
  });
});
