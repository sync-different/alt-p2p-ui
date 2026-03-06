import { useEffect, useRef, useState } from "react";

interface Props {
  logs: string[];
  onClear: () => void;
}

export default function DebugConsole({ logs, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700">
        <span className="text-xs font-medium text-slate-400">Console</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{logs.length} lines</span>
          <button
            onClick={copyToClipboard}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            title="Clear console"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="h-48 overflow-y-auto p-3 font-mono text-xs leading-5 text-slate-400">
        {logs.length === 0 ? (
          <span className="text-slate-600 italic">
            Waiting for output...
          </span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("[stderr]")
                  ? "text-yellow-500/70"
                  : line.includes('"error"')
                    ? "text-red-400/80"
                    : "text-green-400/60"
              }
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
