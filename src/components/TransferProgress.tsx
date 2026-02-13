import type { TransferProgressInfo, FileInfo } from "../types/ipc";

interface Props {
  progress: TransferProgressInfo | null;
  fileInfo: FileInfo | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 0) return "calculating...";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return `${m}:${s.toString().padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}:${rm.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TransferProgress({ progress, fileInfo }: Props) {
  if (!fileInfo && !progress) return null;

  return (
    <div className="space-y-3 rounded-lg bg-slate-800/50 p-4 border border-slate-700/50">
      {fileInfo && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-300 font-medium truncate mr-4">
            {fileInfo.name}
          </span>
          <span className="text-slate-400 shrink-0">
            {formatBytes(fileInfo.size)}
          </span>
        </div>
      )}

      {progress && (
        <>
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-400">
            <span>
              {formatBytes(progress.bytes)} / {formatBytes(progress.total)}
            </span>
            <span>{progress.percent.toFixed(1)}%</span>
          </div>

          <div className="flex justify-between text-xs text-slate-500">
            <span>{formatSpeed(progress.speedBps)}</span>
            <span>ETA {formatEta(progress.etaSeconds)}</span>
          </div>
        </>
      )}
    </div>
  );
}
