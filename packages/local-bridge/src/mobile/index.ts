/**
 * Mobile connection layer — barrel export.
 */

export { MobileConnectionManager, type PairingCode } from "./connection.js";
export { MobileAPI } from "./api.js";
export { generateQRSVG, generateFallbackSVG, buildPairingURL } from "./qr.js";
export {
  MobileConnectionState,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  reconnectionDelay,
} from "./protocol.js";
export type {
  MobileClientMessage,
  MobileServerMessage,
  MobileAuthenticateMessage,
  MobileChatMessage,
  MobileStatusMessage,
  MobileConfigMessage,
  MobileHeartbeatMessage,
  MobileDisconnectMessage,
  MobileAuthenticatedMessage,
  MobileAuthFailedMessage,
  MobileServerChatMessage,
  MobileEventMessage,
  MobileNotificationMessage,
  MobileBrainUpdateMessage,
  MobileStatusResponseMessage,
  MobileConfigResponseMessage,
  MobileHeartbeatAckMessage,
  MobileErrorMessage,
  MobileDevice,
} from "./protocol.js";
