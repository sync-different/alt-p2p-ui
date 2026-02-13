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

export function useTransfer() {
  const [state, setState] = useState<TransferHookState>(initialState);
  const processRef = useRef<Child | null>(null);

  const handleEvent = useCallback((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) return;

    try {
      const event: IpcEvent = JSON.parse(trimmed);

      setState((prev) => {
        switch (event.event) {
          case "status":
            return {
              ...prev,
              connectionState: event.state,
              transferState:
                event.state === "connected" ? "transferring" : "connecting",
            };

          case "file_info":
            return {
              ...prev,
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
              transferState: "error",
              error: event.message,
            };

          case "log":
            return {
              ...prev,
              logs: [...prev.logs, `[${event.level}] ${event.message}`],
            };

          default:
            return prev;
        }
      });
    } catch {
      // Non-JSON output — ignore or treat as log
    }
  }, []);

  const startSend = useCallback(
    async (config: SessionConfig, filePath: string) => {
      setState({ ...initialState, transferState: "connecting" });

      try {
        const command = await spawnSend(config, filePath);

        command.on("close", (data) => {
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
          setState((prev) => ({
            ...prev,
            transferState: "error",
            error: error,
          }));
        });

        command.stdout.on("data", handleEvent);
        command.stderr.on("data", (line) => {
          setState((prev) => ({
            ...prev,
            logs: [...prev.logs, `[stderr] ${line}`],
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
      setState({
        ...initialState,
        transferState: "connecting",
      });

      try {
        const command = await spawnReceive(config, outputDir);

        command.on("close", (data) => {
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
          setState((prev) => ({
            ...prev,
            transferState: "error",
            error: error,
          }));
        });

        command.stdout.on("data", handleEvent);
        command.stderr.on("data", (line) => {
          setState((prev) => ({
            ...prev,
            logs: [...prev.logs, `[stderr] ${line}`],
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
    if (processRef.current) {
      await processRef.current.kill();
      processRef.current = null;
      setState((prev) => ({
        ...prev,
        transferState: "idle",
        error: null,
      }));
    }
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
    reset,
  };
}
