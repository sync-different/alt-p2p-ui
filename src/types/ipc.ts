/** Connection lifecycle states reported by the JAR */
export type ConnectionState =
  | "registering"
  | "waiting_peer"
  | "punching"
  | "handshaking"
  | "connected";

/** Transfer lifecycle states */
export type TransferState =
  | "idle"
  | "connecting"
  | "waiting_offer"
  | "transferring"
  | "verifying"
  | "complete"
  | "cancelled"
  | "error";

/** Events emitted as newline-delimited JSON on stdout by the JAR */
export type IpcEvent =
  | { event: "status"; state: ConnectionState }
  | { event: "file_info"; name: string; size: number; sha256: string }
  | {
      event: "progress";
      bytes: number;
      total: number;
      speed_bps: number;
      eta_seconds: number;
      percent: number;
    }
  | {
      event: "complete";
      bytes: number;
      packets: number;
      retransmissions: number;
      duration_ms: number;
      path?: string;
    }
  | { event: "error"; message: string }
  | { event: "log"; level: "info" | "warn" | "debug"; message: string };

/** Configuration for connecting to a session */
export interface SessionConfig {
  sessionId: string;
  psk: string;
  serverAddress: string;
}

/** Progress snapshot derived from IPC progress events */
export interface TransferProgressInfo {
  bytes: number;
  total: number;
  speedBps: number;
  etaSeconds: number;
  percent: number;
}

/** File info from the sender */
export interface FileInfo {
  name: string;
  size: number;
  sha256: string;
}

/** Final transfer result */
export interface TransferResult {
  bytes: number;
  packets: number;
  retransmissions: number;
  durationMs: number;
  path?: string;
}
