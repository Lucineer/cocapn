/**
 * Tests for mobile protocol types and helpers.
 */

import { describe, it, expect } from "vitest";
import {
  MobileConnectionState,
  reconnectionDelay,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MAX_RECONNECTION_BACKOFF_MS,
  INITIAL_RECONNECTION_BACKOFF_MS,
} from "../../src/mobile/protocol.js";
import type {
  MobileAuthenticateMessage,
  MobileChatMessage,
  MobileHeartbeatMessage,
  MobileAuthenticatedMessage,
  MobileErrorMessage,
  MobileDevice,
} from "../../src/mobile/protocol.js";

describe("MobileConnectionState", () => {
  it("has expected states", () => {
    expect(MobileConnectionState.Pending).toBe("pending");
    expect(MobileConnectionState.Authenticated).toBe("authenticated");
    expect(MobileConnectionState.Disconnected).toBe("disconnected");
  });
});

describe("reconnectionDelay", () => {
  it("returns initial delay for first attempt", () => {
    expect(reconnectionDelay(0)).toBe(INITIAL_RECONNECTION_BACKOFF_MS);
  });

  it("doubles on each attempt (exponential backoff)", () => {
    expect(reconnectionDelay(1)).toBe(2000);
    expect(reconnectionDelay(2)).toBe(4000);
    expect(reconnectionDelay(3)).toBe(8000);
    expect(reconnectionDelay(4)).toBe(16000);
  });

  it("caps at max backoff", () => {
    const maxAttempts = 10;
    expect(reconnectionDelay(maxAttempts)).toBe(MAX_RECONNECTION_BACKOFF_MS);
  });
});

describe("Protocol constants", () => {
  it("has sensible heartbeat interval", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });

  it("has heartbeat timeout less than interval", () => {
    expect(HEARTBEAT_TIMEOUT_MS).toBeLessThan(HEARTBEAT_INTERVAL_MS);
  });

  it("max backoff is 30 seconds", () => {
    expect(MAX_RECONNECTION_BACKOFF_MS).toBe(30_000);
  });
});

describe("Message type shapes", () => {
  it("MobileAuthenticateMessage has required fields", () => {
    const msg: MobileAuthenticateMessage = {
      type: "authenticate",
      id: "1",
      pairingCode: "123456",
      deviceName: "iPhone",
      deviceType: "ios",
    };
    expect(msg.type).toBe("authenticate");
    expect(msg.pairingCode).toBe("123456");
    expect(msg.deviceType).toBe("ios");
  });

  it("MobileChatMessage has content", () => {
    const msg: MobileChatMessage = {
      type: "chat",
      id: "2",
      content: "Hello agent!",
    };
    expect(msg.content).toBe("Hello agent!");
  });

  it("MobileHeartbeatMessage has timestamp", () => {
    const msg: MobileHeartbeatMessage = {
      type: "heartbeat",
      id: "3",
      timestamp: Date.now(),
    };
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it("MobileAuthenticatedMessage confirms identity", () => {
    const msg: MobileAuthenticatedMessage = {
      type: "authenticated",
      id: "4",
      deviceId: "device-123",
      agentName: "cocapn",
      bridgeVersion: "0.1.0",
    };
    expect(msg.type).toBe("authenticated");
    expect(msg.deviceId).toBeTruthy();
  });

  it("MobileErrorMessage includes code", () => {
    const msg: MobileErrorMessage = {
      type: "error",
      id: "5",
      code: "PAIRING_FAILED",
      message: "Invalid pairing code",
    };
    expect(msg.code).toBe("PAIRING_FAILED");
  });

  it("MobileDevice has all required fields", () => {
    const device: MobileDevice = {
      deviceId: "device-abc",
      deviceName: "Pixel 8",
      deviceType: "android",
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      state: MobileConnectionState.Authenticated,
    };
    expect(device.deviceType).toBe("android");
    expect(device.state).toBe("authenticated");
  });
});
