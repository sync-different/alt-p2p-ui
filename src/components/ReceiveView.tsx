import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { SessionConfig as SessionConfigType } from "../types/ipc";
import { useTransfer } from "../hooks/useTransfer";
import SessionConfig from "./SessionConfig";
import ConnectionStatus from "./ConnectionStatus";
import TransferProgress from "./TransferProgress";

export default function ReceiveView() {
  const [config, setConfig] = useState<SessionConfigType>({
    sessionId: "",
    psk: "",
    serverAddress: "",
  });
  const [outputDir, setOutputDir] = useState<string | null>(null);

  const {
    transferState,
    connectionState,
    progress,
    fileInfo,
    result,
    error,
    startReceive,
    cancel,
    reset,
  } = useTransfer();

  const isActive = transferState !== "idle" && transferState !== "complete" && transferState !== "error";
  const canStart =
    config.sessionId && config.psk && config.serverAddress && outputDir;

  async function pickOutputDir() {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (selected) {
      setOutputDir(selected);
    }
  }

  async function handleReceive() {
    if (!outputDir) return;
    await startReceive(config, outputDir);
  }

  return (
    <div className="space-y-6">
      <SessionConfig
        config={config}
        onChange={setConfig}
        disabled={isActive}
      />

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Save to
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={outputDir ?? ""}
            readOnly
            placeholder="No directory selected"
            className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={pickOutputDir}
            disabled={isActive}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors disabled:opacity-50"
          >
            Browse
          </button>
        </div>
      </div>

      {transferState === "idle" && (
        <button
          onClick={handleReceive}
          disabled={!canStart}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Receive File
        </button>
      )}

      {isActive && (
        <>
          <ConnectionStatus state={connectionState} />
          {transferState === "connecting" && !fileInfo && (
            <p className="text-sm text-slate-400 animate-pulse">
              Waiting for file offer...
            </p>
          )}
          <TransferProgress progress={progress} fileInfo={fileInfo} />
          <button
            onClick={cancel}
            className="w-full rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors"
          >
            Cancel
          </button>
        </>
      )}

      {transferState === "complete" && result && (
        <div className="rounded-lg bg-green-900/20 border border-green-500/30 p-4 space-y-2">
          <p className="text-green-400 font-semibold text-sm">
            Transfer complete!
          </p>
          <div className="text-xs text-green-300/70 space-y-1">
            <p>Received: {(result.bytes / (1024 * 1024)).toFixed(1)} MB</p>
            <p>Packets: {result.packets.toLocaleString()}</p>
            {result.path && <p>Saved to: {result.path}</p>}
          </div>
          <button
            onClick={reset}
            className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
          >
            New Transfer
          </button>
        </div>
      )}

      {transferState === "error" && error && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4 space-y-2">
          <p className="text-red-400 font-semibold text-sm">Error</p>
          <p className="text-xs text-red-300/70">{error}</p>
          <button
            onClick={reset}
            className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
