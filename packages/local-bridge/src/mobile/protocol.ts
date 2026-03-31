/**
 * Mobile protocol — message types for mobile ↔ bridge communication.
 *
 * JSON over WebSocket. Client initiates with an authenticate message,
 * then exchanges chat/status/config messages. Server pushes events,
 * notifications, and brain updates.
 *
 * Heartbeat: every 30s. Reconnection: exponential backoff (1s, 2s, 4s, … 30s).
 */

// ─── Client → Server messages ───────────────────────────────────────────────

export type MobileClientMessageType =
  | "authenticate"
  | "chat"
  | "status"
  | "config"
  | "heartbeat"
  | "disconnect";

export interface MobileAuthenticateMessage {
  type: "authenticate";
  id: string;
  pairingCode: string;
  deviceName: string;
  deviceType: "ios" | "android" | "web";
  appVersion?: string;
}

export interface MobileChatMessage {
  type: "chat";
  id: string;
  content: string;
  conversationId?: string;
}

export interface MobileStatusMessage {
  type: "status";
  id: string;
  /** Request current bridge status */
}

export interface MobileConfigMessage {
  type: "config";
  id: string;
  action: "get" | "set";
  key?: string;
  value?: string;
}

export interface MobileHeartbeatMessage {
  type: "heartbeat";
  id: string;
  timestamp: number;
}

export interface MobileDisconnectMessage {
  type: "disconnect";
  id: string;
  reason?: string;
}

export type MobileClientMessage =
  | MobileAuthenticateMessage
  | MobileChatMessage
  | MobileStatusMessage
  | MobileConfigMessage
  | MobileHeartbeatMessage
  | MobileDisconnectMessage;

// ─── Server → Client messages ───────────────────────────────────────────────

export type MobileServerMessageType =
  | "authenticated"
  | "auth_failed"
  | "message"
  | "event"
  | "notification"
  | "brain_update"
  | "status_response"
  | "config_response"
  | "heartbeat_ack"
  | "error";

export interface MobileAuthenticatedMessage {
  type: "authenticated";
  id: string;
  deviceId: string;
  agentName: string;
  bridgeVersion: string;
}

export interface MobileAuthFailedMessage {
  type: "auth_failed";
  id: string;
  reason: string;
}

export interface MobileServerChatMessage {
  type: "message";
  id: string;
  content: string;
  sender: "agent" | "user";
  conversationId?: string;
  timestamp: number;
}

export interface MobileEventMessage {
  type: "event";
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface MobileNotificationMessage {
  type: "notification";
  id: string;
  title: string;
  body: string;
  category?: string;
  timestamp: number;
}

export interface MobileBrainUpdateMessage {
  type: "brain_update";
  id: string;
  store: "facts" | "memories" | "wiki" | "procedures" | "relationships";
  action: "set" | "delete" | "add";
  key?: string;
  timestamp: number;
}

export interface MobileStatusResponseMessage {
  type: "status_response";
  id: string;
  status: {
    mode: string;
    uptime: number;
    connectedDevices: number;
    agentCount: number;
  };
}

export interface MobileConfigResponseMessage {
  type: "config_response";
  id: string;
  key?: string;
  value?: string;
  config?: Record<string, unknown>;
}

export interface MobileHeartbeatAckMessage {
  type: "heartbeat_ack";
  id: string;
  timestamp: number;
}

export interface MobileErrorMessage {
  type: "error";
  id: string;
  code: string;
  message: string;
}

export type MobileServerMessage =
  | MobileAuthenticatedMessage
  | MobileAuthFailedMessage
  | MobileServerChatMessage
  | MobileEventMessage
  | MobileNotificationMessage
  | MobileBrainUpdateMessage
  | MobileStatusResponseMessage
  | MobileConfigResponseMessage
  | MobileHeartbeatAckMessage
  | MobileErrorMessage;

// ─── Connection state ───────────────────────────────────────────────────────

export enum MobileConnectionState {
  /** Waiting for authenticate message */
  Pending = "pending",
  /** Successfully authenticated */
  Authenticated = "authenticated",
  /** Connection closed */
  Disconnected = "disconnected",
}

// ─── Device info ────────────────────────────────────────────────────────────

export interface MobileDevice {
  deviceId: string;
  deviceName: string;
  deviceType: "ios" | "android" | "web";
  appVersion?: string;
  connectedAt: number;
  lastHeartbeat: number;
  state: MobileConnectionState;
}

// ─── Reconnection config ────────────────────────────────────────────────────

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_TIMEOUT_MS = 10_000;
export const MAX_RECONNECTION_BACKOFF_MS = 30_000;
export const INITIAL_RECONNECTION_BACKOFF_MS = 1_000;

/**
 * Calculate reconnection delay with exponential backoff.
 * Returns delay in milliseconds.
 */
export function reconnectionDelay(attempt: number): number {
  const delay = INITIAL_RECONNECTION_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_RECONNECTION_BACKOFF_MS);
}
