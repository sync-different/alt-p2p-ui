import { useState, useCallback, useRef } from "react";
import type { Child } from "@tauri-apps/plugin-shell";
import type {
  IpcEvent,
  ConnectionState,
  TransferState,
  TransferProgressInfo,
  FileInfo,
  TransferResult,
  SessionConfig,
} from "../types/ipc";
import { spawnSend, spawnReceive } from "../lib/jar";

interface TransferHookState {
  transferState: TransferState;
  connectionState: ConnectionState | null;
  progress: TransferProgressInfo | null;
  fileInfo: FileInfo | null;
  result: TransferResult | null;
  error: string | null;
  logs: string[];
}

const initialState: TransferHookState = {
  transferState: "idle",
  connectionState: null,
  progress: null,
  fileInfo: null,
  result: null,
  error: null,
  logs: [],
};

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function useTransfer() {
  const [state, setState] = useState<TransferHookState>(initialState);
  const processRef = useRef<Child | null>(null);
  const cancelledRef = useRef(false);

  const handleEvent = useCallback((line: string) => {
    if (cancelledRef.current) return;
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) return;

    try {
      const event: IpcEvent = JSON.parse(trimmed);

      setState((prev) => {
        // Log all stdout events except progress (too noisy)
        const logLine =
          event.event !== "progress" ? `${ts()} [stdout] ${trimmed}` : null;
        const newLogs = logLine ? [...prev.logs, logLine] : prev.logs;

        switch (event.event) {
          case "status":
            return {
              ...prev,
              logs: newLogs,
              connectionState: event.state,
              transferState:
                event.state === "connected" ? "transferring" : "connecting",
            };

          case "file_info":
            return {
              ...prev,
              logs: newLogs,
              fileInfo: {
                name: event.name,
                size: event.size,
                sha256: event.sha256,
              },
            };

          case "progress":
            return {
              ...prev,
              transferState: "transferring",
              progress: {
                bytes: event.bytes,
                total: event.total,
                speedBps: event.speed_bps,
                etaSeconds: event.eta_seconds,
                percent: event.percent,
              },
            };

          case "complete":
            return {
              ...prev,
              logs: newLogs,
              transferState: "complete",
              result: {
                bytes: event.bytes,
                packets: event.packets,
                retransmissions: event.retransmissions,
                durationMs: event.duration_ms,
                path: event.path,
              },
            };

          case "error":
            return {
              ...prev,
              logs: newLogs,
              transferState: "error",
              error: event.message,
            };

          case "log":
            return {
              ...prev,
              logs: [...prev.logs, `${ts()} [${event.level}] ${event.message}`],
            };

          default:
            return { ...prev, logs: newLogs };
        }
      });
    } catch {
      // Non-JSON output — ignore or treat as log
    }
  }, []);

  const startSend = useCallback(
    async (config: SessionConfig, filePath: string) => {
      cancelledRef.current = false;
      setState({ ...initialState, transferState: "connecting" });

      try {
        const command = await spawnSend(config, filePath);

        command.on("close", (data) => {
          if (cancelledRef.current) return;
          if (data.code !== 0) {
            setState((prev) =>
              prev.transferState === "complete"
                ? prev
                : {
                    ...prev,
                    transferState: "error",
                    error:
                      prev.error || `Process exited with code ${data.code}`,
                  },
            );
          }
        });

        command.on("error", (error) => {
          if (cancelledRef.current) return;
          setState((prev) => ({
            ...prev,
            transferState: "error",
            error: error,
          }));
        });

        command.stdout.on("data", handleEvent);
        command.stderr.on("data", (line) => {
          if (cancelledRef.current) return;
          setState((prev) => ({
            ...prev,
            logs: [...prev.logs, `${ts()} [stderr] ${line}`],
          }));
        });

        const child = await command.spawn();
        processRef.current = child;
      } catch (e) {
        setState((prev) => ({
          ...prev,
          transferState: "error",
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [handleEvent],
  );

  const startReceive = useCallback(
    async (config: SessionConfig, outputDir: string) => {
      cancelledRef.current = false;
      setState({
        ...initialState,
        transferState: "connecting",
      });

      try {
        const command = await spawnReceive(config, outputDir);

        command.on("close", (data) => {
          if (cancelledRef.current) return;
          if (data.code !== 0) {
            setState((prev) =>
              prev.transferState === "complete"
                ? prev
                : {
                    ...prev,
                    transferState: "error",
                    error:
                      prev.error || `Process exited with code ${data.code}`,
                  },
            );
          }
        });

        command.on("error", (error) => {
          if (cancelledRef.current) return;
          setState((prev) => ({
            ...prev,
            transferState: "error",
            error: error,
          }));
        });

        command.stdout.on("data", handleEvent);
        command.stderr.on("data", (line) => {
          if (cancelledRef.current) return;
          setState((prev) => ({
            ...prev,
            logs: [...prev.logs, `${ts()} [stderr] ${line}`],
          }));
        });

        const child = await command.spawn();
        processRef.current = child;
      } catch (e) {
        setState((prev) => ({
          ...prev,
          transferState: "error",
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [handleEvent],
  );

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    if (processRef.current) {
      await processRef.current.kill();
      processRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      transferState: "cancelled",
      logs: [...prev.logs, `${ts()} [info] Transfer cancelled by user`],
    }));
  }, []);

  const clearLogs = useCallback(() => {
    setState((prev) => ({ ...prev, logs: [] }));
  }, []);

  const reset = useCallback(() => {
    processRef.current = null;
    setState(initialState);
  }, []);

  return {
    ...state,
    startSend,
    startReceive,
    cancel,
    clearLogs,
    reset,
  };
}
