import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import SendView from "./components/SendView";
import ReceiveView from "./components/ReceiveView";

type Tab = "send" | "receive";

export default function App() {
  const [tab, setTab] = useState<Tab>("send");
  const [version, setVersion] = useState<string>("");
  const [transferActive, setTransferActive] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 px-6 py-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">alt-p2p</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted peer-to-peer file transfer
          </p>
        </div>
        {version && (
          <span className="text-xs text-slate-600">v{version} ({__BUILD_NUMBER__})</span>
        )}
      </header>

      <div className="max-w-lg mx-auto px-6 py-6">
        <div className="flex rounded-lg bg-slate-800/50 p-1 mb-6">
          <button
            onClick={() => setTab("send")}
            disabled={transferActive && tab !== "send"}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "send"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Send
          </button>
          <button
            onClick={() => setTab("receive")}
            disabled={transferActive && tab !== "receive"}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "receive"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Receive
          </button>
        </div>

        {tab === "send" ? <SendView onActiveChange={setTransferActive} /> : <ReceiveView onActiveChange={setTransferActive} />}
      </div>
    </div>
  );
}
